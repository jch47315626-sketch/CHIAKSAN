import * as THREE from 'three';

/** 시드 고정 의사난수 (같은 시드 = 같은 그림) */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const INK = '#0e0c0a';
export const RED = '#b3121b';

/** 붓 한 획: 굵기가 시작→중간→끝으로 변하는 곡선을 여러 겹 겹쳐 먹 번짐 느낌을 낸다. */
function brush(ctx, pts, width, alpha, r, color = INK) {
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  const passes = 3;
  for (let p = 0; p < passes; p++) {
    ctx.globalAlpha = alpha * (p === 0 ? 1 : 0.35);
    const jitter = p * width * 0.25;
    for (let i = 1; i < pts.length; i++) {
      const k = i / (pts.length - 1);
      ctx.lineWidth = Math.max(0.6, width * Math.sin(Math.PI * Math.min(0.98, k * 0.9 + 0.08)) * (1 - p * 0.2));
      ctx.beginPath();
      ctx.moveTo(pts[i - 1][0] + (r() - 0.5) * jitter, pts[i - 1][1] + (r() - 0.5) * jitter);
      ctx.lineTo(pts[i][0] + (r() - 0.5) * jitter, pts[i][1] + (r() - 0.5) * jitter);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

function curve(x0, y0, x1, y1, bend, n = 14) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([x0 + (x1 - x0) * t + bend * Math.sin(Math.PI * t) * t, y0 + (y1 - y0) * t]);
  }
  return pts;
}

const painters = {
  grass(ctx, S, r) {
    const n = 38;
    for (let i = 0; i < n; i++) {
      const x = S * (0.04 + 0.92 * r());
      const h = S * (0.45 + 0.55 * r());
      const bend = (r() - 0.5) * S * 0.35;
      brush(ctx, curve(x, S, x + bend * 0.6, S - h, bend), 5 + r() * 9, 0.55 + r() * 0.45, r);
    }
  },
  ridge(ctx, S, r) {
    ctx.fillStyle = INK;
    for (let layer = 0; layer < 3; layer++) {
      ctx.globalAlpha = 0.25 + layer * 0.25;
      ctx.beginPath();
      ctx.moveTo(0, S);
      let y = S * (0.45 + layer * 0.12);
      for (let x = 0; x <= S; x += S / 40) {
        y += (r() - 0.5) * S * 0.06;
        y = Math.min(S * 0.9, Math.max(S * 0.2, y));
        ctx.lineTo(x, y);
      }
      ctx.lineTo(S, S);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  },
  tree(ctx, S, r) {
    const trunk = curve(S * 0.5, S, S * (0.45 + r() * 0.1), S * 0.1, (r() - 0.5) * S * 0.15);
    brush(ctx, trunk, S * 0.06, 0.95, r);
    for (let i = 0; i < 9; i++) {
      const k = 0.2 + r() * 0.6;
      const p = trunk[Math.floor(k * (trunk.length - 1))];
      const dir = r() < 0.5 ? -1 : 1;
      brush(ctx, curve(p[0], p[1], p[0] + dir * S * (0.15 + r() * 0.25), p[1] - S * (0.05 + r() * 0.15), dir * S * 0.05, 8), S * 0.018, 0.85, r);
    }
  },
  nest(ctx, S, r) {
    const cx = S / 2, cy = S * 0.62;
    for (let i = 0; i < 70; i++) {
      const a = r() * Math.PI * 2, len = 0.25 + r() * 0.35, rad = S * (0.3 + r() * 0.12);
      const x0 = cx + Math.cos(a) * rad, y0 = cy + Math.sin(a) * rad * 0.35;
      const x1 = cx + Math.cos(a + len) * rad, y1 = cy + Math.sin(a + len) * rad * 0.35;
      brush(ctx, curve(x0, y0, x1, y1, (r() - 0.5) * 20, 6), 3 + r() * 5, 0.7, r);
    }
  },
  wing(ctx, S, r) {
    // 위에서 덮은 어미 꿩 날개: 깃털 획을 부채꼴로
    for (let i = 0; i < 26; i++) {
      const a = Math.PI * (0.08 + 0.84 * (i / 25));
      const len = S * (0.38 + r() * 0.1);
      brush(ctx, curve(S / 2, S * 0.95, S / 2 + Math.cos(a) * len, S * 0.95 - Math.sin(a) * len, (r() - 0.5) * 30, 10), 18 + r() * 10, 0.85, r);
    }
  },
  chick(ctx, S, r) {
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.ellipse(S * 0.5, S * 0.68, S * 0.22, S * 0.17, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(S * 0.62, S * 0.45, S * 0.11, S * 0.1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(S * 0.72, S * 0.44); ctx.lineTo(S * 0.8, S * 0.47); ctx.lineTo(S * 0.72, S * 0.5); ctx.fill();
    brush(ctx, curve(S * 0.45, S * 0.84, S * 0.43, S * 0.98, 0, 4), 6, 1, r);
    brush(ctx, curve(S * 0.55, S * 0.84, S * 0.57, S * 0.98, 0, 4), 6, 1, r);
  },
  scholar(ctx, S, r) {
    // 갓을 쓰고 활을 든 선비의 실루엣 (아래에서 올려다본 거인)
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.moveTo(S * 0.36, S); ctx.lineTo(S * 0.42, S * 0.35); ctx.lineTo(S * 0.58, S * 0.35); ctx.lineTo(S * 0.66, S); ctx.fill();
    ctx.beginPath(); ctx.ellipse(S * 0.5, S * 0.28, S * 0.06, S * 0.075, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(S * 0.5, S * 0.2, S * 0.17, S * 0.022, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(S * 0.465, S * 0.12, S * 0.07, S * 0.08);
    brush(ctx, curve(S * 0.58, S * 0.4, S * 0.8, S * 0.3, 0, 6), 14, 1, r);
    ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(S * 0.72, S * 0.42, S * 0.2, -1.3, 1.3); ctx.stroke();
    ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(S * 0.77, S * 0.23); ctx.lineTo(S * 0.77, S * 0.61); ctx.stroke();
  },
  mist(ctx, S, r) {
    for (let i = 0; i < 14; i++) {
      const y = S * (0.3 + r() * 0.4);
      const g = ctx.createLinearGradient(0, y - 40, 0, y + 40);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.5, `rgba(14,12,10,${0.05 + r() * 0.08})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, y - 40, S, 80);
    }
  },
};

/** 투명 배경 위에 먹으로 그린 텍스처 */
export function makeInkTexture({ kind, seed = 1, size = 512 }) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  painters[kind](ctx, size, rng(seed));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** 한지를 오려 세운 평면. billboard=true면 매 프레임 세로축으로 카메라를 향한다. */
export function makePaperLayer(texture, { width, height, billboard = false, opacity = 1 }) {
  const geo = new THREE.PlaneGeometry(width, height);
  geo.translate(0, height / 2, 0); // 바닥 기준
  const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.08, side: THREE.DoubleSide, opacity, fog: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.billboard = billboard;
  return mesh;
}

const tmp = new THREE.Vector3();
export function updateBillboards(root, camera) {
  camera.getWorldPosition(tmp);
  root.traverse((o) => {
    if (!o.userData.billboard) return;
    o.rotation.y = Math.atan2(tmp.x - o.position.x, tmp.z - o.position.z);
  });
}

/** 한지 질감 하늘: 위는 짙은 먹, 지평선은 바랜 한지, 먼 산 능선 */
export function makeSkyDome({ seed = 7, night = true } = {}) {
  const W = 2048, H = 1024;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, night ? '#14120f' : '#cfc4ab');
  g.addColorStop(0.42, night ? '#4a443a' : '#e3d9c3');
  g.addColorStop(0.5, night ? '#8a8170' : '#ebe2cf');
  g.addColorStop(0.56, '#2a2620');
  g.addColorStop(1, '#0e0c0a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // 한지 섬유
  const r = rng(seed);
  ctx.globalAlpha = 0.05;
  for (let i = 0; i < 2500; i++) {
    ctx.strokeStyle = r() < 0.5 ? '#000' : '#fff';
    ctx.lineWidth = 0.5 + r();
    const x = r() * W, y = r() * H, a = r() * Math.PI;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12); ctx.stroke();
  }
  // 먼 산 능선 두 겹
  for (let layer = 0; layer < 2; layer++) {
    ctx.globalAlpha = layer === 0 ? 0.45 : 0.8;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(0, H * 0.56);
    let y = H * (0.47 + layer * 0.03);
    for (let x = 0; x <= W; x += 16) {
      y += (r() - 0.5) * 14;
      y = Math.min(H * 0.55, Math.max(H * 0.36, y));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H * 0.56);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(80, 48, 24), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false }));
  mesh.renderOrder = -10;
  return mesh;
}
