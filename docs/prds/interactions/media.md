# PRD: mediaInteraction

<!--
  Status: draft
  Type: interaction
  Packages: @pie-qti/default-components, @pie-qti/item-player
  QTI type (interactions only): mediaInteraction
  Last reviewed: 2026-11-07
-->

**Status:** draft  
**Type:** interaction  
**Packages:** `@pie-qti/default-components`, `@pie-qti/item-player`  
**Last reviewed:** 2026-11-07

---

## Summary

`mediaInteraction` / `qti-media-interaction` is a QTI interaction that embeds audio or video content and tracks whether the candidate has played it. Unlike most QTI interactions, it does not collect a content-based answer — it tracks engagement. The response variable records the number of plays the candidate has started (a *play* is playback that begins at the start of the media). `minPlays` is the primary enforcement mechanism: the item player blocks submission until the candidate has met the required viewing or listening count. `maxPlays` limits how many times the candidate may re-watch or re-listen after a threshold, which matters for timed or high-stakes contexts where unlimited replays would be unfair.

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

When `maxPlays = 0` (the default), replay is unlimited.

With a play limit the component owns playback: it renders the media **without native controls** (a browser's own controls could replay and seek without bound, and its context menu offers "Show controls" and "Loop") and provides its own accessible, localized play/pause, mute and captions controls with at least 44×44 px touch targets. When the limit is reached, further playback is refused: the play control is announced as unavailable, and playback that starts by any other means (media keys, a browser menu, autoplay, a script) is paused immediately. Plays remaining are shown and announced, and a "Maximum play limit reached" notice appears once no play is left to resume.

### How the media element is embedded

In QTI 2.1, the spec required an `<object>` element inside `mediaInteraction`. QTI 2.2 and QTI 3.0 added support for native `<audio>` and `<video>` child elements. The framework supports all three forms. In practice, `<audio>` and `<video>` are strongly preferred:

- They render with browser-native accessible controls (under a play limit, with the component's own accessible controls).
- They support `autoplay`, `loop`, and `controls` attributes directly.
- They do not require plugin support (Flash, QuickTime) which `<object>` historically did.

The `<object>` path is kept for backward compatibility with QTI 2.1 items. It renders as an HTML `<object>` element, which has no native play events and therefore cannot drive `minPlays`/`maxPlays` enforcement. The `allowObjectEmbeds` security flag must also be explicitly enabled by the host application (see Design Decisions).

### What counts as a play

A *play* is **playback that begins at the start of the media**. It counts when the media is actually playing (the `playing` event, which fires once sound or picture is produced), so a source that fails to load never consumes one of the allowed plays. A *play-through* is a play that runs to the natural end.

This definition matters at both bounds:

- **Pausing and resuming continues the same play.** A candidate who pauses halfway and resumes is not starting again; the counter does not move. Resuming a play that already started is always allowed, even when the play limit is spent — the limit caps how many times the media can be heard, not whether an interrupted play may finish.
- **Returning a paused player to the beginning starts a new play.** The next start is counted again, so seeking back to the start cannot extend a limited listening silently.

Earlier implementations counted a play on `ended` (play-through completion). A candidate who stopped short of the end and started over — or left the item and came back — was never counted, so replay of a limited item was unbounded and `maxPlays` could not be enforced. Counting plays at their start makes both `minPlays` (the candidate must actually start the media) and `maxPlays` (no start beyond the limit) enforceable. The consequence for response processing is unchanged: a response value of *n* means the candidate started the media *n* times, and `gte` comparisons against `minPlays` keep their meaning. What changes for authors is that a candidate who starts playback but never reaches the end still registers a play.

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
| `loop` | No | boolean | `false` | Yes | Restarts after each end (never the native `loop` attribute), each restart counting as a play, until `maxPlays` plays have started |
| `coords` | No | string | — | **No** | Defined in every QTI version (2.1 XSD 3305-3319; 3.0 XSD 4822): a presentation hint for the region of the media element. Not extracted; the media element renders at its natural size. See Deliberately omitted attributes. |
| `showControls` | No | boolean | `true` | **No** | QTI 2.2 spec attribute; not extracted; controls are always shown |
| `pausable` | No | boolean | `true` | **No** | QTI 2.2 spec attribute; not extracted; native controls always allow pause |
| `class` | No | string | — | No | QTI generic styling attribute; not extracted |
| `label` | No | string | — | No | QTI generic accessibility attribute; not extracted |
| `id` | No | xs:identifier | — | No | QTI generic identifier; not used by this component |

### Deliberately omitted attributes

**`showControls`** — The spec allows hiding the native browser controls. This is deliberately omitted: without controls, there is no keyboard-accessible way to play audio/video, which violates WCAG 2.2 SC 2.1.1 (Keyboard) and SC 1.4.2 (Audio Control). Hiding controls creates a trap where keyboard-only users cannot start playback at all. Item authors who need a custom player skin should implement a PCI.

**`pausable`** — The spec allows preventing candidates from pausing. This is deliberately omitted: preventing pause forces candidates to re-listen from the start if they are interrupted, which disproportionately disadvantages candidates with attention or processing speed needs. WCAG 2.2 SC 2.2.2 (Pause, Stop, Hide) additionally requires that moving, blinking, or auto-playing content be pausable. A future implementation could enforce this only for non-auto-playing content, but it is out of scope here.

**`coords`** — Defined in every QTI version as a presentation hint for the region of the media element (the same shape/coords vocabulary the graphic interactions use). Deliberately omitted: the delivered media element renders at its natural size, and no layout in this component has a region to constrain. No behaviour is lost; a QTI 2.1-style fixed-size media region can be achieved with ordinary markup around the interaction.

### Known gaps

No items from `docs/SPEC-GAPS-PLAN.md` (G-01 through G-15) directly affect `mediaInteraction`. The gaps related to `showControls` and `pausable` are documented above as deliberate omissions rather than tracked gaps.

**`object` element and play tracking:** The spec does not define a mechanism for tracking play count when an `<object>` embed is used. The framework's `object` rendering path has no `ended` event, so `minPlays`/`maxPlays` enforcement does not function for `object`-type media. This is a spec ambiguity, not a framework bug — the spec predates HTML5 native media elements. See Design Decisions.

---

## Functional requirements

- **FR-1:** The component shall render audio media using a native HTML `<audio>` element with browser-native controls when the extracted `mediaElement.type` is `'audio'`.
- **FR-2:** The component shall render video media using a native HTML `<video>` element with browser-native controls when the extracted `mediaElement.type` is `'video'`.
- **FR-3:** The component shall render legacy `object`-type media using an HTML `<object>` element when the extracted `mediaElement.type` is `'object'` and `allowObjectEmbeds` is `true`.
- **FR-4:** The play count shall increment by 1 each time playback begins at the start of the media (the `playing` event after `play()`, an `ended` restart, or a return to the beginning); pausing and resuming within a play shall not increment it. See "What counts as a play".
- **FR-5:** The component shall emit a `qti-change` event carrying the updated play count as the value whenever the play count increments.
- **FR-6:** When `minPlays > 0`, the component shall display a visible indicator showing how many plays are required and how many remain.
- **FR-7:** When `minPlays > 0`, the item player shall prevent submission (`canSubmitResponses` returns `false`) until the play count meets or exceeds `minPlays`.
- **FR-8:** When `maxPlays > 0`, the component shall render the media without native controls and provide its own play/pause, mute and (for video) captions controls of at least 44×44 px that enforce the limit; when the limit is reached it shall refuse further playback and pause at once any playback that starts by other means.
- **FR-9:** When `maxPlays > 0`, the component shall show and announce the plays remaining while any remain, and shall display a visible "Maximum play limit reached" notice once the last allowed play has started and no play is in progress.
- **FR-10:** When `autostart` is `true`, the media element shall attempt autoplay on mount. Browser autoplay policies may suppress this (see Non-functional requirements).
- **FR-11:** When `loop` is `true` and `maxPlays = 0`, the component shall restart playback after each `ended` event indefinitely, each restart incrementing the play count. The native `loop` attribute is never set, because it suppresses `ended` and so the count.
- **FR-12:** When `loop` is `true` and `maxPlays > 0`, the component shall manually restart playback after each `ended` event, counting each restart as a play, until the limit is reached, then stop. The native `loop` attribute shall not be set on the HTML element in this case (it would suppress `ended` and unbounded looping would bypass the count).
- **FR-13:** A `<prompt>` child element, if present, shall be rendered as formatted HTML above the media element.
- **FR-14:** The extractor shall throw an error if no `<audio>`, `<video>`, or `<object>` child element is found inside `<mediaInteraction>`.
- **FR-15:** The extractor shall throw an error if an `<audio>` or `<video>` element has neither `<source>` children nor its own `src` attribute (which, as in HTML, takes precedence over `<source>` children).
- **FR-16:** The extractor shall extract every `<source>` element in document order (the browser picks the first it can play). The first source also populates the legacy single-URL `src` field.
- **FR-17:** The extractor shall validate that `maxPlays >= minPlays` when `maxPlays > 0`, and return an error if violated.
- **FR-18:** When `interaction` data is absent or null, the component shall render an error alert rather than a blank or broken state.
- **FR-19:** The response prop shall be kept in sync with the internal play count; restoring a serialized play count via the `response` prop shall update the internal counter without triggering additional change events.
- **FR-20:** The extractor shall extract every `<track>` element (`kind`, `src`, `srclang`, `label`, `default`) of QTI 2.2 and QTI 3.0 `audio`/`video` content, and the component shall render them so captions and subtitles load. A track whose URL the delivery policy blocked is not rendered.
- **FR-21:** For video with caption or subtitle tracks, the component shall provide a labeled control to show one track or none; the track marked `default` shows initially.
- **FR-22:** The component shall name audio and video by their prompt when one is authored, and convey play-count changes and threshold moments (a play started, the limit reached) through polite live regions.
- **FR-23:** Video shall always be rendered `playsinline` (with `webkit-playsinline` for pre-iOS-10 WebViews), so iOS playback stays in the page instead of taking over the display in fullscreen and hiding the question. Under a play limit, picture-in-picture and remote playback are additionally disabled, and the component offers no fullscreen control; without a limit the native controls may offer one, which cannot break `maxPlays` enforcement (play events still fire in the page).

---

## Non-functional requirements

### Accessibility

`mediaInteraction` has stricter accessibility constraints than most interactions because it deals with time-based media, which WCAG addresses specifically.

- **Captions (WCAG 2.2 SC 1.2.2, Level A):** The framework renders every `<track>` the QTI source declares, so captions and subtitles load, and video offers a labeled control to turn a caption or subtitle track on (the `default` track shows initially). Item authors remain responsible for authoring the tracks themselves; item validation tooling should warn when a `<video>` lacks a caption track.
- **Audio descriptions (WCAG 2.2 SC 1.2.5, Level AA):** Video content where visual information is not conveyed in the audio track requires an audio description track. Again, item author responsibility; the framework renders whatever tracks the QTI source declares.
- **Transcript for audio (WCAG 2.2 SC 1.2.1, Level A):** Audio-only content requires a text transcript accessible to screen reader users. The framework does not auto-generate transcripts. Item authors must include a linked or inline transcript in the item body adjacent to the `<mediaInteraction>`.
- **Autoplay and audio control (WCAG 2.2 SC 1.4.2, Level A):** Audio that plays for more than 3 seconds automatically must have a mechanism to pause, stop, or mute it. With `autostart="true"` the candidate can pause through the visible controls — native controls, or the component's own play/pause and mute controls when a play limit applies. An interaction that is disabled, or whose play limit is already spent, does not autoplay.
- **Keyboard access (WCAG 2.2 SC 2.1.1, Level A):** Without a play limit the native `<audio controls>`/`<video controls>` are fully keyboard-operable. With a play limit the component's own play/pause, mute and captions controls are focusable buttons and a select, operable with Space/Enter.
- **Play count status (WCAG 2.2 SC 4.1.3, Status Messages, Level AA):** The stats row (play count, plays left/needed, requirement met) renders as visible text. A polite live region announces the moments a candidate acts on — each play started (with progress toward a required minimum, when authored) and the play limit reached. The stats row itself is deliberately not a live region, so routine counter changes are not chatty.
- **Touch targets (WCAG 2.2 SC 2.5.8, Level AA):** The component's own controls are at least 44×44 px (the K-12 primary target size). Without a limit, native browser controls apply, which meet target-size requirements on mobile.
- **Focus management:** No custom focus management is needed; the media element and the component's controls are in natural tab order.

### Performance

- Media files are not bundled or preprocessed by the framework. Delivery performance depends on the hosting infrastructure.
- The component does not preload media by default (browser default for `<audio>`/`<video>` without a `preload` attribute is `metadata`). Item authors should set `preload` via QTI source if faster start is needed.
- No constraints on bundle size beyond the base Svelte component weight.

### Cross-platform / mobile

- On iOS Safari, autoplay with audio is blocked by default regardless of the `autostart` attribute. Safari permits autoplay only for muted video. Item authors relying on `autostart="true"` for audio should be aware of this and ensure the item design does not depend on autoplay working.
- Video is always rendered `playsinline` (plus `webkit-playsinline` for pre-iOS-10 WebViews), so iOS playback stays in the page instead of taking over the display in fullscreen and hiding the question. Under a play limit, picture-in-picture and remote playback are disabled as well, and the browser context menu is suppressed (it offers "Show controls" and "Loop", which would bypass the limit).
- The component offers no fullscreen control of its own. Under a play limit the native controls are hidden and the custom controls intentionally provide no fullscreen button: fullscreen adds nothing the question needs, and a native fullscreen player surface is outside the page the limit is enforced in. Without a limit the native controls may offer fullscreen, which is harmless there: play and pause events still fire where the component can count them.
- On Android Chrome, autoplay is governed by a media engagement score. Similarly unreliable for new domains.
- The stats section (play count, minPlays badge) is designed with `flex-wrap` to reflow on narrow screens.

### Security

- The media element `src`, every `<source>` URL and every `<track>` URL are run through the item player's `sanitizeResourceUrl()` with `kind='media'` (or `kind='object'` for `<object>` elements) before being passed to the component. URL policies that block cross-origin media will prevent the media (and caption files) from loading; blocked URLs arrive empty and are not rendered.
- Text tracks load with the authored `crossorigin` mode when one is present; without it, browsers fetch same-origin caption files but refuse cross-origin ones.
- `<object>` embeds are blocked by default. The host application must set `config.security.allowObjectEmbeds = true` to enable `object`-type rendering. This opt-in prevents XSS vectors from legacy QTI items that embed arbitrary HTML via `<object>`.
- The `prompt` field is rendered via `{@html}` (injected HTML). It goes through the item player's HTML sanitizer before extraction, which strips dangerous tags and attributes.

### i18n

- The component uses `i18n.t()` for all user-visible strings (control labels, captions menu, stats, announcements): the `interactions.media.*` keys and the `'common.errorNoData'` fallback, with English fallbacks when no provider is set.
- Plural messages (plays left/needed, "Play at least N times") use the i18n framework's `translatePlural` with per-locale CLDR categories.
- The extraction-time `loop` + `maxPlays` validation warning reads: "mediaInteraction has loop=true with maxPlays - looping stops once maxPlays plays have started".

---

## Design decisions

### A play is counted when playback starts at the beginning of the media

**Decision:** Count a play when the media is actually playing from its start (the `playing` event that follows a start at the beginning); pausing and resuming continues the same play, and returning a paused player to the beginning begins a new one.  
**Rationale:** The count must make `maxPlays` enforceable first — the response is the candidate's allowance record, and a limit that cannot stop replay is not a limit. Counting at the start bounds every way of hearing the media, including pause-and-rewind. Counting on `ended` instead left replay unbounded (see "What counts as a play"). `playing` rather than `play` keeps a failing source from consuming an allowance.  
**Alternatives considered:** Counting on `ended` (play-through completion): keeps `minPlays` meaning "completed listens" but cannot enforce `maxPlays`; abandoned. Counting on raw `play`: refuses nothing for a source that never loads; refined to count on `playing`.  
**Consequences:** `minPlays` reads as "started playback *n* times", so authors who require complete listens should pair a `minPlays` requirement with short media. Automated eval tools simulate plays by dispatching the play count (`qti-change`) rather than driving real playback, which matches how the runner already works for other deterministic steps.

### `loop` is a manual restart

**Decision:** The HTML `loop` attribute is never set on the native element. Instead, the component calls `mediaElement.play()` after each `ended` event — indefinitely without a limit, and until the allowed plays have started with one.  
**Rationale:** If the native `loop` attribute is set, the `ended` event does not fire (the element loops without reaching "natural end"), so passes could not be counted and a limit could not stop them. A manual restart is a play like any other: counted, and refused past the limit.  
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
**Consequences:** Out-of-the-box, `object`-type media does not render (the component receives `allowObjectEmbeds: false`); the component shows a localized notice (`interactions.media.objectDisabled`) in its place. Hosts that serve QTI 2.1 content with `<object>` media must opt in.

### Response type is always `integer`, not `boolean`

**Decision:** The response variable is always `baseType="integer"` storing the raw play count.  
**Rationale:** Storing an integer rather than a boolean allows item authors to score on replay count (e.g., "listened 3+ times = full credit; listened 1-2 times = partial credit"). The spec mandates `integer`. The framework does not support `boolean` responses for this interaction type.  
**Alternatives considered:** Supporting `boolean` as an alternative. Not pursued — it is not in the spec and adds no value that the integer type doesn't provide.  
**Consequences:** Response processing templates like `match_correct` do not apply directly to this interaction. Item authors must write custom `responseProcessing` using `gte`/`gt`/`equal` comparisons.

---

## Data model / contracts

### `MediaInteractionData` (extracted data passed to component)

Defined in `packages/item-player/src/interactions/shared/types.ts`:

```typescript
interface MediaElementSource {
  src: string;        // Sanitized URL (after URL policy applied; '' if blocked)
  mimeType: string;
}

interface MediaElementTrack {
  src: string;        // Sanitized URL ('' if blocked)
  kind: 'subtitles' | 'captions' | 'descriptions' | 'chapters' | 'metadata';
  srclang?: string;
  label?: string;
  default?: boolean;
}

interface MediaElement {
  type: 'audio' | 'video' | 'object';
  src: string;        // The object's data, or the first source (legacy single-URL field)
  mimeType: string;
  width?: number;     // Video/object; defaults: 640×480 for video, optional for object
  height?: number;
  sources?: MediaElementSource[];  // Every source, in document order
  tracks?: MediaElementTrack[];    // Every text track, in document order
  crossOrigin?: 'anonymous' | 'use-credentials'; // Authored crossorigin mode
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
- Every URL in `src`, `sources[].src` and `tracks[].src` has been sanitized through `sanitizeResourceUrl()` before the data reaches the component; a blocked URL arrives as an empty string and is not rendered.

### Component response contract

The component's `response` prop is `number | null`. It stores the integer count of plays started (see "What counts as a play"). `null` or `undefined` is treated as `0`. The component emits `qti-change` events with the new integer value each time a play starts.

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

**AC-3: Play count increments when a play starts**
```
Given: A rendered mediaInteraction with an audio element
When:  Playback begins at the start of the media (playing event)
Then:  The displayed play count increments by 1 and a qti-change event is emitted with the new count
```

**AC-4: Pause and resume does not increment**
```
Given: A rendered mediaInteraction where a play has started
When:  The candidate pauses and then resumes (without returning to the beginning)
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

**AC-9: maxPlays enforcement — replay refused at the limit**
```
Given: A mediaInteraction with maxPlays="3" and current playCount=3, with no play in progress
When:  The candidate attempts to start playback (play button, media keys, a script)
Then:  Playback does not start (the media is paused at once) and the play count remains at 3
       AND the native controls are not rendered while the limit applies
```

**AC-10: Limit notice and plays remaining**
```
Given: A mediaInteraction with maxPlays="3"
When:  Plays are underway or remaining
Then:  "N plays left" is visible and announced
And:   Once the last allowed play has started and no play is in progress,
       a notice reading "Maximum play limit reached" is visible and announced
```

**AC-11: loop without maxPlays**
```
Given: A mediaInteraction with loop="true" and maxPlays="0"
When:  The media ends for the first time
Then:  Playback automatically resumes from the start
       AND the play count increments by 1 on each restart
Notes: The native loop attribute is never set; there is a brief gap between end and restart, which is when each pass is counted
```

**AC-12: loop with maxPlays stops at limit**
```
Given: A mediaInteraction with loop="true" and maxPlays="2"
When:  The media has ended twice (playCount=2)
Then:  Playback does not restart (loop stops), the limit notice is shown,
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
Then:  The displayed play count shows 3, minPlays/limit state reflects 3 plays,
       and no spurious qti-change events are emitted on load
Notes: If maxPlays=3, a restored count of 3 disables autoplay and arms the limit
```

**AC-21: Every source and caption track renders**
```
Given: A mediaInteraction whose <video> declares two <source> elements and
       <track kind="captions"> with label and default, plus a <track kind="subtitles">
When:  The item renders
Then:  The <video> contains both <source> elements in order and both <track> elements
       with their kind/srclang/label/default attributes
       AND the captions control lists the caption and subtitle tracks by label,
       with the default track selected; descriptions tracks load but are not listed
```

**AC-22: A blocked track or source URL is not rendered**
```
Given: A host URL policy that blocks one <source> and one <track> URL
When:  The item renders
Then:  The blocked source and track are absent from the media element
       AND the allowed source and track render normally
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
       AND a notice explains that the embedded object type is disabled
       AND no play counting occurs
Notes: This tests the security boundary, not a bug. The item author must use audio/video for
       play tracking to function.
```

### Accessibility

**AC-A1: Keyboard playback control**
```
Given: A rendered mediaInteraction with audio or video
When:  The user focuses the play control and presses Space or Enter
Then:  Playback starts (or pauses if already playing)
Notes: Without a play limit the native <audio/video controls> provide this;
       with a limit the component's own ≥44px controls do
```

**AC-A2: Play events announced politely**
```
Given: A mediaInteraction with minPlays="2", a screen reader active
When:  The candidate starts a play, or the play limit is reached
Then:  A polite live region announces it ("Play 1 of 3 started.",
       "Play 2 started. Required number of plays reached.", "Maximum play limit reached")
And:   Ordinary counter updates are not announced on every change
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

**AC-A5: Media named by its prompt**
```
Given: A mediaInteraction with a <prompt> and audio or video
When:  The item renders
Then:  The media element's accessible name comes from the prompt (aria-labelledby)
```

**AC-A6: Caption choice is labeled and effective**
```
Given: A limited mediaInteraction (video) with a caption track labeled "English" and a
       subtitle track with srclang="es" but no label
When:  The candidate opens the captions control
Then:  The options read "Off", "English" and the localized language name for es
       AND choosing a track shows it (textTracks mode "showing"); choosing Off hides all
```

### Edge cases

**AC-E1: Multiple source elements — all kept, first used**
```
Given: A mediaInteraction with <audio><source src="a.mp3"/><source src="b.ogg"/></audio>
When:  The item extracts and renders
Then:  The response-facing src is a.mp3, and the rendered <audio> contains both
       <source> elements in order for browser fallback
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
Then:  Playback is never blocked, native controls remain, and no limit notice appears
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
Then:  A warning is returned noting that looping stops once maxPlays plays have started
       AND the component manages looping via manual restart (not native loop)
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

- [x] **aria-live for play count updates:** Resolved — a polite live region announces plays started and the limit reached; the stats row stays quiet (2026-11-07).
- [x] **`playsinline` for iOS:** Resolved — video is always rendered `playsinline` (with PiP and remote playback disabled while a play limit applies), keeping playback and enforcement in the page; no fullscreen control is offered where a limit applies (2026-11-07).
- [ ] **Caption/transcript enforcement:** Should the item validator warn when a `<video>` mediaInteraction lacks a `<track kind="captions">` element, or when an `<audio>` mediaInteraction lacks a sibling transcript element? Tracks now render and can be switched, but authoring-time validation is still unenforced.

---

## Related

- **QTI spec:** `docs/QTI_techguide.md` §3.4.2 `mediaInteraction`
- **Response processing:** `docs/QTI-RESPONSE-TRACKING-AND-SCORING.md` — scoring operators (`gte`, `equal`)
- **Spec gaps:** `docs/SPEC-GAPS-PLAN.md` — no current gap items affect this interaction
- **Implementation:**
  - `packages/default-components/src/plugins/media/MediaInteraction.svelte`
  - `packages/item-player/src/interactions/media/extractor.ts`
  - `packages/item-player/src/interactions/shared/types.ts` — `MediaInteractionData`, `MediaElement`
  - `packages/item-player/src/core/Player.ts` — `allowObjectEmbeds` injection, `canSubmitResponses` logic
  - `packages/item-player/src/core/sanitizer.ts` — `object` blocking
- **Evals:** `docs/evals/default-components/media/evals.yaml`
- **Sample items:** `apps/demo/src/lib/sample-items.ts` — `MEDIA_INTERACTION_AUDIO`, `MEDIA_INTERACTION_VIDEO`
- **Adjacent PRDs:** `docs/prds/systems/accessibility.md` (WCAG baseline), `docs/prds/architecture/response-processing.md` (scoring operators)
