import * as THREE from 'three';
import { makeInkTexture, makePaperLayer, makeSkyDome, rng } from '../fx/paper.js';

/**
 * 1장 무대: 밤 숲속 땅바닥의 꿩 둥지. 플레이어(새끼 꿩)는 원점, 눈높이 0.15m.
 * 반환: { group, fog, spots: 붉은 눈 위치 후보 }
 */
function makeGroundTexture(seed) {
  const S = 1024, c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d'), r = rng(seed + 99);
  ctx.fillStyle = '#16130f';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 900; i++) {
    ctx.globalAlpha = 0.08 + r() * 0.15;
    ctx.fillStyle = r() < 0.7 ? '#000' : '#5a5246';
    const x = r() * S, y = r() * S, w = 4 + r() * 30;
    ctx.beginPath(); ctx.ellipse(x, y, w, w * 0.3, r() * Math.PI, 0, Math.PI * 2); ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(30, 30);
  return t;
}

export function buildNestScene(seed = 11) {
  const r = rng(seed);
  const group = new THREE.Group();
  group.add(makeSkyDome({ seed: seed + 1, night: true }));

  // 땅: 짙은 먹 원판 + 가장자리 번짐
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120, 60, 60),
    new THREE.MeshBasicMaterial({ map: makeGroundTexture(seed), fog: true }),
  );
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);

  const grassTex = [1, 2, 3, 4].map((s) => makeInkTexture({ kind: 'grass', seed: seed * 10 + s }));
  const treeTex = [1, 2, 3].map((s) => makeInkTexture({ kind: 'tree', seed: seed * 20 + s }));
  const nestTex = makeInkTexture({ kind: 'nest', seed: seed + 5 });
  const mistTex = makeInkTexture({ kind: 'mist', seed: seed + 6 });

  // 둥지: 발밑 둘레의 낮은 잔가지 벽 (눈높이 0.15m 바로 아래까지)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const m = makePaperLayer(nestTex, { width: 0.45, height: 0.16 });
    m.position.set(Math.cos(a) * 0.22, -0.02, Math.sin(a) * 0.22);
    m.rotation.y = -a + Math.PI / 2;
    group.add(m);
  }

  // 풀숲: 새끼 꿩 머리 위로 숲처럼 덮인다 (40장 이하)
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2;
    const d = 0.45 + r() * 3.2;
    const h = 0.5 + r() * 0.9 + d * 0.15;
    const m = makePaperLayer(grassTex[i % 4], { width: h * 1.1, height: h, billboard: true });
    m.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
    group.add(m);
  }

  // 나무: 거인처럼 높은 먹 줄기
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2;
    const d = 4 + r() * 9;
    const h = 7 + r() * 6;
    const m = makePaperLayer(treeTex[i % 3], { width: h * 0.7, height: h, billboard: true });
    m.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
    group.add(m);
  }

  // 안개 띠
  for (let i = 0; i < 4; i++) {
    const m = makePaperLayer(mistTex, { width: 24, height: 3, billboard: true, opacity: 0.8 });
    const a = (i / 4) * Math.PI * 2 + r();
    m.position.set(Math.cos(a) * 10, 0, Math.sin(a) * 10);
    group.add(m);
  }

  const fog = new THREE.FogExp2(0x3a352d, 0.11);

  // 붉은 눈이 숨어 있을 자리 (어둠 속, 풀숲 너머)
  const spots = [new THREE.Vector3(-3.2, 0.5, -2.6), new THREE.Vector3(3.6, 0.9, 1.8)];
  return { group, fog, spots };
}
