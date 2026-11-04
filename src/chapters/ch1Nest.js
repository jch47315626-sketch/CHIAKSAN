// Task 8에서 채운다. (Task 5 확인용 임시 무대)
import { buildNestScene } from '../scenes/nestScene.js';
import { updateBillboards } from '../fx/paper.js';
import { createInkPass } from '../fx/inkPass.js';
export function createCh1Nest() {
  let stage, ink;
  const tension = Number(new URLSearchParams(location.search).get('tension') ?? 0.3);
  return {
    id: 'ch1', checkpoints: ['half'],
    enter(ctx) {
      const { engine } = ctx;
      stage = buildNestScene();
      engine.scene.add(stage.group);
      engine.scene.fog = stage.fog;
      ink ??= createInkPass(engine);
      ink.setTension(tension);
      const b = ctx.calibrate();
      engine.rig.position.y = 0.15 - b.headY;
      this.ctx = ctx;
    },
    update(dt) { ink.update(dt); updateBillboards(stage.group, this.ctx.engine.camera); return 'running'; },
    exit() { this.ctx.engine.scene.remove(stage.group); },
  };
}
