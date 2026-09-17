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
