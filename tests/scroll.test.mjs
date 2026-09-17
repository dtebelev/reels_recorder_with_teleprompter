import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeScrollOffsetPx, clampSpeed, SPEED_STEP, MIN_SPEED, MAX_SPEED } from '../js/scroll.js';

test('offset grows linearly with elapsed time and speed', () => {
  assert.equal(computeScrollOffsetPx(1000, 30), 30);
  assert.equal(computeScrollOffsetPx(2500, 30), 75);
  assert.equal(computeScrollOffsetPx(0, 30), 0);
});

test('clampSpeed keeps speed within [MIN_SPEED, MAX_SPEED]', () => {
  assert.equal(clampSpeed(MIN_SPEED - SPEED_STEP), MIN_SPEED);
  assert.equal(clampSpeed(MAX_SPEED + SPEED_STEP), MAX_SPEED);
  assert.equal(clampSpeed(MIN_SPEED + SPEED_STEP), MIN_SPEED + SPEED_STEP);
});
