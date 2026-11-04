import * as THREE from 'three';
import { createEngine } from './core/engine.js';
import { createInputSources } from './input/sources.js';
import { detectGestures } from './input/gestures.js';
import { createGame } from './core/game.js';
import { applySpeedup } from './config.js';
import { createPrologue } from './chapters/prologue.js';
import { createCh1Nest } from './chapters/ch1Nest.js';

const params = new URLSearchParams(location.search);
applySpeedup(Number(params.get('fast')));
const debug = params.has('debug');

const engine = createEngine(document.getElementById('app'));
if (debug) window.__engine = engine;
const input = createInputSources(engine);
engine.scene.background = new THREE.Color(0x1a1714);

const frame = { sample: null, baseline: { headY: 1.6, headX: 0 } };
const extraCtx = {
  engine, input, frame,
  calibrate() { frame.baseline = input.calibrate(); return frame.baseline; },
};
const chapters = [createPrologue(), createCh1Nest()];
let game = null;

const titleEl = document.getElementById('title');
const hud = document.getElementById('hud');

function showTitle() {
  titleEl.classList.remove('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
}

async function begin(mode, chapterIndex = 0) {
  titleEl.classList.add('hidden');
  if (await engine.vrSupported()) {
    try { await engine.enterVR(); } catch (e) { console.warn('VR 진입 실패, 미리보기로 진행', e); }
  }
  game = createGame({ chapters, mode, extraCtx });
  input.resetLook();
  game.start(chapterIndex);
}

for (const btn of titleEl.querySelectorAll('button[data-mode]')) {
  btn.addEventListener('click', () => begin(btn.dataset.mode));
}
engine.vrSupported().then((ok) => {
  document.getElementById('vrnote').textContent = ok ? 'VR로 시작합니다' : '노트북 미리보기: 마우스로 둘러보기 · Ctrl 숙이기 · A/D 기울이기 · Space 날갯짓 · 클릭 집기';
});

engine.onSessionEnd(() => { game?.reset(); showTitle(); });

engine.onFrame((dt) => {
  if (!game || game.state.screen === 'title') return;
  frame.sample = input.read(dt);
  const gestures = detectGestures(frame.sample, frame.baseline);
  game.tick(dt, gestures);
  if (game.state.screen === 'ending') { game.reset(); showTitle(); }
  if (debug) hud.textContent = `ch ${game.state.chapterIndex} cp ${game.state.checkpointId} fails ${game.state.failCount}\n` +
    `crouch ${gestures.crouch} lean ${gestures.lean} flap ${gestures.flapSpeed.toFixed(1)}` + (frame.debug ? `\n${frame.debug}` : '');
});

if (params.has('ch')) begin(params.get('mode') === 'spicy' ? 'spicy' : 'mild', Number(params.get('ch')) || 0);
