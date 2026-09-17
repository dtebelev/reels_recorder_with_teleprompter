// js/app.js
import { loadSettings, saveSettings } from './state.js';
import { clampSpeed, SPEED_STEP } from './scroll.js';
import { CameraError, acquireFrontCameraStream, stopStream } from './camera.js';
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
    stopStream(cameraStream);
    renderSetup();
  });
  document.getElementById('record-btn').addEventListener('click', () => {
    // Stop the rehearsal RAF loop before the countdown replaces the DOM;
    // renderRecording() builds a fresh Teleprompter for the take.
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
  teleprompter.start(TELEPROMPTER_START_DELAY_MS);

  try {
    recorder = new Recorder(cameraStream);
    recorder.start();
  } catch (err) {
    // No supported MediaRecorder format (or the recorder refused to start):
    // tear the half-wired screen down instead of leaving a live camera and a
    // scrolling teleprompter with non-functional controls.
    teleprompter.stop();
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

  // Let the browser follow the download link (no preventDefault), then once
  // the download has had time to start, clean up and return to Setup for a
  // fresh take, per spec.
  document.getElementById('keep-btn').addEventListener('click', () => {
    setTimeout(() => {
      URL.revokeObjectURL(videoUrl);
      recordedBlob = null;
      renderSetup();
    }, 500);
  });
}

function extensionFor(mimeType) {
  return mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

renderSetup();
