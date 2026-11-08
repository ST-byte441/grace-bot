import { EmbedBuilder } from 'discord.js';
import type { TrackQueue } from './queue.js';
import type { TrackInfo } from './types.js';

const YT_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com']);

export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

function parseUrl(s: string): URL | undefined {
  if (!/^https?:\/\//i.test(s.trim())) return undefined;
  try { return new URL(s.trim()); } catch { return undefined; }
}

// A single YouTube video link: watch?v=, youtu.be/<id> or /shorts/<id>
export function isYouTubeUrl(s: string): boolean {
  const u = parseUrl(s);
  if (!u) return false;
  const host = u.hostname.toLowerCase();
  if (host === 'youtu.be') return /^\/[\w-]+$/.test(u.pathname);
  if (!YT_HOSTS.has(host)) return false;
  if (u.pathname === '/watch') return !!u.searchParams.get('v');
  return /^\/shorts\/[\w-]+\/?$/.test(u.pathname);
}

// youtube.com/playlist?list=… with no video to play
export function isYouTubePlaylistOnly(s: string): boolean {
  const u = parseUrl(s);
  return !!u && YT_HOSTS.has(u.hostname.toLowerCase()) && u.pathname === '/playlist' && !!u.searchParams.get('list');
}

export function toSelectOption(t: TrackInfo): { label: string; description: string; value: string } {
  return {
    label: truncate(t.title, 100),
    description: truncate(`${t.channel} · ${formatDuration(t.durationSec)}`, 100),
    value: t.id,
  };
}

export function voiceStatusText(t: TrackInfo): string {
  return truncate(`🎵 ${t.title}`, 500);
}

const UP_NEXT_LIMIT = 10;

export function buildQueueEmbed(q: TrackQueue, elapsedSec: number): EmbedBuilder {
  const cur = q.current;
  const nowPlaying = cur
    ? `${cur.title} · ${formatDuration(elapsedSec)} / ${formatDuration(cur.durationSec)} · added by ${cur.requestedByName}`
    : 'Nothing playing';

  const shown = q.upcoming.slice(0, UP_NEXT_LIMIT)
    .map((t, i) => `${i + 1}. ${truncate(t.title, 80)} · ${formatDuration(t.durationSec)} · ${t.requestedByName}`);
  const extra = q.upcoming.length - shown.length;
  if (extra > 0) shown.push(`…and ${extra} more`);

  return new EmbedBuilder()
    .addFields(
      { name: '▶ Now playing', value: truncate(nowPlaying, 1024) },
      { name: 'Up next', value: shown.length ? truncate(shown.join('\n'), 1024) : 'Nothing queued' },
    )
    .setFooter({ text: `${q.upcoming.length} songs · ${formatDuration(q.remainingSec(elapsedSec))} remaining` });
}
