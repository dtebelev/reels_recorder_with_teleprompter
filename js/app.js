// js/app.js
import { loadSettings, saveSettings } from './state.js';
import { clampSpeed, SPEED_STEP } from './scroll.js';
import { CameraError, acquireFrontCameraStream, stopStream, mirrorToCanvas } from './camera.js';
import { Teleprompter } from './teleprompter.js';
import { Recorder } from './recorder.js';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js');
  });
}

const app = document.getElementById('app');
let settings = loadSettings();

let cameraStream = null;
let teleprompter = null;
let mirrorPreview = null; // canvas-based mirrored preview; its .stream is what actually gets recorded

function stopMirrorPreview() {
  if (mirrorPreview) {
    mirrorPreview.stop();
    mirrorPreview = null;
  }
}

let recorder = null;
let recordingStartTime = null; // start of the current (unpaused) segment, or null while paused
let elapsedBeforePauseMs = 0; // recorded duration accumulated over previous segments
let timerIntervalId = null;
let recordedBlob = null;

const TELEPROMPTER_START_DELAY_MS = 6000; // time to get ready before the script starts scrolling

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
    renderRehearsal();
  });
}

async function renderRehearsal() {
  app.innerHTML = `
    <div class="screen screen--camera">
      <canvas id="preview"></canvas>
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

  mirrorPreview = mirrorToCanvas(cameraStream, document.getElementById('preview'));

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
    stopMirrorPreview();
    stopStream(cameraStream);
    renderSetup();
  });
  document.getElementById('record-btn').addEventListener('click', () => {
    // Stop the rehearsal RAF loops before the countdown replaces the DOM;
    // renderRecording() builds a fresh Teleprompter and mirror preview for
    // the take (cameraStream itself stays alive and is reused).
    teleprompter.stop();
    stopMirrorPreview();
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
      <canvas id="preview"></canvas>
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

  mirrorPreview = mirrorToCanvas(cameraStream, document.getElementById('preview'));
  teleprompter = new Teleprompter(document.getElementById('teleprompter-mount'), settings);
  teleprompter.start(TELEPROMPTER_START_DELAY_MS);

  try {
    // Record from the exact same mirrored/cropped stream shown on screen,
    // not the raw camera track, so the saved file matches what was framed.
    recorder = new Recorder(mirrorPreview.stream);
    recorder.start();
  } catch (err) {
    // No supported MediaRecorder format (or the recorder refused to start):
    // tear the half-wired screen down instead of leaving a live camera and a
    // scrolling teleprompter with non-functional controls.
    teleprompter.stop();
    stopMirrorPreview();
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
    stopMirrorPreview();
    elapsedBeforePauseMs = recordedElapsedMs();
    recordingStartTime = null;
    recordedBlob = await recorder.stop();
    renderReview();
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
  // here, and Retake re-acquires a fresh stream via renderRehearsal(). Stop
  // the old stream now so the camera light doesn't stay on unnecessarily.
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
    </div>
  `;

  // Some mobile browsers show a black frame until the video is nudged once
  // metadata is known — forcing a tiny seek makes the first real frame paint.
  const reviewVideo = document.getElementById('review-video');
  reviewVideo.addEventListener('loadedmetadata', () => {
    try { reviewVideo.currentTime = 0.01; } catch { /* ignore */ }
  }, { once: true });

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
