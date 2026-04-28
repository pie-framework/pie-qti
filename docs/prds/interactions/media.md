# PRD: mediaInteraction

<!--
  Status: draft
  Type: interaction
  Packages: @pie-qti/default-components, @pie-qti/item-player
  QTI type (interactions only): mediaInteraction
  Last reviewed: 2026-04-28
-->

**Status:** draft  
**Type:** interaction  
**Packages:** `@pie-qti/default-components`, `@pie-qti/item-player`  
**Last reviewed:** 2026-04-28

---

## Summary

`mediaInteraction` is a QTI 2.x interaction that embeds audio or video content and tracks whether the candidate has played it. Unlike most QTI interactions, it does not collect a content-based answer — it tracks engagement. The response variable records the number of times the candidate has completed a full play-through. `minPlays` is the primary enforcement mechanism: the item player blocks submission until the candidate has met the required viewing or listening count. `maxPlays` limits how many times the candidate may re-watch or re-listen after a threshold, which matters for timed or high-stakes contexts where unlimited replays would be unfair.

---

## Background and rationale

### What this interaction is not

`mediaInteraction` is frequently misread as "a question with embedded media." It is not. The media element is the subject of the interaction itself, and the only thing being measured is engagement: did the candidate watch or listen, and how many times? Comprehension is measured by separate interactions in the same item body (e.g., `choiceInteraction` or `extendedTextInteraction` that appear after the media block).

This distinction matters for response processing: the `correctResponse` for a `mediaInteraction` response variable is a play count threshold, not a semantic answer. Scoring logic uses `gte` comparison against `minPlays`, not `match` against a correct identifier.

### Why play count rather than a boolean

The QTI spec defines the response variable as `baseType="integer"` with `cardinality="single"`, storing the raw play count. A boolean ("has the candidate played it at all") can be derived from `playCount >= 1`, but storing the integer lets item authors set richer requirements — "listen at least 3 times before answering" is a legitimate pedagogical choice for pronunciation drills or complex audio passages. The integer representation subsumes the boolean case while adding no implementation cost.

### When `minPlays` matters pedagogically

In K-12 ELA and science assessments, a common use case is: show a stimulus video or audio clip, then ask comprehension questions. `minPlays > 0` ensures candidates can't skip the stimulus entirely and guess at the questions. This is the primary enforcement mechanism in the framework — the item player's `canSubmitResponses()` returns `false` when `playCount < minPlays`, blocking the Submit button.

### When `maxPlays` matters

`maxPlays > 0` caps replay count. Assessment designers use this in two scenarios:
1. **Timed listening tests** (e.g., listening comprehension with a strict hearing-once rule).
2. **Equity enforcement** — ensuring all candidates have the same number of replays available.

When `maxPlays = 0` (the default), replay is unlimited. The component enforces `maxPlays` by intercepting the `playing` event and cancelling it after the limit is reached, and by suppressing the `loop` attribute on the native element when `maxPlays > 0`.

### How the media element is embedded

In QTI 2.1, the spec required an `<object>` element inside `mediaInteraction`. QTI 2.2 and QTI 3.0 added support for native `<audio>` and `<video>` child elements. The framework supports all three forms. In practice, `<audio>` and `<video>` are strongly preferred:

- They render with browser-native accessible controls.
- They support `autoplay`, `loop`, and `controls` attributes directly.
- They do not require plugin support (Flash, QuickTime) which `<object>` historically did.

The `<object>` path is kept for backward compatibility with QTI 2.1 items. It renders as an HTML `<object>` element, which has no native play events and therefore cannot drive `minPlays`/`maxPlays` enforcement. The `allowObjectEmbeds` security flag must also be explicitly enabled by the host application (see Design Decisions).

### Why play completion, not play start, increments the counter

A "play" is counted on the media `ended` event, not the `play` event. This is a deliberate choice: a candidate who clicks play and immediately pauses or skips to the end without watching should not receive credit. The `ended` event fires when playback reaches the natural end of the media. This is consistent with the spec's intent that `minPlays` measures actual viewing/listening, not button-pressing.

The consequence is that very long media (e.g., a 20-minute video) will not increment the counter until it finishes. Item authors must size media appropriately for the assessment context.

---

## QTI specification alignment

- **Spec version(s):** QTI 2.1, QTI 2.2, QTI 3.0
- **Spec section(s):** §3.4.2 (PIE-QTI tech guide); IMS QTI 2.2 §4.1 Assessment Item Information Model — `mediaInteraction`

### Response variable semantics

The response variable bound via `responseIdentifier` must be declared as:

```xml
<responseDeclaration identifier="MEDIA_RESPONSE" cardinality="single" baseType="integer"/>
```

The value stored is the integer play count (number of times the `ended` event has fired). There is no `correctResponse` in the semantic sense — scoring is done with a `gte` comparison in `responseProcessing`:

```xml
<responseProcessing>
  <responseCondition>
    <responseIf>
      <gte>
        <variable identifier="MEDIA_RESPONSE"/>
        <baseValue baseType="integer">2</baseValue>  <!-- minPlays value -->
      </gte>
      <setOutcomeValue identifier="SCORE">
        <baseValue baseType="float">1.0</baseValue>
      </setOutcomeValue>
    </responseIf>
    <responseElse>
      <setOutcomeValue identifier="SCORE">
        <baseValue baseType="float">0.0</baseValue>
      </setOutcomeValue>
    </responseElse>
  </responseCondition>
</responseProcessing>
```

### Supported attributes

| Attribute | Required | Type | Default | Implemented | Notes |
|-----------|----------|------|---------|-------------|-------|
| `responseIdentifier` | Yes | xs:identifier | — | Yes | Bound to `single / integer` response variable |
| `autostart` | No | boolean | `false` | Yes | Maps to HTML `autoplay` on `<audio>`/`<video>` |
| `minPlays` | No | xs:integer ≥ 0 | `0` | Yes | Blocks submission until play count reaches this value |
| `maxPlays` | No | xs:integer ≥ 0 | `0` | Yes | `0` = unlimited; > 0 caps replay and blocks further play |
| `loop` | No | boolean | `false` | Yes | Suppressed when `maxPlays > 0`; otherwise maps to HTML `loop` |
| `showControls` | No | boolean | `true` | **No** | QTI 2.2 spec attribute; not extracted; controls are always shown |
| `pausable` | No | boolean | `true` | **No** | QTI 2.2 spec attribute; not extracted; native controls always allow pause |
| `class` | No | string | — | No | QTI generic styling attribute; not extracted |
| `label` | No | string | — | No | QTI generic accessibility attribute; not extracted |
| `id` | No | xs:identifier | — | No | QTI generic identifier; not used by this component |

### Deliberately omitted attributes

**`showControls`** — The spec allows hiding the native browser controls. This is deliberately omitted: without controls, there is no keyboard-accessible way to play audio/video, which violates WCAG 2.2 SC 2.1.1 (Keyboard) and SC 1.4.2 (Audio Control). Hiding controls creates a trap where keyboard-only users cannot start playback at all. Item authors who need a custom player skin should implement a PCI.

**`pausable`** — The spec allows preventing candidates from pausing. This is deliberately omitted: preventing pause forces candidates to re-listen from the start if they are interrupted, which disproportionately disadvantages candidates with attention or processing speed needs. WCAG 2.2 SC 2.2.2 (Pause, Stop, Hide) additionally requires that moving, blinking, or auto-playing content be pausable. A future implementation could enforce this only for non-auto-playing content, but it is out of scope here.

### Known gaps

No items from `docs/SPEC-GAPS-PLAN.md` (G-01 through G-15) directly affect `mediaInteraction`. The gaps related to `showControls` and `pausable` are documented above as deliberate omissions rather than tracked gaps.

**`object` element and play tracking:** The spec does not define a mechanism for tracking play count when an `<object>` embed is used. The framework's `object` rendering path has no `ended` event, so `minPlays`/`maxPlays` enforcement does not function for `object`-type media. This is a spec ambiguity, not a framework bug — the spec predates HTML5 native media elements. See Design Decisions.

---

## Functional requirements

- **FR-1:** The component shall render audio media using a native HTML `<audio>` element with browser-native controls when the extracted `mediaElement.type` is `'audio'`.
- **FR-2:** The component shall render video media using a native HTML `<video>` element with browser-native controls when the extracted `mediaElement.type` is `'video'`.
- **FR-3:** The component shall render legacy `object`-type media using an HTML `<object>` element when the extracted `mediaElement.type` is `'object'` and `allowObjectEmbeds` is `true`.
- **FR-4:** The play count shall increment by 1 each time the `ended` event fires on the media element (i.e., the candidate completes a full play-through).
- **FR-5:** The component shall emit a `qti-change` event carrying the updated play count as the value whenever the play count increments.
- **FR-6:** When `minPlays > 0`, the component shall display a visible indicator showing how many plays are required and how many remain.
- **FR-7:** When `minPlays > 0`, the item player shall prevent submission (`canSubmitResponses` returns `false`) until the play count meets or exceeds `minPlays`.
- **FR-8:** When `maxPlays > 0` and the play count reaches `maxPlays`, the component shall prevent further playback by intercepting the `playing` event and halting it.
- **FR-9:** When `maxPlays > 0` and the limit is reached, the component shall display a visible "Maximum play limit reached" alert.
- **FR-10:** When `autostart` is `true`, the media element shall attempt autoplay on mount. Browser autoplay policies may suppress this (see Non-functional requirements).
- **FR-11:** When `loop` is `true` and `maxPlays = 0`, the media element shall loop indefinitely. Each completed loop shall increment the play count.
- **FR-12:** When `loop` is `true` and `maxPlays > 0`, the component shall manually restart playback after each `ended` event until `maxPlays` is reached, then stop. The native `loop` attribute shall not be set on the HTML element in this case.
- **FR-13:** A `<prompt>` child element, if present, shall be rendered as formatted HTML above the media element.
- **FR-14:** The extractor shall throw an error if no `<audio>`, `<video>`, or `<object>` child element is found inside `<mediaInteraction>`.
- **FR-15:** The extractor shall throw an error if an `<audio>` or `<video>` element contains no `<source>` children.
- **FR-16:** The extractor shall use only the first `<source>` element when multiple are present (browser fallback ordering is not replicated).
- **FR-17:** The extractor shall validate that `maxPlays >= minPlays` when `maxPlays > 0`, and return an error if violated.
- **FR-18:** When `interaction` data is absent or null, the component shall render an error alert rather than a blank or broken state.
- **FR-19:** The response prop shall be kept in sync with the internal play count; restoring a serialized play count via the `response` prop shall update the internal counter without triggering additional change events.

---

## Non-functional requirements

### Accessibility

`mediaInteraction` has stricter accessibility constraints than most interactions because it deals with time-based media, which WCAG addresses specifically.

- **Captions (WCAG 2.2 SC 1.2.2, Level A):** Video content that contains speech or meaningful audio must have synchronized captions. The framework renders native `<video>` elements; item authors are responsible for including `<track kind="captions">` elements in the QTI source. The framework does not validate caption presence at runtime, but item validation tooling should warn when a `<video>` lacks a caption track.
- **Audio descriptions (WCAG 2.2 SC 1.2.5, Level AA):** Video content where visual information is not conveyed in the audio track requires an audio description track. Again, item author responsibility; the framework renders whatever tracks the QTI source declares.
- **Transcript for audio (WCAG 2.2 SC 1.2.1, Level A):** Audio-only content requires a text transcript accessible to screen reader users. The framework does not auto-generate transcripts. Item authors must include a linked or inline transcript in the item body adjacent to the `<mediaInteraction>`.
- **Autoplay and audio control (WCAG 2.2 SC 1.4.2, Level A):** Audio that plays for more than 3 seconds automatically must have a mechanism to pause, stop, or mute it. Setting `autostart="true"` on an item that contains audio therefore requires that browser-native controls be visible — which they always are in this implementation. The constraint is documented because item authors sometimes request `autostart` without realizing it conflicts with this SC.
- **Keyboard access (WCAG 2.2 SC 2.1.1, Level A):** Browser-native `<audio controls>` and `<video controls>` are fully keyboard-operable in all major browsers (spacebar plays/pauses; arrow keys adjust volume/seek). This is a core reason `showControls` was not implemented as a hideable attribute.
- **Play count status (WCAG 2.2 SC 4.1.3, Status Messages, Level AA):** The play count and minPlays progress indicator must be perceivable by assistive technology users. The stats section renders as visible text; it does not currently use `role="status"` or `aria-live` to announce updates to screen reader users. This is an open accessibility gap.
- **Touch targets (WCAG 2.2 SC 2.5.5, Level AA):** The native media controls are rendered by the browser and are not controlled by this component. On mobile, browser-rendered controls meet touch target requirements.
- **Focus management:** No custom focus management is needed; the media element itself is focusable.

### Performance

- Media files are not bundled or preprocessed by the framework. Delivery performance depends on the hosting infrastructure.
- The component does not preload media by default (browser default for `<audio>`/`<video>` without a `preload` attribute is `metadata`). Item authors should set `preload` via QTI source if faster start is needed.
- No constraints on bundle size beyond the base Svelte component weight.

### Cross-platform / mobile

- On iOS Safari, autoplay with audio is blocked by default regardless of the `autostart` attribute. Safari permits autoplay only for muted video. Item authors relying on `autostart="true"` for audio should be aware of this and ensure the item design does not depend on autoplay working.
- On Android Chrome, autoplay is governed by a media engagement score. Similarly unreliable for new domains.
- Native video players on iOS take over the display in fullscreen when the user taps the play button in some contexts. The `<video>` element's `playsinline` attribute is not currently set by the framework, which means iOS may show the fullscreen player. This affects `maxPlays` enforcement: if the user leaves the in-page player, the `ended` event still fires, so play counting remains correct.
- The stats section (play count, minPlays badge) is designed with `flex-wrap` to reflow on narrow screens.

### Security

- The media element `src` URL is run through the item player's `sanitizeResourceUrl()` with `kind='media'` (or `kind='object'` for `<object>` elements) before being passed to the component. URL policies that block cross-origin media will prevent the media from loading.
- `<object>` embeds are blocked by default. The host application must set `config.security.allowObjectEmbeds = true` to enable `object`-type rendering. This opt-in prevents XSS vectors from legacy QTI items that embed arbitrary HTML via `<object>`.
- The `prompt` field is rendered via `{@html}` (injected HTML). It goes through the item player's HTML sanitizer before extraction, which strips dangerous tags and attributes.

### i18n

- The component uses `i18n.t()` for all user-visible strings: `'interactions.media.maxPlayLimitReached'`, `'interactions.media.ariaLabel'`, and the `'common.errorNoData'` fallback.
- Plural handling for the "Play at least N time(s)" badge uses an inline ternary rather than the i18n framework's plural rules. If the i18n framework adds plural support, this inline ternary should be migrated.

---

## Design decisions

### Play counted on `ended`, not on `play`

**Decision:** Increment the play count when the media `ended` event fires (full completion), not when the `play` event fires (playback start).  
**Rationale:** The spec's intent for `minPlays` is to ensure the candidate actually listened or watched, not merely clicked play. A candidate who clicks play and immediately pauses or seeks to the end without engaging has not meaningfully completed a play. Counting on `ended` is the defensible interpretation for engagement tracking.  
**Alternatives considered:** Counting on `play` (start of playback). Simpler, but allows trivially defeating `minPlays` by starting and immediately pausing.  
**Consequences:** Item authors must keep media reasonably short if they use `minPlays > 1`, since each play must be completed in full. Test runners (including automated eval tools) must simulate playback to end rather than just triggering `play`.

### `loop` deferred to manual restart when `maxPlays > 0`

**Decision:** When `loop=true` and `maxPlays > 0`, the HTML `loop` attribute is not set on the native element. Instead, the component manually calls `mediaElement.play()` after each `ended` event until `maxPlays` is reached.  
**Rationale:** If the native `loop` attribute is set, the `ended` event does not fire (the element loops without reaching "natural end"), making play counting impossible. Manual restart allows the `ended` event to fire on each pass.  
**Alternatives considered:** Using `timeupdate` events to count loops when `loop` is set natively. More complex, timing-sensitive, and unreliable across browsers.  
**Consequences:** A very brief gap exists between each loop (the time between `ended` firing and `play()` being called). For most practical media this is imperceptible.

### `object` element support without play tracking

**Decision:** `<object>` embeds render the HTML `<object>` element as-is, with an `aria-label` but no play event tracking.  
**Rationale:** HTML `<object>` has no standardized `ended` or `play` events. There is no reliable cross-browser mechanism to detect playback completion for arbitrary object embeds. Implementing play tracking for `object` would require embedding a wrapper or intercepting proprietary plugin events.  
**Alternatives considered:** Blocking `object` embeds entirely. Not done because QTI 2.1 items legitimately use `<object>` and backward compatibility matters.  
**Consequences:** `minPlays` and `maxPlays` enforcement does not function for `object`-type media. Item authors using `<object>` should not set `minPlays > 0`. This is a known limitation, not a bug.

### `allowObjectEmbeds` opt-in security flag

**Decision:** `<object>` embeds are blocked by default and require the host to set `config.security.allowObjectEmbeds = true`.  
**Rationale:** `<object>` can embed arbitrary content including HTML pages, Flash, and other executable content. The default-deny stance prevents legacy QTI items with embedded active content from executing in a modern host without explicit host consent.  
**Alternatives considered:** Blocking `<object>` entirely. Rejected because it breaks QTI 2.1 compliance.  
**Consequences:** Out-of-the-box, `object`-type media silently fails to render (the component will receive `allowObjectEmbeds: false`). Hosts that serve QTI 2.1 content with `<object>` media must opt in. The component does not currently render a fallback message when `allowObjectEmbeds` is false and the media type is `object` — it renders the `<object>` element regardless, leaving it to the browser to handle the absent permission.

### Response type is always `integer`, not `boolean`

**Decision:** The response variable is always `baseType="integer"` storing the raw play count.  
**Rationale:** Storing an integer rather than a boolean allows item authors to score on replay count (e.g., "listened 3+ times = full credit; listened 1-2 times = partial credit"). The spec mandates `integer`. The framework does not support `boolean` responses for this interaction type.  
**Alternatives considered:** Supporting `boolean` as an alternative. Not pursued — it is not in the spec and adds no value that the integer type doesn't provide.  
**Consequences:** Response processing templates like `match_correct` do not apply directly to this interaction. Item authors must write custom `responseProcessing` using `gte`/`gt`/`equal` comparisons.

---

## Data model / contracts

### `MediaInteractionData` (extracted data passed to component)

Defined in `packages/item-player/src/types/interactions.ts`:

```typescript
interface MediaElement {
  type: 'audio' | 'video' | 'object';
  src: string;          // Sanitized URL (after URL policy applied)
  mimeType: string;     // MIME type from <source type="..."> or <object type="...">
  width?: number;       // Video/object only; defaults: 640×480 for video, optional for object
  height?: number;
}

interface MediaInteractionData extends BaseInteractionData {
  type: 'mediaInteraction';
  responseId: string;       // From BaseInteractionData; maps to responseIdentifier attribute
  prompt: string | null;    // HTML-sanitized prompt text, or null if absent
  autostart: boolean;       // Default: false
  minPlays: number;         // Default: 0 (no minimum)
  maxPlays: number;         // Default: 0 (unlimited); >0 caps replay
  loop: boolean;            // Default: false
  mediaElement: MediaElement;
  allowObjectEmbeds?: boolean; // Injected by Player based on security config; default false
}
```

**Invariants:**
- `mediaElement` is always non-null after extraction (extractor throws if absent).
- `minPlays >= 0` (extractor validates).
- `maxPlays >= 0` (extractor validates).
- When `maxPlays > 0`: `maxPlays >= minPlays` (extractor validates).
- `src` has been sanitized through `sanitizeResourceUrl()` before the data reaches the component.

### Component response contract

The component's `response` prop is `number | null`. It stores the integer play count. `null` or `undefined` is treated as `0`. The component emits `qti-change` events with the new integer value after each completed play.

### `canSubmitResponses` contract (item player)

When a `mediaInteraction` with `minPlays > 0` is present in the item, `player.canSubmitResponses(responses)` returns `false` unless `responses[responseIdentifier] >= minPlays`. This is enforced in `Player.ts` by inspecting the extracted interaction data alongside the current response values.

---

## Acceptance criteria

### Functional

**AC-1: Audio renders with controls**
```
Given: An item with <mediaInteraction> containing an <audio><source .../></audio> child
When:  The item is rendered
Then:  An <audio controls> element is present in the DOM with the src from the <source> element
```

**AC-2: Video renders with controls**
```
Given: An item with <mediaInteraction> containing a <video><source .../></video> child
When:  The item is rendered
Then:  A <video controls> element is present in the DOM with the src from the <source> element
       and the width/height attributes from the <video> element (defaults 640×480 if absent)
```

**AC-3: Play count increments on completion**
```
Given: A rendered mediaInteraction with an audio element
When:  The audio plays to its natural end (ended event fires)
Then:  The displayed play count increments by 1 and a qti-change event is emitted with the new count
```

**AC-4: Play count does not increment on play start**
```
Given: A rendered mediaInteraction
When:  The candidate starts playback but pauses before the media ends
Then:  The displayed play count does not change
```

**AC-5: minPlays progress indicator shown**
```
Given: A mediaInteraction with minPlays="2"
When:  The item is rendered before any plays
Then:  A visible badge reads "Play at least 2 times" and a "Remaining: 2" counter is shown
Notes: The badge should be visible without any user interaction
```

**AC-6: minPlays badge updates on each completion**
```
Given: A mediaInteraction with minPlays="2" and playCount=1
When:  The candidate completes a second play
Then:  The badge changes to show "Requirement met" (success state) and "Remaining" counter disappears
```

**AC-7: Submit blocked below minPlays**
```
Given: An item with a mediaInteraction (minPlays="2") and a Submit button
When:  The candidate has completed 0 or 1 plays
Then:  player.canSubmitResponses() returns false and the Submit button is disabled/inactive
```

**AC-8: Submit enabled after minPlays met**
```
Given: An item with a mediaInteraction (minPlays="2")
When:  The candidate completes exactly 2 plays
Then:  player.canSubmitResponses() returns true and the Submit button becomes active
```

**AC-9: maxPlays enforcement — playback blocked at limit**
```
Given: A mediaInteraction with maxPlays="3" and current playCount=3
When:  The candidate attempts to start playback (clicks play or presses spacebar)
Then:  Playback does not start (playing event is cancelled) and the play count remains at 3
```

**AC-10: maxPlays alert shown at limit**
```
Given: A mediaInteraction with maxPlays="3"
When:  The candidate completes the 3rd play
Then:  An alert reading "Maximum play limit reached" is visible in the UI
```

**AC-11: loop without maxPlays**
```
Given: A mediaInteraction with loop="true" and maxPlays="0"
When:  The media ends for the first time
Then:  Playback automatically resumes from the start
       AND the play count increments by 1 on each completion
Notes: The native loop attribute is set; there is a brief gap between end and restart for counting
```

**AC-12: loop with maxPlays stops at limit**
```
Given: A mediaInteraction with loop="true" and maxPlays="2"
When:  The media has ended twice (playCount=2)
Then:  Playback does not restart (loop stops), the maxPlays alert is shown,
       and the native <audio>/<video> element does NOT have the loop attribute set
```

**AC-13: autostart attempts autoplay**
```
Given: A mediaInteraction with autostart="true"
When:  The item renders
Then:  The <audio> or <video> element has the autoplay attribute set
Notes: Whether playback actually begins depends on browser autoplay policy;
       the attribute being present is the correct behavior; not a framework bug if suppressed
```

**AC-14: No autostart by default**
```
Given: A mediaInteraction without an autostart attribute
When:  The item renders
Then:  The media element does NOT have the autoplay attribute
```

**AC-15: Prompt renders above media**
```
Given: A mediaInteraction with a <prompt> child element containing text
When:  The item renders
Then:  The prompt text appears above the media element in reading order
```

**AC-16: Response restore syncs play count**
```
Given: An item where the player restores a saved response (MEDIA_RESPONSE = 3)
When:  The response prop is set to 3 before the candidate interacts
Then:  The displayed play count shows 3, minPlays progress reflects 3 plays,
       and no spurious qti-change events are emitted on load
```

**AC-17: Scoring — meet minPlays scores 1**
```
Given: An audio item with minPlays="2" and responseProcessing checking gte(MEDIA_RESPONSE, 2)
When:  The candidate completes 2 plays and submits
Then:  SCORE = 1.0, MAXSCORE = 1.0
```

**AC-18: Scoring — below minPlays scores 0**
```
Given: An audio item with minPlays="2" and the same responseProcessing
When:  The candidate completes only 1 play (this requires minPlays enforcement to be bypassed in the test)
Then:  SCORE = 0.0, MAXSCORE = 1.0
```

**AC-19: Error state on missing interaction data**
```
Given: A pie-qti-media web component with no interaction prop set
When:  The element renders
Then:  An error message ("No interaction data provided") is displayed; no JS exception is thrown
```

**AC-20: object type requires allowObjectEmbeds**
```
Given: A mediaInteraction with an <object> child and allowObjectEmbeds not set (default false)
When:  The item is rendered
Then:  The <object> element is not rendered (blocked by sanitizer)
       AND no play counting occurs
Notes: This tests the security boundary, not a bug. The item author must use audio/video for
       play tracking to function.
```

### Accessibility

**AC-A1: Keyboard playback control**
```
Given: A rendered mediaInteraction with audio or video
When:  The user focuses the media element and presses Spacebar
Then:  Playback starts (or pauses if already playing)
Notes: This is native browser behavior for <audio controls> and <video controls>
```

**AC-A2: Play count region readable by screen reader**
```
Given: A mediaInteraction where a play has just completed
When:  A screen reader is active during the play completion
Then:  The updated play count is conveyed to the screen reader user
Notes: Currently the stats div lacks aria-live; this AC is aspirational pending implementation
       of role="status" or aria-live="polite" on the stats container
```

**AC-A3: minPlays requirement readable without sighted cues**
```
Given: A mediaInteraction with minPlays="2" rendered with a screen reader
When:  The screen reader reads the page
Then:  The badge text "Play at least 2 times" is read aloud; no information is conveyed
       exclusively through color or icon
```

**AC-A4: object element has accessible label**
```
Given: A mediaInteraction with object type and allowObjectEmbeds=true
When:  The item renders
Then:  The <object> element has aria-label="Media content" (or the localized equivalent)
```

### Edge cases

**AC-E1: Multiple source elements — first source used**
```
Given: A mediaInteraction with <audio><source src="a.mp3"/><source src="b.ogg"/></audio>
When:  The item extracts
Then:  Only the first source (a.mp3) is used; no error is thrown
```

**AC-E2: minPlays=0 — no indicator shown**
```
Given: A mediaInteraction with minPlays not set (defaults to 0)
When:  The item renders
Then:  No "Play at least N times" badge is shown and submission is not blocked
```

**AC-E3: maxPlays=0 — unlimited plays**
```
Given: A mediaInteraction with maxPlays="0"
When:  The candidate plays the media more than 10 times
Then:  Playback is never blocked and no "Maximum play limit reached" alert appears
```

**AC-E4: minPlays > maxPlays fails validation**
```
Given: A mediaInteraction with minPlays="5" and maxPlays="2"
When:  The extractor runs validation
Then:  An error is returned: "maxPlays (2) must be greater than or equal to minPlays (5)"
```

**AC-E5: loop=true with maxPlays warning**
```
Given: A mediaInteraction with loop="true" and maxPlays="3"
When:  The extractor runs validation
Then:  A warning is returned noting that loop may be ignored when maxPlays is set
       AND the component correctly manages looping via manual restart (not native loop)
```

**AC-E6: Missing audio source throws**
```
Given: A mediaInteraction with <audio></audio> (no <source> child)
When:  The extractor runs
Then:  An error is thrown: "audio element must contain at least one source element"
```

**AC-E7: Missing object data attribute throws**
```
Given: A mediaInteraction with <object type="audio/mpeg"/> (no data attribute)
When:  The extractor runs
Then:  An error is thrown: "object element must have data attribute"
```

---

## Open questions

- [ ] **aria-live for play count updates:** Should the stats section use `role="status"` or `aria-live="polite"` to announce play count changes to screen reader users? This is the most impactful accessibility gap in the current implementation. Decision needed before marking status `current`.
- [ ] **`playsinline` for iOS:** Should the `<video>` element include `playsinline` by default to prevent iOS Safari from hijacking the display into a native fullscreen player? Playback events still fire, so `maxPlays` works, but the UX is inconsistent. Need a decision on whether this is the item player's concern or the host app's.
- [ ] **Caption/transcript enforcement:** Should the item validator warn when a `<video>` mediaInteraction lacks a `<track kind="captions">` element, or when an `<audio>` mediaInteraction lacks a sibling transcript element? Currently this is unenforced.

---

## Related

- **QTI spec:** `docs/QTI_techguide.md` §3.4.2 `mediaInteraction`
- **Response processing:** `docs/QTI-RESPONSE-TRACKING-AND-SCORING.md` — scoring operators (`gte`, `equal`)
- **Spec gaps:** `docs/SPEC-GAPS-PLAN.md` — no current gap items affect this interaction
- **Implementation:**
  - `packages/default-components/src/plugins/media/MediaInteraction.svelte`
  - `packages/item-player/src/extraction/extractors/mediaExtractor.ts`
  - `packages/item-player/src/types/interactions.ts` — `MediaInteractionData`, `MediaElement`
  - `packages/item-player/src/core/Player.ts` — `allowObjectEmbeds` injection, `canSubmitResponses` logic
  - `packages/item-player/src/core/sanitizer.ts` — `object` blocking
- **Evals:** `docs/evals/default-components/media/evals.yaml`
- **Sample items:** `apps/demo/src/lib/sample-items.ts` — `MEDIA_INTERACTION_AUDIO`, `MEDIA_INTERACTION_VIDEO`
- **Adjacent PRDs:** `docs/prds/systems/accessibility.md` (WCAG baseline), `docs/prds/architecture/response-processing.md` (scoring operators)
