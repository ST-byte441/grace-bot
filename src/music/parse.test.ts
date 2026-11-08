import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSearchLines, parseVideoJson } from './parse.js';

test('parseSearchLines keeps valid, skips garbage and live', () => {
  const stdout = [
    JSON.stringify({ id: 'abc', title: 'Song', channel: 'Chan', duration: 213 }),
    'not json',
    JSON.stringify({ id: 'live1', title: 'Radio', channel: 'Chan', live_status: 'is_live' }),
  ].join('\n');
  assert.deepEqual(parseSearchLines(stdout), [
    { id: 'abc', title: 'Song', channel: 'Chan', durationSec: 213, url: 'https://www.youtube.com/watch?v=abc' },
  ]);
});

test('parseSearchLines falls back to uploader and zero duration', () => {
  const [t] = parseSearchLines(JSON.stringify({ id: 'x', title: 'T', uploader: 'Up' }));
  assert.equal(t?.channel, 'Up');
  assert.equal(t?.durationSec, 0);
});

test('parseVideoJson valid', () => {
  const r = parseVideoJson(JSON.stringify({ id: 'abc', title: 'Song', channel: 'Chan', duration: 100 }));
  assert.deepEqual(r, { ok: true, track: { id: 'abc', title: 'Song', channel: 'Chan', durationSec: 100, url: 'https://www.youtube.com/watch?v=abc' } });
});

test('parseVideoJson rejects live', () => {
  assert.deepEqual(parseVideoJson(JSON.stringify({ id: 'x', is_live: true })), { ok: false, reason: 'live' });
  assert.deepEqual(parseVideoJson(JSON.stringify({ id: 'x', live_status: 'is_upcoming' })), { ok: false, reason: 'live' });
});

test('parseVideoJson rejects unparseable', () => {
  assert.deepEqual(parseVideoJson('not json'), { ok: false, reason: 'unavailable' });
  assert.deepEqual(parseVideoJson(JSON.stringify({ title: 'no id' })), { ok: false, reason: 'unavailable' });
});
