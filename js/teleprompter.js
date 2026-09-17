// js/teleprompter.js
import { computeScrollOffsetPx } from './scroll.js';

export class Teleprompter {
  #container;
  #textEl;
  #speedPxPerSec;
  #fontSizePx;
  #startTime = null;
  #rafId = null;
  #baseOffsetPx = 0; // allows resuming after a speed/pause change

  constructor(container, { script, speedPxPerSec, fontSizePx }) {
    this.#container = container;
    this.#speedPxPerSec = speedPxPerSec;
    this.#fontSizePx = fontSizePx;
    this.#container.innerHTML = `
      <div class="teleprompter">
        <div class="teleprompter__readline"></div>
        <div class="teleprompter__viewport">
          <p class="teleprompter__text"></p>
        </div>
      </div>
    `;
    this.#textEl = this.#container.querySelector('.teleprompter__text');
    this.#textEl.textContent = script;
    this.#textEl.style.fontSize = `${fontSizePx}px`;
  }

  setSpeed(speedPxPerSec) {
    this.#snapshotOffset();
    this.#startTime = performance.now();
    this.#speedPxPerSec = speedPxPerSec;
  }

  setFontSize(fontSizePx) {
    this.#fontSizePx = fontSizePx;
    this.#textEl.style.fontSize = `${fontSizePx}px`;
  }

  #currentOffset() {
    if (this.#startTime === null) return this.#baseOffsetPx;
    const elapsed = performance.now() - this.#startTime;
    return this.#baseOffsetPx + computeScrollOffsetPx(elapsed, this.#speedPxPerSec);
  }

  /** Freezes the current scroll position into #baseOffsetPx so a later
   * resume (via start() or setSpeed()) continues from here instead of
   * jumping back to wherever #baseOffsetPx last was. */
  #snapshotOffset() {
    this.#baseOffsetPx = this.#currentOffset();
  }

  start() {
    if (this.#rafId !== null) return; // already running; avoid a second RAF loop
    this.#startTime = performance.now();
    const tick = () => {
      const offset = this.#currentOffset();
      this.#textEl.style.transform = `translateY(-${offset}px)`;
      this.#rafId = requestAnimationFrame(tick);
    };
    this.#rafId = requestAnimationFrame(tick);
  }

  stop() {
    if (this.#rafId !== null) cancelAnimationFrame(this.#rafId);
    this.#rafId = null;
    this.#snapshotOffset();
    this.#startTime = null;
  }

  reset() {
    this.stop();
    this.#baseOffsetPx = 0;
    this.#startTime = null;
    this.#textEl.style.transform = 'translateY(0)';
  }
}
