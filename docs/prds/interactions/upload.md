# PRD: uploadInteraction

<!--
  Status: draft
  Type: interaction
  Packages: @pie-qti/default-components, @pie-qti/item-player
  QTI type: uploadInteraction
  Last reviewed: 2026-04-28
-->

**Status:** draft
**Type:** interaction
**Packages:** `@pie-qti/default-components`, `@pie-qti/item-player`
**Last reviewed:** 2026-04-28

---

## Summary

`uploadInteraction` allows a candidate to submit a file as their response to an assessment item. The uploaded file becomes the value of a response variable with `baseType="file"` and `cardinality="single"`. Because a file is opaque binary content, no automated scoring is possible — scoring is always human or external-system-driven. The player converts the file to a base64 data URL and holds it in memory as a serializable `QTIFileResponse` object; there is no out-of-the-box server upload. MIME type restrictions can limit acceptable file formats via `<fileType>` child elements.

---

## Background and rationale

### Why file responses can't be machine-scored

QTI response processing operates over structured values (`identifier`, `string`, `integer`, etc.). The `file` baseType is explicitly excluded from all standard response processing operators (`match`, `mapResponse`, etc.) because the engine has no way to compare binary blobs in a specification-defined manner. Items using `uploadInteraction` therefore omit `<correctResponse>` and either omit `<responseProcessing>` or use an empty/noop processing block. Scoring happens offline: a human grader or an external marking service retrieves the submitted file and sets the `SCORE` outcome variable outside the item session.

### File storage: base64 in session state

The QTI spec says the `file` baseType "contains the content of the file together with information about its name and MIME type" but deliberately leaves the storage mechanism unspecified. Two approaches are common in practice:

1. **Inline base64** — encode the file content into the session state object and transmit it with the rest of the responses when the session is submitted. Simple, no extra server endpoint required, but scales poorly for large files.
2. **Server-side upload** — upload the file to a storage backend during or immediately after selection; store a URI reference in the response variable.

This implementation uses **approach 1**: `FileUpload.svelte` reads the file with `FileReader.readAsDataURL()` and stores the resulting `data:<mime>;base64,<content>` string inside a `QTIFileResponse` object in reactive state. The entire object is included in the session snapshot when `Player.getSession()` is called.

The consequence is that large files (multi-megabyte PDFs, high-resolution images) will produce large session payloads. There is currently **no enforced size limit** — the browser will hold whatever the user selects in memory. The host application is responsible for any upload-time size validation it needs. This is an intentional tradeoff: the player is a rendering layer, not a storage service. Adding a size gate inside the component would require a configurable prop (no standard QTI attribute for this), and that API has not been designed yet (see Open questions).

### Why MIME restriction uses `<fileType>` child elements, not the `type` attribute

The QTI 2.x spec defines a `type` attribute on `uploadInteraction` for MIME type constraints. However, QTI 3.0 moves to `<fileType>` child elements (allowing multiple types and richer structure). The extractor reads `<fileType>` child elements to future-proof for QTI 3.0 and because content packages already in the wild use the child-element form. The `type` attribute is still available through `rawAttributes` if a content author used it, but the component does not map it to the `accept` filter automatically. This is a known spec gap (see QTI alignment section).

### Why client-side type validation is best-effort

The `accept` attribute on `<input type="file">` is advisory — the OS file picker may or may not enforce it, and a user can dismiss the filter on most platforms. The component therefore re-validates file type after selection by checking the file's MIME type and name extension against the `fileTypes` array. This is defense-in-depth: the HTML `accept` attribute limits what the picker shows; the JavaScript check catches bypasses. Neither is a security boundary — real enforcement must happen server-side.

---

## QTI specification alignment

- **Spec version(s):** QTI 2.1, QTI 2.2, QTI 3.0
- **Spec section(s):** §3.4.4 uploadInteraction (QTI 2.x); QTI 3.0 §6 (uploadInteraction definition carried forward)

### Supported attributes

| Attribute / element | Source | Behavior |
|---------------------|--------|----------|
| `responseIdentifier` | Attribute | Required. Binds to a `responseDeclaration` with `baseType="file"` and `cardinality="single"`. Passed through to the change event identifier and `<input id>`. |
| `<prompt>` | Child element | Optional. HTML content rendered as the visible label above the file input. If absent, falls back to the i18n key `interactions.upload.label`. |
| `<fileType>` | Child elements | Optional. Each element text content is a MIME type string (e.g. `application/pdf`, `image/*`) or file extension (e.g. `.pdf`). Joined as the HTML `accept` attribute value and used for client-side validation. Empty list means accept any file. |

### Deliberately omitted attributes

| Attribute | Reason |
|-----------|--------|
| `type` (QTI 2.x attribute) | The QTI 2.x `type` attribute is preserved in `rawAttributes` but is **not** used to populate `fileTypes` or the `accept` filter. Authors targeting this player should use `<fileType>` child elements. No migration path is provided yet. |
| `class` / `xml:lang` / `label` | QTI base-class attributes. Preserved in `rawAttributes` but not acted on. `xml:lang` would need RTL/lang propagation into the shadow DOM — not implemented. |

### Known gaps

- **`type` attribute not mapped to `fileTypes`** — Content using `<uploadInteraction type="application/pdf">` will not restrict the file picker. The extractor reads only `<fileType>` children. A future fix should parse the `type` attribute and merge its tokens into `fileTypes` when no `<fileType>` children are present.
- **No file size attribute** — Neither QTI 2.x nor 3.0 defines a max file size attribute. The implementation has no size cap. Large files cause large session payloads.
- **`correctResponse` always empty** — The QTI spec technically allows a `correctResponse` of `baseType="file"` (the expected file content), but no known scoring scenario uses it and the response processing engine does not support comparing `file` values. Items must not declare a `correctResponse` for `uploadInteraction`.
- **Human scoring integration is out of scope** — The player does not define how the submitted `QTIFileResponse` reaches a human grader. That is a host-application concern.

---

## Functional requirements

- **FR-1:** When a candidate selects a valid file, the interaction stores a `QTIFileResponse` containing `name`, `type`, `size`, `lastModified`, and `dataUrl` (base64 data URL) as the value of the bound response variable.
- **FR-2:** When `<fileType>` child elements are present, the file input's `accept` attribute is set to the comma-joined list of those values, guiding (but not enforcing) the OS picker.
- **FR-3:** After a file is selected, if its MIME type and filename extension do not match any entry in `fileTypes`, the component clears the selection, sets the response to `null`, and displays a localized error message naming the allowed types.
- **FR-4:** When a valid file is selected, the component displays the file name, MIME type, and size below the input.
- **FR-5:** A "Remove file" button clears the current selection and sets the response to `null`, returning the interaction to an unanswered state.
- **FR-6:** When `disabled=true`, the file input and the remove button are both non-interactive and do not accept new input or trigger change events.
- **FR-7:** If no `<fileType>` elements are present, any file is accepted; the extractor emits a warning (not an error) at extraction time.
- **FR-8:** The interaction dispatches a `qti-change` custom event on the host element whenever the response changes, carrying `{ responseId, value }` where `value` is a `QTIFileResponse` or `null`.
- **FR-9:** The interaction renders an error state with a localized message if `interaction` prop is absent or unparseable.
- **FR-10:** The response variable is of type `QTIFileResponse` (not a native browser `File` object) so that session state can be serialized to JSON and restored across page reloads.

---

## Non-functional requirements

### Accessibility

WCAG 2.2 Level AA requirements specific to this interaction:

- The file `<input>` must have a programmatically associated `<label>` via matching `id`/`for` values. The label text comes from the `<prompt>` element or the i18n fallback.
- The grouping `<div>` carries `role="group"` and `aria-label` equal to the displayed label text, providing a landmark boundary for screen reader navigation.
- Error messages (invalid file type, read failure) must be perceivable by screen readers. Currently the error is rendered as a visible `alert`-styled `<div>` but has no `role="alert"` or `aria-live` attribute — **this is a gap** (see Open questions).
- Upload status changes (file selected, file removed) must be announced. Currently there is no live region for success states — **this is a gap**.
- Touch target for the remove button must meet the WCAG 2.2 SC 2.5.8 minimum (24×24 CSS px). The current `btn btn-sm` DaisyUI class produces a ≥ 32px target; verify this is preserved across all active themes.
- The file input itself is natively keyboard-focusable (Tab) and activatable (Enter/Space) without JavaScript modification. No ARIA augmentation is needed beyond the label association.

### Performance

- The base64 encoding step (`FileReader.readAsDataURL`) is synchronous-in-effect from the user's perspective: the UI blocks briefly for large files. Files larger than a few MB will cause noticeable latency. No progress indicator is shown during encoding. This is acceptable for the K-12 document submission use case (typically PDFs ≤ 5 MB) but would need a rework for video uploads.
- The `dataUrl` string is held in Svelte reactive state and re-rendered on every parent re-render. For large files this is a significant memory footprint. No virtualization or lazy-load strategy exists.

### Cross-platform

- On iOS Safari and Android Chrome, `<input type="file">` opens the native OS file picker or camera roll. The `accept` attribute filters shown file types on most mobile OSes, but behavior varies by device. The remove button must be touch-accessible (tap area ≥ 44×44 CSS px per iOS HIG; the `btn btn-sm` class may fall short — verify manually).
- Camera capture is not explicitly enabled or disabled. Browsers may surface camera as an option for `image/*` file types. This is OS-controlled and outside the component's scope.

### Security

- Uploaded file content is stored as a base64 data URL in the session object. If the session is persisted server-side, the server must not execute or render the file content from the data URL without sanitization. The player makes no guarantees about file content safety.
- The component does not validate file content (only MIME type and extension). A file named `malware.pdf` with `Content-Type: application/pdf` but executable payload will pass client-side validation. Server-side virus scanning is the host application's responsibility.
- The `<input type="file">` element is a standard browser security boundary — scripts cannot pre-populate it with arbitrary content.

### i18n

The following i18n keys must be provided by the host's `I18nProvider`:

| Key | Default fallback | Usage |
|-----|-----------------|-------|
| `interactions.upload.label` | `'Upload a file'` | Fallback label when no `<prompt>` is present |
| `interactions.upload.allowedTypes` | key string | Prefix for the allowed-types hint line |
| `interactions.upload.selectedFile` | key string | Label before the selected filename |
| `interactions.upload.unknownType` | key string | Shown when `file.type` is empty |
| `interactions.upload.removeFile` | key string | Remove button label |
| `interactions.upload.errorInvalidType` | `'interactions.upload.errorInvalidType {types}'` | Interpolates `{types}` with comma-joined allowed types |
| `interactions.upload.errorReadFailed` | `'Failed to read file'` | Shown if `FileReader` errors |
| `interactions.upload.fileSize` | `'{size} bytes'` | Interpolates `{size}` with byte count |

RTL layout is not explicitly tested. The component uses standard CSS flow and DaisyUI utilities — RTL support depends on DaisyUI theme RTL support and has not been verified.

---

## Design decisions

### Base64 data URL as the serialization format

**Decision:** Files are read with `FileReader.readAsDataURL()` and stored inline in the `QTIFileResponse` object as a `dataUrl` string.

**Rationale:** The `QTIFileResponse` type must be JSON-serializable so that `Player.getSession()` produces a plain object that can be stored in a database or transmitted over HTTP without special handling. A native browser `File` object is not JSON-serializable and cannot survive a page reload or a session restore. A URI-based approach (upload to S3, store the URL) would require an out-of-band server round trip during item interaction, which the player's architecture does not currently support (the player is stateless with respect to storage infrastructure).

**Alternatives considered:** URI-based storage with a pluggable upload hook on the `Player` API. This would scale to large files and avoid base64 bloat (base64 encoding inflates file size by ~33%). It was not implemented because it would require a new extension API surface and host integration work that is orthogonal to the current priority of spec compliance.

**Consequences:** Session payloads can become very large for multi-MB files. The host application must handle large POST bodies or impose its own size limits before calling `Player.getSession()`. Future addition of a pluggable upload hook would be a breaking API change for hosts that currently rely on inline base64.

### Client-side type validation is best-effort, not a hard security gate

**Decision:** File type validation checks MIME type string equality and file name extension suffix. If the check fails, the selection is cleared and an error message is shown. No server-side validation is performed.

**Rationale:** MIME types are set by the browser based on the file extension and OS registry — they are not cryptographically verified. The component can only observe what the browser reports. This is appropriate for guiding honest users (candidates won't accidentally submit the wrong format) but is not a security boundary.

**Alternatives considered:** Reading the file magic bytes to detect actual file type. This was not implemented because it requires embedding a format detection library, adds latency, and is not what the QTI spec describes. The spec says `type` restricts "the type of the file" — this is clearly an authoring-time constraint, not a security control.

**Consequences:** Malicious or careless users can bypass type validation. Host applications that need hard enforcement must validate file content server-side.

### `<fileType>` child elements, not the `type` attribute

**Decision:** The extractor reads `<fileType>` child elements; the QTI 2.x `type` attribute is passed through in `rawAttributes` but is not used to populate `fileTypes`.

**Rationale:** QTI 3.0 uses child elements, making child-element parsing the forward-compatible approach. Content packages that already target QTI 3.0 conventions work correctly. The extractor was written after QTI 3.0 was available, so the new form was chosen.

**Alternatives considered:** Parse `type` attribute and merge with child elements. This is the right eventual behavior (see Open questions), but was deferred because the current content corpus uses child elements.

**Consequences:** Content using `<uploadInteraction type="application/pdf">` (QTI 2.x form) will not have file type restriction applied. Authors must use `<fileType>` children.

### No enforced file size limit

**Decision:** No maximum file size is checked or enforced by the component.

**Rationale:** File size limits are deployment-specific (a school district uploading PDFs has different constraints than a university collecting video submissions). There is no QTI spec attribute for max file size. Adding a hardcoded limit would break valid use cases; adding a configurable prop would require new API design. The decision was to leave this to the host layer.

**Alternatives considered:** A `maxBytes` prop; a hardcoded 10 MB limit. Both were rejected as either premature API commitment or arbitrary restrictions.

**Consequences:** The host application bears full responsibility for size-based rejection. Very large files will degrade performance silently.

---

## Data model / contracts

### `UploadInteractionData`

Defined in `packages/item-player/src/types/interactions.ts`:

```typescript
interface UploadInteractionData extends BaseInteractionData {
  type: 'uploadInteraction';
  prompt: string | null;      // HTML string from <prompt> child, or null
  fileTypes: string[];         // Values from <fileType> children; empty = accept any
  rawAttributes: Record<string, string>;  // All XML attributes verbatim
}
```

`BaseInteractionData` provides `responseId: string` (the `responseIdentifier` attribute value).

### `QTIFileResponse`

Defined in `packages/item-player/src/types/index.ts`:

```typescript
interface QTIFileResponse {
  name: string;          // Original filename (e.g. "essay.pdf")
  type: string;          // MIME type reported by the browser (e.g. "application/pdf")
  size: number;          // File size in bytes
  lastModified: number;  // Unix timestamp (ms)
  dataUrl: string;       // Base64 data URL: "data:<mime>;base64,<content>"
  imageData?: {          // Only set by drawingInteraction; never set by uploadInteraction
    data: Uint8ClampedArray;
    width: number;
    height: number;
  };
}
```

**Invariants:**

- `dataUrl` is always a valid `data:` URL when `QTIFileResponse` is non-null.
- `type` may be empty string if the browser cannot determine the MIME type (some obscure formats, some mobile browsers). The component displays `unknownType` i18n label in this case and does not treat an empty MIME type as a validation failure unless `fileTypes` contains explicit MIME patterns.
- `imageData` is never populated by the upload interaction; it is a `drawingInteraction` concern that shares the same response type.

### Response variable in session

The player's session snapshot stores the `QTIFileResponse` object directly under the `responseIdentifier` key. `InteractionValueMap.uploadInteraction` is declared in `packages/item-player/src/interactions/shared/types.ts` as `QTIFileResponse | null`, matching the QTI `cardinality="single"` behavior.

---

## Acceptance criteria

### Functional

```
AC-1: File selection stores correct response
  Given: an item with uploadInteraction and no fileType restrictions
  When: the candidate selects any valid file
  Then: the response variable contains a QTIFileResponse with the correct
        name, type, size, lastModified, and a non-empty dataUrl beginning
        with "data:"
  Notes: verify via Player.getSession() or the onChange callback
```

```
AC-2: File removal clears response
  Given: a file has been selected (response is non-null)
  When: the candidate clicks the "Remove file" button
  Then: the response variable is null and no file details are displayed
```

```
AC-3: qti-change event fires on selection
  Given: an uploadInteraction rendered as a web component (pie-qti-upload)
  When: a file is selected
  Then: a "qti-change" CustomEvent is dispatched on the host element,
        with detail containing { responseId: <responseIdentifier>, value: <QTIFileResponse> }
```

```
AC-4: qti-change event fires on removal
  Given: a file is currently selected
  When: the candidate clicks Remove file
  Then: a "qti-change" CustomEvent fires with detail.value === null
```

```
AC-5: Type restriction — valid file passes
  Given: uploadInteraction with <fileType>application/pdf</fileType>
  When: the candidate selects a .pdf file
  Then: the file is accepted, QTIFileResponse is stored, no error is shown
```

```
AC-6: Type restriction — invalid file is rejected
  Given: uploadInteraction with <fileType>application/pdf</fileType>
  When: the candidate selects a .docx file (type: application/vnd.openxmlformats...)
  Then: the selection is cleared, response is null, an error message
        listing "application/pdf" as the allowed type is visible
```

```
AC-7: Type restriction — wildcard MIME accepted
  Given: uploadInteraction with <fileType>image/*</fileType>
  When: the candidate selects a .png file (type: image/png)
  Then: the file is accepted (wildcard matching is not required — the
        accept attribute guides the picker; if the browser reports
        image/png, it satisfies image/*)
  Notes: client-side wildcard matching is not currently implemented;
         the accept attribute provides guidance. This AC documents
         expected future behavior once wildcard matching is added.
```

```
AC-8: Extension-based restriction
  Given: uploadInteraction with <fileType>.pdf</fileType>
  When: the candidate selects a file named "report.pdf" (any MIME)
  Then: the file is accepted
```

```
AC-9: No file type restriction — any file accepted
  Given: uploadInteraction with no <fileType> children
  When: the candidate selects any file
  Then: the file is accepted without an error
```

```
AC-10: Allowed types hint displayed
  Given: uploadInteraction with <fileType>application/pdf</fileType>
         and <fileType>image/jpeg</fileType>
  When: the component renders
  Then: a hint line is visible listing "application/pdf, image/jpeg"
        as the allowed types
```

```
AC-11: Disabled state — no interaction
  Given: disabled prop is true
  When: the rendered component is inspected
  Then: the file input has the HTML disabled attribute
        AND the Remove file button (if a file is selected) has the
        disabled attribute
        AND no onChange events fire when the input is programmatically
        triggered
```

```
AC-12: Prompt used as label
  Given: uploadInteraction with <prompt>Upload your essay</prompt>
  When: the component renders
  Then: the visible label text is "Upload your essay" (not the i18n fallback)
```

```
AC-13: Fallback label when no prompt
  Given: uploadInteraction with no <prompt> child
  When: the component renders
  Then: the label text is the resolved value of the i18n key
        "interactions.upload.label" (default: "Upload a file")
```

```
AC-14: Error state when no interaction data
  Given: the interaction prop is null or undefined
  When: the component renders
  Then: an error message is displayed and no file input is rendered
```

```
AC-15: Session serialization survives JSON round-trip
  Given: a file has been selected and stored as QTIFileResponse
  When: Player.getSession() is called and the result is JSON.stringify()d
        then JSON.parse()d
  Then: the restored session contains an equivalent QTIFileResponse with
        the same name, type, size, lastModified, and dataUrl
```

### Accessibility

```
AC-A1: Label association
  Given: the component renders
  When: a screen reader inspects the file input
  Then: the input has an accessible name equal to the prompt text
        (or i18n fallback), provided via a <label> element with a
        matching "for" attribute
```

```
AC-A2: Keyboard operability — file selection
  Given: the component renders and is not disabled
  When: the user presses Tab to focus the file input and presses Enter or Space
  Then: the OS file picker opens
```

```
AC-A3: Keyboard operability — file removal
  Given: a file is selected and the Remove file button is visible
  When: the user presses Tab to focus the Remove file button and presses Enter
  Then: the file is removed and focus remains in the component area
```

```
AC-A4: Error message is announced (gap — current state)
  Given: a file is selected that fails type validation
  When: the error message appears
  Then: a screen reader announces the error message without requiring
        the user to navigate to it
  Notes: the current implementation renders the error in a styled div
         without role="alert" or aria-live. This AC is FAILING until
         an aria-live="assertive" or role="alert" region is added to
         the error container.
```

```
AC-A5: Touch target size
  Given: the component renders on a mobile viewport (375px wide)
  When: the Remove file button is visible
  Then: the button's touch target is at least 44×44 CSS pixels
        (verify with browser DevTools layout inspector)
```

### Edge cases

```
AC-E1: FileReader error
  Given: a file is selected but FileReader.readAsDataURL fails
         (e.g. file is removed from disk between selection and read)
  When: the read error fires
  Then: the response is null and a localized error message is displayed
        (i18n key: interactions.upload.errorReadFailed)
```

```
AC-E2: Empty fileTypes array treated as unrestricted
  Given: UploadInteractionData.fileTypes is an empty array []
  When: the candidate selects any file
  Then: the file is accepted without type validation and no allowed-types
        hint is shown
```

```
AC-E3: type attribute on element (QTI 2.x legacy form) — not enforced
  Given: XML source is <uploadInteraction responseIdentifier="R" type="application/pdf">
         with no <fileType> child elements
  When: the item is loaded and rendered
  Then: the file input has no accept attribute and any file type is accepted
        (because the type attribute is not mapped to fileTypes)
  Notes: this documents the known gap; the behavior is incorrect per QTI 2.x
         spec but is the current implementation reality
```

```
AC-E4: Re-selection replaces previous response
  Given: a valid file has already been selected
  When: the candidate opens the picker again and selects a different file
  Then: the response variable reflects the new file's QTIFileResponse
        and the previous file's details are no longer displayed
```

```
AC-E5: Zero-byte file
  Given: the candidate selects a file with 0 bytes
  When: no fileType restrictions are present
  Then: the file is accepted (size 0 is not an error condition);
        QTIFileResponse.size is 0 and dataUrl is "data:<mime>;base64,"
```

---

## Open questions

- [ ] **Wildcard MIME matching** — `fileTypes: ['image/*']` sets `accept="image/*"` on the input (which the OS picker respects) but the client-side JS check does not currently match `image/png` against `image/*`. Should the component implement RFC 2045-style wildcard subtype matching?
- [ ] **`type` attribute migration** — Should the extractor parse the QTI 2.x `type` attribute and use it when no `<fileType>` children are present? This would fix AC-E3 and improve QTI 2.x content compatibility.
- [x] **Response map type mismatch** — `InteractionValueMap.uploadInteraction` is now typed as `QTIFileResponse | null`, matching `cardinality="single"`.
- [ ] **File size limit API** — Should a `maxBytes` prop (or a QTI extension attribute) be added to support deployment-specific size caps with a user-facing error message? This would address the silent performance degradation described in the storage decision.
- [ ] **Live region for success states** — After a successful file selection, screen readers should announce the selected filename. An `aria-live="polite"` region wrapping the selected-file display is the standard pattern. Should this be added?

---

## Related

- QTI spec: §3.4.4 uploadInteraction in `docs/QTI_techguide.md`
- Response variable semantics: `docs/QTI-RESPONSE-TRACKING-AND-SCORING.md`
- Spec gaps plan: `docs/SPEC-GAPS-PLAN.md` (no existing gap item covers the `type` attribute mapping; the response map mismatch and live region absence are newly documented here)
- Implementation:
  - Component: `packages/default-components/src/plugins/upload/UploadInteraction.svelte`
  - Shared sub-component: `packages/default-components/src/shared/components/FileUpload.svelte`
  - Extractor: `packages/item-player/src/extraction/extractors/uploadExtractor.ts`
  - Response type: `packages/item-player/src/types/index.ts` (`QTIFileResponse`)
  - Interaction data type: `packages/item-player/src/types/interactions.ts` (`UploadInteractionData`)
- Adjacent PRDs: `docs/prds/interactions/extended-text.md` (the other "human-scored, open-ended" interaction)
