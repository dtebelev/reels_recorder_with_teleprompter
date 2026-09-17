# Reels Recorder with Teleprompter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a no-build, offline-capable PWA that lets someone record
vertical selfie video on their phone while reading a teleprompter script
positioned to avoid the "eyes reading" look, then keep or retake before
saving.

**Architecture:** Single-page app, vanilla HTML/CSS/JS loaded as native
ES modules (`<script type="module">`, no bundler). Pure/logic-heavy
functions (settings persistence, mime-type selection, scroll math) live
in their own small modules with dependency-injected I/O so they can be
unit-tested with plain `node:assert` — no test framework. DOM-heavy
integration code (camera, teleprompter rendering, recorder wiring,
screen transitions) is verified manually in a real mobile browser, per
the spec's own testing approach.

**Tech Stack:** Vanilla JS (ES modules), CSS, `getUserMedia`,
`MediaRecorder`, `localStorage`, Web App Manifest + Service Worker.
Node.js only used to run the plain-assert unit tests during
development — never shipped.

**Reference spec:** `docs/superpowers/specs/2026-09-17-reels-teleprompter-design.md`

---

## File Layout (end state)

```
index.html
css/styles.css
js/state.js
js/mime.js
js/scroll.js
js/camera.js
js/recorder.js
js/teleprompter.js
js/app.js
manifest.json
sw.js
icons/icon-192.png
icons/icon-512.png
tests/state.test.mjs
tests/mime.test.mjs
tests/scroll.test.mjs
```

Serve locally with any static server, e.g. `npx serve .` (Node's
`npx` is only used as a dev convenience — the app itself has zero
dependencies).

---

### Task 1: Project scaffold

**Files:**
- Create: `index.html`
- Create: `css/styles.css`
- Create: `.gitignore`

**Step 1: Create the HTML skeleton**

```html
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />
  <title>Reels Teleprompter</title>
  <link rel="manifest" href="manifest.json" />
  <link rel="apple-touch-icon" href="icons/icon-192.png" />
  <meta name="theme-color" content="#0b0b0c" />
  <link rel="stylesheet" href="css/styles.css" />
</head>
<body>
  <main id="app">
    <!-- Screens are rendered here by js/app.js -->
  </main>
  <script type="module" src="js/app.js"></script>
</body>
</html>
```

**Step 2: Create an empty stylesheet with the base reset**

```css
* { box-sizing: border-box; }
html, body {
  margin: 0;
  height: 100%;
  background: #000;
  color: #fff;
  font-family: -apple-system, "Segoe UI", Roboto, sans-serif;
  overscroll-behavior: none;
}
#app {
  position: fixed;
  inset: 0;
  overflow: hidden;
}
```

**Step 3: Add a `.gitignore`**

```
node_modules/
.DS_Store
```

**Step 4: Verify**

Open `index.html` via a static server (e.g. `npx serve .`) on desktop
Chrome. Expect a blank black page with no console errors.

**Step 5: Commit**

```bash
git add index.html css/styles.css .gitignore
git commit -m "chore: scaffold PWA shell"
```

---

### Task 2: Settings persistence module (`state.js`)

**Files:**
- Create: `js/state.js`
- Test: `tests/state.test.mjs`

**Step 1: Write the failing test**

```js
// tests/state.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from '../js/state.js';

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
  };
}

test('loadSettings returns defaults when storage is empty', () => {
  const settings = loadSettings(fakeStorage());
  assert.deepEqual(settings, DEFAULT_SETTINGS);
});

test('saveSettings then loadSettings round-trips values', () => {
  const storage = fakeStorage();
  saveSettings(storage, { script: 'Привет мир', speedPxPerSec: 40, fontSizePx: 32 });
  const settings = loadSettings(storage);
  assert.equal(settings.script, 'Привет мир');
  assert.equal(settings.speedPxPerSec, 40);
  assert.equal(settings.fontSizePx, 32);
});

test('loadSettings ignores corrupt JSON and returns defaults', () => {
  const storage = fakeStorage({ 'reels-teleprompter/settings': 'not json' });
  const settings = loadSettings(storage);
  assert.deepEqual(settings, DEFAULT_SETTINGS);
});
```

**Step 2: Run it to verify it fails**

Run: `node --test tests/state.test.mjs`
Expected: fails with a module-not-found error for `../js/state.js`.

**Step 3: Implement `js/state.js`**

```js
// js/state.js
const STORAGE_KEY = 'reels-teleprompter/settings';

export const DEFAULT_SETTINGS = {
  script: '',
  speedPxPerSec: 30,
  fontSizePx: 28,
};

export function loadSettings(storage = globalThis.localStorage) {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(storage = globalThis.localStorage, partial) {
  const current = loadSettings(storage);
  const next = { ...current, ...partial };
  storage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/state.test.mjs`
Expected: 3 passing tests.

**Step 5: Commit**

```bash
git add js/state.js tests/state.test.mjs
git commit -m "feat: add settings persistence module"
```

---

### Task 3: Mime-type picker module (`mime.js`)

**Files:**
- Create: `js/mime.js`
- Test: `tests/mime.test.mjs`

**Why dependency-injected:** `MediaRecorder.isTypeSupported` only
exists in a real browser. Passing it in as a parameter lets the
selection logic be tested in plain Node.

**Step 1: Write the failing test**

```js
// tests/mime.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pickSupportedMimeType, MIME_CANDIDATES } from '../js/mime.js';

test('picks the first candidate the browser supports', () => {
  const isSupported = (type) => type === 'video/webm;codecs=vp9,opus';
  assert.equal(pickSupportedMimeType(isSupported), 'video/webm;codecs=vp9,opus');
});

test('falls back through the candidate list in order', () => {
  const isSupported = (type) => type === MIME_CANDIDATES[MIME_CANDIDATES.length - 1];
  assert.equal(pickSupportedMimeType(isSupported), MIME_CANDIDATES[MIME_CANDIDATES.length - 1]);
});

test('returns null when nothing is supported', () => {
  assert.equal(pickSupportedMimeType(() => false), null);
});
```

**Step 2: Run it to verify it fails**

Run: `node --test tests/mime.test.mjs`
Expected: fails, `../js/mime.js` not found.

**Step 3: Implement `js/mime.js`**

```js
// js/mime.js
// Order matters: prefer mp4 (widely shareable, native on newer iOS),
// fall back to webm variants for browsers that only support that.
export const MIME_CANDIDATES = [
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

export function pickSupportedMimeType(isSupported) {
  return MIME_CANDIDATES.find((type) => isSupported(type)) ?? null;
}
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/mime.test.mjs`
Expected: 3 passing tests.

**Step 5: Commit**

```bash
git add js/mime.js tests/mime.test.mjs
git commit -m "feat: add MediaRecorder mime-type selection"
```

---

### Task 4: Scroll offset math module (`scroll.js`)

**Files:**
- Create: `js/scroll.js`
- Test: `tests/scroll.test.mjs`

**Step 1: Write the failing test**

```js
// tests/scroll.test.mjs
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
```

**Step 2: Run it to verify it fails**

Run: `node --test tests/scroll.test.mjs`
Expected: fails, `../js/scroll.js` not found.

**Step 3: Implement `js/scroll.js`**

```js
// js/scroll.js
export const MIN_SPEED = 10;   // px/sec
export const MAX_SPEED = 120;  // px/sec
export const SPEED_STEP = 10;  // px/sec per tap of slower/faster

export function computeScrollOffsetPx(elapsedMs, speedPxPerSec) {
  return (elapsedMs / 1000) * speedPxPerSec;
}

export function clampSpeed(speedPxPerSec) {
  return Math.min(MAX_SPEED, Math.max(MIN_SPEED, speedPxPerSec));
}
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/scroll.test.mjs`
Expected: 2 passing tests.

**Step 5: Commit**

```bash
git add js/scroll.js tests/scroll.test.mjs
git commit -m "feat: add teleprompter scroll math"
```

---

### Task 5: Camera module (`camera.js`)

**Files:**
- Create: `js/camera.js`

This is a thin wrapper with no pure logic worth unit-testing (it's a
direct `getUserMedia` call) — verified manually in Task 8.

**Step 1: Implement `js/camera.js`**

```js
// js/camera.js
export class CameraError extends Error {
  constructor(cause) {
    super('Camera unavailable');
    this.cause = cause;
  }
}

export async function acquireFrontCameraStream() {
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1920 } },
      audio: true,
    });
  } catch (err) {
    throw new CameraError(err);
  }
}

export function stopStream(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}
```

**Step 2: Commit**

```bash
git add js/camera.js
git commit -m "feat: add camera acquisition wrapper"
```

---

### Task 6: Recorder module (`recorder.js`)

**Files:**
- Create: `js/recorder.js`

Uses `mime.js` from Task 3. Manual verification happens once it's
wired into the Recording screen (Task 10) — `MediaRecorder` itself
can't run outside a browser.

**Step 1: Implement `js/recorder.js`**

```js
// js/recorder.js
import { pickSupportedMimeType } from './mime.js';

export class Recorder {
  #mediaRecorder = null;
  #chunks = [];
  #mimeType = null;

  constructor(stream) {
    this.#mimeType = pickSupportedMimeType(
      (type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)
    );
    if (!this.#mimeType) {
      throw new Error('No supported recording format on this browser');
    }
    this.#mediaRecorder = new MediaRecorder(stream, { mimeType: this.#mimeType });
    this.#mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.#chunks.push(e.data);
    };
  }

  get canPause() {
    return typeof this.#mediaRecorder.pause === 'function';
  }

  start() {
    this.#chunks = [];
    this.#mediaRecorder.start();
  }

  pause() {
    this.#mediaRecorder.pause();
  }

  resume() {
    this.#mediaRecorder.resume();
  }

  /** Resolves with the recorded Blob once the recorder has flushed. */
  stop() {
    return new Promise((resolve) => {
      this.#mediaRecorder.onstop = () => {
        resolve(new Blob(this.#chunks, { type: this.#mimeType }));
      };
      this.#mediaRecorder.stop();
    });
  }
}
```

**Step 2: Commit**

```bash
git add js/recorder.js
git commit -m "feat: add MediaRecorder wrapper"
```

---

### Task 7: Setup screen

**Files:**
- Modify: `index.html`
- Modify: `css/styles.css`
- Create: `js/app.js`

**Step 1: Add Setup screen markup to `index.html`**

Replace the `<main id="app">` body with a template the app can clone,
or (simplest for a no-build project) build it directly in
`js/app.js` via `innerHTML`. Use the latter to keep one source of
truth for screen markup.

**Step 2: Implement the Setup screen in `js/app.js`**

```js
// js/app.js
import { loadSettings, saveSettings } from './state.js';
import { clampSpeed, SPEED_STEP } from './scroll.js';

const app = document.getElementById('app');
let settings = loadSettings();

function renderSetup() {
  app.innerHTML = `
    <div class="screen screen--setup">
      <h1>Сценарий</h1>
      <textarea id="script" placeholder="Вставьте текст, который будете читать...">${escapeHtml(settings.script)}</textarea>
      <label>
        Скорость: <span id="speed-value">${settings.speedPxPerSec}</span> px/с
        <div class="row">
          <button id="speed-down" aria-label="Медленнее">−</button>
          <button id="speed-up" aria-label="Быстрее">+</button>
        </div>
      </label>
      <label>
        Размер шрифта: <span id="font-value">${settings.fontSizePx}</span> px
        <div class="row">
          <button id="font-down" aria-label="Меньше">−</button>
          <button id="font-up" aria-label="Больше">+</button>
        </div>
      </label>
      <button id="rehearse-btn" class="primary">Проверить суфлёр</button>
    </div>
  `;

  const scriptEl = document.getElementById('script');
  scriptEl.addEventListener('input', () => {
    settings = saveSettings(undefined, { script: scriptEl.value });
  });

  document.getElementById('speed-down').addEventListener('click', () => {
    settings = saveSettings(undefined, { speedPxPerSec: clampSpeed(settings.speedPxPerSec - SPEED_STEP) });
    document.getElementById('speed-value').textContent = settings.speedPxPerSec;
  });
  document.getElementById('speed-up').addEventListener('click', () => {
    settings = saveSettings(undefined, { speedPxPerSec: clampSpeed(settings.speedPxPerSec + SPEED_STEP) });
    document.getElementById('speed-value').textContent = settings.speedPxPerSec;
  });
  document.getElementById('font-down').addEventListener('click', () => {
    settings = saveSettings(undefined, { fontSizePx: Math.max(16, settings.fontSizePx - 4) });
    document.getElementById('font-value').textContent = settings.fontSizePx;
  });
  document.getElementById('font-up').addEventListener('click', () => {
    settings = saveSettings(undefined, { fontSizePx: Math.min(72, settings.fontSizePx + 4) });
    document.getElementById('font-value').textContent = settings.fontSizePx;
  });

  document.getElementById('rehearse-btn').addEventListener('click', () => {
    // Wired to the Rehearsal screen in Task 9.
  });
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

renderSetup();
```

**Step 3: Add Setup screen styles to `css/styles.css`**

```css
.screen { padding: 20px; height: 100%; overflow-y: auto; }
.screen--setup textarea {
  width: 100%; min-height: 30vh; font-size: 16px; padding: 12px;
  background: #1a1a1c; color: #fff; border: 1px solid #333; border-radius: 8px;
}
.screen--setup label { display: block; margin-top: 16px; }
.row { display: flex; gap: 8px; margin-top: 6px; }
.row button {
  flex: 1; padding: 12px; font-size: 20px; background: #1a1a1c; color: #fff;
  border: 1px solid #333; border-radius: 8px;
}
button.primary {
  margin-top: 24px; width: 100%; padding: 16px; font-size: 18px;
  background: #ff5a36; color: #fff; border: none; border-radius: 12px;
}
```

**Step 4: Verify manually**

Serve the app, open in desktop Chrome. Type a script, tap speed/font
+/− buttons, reload the page — values must persist (via
`localStorage`).

**Step 5: Commit**

```bash
git add index.html css/styles.css js/app.js
git commit -m "feat: add Setup screen"
```

---

### Task 8: Teleprompter controller (`teleprompter.js`)

**Files:**
- Create: `js/teleprompter.js`
- Modify: `css/styles.css`

This implements the eye-contact layout from the spec's Research
section: a narrow, width-constrained band pinned to the top ~20% of
the screen, directly under the front camera, with a fixed "read here"
line at the top of that band.

**Step 1: Implement `js/teleprompter.js`**

```js
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
    this.#baseOffsetPx = this.#currentOffset();
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

  start() {
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
  }

  reset() {
    this.stop();
    this.#baseOffsetPx = 0;
    this.#startTime = null;
    this.#textEl.style.transform = 'translateY(0)';
  }
}
```

**Step 2: Add teleprompter styles to `css/styles.css`**

```css
.teleprompter {
  position: absolute; top: 0; left: 0; right: 0; height: 20vh;
  display: flex; flex-direction: column; align-items: center;
  background: linear-gradient(to bottom, rgba(0,0,0,0.75), rgba(0,0,0,0.15));
  z-index: 10;
}
.teleprompter__readline {
  width: 70%; height: 2px; background: #ff5a36; margin-top: 6px;
}
.teleprompter__viewport {
  width: 65%; height: 100%; overflow: hidden; text-align: center;
}
.teleprompter__text {
  margin: 8px 0 0; color: #fff; font-weight: 600; line-height: 1.3;
  will-change: transform;
}
```

**Step 3: Verify manually**

This is exercised end-to-end once wired into the Rehearsal screen in
Task 9 — no standalone check needed here.

**Step 4: Commit**

```bash
git add js/teleprompter.js css/styles.css
git commit -m "feat: add teleprompter controller with eye-contact layout"
```

---

### Task 9: Rehearsal screen

**Files:**
- Modify: `js/app.js`

**Step 1: Add the Rehearsal screen and wire it up**

Append to `js/app.js` (after the imports, add `CameraError`,
`acquireFrontCameraStream`, `stopStream`, and `Teleprompter`):

```js
import { CameraError, acquireFrontCameraStream, stopStream } from './camera.js';
import { Teleprompter } from './teleprompter.js';

let cameraStream = null;
let teleprompter = null;

async function renderRehearsal() {
  app.innerHTML = `
    <div class="screen screen--camera">
      <video id="preview" autoplay playsinline muted></video>
      <div id="teleprompter-mount"></div>
      <div class="controls">
        <button id="slower">Медленнее</button>
        <button id="record-btn" class="record-btn"></button>
        <button id="faster">Быстрее</button>
      </div>
      <button id="back-btn" class="link-btn">← Настройки</button>
    </div>
  `;

  try {
    cameraStream = await acquireFrontCameraStream();
  } catch (err) {
    renderCameraError(err);
    return;
  }

  const video = document.getElementById('preview');
  video.srcObject = cameraStream;

  teleprompter = new Teleprompter(document.getElementById('teleprompter-mount'), settings);
  teleprompter.start();

  document.getElementById('slower').addEventListener('click', () => {
    settings = saveSettings(undefined, { speedPxPerSec: clampSpeed(settings.speedPxPerSec - SPEED_STEP) });
    teleprompter.setSpeed(settings.speedPxPerSec);
  });
  document.getElementById('faster').addEventListener('click', () => {
    settings = saveSettings(undefined, { speedPxPerSec: clampSpeed(settings.speedPxPerSec + SPEED_STEP) });
    teleprompter.setSpeed(settings.speedPxPerSec);
  });
  document.getElementById('back-btn').addEventListener('click', () => {
    teleprompter.stop();
    stopStream(cameraStream);
    renderSetup();
  });
  document.getElementById('record-btn').addEventListener('click', () => {
    // Wired to the Recording screen in Task 10.
  });
}

function renderCameraError(err) {
  app.innerHTML = `
    <div class="screen screen--error">
      <p>Не удалось получить доступ к камере/микрофону.</p>
      <p class="error-detail">${err instanceof CameraError ? err.cause?.message ?? '' : String(err)}</p>
      <button id="retry-btn" class="primary">Повторить</button>
    </div>
  `;
  document.getElementById('retry-btn').addEventListener('click', renderRehearsal);
}
```

Update the Setup screen's `rehearse-btn` handler (Task 7) to call
`renderRehearsal()` instead of the empty stub.

**Step 2: Add camera/controls styles to `css/styles.css`**

```css
.screen--camera { position: relative; padding: 0; }
#preview {
  position: absolute; inset: 0; width: 100%; height: 100%;
  object-fit: cover; transform: scaleX(-1);
}
.controls {
  position: absolute; bottom: 24px; left: 0; right: 0;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 24px; z-index: 20;
}
.controls button { background: none; border: none; color: #fff; font-size: 14px; }
.record-btn {
  width: 72px; height: 72px; border-radius: 50%;
  background: #ff5a36; border: 4px solid #fff;
}
.link-btn {
  position: absolute; top: 12px; left: 12px; z-index: 20;
  background: none; border: none; color: #fff; text-decoration: underline;
}
.screen--error { display: flex; flex-direction: column; gap: 16px; justify-content: center; align-items: center; text-align: center; }
```

**Step 3: Verify manually**

On a phone (or desktop Chrome with a webcam), tap "Проверить суфлёр":
camera preview appears mirrored, script scrolls in the top band,
слабее/быстрее change speed live without restarting from the top.
Deny camera permission once to confirm the error screen + retry works.

**Step 4: Commit**

```bash
git add js/app.js css/styles.css
git commit -m "feat: add Rehearsal screen"
```

---

### Task 10: Recording screen

**Files:**
- Modify: `js/app.js`
- Modify: `css/styles.css`

**Step 1: Add countdown, recorder wiring, and the Recording screen**

Append to `js/app.js`:

```js
import { Recorder } from './recorder.js';

let recorder = null;
let recordingStartTime = null;
let timerIntervalId = null;
let recordedBlob = null;

async function renderCountdown() {
  app.innerHTML = `<div class="screen screen--countdown"><span id="count">3</span></div>`;
  const countEl = document.getElementById('count');
  for (const n of [3, 2, 1]) {
    countEl.textContent = String(n);
    await new Promise((r) => setTimeout(r, 700));
  }
  renderRecording();
}

function renderRecording() {
  app.innerHTML = `
    <div class="screen screen--camera">
      <video id="preview" autoplay playsinline muted></video>
      <div id="teleprompter-mount"></div>
      <div class="timer" id="timer">00:00</div>
      <div class="controls">
        <button id="slower">Медленнее</button>
        <button id="pause-btn" class="record-btn record-btn--recording"></button>
        <button id="faster">Быстрее</button>
      </div>
      <button id="stop-btn" class="stop-btn">Стоп</button>
    </div>
  `;

  document.getElementById('preview').srcObject = cameraStream;
  teleprompter = new Teleprompter(document.getElementById('teleprompter-mount'), settings);
  teleprompter.start();

  recorder = new Recorder(cameraStream);
  recorder.start();
  recordingStartTime = performance.now();
  timerIntervalId = setInterval(updateTimer, 250);

  let paused = false;
  const pauseBtn = document.getElementById('pause-btn');
  if (!recorder.canPause) pauseBtn.disabled = true;
  pauseBtn.addEventListener('click', () => {
    if (!recorder.canPause) return;
    paused = !paused;
    if (paused) { recorder.pause(); teleprompter.stop(); clearInterval(timerIntervalId); }
    else { recorder.resume(); teleprompter.start(); timerIntervalId = setInterval(updateTimer, 250); }
    pauseBtn.classList.toggle('record-btn--paused', paused);
  });

  document.getElementById('slower').addEventListener('click', () => {
    settings = saveSettings(undefined, { speedPxPerSec: clampSpeed(settings.speedPxPerSec - SPEED_STEP) });
    teleprompter.setSpeed(settings.speedPxPerSec);
  });
  document.getElementById('faster').addEventListener('click', () => {
    settings = saveSettings(undefined, { speedPxPerSec: clampSpeed(settings.speedPxPerSec + SPEED_STEP) });
    teleprompter.setSpeed(settings.speedPxPerSec);
  });

  document.getElementById('stop-btn').addEventListener('click', async () => {
    clearInterval(timerIntervalId);
    teleprompter.stop();
    recordedBlob = await recorder.stop();
    renderReview();
  });
}

function updateTimer() {
  const elapsedSec = Math.floor((performance.now() - recordingStartTime) / 1000);
  const mm = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
  const ss = String(elapsedSec % 60).padStart(2, '0');
  document.getElementById('timer').textContent = `${mm}:${ss}`;
}
```

Update the Rehearsal screen's `record-btn` handler (Task 9) to call
`renderCountdown()` instead of the empty stub.

**Step 2: Add countdown/timer/stop styles to `css/styles.css`**

```css
.screen--countdown {
  display: flex; align-items: center; justify-content: center; height: 100%;
}
.screen--countdown #count { font-size: 96px; font-weight: 700; }
.timer {
  position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
  z-index: 20; background: rgba(0,0,0,0.5); padding: 4px 12px; border-radius: 8px;
  font-variant-numeric: tabular-nums;
}
.record-btn--recording { background: #ff5a36; }
.record-btn--paused { background: #666; }
.stop-btn {
  position: absolute; bottom: 110px; left: 50%; transform: translateX(-50%);
  z-index: 20; background: #ff5a36; color: #fff; border: none;
  padding: 10px 20px; border-radius: 20px; font-size: 14px;
}
```

**Step 3: Verify manually**

From Rehearsal, tap record: see 3-2-1 countdown, then recording starts
with a running mm:ss timer. Test pause/resume (if supported on the
device's browser), then tap Стоп — should move to Review (Task 11).

**Step 4: Commit**

```bash
git add js/app.js css/styles.css
git commit -m "feat: add countdown and Recording screen"
```

---

### Task 11: Review screen (keep/retake)

**Files:**
- Modify: `js/app.js`
- Modify: `css/styles.css`

**Step 1: Add the Review screen**

Append to `js/app.js`:

```js
function renderReview() {
  const videoUrl = URL.createObjectURL(recordedBlob);
  app.innerHTML = `
    <div class="screen screen--review">
      <video id="review-video" src="${videoUrl}" controls playsinline></video>
      <div class="review-actions">
        <button id="retake-btn">Переснять</button>
        <a id="keep-btn" class="primary" download="reel-${Date.now()}.${extensionFor(recordedBlob.type)}">Оставить</a>
      </div>
    </div>
  `;

  document.getElementById('keep-btn').href = videoUrl;

  document.getElementById('retake-btn').addEventListener('click', () => {
    URL.revokeObjectURL(videoUrl);
    recordedBlob = null;
    renderRehearsal();
  });
}

function extensionFor(mimeType) {
  return mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
}
```

**Step 2: Add review styles to `css/styles.css`**

```css
.screen--review { position: relative; padding: 0; height: 100%; }
#review-video { width: 100%; height: 100%; object-fit: contain; background: #000; }
.review-actions {
  position: absolute; bottom: 24px; left: 0; right: 0;
  display: flex; gap: 12px; justify-content: center;
}
.review-actions button, .review-actions a {
  padding: 14px 24px; border-radius: 24px; font-size: 16px; text-decoration: none;
  color: #fff; border: none;
}
.review-actions #retake-btn { background: #333; }
.review-actions #keep-btn.primary { background: #ff5a36; }
```

**Step 3: Verify manually**

After stopping a recording: video plays back correctly, "Переснять"
discards it and returns to Rehearsal with the script reset to the
top, "Оставить" downloads/shares the file with a sensible extension.
Confirm on both an Android Chrome and an iOS Safari device — this is
where mp4-vs-webm behavior differs most.

**Step 4: Commit**

```bash
git add js/app.js css/styles.css
git commit -m "feat: add Review screen with keep/retake"
```

---

### Task 12: PWA installability (manifest, service worker, icons)

**Files:**
- Create: `manifest.json`
- Create: `sw.js`
- Create: `icons/icon-192.png`
- Create: `icons/icon-512.png`
- Modify: `js/app.js`

**Step 1: Generate placeholder icons**

Run this once (Node only, not shipped) to produce two solid-color
square PNGs as placeholders — replace with real artwork later:

```bash
node -e "
const zlib = require('zlib');
const fs = require('fs');
function makePng(size, path) {
  const width = size, height = size;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 3 + 1);
    raw[rowStart] = 0; // filter type: none
    for (let x = 0; x < width; x++) {
      const i = rowStart + 1 + x * 3;
      raw[i] = 0xff; raw[i + 1] = 0x5a; raw[i + 2] = 0x36; // #ff5a36
    }
  }
  const idat = zlib.deflateSync(raw);
  function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const typeBuf = Buffer.from(type);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32 ? zlib.crc32(Buffer.concat([typeBuf, data])) : require('zlib').crc32(Buffer.concat([typeBuf, data])));
    return Buffer.concat([len, typeBuf, data, crc]);
  }
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8]=8; ihdr[9]=2; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0;
  const png = Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
  fs.writeFileSync(path, png);
}
fs.mkdirSync('icons', { recursive: true });
makePng(192, 'icons/icon-192.png');
makePng(512, 'icons/icon-512.png');
console.log('icons written');
"
```

If your Node version lacks `zlib.crc32` (added Node 20+), skip the
script and instead export two 192x192 and 512x512 PNGs from any image
tool with the app's accent color `#ff5a36` — content doesn't matter
yet, just valid square PNGs at those two sizes.

**Step 2: Create `manifest.json`**

```json
{
  "name": "Reels Teleprompter",
  "short_name": "Teleprompter",
  "start_url": "./index.html",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0b0b0c",
  "theme_color": "#0b0b0c",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

**Step 3: Create `sw.js` (app-shell caching only)**

```js
// sw.js
const CACHE_NAME = 'reels-teleprompter-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/state.js',
  './js/mime.js',
  './js/scroll.js',
  './js/camera.js',
  './js/recorder.js',
  './js/teleprompter.js',
  './manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached ?? fetch(event.request))
  );
});
```

**Step 4: Register the service worker in `js/app.js`**

Add near the top of `js/app.js`:

```js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js');
  });
}
```

**Step 5: Verify manually**

Serve over HTTPS (or `localhost`, which browsers treat as secure) on
a phone. Confirm: Chrome shows an "Install app" / "Add to Home
Screen" prompt, Safari's Share sheet offers "Add to Home Screen", and
reloading with the network disabled still shows the app shell
(camera/recording still requires connectivity to the device hardware,
not the network — that's expected).

**Step 6: Commit**

```bash
git add manifest.json sw.js icons js/app.js
git commit -m "feat: add PWA manifest, service worker, and icons"
```

---

### Task 13: Full manual QA pass

**Files:** none (verification only)

**Step 1: Run through the spec's testing checklist**

On both an Android Chrome device and an iOS Safari device:

1. Setup: enter a script, adjust speed and font size, reload the page
   — confirm values persisted.
2. Rehearsal: camera preview is mirrored, teleprompter band sits under
   the front camera, text wraps into short lines, слабее/быстрее
   change speed without jumping.
3. Deny camera/mic permission once — confirm the error screen and
   retry flow.
4. Recording: countdown plays, timer counts up, pause/resume works
   where supported (or the button is disabled where not), stop moves
   to Review.
5. Review: video plays back with correct orientation and audio,
   "Переснять" discards and returns to a reset Rehearsal, "Оставить"
   downloads/shares a playable file.
6. Confirm the downloaded file opens and plays outside the browser
   (e.g. in the phone's default video/photos app).
7. Install the PWA to the home screen and relaunch from there — same
   behavior as in-browser.

**Step 2: Log and fix any issues found**

For each issue: note the device/browser, expected vs. actual, fix in
the relevant module, re-run the affected step above, commit.

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: fixes from manual QA pass"
```
