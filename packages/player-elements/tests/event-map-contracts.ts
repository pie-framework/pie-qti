/**
 * Drift pins between the published facade (src/public/api.ts) and the runtime
 * element declarations (src/elements/*.ts, plus @pie-qti/item-player's element
 * class). The event name lists are the reviewed runtime truth: the bun-test
 * walk (tests/event-map-drift.test.ts) scans the runtime sources for the events
 * they dispatch and fails when one of these lists no longer matches, and the
 * type pins below fail when the api.ts-exported event maps no longer name
 * exactly these events, or the element interfaces lose a member the runtime
 * implements. A runtime event therefore cannot ship without its contract, and
 * a stale contract event cannot survive a runtime rename.
 *
 * Typechecked by `tsc -p tsconfig.types.test.json` (part of `bun run test`).
 * Every pin is a type alias — this module evaluates to just the three event
 * lists, so importing it from the bun-test walk executes nothing fragile.
 */
import type {
	QtiAssessmentAutosaveChangeDetail,
	QtiAssessmentAutosaveFailedDetail,
	QtiAssessmentPlayerElement,
	QtiAssessmentPlayerEventMap,
	QtiItemPlayerElement,
	QtiItemPlayerEventMap,
	QtiSectionDisplaySettingsEvent,
	QtiSectionItemPaneReadyDetail,
	QtiSectionPlayerElement,
	QtiSectionPlayerEventMap,
	QtiStringComparison,
} from '../src/public/api.js';

/** Every event the assessment player element dispatches (its event map's keys). */
export const ASSESSMENT_PLAYER_EVENTS = [
	'ready',
	'load-start',
	'load-end',
	'load-error',
	'item-change',
	'section-change',
	'response-change',
	'submit',
	'complete',
	'player-error',
	'time-expired',
	'scope-time-expired',
	'session-finalized',
	'player-pause',
	'player-resume',
	'autosave-change',
	'autosave-failed',
] as const;

/** Every event the item player element dispatches (its event map's keys). */
export const ITEM_PLAYER_EVENTS = [
	'response-change',
	'ready',
	'submit',
	'complete',
	'error',
] as const;

/** Every event the section player elements dispatch (their event map's keys). */
export const SECTION_PLAYER_EVENTS = [
	'qti-section-response-delta',
	'qti-section-framework-error',
	'qti-section-display-settings',
	'qti-section-item-pane-ready',
] as const;

/** True only when A and B are the same type — no missing, no extra members. */
type Exactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/** The assertion itself: a pin that does not hold fails the constraint here. */
type Expect<T extends true> = T;

// The api.ts-exported event maps name exactly the runtime events, nothing more.
type AssessmentMapPin = Expect<
	Exactly<keyof QtiAssessmentPlayerEventMap, (typeof ASSESSMENT_PLAYER_EVENTS)[number]>
>;
type ItemMapPin = Expect<
	Exactly<keyof QtiItemPlayerEventMap, (typeof ITEM_PLAYER_EVENTS)[number]>
>;
type SectionMapPin = Expect<
	Exactly<keyof QtiSectionPlayerEventMap, (typeof SECTION_PLAYER_EVENTS)[number]>
>;

// The element interfaces keep the members the runtime implements.
type AssessmentAutosavePin = Expect<
	Exactly<QtiAssessmentPlayerElement['autosave'], boolean | undefined>
>;
type AssessmentAutosaveIntervalPin = Expect<
	Exactly<QtiAssessmentPlayerElement['autosaveIntervalMs'], number | undefined>
>;
type SectionDisplaySettingsPin = Expect<
	Exactly<QtiSectionPlayerElement['displaySettings'], boolean>
>;
type SectionFocusActiveItemPin = Expect<
	Exactly<
		QtiSectionPlayerElement['focusActiveItem'],
		(options?: FocusOptions) => Promise<boolean>
	>
>;
type ItemStringComparisonPin = Expect<
	Exactly<QtiItemPlayerElement['stringComparison'], QtiStringComparison | undefined>
>;

// The new events carry their details through the re-exported maps.
type AssessmentAutosaveChangeDetailPin = Expect<
	Exactly<
		QtiAssessmentPlayerEventMap['autosave-change'],
		CustomEvent<QtiAssessmentAutosaveChangeDetail>
	>
>;
type AssessmentAutosaveFailedDetailPin = Expect<
	Exactly<
		QtiAssessmentPlayerEventMap['autosave-failed'],
		CustomEvent<QtiAssessmentAutosaveFailedDetail>
	>
>;
type SectionFrameworkErrorDetailPin = Expect<
	Exactly<
		QtiSectionPlayerEventMap['qti-section-framework-error'],
		CustomEvent<import('@pie-qti/section-player').QtiSectionFrameworkError>
	>
>;
type SectionDisplaySettingsDetailPin = Expect<
	Exactly<
		QtiSectionPlayerEventMap['qti-section-display-settings'],
		CustomEvent<QtiSectionDisplaySettingsEvent>
	>
>;
type SectionItemPaneReadyDetailPin = Expect<
	Exactly<
		QtiSectionPlayerEventMap['qti-section-item-pane-ready'],
		CustomEvent<QtiSectionItemPaneReadyDetail>
	>
>;
