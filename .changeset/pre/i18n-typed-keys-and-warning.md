---
'@pie-qti/i18n': minor
---

`DefaultI18nProvider.t` and `SvelteI18nProvider.t` now declare two overloads: the first types the key as `MessageKey` (the English-catalog key union) so editors complete keys and a typo stands out against the union; the second is a documented escape overload accepting `string` for keys that live in a host's `customMessages` catalog. The runtime key namespace is framework keys plus custom keys, so a plain-string escape overload cannot reject a misspelled framework key by itself — compile-time enforcement of literal keys is the new `check-consumer-keys` scan in `check:i18n`. The `I18nProvider` interface and `translate()`/`translatePlural()` keep `key: string`, because hosts bring their own backends and components pass keys held in string-typed structures. Nothing that compiled before stops compiling.

Behaviour change: the missing-key `console.warn` is no longer gated on `NODE_ENV === 'development'`. A key no catalog carries now warns in every environment — production builds included, which is where such a regression ships; the warning previously never fired there. It warns exactly when a lookup misses (the UI then degrades to the English default or the key itself), so quiet production logs mean every rendered key resolved.

The README's component-integration section documented `i18n?.t(key) ?? fallback` as a helper pattern; `t()` never returns nullish, so that fallback was dead code that rendered raw key names for anyone copying it. The section now documents the real contract — the English default is `t`'s second argument and the trailing `??` covers only the provider being undefined — and the bundled `LocaleSwitcher` reference component uses that shape.
