import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isFacing } from '../src/actors/facing.js';

const O = { x: 0, y: 0, z: 0 };
test('faces target straight ahead', () => assert.equal(isFacing(O, { x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: -3 }), true));
test('target at 90 degrees', () => assert.equal(isFacing(O, { x: 0, y: 0, z: -1 }, { x: 3, y: 0, z: 0 }), false));
test('target behind', () => assert.equal(isFacing(O, { x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: 3 }), false));
test('zero-length direction returns false', () => assert.equal(isFacing(O, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -3 }), false));
test('target at 30 degrees is within default 35', () => {
  const a = (30 * Math.PI) / 180;
  assert.equal(isFacing(O, { x: 0, y: 0, z: -1 }, { x: Math.sin(a), y: 0, z: -Math.cos(a) }), true);
});
