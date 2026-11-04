import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectGestures } from '../src/input/gestures.js';

const s = (head, hands = null, pinch = false) => ({ head: { x: 0, y: 1.7, z: 0, ...head }, hands, pinch });

test('crouch is relative to baseline', () => {
  assert.equal(detectGestures(s({ y: 1.40 }), { headY: 1.70, headX: 0 }).crouch, true);
  assert.equal(detectGestures(s({ y: 1.10 }), { headY: 1.20, headX: 0 }).crouch, false);
  assert.equal(detectGestures(s({ y: 0.90 }), { headY: 1.20, headX: 0 }).crouch, true);
});

test('lean left/right', () => {
  const b = { headY: 1.7, headX: 0 };
  assert.equal(detectGestures(s({ x: -0.2 }), b).lean, -1);
  assert.equal(detectGestures(s({ x: 0.2 }), b).lean, 1);
  assert.equal(detectGestures(s({ x: 0.1 }), b).lean, 0);
});

test('flap uses fastest downward hand', () => {
  const g = detectGestures(s({}, { left: { y: 1, vy: -2.0 }, right: { y: 1, vy: -0.5 } }), { headY: 1.7, headX: 0 });
  assert.equal(g.flapSpeed, 2.0);
});

test('missing hands yields zero flap', () => {
  const g = detectGestures(s({}, null), { headY: 1.7, headX: 0 });
  assert.equal(g.flapSpeed, 0);
});

test('upward hand motion is not a flap', () => {
  const g = detectGestures(s({}, { right: { y: 1, vy: 2.0 } }), { headY: 1.7, headX: 0 });
  assert.equal(g.flapSpeed, 0);
});
