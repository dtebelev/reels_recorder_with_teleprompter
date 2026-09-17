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

## Screens (single page, four states)

1. **Setup** — textarea for the script, speed control, font size
   control.
2. **Rehearsal** — camera preview (mirrored, front camera), script
   scrolling over it at the chosen speed. No recording. Speed can be
   adjusted live with the same slower/faster controls.
3. **Recording** — same overlay as rehearsal, plus: 3-2-1 countdown on
   entry, recording timer (mm:ss) at top, record/pause/stop control
   centered at bottom, slower/faster on either side (matches reference
   layout). On stop, moves to Review.
4. **Review** — plays back the just-recorded video full-screen with
   native `<video controls>`. Two actions: **Keep** (triggers the
   download) and **Retake** (discards the blob, resets script scroll
   position to the top, returns to Rehearsal).

State transitions: Setup → Rehearsal (test button) → Recording (record
button) → Review (on stop) → either Keep (download, then back to
Setup for a fresh take) or Retake (discard, back to Rehearsal).

## Components

- **Camera** — acquires front-facing camera + mic stream
  (`facingMode: 'user'`), renders full-bleed `<video>` mirrored via
  CSS `scaleX(-1)` for preview only (the recorded stream is not
  flipped). Handles permission-denied with a retry affordance.
- **Teleprompter** — text overlay pinned to a **narrow band in the top
  ~20% of the screen**, directly under the front camera, rather than
  spanning the full screen. The column is width-constrained (roughly
  60-70% of screen width, centered) so lines wrap short — this is a
  deliberate eye-movement reduction technique, not just a style choice
  (see Research below). A thin "read here" marker sits at the top edge
  of that band; the line currently being spoken scrolls up to and past
  that marker, so the closest-to-camera point is always where the eye
  should be. Auto-scroll via `requestAnimationFrame` at a configurable
  px/sec rate. Font size and scroll speed both persisted to
  `localStorage` so they survive reloads.
- **Recorder** — wraps `MediaRecorder` on the camera+mic stream.
  Picks the first supported mime type from a preference list (mp4 →
  webm) via `MediaRecorder.isTypeSupported`. Collects chunks, exposes
  start/pause/resume/stop, and on stop assembles a `Blob` + object URL,
  handed to the Review screen (download itself happens from there via
  `<a download>`). Pause/resume control is hidden if unsupported.
- **Controls** — slower / record-pause-stop / faster, positioned per
  reference image; behavior differs slightly by state (rehearsal:
  no record button becomes "start recording"; recording: center
  button is pause/resume, plus a separate stop).
- **Review** — `<video controls>` playing the recorded blob, plus
  Keep/Retake buttons.

### Research: avoiding the "reading" look

Sources: [teleprompter.com — How to Use a Teleprompter Without Looking
Like It](https://www.teleprompter.com/blog/how-to-use-a-teleprompter),
[teleprompter.works — vertical video setup
guide](https://teleprompter.works/blog/teleprompter-app-for-ios-guide/),
[FluidPrompter — Reducing Eye
Movement](https://docs.fluidprompter.com/getting-started/reducing-eye-movement/),
[teleprompter.com — How to Keep Eye Contact With the
Camera](https://www.teleprompter.com/blog/how-to-maintain-eye-contact-in-videos)

The visible "reading" look comes from the angle between the viewer's
gaze-on-text and gaze-into-lens. Three findings drive the Teleprompter
component design above:

1. Text placed close to the lens (top of a phone screen, where the
   front camera sits) minimizes that angle versus text centered on
   screen.
2. Short lines (roughly 2-4 words) minimize lateral eye movement,
   which viewers notice more than vertical movement — achieved here by
   constraining the column width rather than by hard-wrapping text
   server-side.
3. The eye should track the line closest to the camera (top of the
   reading band), not a line drifting through the middle of the
   screen — hence the fixed "read here" marker at the top of the band
   instead of a centered scroll.

## Data flow

Script text + speed + font size live in in-memory state, mirrored to
`localStorage`. Camera stream is acquired once and reused across
rehearsal → recording → review (no re-prompting for permission).
Recorded `Blob` never leaves the device: on Retake it's discarded
(`URL.revokeObjectURL`); on Keep the user saves it via the browser's
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
