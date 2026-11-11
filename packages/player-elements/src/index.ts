/**
 * Registration-free, SSR-safe public entry.
 *
 * The registration-free item constructor remains available here. The complete
 * browser constructor set lives at `@pie-qti/player-elements/elements`; the
 * side-effectful default runtime lives at `@pie-qti/player-elements/register`.
 */

export {
	QTI_ASSESSMENT_PLAYER_TAG,
	QTI_ITEM_PLAYER_TAG,
	QTI_SECTION_PLAYER_SPLITPANE_TAG,
	QTI_SECTION_PLAYER_VERTICAL_TAG,
} from './constants.js';
export {
	defineQtiItemPlayerElement,
	QtiItemPlayerElement,
	type QtiItemPlayerCompleteDetail,
	type QtiItemPlayerErrorCode,
	type QtiItemPlayerErrorDetail,
	type QtiItemPlayerEventMap,
	type QtiItemPlayerResponseChangeDetail,
	type QtiItemPlayerResponseMap,
	type QtiItemPlayerSubmissionResult,
	type QtiItemPlayerSubmitDetail,
} from './elements/QtiItemPlayerElement.js';
export type { QtiItemMap } from './qti/resolveItems.js';
export { parseAssessmentTestXml } from './qti/parseAssessmentTest.js';
export { resolveItemsForAssessment } from './qti/resolveItems.js';
export type {
	ParsedAssessmentItemRef,
	ParsedAssessmentSection,
	ParsedAssessmentTest,
	ParsedTestPart,
} from './qti/types.js';

// Make browser-facing custom-element and event types available without loading
// their implementations in SSR/Node environments.
export type {
	QtiAssessmentAutosaveChangeDetail,
	QtiAssessmentAutosaveFailedDetail,
	QtiAssessmentErrorDetail,
	QtiAssessmentItemChangeDetail,
	QtiAssessmentLoadErrorDetail,
	QtiAssessmentPauseDetail,
	QtiAssessmentPlayerEventMap,
	QtiAssessmentPlayerElement,
	QtiAssessmentResponseChangeDetail,
	QtiAssessmentScopeTimeExpiredDetail,
	QtiAssessmentSectionChangeDetail,
	QtiAssessmentSessionFinalizedDetail,
	QtiAssessmentSubmitDetail,
	QtiAssessmentTimeExpiredDetail,
	QtiSectionDisplaySettingsEvent,
	QtiSectionFrameworkError,
	QtiSectionItemPaneReadyDetail,
	QtiSectionPlayerSplitPaneElement,
	QtiSectionPlayerEventMap,
	QtiSectionPlayerVerticalElement,
	QtiSectionResponseDeltaDetail,
} from './elements.js';
