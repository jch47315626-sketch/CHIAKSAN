import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCh1Rules } from '../src/chapters/ch1Rules.js';
import { CONFIG } from '../src/config.js';

const DT = 0.05;
function run(rules, seconds, input) {
  let out;
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) {
    out = rules.step(DT, typeof input === 'function' ? input(i * DT) : input);
    if (out.status === 'fail') return out;
  }
  return out;
}

test('hiding while snake faces survives', () => {
  const out = run(createCh1Rules(null), 10, { crouch: true, snakeFacing: true });
  assert.equal(out.status, 'running');
});

test('standing while snake faces fails after grace', () => {
  assert.equal(run(createCh1Rules(null), 0.3, { crouch: false, snakeFacing: true }).status, 'running');
  assert.equal(run(createCh1Rules(null), 0.5, { crouch: false, snakeFacing: true }).status, 'fail');
});

test('standing while snake looks away is safe', () => {
  assert.equal(run(createCh1Rules(null), 20, { crouch: false, snakeFacing: false }).status, 'running');
});

test('breath runs out forces head up', () => {
  const r = createCh1Rules(null);
  assert.equal(run(r, 11.9, { crouch: true, snakeFacing: true }).status, 'running');
  assert.equal(run(r, 0.6, { crouch: true, snakeFacing: true }).status, 'fail');
});

test('breath recovers when head up and snake away', () => {
  const r = createCh1Rules(null);
  run(r, 6, { crouch: true, snakeFacing: false });
  const out = run(r, 3, { crouch: false, snakeFacing: false });
  assert.ok(out.breath > 0.99, `breath ${out.breath}`);
});

test('checkpoint reported once at 45s', () => {
  const r = createCh1Rules(null);
  let reports = 0;
  for (let t = 0; t < 60; t += DT) {
    if (r.step(DT, { crouch: false, snakeFacing: false }).checkpoint === 'half') reports++;
  }
  assert.equal(reports, 1);
});

test('start from half begins at 45s', () => {
  const out = createCh1Rules('half').step(DT, { crouch: false, snakeFacing: false });
  assert.ok(out.survived >= CONFIG.CH1_CHECKPOINT_S);
});

test('arrow at 90s then complete after 6s', () => {
  const r = createCh1Rules('half');
  const at = run(r, CONFIG.CH1_SURVIVE_S - CONFIG.CH1_CHECKPOINT_S + 0.1, { crouch: false, snakeFacing: false });
  assert.equal(at.status, 'arrow');
  assert.equal(run(r, 1, { crouch: false, snakeFacing: true }).status, 'arrow', 'no detection during arrow');
  assert.equal(run(r, CONFIG.CH1_ARROW_S, { crouch: false, snakeFacing: false }).status, 'complete');
});

test('tension floor is 0.3', () => {
  const out = run(createCh1Rules(null), 20, { crouch: false, snakeFacing: false });
  assert.ok(Math.abs(out.tension - 0.3) < 1e-9, `tension ${out.tension}`);
});

test('tension rises toward 1 while snake faces', () => {
  const out = run(createCh1Rules(null), 3, { crouch: true, snakeFacing: true });
  assert.equal(out.tension, 1);
});
