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

function throwingStorage() {
  return {
    getItem: () => { throw new Error('localStorage disabled'); },
    setItem: () => { throw new Error('localStorage disabled'); },
  };
}

test('loadSettings returns defaults when storage.getItem throws', () => {
  const settings = loadSettings(throwingStorage());
  assert.deepEqual(settings, DEFAULT_SETTINGS);
});

test('saveSettings still returns merged settings when storage.setItem throws', () => {
  const settings = saveSettings(throwingStorage(), { script: 'Привет', speedPxPerSec: 40 });
  assert.equal(settings.script, 'Привет');
  assert.equal(settings.speedPxPerSec, 40);
  assert.equal(settings.fontSizePx, DEFAULT_SETTINGS.fontSizePx);
});

test('loadSettings/saveSettings degrade gracefully when accessing globalThis.localStorage itself throws', () => {
  // Simulates restricted embedded browsers where merely touching
  // `localStorage` (not just calling getItem/setItem) throws synchronously.
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() { throw new Error('localStorage access blocked'); },
  });
  try {
    assert.deepEqual(loadSettings(), DEFAULT_SETTINGS);
    const settings = saveSettings(undefined, { script: 'test' });
    assert.equal(settings.script, 'test');
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
});
