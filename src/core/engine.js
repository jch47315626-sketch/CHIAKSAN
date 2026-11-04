import * as THREE from 'three';

/**
 * Three.js 렌더러 + WebXR. rig는 카메라와 손을 담는 그룹으로, 장마다 위치·높이를 맞춘다.
 */
export function createEngine(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');
  renderer.xr.setFoveation(1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 200);
  camera.position.set(0, 1.6, 0);
  const rig = new THREE.Group();
  rig.add(camera);
  scene.add(rig);

  const frameCbs = [];
  const endCbs = [];
  let last = performance.now();

  renderer.setAnimationLoop((t, xrFrame) => {
    const now = performance.now();
    const dt = (now - last) / 1000;
    last = now;
    for (const cb of frameCbs) cb(dt, xrFrame);
    renderer.render(scene, camera);
  });

  window.addEventListener('resize', () => {
    if (renderer.xr.isPresenting) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  async function vrSupported() {
    try { return !!navigator.xr && (await navigator.xr.isSessionSupported('immersive-vr')); } catch { return false; }
  }

  async function enterVR() {
    const session = await navigator.xr.requestSession('immersive-vr', {
      optionalFeatures: ['local-floor', 'hand-tracking'],
    });
    session.addEventListener('end', () => { for (const cb of endCbs) cb(); });
    await renderer.xr.setSession(session);
  }

  return {
    renderer, scene, camera, rig,
    onFrame(cb) { frameCbs.push(cb); },
    onSessionEnd(cb) { endCbs.push(cb); },
    enterVR, vrSupported,
    isXR: () => renderer.xr.isPresenting,
  };
}
