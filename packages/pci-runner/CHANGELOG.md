# @pie-qti/pci-runner

## 1.0.0-beta.5

### Patch Changes

- 90bf9ab: Correct published dependency graphs: runtime imports no longer hide in `devDependencies`, and test-only packages no longer ride along as production dependencies. `@pie-qti/player-elements` now declares `@pie-qti/qti-common` and `@pie-qti/default-components` (both imported at runtime from its entry points) in `dependencies`; `@pie-qti/pci-runner` likewise declares `@pie-qti/item-player`. `@pie-qti/core` moves `@pie-qti/test-utils` and `@pie-qti/to-pie` moves `@pie-qti/transform-core` to dev dependencies (tests only), and `@pie-qti/pie-to-qti2` drops `@pie-qti/transform-core` entirely (only a type import remained, now satisfied by `@pie-qti/transform-types`). Installing these packages no longer pulls unnecessary extras, and bundlers without hoisting-dependent resolution keep working. The `check:deps` script now flags runtime value imports of workspace packages that are not declared in `dependencies`/`peerDependencies` of publishable packages.
- 1f1d8f0: The runner no longer locks the opaque `"null"` origin serialization as its outbound postMessage targetOrigin. When the host page is itself sandboxed (the LTI-style embed where the player sits in an `allow-scripts`-only iframe, which serializes its origin as `"null"`), a locked `"null"` target can never match the parent window, so every runner→host message (`module-loaded`, `instance-ready`, `response-change`, …) was silently dropped and the handshake could never complete. Outbound messages to an opaque parent now post with `'*'`, bounded by the transport posting to `window.parent` alone and anchored on `event.source === window.parent` — the mirror of the frame connector's round-3 fix. Inbound messages remain locked on the parent's origin spelling, and tuple-origin parents keep the exact-origin target as before. Teardown also removes the interaction container element instead of only emptying it, so repeated instantiate/teardown cycles no longer accumulate dead wrappers in the mount.
- 362b7c1: Round-6 interaction feedback fixes (WCAG 2.2 AA). Order and graphic-order confirmations keep their control mounted as an inert "Order confirmed" state (aria-disabled, focus retained) and announce the confirmation from an always-present polite region — the control used to be removed, dropping focus to the page. Graphic associate announces associations made, removed and refused, no longer sets `disabled` on the focused hotspot (aria-disabled plus a handler guard), and refocuses a surviving control after a pair removal. Remove/clear controls in match, gap match, graphic gap match, position object, hottext and file upload move focus to the related surviving control (now-enabled word/label/source, canvas, first hottext, native file input), and gap-match and file-upload announce the removal. Unmet minimums are now stated on the question: extended text states `minStrings` and refuses removing responses below it, graphic gap match states per-label `matchMin` honouring the authored `data-min-selections-message`, and graphic associate states `minAssociations` and per-hotspot `matchMin`. Rich text editors can re-edit inserted math from the keyboard (Enter/F2 beside the expression) and via an "Edit math" toolbar button, instead of pointer-only clicking. File upload translates every string with an English fallback (raw catalog keys could reach candidates) and resets the native input through a bound reference, so re-choosing the same file works even inside a shadow root. The PCI sandbox init payload gains optional `language`, `direction` and `frameTitle` fields, which the runner frame applies to its document (language, direction, title) before instantiating the interaction. All new strings ship in all 8 locales.
- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [35bd0c3]
- Updated dependencies [23a4077]
- Updated dependencies [bd67d58]
- Updated dependencies [4e5f1a8]
- Updated dependencies [bc7e8f6]
- Updated dependencies [b504c41]
- Updated dependencies [756771f]
- Updated dependencies [0a1c071]
- Updated dependencies [7cbed03]
- Updated dependencies [bdfc40e]
- Updated dependencies [3d51b92]
- Updated dependencies [0973689]
- Updated dependencies [f6e7714]
- Updated dependencies [eb50277]
- Updated dependencies [3a31af2]
- Updated dependencies [2f43e0e]
- Updated dependencies [8c4274b]
- Updated dependencies [ac81831]
- Updated dependencies [ee233f4]
- Updated dependencies [0cf8193]
- Updated dependencies [9c75e43]
- Updated dependencies [72b3545]
- Updated dependencies [99341e5]
- Updated dependencies [9cd2772]
- Updated dependencies [098f997]
- Updated dependencies [410fe38]
- Updated dependencies [9abdf17]
- Updated dependencies [ad99965]
- Updated dependencies [fff7dd7]
- Updated dependencies [d54f5f7]
- Updated dependencies [d54f5f7]
- Updated dependencies [d54f5f7]
- Updated dependencies [fe9e624]
- Updated dependencies [7cff6aa]
- Updated dependencies [362b7c1]
- Updated dependencies [2e4f6fb]
- Updated dependencies [816c8f8]
- Updated dependencies [9cb24ad]
- Updated dependencies [90d1c60]
- Updated dependencies [01fb4d1]
- Updated dependencies [d7d744e]
- Updated dependencies [9e07058]
- Updated dependencies [c85ea64]
- Updated dependencies [74c3886]
- Updated dependencies [de1eed5]
- Updated dependencies [a1c989d]
- Updated dependencies [b34d710]
- Updated dependencies [68c8b37]
- Updated dependencies [795c767]
- Updated dependencies [35bd0c3]
- Updated dependencies [47e9176]
- Updated dependencies [a183a16]
- Updated dependencies [7cf746f]
- Updated dependencies [8d03d05]
- Updated dependencies [1449b94]
- Updated dependencies [562182a]
- Updated dependencies [2fd1003]
- Updated dependencies [4f9a07c]
- Updated dependencies [edd4020]
- Updated dependencies [281d6fb]
- Updated dependencies [0bdb7f1]
- Updated dependencies [7c767d4]
- Updated dependencies [b38cb07]
- Updated dependencies [3b3927e]
- Updated dependencies
- Updated dependencies [9ec0f69]
  - @pie-qti/item-player@1.0.0-beta.5

## 1.0.0-beta.4

No changes in this release.

## 1.0.0-beta.3

No changes in this release.

## 1.0.0-beta.2

No changes in this release.

## 1.0.0-beta.1

No changes in this release.

## 1.0.0-beta.0

### Patch Changes

- 833ddad: PCI sandboxed engine (plan Option C): Portable Custom Interaction modules can now run in a
  hardened, opt-in cross-origin frame instead of the page realm. `PciConfiguration.sandbox`
  points at a runner page served from a dedicated cookieless origin; the module executes with
  an opaque origin — no shared storage, cookies, or DOM with the player — while `getResponse()`
  stays synchronous by answering from a bridge-maintained cache. New `@pie-qti/pci-runner`
  package is the deployable runner page (`dist/pci-runner.html` + bundle), with mutual origin
  locking over the versioned `pie-qti-pci-sandbox` protocol. `PciConfiguration.moduleResolver`
  is now optional: required for page-realm execution, unused when `sandbox` is configured, with
  the new `createAllowlistPciModulePolicy` available to allow-list which module URLs may be
  handed to the frame. `PciHostController.onError` reports asynchronous engine failures (frame
  handshake, in-frame module load, instance errors). The page-realm engine and its resolver
  contract are unchanged.
