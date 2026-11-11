---
'@pie-qti/player-elements': minor
---

**Additive: per-item injection properties on `pie-qti-assessment-player`** (beta prerelease). The assessment element now exposes the same per-item injection properties its two sibling elements already had, closing the rule gap where `security` and `pci` were properties on all three elements while the rest existed only inside `config`:

- `role` — the QTI view every item renders for, declaratively the `qti-role` attribute (a bare `role` attribute stays the ARIA role, like the item element; unknown values warn and render the candidate view);
- `i18n` — the interface locale provider (the config spells it `i18nProvider`);
- `pnp` — the candidate's PNP profile;
- `plugins` — definition-lifetime extensions applied to every item definition;
- `stringComparison` — opt-in folds for string comparison in scoring.

Each wins over the same-named `config` field and forwards into the config the element builds for the shell; setting a property re-renders a mounted shell like a `config` change. Hosts who wrote `item.i18n = provider; sectionEl.i18n = provider;` can now write `assessment.i18n = provider` too, instead of knowing the name changes to `i18nProvider` and moves inside `config`.
