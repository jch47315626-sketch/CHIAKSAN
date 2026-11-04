import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vignetteHole } from '../src/fx/vignetteShape.js';

test('clear centre is not drawn when there is no blackout', () => {
  assert.ok(vignetteHole(0.3, 0) > 0.3);
  assert.ok(vignetteHole(1, 0) > 0);
});

test('hole shrinks as tension rises', () => {
  assert.ok(vignetteHole(1, 0) < vignetteHole(0.3, 0));
});

test('full disc is drawn during blackout', () => {
  assert.equal(vignetteHole(0.3, 0.5), 0);
});
