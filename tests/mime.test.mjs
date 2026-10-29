import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pickSupportedMimeType, MIME_CANDIDATES } from '../js/mime.js';

test('picks the first candidate the browser supports', () => {
  const isSupported = (type) => type === 'video/webm;codecs=vp9,opus';
  assert.equal(pickSupportedMimeType(isSupported), 'video/webm;codecs=vp9,opus');
});

test('falls back through the candidate list in order', () => {
  const isSupported = (type) => type === MIME_CANDIDATES[MIME_CANDIDATES.length - 1];
  assert.equal(pickSupportedMimeType(isSupported), MIME_CANDIDATES[MIME_CANDIDATES.length - 1]);
});

test('returns null when nothing is supported', () => {
  assert.equal(pickSupportedMimeType(() => false), null);
});
