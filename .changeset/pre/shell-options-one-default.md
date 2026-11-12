---
'@pie-qti/assessment-player': patch
---

The shell-presentation options (`showSections`, `allowSectionNavigation`, `showProgress`) now default in exactly one place — the bundled `AssessmentShell` (absent means shown/enabled, `false` hides or disables). They were defaulted twice before, in `createPlayerConnection`'s core-config build (which the headless core never reads, so the values were dead on arrival) and again on the raw config at the shell's render sites, with the header and navigation bar carrying a third implicit default; the copies could drift. The child chrome components now render what the shell tells them (their props are required booleans), the core-config fields are documented as ignored by the headless core, and the README says so. No host-visible behavior change: hosting through the shell (including the `@pie-qti/player-elements` element, which passes `config` through) behaves exactly as before.
