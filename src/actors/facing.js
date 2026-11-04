/** 머리가 target 쪽을 maxAngleDeg 이내로 보고 있는가 (순수 함수, 벡터는 {x,y,z}) */
export function isFacing(headPos, headDir, targetPos, maxAngleDeg = 35) {
  const dl = Math.hypot(headDir.x, headDir.y, headDir.z);
  const tx = targetPos.x - headPos.x, ty = targetPos.y - headPos.y, tz = targetPos.z - headPos.z;
  const tl = Math.hypot(tx, ty, tz);
  if (dl === 0 || tl === 0) return false;
  const cos = (headDir.x * tx + headDir.y * ty + headDir.z * tz) / (dl * tl);
  return cos >= Math.cos((maxAngleDeg * Math.PI) / 180);
}
