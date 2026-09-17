// js/teleprompter.js
import { computeScrollOffsetPx } from './scroll.js';

export class Teleprompter {
  #container;
  #textEl;
  #speedPxPerSec;
  #startTime = null;
  #rafId = null;
  #delayTimeoutId = null;
  #baseOffsetPx = 0; // allows resuming after a speed/pause change
  #dragStartY = null;
  #dragStartOffsetPx = 0;

  constructor(container, { script, speedPxPerSec, fontSizePx }) {
    this.#container = container;
    this.#speedPxPerSec = speedPxPerSec;
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
    this.#container.style.touchAction = 'none';
    this.#attachDragHandlers();
  }

  setSpeed(speedPxPerSec) {
    this.#snapshotOffset();
    this.#startTime = performance.now();
    this.#speedPxPerSec = speedPxPerSec;
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

  /** Manually positions the text (e.g. from a finger-drag scrub), clamped
   * so it can never scroll above the very start of the script. */
  #setOffsetPx(px) {
    this.#baseOffsetPx = Math.max(0, px);
    this.#startTime = null;
    this.#textEl.style.transform = `translateY(-${this.#baseOffsetPx}px)`;
  }

  #attachDragHandlers() {
    const el = this.#container;
    el.addEventListener('pointerdown', (e) => {
      this.stop(); // freeze auto-scroll and any pending start delay
      this.#dragStartY = e.clientY;
      this.#dragStartOffsetPx = this.#baseOffsetPx;
      el.setPointerCapture?.(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (this.#dragStartY === null) return;
      const draggedDownPx = e.clientY - this.#dragStartY;
      // Dragging a finger down reveals earlier text, like a normal scroll.
      this.#setOffsetPx(this.#dragStartOffsetPx - draggedDownPx);
    });
    const endDrag = () => {
      if (this.#dragStartY === null) return;
      this.#dragStartY = null;
      this.start(); // resume auto-scroll from wherever the user left it
    };
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);
  }

  #beginScrolling() {
    this.#startTime = performance.now();
    const tick = () => {
      const offset = this.#currentOffset();
      this.#textEl.style.transform = `translateY(-${offset}px)`;
      this.#rafId = requestAnimationFrame(tick);
    };
    this.#rafId = requestAnimationFrame(tick);
  }

  /** Starts (or resumes) scrolling. `delayMs` keeps the text frozen in
   * place for that long first, so the reader has time to get ready. */
  start(delayMs = 0) {
    if (this.#rafId !== null || this.#delayTimeoutId !== null) return; // already running/waiting
    if (delayMs > 0) {
      this.#delayTimeoutId = setTimeout(() => {
        this.#delayTimeoutId = null;
        this.#beginScrolling();
      }, delayMs);
      return;
    }
    this.#beginScrolling();
  }

  stop() {
    if (this.#delayTimeoutId !== null) {
      clearTimeout(this.#delayTimeoutId);
      this.#delayTimeoutId = null;
    }
    if (this.#rafId !== null) cancelAnimationFrame(this.#rafId);
    this.#rafId = null;
    this.#snapshotOffset();
    this.#startTime = null;
  }
}
