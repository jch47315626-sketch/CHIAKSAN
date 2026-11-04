import { CONFIG } from '../config.js';

/**
 * 1장 "둥지" 규칙. 순수 상태 기계.
 * step(dt, {crouch, snakeFacing}) -> {status, breath, tension, survived, checkpoint, forcedUp, spotted}
 */
export function createCh1Rules(checkpointId) {
  const C = CONFIG;
  let survived = checkpointId === 'half' ? C.CH1_CHECKPOINT_S : 0;
  let checkpointSent = checkpointId === 'half';
  let breath = 1;
  let forcedUp = false;
  let spotTime = 0;
  let tension = C.TENSION_FLOOR;
  let arrowTime = -1;

  return {
    step(dt, { crouch, snakeFacing }) {
      let checkpoint = null;

      if (arrowTime >= 0) {
        arrowTime += dt;
        tension = Math.max(C.TENSION_FLOOR, tension - dt * (1 - C.TENSION_FLOOR) / C.TENSION_FALL_S);
        const status = arrowTime >= C.CH1_ARROW_S ? 'complete' : 'arrow';
        return { status, breath, tension, survived, checkpoint, forcedUp: false, spotted: 0 };
      }

      // 숨: 바닥나면 강제로 고개를 들고, 어느 정도 회복해야 다시 숨을 수 있다
      if (forcedUp && breath >= C.CH1_BREATH_RESUME) forcedUp = false;
      const hidden = crouch && !forcedUp;
      if (hidden) breath -= dt / C.CH1_BREATH_MAX_S;
      else breath += dt / C.CH1_BREATH_RECOVER_S;
      if (breath <= 0) { breath = 0; forcedUp = true; }
      breath = Math.min(1, breath);

      // 들킴
      if (snakeFacing && !(crouch && !forcedUp)) spotTime += dt;
      else spotTime = 0;

      // 긴장도
      if (snakeFacing) tension = Math.min(1, tension + dt * (1 - C.TENSION_FLOOR) / C.TENSION_RISE_S);
      else tension = Math.max(C.TENSION_FLOOR, tension - dt * (1 - C.TENSION_FLOOR) / C.TENSION_FALL_S);

      const spotted = Math.min(1, spotTime / C.CH1_SPOT_GRACE_S);
      if (spotTime > C.CH1_SPOT_GRACE_S) {
        return { status: 'fail', breath, tension, survived, checkpoint, forcedUp, spotted: 1 };
      }

      survived += dt;
      if (!checkpointSent && survived >= C.CH1_CHECKPOINT_S) { checkpointSent = true; checkpoint = 'half'; }
      if (survived >= C.CH1_SURVIVE_S) arrowTime = 0;
      const status = arrowTime >= 0 ? 'arrow' : 'running';
      return { status, breath, tension, survived, checkpoint, forcedUp, spotted };
    },
  };
}
