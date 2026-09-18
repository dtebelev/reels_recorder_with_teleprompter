// js/diagnostics.js
// A tiny in-app event log, surfaced on the Review screen. Exists because
// this project is being debugged against a physical iPhone with no access
// to a browser console — several rounds of blind guesses at a
// "video freezes mid-recording, audio keeps going" bug failed, so the app
// now reports what actually happened instead.
const events = [];

export function startSession() {
  events.length = 0;
  logEvent('старт');
}

export function logEvent(name, detail = '') {
  events.push({ t: Date.now(), name, detail: String(detail) });
}

/** Human-readable log, each line stamped with seconds since session start. */
export function getReport() {
  if (events.length === 0) return 'нет данных';
  const t0 = events[0].t;
  return events
    .map((e) => `+${((e.t - t0) / 1000).toFixed(1)}s  ${e.name}${e.detail ? ': ' + e.detail : ''}`)
    .join('\n');
}
