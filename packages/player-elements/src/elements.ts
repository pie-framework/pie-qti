export { defineQtiPlayerElements } from './define.js';
export {
	defineQtiAssessmentPlayerElement,
	type QtiAssessmentItemChangeDetail,
	type QtiAssessmentLoadErrorDetail,
	type QtiAssessmentPlayerEventMap,
	QtiAssessmentPlayerElement,
	type QtiAssessmentResponseChangeDetail,
	type QtiAssessmentSectionChangeDetail,
	type QtiAssessmentSubmitDetail,
} from './elements/QtiAssessmentPlayerElement.js';
export {
	defineQtiItemPlayerElement,
	QtiItemPlayerElement,
	type QtiItemPlayerCompleteDetail,
	type QtiItemPlayerEventMap,
	type QtiItemPlayerResponseChangeDetail,
	type QtiItemPlayerResponseMap,
	type QtiItemPlayerSubmissionResult,
	type QtiItemPlayerSubmitDetail,
} from './elements/QtiItemPlayerElement.js';
export {
	defineQtiSectionPlayerSplitPaneElement,
	QtiSectionPlayerSplitPaneElement,
	type QtiSectionPlayerEventMap,
	type QtiSectionResponseDeltaDetail,
} from './elements/QtiSectionPlayerSplitPaneElement.js';
export {
	defineQtiSectionPlayerVerticalElement,
	QtiSectionPlayerVerticalElement,
} from './elements/QtiSectionPlayerVerticalElement.js';

import type { QtiAssessmentPlayerElement } from './elements/QtiAssessmentPlayerElement.js';
import type { QtiItemPlayerElement } from './elements/QtiItemPlayerElement.js';
import type { QtiSectionPlayerSplitPaneElement } from './elements/QtiSectionPlayerSplitPaneElement.js';
import type { QtiSectionPlayerVerticalElement } from './elements/QtiSectionPlayerVerticalElement.js';

declare global {
	interface HTMLElementTagNameMap {
		'pie-qti-item-player': QtiItemPlayerElement;
		'pie-qti-assessment-player': QtiAssessmentPlayerElement;
		'pie-qti-section-player-splitpane': QtiSectionPlayerSplitPaneElement;
		'pie-qti-section-player-vertical': QtiSectionPlayerVerticalElement;
	}
}
