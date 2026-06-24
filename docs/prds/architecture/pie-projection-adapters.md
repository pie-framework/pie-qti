# PRD: PIE Projection Adapters

<!--
  Status: draft
  Type: architecture
  Packages: @pie-qti/to-pie, @pie-qti/pie-to-qti2, @pie-qti/transform-core
  Last reviewed: 2026-06-23
-->

**Status:** draft
**Type:** architecture
**Packages:** `@pie-qti/to-pie`, `@pie-qti/pie-to-qti2`, `@pie-qti/transform-core`
**Last reviewed:** 2026-06-23

---

## Summary

PIE projection adapters map accepted `pie-players` shared projection contracts into QTI/PCI content, runtime, and reporting concepts. `pie-qti` owns QTI semantics, XML/profile mapping, PCI packaging decisions, and validation. `pie-players` owns the projection types for interaction events, score/outcome projections, media metadata, evidence metadata, and named section slices.

---

## Background and rationale

`pie-qti` already has PRDs for QTI players, PIE to QTI content transforms, QTI to PIE content transforms, response processing, and PCI execution. Those PRDs cover content interchange and QTI runtime behavior. They do not yet cover the newer `pie-players` projection contracts planned for event streams, score rollups, media/evidence metadata, and section profile state.

The adapter work should consume those projection contracts once they exist. It should not redefine PIE event, score, media, evidence, or section slice types. That separation keeps PIE runtime code from becoming standards-specific while letting QTI mappings be explicit about lossless, lossy, unsupported, or profile-specific behavior.

---

## QTI specification alignment

- **Spec version(s):** QTI 2.2 and QTI 3.0, depending on the existing transform path and PCI target.
- **Spec section(s):** assessment item/test outcome declarations and response processing, media interactions, upload/drawing interactions, rubric/shared stimulus constructs, and QTI 3.0 Portable Custom Interaction packaging.
- **Supported attributes:** to be defined by the specific transform or runtime PRDs that implement each mapping.
- **Deliberately omitted attributes:** anything that requires a non-existent PIE projection contract or an unvalidated conformance claim.
- **Known divergences from spec:** PIE timed-media, branching, and simulation section slices may require PIE profile/extensions rather than native QTI constructs. Each divergence must be documented as lossless, explicitly lossy, or unsupported.

---

## Functional requirements

- **FR-1:** Adapter code MUST import accepted projection contracts from their owning `pie-players` package rather than redefining parallel TypeScript types in `pie-qti`.
- **FR-2:** Interaction event mapping MUST preserve full versioned `pie-*--version-*` tag names and contract identifiers such as `id`, `model-id`, and `session-id` in traces or extension data.
- **FR-3:** Score/outcome mapping MUST preserve the distinction between absent score, zero score, not scorable, manual pending, preview score, external score, and final or server-authoritative score.
- **FR-4:** Completion mapping MUST remain separate from correctness and score aggregation.
- **FR-5:** Media metadata mapping MUST consume the accepted `pie-players` media asset contract and document any mapping loss to QTI media, stimulus, package, or catalog constructs.
- **FR-6:** Evidence metadata mapping MUST keep upload, storage, review, audit, retention, and privacy host-owned.
- **FR-7:** PCI export or wrapping MUST not collapse normal PIE child item/session/outcome structure into an opaque custom interaction unless a later PRD explicitly accepts that loss.
- **FR-8:** Section profile round-trip MUST map only ratified typed slices. Timed-media mapping may proceed after its `pie-players` PRD is reviewed; branching and simulation mappings remain deferred until their owning PRDs define typed semantics.
- **FR-9:** Adapter output MUST label mappings as lossless, explicitly lossy, unsupported, or extension/profile-specific.
- **FR-10:** No QTI/PCI conformance claim may be made until a concrete validation suite exists for the adapter behavior being claimed.

---

## Non-functional requirements

- **Accessibility:** Adapter mappings must preserve captions, transcripts, labels, descriptions, and accessibility-relevant runtime metadata where the source projection provides them.
- **Performance:** Projection mapping should not require full player runtime execution when content/static metadata transforms are sufficient.
- **Cross-platform:** Adapter packages should remain usable in Bun and Node.js where existing transform packages support both.
- **Security:** Adapter code must treat PIE markup, media URLs, transcript HTML, evidence references, and PCI modules as untrusted input unless a caller explicitly provides a trusted source.
- **i18n:** Language metadata from media tracks, transcripts, QTI XML, and PIE projections must be preserved where supported.

---

## Design decisions

### PIE projections are the source of truth

**Decision:** `pie-qti` consumes accepted `pie-players` projection types and does not define competing event, score, media, evidence, or section slice contracts.
**Rationale:** Shared contracts are meant to support multiple adapters and hosts. Duplicating them in `pie-qti` would create drift and make standards mapping influence runtime contracts prematurely.
**Alternatives considered:** Define QTI-first projection types in this repo and ask `pie-players` to conform.
**Consequences:** Adapter PRDs and code may need to wait for accepted or reviewed `pie-players` contracts before implementing detailed mappings.

### One adapter architecture PRD comes before per-contract mapping PRDs

**Decision:** This PRD establishes the adapter boundary first. Per-contract mapping PRDs should be split later only when the shared contracts are accepted and the mapping details exceed this document.
**Rationale:** Creating many mapping PRDs before source contracts exist would duplicate unstable vocabulary.
**Alternatives considered:** Create separate PRDs for event, score, media, evidence, PCI export, and section profile mapping immediately.
**Consequences:** This PRD carries high-level requirements and defers fine-grained acceptance criteria until concrete mappings are scoped.

### Whole-experience PCI wrapping is not the default

**Decision:** PIE child items should remain visible to normal item/session/outcome contracts. PCI export can be considered for element-level or package-level portability, but an opaque wrapper around an entire timed-media section is not the default strategy.
**Rationale:** Opaque wrapping hides child item sessions, score components, and section state, making QTI interoperability and reporting weaker.
**Alternatives considered:** Export timed-media sections as one custom PCI interaction.
**Consequences:** Timed-media and section-profile mappings likely need PIE profile/extensions rather than only standard PCI packaging.

---

## Extension points

| Extension point | Interface/type | How to use | Example |
| --------------- | -------------- | ----------- | ------- |
| Projection import boundary | Accepted `pie-players` exports | Import projection types from their owner package | Score mapping imports the accepted score component type |
| QTI mapping strategy | Existing transform packages | Implement lossless/lossy/profile-specific mappings in `to-pie` or `pie-to-qti2` | Timed media becomes a PIE profile extension on assessment sections |
| PCI packaging | `customInteraction` / PCI support | Package compatible PIE components only after preserving required session/outcome semantics | A leaf custom element exported as PCI |
| Validation | Existing spec/eval/test harnesses | Add fixtures and validation suites before conformance claims | QTI package validates exported outcome declarations |

---

## Data model / contracts

This PRD does not define new PIE projection types. It references these future or draft `pie-players` contracts:

- `pie-players/docs/prds/shared-contracts/interaction-event-contract.md`
- `pie-players/docs/prds/shared-contracts/score-components-and-section-outcomes.md`
- `pie-players/docs/prds/shared-contracts/media-asset-contract.md`
- `pie-players/docs/prds/shared-contracts/evidence-capture-metadata.md`
- `pie-players/docs/prds/timed-media-section-contract.md`

Adapter-specific mapping results should include source projection version, target QTI version/profile, mapping status, diagnostics for omitted or transformed fields, and fixture ids for round-trip verification.

---

## Acceptance criteria

### Functional

- **AC-1:** Given an accepted `pie-players` event projection with a versioned PIE element tag, when it is mapped to QTI trace or extension data, then the full tag and contract identifiers are preserved unchanged.
- **AC-2:** Given score components for zero score, absent score, not scorable, and manual pending, when they are mapped to QTI outcomes, then each state remains distinguishable in adapter diagnostics or output.
- **AC-3:** Given media metadata with captions and transcript references, when it is mapped to QTI media/stimulus structures, then captions, transcript references, language metadata, and lossy omissions are reported.
- **AC-4:** Given learner evidence metadata, when it is mapped to QTI upload/drawing/file response concepts, then the adapter does not imply PIE-owned storage, review, retention, or audit behavior.
- **AC-5:** Given a timed-media section slice, when the timed-media contract is still draft or unreviewed, then detailed QTI mapping remains deferred rather than inventing slice semantics in this repo.

### Accessibility

- **AC-A1:** Given media metadata that includes captions, transcript, label, and description, when it is transformed, then accessibility-relevant fields are preserved or diagnostics identify any unsupported target construct.
- **AC-A2:** Given an adapter output that packages a custom interaction or PCI module, when accessibility responsibilities move to the packaged module, then the PRD or diagnostics state that boundary explicitly.

### Edge cases

- **AC-E1:** Given an unknown projection version, when mapping is attempted, then state-bearing mappings fail with a diagnostic instead of silently producing QTI output.
- **AC-E2:** Given a section slice for branching or simulation before an owning PRD defines semantics, when mapping is attempted, then the adapter reports unsupported/deferred rather than round-tripping an untyped bag.

---

## Open questions

- [ ] Should detailed adapter mappings eventually split into per-contract PRDs under `architecture/`, or should `docs/prds/INVENTORY.md` grow a first-class adapter category?
- [ ] Which package should own adapter implementation if mappings do not fit cleanly into `@pie-qti/to-pie` or `@pie-qti/pie-to-qti2`?
- [ ] What validation suite is sufficient before claiming any QTI/PCI conformance for PIE projection mapping?
- [ ] How should PIE profile/extensions be represented in QTI packages for timed-media sections?

---

## Related

- QTI spec: IMS QTI 2.2 and IMS QTI 3.0 outcomes, response processing, media interactions, upload/drawing interactions, and PCI.
- Implementation: `packages/to-pie`, `packages/pie-to-qti2`, `packages/transform-core`, `packages/item-player`.
- Adjacent PRDs: `architecture/qti-to-pie.md`, `architecture/pie-to-qti.md`, `architecture/transform-engine.md`, `interactions/custom.md`.
- Cross-repo dependencies: `pie-players/docs/prds/shared-contracts/` and `pie-players/docs/prds/timed-media-section-contract.md`.
