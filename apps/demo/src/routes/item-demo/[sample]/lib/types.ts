import type { QTIRole, RubricBlock, ScoringResult } from '@pie-qti/item-player';
import type { InteractionResponseValue } from '@pie-qti/item-player/web-components';

export type DemoResponseValue = InteractionResponseValue | null;
export type DemoResponseMap = Record<string, DemoResponseValue>;

export interface DemoState {
	// XML and session-derived presentation
	selectedSampleId: string;
	xmlContent: string;
	interactions: any[];
	itemBodyHtml: string;
	sidePanelRubrics: RubricBlock[];

	// Response State
	responses: DemoResponseMap;
	scoringResult: ScoringResult | null;
	selectedForPairing: string | null;

	// Settings
	selectedRole: QTIRole;
	useBackendScoring: boolean;

	// Session
	sessionId: string | null;
	isSaving: boolean;
	isSubmitting: boolean;

	// UI State
	errorMessage: string;
	leftPanelWidth: number;
	isDragging: boolean;
}

export interface ExportData {
	timestamp: string;
	sampleId: string;
	responses: DemoResponseMap;
	scoringResult: ScoringResult | null;
}

export interface SessionData {
	selectedSampleId: string;
	itemXml: string;
	responses: DemoResponseMap;
	scoringResult: ScoringResult | null;
}
