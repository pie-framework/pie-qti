/**
 * Session types for the vendor example transform app
 */

export interface QtiContent {
	filename: string;
	content: string;
	vendor?: string;
}

export interface TransformResult {
	success: boolean;
	output: string; // PIE JSON
	pluginUsed?: string;
	pluginPriority?: number;
	detectedVendor?: string;
	confidence?: number;
	error?: string;
}

export interface Session {
	id: string;
	qti: QtiContent | null;
	transform: TransformResult | null;
	vendor: string | null; // User-selected vendor (null = auto-detect)
	created: string;
	updated: string;
}

export type SessionStatus = 'ready' | 'transforming' | 'complete' | 'error';
