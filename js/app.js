// js/app.js
import { loadSettings, saveSettings } from './state.js';
import { clampSpeed, SPEED_STEP } from './scroll.js';
import { CameraError, acquireFrontCameraStream, stopStream } from './camera.js';
import { Teleprompter } from './teleprompter.js';

const app = document.getElementById('app');
let settings = loadSettings();

let cameraStream = null;
let teleprompter = null;

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

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

renderSetup();
