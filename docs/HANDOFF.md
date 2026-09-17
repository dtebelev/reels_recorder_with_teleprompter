# Handoff — Reels Recorder with Teleprompter

Written for: the next Claude session/agent picking up this project cold.

## What this project is

A no-build, offline-capable PWA (vanilla HTML/CSS/JS, ES modules, zero
dependencies) that lets someone record vertical (9:16) selfie video on
their phone while reading a teleprompter script positioned so it
doesn't look like they're reading on camera. After recording, they
review the take and choose Keep (download) or Retake.

Key docs (read these first, in order):
1. `docs/superpowers/specs/2026-09-17-reels-teleprompter-design.md` — the design spec, includes a "Research: avoiding the reading look" section explaining WHY the teleprompter is laid out the way it is (narrow band near the camera, short lines, fixed read-line marker). Don't undo this layout without re-reading that reasoning.
2. `docs/plans/2026-09-17-reels-teleprompter-implementation.md` — the 13-task implementation plan. Tasks 1-12 are done; Task 13 (manual on-device QA) is NOT done.
3. This file.

## Status: on-device QA in progress (started 2026-09-17)

All 12 implementation tasks are built, committed, and each passed a
two-stage review (spec compliance, then code quality) via the
subagent-driven-development workflow. A final whole-system review also
ran and its findings were fixed.

**On-device testing (real iPhone, over a localtunnel HTTPS tunnel) has
started and found real bugs — three of which are fixed, three more are
open and described below in "Open bugs from live device QA" — read
that section before doing anything else.** `node --test
tests/*.test.mjs` passes (11 tests).

### How the live testing session worked (for next time)

`getUserMedia` requires a secure context, so a phone can't just hit
this machine's LAN IP over plain HTTP. The working setup was:

```bash
cd "E:\REELS RECORDER with TELEPROMPTER"
npx --yes serve . -l 3000              # run in background, keep alive
npx --yes localtunnel --port 3000      # run in background, keep alive; prints an https://*.loca.lt URL
```

Open the printed `https://*.loca.lt` URL on the phone. The **first
visit** to a `loca.lt` URL shows an interstitial page asking for a
"password" — that's actually the tunneling machine's public IP. Get it
with `curl -s https://loca.lt/mytunnelpassword`. The free localtunnel
service is flaky — connections randomly return 502/408 and need a
restart. Wrapping it in `while true; do npx --yes localtunnel --port
3000; sleep 2; done` makes it auto-restart, but note **each restart
gets a new random subdomain** (URL changes) unless you pass
`--subdomain <fixed-name>` — even then, a fixed subdomain sometimes
came back 502 for a while and a random one had to be used instead.
Always re-verify the current URL with `curl -s -o /dev/null -w
"%{http_code}" <url>/` before handing it to the user — don't assume a
previously-given URL is still live.

Background bash processes in this harness get killed if you wrap them
in a compound command that itself finishes (e.g. `cmd & sleep 2; cat
log`) — the wrapping shell exiting tears down its children. Launch
`serve`/`localtunnel` as their own standalone background command with
nothing else in the same call, then poll their log file separately.

## How this was built (process, in case you continue the same way)

- Workflow: brainstorming skill → design spec → writing-plans skill →
  subagent-driven-development skill (this session acted as
  orchestrator: dispatched one fresh subagent per task, always with
  two review passes — spec-compliance reviewer, then code-quality
  reviewer — before moving to the next task; issues found were sent
  back to the same implementer subagent to fix, then re-reviewed).
- Model choice was deliberately mixed to save cost: cheap model
  (haiku) for trivial/mechanical tasks (scaffolding, simple spec
  reviews), mid-tier (sonnet) for most implementation and quality
  review, opus for the highest-complexity integration work (Tasks
  9-10: Rehearsal+Recording screens; the final whole-system review).
  This was an explicit user request — see memory file
  `feedback_orchestration_model_choice.md`.
- Every commit ends with `Co-Authored-By: Claude Sonnet 5
  <noreply@anthropic.com>`. Watch out: subagents sometimes write their
  own model name there instead (e.g. "Claude Haiku 4.5") — this
  happened once (first 4 commits) and was fixed with `git filter-branch
  --msg-filter` since those commits were still unpushed/local. Check
  attribution on any new commits a subagent makes.
- Two memory files exist for future sessions at
  `C:\Users\dtebe\.claude\projects\e--REELS-RECORDER-with-TELEPROMPTER\memory\`:
  `feedback_orchestration_model_choice.md` and
  `project_reels_teleprompter_pwa.md` (indexed in that folder's
  `MEMORY.md`).

## File layout (all present and working)

```
index.html
css/styles.css
js/state.js         settings persistence (localStorage, DI'd, now with try/catch degrade-gracefully)
js/mime.js           MediaRecorder mime-type picker (mp4 -> webm fallback)
js/scroll.js          pure scroll-offset math + speed clamping
js/camera.js         getUserMedia wrapper (front camera + mic)
js/recorder.js        MediaRecorder wrapper (start/pause/resume/stop -> Blob)
js/teleprompter.js    RAF-driven scrolling text overlay, eye-contact layout
js/app.js             screen orchestration: Setup -> Rehearsal -> Countdown -> Recording -> Review
manifest.json / sw.js / icons/*.png    PWA installability (icons are solid-color placeholders, replace with real art later)
tests/*.test.mjs      plain node:test unit tests for state/mime/scroll (10 tests, run: node --test tests/*.test.mjs)
```

## Bugs found and fixed during live device QA (2026-09-17)

1. **Record button on Rehearsal screen was invisible.** `.controls button { background: none; border: none; ... }` in `css/styles.css` was *more specific* than `.record-btn { background: #ff5a36; ... }` (element+class beats class-only), so the circular record button rendered with no background/border — technically present and tappable, but invisible against the black camera feed. Same bug hit the pause/record button on the Recording screen (`.record-btn--recording`/`--paused`). **Fix:** rescoped the colored-button rules to `.controls .record-btn`, `.controls .record-btn--recording`, `.controls .record-btn--paused` (two classes = higher specificity, wins reliably). If you add more buttons inside `.controls` later, watch for this same specificity trap.
2. **Total black screen, nothing rendered at all (not even Setup).** Root cause: `js/state.js`'s `loadSettings`/`saveSettings` had `storage = globalThis.localStorage` as a *default parameter value*. Default-parameter expressions run outside the function's own `try/catch`, so if merely *accessing* `globalThis.localStorage` throws (happens in some restricted embedded/webview browsers, not just "storage disabled" iOS Safari cases already handled) the exception was uncaught and propagated out of `let settings = loadSettings();` at module-eval time in `js/app.js` — aborting the entire module graph before `renderSetup()` ever ran. Since `css/styles.css` sets `background:#000` independent of JS, the result was a pure black screen with zero DOM content. **Fix:** replaced the default-parameter access with a `resolveStorage()` helper that wraps the `globalThis.localStorage` access itself in try/catch. Covered by a new test in `tests/state.test.mjs` that stubs a throwing `localStorage` getter.
3. Also added, as a permanent diagnostic aid (kept in `index.html`, not removed): a `window.addEventListener('error'/'unhandledrejection', ...)` handler that renders any future uncaught error as visible red text in `#app` instead of a silent black screen. **Consider removing this before a real production release** — it's meant for QA/debugging with a non-technical remote tester who can't access devtools, not for end users.
4. Bumped `sw.js`'s `CACHE_NAME` to `v2` (from `v1`) as a precaution, so any previously-installed service worker discards its old cache on next activate.

Feature requests added during the same session (not bugs, but real product asks — already implemented):
- **6-second delay before the teleprompter starts scrolling**, both in Rehearsal and Recording, so the reader has time to get ready (`TELEPROMPTER_START_DELAY_MS` in `js/app.js`, implemented as `Teleprompter.start(delayMs)`).
- **Drag-to-scrub the teleprompter text with a finger** (touch/pointer drag on the teleprompter band repositions the text, clamped so it can't go before the start; releasing resumes auto-scroll from wherever it was left). Implemented entirely inside `js/teleprompter.js` via Pointer Events on the teleprompter's own container — see `#attachDragHandlers()`.

## Second round of live-QA fixes (2026-09-17, later same day)

All three items from the previous round were addressed, plus a control-layout redesign and a WYSIWYG recording fix requested after watching a real recorded take. **None of this has been re-tested on device yet** — that's the next step, and given the black-video bug's root cause was never confirmed, treat the video-related fix below as a best-effort guess, not a confirmed solution.

1. **Save-to-Photos (was: saves to Files/Drive).** `renderReview()` now tries `navigator.share({ files: [file] })` first when `navigator.canShare({ files: [...] })` returns true (real capability check, not just feature-sniffing `share` existing) — this opens iOS's native share sheet, whose "Save Video" option saves to Photos. Falls back to the original `<a download>` behavior when share-with-files isn't supported (most desktops), and falls back again to a forced `<a>`-click download if `share()` itself rejects with something other than `AbortError` (user cancelling the sheet is not an error). **Not yet verified on-device that the share sheet actually appears/works correctly.**
2. **Timer overlapping the teleprompter band, PLUS a full control-layout redesign to match the iPhone Camera app**, per reference screenshots the user provided: before recording, one big central button (unchanged, already existed as `.record-btn` in Rehearsal); once recording starts, the layout is now **Pause (left) + Stop (center, a small red square inside a dark circle)** — no more separate "Стоп" text pill, no more slower/faster buttons on the Recording screen (speed can still be adjusted beforehand, in Rehearsal — dropped from Recording to match the simpler reference layout). The timer moved to `.status-topright` (top-right corner, `position:absolute; top:12px; right:12px`), clear of the teleprompter's top band, with a red "ПАУЗА" pill that appears directly below it (`#paused-label`) when paused, and the timer itself dims (`.timer--paused`) — modeled directly on the reference screenshots' paused state. See `renderRecording()` in `js/app.js` and the `.status-topright`/`.controls--recording`/`.pause-btn`/`.stop-circle-btn` rules in `css/styles.css`.
3. **Black video on playback — root cause NOT confirmed, applied two speculative mitigations:** (a) added `preload="auto"` to `#review-video` and a `loadedmetadata` handler that nudges `video.currentTime = 0.01` once, a known workaround for mobile browsers that show a black frame until the video is "nudged" past its first keyframe; (b) see the WYSIWYG rewrite below, which changes what's actually recorded (was: raw camera track; now: a canvas-drawn copy) — if the black-video bug was actually caused by something specific to the old MediaRecorder-direct-from-camera-track path, this rewrite may have incidentally fixed or changed it. **This needs to be re-tested from scratch; don't assume it's fixed.**

### WYSIWYG recording rewrite (new user request, same session)

After watching an actual recorded take, the user reported the final video looked "completely different" from what was shown on screen while recording. Two real causes: (1) the live preview was mirrored via CSS (`transform: scaleX(-1)` on the `<video>`) but the recorded stream came straight from the unmirrored camera track, so mirroring never made it into the saved file; (2) `object-fit: cover` on the preview crops the live view to fill the screen, but the recorded stream used the camera's raw (uncropped) frame, so framing could differ too.

**Fix:** `js/camera.js` gained `mirrorToCanvas(sourceStream, canvas)` — continuously draws the camera feed onto a `<canvas>`, mirrored and cropped to match the canvas's actual on-screen pixel size (replicating `object-fit: cover`'s crop math manually), and returns `{ stream, stop() }` where `stream` is `canvas.captureStream(30)` plus the original audio track(s). Both `renderRehearsal()` and `renderRecording()` in `js/app.js` now use a `<canvas id="preview">` instead of a `<video>`, driven by this helper (`mirrorPreview` module-level variable, torn down via `stopMirrorPreview()` at every screen transition that previously stopped the teleprompter/camera — mirror the existing cleanup call sites if you add new transitions). Critically, **recording now happens from `mirrorPreview.stream`, not the raw `cameraStream`** — so the saved file is pixel-identical to what was on screen. The hidden `<video>` `mirrorToCanvas` creates internally to source frames from the raw stream is appended off-screen (not detached) because some mobile browsers won't decode a detached video element.

**Things to verify on next device test, specifically because of this rewrite:**
- Does `canvas.captureStream()` work reliably on the target iOS Safari version? (Supported since iOS 14.3, should be fine, but hasn't been confirmed live.)
- Performance: this now runs a `requestAnimationFrame` draw loop **and** a separate teleprompter `requestAnimationFrame` loop simultaneously during recording — watch for dropped frames/battery impact on an older device.
- Does audio still stay in sync with video, since audio now flows through `canvasStream.addTrack()` from the original stream rather than being part of the same original track set MediaRecorder used before?
- Orientation/rotation metadata: recording from a canvas produces a "vanilla" video with no camera rotation metadata quirks — worth checking this didn't change portrait/landscape behavior.

## Known deferred issues (found in final review, deliberately NOT fixed — see conversation/commit 6396bce for what WAS fixed)

These were explicitly scoped out as trade-offs or lower priority. Revisit if they cause real problems during device QA:

1. **Camera stream is stopped when entering Review and re-acquired on Retake** (rather than kept alive per the spec's literal "acquired once, reused" data-flow wording). Deliberate: avoids leaving the camera light on during Review. Costs a brief `getUserMedia` re-prompt-free reacquisition on Retake (should not re-trigger a permission dialog since it was already granted, but adds latency). If this feels slow/wrong on a real device, consider keeping the stream alive from Rehearsal through Review instead.
2. **MediaRecorder-unsupported detection happens after the 3-2-1 countdown**, not before. On an unsupported browser the user sits through the countdown before seeing the error. Should ideally probe support when entering Rehearsal instead.
3. **Countdown screen replaces the camera preview** with a plain black number screen (2.1s) rather than overlaying the countdown on top of the live camera. Spec doesn't explicitly require an overlay, but it's a bigger UX change than was in scope for this pass.
4. **`Recorder.canPause` is nearly always `true`** in real browsers (feature-detects `typeof pause === 'function'`, which basically every browser has) — it can't actually detect the iOS quality problems it was meant to guard against. Not fixable via feature detection; flag it during iOS QA if pause/resume produces a broken file.
5. **Untracked files at repo root**: `Screenshot 2026-09-17 133645.png` and `.agents/` (this is the skills directory the user pointed at — deliberately not gitignored, it's tooling not app code) — nobody has decided whether to add `.gitignore` entries or delete the screenshot. Ask the user.

## What's left (in priority order)

0. **Fix the three open bugs in "Open bugs from live device QA" above** (Photos save target, timer overlap, black video playback). These came directly from the user testing on their own iPhone and are the immediate next task.
1. **Continue Task 13 — manual on-device QA.** It's in progress (see above), not done. Keep following the checklist in the plan's Task 13 section. The final whole-implementation review flagged these as the highest-risk things to check specifically:
   - **iOS Safari `<a download>` on a blob URL** — Safari has historically ignored `download` and navigated to the video instead, which inside an installed PWA could strand the user with no back button. Test "Оставить" on iOS first; if broken, fall back to `navigator.share({ files: [...] })`.
   - **Pause → resume → stop file integrity on iOS** — confirm the saved file actually plays correctly past the pause point (audio/video still in sync) in the phone's native player, not just the in-app preview.
   - **The eye-contact layout on a real phone with a notch/Dynamic Island** — the teleprompter band is `20vh` from the top with no `env(safe-area-inset-top)` handling; the "read here" marker (the whole point of the app) could sit under the notch. Check on a notched device specifically.
   - **Recorded video orientation/aspect** — confirm actual output is 9:16 portrait, not rotated.
   - Offline relaunch after installing to home screen (service worker).
2. Once real device issues surface, fix them (likely small, targeted changes — the codebase is small and modular).
3. Decide what to do with the two untracked files (see above).
4. Consider addressing the deferred issues list above if they turn out to matter in practice.
5. Eventually replace the placeholder icons with real artwork.

## Quick start for a new session

```bash
cd "E:\REELS RECORDER with TELEPROMPTER"
node --test tests/*.test.mjs   # confirm unit tests still pass
npx serve .                     # or: python -m http.server
# open the printed URL on a phone on the same network, or desktop Chrome with a webcam
```
