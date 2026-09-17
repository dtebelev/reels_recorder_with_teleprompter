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
