import { CONFIG } from '../config.js';

/**
 * 입력 샘플을 동작 판정으로 바꾼다. 장치와 무관한 순수 함수.
 * @param {{head:{x:number,y:number,z:number}, hands:null|{left?:{y:number,vy:number},right?:{y:number,vy:number}}, pinch:boolean}} sample
 * @param {{headY:number, headX:number}} baseline 장 시작 때 잰 머리 위치
 */
export function detectGestures(sample, baseline) {
  const crouch = baseline.headY - sample.head.y >= CONFIG.CROUCH_DROP_M;
  const dx = sample.head.x - baseline.headX;
  const lean = Math.abs(dx) >= CONFIG.LEAN_M ? Math.sign(dx) : 0;
  let flapSpeed = 0;
  for (const hand of [sample.hands?.left, sample.hands?.right]) {
    if (hand) flapSpeed = Math.max(flapSpeed, -hand.vy);
  }
  return { crouch, lean, flapSpeed, pinch: !!sample.pinch };
}
