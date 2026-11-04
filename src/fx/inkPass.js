import * as THREE from 'three';

/**
 * 시야 가장자리에서 먹이 번져 들어오는 효과. 후처리 대신 카메라 바로 앞에 붙인 평면이라
 * 노트북과 VR에서 똑같이 동작하고 퀘스트에서도 가볍다.
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
      float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<4;i++){ v+=a*noise(p); p*=2.03; a*=0.5; } return v; }
      void main(){
        vec2 p = vUv - 0.5;
        float r = length(p) * 2.0;
        float ang = atan(p.y, p.x);
        float n = fbm(vec2(ang * 2.2, r * 3.0 - uTime * 0.08)) ;
        float inner = mix(0.95, 0.38, uTension);
        float a = smoothstep(inner - 0.25, inner + 0.1, r + (n - 0.5) * 0.35);
        a = max(a, uBlack);
        vec3 ink = vec3(0.043, 0.039, 0.031);
        vec3 red = vec3(0.70, 0.07, 0.106);
        float redEdge = uRed * smoothstep(inner - 0.35, inner, r + (n - 0.5) * 0.3) * (1.0 - uBlack);
        vec3 col = mix(ink, red, redEdge * 0.8);
        gl_FragColor = vec4(col, clamp(a + redEdge * 0.5, 0.0, 1.0));
      }`,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  quad.position.set(0, 0, -0.15);
  quad.scale.set(0.62, 0.62, 1); // 0.15m 앞에서 약 ±64° 덮음
  quad.renderOrder = 1000;
  quad.frustumCulled = false;
  engine.camera.add(quad);

  return {
    update(dt) { uniforms.uTime.value += dt; },
    setTension(t) { uniforms.uTension.value = THREE.MathUtils.clamp(t, 0, 1); },
    setRedPulse(t) { uniforms.uRed.value = THREE.MathUtils.clamp(t, 0, 1); },
    setBlackout(t) { uniforms.uBlack.value = THREE.MathUtils.clamp(t, 0, 1); },
  };
}
