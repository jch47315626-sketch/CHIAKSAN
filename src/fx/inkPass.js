import * as THREE from 'three';
import { vignetteHole, NOISE_AMP } from './vignetteShape.js';

const DIST = 1.0; // 눈에서 1m (15cm는 초점이 맞지 않아 겹쳐 보일 수 있다)
const SIZE = (0.62 / 0.15) * DIST; // 예전 0.15m에서 0.62 크기와 같은 시야를 덮는다

/**
 * 시야 가장자리에서 먹이 번져 들어오는 효과. 카메라 앞 고리 모양 면이라 노트북과 VR에서 같고,
 * 투명한 가운데는 그리지 않아 가볍다.
 */
export function createInkPass(engine) {
  const uniforms = {
    uTension: { value: 0.3 },
    uRed: { value: 0 },
    uBlack: { value: 0 },
    uTime: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTension, uRed, uBlack, uTime;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<3;i++){ v+=a*noise(p); p*=2.03; a*=0.5; } return v / 0.875; }
      void main(){
        vec2 p = vUv - 0.5;
        float r = length(p) * 2.0;
        float ang = atan(p.y, p.x);
        float n = fbm(vec2(ang * 2.2, r * 3.0 - uTime * 0.08)) - 0.5;
        float inner = mix(0.95, 0.5, uTension);
        float a = smoothstep(inner - 0.25, inner + 0.1, r + n * ${NOISE_AMP.toFixed(2)});
        a = max(a, uBlack);
        vec3 ink = vec3(0.043, 0.039, 0.031);
        vec3 red = vec3(0.70, 0.07, 0.106);
        float redEdge = uRed * smoothstep(inner - 0.25, inner, r + n * 0.3) * (1.0 - uBlack);
        vec3 col = mix(ink, red, redEdge * 0.8);
        gl_FragColor = vec4(col, clamp(a + redEdge * 0.5, 0.0, 1.0));
      }`,
  });

  // 구멍 크기별 고리를 미리 몇 개 만들어 두고 골라 쓴다 (매 프레임 새로 만들지 않음)
  const rings = new Map();
  function ringFor(hole) {
    const key = Math.floor(hole * 20) / 20; // 0.05 단위로 내림: 구멍이 실제보다 작으면 안전
    if (!rings.has(key)) rings.set(key, new THREE.RingGeometry(Math.max(0.0001, key * 0.5), 0.71, 64, 1));
    return rings.get(key);
  }
  // RingGeometry의 uv는 바깥 반지름 기준이라 0.5가 되도록 보정한다
  function fixUv(g) {
    if (g.userData.fixed) return g;
    const pos = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) + 0.5, pos.getY(i) + 0.5);
    uv.needsUpdate = true;
    g.userData.fixed = true;
    return g;
  }

  const mesh = new THREE.Mesh(fixUv(ringFor(vignetteHole(0.3, 0))), mat);
  mesh.position.set(0, 0, -DIST);
  mesh.scale.set(SIZE, SIZE, 1);
  mesh.renderOrder = 1000;
  mesh.frustumCulled = false;
  engine.camera.add(mesh);

  function refresh() {
    mesh.geometry = fixUv(ringFor(vignetteHole(uniforms.uTension.value, uniforms.uBlack.value)));
  }

  return {
    update(dt) { uniforms.uTime.value += dt; },
    setTension(t) { uniforms.uTension.value = THREE.MathUtils.clamp(t, 0, 1); refresh(); },
    setRedPulse(t) { uniforms.uRed.value = THREE.MathUtils.clamp(t, 0, 1); },
    setBlackout(t) { uniforms.uBlack.value = THREE.MathUtils.clamp(t, 0, 1); refresh(); },
  };
}
