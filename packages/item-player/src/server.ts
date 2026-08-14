/**
 * DOM-free definition/session interface for backend scoring and persistence.
 *
 * This entrypoint deliberately mirrors the package's primary ownership model without
 * exposing browser presentation, custom-element, PNP, PCI, or catalog capabilities.
 */
import {
	createAssessmentItemDefinition as createDefinitionInternal,
	type AssessmentItemDefinitionConfig,
} from './core/AssessmentItemDefinition.js';
import type {
	ItemSession as InternalItemSession,
	ItemSessionCommand as InternalItemSessionCommand,
} from './core/ItemSession.js';
import type {
	ItemSessionActionResult as InternalItemSessionActionResult,
	SerializedItemSessionState as InternalSerializedItemSessionState,
} from './types/index.js';

export type ServerQtiRole =
	| 'candidate'
	| 'scorer'
	| 'proctor'
	| 'testConstructor'
	| 'tutor'
	| 'author';

export type ServerQtiValue =
	| { kind: 'null'; baseType?: string; cardinality?: string }
	| { kind: 'value'; baseType?: string; cardinality: string; value: unknown }
	| { kind: 'invalid'; message: string; baseType?: string; cardinality?: string };

export type ServerItemLifecycleStatus =
	| 'initial'
	| 'interacting'
	| 'suspended'
	| 'closed'
	| 'review'
	| 'solution'
	| 'answer';

export type ServerCompletionStatus = 'not_attempted' | 'unknown' | 'incomplete' | 'completed';

export interface ServerSerializedVariable {
	identifier: string;
	kind: 'response' | 'outcome' | 'template' | 'context';
	baseType?: string;
	cardinality: string;
	value: unknown;
	defaultValue?: unknown;
}

export interface ServerResponseValidationIssue {
	responseId: string;
	code: string;
	message: string;
	severity: 'error' | 'warning';
}

export interface ServerResponseValidationEntry {
	responseId: string;
	interactionType: string;
	required: boolean;
	complete: boolean;
	valid: boolean;
	errors: string[];
	warnings: string[];
}

export interface ServerResponseValidationResult {
	valid: boolean;
	entries: Record<string, ServerResponseValidationEntry>;
	issues: ServerResponseValidationIssue[];
}

export interface ServerSerializedItemSessionState {
	itemIdentifier?: string;
	sessionGuid: string;
	lifecycleStatus: ServerItemLifecycleStatus;
	completionStatus: ServerCompletionStatus;
	numAttempts: number;
	duration: number;
	responseVariables: Record<string, ServerSerializedVariable>;
	outcomeVariables: Record<string, ServerSerializedVariable>;
	templateVariables: Record<string, ServerSerializedVariable>;
	contextVariables: Record<string, ServerSerializedVariable>;
	validationMessages: ServerResponseValidationIssue[];
	savedAt: string;
}

export interface ServerModalFeedback {
	identifier: string;
	outcomeIdentifier: string;
	showHide: 'show' | 'hide';
	content: string;
	title?: string;
}

export interface ServerScoringResult {
	score: number;
	maxScore: number;
	completed: boolean;
	outcomeValues: Record<string, unknown>;
	modalFeedback?: ServerModalFeedback[];
}

/** DOM-free description of an authored processing-fragment include request. */
export interface ServerProcessingFragmentRequest {
	readonly href: string;
	readonly mode: 'template' | 'response' | 'outcome';
	readonly scope: 'item' | 'test';
	readonly depth: number;
}

export type ServerItemSessionActionCommand =
	| { action: 'setResponse'; responseIdentifier: string; value: unknown }
	| { action: 'setResponses'; responses: Readonly<Record<string, unknown>> }
	| { action: 'suspendAttempt' }
	| { action: 'endAttempt'; countAttempt?: boolean; validateResponses?: boolean }
	| { action: 'scoreAttempt' }
	| { action: 'newTemplate'; resetResponses?: boolean }
	| { action: 'submitAttempt'; countAttempt?: boolean };

export interface ServerItemSessionActionResult {
	action: Exclude<
		ServerItemSessionActionCommand,
		{ action: 'setResponse' } | { action: 'setResponses' }
	>['action'];
	lifecycleStatus: ServerItemLifecycleStatus;
	completionStatus: ServerCompletionStatus;
	numAttempts: number;
	duration: number;
	completed: boolean;
	sessionState: ServerSerializedItemSessionState;
	validation?: ServerResponseValidationResult;
	scoring?: ServerScoringResult;
}

export interface ServerItemSessionView {
	readonly revision: number;
	readonly itemIdentifier?: string;
	readonly role: ServerQtiRole;
	readonly lifecycleStatus: ServerItemLifecycleStatus;
	readonly completionStatus: ServerCompletionStatus;
	readonly numAttempts: number;
	readonly duration: number;
	readonly adaptive: boolean;
	readonly completed: boolean;
	readonly canSubmit: boolean;
	readonly disposed: boolean;
	readonly responses: Readonly<Record<string, unknown>>;
	readonly outcomes: Readonly<Record<string, unknown>>;
	readonly templates: Readonly<Record<string, unknown>>;
	readonly context: Readonly<Record<string, unknown>>;
}

export interface ServerItemSessionTransition {
	readonly command: ServerItemSessionActionCommand;
	readonly previous: ServerItemSessionView;
	readonly current: ServerItemSessionView;
	readonly result?: ServerItemSessionActionResult;
}

export interface ServerOpenItemSessionOptions {
	readonly restore?: ServerSerializedItemSessionState;
	readonly responses?: Readonly<Record<string, unknown>>;
	readonly activate?: boolean;
}

export interface ServerItemSession {
	state(): ServerItemSessionView;
	dispatch(command: ServerItemSessionActionCommand): ServerItemSessionTransition;
	serialize(): ServerSerializedItemSessionState;
	dispose(): void;
}

export interface ServerAssessmentItemDefinition {
	readonly identifier: string;
	openSession(options?: ServerOpenItemSessionOptions): ServerItemSession;
}

export interface ServerAssessmentItemDefinitionConfig {
	readonly itemXml: string;
	readonly role?: ServerQtiRole;
	readonly seed?: number;
	readonly rngFactory?: () => () => number;
	readonly customOperators?: Readonly<
		Record<
			string,
			(args: ServerQtiValue[], meta: { class?: string; definition?: string }) => ServerQtiValue
		>
	>;
	readonly resolveProcessingFragment?: (
		request: ServerProcessingFragmentRequest,
	) => string | null | undefined;
	readonly processingFragmentLimits?: Readonly<{
		maxDepth?: number;
		maxCharacters?: number;
	}>;
	readonly security?: Readonly<{
		parsingLimits?: Readonly<{
			enabled?: boolean;
			rejectDoctype?: boolean;
			maxItemXmlBytes?: number;
			maxHtmlBytes?: number;
			maxHtmlNodes?: number;
			maxHtmlDepth?: number;
		}>;
	}>;
	readonly strictQtiCompliance?: Readonly<{
		enabled?: boolean;
		rejectUnknownExtensions?: boolean;
		logDeviations?: boolean;
	}>;
}

/** Compile immutable QTI source for one or more independent server item sessions. */
export function createAssessmentItemDefinition(
	config: ServerAssessmentItemDefinitionConfig,
): ServerAssessmentItemDefinition {
	const definition = createDefinitionInternal(config as AssessmentItemDefinitionConfig);
	return Object.freeze({
		identifier: definition.identifier,
		openSession(options: ServerOpenItemSessionOptions = {}) {
			return new ServerItemSessionAdapter(
				definition.openSession(options as Parameters<typeof definition.openSession>[0]),
			);
		},
	});
}

class ServerItemSessionAdapter implements ServerItemSession {
	constructor(private readonly session: InternalItemSession) {}

	state(): ServerItemSessionView {
		return this.session.state() as ServerItemSessionView;
	}

	dispatch(command: ServerItemSessionActionCommand): ServerItemSessionTransition {
		const transition = this.session.dispatch(command as InternalItemSessionCommand);
		return transition as ServerItemSessionTransition;
	}

	serialize(): ServerSerializedItemSessionState {
		return this.session.serialize() as ServerSerializedItemSessionState;
	}

	dispose(): void {
		this.session.dispose();
	}
}

// Keep the internal result relation checked without exporting DOM-bearing engine types.
type _ServerResultCompatibility = InternalItemSessionActionResult extends ServerItemSessionActionResult
	? true
	: never;
type _ServerStateCompatibility = InternalSerializedItemSessionState extends ServerSerializedItemSessionState
	? true
	: never;
