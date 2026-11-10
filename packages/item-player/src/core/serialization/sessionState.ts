/**
 * Session-state persistence: the serialized snapshot a host stores and restores, the
 * variable application that hydrates a restored session, and the duration clock that
 * feeds the built-in `duration` variable and the host-facing millisecond fields.
 */
import { type DeclarationContext, type DeclarationMap, durationSecondsFromMilliseconds, qtiValue } from '@pie-qti/qti-processing';
import type { AssessmentItemDocument } from '../../document/AssessmentItemDocument.js';
import type { ItemLifecycleStatus, SerializedItemSessionState, SerializedItemSessionVariable } from '../../types/index.js';
import { coerceToDeclarationValue } from '../declarations/declarationValues.js';
import { qtiValueToPci, qtiValueToSerializable } from './valueForms.js';

/** What serialization reads from and writes to the session engine. */
export interface SerializationHost {
	readonly itemDocument: AssessmentItemDocument;
	readonly decls: DeclarationMap;
	readonly ctx: DeclarationContext;
	readonly sessionGuid: string;
	lifecycleStatus: ItemLifecycleStatus;
	getCompletionStatus(): SerializedItemSessionState['completionStatus'];
	getNumAttempts(): number;
	getResponses(): Record<string, any>;
	validateResponses(responses: Record<string, any>): { issues: SerializedItemSessionState['validationMessages'] };
	restorePciResponse(responseIdentifier: string, value: unknown): void;
	/** Time on task at the last duration update, in milliseconds. */
	durationMs: number;
	/** Time on task accumulated before the current clock window, in milliseconds. */
	accumulatedDurationMs: number;
	/** When the current clock window started (Date.now() base). */
	sessionStartedAt: number;
}

export function serializeItemSession(host: SerializationHost): SerializedItemSessionState {
	const responseVariables: Record<string, SerializedItemSessionVariable> = {};
	const outcomeVariables: Record<string, SerializedItemSessionVariable> = {};
	const templateVariables: Record<string, SerializedItemSessionVariable> = {};
	const contextVariables: Record<string, SerializedItemSessionVariable> = {};
	const contextIds = new Set(['completionStatus', 'numAttempts', 'duration']);

	for (const d of Object.values(host.decls)) {
		const variable = serializeVariable(d);
		if (d.isTemplate) {
			templateVariables[d.identifier] = { ...variable, kind: 'template' };
		} else if (contextIds.has(d.identifier) || (d as any).__kind === 'context') {
			contextVariables[d.identifier] = { ...variable, kind: 'context' };
		} else if ((d as any).__kind === 'response') {
			responseVariables[d.identifier] = { ...variable, kind: 'response' };
		} else if ((d as any).__kind === 'outcome') {
			outcomeVariables[d.identifier] = { ...variable, kind: 'outcome' };
		}
	}

	const validation = host.validateResponses(host.getResponses());
	return {
		itemIdentifier: host.itemDocument.getAssessmentItemAttribute('identifier') ?? undefined,
		sessionGuid: host.sessionGuid,
		lifecycleStatus: host.lifecycleStatus,
		completionStatus: host.getCompletionStatus(),
		numAttempts: host.getNumAttempts(),
		duration: host.durationMs,
		responseVariables,
		outcomeVariables,
		templateVariables,
		contextVariables,
		validationMessages: validation.issues,
		savedAt: new Date().toISOString(),
	};
}

export function applySerializedVariables(host: SerializationHost, vars: Record<string, SerializedItemSessionVariable>): void {
	for (const v of Object.values(vars)) {
		const d = host.decls[v.identifier];
		if (!d) continue;
		// Restore the declaration's default value first: template processing is
		// skipped on restore (QTI ASI §10.3 fixes its effects for the session), so
		// a default changed by setDefaultValue — including to NULL — must come from
		// the snapshot. defaultValue is always serialized, so it applies as-is:
		// null restores the NULL default a setDefaultValue rule set, never the
		// default parsed from the item XML. Later resets (attempt starts, outcome
		// resets at response-processing start, templateConstraint restarts) then
		// use the restored default; a new template instance (newTemplate) starts
		// from the declarations instead.
		d.defaultValue = coerceToDeclarationValue({ itemDocument: host.itemDocument }, d.baseType, d.cardinality, v.defaultValue, d.identifier);
		d.value = coerceToDeclarationValue({ itemDocument: host.itemDocument }, d.baseType, d.cardinality, v.value, d.identifier);
		if ((d as any).__kind === 'response') {
			// A correctResponse computed by setCorrectResponse is also a fixed
			// template-rule effect; restoring it keeps a resumed session scoring
			// identically to the session that was saved. The snapshot writes the
			// field whenever the variable has or had a correct response, so it
			// applies as-is: null restores the NULL correct response a
			// setCorrectResponse rule set. When the field is absent the variable
			// has no correct response, and the fresh declaration (parsed from the
			// same item XML) has none either.
			if (v.correctResponse !== undefined) {
				d.correctResponse = coerceToDeclarationValue({ itemDocument: host.itemDocument }, d.baseType, d.cardinality, v.correctResponse, d.identifier);
			}
			host.restorePciResponse(d.identifier, qtiValueToPci(d.value));
		}
	}
}

function serializeVariable(d: DeclarationMap[string]): SerializedItemSessionVariable {
	const variable: SerializedItemSessionVariable = {
		identifier: d.identifier,
		kind: ((d as any).__kind ?? (d.isTemplate ? 'template' : 'context')) as SerializedItemSessionVariable['kind'],
		...(d.baseType ? { baseType: d.baseType } : {}),
		cardinality: d.cardinality,
		value: qtiValueToSerializable(d.value),
		defaultValue: qtiValueToSerializable(d.defaultValue),
	};
	// A correctResponse is part of the session state a template rule
	// (setCorrectResponse, QTI ASI §10.3) can compute, so it must survive a
	// snapshot for the restored session to score identically. Written whenever
	// the variable has or had a correct response — from the XML or from template
	// processing — with null for a NULL correct response, so restore can tell
	// "no correct response" (field absent) from "its correct response is NULL".
	if ((d as any).__kind === 'response' && d.correctResponse !== undefined) {
		variable.correctResponse = qtiValueToSerializable(d.correctResponse);
	}
	return variable;
}

export function updateDuration(host: SerializationHost): void {
	const elapsedMs = Math.max(0, Date.now() - host.sessionStartedAt);
	host.durationMs = Math.max(0, Math.floor(host.accumulatedDurationMs + elapsedMs));
	// QTI 2.2/3.0: the built-in `duration` response variable is a float of seconds, truncated.
	// The host-facing `duration` fields of serialized sessions and action results stay in
	// milliseconds (see getDuration).
	host.ctx.setValue(
		'duration',
		qtiValue('duration', 'single', durationSecondsFromMilliseconds(host.durationMs)),
	);
}

export function freezeDuration(host: SerializationHost): number {
	updateDuration(host);
	host.accumulatedDurationMs = host.durationMs;
	host.sessionStartedAt = Date.now();
	return host.durationMs;
}

/** Time on task in whole milliseconds, as the host-facing session fields report it. */
export function getDurationMs(host: SerializationHost): number {
	return host.durationMs;
}
