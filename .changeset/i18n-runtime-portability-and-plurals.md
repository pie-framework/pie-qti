---
'@pie-qti/i18n': patch
'@pie-qti/item-player': patch
'@pie-qti/default-components': patch
'@pie-qti/section-player': patch
'@pie-qti/assessment-player': patch
---

Make the published i18n package loadable outside Vite. `DefaultI18nProvider` resolved locale
catalogs through `import.meta.glob`, a compile-time Vite macro, but the package builds with plain
`tsc` — so the macro shipped verbatim to npm and any consumer on webpack, esbuild, Rollup, Node or
plain browser ESM threw `TypeError: import.meta.glob is not a function` merely importing the
provider. Locales now resolve through an explicit map of dynamic `import()` calls, one entry per
locale, which `tsc` emits untouched and bundlers still code-split per locale. en-US is a static
import, since it backs every fallback and must be resolvable synchronously in the constructor. The
bare `process.env.NODE_ENV` on the missing-key path is guarded too; it raised
`ReferenceError: process is not defined` in a plain browser.

Select plural forms with `Intl.PluralRules` instead of a hardcoded `one`/`other` split. Arabic
defines zero/one/two/few/many/other for every plural key and none but `one` and `other` were
reachable, so Arabic counts of 2, of 3–10 and of 11–99 all rendered the wrong grammatical form. The
category now comes from the active locale, with a fallback to `.other` for locales whose catalog
does not define it, and a fallback to the `one`/`other` split for a locale tag `Intl.PluralRules`
rejects.

Convert the ICU MessageFormat strings in the `transform.*` namespace to the package's plural-key
convention across all eight locales. The runtime interpolates `{name}` only and never parsed ICU, so
strings like `'{count, plural, one {# item} other {# items}}'` would have rendered their own source
text to users. `transform.transformed.summary` interleaved two independent counts and is now
`summary`/`summaryWithAssessments` plus `summaryItems`/`summaryAssessments`, composed by the caller;
the participle moved inside the pluralized phrase in es-ES, fr-FR and ro-RO, where it agrees with
the item count. Singular forms in those three locales previously carried a plural participle from
the ICU suffix and are now correct. `check-translations` recognises plural-category leaves anywhere
a plural sub-object lives rather than only under `plurals.*`, gated on en-US defining the same
parent.

Stop `t()` returning a catalog object. A key landing on a namespace branch (`t('common')`) or a
plural sub-object resolved to the object itself, which reached callers where a string was expected
and threw from `String.prototype.replace` as soon as interpolation values were passed. Such a key is
now a miss and returns the key or the supplied default.

Test `DefaultI18nProvider` itself. The suite previously defined its own provider to avoid the
`import.meta.glob` load failure, so the shipped class was never instantiated: the fallback chain,
custom-message priority, `addCustomMessages` deep merge, `loadLocale` caching and rejection,
`localStorage` restore-on-construct and `plural()` had no coverage, and the mock diverged from
production by dropping unmatched interpolation placeholders. 59 tests now bind to the real class,
including every `plurals.*` key across all eight locales and an assertion that no catalog contains
an ICU argument.

Fix the `LocaleSwitcher` reference component, which the PRD invites hosts to copy but `tsconfig.json`
excluded from compilation, so none of its defects surfaced: `I18nProvider` was imported from
`core/types`, which does not export it; the `availableLocales` prop default referenced a `const`
declared below it, a temporal-dead-zone `ReferenceError` whenever the prop was omitted; and the
usage docblock named a `createI18n` export and a `@pie-qti/i18n/components` subpath that do not
exist. A `check` script now runs `svelte-check` over the component so the reference stays valid, and
zh-CN joins the default locale list.

Add right-to-left support, which blocked ar-SA independently of the plural bug — nothing in the
source wrote `dir` anywhere. `getDirection()` returns the writing direction of the active locale from
`Intl.Locale.prototype.textInfo`, falling back to a primary-subtag list for engines that lack it, and
the item body root now reflects it as `dir` alongside `lang`. `direction` is an inherited CSS
property, so that one attribute reaches interaction components inside shadow roots with no
per-component wiring; the host page's own chrome is untouched, since the player publishes direction
for its own subtree only. Both evals in `docs/evals/i18n/rtl-support/evals.yaml` finally have an
implementation to run against.

Let a host set the locale declaratively: `<pie-qti-item-player locale="ar-SA">`. `observedAttributes`
carried no locale, so locale was reachable only as a JS property — impossible to express in markup or
in a server-rendered page. The attribute resolves through a new `I18nProvider.withLocale()`, which
returns a view sharing catalogs and loaded-locale bookkeeping by reference, rather than through
`setLocale()`, which would mutate a provider shared with the rest of the page and, on
`SvelteI18nProvider`, reload the document. Two players on one page can now render different locales
from one provider, and a second locale is still parsed only once. The reload path stays as the
default for a host-driven switch.

Declare `@pie-qti/i18n` as an optional `peerDependency` rather than a `dependency` of
default-components, item-player, section-player and assessment-player. Every import of it in those
packages is `import type` and none of their built JavaScript references it, so a host that never
constructs a provider should not be made to install it. It stays a `devDependency` so the workspace
resolves the types locally.
