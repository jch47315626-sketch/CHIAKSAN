import * as THREE from 'three';
import { buildNestScene } from '../scenes/nestScene.js';
import { makeInkTexture, makePaperLayer, updateBillboards, rng } from '../fx/paper.js';
import { createSnake, isFacing } from '../actors/snake.js';
import { createCh1Rules } from './ch1Rules.js';
import { CONFIG } from '../config.js';

const EYE_Y = 0.15; // 새끼 꿩 눈높이
const EYE_SCALE = 0.3; // 실제 머리 움직임을 이만큼 줄여 반영 (숙여도 땅 밑으로 안 들어가게)
const FAIL_S = 1.6; // 잡혔을 때 먹물에 잠기는 시간

/**
 * 1장 "둥지". 새끼 꿩이 되어 구렁이에게 들키지 않고 버틴다.
 * 판정은 ch1Rules가, 이 파일은 그림·소리·연출을 맡는다.
 */
export function createCh1Nest() {
  const params = new URLSearchParams(location.search);
  const forceFacing = params.get('facing'); // 확인용: always | never

  let ctx, stage, snake, rules, wing, scholar, chick, eyes;
  let firstRun, swallowAt, t, prevStatus, fail, swallowed, wingT, nextSlither, prevForced, lowBreathCue, cycle;
  const r = rng(77);
  const camPos = new THREE.Vector3();
  const camQuat = new THREE.Quaternion();
  const look = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  function buildOnce(engine) {
    if (stage) return;
    stage = buildNestScene();
    snake = createSnake({ segments: 48, radius: 0.13, length: 5.5 });
    stage.group.add(snake.mesh);

    wing = makePaperLayer(makeInkTexture({ kind: 'wing', seed: 5 }), { width: 1.4, height: 0.9 });
    wing.rotation.x = -Math.PI / 2 + 0.25; // 머리 위를 덮는 날개
    stage.group.add(wing);

    scholar = makePaperLayer(makeInkTexture({ kind: 'scholar', seed: 9, size: 1024 }), { width: 5, height: 7, billboard: true });
    scholar.visible = false;
    stage.group.add(scholar);

    chick = makePaperLayer(makeInkTexture({ kind: 'chick', seed: 4 }), { width: 0.22, height: 0.22, billboard: true });
    chick.visible = false;
    stage.group.add(chick);

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xb3121b, fog: false });
    eyes = stage.spots.map((p) => {
      const g = new THREE.Group();
      for (const sx of [-1, 1]) {
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), eyeMat);
        e.position.x = sx * 0.05;
        g.add(e);
      }
      g.position.copy(p);
      g.userData.seen = 0;
      stage.group.add(g);
      return g;
    });
    engine.scene.add(stage.group);
    stage.group.visible = false;
  }

  function newSnakeLoop() {
    const pts = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const d = 0.9 + r() * 0.7;
      pts.push(new THREE.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d));
    }
    snake.setPath(pts, true);
  }

  // 구렁이 행동: 둥지 둘레를 돌다가(circle) 멈춰 고개를 들고 둥지를 노려본다(watch)
  function updateSnakeBehavior(dt, playerHead) {
    cycle.t -= dt;
    if (cycle.t <= 0) {
      if (cycle.mode === 'circle') { cycle.mode = 'watch'; cycle.t = 3 + r() * 1.5; snake.rearUp(1); }
      else { cycle.mode = 'circle'; cycle.t = 5 + r() * 5; snake.rearUp(0); }
    }
    snake.lookAt(playerHead);
  }

  function setEye(dt, gestures) {
    // 실제 머리 높이 변화를 줄여서 새끼 꿩 눈높이에 반영
    const s = ctx.frame.sample;
    const headY = s ? s.head.y : ctx.frame.baseline.headY;
    const eye = THREE.MathUtils.clamp(EYE_Y + (headY - ctx.frame.baseline.headY) * EYE_SCALE, 0.05, 0.35);
    const target = eye - headY;
    const rig = ctx.engine.rig;
    rig.position.y += (target - rig.position.y) * Math.min(1, dt * 12);
  }

  return {
    id: 'ch1',
    checkpoints: ['half'],
    enter(c, checkpointId) {
      ctx = c;
      const { engine } = ctx;
      buildOnce(engine);
      stage.group.visible = true;
      engine.scene.fog = stage.fog;
      engine.scene.background = new THREE.Color(0x0e0c0a);
      // 기준 머리 높이는 장에 처음 들어올 때만 잰다 (잡힌 직후 움츠린 자세를 기준으로 삼지 않게)
      const b = ctx.retry ? ctx.frame.baseline : ctx.calibrate();
      engine.rig.position.set(0, EYE_Y - b.headY, 0);

      rules = createCh1Rules(checkpointId);
      firstRun = !checkpointId;
      swallowAt = -1;
      t = 0; prevStatus = 'running'; fail = -1; swallowed = checkpointId === 'half';
      prevForced = false; lowBreathCue = false;
      nextSlither = 12 + r() * 10;
      cycle = { mode: 'circle', t: checkpointId ? 3 : 8 };
      newSnakeLoop();
      snake.rearUp(0);
      snake.speed = 0.55;
      snake.mesh.rotation.set(0, 0, 0);
      snake.mesh.visible = true;
      scholar.visible = false;
      chick.visible = false;
      wingT = checkpointId ? -1 : 0;
      wing.visible = !checkpointId;
      wing.position.set(0, 0.32, 0);
      for (const e of eyes) { e.visible = true; e.userData.seen = 0; }

      ctx.ink.setTension(CONFIG.TENSION_FLOOR);
      ctx.ink.setRedPulse(0);
      ctx.ink.setBlackout(1);
      ctx.sound.wind(0.5);
      ctx.sound.drone(0.35);
      ctx.sound.heartbeat(62);
      if (!checkpointId) {
        ctx.subtitles.show('고개를 숙여 몸을 숨기세요', 4);
      } else {
        ctx.subtitles.show('다시… 숨을 죽인다', 3);
      }
    },

    update(dt, gestures) {
      const { engine, sound, ink, subtitles } = ctx;
      t += dt;
      engine.camera.getWorldPosition(camPos);
      engine.camera.getWorldQuaternion(camQuat);
      engine.camera.getWorldDirection(look);
      sound.setListener(camPos, camQuat);
      sound.update(dt);
      subtitles.update(dt);
      ink.update(dt);
      setEye(dt, gestures);
      updateBillboards(stage.group, engine.camera);

      // 먹물에서 장면이 그려지며 시작
      if (fail < 0) ink.setBlackout(Math.max(0, 1 - t / 1.5));

      // 잡힌 뒤 연출
      if (fail >= 0) {
        fail += dt;
        ink.setBlackout(Math.min(1, fail / (FAIL_S * 0.6)));
        snake.update(dt);
        if (ctx.mode === 'spicy') {
          // 매운 맛: 구렁이 머리가 정면으로 덮친다
          snake.rearUp(1);
          tmp.copy(look).multiplyScalar(0.35).add(camPos);
          const h = snake.headPosition(); // 구렁이 그룹 기준 좌표
          snake.mesh.position.set(tmp.x - h.x, 0, tmp.z - h.z);
        }
        return fail >= FAIL_S ? 'fail' : 'running';
      }

      // 어미 날개가 위를 덮었다가 날아간다
      if (wingT >= 0) {
        wingT += dt;
        if (wingT > 4.5) {
          const k = wingT - 4.5;
          wing.position.y = 0.32 + k * k * 2.5;
          wing.position.z = -k * 1.5;
          if (k > 2) { wing.visible = false; wingT = -1; }
          if (k < dt * 1.5) sound.breath('gasp');
        }
      }
      if (firstRun && t > 6.5 && t - dt <= 6.5) subtitles.show('숨이 차면 잠깐 고개를 드세요', 4);

      // 구렁이
      const playerHead = camPos.clone();
      if (prevStatus === 'running') updateSnakeBehavior(dt, playerHead);
      snake.update(dt);
      let facing = cycle.mode === 'watch' && snake.rearAmount() > 0.6 && isFacing(snake.headPosition(), snake.headDirection(), playerHead, 35);
      if (forceFacing === 'always') facing = true;
      if (forceFacing === 'never') facing = false;
      sound.hiss(snake.headPosition(), cycle.mode === 'watch' ? 1 : 0.55);

      // 아무것도 없는 뒤쪽에서 스르륵
      nextSlither -= dt;
      if (nextSlither <= 0) {
        nextSlither = 20 + r() * 20;
        tmp.copy(look).multiplyScalar(-1.6).add(camPos);
        tmp.y = 0.05;
        sound.slitherAt(tmp);
      }

      // 붉은 눈: 쳐다보면 사라진다
      for (const e of eyes) {
        if (!e.visible) continue;
        tmp.copy(e.position).sub(camPos).normalize();
        if (tmp.dot(look) > Math.cos((15 * Math.PI) / 180)) {
          e.userData.seen += dt;
          if (e.userData.seen > 0.5) e.visible = false;
        }
      }

      // 규칙 판정
      const out = rules.step(dt, { crouch: gestures.crouch, snakeFacing: facing });
      if (out.checkpoint) ctx.reachCheckpoint(out.checkpoint);
      ink.setTension(out.tension);
      ink.setRedPulse(out.spotted);
      sound.heartbeat(60 + 80 * out.tension);
      if (out.forcedUp && !prevForced) { sound.breath('gasp'); subtitles.show('숨이… 숨을 쉬어야 해', 2.5); }
      prevForced = out.forcedUp;
      if (gestures.crouch && out.breath < 0.25 && !lowBreathCue) { sound.breath('hold'); lowBreathCue = true; }
      if (out.breath > 0.6) lowBreathCue = false;

      // 매운 맛: 30초쯤 형제 새끼가 삼켜진다
      if (ctx.mode === 'spicy' && !swallowed && out.survived > 30 * (CONFIG.CH1_SURVIVE_S / 90)) {
        swallowed = true;
        tmp.set(look.x, 0, look.z).normalize().multiplyScalar(1.0).add(camPos);
        chick.position.set(tmp.x - 0.4, 0, tmp.z);
        chick.visible = true;
        swallowAt = t + 1.2;
      }
      if (swallowAt >= 0 && t >= swallowAt) {
        swallowAt = -1;
        chick.visible = false;
        sound.sting('spotted');
        ink.setRedPulse(1);
      }

      ctx.frame.debug = `t ${out.survived.toFixed(1)} breath ${out.breath.toFixed(2)} tension ${out.tension.toFixed(2)} snake ${cycle.mode} facing ${facing} ${out.status}`;

      if (out.status === 'fail') {
        fail = 0;
        sound.sting('spotted');
        sound.hiss(camPos, 1);
        subtitles.clear();
        return 'running';
      }

      if (out.status === 'arrow' && prevStatus !== 'arrow') {
        sound.sting('arrow');
        snake.rearUp(0);
        snake.speed = 0;
        snake.mesh.rotation.z = 0.08;
        tmp.set(look.x, 0, look.z).normalize().multiplyScalar(4.5).add(camPos);
        scholar.position.set(tmp.x, 0, tmp.z);
        scholar.visible = true;
        subtitles.show('화살이… 고개를 들어 보세요', 4);
        sound.stopHeartbeat();
      }
      prevStatus = out.status;
      return out.status === 'complete' ? 'complete' : 'running';
    },

    exit() {
      stage.group.visible = false;
      chick.visible = false;
      swallowAt = -1;
      ctx.sound.hiss({ x: 0, y: 0, z: 0 }, 0);
      ctx.sound.stopHeartbeat();
      ctx.subtitles.clear();
      ctx.ink.setRedPulse(0);
      snake.mesh.position.set(0, 0, 0);
    },
  };
}
