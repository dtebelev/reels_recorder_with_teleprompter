// js/state.js
const STORAGE_KEY = 'reels-teleprompter/settings';

export const DEFAULT_SETTINGS = {
  script: '',
  speedPxPerSec: 30,
  fontSizePx: 28,
};

export function loadSettings(storage = globalThis.localStorage) {
  let raw;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    // localStorage disabled/locked-down (e.g. iOS Safari private mode) — degrade gracefully.
    return { ...DEFAULT_SETTINGS };
  }
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
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Persisting failed (disabled storage, quota exceeded, etc.) — keep the
    // app working for this session, just without persistence.
  }
  return next;
}
