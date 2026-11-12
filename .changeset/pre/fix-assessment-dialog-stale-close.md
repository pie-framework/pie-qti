---
'@pie-qti/assessment-player': patch
---

Fix the assessment dialog (submit confirmation, leave-part warning) sometimes closing itself right after it was reopened. Browsers fire a dialog's `close` event from a queued task, and Chromium can run the click that reopens the dialog before it, so a stale event from the previous close cancelled the new one. The dialog now ignores close events it caused itself and treats only browser-initiated closes as a cancel.
