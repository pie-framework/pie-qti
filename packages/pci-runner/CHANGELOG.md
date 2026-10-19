# @pie-qti/pci-runner

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
