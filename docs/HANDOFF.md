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

## Status: implementation complete, on-device QA not done

All 12 implementation tasks are built, committed, and each passed a
two-stage review (spec compliance, then code quality) via the
subagent-driven-development workflow. A final whole-system review also
ran and its findings were fixed. `node --test tests/*.test.mjs` passes
(10 tests). **Nobody has run this on an actual phone yet.** That's
the immediate next step — see "What's left" below.

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

## Known deferred issues (found in final review, deliberately NOT fixed — see conversation/commit 6396bce for what WAS fixed)

These were explicitly scoped out as trade-offs or lower priority. Revisit if they cause real problems during device QA:

1. **Camera stream is stopped when entering Review and re-acquired on Retake** (rather than kept alive per the spec's literal "acquired once, reused" data-flow wording). Deliberate: avoids leaving the camera light on during Review. Costs a brief `getUserMedia` re-prompt-free reacquisition on Retake (should not re-trigger a permission dialog since it was already granted, but adds latency). If this feels slow/wrong on a real device, consider keeping the stream alive from Rehearsal through Review instead.
2. **MediaRecorder-unsupported detection happens after the 3-2-1 countdown**, not before. On an unsupported browser the user sits through the countdown before seeing the error. Should ideally probe support when entering Rehearsal instead.
3. **Countdown screen replaces the camera preview** with a plain black number screen (2.1s) rather than overlaying the countdown on top of the live camera. Spec doesn't explicitly require an overlay, but it's a bigger UX change than was in scope for this pass.
4. **`Recorder.canPause` is nearly always `true`** in real browsers (feature-detects `typeof pause === 'function'`, which basically every browser has) — it can't actually detect the iOS quality problems it was meant to guard against. Not fixable via feature detection; flag it during iOS QA if pause/resume produces a broken file.
5. **Untracked files at repo root**: `Screenshot 2026-09-17 133645.png` and `.agents/` (this is the skills directory the user pointed at — deliberately not gitignored, it's tooling not app code) — nobody has decided whether to add `.gitignore` entries or delete the screenshot. Ask the user.

## What's left (in priority order)

1. **Task 13 — manual on-device QA.** This needs a real phone (or at minimum a desktop browser with a webcam) — something this session could not do. Follow the checklist in the plan's Task 13 section. The final whole-implementation review flagged these as the highest-risk things to check specifically:
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
