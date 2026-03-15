export { QTI_ASSESSMENT_PLAYER_TAG, QTI_ITEM_PLAYER_TAG } from './constants.js';
export { defineQtiPlayerElements } from './define.js';
export {
	defineQtiAssessmentPlayerElement,
	type QtiAssessmentItemChangeDetail,
	QtiAssessmentPlayerElement,
	type QtiAssessmentResponseChangeDetail,
	type QtiAssessmentSectionChangeDetail,
	type QtiAssessmentSubmitDetail,
} from './elements/QtiAssessmentPlayerElement.js';
export {
	defineQtiItemPlayerElement,
	QtiItemPlayerElement,
	type QtiItemPlayerResponseChangeDetail,
} from './elements/QtiItemPlayerElement.js';
export type { QtiItemMap } from './qti/resolveItems.js';
export { parseAssessmentTestXml } from './qti/parseAssessmentTest.js';
export { resolveItemsForAssessment } from './qti/resolveItems.js';
export type {
	ParsedAssessmentTest,
	ParsedTestPart,
	ParsedAssessmentSection,
	ParsedAssessmentItemRef,
} from './qti/types.js';


