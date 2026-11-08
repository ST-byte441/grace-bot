import { spawn } from 'node:child_process';
import type { Readable } from 'node:stream';
import { parseSearchLines, parseVideoJson } from './parse.js';
import type { ParsedVideo } from './parse.js';
import type { TrackInfo } from './types.js';

// Recent yt-dlp needs a JS runtime for YouTube; Node is already on the host
const JS_RUNTIME_ARGS = ['--js-runtimes', 'node'];
const BASE_ARGS = [...JS_RUNTIME_ARGS, '--no-warnings'];

// YTDLP_BIN overrides the binary (tests, or a non-PATH install)
const ytdlpBin = () => process.env.YTDLP_BIN || 'yt-dlp';

// yt-dlp is missing or failing as a whole (not just one bad video): usually it needs updating
export class YtDlpError extends Error {}

// Runs a command (no shell) and collects stdout; kills it after timeoutMs
function run(cmd: string, args: string[], timeoutMs: number): Promise<{ code: number | null; stdout: string }> {
  return new Promise(resolve => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.on('error', err => {
      clearTimeout(timer);
      console.warn('[music]', `${cmd} failed to start:`, err.message);
      resolve({ code: null, stdout: '' });
    });
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0 && stderr.trim()) console.warn('[music]', `${cmd} exited ${code}:`, stderr.trim().slice(0, 500));
      resolve({ code, stdout });
    });
  });
}

export async function searchYouTube(query: string, limit = 5): Promise<TrackInfo[]> {
  const { code, stdout } = await run(ytdlpBin(), [...BASE_ARGS, '--flat-playlist', '--dump-json', `ytsearch${limit}:${query}`], 20_000);
  if (code !== 0) throw new YtDlpError(`yt-dlp search exited ${code}`);
  return parseSearchLines(stdout).slice(0, limit);
}

export async function resolveVideo(url: string): Promise<ParsedVideo> {
  const { code, stdout } = await run(ytdlpBin(), [...BASE_ARGS, '--dump-single-json', '--no-playlist', '--', url], 20_000);
  if (code === null) throw new YtDlpError('yt-dlp did not run');
  if (code !== 0) return { ok: false, reason: 'unavailable' };
  return parseVideoJson(stdout);
}

export interface AudioStream {
  stream: Readable;
  kill(): void;
}

// yt-dlp (best audio) piped into ffmpeg, which re-encodes to 48 kHz stereo Ogg/Opus for @discordjs/voice
export function openAudioStream(url: string): AudioStream {
  // bestaudio/best: fall back to a muxed format (ffmpeg drops the video) when no audio-only one is offered.
  // Warnings stay on here so stderr explains failed tracks in the logs
  const ytdlp = spawn(ytdlpBin(), [...JS_RUNTIME_ARGS, '-f', 'bestaudio/best', '--no-playlist', '-q', '-o', '-', '--', url], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const ffmpeg = spawn('ffmpeg', [
    '-loglevel', 'error', '-i', 'pipe:0', '-vn', '-c:a', 'libopus', '-b:a', '128k', '-ar', '48000', '-ac', '2', '-f', 'ogg', 'pipe:1',
  ], { stdio: ['pipe', 'pipe', 'pipe'] });

  ytdlp.stdout.pipe(ffmpeg.stdin);
  // EPIPE when ffmpeg is killed first (skip/leave) is expected
  ffmpeg.stdin.on('error', () => {});
  ytdlp.stdout.on('error', () => {});

  const logStderr = (name: string) => (d: Buffer) => {
    const text = d.toString().trim();
    if (text) console.warn('[music]', `${name}:`, text.slice(0, 500));
  };
  ytdlp.stderr.on('data', logStderr('yt-dlp'));
  ffmpeg.stderr.on('data', logStderr('ffmpeg'));
  ytdlp.on('error', err => console.warn('[music]', 'yt-dlp failed to start:', err.message));
  ffmpeg.on('error', err => console.warn('[music]', 'ffmpeg failed to start:', err.message));

  return {
    stream: ffmpeg.stdout,
    kill() {
      if (ytdlp.exitCode === null) ytdlp.kill('SIGKILL');
      if (ffmpeg.exitCode === null) ffmpeg.kill('SIGKILL');
    },
  };
}
