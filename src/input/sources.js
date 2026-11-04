import * as THREE from 'three';

const DESK_HEAD_Y = 1.6;

/**
 * XR 머리·손·컨트롤러와 노트북 키보드·마우스를 같은 입력 샘플로 바꾼다.
 * sample = { head:{x,y,z}, hands:{left?,right?}|null, pinch, look:{dir:Vector3} }
 */
export function createInputSources(engine) {
  const { renderer, camera, rig } = engine;

  // XR 손과 컨트롤러 (rig 안에 두어 rig 좌표계로 읽힌다)
  const tracked = [0, 1].map((i) => {
    const hand = renderer.xr.getHand(i);
    const grip = renderer.xr.getControllerGrip(i);
    const ctrl = renderer.xr.getController(i);
    rig.add(hand, grip, ctrl);
    const t = { hand, grip, ctrl, prevY: null, vy: 0, y: 0, pressed: false, handedness: i === 0 ? 'left' : 'right' };
    ctrl.addEventListener('connected', (e) => { t.handedness = e.data?.handedness || t.handedness; });
    ctrl.addEventListener('selectstart', () => { t.pressed = true; });
    ctrl.addEventListener('selectend', () => { t.pressed = false; });
    return t;
  });

  // 노트북 미리보기
  const keys = new Set();
  let flapPulse = false;
  let clickPulse = false;
  let yaw = 0, pitch = 0;
  window.addEventListener('keydown', (e) => {
    keys.add(e.code);
    if (e.code === 'Space') { flapPulse = true; e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  const canvas = renderer.domElement;
  canvas.addEventListener('mousedown', () => {
    if (engine.isXR()) return;
    if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
    else clickPulse = true;
  });
  window.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== canvas) return;
    yaw -= e.movementX * 0.0025;
    pitch = Math.max(-1.45, Math.min(1.45, pitch - e.movementY * 0.0025));
  });

  const v = new THREE.Vector3();
  const dir = new THREE.Vector3();

  function readXR(dt) {
    const head = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
    const hands = {};
    let any = false;
    let pinch = false;
    for (const t of tracked) {
      const wrist = t.hand.joints?.wrist;
      let src = null;
      if (wrist && wrist.visible) src = wrist;
      else if (t.grip.visible) src = t.grip;
      if (src) {
        src.getWorldPosition(v);
        rig.worldToLocal(v);
        t.vy = t.prevY === null || dt <= 0 ? 0 : (v.y - t.prevY) / dt;
        t.prevY = v.y;
        hands[t.handedness] = { y: v.y, vy: t.vy };
        any = true;
      } else {
        t.prevY = null;
      }
      pinch ||= t.pressed;
    }
    return { head, hands: any ? hands : null, pinch };
  }

  function readDesktop() {
    const y = DESK_HEAD_Y - (keys.has('ControlLeft') || keys.has('ControlRight') ? 0.3 : 0);
    const x = (keys.has('KeyA') ? -0.2 : 0) + (keys.has('KeyD') ? 0.2 : 0);
    camera.position.set(x, y, 0);
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
    const hands = flapPulse ? { right: { y: 1.2, vy: -2.0 } } : null;
    const pinch = clickPulse;
    flapPulse = false;
    clickPulse = false;
    return { head: { x, y, z: 0 }, hands, pinch };
  }

  return {
    read(dt) {
      const s = engine.isXR() ? readXR(dt) : readDesktop();
      camera.getWorldDirection(dir);
      s.look = { dir: dir.clone() };
      return s;
    },
    /** 장 시작 때 기준 머리 위치를 잰다. */
    calibrate() {
      const p = engine.isXR() ? camera.position : { x: 0, y: DESK_HEAD_Y };
      return { headY: p.y, headX: p.x };
    },
    resetLook() { yaw = 0; pitch = 0; },
  };
}
