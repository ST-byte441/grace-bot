import {
  AudioPlayerStatus, NoSubscriberBehavior, StreamType, VoiceConnectionStatus,
  createAudioPlayer, createAudioResource, entersState, joinVoiceChannel,
} from '@discordjs/voice';
import type { AudioPlayer, AudioResource, VoiceConnection } from '@discordjs/voice';
import type { Client, VoiceBasedChannel } from 'discord.js';
import { voiceStatusText } from './format.js';
import { TrackQueue } from './queue.js';
import type { Track } from './types.js';
import { setVoiceStatus } from './voiceStatus.js';
import { openAudioStream } from './ytdlp.js';
import type { AudioStream } from './ytdlp.js';

// One session per guild; in memory only
const sessions = new Map<string, MusicSession>();

export interface SessionDeps {
  connection: VoiceConnection;
  setStatus: (status: string) => Promise<void>;
  player?: AudioPlayer;
  openStream?: (url: string) => AudioStream;
  readyTimeoutMs?: number;
}

const DEFAULT_READY_TIMEOUT_MS = 20_000;
const STATUS_CLEAR_TIMEOUT_MS = 2_000;

export function getSession(guildId: string): MusicSession | undefined {
  return sessions.get(guildId);
}

export class MusicSession {
  readonly guildId: string;
  readonly channelId: string;
  readonly queue = new TrackQueue();
  readonly #setStatus: (status: string) => Promise<void>;
  readonly #openStream: (url: string) => AudioStream;
  readonly #connection: VoiceConnection;
  readonly #player: AudioPlayer;
  #resource: AudioResource | undefined;
  #stream: AudioStream | undefined;
  #destroyed = false;
  #leaving: Promise<void> = Promise.resolve();
  readonly #readyTimeoutMs: number;

  private constructor(guildId: string, channelId: string, deps: SessionDeps) {
    this.guildId = guildId;
    this.channelId = channelId;
    this.#connection = deps.connection;
    this.#setStatus = deps.setStatus;
    this.#openStream = deps.openStream ?? openAudioStream;
    this.#readyTimeoutMs = deps.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT_MS;
    // maxMissedFrames 250 (5 s) rides out short YouTube stalls instead of ending the song early
    this.#player = deps.player ?? createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause, maxMissedFrames: 250 } });
    this.#connection.subscribe(this.#player);

    // A finished, skipped or failed track all end in Idle: move on
    this.#player.on(AudioPlayerStatus.Idle, () => {
      if (!this.#destroyed) this.#playNext();
    });
    this.#player.on('error', err => {
      console.error('[music]', `player error in guild ${this.guildId}:`, err.message);
      this.#stream?.kill();
    });

    // Disconnected can be a channel move (reconnects on its own) or a kick: give it 5 s to recover
    this.#connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(this.#connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.#connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        void this.destroy();
      }
    });
    this.#connection.on(VoiceConnectionStatus.Destroyed, () => void this.destroy());
    this.#connection.on('error', err => console.error('[music]', `voice connection error in guild ${this.guildId}:`, err.message));

    // A voice handshake that never completes would leave a dead session that keeps accepting songs
    entersState(this.#connection, VoiceConnectionStatus.Ready, this.#readyTimeoutMs).catch(() => {
      if (this.#destroyed) return;
      console.warn('[music]', `voice connection in guild ${this.guildId} never became ready; leaving`);
      void this.destroy();
    });
  }

  static create(channel: VoiceBasedChannel): MusicSession {
    const client: Client = channel.client;
    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true,
    });
    return MusicSession.createWith(channel.guild.id, channel.id, {
      connection,
      setStatus: status => setVoiceStatus(client, channel.id, status),
    });
  }

  // Builds and registers a session from explicit dependencies (also the seam the tests use)
  static createWith(guildId: string, channelId: string, deps: SessionDeps): MusicSession {
    const session = new MusicSession(guildId, channelId, deps);
    sessions.set(guildId, session);
    return session;
  }

  // Returns the track's position; starts playback if nothing is playing
  enqueue(track: Track): number {
    const position = this.queue.add(track);
    if (!this.queue.current && this.#player.state.status === AudioPlayerStatus.Idle) this.#playNext();
    return position;
  }

  skip(): void {
    // Forced: a plain stop() only pads silence, which never plays while paused or loading
    this.#player.stop(true); // Idle handler advances (or leaves if nothing is left)
  }

  pause(): boolean {
    return this.#player.pause();
  }

  resume(): boolean {
    return this.#player.unpause();
  }

  get isPaused(): boolean {
    const s = this.#player.state.status;
    return s === AudioPlayerStatus.Paused || s === AudioPlayerStatus.AutoPaused;
  }

  get elapsedSec(): number {
    return this.#resource ? Math.floor(this.#resource.playbackDuration / 1000) : 0;
  }

  // Idempotent. Clears the channel status first (the endpoint needs the bot still connected), then disconnects
  destroy(): Promise<void> {
    if (this.#destroyed) return this.#leaving;
    this.#destroyed = true;
    if (sessions.get(this.guildId) === this) sessions.delete(this.guildId);
    this.#stream?.kill();
    this.#stream = undefined;
    this.#resource = undefined;
    this.queue.clear();
    this.#player.stop(true);
    this.#leaving = this.#leave();
    return this.#leaving;
  }

  async #leave(): Promise<void> {
    const status = this.#connection.state.status;
    if (status !== VoiceConnectionStatus.Destroyed && status !== VoiceConnectionStatus.Disconnected) {
      let timer: NodeJS.Timeout | undefined;
      await Promise.race([
        this.#setStatus(''),
        new Promise<void>(resolve => { timer = setTimeout(resolve, STATUS_CLEAR_TIMEOUT_MS); }),
      ]);
      clearTimeout(timer);
    }
    // A /play during the clear joins through the same guild connection; leave it to the new session
    if (sessions.has(this.guildId)) return;
    if (this.#connection.state.status !== VoiceConnectionStatus.Destroyed) this.#connection.destroy();
  }

  // Plays the next queued track, or leaves when the queue is empty. Tracks that fail to open are skipped
  #playNext(): void {
    for (;;) {
      this.#stream?.kill();
      this.#stream = undefined;
      this.#resource = undefined;
      const track = this.queue.advance();
      if (!track) {
        void this.destroy();
        return;
      }
      try {
        this.#stream = this.#openStream(track.url);
        this.#resource = createAudioResource(this.#stream.stream, { inputType: StreamType.OggOpus });
        this.#player.play(this.#resource);
        void this.#showStatus(voiceStatusText(track));
        return;
      } catch (e: any) {
        console.error('[music]', `failed to play ${track.url}:`, e?.message ?? String(e));
      }
    }
  }

  // The status endpoint needs the bot to actually be in the channel, so wait for Ready first
  async #showStatus(status: string): Promise<void> {
    try {
      await entersState(this.#connection, VoiceConnectionStatus.Ready, this.#readyTimeoutMs);
    } catch {
      return;
    }
    if (!this.#destroyed) await this.#setStatus(status);
  }
}
