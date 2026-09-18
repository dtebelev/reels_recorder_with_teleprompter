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

### How to test on a real device (current method — use this, not localtunnel)

The first live-QA round used a `localtunnel` HTTPS tunnel to a local
`serve` process. **It was replaced the same day** because the free
tunnel service was too flaky (random 502/408s, URL changes on every
restart). The project is now on GitHub and deployed to Vercel instead:

- Repo: https://github.com/dtebelev/reels_recorder_with_teleprompter
- Stable production URL: **https://reels-recorder-teleprompter.vercel.app**
- Vercel project is already linked to the GitHub repo (via `vercel`
  CLI, logged in as `dtebelev-3136`) — **pushing to `main` auto-deploys**.
  So the workflow going forward is just:

  ```bash
  cd "E:\REELS RECORDER with TELEPROMPTER"
  git add -A
  git commit -m "..."
  git push
  # wait ~10-20s, then have the user reload
  # https://reels-recorder-teleprompter.vercel.app on their phone
  ```

- To force a specific deploy without waiting on the git-push webhook
  (e.g. to test uncommitted changes), run `npx --yes vercel --prod
  --yes` from the project directory — it deploys the current working
  directory regardless of git state and prints a URL; the previous
  first-time run needed `--name reels-recorder-teleprompter` because
  the folder name itself (`REELS RECORDER with TELEPROMPTER`, spaces
  and capitals) isn't a valid Vercel project name, but the project now
  already exists so that shouldn't be needed again.
- `.agents/` (the local skills directory) and any `Screenshot*.png`
  files at the repo root are gitignored — they're local tooling/scratch
  files, not app code, and shouldn't be pushed.

If you ever do need the old tunnel approach again (e.g. no internet
access to push): `npx --yes serve . -l 3000` +
`npx --yes localtunnel --port 3000` as separate standalone background
commands (not chained with `sleep`/`cat` in the same call — a wrapping
shell exiting kills its backgrounded children in this harness). The
tunnel's first-visit interstitial "password" is the host's public IP,
gettable via `curl -s https://loca.lt/mytunnelpassword`.

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
js/state.js         settings persistence (localStorage, DI'd, try/catch degrade-gracefully)
js/mime.js           MediaRecorder mime-type picker (mp4 -> webm fallback)
js/scroll.js          pure scroll-offset math + speed clamping
js/camera.js         getUserMedia wrapper (front camera + mic) + QUALITY_PROFILES
js/recorder.js        MediaRecorder wrapper (start/pause/resume/stop -> Blob) + diagnostics logging
js/teleprompter.js    RAF-driven scrolling text overlay, eye-contact layout, drag-to-scrub
js/diagnostics.js     in-app event log, surfaced via the Review screen's ⓘ chip — a permanent debugging aid, not temporary
js/app.js             screen orchestration: Setup -> Rehearsal -> Countdown -> Recording -> Review
manifest.json / sw.js / icons/*.png    PWA installability, installable to home screen; icons are real (see tools/make-icons.py), not placeholders
tools/make-icons.py   regenerates icons/*.png from code (Pillow) — edit the concept function and rerun rather than hand-editing PNGs
tests/*.test.mjs      plain node:test unit tests for state/mime/scroll (11 tests, run: node --test tests/*.test.mjs)
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

## Third round of live-QA fixes (2026-09-17, GitHub/Vercel era)

By this point the project had moved to GitHub + Vercel auto-deploy (see
above) instead of localtunnel — much more stable for iterating.

1. **Review screen redesign.** The two action buttons (Переснять / Оставить) were visually mismatched — one a small dark rectangle, one a wide bare-orange bar, "looks scary" per direct user feedback with a screenshot. Replaced with a shared `.review-btn` base class so both are equal-size rounded pills with icons (SVG checkmark / undo-arrow), plus a bottom gradient scrim behind them for legibility over bright video and safe-area-aware padding. See `renderReview()` in `js/app.js` and `.review-btn*` in `css/styles.css`.
2. **Pause/Stop buttons on the Recording screen were (again) invisible/wrong.** Same CSS-specificity trap as the very first bug in this file (`.controls button` beating a single-class selector) recurred on the newly-added `.pause-btn`/`.stop-circle-btn` — I fixed `.record-btn` this way earlier but forgot to apply the same `.controls .foo` prefix to these two when I added them. **If you add any new button inside `.controls` in the future, always scope its color/background rule as `.controls .your-class`, never just `.your-class` alone** — this has now bitten the project three separate times.
3. **Recorded video was squished/wrong-aspect.** Root cause: `canvas.captureStream()` (in `js/camera.js`'s `mirrorToCanvas()`) was called synchronously immediately after starting the draw loop, but the canvas hadn't been resized to its real portrait on-screen dimensions yet at that exact moment — it was still at the HTML canvas default (300×150, landscape). The captured track's declared dimensions got locked in at that wrong size while actual drawn frames were correctly-sized portrait pixels, producing a squished recording. Fixed by calling the resize synchronously *before* `captureStream()`.
4. **Zoomed-in/narrow field of view vs. the native Camera app.** `acquireFrontCameraStream()` was requesting `width: {ideal:1080}, height: {ideal:1920}` — asking for a specific tall resolution makes some browsers pick a digitally-cropped, more-zoomed-in sensor readout to hit that exact aspect, instead of the sensor's natural wide FOV the native camera app uses. **Fix:** dropped the width/height constraints entirely, requesting only `{ facingMode: 'user' }` and letting `mirrorToCanvas`'s own cover-crop handle fitting it to the screen. **Not yet re-verified against the actual native Camera app's FOV on-device** — the user compared screenshots and found our FOV much narrower/zoomed than native; this fix addresses the most likely cause but should be re-confirmed with another side-by-side comparison.
5. **Recordings sometimes "got stuck" / never finished.** Reported directly ("несколько видео... не делаются до конца") after making several recordings. Root cause not confirmed (couldn't reproduce without a device), but two real risk factors were identified and addressed defensively:
   - The mirror-to-canvas draw loop used `requestAnimationFrame`, which fires at display refresh rate (up to 120Hz on ProMotion iPhones) rather than actual new-camera-frame rate (~30fps) — meaningfully more CPU/encoding work than necessary, a plausible contributor to instability on longer recordings. Switched to `video.requestVideoFrameCallback()` (fires only on genuinely new frames) with an `requestAnimationFrame` fallback for browsers without it.
   - `stopMirrorPreview()` (which tears down the hidden helper `<video>` and cancels the draw loop) was being called *before* `await recorder.stop()` — reordered so the canvas/video pipeline stays alive until the recorder has actually finished, in case WebKit's encoder needs the source to still be live while finalizing.
   - Added a hard safety net regardless of root cause: `recorder.stop()` is now wrapped in an 8-second timeout (`withTimeout()` in `js/app.js`). If it doesn't resolve in time, the user is shown an error screen with a way back to Setup instead of being stuck on a dead Recording screen forever.

   **Root cause suspected (same day, next round):** it wasn't the recording hanging — playback in Review showed the *video freezing after ~5s while audio kept playing to the end*, confirmed directly by the user. That looked like the signature of `mirrorToCanvas()`'s hidden source `<video>` (the one `drawImage`'d onto the visible canvas every frame) getting throttled by iOS Safari's power-saving behavior for videos it considers "not actually visible" — it was styled `width:1px; height:1px; opacity:0`. Tried fixing it by keeping that helper video at full/real size and `opacity:0.01` instead. **This did NOT fix it** — the user re-tested and reported the exact same freeze-then-audio-only symptom. See the next round for what actually happened as a result.

## Fourth round: reverted the canvas-based WYSIWYG recording entirely (2026-09-17)

The opacity/size fix for the frozen-video bug didn't help, and this was
now the **third** distinct bug traced back to the `mirrorToCanvas()`
canvas-recording pipeline (squished aspect, invisible controls sharing
the same commit, and now a freeze that survived a targeted fix). Given
multiple videos in a row were unusable, reliability was judged more
important than exact on-screen/recorded mirror matching, so **the whole
canvas-based recording approach was reverted**:

- `js/camera.js`: deleted `mirrorToCanvas()` entirely. `acquireFrontCameraStream()` keeps the earlier fix (no forced width/height — still worth re-confirming the FOV now matches native, independent of this revert).
- `js/app.js`: `renderRehearsal()`/`renderRecording()` go back to a plain `<video id="preview">` with `video.srcObject = cameraStream` (not a canvas), and `new Recorder(cameraStream)` records the **raw, unmirrored** camera track directly — no more `mirrorPreview`/`stopMirrorPreview()` anywhere.
- `css/styles.css`: `#preview` is mirrored again via `transform: scaleX(-1)` (preview-only, as originally built) plus `object-fit: cover`.
- The `withTimeout()` safety net around `recorder.stop()` (Round 3, item 5's timeout) was **kept** — it's cheap insurance regardless of pipeline, and there was never conclusive proof canvas-vs-direct-track was the only possible source of a hang.

**Net effect / known trade-off:** the live preview is mirrored (for framing, "like a mirror") but the **saved video is not** — same as Instagram, TikTok, and most camera apps, and the same as this project's very first working version before the WYSIWYG detour. If the user still wants true mirror-matching in the saved file in the future, canvas-based recording is really the only way to do it in a browser, so revisiting it would mean debugging the freeze properly with Safari's remote Web Inspector (connect iPhone to a Mac, Settings > Safari > Advanced > Web Inspector, then Safari on Mac > Develop menu) rather than guessing blind — don't re-attempt it speculatively without that kind of real diagnostic access.

**Not yet re-verified on device**: confirm recording no longer freezes across several consecutive takes, and confirm the FOV fix (no forced resolution) actually narrowed the gap with the native Camera app now that the simpler pipeline is back in place.

**This did NOT fix it either** — see the next round. Keep reading before assuming a raw-track recording is inherently safe.

## Fifth round: the freeze survived the full revert — likely cause is screen Auto-Lock, not our code (2026-09-17)

After reverting to the simplest possible pipeline (plain `<video srcObject>` + `new Recorder(cameraStream)`, zero custom video processing), the user re-tested and got the **exact same symptom**: video freezes partway through, audio plays to the end. Since this survived removing every piece of custom video-handling code this project ever added, the cause can't be anything in our canvas/mirroring code — it has to be something more fundamental.

**Leading theory:** the phone's screen dims/locks mid-recording (e.g. because the person isn't touching the screen while quietly reading the teleprompter), and iOS suspends camera capture when the screen locks/dims for privacy reasons — audio recording can continue in the background in some configurations, video capture cannot. That exactly matches "video freezes, audio plays to completion," and would reproduce identically regardless of which recording pipeline the app uses, which is consistent with it surviving the Round 4 revert.

**Fix applied:** the standard [Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API) (`navigator.wakeLock.request('screen')`), supported in iOS Safari since 16.4. `acquireWakeLock()`/`releaseWakeLock()` in `js/app.js` are now called alongside every existing camera-stream acquire/`stopStream()` pair (Rehearsal's camera acquisition, the back-button, both error paths, and Review). Also re-acquires automatically on `visibilitychange` back to visible, since browsers silently drop the wake lock whenever the tab is hidden (e.g. briefly during the native share sheet) and never restore it on their own.

**This theory was wrong too** — the user set Auto-Lock to "Never" and the freeze still happened at ~10s. See the next section for how it was actually solved.

## Sixth round: the freeze is SOLVED — it was never a recording bug (2026-09-17)

Five rounds of blind fixes had failed. Instead of guessing a sixth time, the app was **instrumented** so it could report what actually happened, since this project is debugged against a physical iPhone with no browser console available:

- `js/diagnostics.js` — timestamped in-app event log.
- `js/recorder.js` — logs the chosen mime type, the video track's real resolution/frame rate, chunk/byte totals, recorder errors, and critically listens for `mute`/`ended` on the **video track**. A video track that goes `mute` has stopped delivering frames while the stream stays "live" — that's exactly what an OS/camera-side stall looks like from JS, and it distinguishes that from an encoding fault.
- `js/app.js` — probes the finished file's real dimensions and duration, and shows the whole log behind an unobtrusive ⓘ chip on the Review screen.

**The log from the user's next take settled it immediately:**

```
+0.0s  формат: video/mp4;codecs=avc1.42E01E,mp4a.40.2
+0.0s  видеодорожка: 480x640 @30fps
+27.7s запись остановлена: 26 фрагментов, 28389 КБ
+27.9s файл: 28389 КБ, 480x640, длительность=27.668
```

No `mute` event, no `ended` event, chunks flowing the entire time, full-length file. **The recording was never broken.** The bug was in *playback*: `MediaRecorder` output routinely has no duration in its metadata (`duration === Infinity`), and a `<video>` element playing such a blob stalls partway through while the audio track keeps going — precisely the reported symptom, and the reason it survived every change to the recording pipeline, including the full canvas revert.

**The actual fix** (`repairBlobPlayback()` in `js/app.js`): on `loadedmetadata`, if `duration === Infinity`, seek far past the end (`currentTime = 1e101`) to force the browser to scan the file and compute the real duration, then seek back to 0. Standard, well-known workaround. Confirmed working by the user: `длительность=27.668`.

**Lesson worth carrying forward:** four rounds of architectural changes (canvas pipeline, rVFC, wake lock, a full revert) were spent on a bug that lived in eight lines of playback code. When a symptom survives a change that *should* have been decisive, that's the signal to stop fixing and start measuring. The diagnostics chip is cheap and stays in the app — use it before theorizing.

### Resolution vs. field of view — first attempt was wrong, reverted (2026-09-17/18)

The diagnostics revealed the camera was capturing at only **480x640**, so a fix was tried: request `width:{ideal:1080}, height:{ideal:1440}` (the camera's own 3:4 shape, just higher-resolution) instead of no constraint at all, reasoning that same-shape-higher-res should mean more detail with no crop.

**That reasoning was wrong in practice.** The user reported two new regressions from it: the frame looked zoomed-in again, AND the recorded output came out landscape/sideways instead of portrait — not merely low-resolution-but-correct like before. Whatever resolution mode `{ideal:1080, ideal:1440}` actually negotiates on this device, it is not simply "the same 480x640 mode at higher detail" — it's a genuinely different camera mode with different framing and, seemingly, different rotation-metadata handling that `MediaRecorder` doesn't compensate for (the `<video>` preview still displayed it right-side-up because browsers apply display-time rotation to `<video>`, but raw encoding does not).

**Reverted to no width/height constraint at all** (`{ facingMode: 'user' }`), which is the exact configuration proven via the diagnostics panel to produce a correctly-oriented, correctly-framed 480x640 file. Low resolution is a real cost, but it beats a sideways or over-zoomed file.

**If resolution is revisited:** don't jump straight to a specific target. Raise it in small increments (e.g. try `ideal: 720`/`960` before `1080`/`1440`) and check the ⓘ diagnostics panel's "файл" line (which reports the *actual saved file's* width/height and duration) after each step — width should stay less than height (portrait), and framing should be eyeballed against the native Camera app. Don't ship a resolution change without that confirmation; this is the second time a resolution change alone broke something in a way that wasn't obvious from just watching the live preview.

### Buttons needing multiple taps / "tap near it, not on it" (2026-09-17/18)

Reported right after the PWA-install round, which had added `env(safe-area-inset-*)` via `calc()` to several `position: absolute` interactive elements (`.controls`, `.link-btn`, `.diag-btn`) so they'd clear the notch/home-indicator once installed standalone. **Suspected but not proven**: that combination — safe-area inset computed inside a `calc()` on an absolutely-positioned *interactive* element — caused a mismatch between the visual position and the actual hit-testable area, especially likely if tested in a regular browser tab (not installed) where the safe-area/toolbar interaction is more variable than in standalone mode.

**Reverted** the safe-area additions on those three specifically (back to fixed pixel offsets), while leaving safe-area handling in place on purely non-interactive/visual elements (`.screen` padding, the teleprompter band's top offset, `.status-topright`) since those can't have a hit-test mismatch. Also gave `.link-btn` explicit padding (it was previously just underlined text with zero hit-area beyond the glyphs) and `.controls button` some padding (helps "Медленнее"/"Быстрее", which had none — harmless no-op on the circular buttons since they're empty and `box-sizing: border-box`).

**Correction — this revert was wrong and was undone.** Removing the safe-area insets caused a real, screenshot-confirmed regression: on the installed (standalone) app, the record button and the "← Настройки" link were **physically cut off** by the home indicator area and status bar — not a hit-testing offset, genuine clipping. Safe-area insets are restored on `.controls`, `.link-btn`, and `.diag-btn`.

**Current working theory** (unconfirmed): the original "have to tap near a button, not on it" report predates the user installing the app to their home screen. It may have been specific to testing inside a regular Safari/Chrome tab, where `env(safe-area-inset-*)` values can be inconsistent as the browser's own address bar shows/hides — standalone mode's safe area is fixed and doesn't have that dynamic-viewport behavior. If the mistap bug still reproduces now that insets are back *and* the app is installed standalone, this theory is wrong and the cause is still unknown — don't remove the insets again without a screenshot confirming it's a tap-offset problem and not clipping, since those two symptoms need opposite fixes and have now each been mistaken for the other once.

## Seventh round: home-screen install, real icons, camera diagnostics, quality selector (2026-09-17/18)

Several smaller, more self-contained pieces of work landed around the same time as the button/resolution investigation above:

**PWA install support.** The user asked to remove the browser's own "camera and microphone access allowed" banner — that's browser chrome, not something the page can suppress, but installing the app to the home screen removes the whole browser UI (address bar, toolbar, that banner) and was worth doing anyway for the extra screen space. iOS keys standalone-launch off legacy `apple-mobile-web-app-*` meta tags in `index.html`, not the manifest, so those were added (`apple-mobile-web-app-capable`, `-status-bar-style`, `-title`). This is also what introduced the `env(safe-area-inset-*)` CSS additions responsible for the button-mistap bug above — full-bleed standalone layout needs safe-area padding so content doesn't sit under the notch/home-indicator, but it was applied too broadly (onto interactive elements) at first.

Install instructions given to the user: must be done from **Safari specifically** (Chrome on iOS can only bookmark, not install) — Share button → "На экран „Домой"" → Add.

**Real app icon.** Was a solid-orange placeholder PNG. `tools/make-icons.py` draws icons from code with Pillow (no image-editing software needed, no binary art asset to hand-tune) — three concepts were generated, shown to the user on a temporary preview page (`icon-preview.html`, deployed then removed) rendered with iOS's own icon mask over light/dark wallpaper plus at favicon size. User picked concept B ("script lines tapering into a record button, on brand orange"); `python tools/make-icons.py build b` regenerates the actual shipped files (`icons/icon-192.png`, `icons/icon-512.png`, `icons/apple-touch-icon.png`, `icons/favicon-32.png`) at any time if the design needs tweaking — edit `concept_b()` in that script and rerun, don't hand-edit the PNGs.

**Camera diagnostics** (`js/diagnostics.js`, wired through `js/recorder.js` and `js/app.js`) is what actually solved the Sixth Round freeze bug above — worth knowing it's there and cheap to extend. It's a small in-app event log surfaced behind an ⓘ chip on the Review screen, logging: chosen mime type, the video track's real resolution/frame rate, recorder errors, `mute`/`ended` events on the video track (the signal that distinguishes an OS/camera-side stall from an encoding problem), and the finished file's actual probed dimensions/duration. **This is a deliberate, permanent debugging aid for a project developed against a physical phone with no console access — don't remove it as "temporary" cleanup.**

**Video quality selector.** Two earlier attempts to just pick a better `getUserMedia` resolution each shipped a regression (zoomed-in frame, then a sideways-recorded file) — the front camera's wide 4:3 framing and its high-resolution modes are apparently different, non-interchangeable camera profiles on this device, not a simple quality slider. Rather than guess a third time, added `QUALITY_PROFILES` in `js/camera.js` (`wide` = camera default/no constraint, `hd` = 720×1280, `max` = 1080×1920) exposed as three buttons in Setup, persisted via `settings.videoQuality` (defaults to `wide`, the only profile confirmed to record correctly). **Not yet verified which of `hd`/`max` actually record right-side-up on the user's device** — ask them to try each, check the ⓘ panel's "файл" line after each take (width should stay less than height), and report back before assuming either works.

## Known deferred issues (found in final review, deliberately NOT fixed — see conversation/commit 6396bce for what WAS fixed)

These were explicitly scoped out as trade-offs or lower priority. Revisit if they cause real problems during device QA:

1. **Camera stream is stopped when entering Review and re-acquired on Retake** (rather than kept alive per the spec's literal "acquired once, reused" data-flow wording). Deliberate: avoids leaving the camera light on during Review. Costs a brief `getUserMedia` re-prompt-free reacquisition on Retake (should not re-trigger a permission dialog since it was already granted, but adds latency). If this feels slow/wrong on a real device, consider keeping the stream alive from Rehearsal through Review instead.
2. **MediaRecorder-unsupported detection happens after the 3-2-1 countdown**, not before. On an unsupported browser the user sits through the countdown before seeing the error. Should ideally probe support when entering Rehearsal instead.
3. **Countdown screen replaces the camera preview** with a plain black number screen (2.1s) rather than overlaying the countdown on top of the live camera. Spec doesn't explicitly require an overlay, but it's a bigger UX change than was in scope for this pass.
4. **`Recorder.canPause` is nearly always `true`** in real browsers (feature-detects `typeof pause === 'function'`, which basically every browser has) — it can't actually detect the iOS quality problems it was meant to guard against. Not fixable via feature detection; flag it during iOS QA if pause/resume produces a broken file.
5. **Untracked files at repo root**: `Screenshot 2026-09-17 133645.png` and `.agents/` (this is the skills directory the user pointed at — deliberately not gitignored, it's tooling not app code) — nobody has decided whether to add `.gitignore` entries or delete the screenshot. Ask the user.

## What's left (in priority order)

As of the end of the Seventh Round (above), these are open and unconfirmed — start here:

1. **Confirm the button-mistap fix actually worked.** Reverting the `env(safe-area-inset-*)` additions on `.controls`/`.link-btn`/`.diag-btn` was a reasonable, low-risk guess, but the user hadn't confirmed it fixed the "have to tap near a button, not on it" problem as of this writing. If it's still happening, see the "Buttons needing multiple taps" section above for where to look next.
2. **Have the user try the `hd` and `max` video quality profiles** (Setup screen, "Качество видео") and report, for each, what the ⓘ diagnostics panel's "файл" line says — specifically whether width < height (correct portrait) or width > height (recording sideways again, like the earlier `1080x1440` regression). Whichever profile(s) come back correct, consider making the best one the new default instead of `wide`.
3. **Finish Task 13 — manual on-device QA generally.** Much of the original checklist has now been covered through the rounds above (Photos-save via `navigator.share`, timer repositioned off the teleprompter band, black-video-on-playback fixed, orientation fixed, offline shell caching in place, icons done), but nothing has been formally checked off — treat the plan's Task 13 checklist as a loose guide, not a literal TODO list to still execute fresh. Two items from it still worth deliberately re-checking:
   - **Notch/Dynamic Island clearance** — safe-area handling exists on the teleprompter band, `.screen` padding, and `.status-topright`, but hasn't been visually confirmed on a notched device since the button-mistap investigation touched nearby CSS.
   - **Pause → resume → stop file integrity** — confirm audio/video stay in sync across a paused-and-resumed take, not just a continuous one.
4. Decide what to do with the two untracked files at the repo root (`Screenshot 2026-09-17 133645.png` and `.agents/`, see the deferred-issues list above) — still unresolved, low priority.
5. Consider the other deferred issues above if they turn out to matter in practice (camera stream re-acquisition latency on Retake, MediaRecorder-unsupported detection timing, the countdown screen replacing rather than overlaying the camera preview, `Recorder.canPause` being unreliable as a feature-detect).
6. Once things are stable, consider removing the diagnostics ⓘ panel's visibility for end users (or gating it behind something less prominent) — it was built as a debugging aid, not a polished user-facing feature, even though the underlying logging is worth keeping permanently.

## Quick start for a new session

```bash
cd "E:\REELS RECORDER with TELEPROMPTER"
node --test tests/*.test.mjs   # confirm unit tests still pass
```

For device testing, **use the GitHub/Vercel deploy, not a local server** — see "How to test on a real device" above. In short: commit, `git push`, wait ~15-20s for Vercel's auto-deploy, then have the user reload https://reels-recorder-teleprompter.vercel.app. Verify a deploy actually landed before telling the user to check, e.g.:

```bash
curl -s https://reels-recorder-teleprompter.vercel.app/js/app.js | grep -c "some-string-you-just-added"
```
