import type { Player, QTIRole, RubricBlock } from '@pie-qti/qti2-item-player';

export interface DemoState {
	// XML and Player
	selectedSampleId: string;
	xmlContent: string;
	player: Player | null;
	interactions: any[];
	itemBodyHtml: string;
	rubrics: RubricBlock[];

	// Response State
	responses: Record<string, any>;
	scoringResult: any | null;
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
	responses: Record<string, any>;
	scoringResult: any | null;
}

export interface SessionData {
	selectedSampleId: string;
	itemXml: string;
	responses: Record<string, any>;
	scoringResult: any | null;
}
