// js/mime.js
// Order matters: prefer mp4 (widely shareable, native on newer iOS),
// fall back to webm variants for browsers that only support that.
export const MIME_CANDIDATES = [
  // Spelling the codecs out explicitly (H.264 baseline + AAC) first: bare
  // "video/mp4" leaves the choice to the browser, and on iOS that has been
  // a source of oddly-encoded output that other players struggle with.
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

export function pickSupportedMimeType(isSupported) {
  return MIME_CANDIDATES.find((type) => isSupported(type)) ?? null;
}
