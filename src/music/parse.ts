import type { TrackInfo } from './types.js';

export type ParsedVideo = { ok: true; track: TrackInfo } | { ok: false; reason: 'live' | 'unavailable' };

interface YtDlpEntry {
  id?: unknown;
  title?: unknown;
  channel?: unknown;
  uploader?: unknown;
  duration?: unknown;
  is_live?: unknown;
  live_status?: unknown;
}

function tryParse(line: string): YtDlpEntry | undefined {
  try {
    const v: unknown = JSON.parse(line);
    return v && typeof v === 'object' ? (v as YtDlpEntry) : undefined;
  } catch {
    return undefined;
  }
}

function isLive(e: YtDlpEntry): boolean {
  return e.is_live === true || e.live_status === 'is_live' || e.live_status === 'is_upcoming';
}

function toTrack(e: YtDlpEntry): TrackInfo | undefined {
  if (typeof e.id !== 'string' || !e.id) return undefined;
  const channel = typeof e.channel === 'string' ? e.channel : typeof e.uploader === 'string' ? e.uploader : 'Unknown';
  return {
    id: e.id,
    title: typeof e.title === 'string' ? e.title : e.id,
    channel,
    durationSec: typeof e.duration === 'number' ? e.duration : 0,
    url: `https://www.youtube.com/watch?v=${e.id}`,
  };
}

// Output of `yt-dlp --flat-playlist --dump-json ytsearchN:…`: one JSON object per line
export function parseSearchLines(stdout: string): TrackInfo[] {
  const tracks: TrackInfo[] = [];
  for (const line of stdout.split('\n')) {
    const e = line.trim() ? tryParse(line) : undefined;
    if (!e || isLive(e)) continue;
    const t = toTrack(e);
    if (t) tracks.push(t);
  }
  return tracks;
}

// Output of `yt-dlp --dump-single-json <url>`
export function parseVideoJson(stdout: string): ParsedVideo {
  const e = tryParse(stdout);
  if (!e) return { ok: false, reason: 'unavailable' };
  if (isLive(e)) return { ok: false, reason: 'live' };
  const track = toTrack(e);
  return track ? { ok: true, track } : { ok: false, reason: 'unavailable' };
}
