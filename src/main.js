import * as THREE from 'three';
import { createEngine } from './core/engine.js';
import { createInputSources } from './input/sources.js';
import { detectGestures } from './input/gestures.js';
import { createGame } from './core/game.js';
import { applySpeedup, CONFIG } from './config.js';
import { createPrologue } from './chapters/prologue.js';
import { createCh1Nest } from './chapters/ch1Nest.js';
import { createSoundscape } from './audio/soundscape.js';
import { createInkPass } from './fx/inkPass.js';
import { createSubtitles } from './ui/subtitles.js';

const params = new URLSearchParams(location.search);
applySpeedup(Number(params.get('fast')));
const debug = params.has('debug');

const engine = createEngine(document.getElementById('app'));
if (debug) window.__engine = engine;
const input = createInputSources(engine);
engine.scene.background = new THREE.Color(0x1a1714);

const sound = createSoundscape();
const ink = createInkPass(engine);
const subtitles = createSubtitles(engine);

const frame = { sample: null, baseline: { headY: 1.6, headX: 0 } };
const extraCtx = {
  engine, input, frame, sound, ink, subtitles,
  calibrate() { frame.baseline = input.calibrate(); return frame.baseline; },
  // 손님이 바뀔 때 앞 손님의 먹·붉은 기운·소리가 남지 않게 지운다
  resetPresentation() {
    ink.setTension(CONFIG.TENSION_FLOOR);
    ink.setRedPulse(0);
    ink.setBlackout(0);
    subtitles.clear();
    sound.wind(0); sound.drone(0); sound.hiss({ x: 0, y: 0, z: 0 }, 0); sound.stopHeartbeat();
  },
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
  await sound.unlock();
  // 붓글씨 글꼴은 인터넷에서 받는다. 오래 걸리면 기다리지 않고 기본 글꼴로 시작.
  await Promise.race([document.fonts?.load("64px 'Nanum Brush Script'").catch(() => {}), new Promise((r) => setTimeout(r, 1500))]);
  if (await engine.vrSupported()) {
    try { await engine.enterVR(); } catch (e) { console.warn('VR 진입 실패, 미리보기로 진행', e); }
  }
  game = createGame({ chapters, mode, extraCtx });
  input.resetLook();
  game.start(chapterIndex);
  if (debug) window.__game = game;
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
  if (game.state.screen === 'ending') {
    game.reset();
    ink.setBlackout(0);
    engine.renderer.xr.getSession()?.end();
    document.getElementById('vrnote').textContent = '1장까지 체험해 주셔서 감사합니다. 다음 장은 준비 중입니다.';
    showTitle();
  }
  if (debug) hud.textContent = `ch ${game.state.chapterIndex} cp ${game.state.checkpointId} fails ${game.state.failCount}\n` +
    `crouch ${gestures.crouch} lean ${gestures.lean} flap ${gestures.flapSpeed.toFixed(1)}` + (frame.debug ? `\n${frame.debug}` : '');
});

if (params.has('ch')) begin(params.get('mode') === 'spicy' ? 'spicy' : 'mild', Number(params.get('ch')) || 0);
