export type ResponseValidationSeverity = 'error' | 'warning';

export interface ResponseValidationIssue {
	responseId: string;
	code: string;
	message: string;
	severity: ResponseValidationSeverity;
}

export interface ResponseValidationEntry {
	responseId: string;
	interactionType: string;
	/** Whether this interaction is required for submission purposes (derived from constraints like minPlays/minChoices). */
	required: boolean;
	/** Whether the interaction is complete for submission purposes. */
	complete: boolean;
	/** Whether the response value is valid (shape + constraints). */
	valid: boolean;
	errors: string[];
	warnings: string[];
}

export interface ResponseValidationResult {
	valid: boolean;
	entries: Record<string, ResponseValidationEntry>;
	issues: ResponseValidationIssue[];
}


