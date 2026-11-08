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
}

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

  private constructor(guildId: string, channelId: string, deps: SessionDeps) {
    this.guildId = guildId;
    this.channelId = channelId;
    this.#connection = deps.connection;
    this.#setStatus = deps.setStatus;
    this.#openStream = deps.openStream ?? openAudioStream;
    this.#player = deps.player ?? createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });
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
        this.destroy();
      }
    });
    this.#connection.on(VoiceConnectionStatus.Destroyed, () => this.destroy());
    this.#connection.on('error', err => console.error('[music]', `voice connection error in guild ${this.guildId}:`, err.message));
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
    this.#player.stop(); // Idle handler advances (or leaves if nothing is left)
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

  destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;
    if (sessions.get(this.guildId) === this) sessions.delete(this.guildId);
    this.#stream?.kill();
    this.#stream = undefined;
    this.#resource = undefined;
    this.queue.clear();
    this.#player.stop(true);
    void this.#setStatus('');
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
        this.destroy();
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
      await entersState(this.#connection, VoiceConnectionStatus.Ready, 20_000);
    } catch {
      return;
    }
    if (!this.#destroyed) await this.#setStatus(status);
  }
}
