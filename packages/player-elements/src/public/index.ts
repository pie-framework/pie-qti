export declare const QTI_ITEM_PLAYER_TAG: 'pie-qti-item-player';
export declare const QTI_ASSESSMENT_PLAYER_TAG: 'pie-qti-assessment-player';
export declare const QTI_SECTION_PLAYER_SPLITPANE_TAG: 'pie-qti-section-player-splitpane';
export declare const QTI_SECTION_PLAYER_VERTICAL_TAG: 'pie-qti-section-player-vertical';

export {
	QtiItemPlayerElement,
	defineQtiItemPlayerElement,
} from './elements.js';

export type {
	QtiAssessmentPlayerElement,
	QtiSectionPlayerSplitPaneElement,
	QtiSectionPlayerVerticalElement,
} from './elements.js';

export type {
	ParsedAssessmentItemRef,
	ParsedAssessmentSection,
	ParsedAssessmentTest,
	ParsedTestPart,
	QtiAssessmentBackend,
	QtiAssessmentInitSessionRequest,
	QtiAssessmentItemDefinitionPlugin,
	QtiAssessmentItemChangeDetail,
	QtiAssessmentLoadErrorDetail,
	QtiAssessmentPlayerConfig,
	QtiAssessmentPlayerEventMap,
	QtiAssessmentResponseChangeDetail,
	QtiAssessmentResults,
	QtiAssessmentSectionChangeDetail,
	QtiAssessmentSessionState,
	QtiAssessmentSubmitDetail,
	QtiItemMap,
	QtiHtmlContent,
	QtiModalFeedback,
	QtiItemSessionReference,
	QtiItemPlayerCompleteDetail,
	QtiItemPlayerEventMap,
	QtiItemPlayerResponseChangeDetail,
	QtiItemPlayerResponseMap,
	QtiItemPlayerSubmissionResult,
	QtiItemPlayerSubmitDetail,
	QtiPciConfiguration,
	QtiPlayerSecurityConfig,
	QtiScoringResult,
	QtiSectionComposition,
	QtiSectionDiagnostic,
	QtiSectionItemRef,
	QtiSectionModel,
	QtiSectionPlayerEventMap,
	QtiSectionResolvedCatalogSource,
	QtiSectionResolvedStylesheetRef,
	QtiSectionResponseDeltaDetail,
	QtiSectionRuntimeHost,
	QtiSectionSharedContext,
	QtiSectionSnapshot,
	QtiSectionToolConfig,
	QtiSharedHtmlBlock,
	QtiSharedStimulus,
	ResolveItemsForAssessmentOptions,
} from './api.js';

import type {
	ParsedAssessmentTest,
	ResolveItemsForAssessmentOptions,
} from './api.js';

export declare function parseAssessmentTestXml(xml: string): ParsedAssessmentTest;
export declare function resolveItemsForAssessment(
	options: ResolveItemsForAssessmentOptions,
): Promise<ParsedAssessmentTest>;
