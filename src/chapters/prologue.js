// Task 8에서 채운다.
export function createPrologue() {
  let t = 0;
  return { id: 'prologue', checkpoints: [], enter() { t = 0; }, update(dt) { t += dt; return t > 3 ? 'complete' : 'running'; }, exit() {} };
}
