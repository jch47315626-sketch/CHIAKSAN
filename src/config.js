// 모든 조정값을 한곳에 모은다. 플레이 테스트 후 여기 숫자만 바꾸면 된다.
export const CONFIG = {
  CROUCH_DROP_M: 0.25, // 기준 머리 높이보다 이만큼 낮으면 숙인 것
  LEAN_M: 0.15, // 기준 위치에서 좌우로 이만큼 움직이면 기울인 것
  FLAP_SPEED_MPS: 1.5, // 손이 이 속도 이상 아래로 움직이면 날갯짓
  DT_MAX_S: 0.1, // 프레임 간격 상한 (탭 전환·헤드셋 벗기 대비)

  // 1장 둥지
  CH1_SURVIVE_S: 90, // 이만큼 버티면 화살
  CH1_CHECKPOINT_S: 45, // 체크포인트
  CH1_BREATH_MAX_S: 12, // 숙인 채 숨 참을 수 있는 시간
  CH1_BREATH_RECOVER_S: 3, // 고개 들고 숨 회복 시간
  CH1_BREATH_RESUME: 0.25, // 숨이 바닥나 고개를 든 뒤 이만큼 회복해야 다시 숨을 수 있음
  CH1_SPOT_GRACE_S: 0.4, // 구렁이에게 이만큼 보이면 들킴
  CH1_ARROW_S: 6, // 화살 연출 길이
  TENSION_FLOOR: 0.3, // 깔린 공포의 바닥값
  TENSION_RISE_S: 2,
  TENSION_FALL_S: 4,
};

/** ?fast=10 같은 쿼리로 시간 값을 나눠 테스트를 빨리 돌린다. */
const SPEEDUP_KEYS = ['CH1_SURVIVE_S', 'CH1_CHECKPOINT_S', 'CH1_ARROW_S'];
export function applySpeedup(factor) {
  if (!(factor > 1)) return;
  for (const k of SPEEDUP_KEYS) CONFIG[k] /= factor;
}
