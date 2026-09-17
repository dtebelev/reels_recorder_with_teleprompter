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
