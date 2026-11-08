import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDuration, truncate, isYouTubeUrl, isYouTubePlaylistOnly, toSelectOption, voiceStatusText, buildQueueEmbed,
} from './format.js';
import { TrackQueue } from './queue.js';
import type { Track, TrackInfo } from './types.js';

const info = (over: Partial<TrackInfo> = {}): TrackInfo => ({
  id: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  channel: 'Rick Astley', durationSec: 213, ...over,
});
const track = (title: string, durationSec: number, by: string): Track =>
  ({ ...info({ title, durationSec }), requestedById: by, requestedByName: by });

test('formatDuration', () => {
  assert.equal(formatDuration(0), '0:00');
  assert.equal(formatDuration(59), '0:59');
  assert.equal(formatDuration(213), '3:33');
  assert.equal(formatDuration(3723), '1:02:03');
});

test('truncate', () => {
  assert.equal(truncate('abcdef', 4), 'abc…');
  assert.equal(truncate('abc', 4), 'abc');
  assert.equal(truncate('abcd', 4), 'abcd');
});

test('isYouTubeUrl accepts video links', () => {
  for (const u of [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ',
    'https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=RDabc',
    'https://youtube.com/shorts/abc123',
  ]) assert.equal(isYouTubeUrl(u), true, u);
});

test('isYouTubeUrl rejects non-video input', () => {
  for (const u of ['never gonna give you up', 'https://vimeo.com/1', 'https://www.youtube.com/playlist?list=PL1'])
    assert.equal(isYouTubeUrl(u), false, u);
});

test('isYouTubePlaylistOnly', () => {
  assert.equal(isYouTubePlaylistOnly('https://www.youtube.com/playlist?list=PL1'), true);
  assert.equal(isYouTubePlaylistOnly('https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=RDabc'), false);
});

test('toSelectOption caps label at 100 chars', () => {
  const opt = toSelectOption(info({ title: 'x'.repeat(150) }));
  assert.equal(opt.label.length, 100);
  assert.ok(opt.label.endsWith('…'));
  assert.equal(opt.value, 'dQw4w9WgXcQ');
  assert.equal(toSelectOption(info()).description, 'Rick Astley · 3:33');
});

test('voiceStatusText caps at 500 chars', () => {
  const s = voiceStatusText(info({ title: 'y'.repeat(600) }));
  assert.equal(s.length, 500);
  assert.ok(s.startsWith('🎵 '));
});

test('buildQueueEmbed shows now playing, up next and footer', () => {
  const q = new TrackQueue();
  q.add(track('Current', 200, 'Sam'));
  q.add(track('Next One', 100, 'Alex'));
  q.add(track('Next Two', 30, 'Jordan'));
  q.advance();
  const e = buildQueueEmbed(q, 72).toJSON();
  const now = e.fields?.find(f => f.name === '▶ Now playing')?.value ?? '';
  const next = e.fields?.find(f => f.name === 'Up next')?.value ?? '';
  assert.match(now, /1:12 \/ 3:20/);
  assert.match(now, /added by Sam/);
  assert.match(next, /1\. Next One/);
  assert.match(next, /2\. Next Two/);
  assert.match(e.footer?.text ?? '', /^2 songs · /);
});

test('buildQueueEmbed with nothing upcoming', () => {
  const q = new TrackQueue();
  q.add(track('Only', 200, 'Sam'));
  q.advance();
  const e = buildQueueEmbed(q, 0).toJSON();
  assert.equal(e.fields?.find(f => f.name === 'Up next')?.value, 'Nothing queued');
});

test('buildQueueEmbed caps Up next at 10 entries', () => {
  const q = new TrackQueue();
  q.add(track('Current', 200, 'Sam'));
  for (let i = 0; i < 13; i++) q.add(track(`Song ${i}`, 60, 'Sam'));
  q.advance();
  const next = buildQueueEmbed(q, 0).toJSON().fields?.find(f => f.name === 'Up next')?.value ?? '';
  assert.match(next, /10\. Song 9/);
  assert.doesNotMatch(next, /11\./);
  assert.match(next, /…and 3 more/);
});
