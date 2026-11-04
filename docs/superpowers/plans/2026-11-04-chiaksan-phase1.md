# 치악산 꿩의 전설 VR — 1단계(기본 엔진 + 1장 둥지) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 노트북 브라우저와 퀘스트 3S에서 프롤로그부터 1장 "둥지"의 화살 장면까지 끝까지 플레이할 수 있는 WebXR 공포 게임 첫 조각을 만든다.

**Architecture:** Vite로 묶는 웹 페이지 하나. 판정 규칙(동작 인식, 게임 진행, 1장 규칙)은 DOM·Three.js에 의존하지 않는 순수 함수로 분리해 Vitest로 검사하고, 화면·소리·입력 장치는 그 규칙에 값을 넣고 결과를 그리는 얇은 층으로 둔다. 장(章)은 모두 같은 인터페이스를 따라 나중에 2인용으로 나눌 수 있다.

**Tech Stack:** Node 22, Vite 6, three (r17x), Vitest, Web Audio API, WebXR Device API (hand-tracking optional feature), Playwright(스크린샷 확인용, 사전 설치됨).

**Spec:** 설계 문서 https://claude.ai/artifact/BYZZW6FBZzeHxknrj2VJGz (rev 11)

## Global Constraints

- 대상 기기: 메타 퀘스트 3S, 퀘스트 브라우저. https에서만 VR 진입.
- 성능: 퀘스트 3S에서 초당 72프레임 유지. 장면당 투명 평면 그림 40장 이하, 후처리 패스 1개.
- 이동: 자동 이동만. 스틱 이동·순간이동 없음.
- 진행: 자동으로 다음 장면으로 넘어가지 않는다. 목표 달성 시에만 진행, 실패 시 그 장의 체크포인트에서 재시작.
- 모드: `mild`(순한 맛) / `spicy`(매운 맛). 분위기 장치(소리·먹 번짐·붉은 눈)는 두 모드 공통, 모드는 직접 묘사만 바꾼다.
- 색: 수묵(흑백·한지) 바탕, 붉은색 `#b3121b`는 위험 신호(구렁이 눈, 피, 등불, 여인 입술)에만 쓴다.
- 문구: 모든 화면 문구와 자막은 한국어 붓글씨풍 글꼴(웹폰트 `Nanum Brush Script`, 없으면 serif).
- 1장 카메라 높이: 땅에서 0.15m (새끼 꿩 시점) — 실제 머리 높이와 무관하게 장면 쪽을 맞춘다.
- 노트북 미리보기: 마우스 시점, Ctrl=숙이기, A/D=기울이기, Space=팔 젓기, 클릭=집기, 숫자키 0~1=장 바로 시작.

## Review Focus

1. **키가 다르거나 앉아서 하는 손님** — 숙이기 판정이 절대 높이가 아니라 장 시작 시 잰 기준 높이 대비로 동작해야 한다. (Task 1 테스트 `crouch is relative to baseline`)
2. **플레이 중 손 인식이 끊김** — 1장은 머리만으로 플레이가 끝까지 가능해야 하고 손 데이터가 없어도 예외가 나지 않아야 한다. (Task 1 테스트 `missing hands yields zero flap`)
3. **탭이 가려지거나 헤드셋을 벗었다 씀(큰 dt)** — 프레임 간격이 튀어도 타이머가 한 번에 넘어가 즉시 실패·완료되면 안 된다. dt는 0.1초로 자른다. (Task 2 테스트 `dt is clamped`)
4. **VR 세션 도중 종료** — 시작 화면 상태로 돌아가고, 다시 들어가면 마지막 체크포인트가 아니라 처음부터 시작. (Task 2 테스트 `reset returns to title`)
5. **브라우저 자동재생 차단** — 소리는 사용자 동작(시작 버튼/VR 진입) 뒤에 켜지고, 그 전에는 소리 함수가 호출돼도 오류가 나지 않는다. (Task 7 테스트 `calls before unlock are no-ops`)

---

## 파일 구조

```
index.html
package.json, vite.config.js
src/main.js                    시작점: 엔진·입력·소리·장 연결
src/config.js                  모든 조정값(임계값, 시간)
src/input/gestures.js          순수: 입력 샘플 → 동작 판정
src/input/sources.js           XR 머리·손·컨트롤러 + 키보드/마우스 → 입력 샘플
src/core/game.js               순수: 진행 상태(타이틀/장/체크포인트/실패)
src/core/engine.js             Three.js 렌더러, XR 버튼, 프레임 루프
src/fx/paper.js                한지 질감·먹 평면 그림(캔버스 생성 텍스처)
src/fx/inkPass.js              후처리: 수묵 톤 + 긴장도 비네트
src/actors/snake.js            구렁이 메시 + 순수 함수 isFacing
src/audio/soundscape.js        Web Audio 절차적 소리
src/ui/subtitles.js            붓글씨 자막 평면
src/chapters/ch1Rules.js       순수: 1장 규칙
src/chapters/prologue.js       프롤로그 장면
src/chapters/ch1Nest.js        1장 장면(규칙 + 그림 + 소리 연결)
tests/*.test.js
```

장 인터페이스(모든 장 공통, Task 2에서 정의):

```js
// chapter = { id, checkpoints: string[], enter(ctx, checkpointId), update(dt, gestures) -> 'running'|'complete'|'fail', exit() }
```

---

### Task 1: 프로젝트 뼈대 + 조정값 + 동작 판정

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `src/config.js`, `src/input/gestures.js`
- Test: `tests/gestures.test.js`

**Interfaces:**
- Produces:
  - `CONFIG` (src/config.js): `{ CROUCH_DROP_M: 0.25, LEAN_M: 0.15, FLAP_SPEED_MPS: 1.5, DT_MAX_S: 0.1 }` 외 장별 값은 각 Task에서 추가
  - `detectGestures(sample, baseline) -> { crouch: boolean, lean: -1|0|1, flapSpeed: number, pinch: boolean }`
  - `sample = { head: {x,y,z}, hands: { left?: {y, vy}, right?: {y, vy} } | null, pinch: boolean }`, `baseline = { headY, headX }`

- [ ] **Step 1: 뼈대** — `npm init -y`, `npm i three`, `npm i -D vite vitest`. `package.json` scripts: `dev: vite --host`, `build: vite build`, `test: vitest run`. `vite.config.js`에 `base: './'`. `index.html`은 `<canvas id="app">`와 `src/main.js` 모듈만.
- [ ] **Step 2: 실패하는 테스트 작성** (`tests/gestures.test.js`)
  - `crouch is relative to baseline`: baseline.headY=1.70, head.y=1.40 → crouch true; baseline.headY=1.20(앉은 손님), head.y=1.10 → crouch false; head.y=0.90 → true
  - `lean left/right`: baseline.headX=0, head.x=-0.2 → lean -1; 0.2 → 1; 0.1 → 0
  - `flap uses fastest downward hand`: hands.left.vy=-2.0, right.vy=-0.5 → flapSpeed 2.0
  - `missing hands yields zero flap`: hands=null → flapSpeed 0, 예외 없음
- [ ] **Step 3: `npx vitest run tests/gestures.test.js`** → FAIL (모듈 없음)
- [ ] **Step 4: `detectGestures` 구현** — 숙이기: `baseline.headY - head.y >= CROUCH_DROP_M`. 기울이기: `|head.x - baseline.headX| >= LEAN_M`의 부호. flapSpeed: 아래 방향 속도(−vy)의 최댓값, 0 미만은 0.
- [ ] **Step 5: 테스트 PASS 확인**
- [ ] **Step 6: Commit** `feat: scaffold project and gesture detection`

### Task 2: 게임 진행 상태

**Files:**
- Create: `src/core/game.js`
- Test: `tests/game.test.js`

**Interfaces:**
- Consumes: `CONFIG.DT_MAX_S`
- Produces: `createGame({ chapters: Chapter[], mode: 'mild'|'spicy' })` → `{ state, start(), tick(dt, gestures), reset(), reachCheckpoint(id) }`
  - `state = { screen: 'title'|'playing'|'ending', chapterIndex, checkpointId: string|null, mode, failCount }`
  - `tick`이 장의 `update` 반환값을 보고: `'complete'` → 다음 장 `enter(ctx, null)`, 마지막이면 `screen='ending'`; `'fail'` → 현재 장 `exit()` 후 `enter(ctx, state.checkpointId)`, `failCount++`
  - `reachCheckpoint(id)`: 장이 체크포인트 통과 시 호출(ctx에 담아 장에 전달)

- [ ] **Step 1: 실패하는 테스트 작성** (가짜 장 객체로)
  - `start enters first chapter with null checkpoint`
  - `complete advances to next chapter and clears checkpoint`
  - `fail re-enters same chapter at last checkpoint` (reachCheckpoint('half') 후 fail → enter 인자 'half', failCount 1)
  - `no auto-advance`: update가 계속 'running'이면 100번 tick 후에도 chapterIndex 0
  - `dt is clamped`: tick(5.0) 시 장 update가 받은 dt === 0.1
  - `last chapter complete goes to ending`
  - `reset returns to title`: 플레이 중 reset → screen 'title', chapterIndex 0, checkpointId null
- [ ] **Step 2: FAIL 확인** `npx vitest run tests/game.test.js`
- [ ] **Step 3: `createGame` 구현**
- [ ] **Step 4: PASS 확인**
- [ ] **Step 5: Commit** `feat: game progression with checkpoints`

### Task 3: 1장 규칙 (순수)

**Files:**
- Create: `src/chapters/ch1Rules.js`; Modify: `src/config.js`
- Test: `tests/ch1Rules.test.js`

**Interfaces:**
- Consumes: `detectGestures` 결과 형태
- Produces: `createCh1Rules(checkpointId: 'half'|null)` → `{ step(dt, { crouch, snakeFacing }) -> { status: 'running'|'fail'|'arrow'|'complete', breath: 0..1, tension: 0..1, survived: number, checkpoint: 'half'|null } }`
- CONFIG 추가: `CH1_SURVIVE_S: 90, CH1_CHECKPOINT_S: 45, CH1_BREATH_MAX_S: 12, CH1_BREATH_RECOVER_S: 3, CH1_SPOT_GRACE_S: 0.4, CH1_ARROW_S: 6`

규칙:
- 숙이고 있으면 `breath`가 `1/CH1_BREATH_MAX_S`씩 줄고, 고개를 들면 `1/CH1_BREATH_RECOVER_S`씩 회복. `breath`가 0이 되면 강제로 고개를 든 것으로 처리(숨 들이켜는 소리용).
- `snakeFacing && !crouch`(또는 숨이 바닥나 강제로 든 상태)가 `CH1_SPOT_GRACE_S` 넘게 이어지면 `fail`.
- `survived`가 `CH1_CHECKPOINT_S`를 넘으면 `checkpoint: 'half'`를 한 번 알린다. 체크포인트로 시작하면 `survived`는 45부터.
- `survived >= CH1_SURVIVE_S`이면 `arrow`(화살 연출 구간, 판정 정지), 그 뒤 `CH1_ARROW_S`초 후 `complete`.
- `tension` = 구렁이가 바라보는 중이면 1 쪽으로 2초에 걸쳐 오르고, 아니면 4초에 걸쳐 0.3까지 내려온다(바닥 0.3 = 깔린 공포).

- [ ] **Step 1: 실패하는 테스트**
  - `hiding while snake faces survives`: crouch true, snakeFacing true로 10초 → running
  - `standing while snake faces fails after grace`: crouch false, facing true, 0.3초 → running, 0.5초 → fail
  - `breath runs out forces head up`: crouch true 12초 연속, facing true 계속 → 12.5초 시점 fail
  - `breath recovers when head up and snake away`
  - `checkpoint reported once at 45s`
  - `start from half begins at 45s`
  - `arrow at 90s then complete after 6s`
  - `tension floor is 0.3`
- [ ] **Step 2: FAIL 확인**
- [ ] **Step 3: 구현**
- [ ] **Step 4: PASS 확인**
- [ ] **Step 5: Commit** `feat: chapter 1 rules`

### Task 4: 엔진 + 입력 장치 + 노트북 미리보기

**Files:**
- Create: `src/core/engine.js`, `src/input/sources.js`, `src/main.js`

**Interfaces:**
- Produces:
  - `createEngine(canvas) -> { renderer, scene, camera, rig, onFrame(cb: (dt, xrFrame) => void), enterVR(): Promise<void>, onSessionEnd(cb) }` — `rig`은 카메라를 담는 Group(장마다 위치·높이 조정용). XR 요청 시 optionalFeatures `['hand-tracking','local-floor']`.
  - `createInputSources(engine) -> { read(xrFrame) -> sample, calibrate() -> baseline }` — XR 손(관절 'wrist' 속도), 컨트롤러(그립 위치 속도, 트리거=pinch), 키보드/마우스를 모두 같은 `sample`로. 키보드: Ctrl 누름 시 head.y를 baseline−0.3으로, A/D는 head.x ∓0.2, Space 누를 때마다 right.vy=−2.0 한 프레임, 클릭=pinch.
  - `main.js`: 타이틀 화면(버튼 2개: "순한 맛", "매운 맛" + 노트북에서 "미리보기") → `createGame` 시작. `onSessionEnd` → `game.reset()`. URL `?ch=0|1`이면 해당 장 바로 시작.

- [ ] **Step 1: 구현** (엔진·입력은 장치 의존이라 단위 테스트 대신 아래 확인)
- [ ] **Step 2: 확인** — `npm run dev` 후 Playwright로 `http://localhost:5173/?ch=1` 열어 콘솔 오류 0개, 캔버스가 그려지는지 스크린샷(deviceScaleFactor 1)으로 확인
- [ ] **Step 3: `npm test` 전체 PASS 유지 확인**
- [ ] **Step 4: Commit** `feat: engine, input sources, desktop preview`

### Task 5: 수묵 그림 — 한지 평면 + 먹 후처리

**Files:**
- Create: `src/fx/paper.js`, `src/fx/inkPass.js`

**Interfaces:**
- Produces:
  - `makeInkTexture({ kind: 'grass'|'ridge'|'tree'|'nest'|'mist', seed: number, size: 512 }) -> THREE.CanvasTexture` — 캔버스 2D에 붓 획(시드 고정 의사난수, 굵기·농담 변화)을 그린 투명 텍스처
  - `makePaperLayer(texture, { width, height }) -> THREE.Mesh` — 알파 테스트 평면, 항상 카메라 쪽을 대략 향함
  - `createInkPass(renderer) -> { render(scene, camera), setTension(t: 0..1), setRedPulse(t: 0..1) }` — 장면을 흑백·한지 톤으로 바꾸고, 붉은색(#b3121b 근처 색조)만 남기며, `tension`만큼 화면 가장자리에서 먹이 번져 들어오는 비네트. XR에서는 화면 효과 대신 카메라 앞 0.3m에 붙인 비네트 평면으로 같은 효과(후처리가 XR 렌더에서 동작하지 않으므로).
- [ ] **Step 1: 구현**
- [ ] **Step 2: 확인** — `?ch=1` 스크린샷을 tension 0.3과 1.0으로 각각 찍어 가장자리 먹 번짐 차이, 풀숲이 머리 위를 덮는 구도(카메라 0.15m)를 눈으로 확인
- [ ] **Step 3: Commit** `feat: ink paper layers and ink vignette`

### Task 6: 구렁이

**Files:**
- Create: `src/actors/snake.js`
- Test: `tests/snake.test.js`

**Interfaces:**
- Produces:
  - `isFacing(headPos, headDir, targetPos, maxAngleDeg = 35) -> boolean` (순수, 벡터는 `{x,y,z}`)
  - `createSnake({ segments: 48, radius: 0.12, length: 6 }) -> { mesh, setPath(points: THREE.Vector3[]), update(dt, t), headPosition(), headDirection(), rearUp(amount: 0..1) }` — 마디는 `InstancedMesh`로, 경로 곡선(CatmullRom)을 따라 몸이 미끄러지며 좌우 사인 굴곡. 몸은 먹색 + 비늘 무늬 텍스처, 눈 2개만 붉은색 발광.
- [ ] **Step 1: 실패하는 테스트** — `faces target straight ahead` true, `target at 90 degrees` false, `target behind` false, `zero-length direction returns false`
- [ ] **Step 2: FAIL 확인** → **Step 3: 구현** → **Step 4: PASS 확인**
- [ ] **Step 5: 확인** — `?ch=1`에서 구렁이가 둥지 둘레를 도는 스크린샷 3장(서로 다른 시각)
- [ ] **Step 6: Commit** `feat: procedural snake`

### Task 7: 소리

**Files:**
- Create: `src/audio/soundscape.js`
- Test: `tests/soundscape.test.js`

**Interfaces:**
- Produces: `createSoundscape(AudioContextCtor = globalThis.AudioContext)` → `{ unlock(): Promise<void>, setListener(pos, quat), wind(level), hiss(pos, level), drone(level), heartbeat(bpm), breath(kind: 'hold'|'gasp'), sting(kind: 'spotted'|'arrow') }` — 모두 Web Audio로 합성(바람=필터 노이즈, 비늘=고역 노이즈 버스트+PannerNode HRTF, 저음=40~60Hz 사인 2개 맥놀이, 심장=저역 펄스). `unlock()` 전 호출은 아무것도 하지 않는다.
- [ ] **Step 1: 실패하는 테스트** — `calls before unlock are no-ops`(가짜 AudioContext 생성자가 호출되지 않거나 노드가 연결되지 않음, 예외 없음), `heartbeat bpm is clamped to 50..160`
- [ ] **Step 2: FAIL 확인** → **Step 3: 구현** → **Step 4: PASS 확인**
- [ ] **Step 5: Commit** `feat: procedural soundscape`

### Task 8: 자막 + 프롤로그 + 1장 연결

**Files:**
- Create: `src/ui/subtitles.js`, `src/chapters/prologue.js`, `src/chapters/ch1Nest.js`; Modify: `src/main.js`

**Interfaces:**
- Consumes: Task 2 장 인터페이스, `createCh1Rules`, `createSnake`/`isFacing`, `makeInkTexture`/`makePaperLayer`, `createInkPass`, `createSoundscape`
- Produces: `createSubtitles(engine) -> { show(text, seconds), clear() }`; `prologue`, `ch1Nest` 장 객체

고정 문구:
- 프롤로그: "옛날 옛적, 적악산이라 불리던 산이 있었다…"
- 1장 안내: "고개를 숙여 몸을 숨기세요", "숨이 차면 잠깐 고개를 드세요"
- 비상 정지 안내(타이틀): "무서우면 양손을 머리 위로 올리세요"

1장 연출:
- 카메라 rig 높이 0.15m, 풀 평면이 머리 위로 덮음, 어미 꿩 날개 평면이 처음 5초간 위를 덮었다가 날아감.
- 구렁이가 둥지 둘레를 반경 1.2~2.5m로 돌고, 일정 간격으로 머리를 들어(rearUp) 둥지 쪽을 본다. `snakeFacing = isFacing(snake.head, snake.dir, playerHead)`.
- 규칙 `tension` → `inkPass.setTension`, 심장 bpm = 60 + 80×tension, 비늘 소리는 구렁이 머리 위치에서.
- 화면 밖 뒤쪽에서 비늘 소리를 20~40초 간격으로 한 번씩(구렁이 실제 위치와 무관, 분위기 장치).
- 붉은 눈: 어둠 속 고정 위치 2곳, 시야 중앙 15° 안에 들어오면 0.5초 뒤 사라짐.
- `fail`: 화면 먹물에 잠김 1.5초(`mild`: 어둠+스르륵, `spicy`: 구렁이 머리가 정면으로 덮침) 후 게임이 체크포인트로 재진입.
- `arrow`: 화살 꽂히는 소리 + 구렁이 쓰러짐, 고개를 들면 위쪽에 거인 선비 실루엣 평면.
- `spicy` 전용: 30초 지점에 형제 새끼 꿩이 삼켜지는 실루엣.

- [ ] **Step 1: 구현**
- [ ] **Step 2: 전체 테스트 PASS 확인** `npm test`
- [ ] **Step 3: 플레이 확인** — Playwright로 `?ch=1` 미리보기를 열고 키보드 입력을 흉내 내 (a) Ctrl 누른 채 버티면 체크포인트 통과, (b) 구렁이가 볼 때 Ctrl을 떼면 실패 후 45초 지점에서 재시작, (c) 90초 후 화살 장면을 지나 엔딩 화면 도달을 확인. 시간 단축을 위해 `?fast=10` 쿼리로 CONFIG 시간을 1/10로.
- [ ] **Step 4: 빌드** `npm run build` → `dist/` 생성, 오류 없음
- [ ] **Step 5: Commit** `feat: prologue and chapter 1 playable`

---

## 1단계 이후 (이 계획 범위 밖)

- 퀘스트에서 열 https 주소: 사용자 GitHub 저장소에 GitHub Pages로 배포하는 방법을 1단계 완료 시 안내한다.
- 2~5장, 에필로그, 매운 맛 나머지 연출, 직원용 숨은 건너뛰기 → 2·3단계 계획.
