// Task 8에서 채운다. (Task 5 확인용 임시 무대)
import { buildNestScene } from '../scenes/nestScene.js';
import { updateBillboards } from '../fx/paper.js';
import { createInkPass } from '../fx/inkPass.js';
import * as THREE from 'three';
import { createSnake } from '../actors/snake.js';
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
      this.snake = createSnake();
      const pts=[];for(let i=0;i<8;i++){const a=i/8*Math.PI*2;pts.push(new THREE.Vector3(Math.cos(a)*1.4,0,Math.sin(a)*1.4-0.3));}
      this.snake.setPath(pts,true); stage.group.add(this.snake.mesh);
      const rr=Number(new URLSearchParams(location.search).get('rear')||0); this.snake.rearUp(rr); this.snake.lookAt(new THREE.Vector3(0,0.15,0));
      ink.setTension(tension);
      const b = ctx.calibrate();
      engine.rig.position.y = 0.15 - b.headY;
      this.ctx = ctx;
    },
    update(dt) { ink.update(dt); this.snake.update(dt); updateBillboards(stage.group, this.ctx.engine.camera); return 'running'; },
    exit() { this.ctx.engine.scene.remove(stage.group); },
  };
}
