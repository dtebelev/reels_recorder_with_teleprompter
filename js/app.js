// js/app.js
import { loadSettings, saveSettings } from './state.js';
import { clampSpeed, SPEED_STEP } from './scroll.js';
import { CameraError, acquireFrontCameraStream, stopStream } from './camera.js';
import { Teleprompter } from './teleprompter.js';
import { Recorder } from './recorder.js';
import { startSession, logEvent, getReport } from './diagnostics.js';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js');
  });
}

const app = document.getElementById('app');
let settings = loadSettings();

let cameraStream = null;
let teleprompter = null;
let wakeLock = null;

/** Prevents the screen from dimming/locking. Without this, iOS suspends
 * the camera (video freezes, audio keeps recording — the exact bug this
 * fixes) if the person doesn't touch the screen for a while, e.g. while
 * quietly reading the teleprompter. Requires a secure context and user
 * activation to acquire, both already true by the time this is called. */
async function acquireWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        wakeLock = null;
      });
    }
  } catch {
    // Not available/denied on this browser — recording still proceeds,
    // just without the screen-stays-on guarantee.
    wakeLock = null;
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
}

// The browser auto-releases the wake lock whenever the tab is hidden (e.g.
// briefly during the native share sheet) and never re-acquires it on its
// own — do that ourselves so a locked screen doesn't creep back in mid-flow.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && cameraStream && wakeLock === null) {
    acquireWakeLock();
  }
});

let recorder = null;
let recordingStartTime = null; // start of the current (unpaused) segment, or null while paused
let elapsedBeforePauseMs = 0; // recorded duration accumulated over previous segments
let timerIntervalId = null;
let recordedBlob = null;

const FONT_SIZE_STEP_PX = 1;
const MIN_FONT_SIZE_PX = 16;
const MAX_FONT_SIZE_PX = 72;

const TELEPROMPTER_START_DELAY_MS = 6000; // time to get ready before the script starts scrolling
const RECORDER_STOP_TIMEOUT_MS = 8000; // safety net if MediaRecorder.stop() never resolves

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
    const next = Math.max(MIN_FONT_SIZE_PX, settings.fontSizePx - FONT_SIZE_STEP_PX);
    settings = saveSettings(undefined, { fontSizePx: next });
    document.getElementById('font-value').textContent = settings.fontSizePx;
  });
  document.getElementById('font-up').addEventListener('click', () => {
    const next = Math.min(MAX_FONT_SIZE_PX, settings.fontSizePx + FONT_SIZE_STEP_PX);
    settings = saveSettings(undefined, { fontSizePx: next });
    document.getElementById('font-value').textContent = settings.fontSizePx;
  });

  document.getElementById('rehearse-btn').addEventListener('click', () => {
    renderRehearsal();
  });
}

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
  acquireWakeLock();

  document.getElementById('preview').srcObject = cameraStream;

  teleprompter = new Teleprompter(document.getElementById('teleprompter-mount'), settings);
  teleprompter.start(TELEPROMPTER_START_DELAY_MS);

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
    releaseWakeLock();
    stopStream(cameraStream);
    renderSetup();
  });
  document.getElementById('record-btn').addEventListener('click', () => {
    // Stop the rehearsal RAF loop before the countdown replaces the DOM;
    // renderRecording() builds a fresh Teleprompter for the take
    // (cameraStream itself stays alive and is reused).
    teleprompter.stop();
    renderCountdown();
  });
}

function renderCameraError(err) {
  app.innerHTML = `
    <div class="screen screen--error">
      <p>Не удалось получить доступ к камере/микрофону.</p>
      <p class="error-detail">${escapeHtml(err instanceof CameraError ? err.cause?.message ?? '' : String(err))}</p>
      <button id="retry-btn" class="primary">Повторить</button>
    </div>
  `;
  document.getElementById('retry-btn').addEventListener('click', renderRehearsal);
}

function renderRecorderError(err) {
  app.innerHTML = `
    <div class="screen screen--error">
      <p>Запись видео не поддерживается в этом браузере.</p>
      <p class="error-detail">${escapeHtml(err?.message ?? String(err))}</p>
      <button id="back-to-setup-btn" class="primary">← Настройки</button>
    </div>
  `;
  document.getElementById('back-to-setup-btn').addEventListener('click', renderSetup);
}

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
      <div class="status-topright">
        <div class="timer" id="timer">00:00</div>
        <div class="paused-label" id="paused-label" hidden>ПАУЗА</div>
      </div>
      <div class="controls controls--recording">
        <button id="pause-btn" class="pause-btn" aria-label="Пауза"></button>
        <button id="stop-btn" class="stop-circle-btn" aria-label="Стоп"><span class="stop-circle-btn__icon"></span></button>
      </div>
    </div>
  `;

  startSession();
  logEvent('wake lock', wakeLock ? 'активен' : 'недоступен');

  document.getElementById('preview').srcObject = cameraStream;
  teleprompter = new Teleprompter(document.getElementById('teleprompter-mount'), settings);
  teleprompter.start(TELEPROMPTER_START_DELAY_MS);

  try {
    recorder = new Recorder(cameraStream);
    recorder.start();
  } catch (err) {
    // No supported MediaRecorder format (or the recorder refused to start):
    // tear the half-wired screen down instead of leaving a live camera and a
    // scrolling teleprompter with non-functional controls.
    teleprompter.stop();
    releaseWakeLock();
    stopStream(cameraStream);
    cameraStream = null;
    recorder = null;
    renderRecorderError(err);
    return;
  }
  elapsedBeforePauseMs = 0;
  recordingStartTime = performance.now();
  timerIntervalId = setInterval(updateTimer, 250);

  let paused = false;
  let stopping = false;
  const pauseBtn = document.getElementById('pause-btn');
  if (!recorder.canPause) pauseBtn.disabled = true;
  const pausedLabel = document.getElementById('paused-label');
  const timerEl = document.getElementById('timer');
  pauseBtn.addEventListener('click', () => {
    if (!recorder.canPause || stopping) return;
    paused = !paused;
    if (paused) {
      recorder.pause();
      teleprompter.stop();
      clearInterval(timerIntervalId);
      // Fold the finished segment into the accumulator, then repaint once so
      // the frozen display shows the exact paused-at duration.
      elapsedBeforePauseMs = recordedElapsedMs();
      recordingStartTime = null;
      updateTimer();
    } else {
      recorder.resume();
      teleprompter.start();
      recordingStartTime = performance.now();
      timerIntervalId = setInterval(updateTimer, 250);
    }
    pauseBtn.classList.toggle('pause-btn--active', paused);
    pausedLabel.hidden = !paused;
    timerEl.classList.toggle('timer--paused', paused);
  });

  const stopBtn = document.getElementById('stop-btn');
  stopBtn.addEventListener('click', async () => {
    if (stopping) return; // a second tap would stop an already-inactive recorder
    stopping = true;
    stopBtn.disabled = true;
    pauseBtn.disabled = true;
    clearInterval(timerIntervalId);
    teleprompter.stop();
    elapsedBeforePauseMs = recordedElapsedMs();
    recordingStartTime = null;
    recordedBlob = await withTimeout(recorder.stop(), RECORDER_STOP_TIMEOUT_MS).catch(() => null);
    if (recordedBlob) {
      logEvent('файл', await probeBlob(recordedBlob));
    }
    if (!recordedBlob) {
      // recorder.stop() never resolved (or genuinely failed) — don't leave
      // the person stuck on a dead screen forever.
      releaseWakeLock();
      stopStream(cameraStream);
      cameraStream = null;
      renderRecorderError(new Error('Не удалось завершить запись — попробуйте ещё раз.'));
      return;
    }
    renderReview();
  });
}

/** Reads back what actually landed in the recorded file (dimensions and
 * duration), so a broken recording can be told apart from a recording that
 * merely plays back badly. */
function probeBlob(blob) {
  return new Promise((resolve) => {
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.muted = true;
    const url = URL.createObjectURL(blob);
    let settled = false;
    const done = (info) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(`${Math.round(blob.size / 1024)} КБ, ${info}`);
    };
    probe.onloadedmetadata = () => done(`${probe.videoWidth}x${probe.videoHeight}, длительность=${probe.duration}`);
    probe.onerror = () => done('метаданные не читаются');
    setTimeout(() => done('таймаут чтения метаданных'), 3000);
    probe.src = url;
  });
}

/** MediaRecorder output often carries no duration (`Infinity`), which makes
 * `<video>` playback stall partway through while audio keeps going. Seeking
 * far past the end forces the browser to scan the file and work out the real
 * duration, after which normal playback and seeking behave. */
function repairBlobPlayback(video) {
  video.addEventListener('loadedmetadata', () => {
    if (video.duration !== Infinity) return;
    logEvent('починка', 'у файла duration=Infinity, пересчитываю');
    video.currentTime = 1e101;
    video.addEventListener('timeupdate', function onSeeked() {
      video.removeEventListener('timeupdate', onSeeked);
      video.currentTime = 0;
      logEvent('починка завершена', `длительность=${video.duration}`);
    });
  }, { once: true });
}

/** Rejects if `promise` hasn't settled within `ms`, so a hung MediaRecorder
 * can't strand the user on the Recording screen forever. */
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out')), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

/** Recorded duration in ms: finished segments plus the segment in progress. */
function recordedElapsedMs() {
  if (recordingStartTime === null) return elapsedBeforePauseMs;
  return elapsedBeforePauseMs + (performance.now() - recordingStartTime);
}

function updateTimer() {
  const elapsedSec = Math.floor(recordedElapsedMs() / 1000);
  const mm = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
  const ss = String(elapsedSec % 60).padStart(2, '0');
  document.getElementById('timer').textContent = `${mm}:${ss}`;
}

function renderReview() {
  // Review is a dead end for the camera: no further recording happens from
  // here, and Retake re-acquires a fresh stream (and wake lock) via
  // renderRehearsal(). Stop the old stream now so the camera light doesn't
  // stay on unnecessarily.
  releaseWakeLock();
  stopStream(cameraStream);
  cameraStream = null;

  if (!recordedBlob || recordedBlob.size === 0) {
    app.innerHTML = `
      <div class="screen screen--error">
        <p>Запись не удалась: данные не были получены.</p>
        <button id="back-to-rehearsal-btn" class="primary">← Репетиция</button>
      </div>
    `;
    document.getElementById('back-to-rehearsal-btn').addEventListener('click', () => {
      recordedBlob = null;
      renderRehearsal();
    });
    return;
  }

  const filename = `reel-${Date.now()}.${extensionFor(recordedBlob.type)}`;
  const videoUrl = URL.createObjectURL(recordedBlob);
  const shareFile = new File([recordedBlob], filename, { type: recordedBlob.type });
  // Plain <a download> on a blob URL saves into Files/Drive on iOS, not
  // Photos. navigator.share's sheet offers "Save Video" straight to
  // Photos, so prefer it wherever the browser actually supports sharing
  // a file (checked via canShare, not just the presence of share()).
  const canUseShare = typeof navigator.canShare === 'function' && navigator.canShare({ files: [shareFile] });

  app.innerHTML = `
    <div class="screen screen--review">
      <video id="review-video" src="${videoUrl}" controls playsinline preload="auto"></video>
      <div class="review-actions">
        <button id="retake-btn" class="review-btn review-btn--secondary">
          <svg class="review-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
          Переснять
        </button>
        ${canUseShare
          ? `<button id="keep-btn" class="review-btn review-btn--primary">
               <svg class="review-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>
               Оставить
             </button>`
          : `<a id="keep-btn" class="review-btn review-btn--primary" download="${filename}">
               <svg class="review-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>
               Оставить
             </a>`}
      </div>
      <button id="diag-btn" class="diag-btn" aria-label="Диагностика">ⓘ</button>
      <pre id="diag-panel" class="diag-panel" hidden></pre>
    </div>
  `;

  const reviewVideo = document.getElementById('review-video');
  repairBlobPlayback(reviewVideo);

  const diagPanel = document.getElementById('diag-panel');
  document.getElementById('diag-btn').addEventListener('click', () => {
    diagPanel.textContent = getReport();
    diagPanel.hidden = !diagPanel.hidden;
  });

  if (!canUseShare) {
    document.getElementById('keep-btn').href = videoUrl;
  }

  document.getElementById('retake-btn').addEventListener('click', () => {
    URL.revokeObjectURL(videoUrl);
    recordedBlob = null;
    renderRehearsal();
  });

  const returnToSetup = () => {
    URL.revokeObjectURL(videoUrl);
    recordedBlob = null;
    renderSetup();
  };

  document.getElementById('keep-btn').addEventListener('click', (e) => {
    if (!canUseShare) {
      // Let the browser follow the download link (no preventDefault), then
      // once the download has had time to start, clean up and return to
      // Setup for a fresh take, per spec.
      setTimeout(returnToSetup, 500);
      return;
    }
    e.preventDefault();
    navigator.share({ files: [shareFile] }).then(returnToSetup).catch((err) => {
      // AbortError just means the user dismissed the share sheet — let them
      // try again rather than treating it as a failure.
      if (err && err.name === 'AbortError') return;
      // Sharing genuinely failed for some other reason: fall back to a
      // direct download so the take isn't stranded with no way to save it.
      const a = document.createElement('a');
      a.href = videoUrl;
      a.download = filename;
      a.click();
      setTimeout(returnToSetup, 500);
    });
  });
}

function extensionFor(mimeType) {
  return mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

renderSetup();
