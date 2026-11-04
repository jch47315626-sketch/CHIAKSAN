import { CONFIG } from '../config.js';

/**
 * 게임 진행 상태. 장 인터페이스:
 * { id, checkpoints, enter(ctx, checkpointId), update(dt, gestures) -> 'running'|'complete'|'fail', exit() }
 * ctx = { mode, reachCheckpoint(id), ...extra }
 */
export function createGame({ chapters, mode, extraCtx = {} }) {
  const state = { screen: 'title', chapterIndex: 0, checkpointId: null, mode, failCount: 0 };
  const ctx = { ...extraCtx, mode, reachCheckpoint: (id) => { state.checkpointId = id; } };
  const current = () => chapters[state.chapterIndex];

  function enter(index, checkpointId, retry = false) {
    ctx.retry = retry; // 실패 후 재진입이면 장은 기준 머리 높이를 다시 재지 않는다
    state.chapterIndex = index;
    state.checkpointId = checkpointId;
    chapters[index].enter(ctx, checkpointId);
  }

  return {
    state,
    ctx,
    start(index = 0) {
      ctx.resetPresentation?.();
      state.screen = 'playing';
      state.failCount = 0;
      enter(index, null);
    },
    reachCheckpoint: ctx.reachCheckpoint,
    tick(dt, gestures) {
      if (state.screen !== 'playing') return;
      const result = current().update(Math.min(dt, CONFIG.DT_MAX_S), gestures);
      if (result === 'complete') {
        current().exit();
        if (state.chapterIndex + 1 < chapters.length) enter(state.chapterIndex + 1, null);
        else state.screen = 'ending';
      } else if (result === 'fail') {
        current().exit();
        state.failCount++;
        enter(state.chapterIndex, state.checkpointId, true);
      }
    },
    reset() {
      if (state.screen === 'playing') current().exit();
      ctx.resetPresentation?.();
      state.screen = 'title';
      state.chapterIndex = 0;
      state.checkpointId = null;
    },
  };
}
