import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { VoiceConnectionStatus } from '@discordjs/voice';
import type { VoiceConnection } from '@discordjs/voice';
import { MusicSession, getSession } from './session.js';
import type { SessionDeps } from './session.js';
import type { Track } from './types.js';

// Stand-in for a VoiceConnection: an emitter with a state, subscribe() and destroy()
class FakeConnection extends EventEmitter {
  state: { status: VoiceConnectionStatus };
  constructor(status: VoiceConnectionStatus, readonly log: string[]) {
    super();
    this.state = { status };
  }
  subscribe() { return undefined; }
  destroy() {
    this.log.push('destroy');
    this.state = { status: VoiceConnectionStatus.Destroyed };
    this.emit(VoiceConnectionStatus.Destroyed);
  }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const track = (id: string): Track =>
  ({ id, title: id, url: `https://www.youtube.com/watch?v=${id}`, channel: 'c', durationSec: 100, requestedById: 'u', requestedByName: 'Sam' });

let guildSeq = 0;
const created: MusicSession[] = [];
// Destroy everything so the voice library's audio timers don't keep the test process alive
after(() => { for (const s of created) void s.destroy(); });
function makeSession(opts: { status?: VoiceConnectionStatus; statusDelayMs?: number; readyTimeoutMs?: number } = {}) {
  const log: string[] = [];
  const connection = new FakeConnection(opts.status ?? VoiceConnectionStatus.Ready, log);
  const deps = {
    connection: connection as unknown as VoiceConnection,
    setStatus: async (status: string) => {
      await sleep(opts.statusDelayMs ?? 0);
      log.push(`status:${status}`);
    },
    openStream: () => ({ stream: new PassThrough(), kill() {} }),
    readyTimeoutMs: opts.readyTimeoutMs ?? 10_000,
  } as SessionDeps;
  const guildId = `g${++guildSeq}`;
  const session = MusicSession.createWith(guildId, 'c1', deps);
  created.push(session);
  return { session, connection, log, guildId };
}

test('skip moves on immediately while the current track is still loading', () => {
  const { session } = makeSession();
  const a = track('A'), b = track('B');
  session.enqueue(a);
  session.enqueue(b);
  assert.equal(session.queue.current, a);
  session.skip();
  assert.equal(session.queue.current, b);
  session.destroy();
});

test('skip on the last track leaves', () => {
  const { session, guildId } = makeSession();
  session.enqueue(track('A'));
  session.skip();
  assert.equal(getSession(guildId), undefined);
});

test('leaving clears the channel status before disconnecting', async () => {
  const { session, log } = makeSession({ statusDelayMs: 20 });
  session.enqueue(track('A'));
  await sleep(5);
  await session.destroy();
  const cleared = log.indexOf('status:');
  assert.ok(cleared !== -1, `status never cleared: ${log.join(',')}`);
  assert.ok(cleared < log.indexOf('destroy'), `order was ${log.join(',')}`);
});

test('a connection that never becomes ready ends the session', async () => {
  const { guildId, log } = makeSession({ status: VoiceConnectionStatus.Signalling, readyTimeoutMs: 30 });
  await sleep(80);
  assert.equal(getSession(guildId), undefined);
  assert.ok(log.includes('destroy'));
});
