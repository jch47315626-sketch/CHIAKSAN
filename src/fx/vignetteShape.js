// 먹 번짐 비네트의 모양 계산 (순수 함수). 셰이더와 같은 값을 쓴다.
export const NOISE_AMP = 0.35; // 가장자리 일렁임 폭 (±NOISE_AMP/2)
export const innerRadius = (tension) => 0.95 + (0.5 - 0.95) * tension;

/**
 * 비네트가 완전히 투명한 가운데 구멍의 반지름 (r = 화면 중심 거리 × 2 기준).
 * 이 안쪽은 아예 그리지 않아 퀘스트 GPU 부담을 줄인다. 먹물로 덮는 중이면 0 (전체를 그린다).
 */
export function vignetteHole(tension, blackout) {
  if (blackout > 0) return 0;
  return Math.max(0, innerRadius(tension) - 0.25 - NOISE_AMP / 2 - 0.02);
}
