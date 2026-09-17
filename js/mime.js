// js/mime.js
// Order matters: prefer mp4 (widely shareable, native on newer iOS),
// fall back to webm variants for browsers that only support that.
export const MIME_CANDIDATES = [
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

export function pickSupportedMimeType(isSupported) {
  return MIME_CANDIDATES.find((type) => isSupported(type)) ?? null;
}
