---
'@pie-qti/assessment-player': patch
---

Internal restructuring of the assessment shell (Phase 5 "shell split", pure code motion — **no behaviour change**):

- The shell's dialogs are child components now: `SubmitConfirmDialog` (with the shared `SubmitBlockerGroup` list), `LeavePartDialog`, `ResumeDialog`, `StartOverDialog`, `FeedbackDialog`, `ExpiryNoticeDialog`, and the proctor pause's `PauseOverlay`. Same DOM, classes, test ids, focus behaviour and events.
- `AssessmentShell`'s `initialize()` moved into a `createPlayerConnection` composable (player creation, core event wiring, teardown, retry, slow-load status); the shell keeps the session state and handlers. The candidate display settings (PNP) moved into a `displaySettings` module, and the shell's delivery flags derive from one session-status object.
- The shell's exported element-façade functions (`next`, `previous`, `navigateTo`, `navigateToSection`, `submit`, `start`, `hasStarted`, `pause`, `resume`, `isPaused`, `getPauseReason`, `isFinalized`, `getTimeState`, `flushAutosave`, `updateResponse`, `getResponses`, `getState`, `restoreState`) are unchanged and pinned by `player-elements` façade tests.
- New component-behaviour tests pin the moved behaviour: delivery landmarks and the skip link, dialog focus in/out, the pause focus round trip, and the resume ↔ start-over hand-off.
