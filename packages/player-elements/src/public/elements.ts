export type {
	QtiAdaptiveAttemptResult,
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
	QtiItemFetchPolicy,
	QtiItemMap,
	QtiHtmlContent,
	QtiModalFeedback,
	QtiItemPlayerCompleteDetail,
	QtiItemPlayerEventMap,
	QtiItemPlayerResponseChangeDetail,
	QtiItemPlayerResponseMap,
	QtiItemSessionReference,
	QtiItemPlayerSubmissionResult,
	QtiItemPlayerSubmitDetail,
	QtiPciConfiguration,
	QtiPlayerSecurityConfig,
	QtiScoringResult,
	QtiSectionComposition,
	QtiSectionDiagnostic,
	QtiSectionItemRef,
	QtiSectionModel,
	QtiSectionPlayerElement,
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
} from './api.js';

import type {
	QtiAssessmentPlayerElement as QtiAssessmentPlayerElementContract,
	QtiAssessmentPlayerElementConstructor,
	QtiItemPlayerElement as QtiItemPlayerElementContract,
	QtiItemPlayerElementConstructor,
	QtiSectionPlayerSplitPaneElement as QtiSectionPlayerSplitPaneElementContract,
	QtiSectionPlayerVerticalElement as QtiSectionPlayerVerticalElementContract,
	QtiSectionPlayerElementConstructor,
} from './api.js';

export interface QtiItemPlayerElement extends QtiItemPlayerElementContract {}

export interface QtiAssessmentPlayerElement extends QtiAssessmentPlayerElementContract {}

export interface QtiSectionPlayerSplitPaneElement
	extends QtiSectionPlayerSplitPaneElementContract {}

export interface QtiSectionPlayerVerticalElement
	extends QtiSectionPlayerVerticalElementContract {}

export declare const QtiItemPlayerElement: QtiItemPlayerElementConstructor;
export declare const QtiAssessmentPlayerElement: QtiAssessmentPlayerElementConstructor;
export declare const QtiSectionPlayerSplitPaneElement: QtiSectionPlayerElementConstructor;
export declare const QtiSectionPlayerVerticalElement: QtiSectionPlayerElementConstructor;

export declare function defineQtiItemPlayerElement(): void;
export declare function defineQtiAssessmentPlayerElement(): void;
export declare function defineQtiSectionPlayerSplitPaneElement(): void;
export declare function defineQtiSectionPlayerVerticalElement(): void;
export declare function defineQtiPlayerElements(): void;

declare global {
	interface HTMLElementTagNameMap {
		'pie-qti-item-player': QtiItemPlayerElement;
		'pie-qti-assessment-player': QtiAssessmentPlayerElement;
		'pie-qti-section-player-splitpane': QtiSectionPlayerSplitPaneElement;
		'pie-qti-section-player-vertical': QtiSectionPlayerVerticalElement;
	}
}
