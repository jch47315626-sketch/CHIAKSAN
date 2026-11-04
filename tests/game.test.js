import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/core/game.js';

function fakeChapter(id, script = () => 'running') {
  const log = { enters: [], exits: 0, dts: [] };
  return {
    id, log, checkpoints: ['half'],
    enter(ctx, cp) { log.enters.push(cp); this.ctx = ctx; },
    update(dt) { log.dts.push(dt); return script(log); },
    exit() { log.exits++; },
  };
}

const G = {};

test('start enters first chapter with null checkpoint', () => {
  const a = fakeChapter('a');
  const g = createGame({ chapters: [a], mode: 'mild' });
  g.start();
  assert.equal(g.state.screen, 'playing');
  assert.deepEqual(a.log.enters, [null]);
});

test('complete advances to next chapter and clears checkpoint', () => {
  const a = fakeChapter('a', () => 'complete');
  const b = fakeChapter('b');
  const g = createGame({ chapters: [a, b], mode: 'mild' });
  g.start();
  g.reachCheckpoint('half');
  g.tick(0.016, G);
  assert.equal(g.state.chapterIndex, 1);
  assert.equal(g.state.checkpointId, null);
  assert.deepEqual(b.log.enters, [null]);
  assert.equal(a.log.exits, 1);
});

test('fail re-enters same chapter at last checkpoint', () => {
  let n = 0;
  const a = fakeChapter('a', () => (n++ === 0 ? 'fail' : 'running'));
  const g = createGame({ chapters: [a], mode: 'mild' });
  g.start();
  g.reachCheckpoint('half');
  g.tick(0.016, G);
  assert.deepEqual(a.log.enters, [null, 'half']);
  assert.equal(g.state.failCount, 1);
  assert.equal(g.state.chapterIndex, 0);
});

test('no auto-advance', () => {
  const a = fakeChapter('a');
  const g = createGame({ chapters: [a, fakeChapter('b')], mode: 'mild' });
  g.start();
  for (let i = 0; i < 100; i++) g.tick(0.1, G);
  assert.equal(g.state.chapterIndex, 0);
});

test('dt is clamped', () => {
  const a = fakeChapter('a');
  const g = createGame({ chapters: [a], mode: 'mild' });
  g.start();
  g.tick(5.0, G);
  assert.equal(a.log.dts[0], 0.1);
});

test('last chapter complete goes to ending', () => {
  const g = createGame({ chapters: [fakeChapter('a', () => 'complete')], mode: 'spicy' });
  g.start();
  g.tick(0.016, G);
  assert.equal(g.state.screen, 'ending');
});

test('reset returns to title', () => {
  const a = fakeChapter('a');
  const g = createGame({ chapters: [a, fakeChapter('b')], mode: 'mild' });
  g.start();
  g.reachCheckpoint('half');
  g.reset();
  assert.equal(g.state.screen, 'title');
  assert.equal(g.state.chapterIndex, 0);
  assert.equal(g.state.checkpointId, null);
  assert.equal(a.log.exits, 1);
});

test('tick on title screen does nothing', () => {
  const a = fakeChapter('a');
  const g = createGame({ chapters: [a], mode: 'mild' });
  g.tick(0.016, G);
  assert.equal(a.log.dts.length, 0);
});

test('chapter ctx exposes mode and reachCheckpoint', () => {
  const a = fakeChapter('a');
  const g = createGame({ chapters: [a], mode: 'spicy' });
  g.start();
  assert.equal(a.ctx.mode, 'spicy');
  a.ctx.reachCheckpoint('half');
  assert.equal(g.state.checkpointId, 'half');
});

test('start at a chapter index', () => {
  const b = fakeChapter('b');
  const g = createGame({ chapters: [fakeChapter('a'), b], mode: 'mild' });
  g.start(1);
  assert.equal(g.state.chapterIndex, 1);
  assert.deepEqual(b.log.enters, [null]);
});

test('retry after fail is flagged so chapters keep their baseline', () => {
  let n = 0;
  const seen = [];
  const a = fakeChapter('a', () => (n++ === 0 ? 'fail' : 'complete'));
  a.enter = function (ctx, cp) { seen.push(ctx.retry); };
  const b = fakeChapter('b');
  b.enter = function (ctx) { seen.push(ctx.retry); };
  const g = createGame({ chapters: [a, b], mode: 'mild' });
  g.start();
  g.tick(0.016, G); // fail -> retry
  g.tick(0.016, G); // complete -> next chapter fresh
  assert.deepEqual(seen, [false, true, false]);
});

test('start and reset clear presentation state', () => {
  let calls = 0;
  const g = createGame({ chapters: [fakeChapter('a')], mode: 'mild', extraCtx: { resetPresentation: () => calls++ } });
  g.start();
  assert.equal(calls, 1);
  g.reset();
  assert.equal(calls, 2);
});
