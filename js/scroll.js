// js/scroll.js
export const MIN_SPEED = 10;   // px/sec
export const MAX_SPEED = 120;  // px/sec
export const SPEED_STEP = 1;   // px/sec per tap of slower/faster — deliberately
                               // fine-grained: finding a comfortable reading
                               // pace needs small nudges, not big jumps

export function computeScrollOffsetPx(elapsedMs, speedPxPerSec) {
  return (elapsedMs / 1000) * speedPxPerSec;
}

export function clampSpeed(speedPxPerSec) {
  return Math.min(MAX_SPEED, Math.max(MIN_SPEED, speedPxPerSec));
}
