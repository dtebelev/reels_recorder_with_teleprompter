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

## Open bugs from live device QA — NOT YET FIXED, do these next

Reported directly by the user testing on a real iPhone. Investigate and fix these before continuing with anything else in "What's left" below.

1. **"Оставить" (Keep) saves to Files/Drive instead of the iPhone Photos app.** Current implementation (`renderReview()` in `js/app.js`) is a plain `<a download>` pointing at a `blob:` URL. On iOS Safari this is known to save into the Files app (or offer a Google Drive/other app's share target) rather than the Camera Roll/Photos — this was actually flagged as the top risk in the final pre-QA review, and it's now confirmed. **Likely fix:** use the Web Share API instead — `navigator.share({ files: [new File([recordedBlob], filename, { type: recordedBlob.type })] })` — which on iOS opens the native share sheet, and "Save Video" from that sheet does save to Photos. Needs a fallback to the current `<a download>` approach for browsers without `navigator.canShare({ files: [...] })` support (most desktop browsers). Check `navigator.canShare` support before attempting `share()`; some Android browsers also support this and it'd be a UX improvement there too.
2. **Recording timer overlaps the teleprompter band.** The `.timer` element (`css/styles.css`) is centered at `top: 12px`, which sits inside/behind the teleprompter's `20vh` band at the top of the screen — the two visually collide. **Fix:** reposition `.timer`, e.g. to a top corner (`left`/`right` instead of centered) or below the teleprompter band, so it doesn't overlap the read-line/script text. Check both portrait notch/Dynamic-Island devices when repositioning (see the still-open safe-area-inset item in the deferred list below — may be worth fixing together).
3. **Recorded video plays back as a pure black screen in Review** (`#review-video` in `renderReview()`). The take was actually recorded (file exists, presumably has correct duration/size since the zero-data guard didn't trigger — worth double-checking), but visually shows nothing when played back. Needs investigation — possible causes to check first, in rough likelihood order:
   - The chosen `MediaRecorder` mimeType (see `js/mime.js`'s `MIME_CANDIDATES`, picked via `pickSupportedMimeType`) produces a container/codec combination that iOS Safari's `<video>` element can't decode for *playback* even though it *recorded* successfully — try forcing/checking which candidate is actually selected on this device and whether that container plays back correctly in Safari specifically (mp4 vs webm — Safari's video decode support differs from what MediaRecorder reports as encodable).
   - `object-fit: contain` + the video's actual encoded orientation/rotation metadata — the video might be playing but with 0 visible pixels due to a dimension/rotation mismatch, not actually "black". Check by downloading the file directly and opening it in a real player, not just the in-page `<video>`, to isolate whether it's a Review-screen rendering issue or the file itself is bad.
   - Confirm audio plays even if video is black — if audio also fails, points more toward a broken/empty video track; if audio plays fine, points toward a decode/render issue specific to the `<video>` element.

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
