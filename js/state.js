// js/state.js
const STORAGE_KEY = 'reels-teleprompter/settings';

export const DEFAULT_SETTINGS = {
  script: '',
  speedPxPerSec: 30,
  fontSizePx: 28,
};

// Merely *accessing* globalThis.localStorage can throw in some restricted
// contexts (certain in-app/webview browsers, strict privacy settings) —
// not just calling getItem/setItem on it. Resolving it here, inside a
// try/catch, means that failure can't escape as an uncaught error from a
// default-parameter expression (which would otherwise run outside any
// try/catch in the caller).
function resolveStorage(storage) {
  if (storage !== undefined) return storage;
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function loadSettings(storage) {
  storage = resolveStorage(storage);
  if (!storage) return { ...DEFAULT_SETTINGS };

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

export function saveSettings(storage, partial) {
  storage = resolveStorage(storage);
  const current = loadSettings(storage);
  const next = { ...current, ...partial };
  if (storage) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Persisting failed (disabled storage, quota exceeded, etc.) — keep the
      // app working for this session, just without persistence.
    }
  }
  return next;
}
