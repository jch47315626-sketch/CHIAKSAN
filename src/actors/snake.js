import * as THREE from 'three';
import { rng, loadArtTexture } from '../fx/paper.js';
export { isFacing } from './facing.js';

function scaleTexture(seed) {
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d'), r = rng(seed);
  ctx.fillStyle = '#17140f';
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = '#6a5e4c';
  ctx.lineWidth = 3;
  for (let y = 0; y < S + 32; y += 24) {
    for (let x = (y / 24) % 2 ? 0 : 16; x < S + 32; x += 32) {
      ctx.globalAlpha = 0.5 + r() * 0.5;
      ctx.beginPath(); ctx.arc(x, y, 15, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/**
 * 코드로 만든 구렁이. 마디(InstancedMesh)가 경로 곡선을 따라 미끄러지며 좌우로 굽이친다.
 */
export function createSnake({ segments = 48, radius = 0.12, length = 6, seed = 3 } = {}) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshBasicMaterial({ map: scaleTexture(seed), fog: true });
  // public/art/snake_scales.png 가 있으면 그 비늘 그림으로 바꾼다
  loadArtTexture('snake_scales').then((t) => {
    if (!t) return;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 1);
    bodyMat.map = t;
    bodyMat.needsUpdate = true;
  });
  const body = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), bodyMat, segments);
  body.frustumCulled = false;
  group.add(body);

  const head = new THREE.Group();
  const skull = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), bodyMat);
  skull.scale.set(radius * 1.25, radius * 0.8, radius * 2.0);
  head.add(skull);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xb3121b, fog: false });
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.22, 8, 6), eyeMat);
    eye.position.set(sx * radius * 0.85, radius * 0.35, -radius * 1.1);
    head.add(eye);
  }
  const tongue = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.12, radius * 0.04, radius * 1.4), eyeMat);
  tongue.position.set(0, -radius * 0.2, -radius * 2.4);
  head.add(tongue);
  group.add(head);

  let curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-1, 0, 0), new THREE.Vector3(1, 0, 0)], false);
  let curveLen = 2;
  let s = 0; // 머리가 경로 위에서 간 거리
  let time = 0;
  let rear = 0, rearTarget = 0;
  let lookTarget = null;
  const spacing = length / segments;
  const api = { speed: 0.6, amplitude: 0.12 };

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  const p = new THREE.Vector3(), tan = new THREE.Vector3(), side = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const headPos = new THREE.Vector3(), headDir = new THREE.Vector3(0, 0, -1);
  const prev = new THREE.Vector3();

  function pointAt(dist, out, outTan) {
    let u = dist / curveLen;
    u = curve.closed ? ((u % 1) + 1) % 1 : THREE.MathUtils.clamp(u, 0, 1);
    curve.getPointAt(u, out);
    curve.getTangentAt(u, outTan);
  }

  function layout() {
    for (let i = 0; i < segments; i++) {
      const k = i / (segments - 1);
      pointAt(s - i * spacing, p, tan);
      side.crossVectors(tan, UP).normalize();
      p.addScaledVector(side, Math.sin(time * 3 - i * 0.45) * api.amplitude * Math.min(1, k * 4));
      const lift = rear * Math.max(0, 1 - i / 12) ** 2 * 0.9;
      p.y += radius * 0.8 + lift;
      const taper = i < 3 ? 0.8 + i * 0.07 : 1 - Math.max(0, k - 0.55) * 1.6;
      const rr = radius * Math.max(0.15, taper);
      sc.set(rr, rr * 0.85, rr * 1.4);
      q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan);
      m.compose(p, q, sc);
      body.setMatrixAt(i, m);
      if (i === 0) headPos.copy(p).addScaledVector(tan, radius * 1.3);
    }
    body.instanceMatrix.needsUpdate = true;
    head.position.copy(headPos);
    if (lookTarget && rear > 0.3) head.lookAt(lookTarget);
    else { prev.copy(headPos).add(tan); head.lookAt(prev); }
    head.rotateY(Math.PI); // 머리 모델은 -z가 앞
    head.getWorldDirection(headDir).negate();
  }

  Object.assign(api, {
    mesh: group,
    setPath(points, closed = true) {
      curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal');
      curveLen = curve.getLength();
      layout();
    },
    update(dt) {
      time += dt;
      s += api.speed * dt * (1 - rear * 0.9);
      rear += (rearTarget - rear) * Math.min(1, dt * 2.5);
      tongue.visible = Math.sin(time * 9) > 0.3;
      layout();
    },
    rearUp(amount) { rearTarget = THREE.MathUtils.clamp(amount, 0, 1); },
    lookAt(target) { lookTarget = target; },
    headPosition: () => headPos,
    headDirection: () => headDir,
    rearAmount: () => rear,
  });
  layout();
  return api;
}
