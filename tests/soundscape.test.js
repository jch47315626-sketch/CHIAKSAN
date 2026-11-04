import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSoundscape, clampBpm } from '../src/audio/soundscape.js';

test('calls before unlock are no-ops', () => {
  let constructed = 0;
  class FakeCtx { constructor() { constructed++; } }
  const s = createSoundscape(FakeCtx);
  assert.doesNotThrow(() => {
    s.wind(0.5); s.hiss({ x: 0, y: 0, z: 0 }, 1); s.drone(0.4); s.heartbeat(90);
    s.breath('gasp'); s.sting('spotted'); s.setListener({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0, w: 1 }); s.update(0.016);
  });
  assert.equal(constructed, 0);
});

test('missing AudioContext never throws', async () => {
  const s = createSoundscape(undefined);
  await assert.doesNotReject(() => s.unlock());
  assert.doesNotThrow(() => s.heartbeat(80));
});

test('heartbeat bpm is clamped to 50..160', () => {
  assert.equal(clampBpm(10), 50);
  assert.equal(clampBpm(300), 160);
  assert.equal(clampBpm(90), 90);
});

test('unlock does not hang when resume never resolves', async () => {
  // 어떤 Web Audio 호출이든 받아 주는 가짜 노드
  const node = () => new Proxy(function () {}, {
    get: (t, k) => (k === 'connect' ? () => node() : k === 'getChannelData' ? () => new Float32Array(16) : node()),
    set: () => true,
    apply: () => node(),
  });
  class StuckCtx {
    constructor() {
      this.state = 'suspended'; this.sampleRate = 8000; this.currentTime = 0; this.destination = node(); this.listener = node();
      return new Proxy(this, { get: (t, k) => (k in t ? t[k] : () => node()) });
    }
    resume() { return new Promise(() => {}); }
  }
  const s = createSoundscape(StuckCtx);
  const result = await Promise.race([s.unlock().then(() => 'done'), new Promise((r) => setTimeout(() => r('hung'), 200))]);
  assert.equal(result, 'done');
});
