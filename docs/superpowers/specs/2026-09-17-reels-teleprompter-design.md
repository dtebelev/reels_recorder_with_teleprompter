# Reels Recorder with Teleprompter — Design

## Purpose

A mobile-first PWA that lets a solo creator record vertical (9:16) video
on their phone while reading a scrolling teleprompter script overlaid
on the camera preview. Fully offline-capable, no backend.

## Platform & constraints

- Runs entirely client-side: `getUserMedia`, `MediaRecorder`, Canvas/CSS
  for the teleprompter overlay.
- Installable PWA via `manifest.json` + service worker (offline shell
  caching — camera/recording always require a live session, so the SW
  only needs to cache the app shell, not media).
- Must work on both iOS Safari and Android Chrome. iOS Safari has a
  narrower `MediaRecorder` mime-type support and partial
  pause/resume support — feature-detect, don't assume.
- No server, no accounts, no analytics.

## Screens (single page, three states)

1. **Setup** — textarea for the script, speed control, font size
   control.
2. **Rehearsal** — camera preview (mirrored, front camera), script
   scrolling over it at the chosen speed. No recording. Speed can be
   adjusted live with the same slower/faster controls.
3. **Recording** — same overlay as rehearsal, plus: 3-2-1 countdown on
   entry, recording timer (mm:ss) at top, record/pause/stop control
   centered at bottom, slower/faster on either side (matches reference
   layout). On stop, produces a downloadable video file.

State transitions: Setup → Rehearsal (test button) → Recording (record
button) → Setup (after download, to record another take) or back to
Rehearsal.

## Components

- **Camera** — acquires front-facing camera + mic stream
  (`facingMode: 'user'`), renders full-bleed `<video>` mirrored via
  CSS `scaleX(-1)` for preview only (the recorded stream is not
  flipped). Handles permission-denied with a retry affordance.
- **Teleprompter** — text overlay, auto-scrolls via
  `requestAnimationFrame` at a configurable px/sec rate. Edge
  gradients (top/bottom) for readability. Font size and scroll speed
  both persisted to `localStorage` so they survive reloads.
- **Recorder** — wraps `MediaRecorder` on the camera+mic stream.
  Picks the first supported mime type from a preference list (mp4 →
  webm) via `MediaRecorder.isTypeSupported`. Collects chunks, exposes
  start/pause/resume/stop, and on stop assembles a `Blob` + object URL
  for `<a download>`. Pause/resume control is hidden if unsupported.
- **Controls** — slower / record-pause-stop / faster, positioned per
  reference image; behavior differs slightly by state (rehearsal:
  no record button becomes "start recording"; recording: center
  button is pause/resume, plus a separate stop).

## Data flow

Script text + speed + font size live in in-memory state, mirrored to
`localStorage`. Camera stream is acquired once and reused across
rehearsal → recording (no re-prompting for permission). Recorded
`Blob` never leaves the device — user saves it via the browser's
native download/share flow.

## Error handling

- Camera/mic permission denied or no camera available → full-screen
  message with explanation + retry button.
- `MediaRecorder` unsupported entirely (very old browser) → message
  telling the user to update their browser; rehearsal still works.
- Recording stop with zero data collected → skip download prompt,
  show a small inline warning instead of offering an empty file.

## Testing

Manual, on-device: rehearsal flow without recording, full record →
stop → download flow, permission-denial path, and speed/font-size
adjustments while scrolling — checked on both an Android Chrome and
an iOS Safari device.
