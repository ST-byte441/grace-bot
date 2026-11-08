import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TrackQueue } from './queue.js';
import type { Track } from './types.js';

function track(id: string, durationSec = 100): Track {
  return { id, title: id, url: `https://www.youtube.com/watch?v=${id}`, channel: 'ch', durationSec, requestedById: 'u1', requestedByName: 'Sam' };
}

test('add returns 1-based position', () => {
  const q = new TrackQueue();
  assert.equal(q.add(track('A')), 1);
  assert.equal(q.add(track('B')), 2);
  assert.equal(q.upcoming.length, 2);
  assert.equal(q.current, undefined);
});

test('advance moves next into current', () => {
  const q = new TrackQueue();
  const a = track('A'), b = track('B');
  q.add(a); q.add(b);
  assert.equal(q.advance(), a);
  assert.equal(q.current, a);
  assert.deepEqual(q.upcoming, [b]);
});

test('advance on empty clears current', () => {
  const q = new TrackQueue();
  q.add(track('A'));
  q.advance();
  assert.equal(q.advance(), undefined);
  assert.equal(q.current, undefined);
});

test('remove by position', () => {
  const q = new TrackQueue();
  const a = track('A'), b = track('B'), c = track('C');
  q.add(a); q.add(b); q.add(c);
  assert.equal(q.remove(2), b);
  assert.deepEqual(q.upcoming, [a, c]);
});

test('remove out of range', () => {
  const q = new TrackQueue();
  q.add(track('A')); q.add(track('B')); q.add(track('C'));
  assert.equal(q.remove(0), undefined);
  assert.equal(q.remove(4), undefined);
  assert.equal(q.remove(1.5), undefined);
  assert.equal(q.upcoming.length, 3);
});

test('remainingSec', () => {
  const q = new TrackQueue();
  q.add(track('A', 200)); q.add(track('B', 100)); q.add(track('C', 30));
  q.advance();
  assert.equal(q.remainingSec(50), 280);
  assert.equal(q.remainingSec(999), 130);
});

test('clear empties current and upcoming', () => {
  const q = new TrackQueue();
  q.add(track('A')); q.add(track('B'));
  q.advance();
  q.clear();
  assert.equal(q.current, undefined);
  assert.equal(q.upcoming.length, 0);
});
