import * as THREE from 'three';
import { makeInkTexture, loadArtTexture } from '../fx/paper.js';

const LINES = [
  [0.5, '옛날 옛적, 적악산이라 불리던 산이 있었다…', 5],
  [6, '그 산 깊은 풀숲에, 꿩 한 가족이 살고 있었다.', 4.5],
];
const DURATION = 11.5;

/** 프롤로그: 한지 위에 먹선이 번지며 산이 그려진다. 조작 없는 짧은 도입 장면. */
export function createPrologue() {
  let group, mat, t, ctx, li;
  return {
    id: 'prologue', checkpoints: [],
    enter(c) {
      ctx = c; t = 0; li = 0;
      const { engine } = ctx;
      engine.scene.fog = null;
      engine.scene.background = new THREE.Color(0x0d0c0a);
      engine.rig.position.set(0, 0, 0);
      const b = ctx.calibrate();
      if (group) {
        // 한 번 만든 그림을 다시 쓴다 (손님마다 새로 만들면 메모리가 계속 늘어남)
        mat.uniforms.uReveal.value = 0;
        group.children[0].position.y = b.headY;
        engine.scene.add(group);
        ctx.sound.wind(0.35);
        ctx.sound.drone(0.25);
        return;
      }
      group = new THREE.Group();
      const paperTex = makeInkTexture({ kind: 'ridge', seed: 21, size: 1024 });
      mat = new THREE.ShaderMaterial({
        transparent: true,
        uniforms: { uMap: { value: paperTex }, uReveal: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: `varying vec2 vUv; uniform sampler2D uMap; uniform float uReveal;
          float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
          void main(){
            vec4 ink = texture2D(uMap, vUv);
            vec3 paper = vec3(0.92,0.88,0.80) * (0.94 + 0.06*h(floor(vUv*300.0)));
            float wav = 0.04*sin(vUv.y*23.0) + 0.025*sin(vUv.y*61.0 + 1.3);
            float edge = smoothstep(0.0, 0.1, uReveal*1.2 - vUv.x - wav);
            vec3 col = mix(paper, vec3(0.06,0.05,0.04), ink.a * edge);
            float vig = smoothstep(0.75, 0.35, length(vUv-0.5));
            gl_FragColor = vec4(col * (0.55 + 0.45*vig), smoothstep(0.0, 0.15, uReveal) * vig);
          }`,
      });
      // public/art/prologue_pano.png (먹 농도가 알파인 산수화)가 있으면 코드 그림 대신 쓴다
      loadArtTexture('prologue_pano').then((t) => { if (t) mat.uniforms.uMap.value = t; });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.4), mat);
      plane.position.set(0, b.headY, -3);
      group.add(plane);
      engine.scene.add(group);
      ctx.sound.wind(0.35);
      ctx.sound.drone(0.25);
    },
    update(dt) {
      t += dt;
      mat.uniforms.uReveal.value = Math.min(1, t / 8);
      if (li < LINES.length && t >= LINES[li][0]) { ctx.subtitles.show(LINES[li][1], LINES[li][2]); li++; }
      const fade = Math.max(0, (t - (DURATION - 1.5)) / 1.5);
      ctx.ink.setBlackout(fade);
      return t >= DURATION ? 'complete' : 'running';
    },
    exit() { ctx.engine.scene.remove(group); ctx.subtitles.clear(); },
  };
}
