/**
 * Template defaults policy (QTI `templateDefault`).
 *
 * How an item's new session is seeded in a nonlinear test part: evaluated once,
 * at the start of the part, for every item ref in it — with the test outcomes and
 * the other items' variables (`ITEM.VARIABLE`, as persisted so far; NULL for an
 * item not instantiated yet) in scope — and cached for the part. Linear parts
 * evaluate each item's defaults on entering it, against the test outcomes.
 *
 * Moved out of `AssessmentPlayer.ts` verbatim (pure code motion): pure functions
 * over the delivery structure, the assessment and the persisted sessions — the
 * orchestrator passes the part cache in and keeps owning it. No lock.
 */

import type { DeclarationMap, QtiValue } from '@pie-qti/qti-processing';
import type { SerializedItemSessionState } from '@pie-qti/item-player';
import type { SecureAssessment, TestOutcomeValues } from '../integration/api-contract.js';
import type { FlatItem } from './deliveryStructure.js';
import {
	addItemVariableDeclarations,
	applyVariableMappings,
	evaluateTestExpression,
	itemSessionVariableValues,
	plainQtiValue,
	testOutcomeDeclarations,
} from './testStructure.js';

/** Template defaults of nonlinear test parts, per part → item identifier (the player's part cache). */
export type TemplateDefaultsByPart = Map<string, Map<string, Record<string, unknown> | undefined>>;

export function templateDefaultsFor(options: {
	q: FlatItem;
	items: readonly FlatItem[];
	assessment: SecureAssessment;
	outcomes: TestOutcomeValues | null;
	persistedSessions: Record<string, SerializedItemSessionState> | undefined;
	byPart: TemplateDefaultsByPart;
}): Record<string, unknown> | undefined {
	const { q, items, assessment, outcomes, persistedSessions, byPart } = options;
	const mode = q.testPart.navigationMode ?? assessment.navigationMode ?? 'nonlinear';
	if (mode !== 'nonlinear') {
		if (!q.item.templateDefaults?.length) return undefined;
		return evaluateTemplateDefaults(q, testOutcomeDeclarations(assessment, outcomes ?? undefined));
	}
	let defaults = byPart.get(q.testPart.identifier);
	if (!defaults) {
		const declarations = addItemVariableDeclarations(
			testOutcomeDeclarations(assessment, outcomes ?? undefined),
			persistedItemVariables(items, persistedSessions),
		);
		defaults = new Map(
			items
				.filter((item) => item.testPart === q.testPart)
				.map((item) => [item.identifier, evaluateTemplateDefaults(item, declarations)]),
		);
		byPart.set(q.testPart.identifier, defaults);
	}
	return defaults.get(q.identifier);
}

/** Every item's variables from its persisted session, as test-scope expressions read them. */
function persistedItemVariables(
	items: readonly FlatItem[],
	persistedSessions: Record<string, SerializedItemSessionState> | undefined,
): Record<string, Record<string, QtiValue>> {
	const out: Record<string, Record<string, QtiValue>> = {};
	for (const item of items) {
		const serialized = persistedSessions?.[item.identifier];
		if (!serialized) continue;
		out[item.identifier] = applyVariableMappings(itemSessionVariableValues(serialized), item.item.variableMappings);
	}
	return out;
}

function evaluateTemplateDefaults(q: FlatItem, declarations: DeclarationMap): Record<string, unknown> | undefined {
	const defaults = q.item.templateDefaults;
	if (!defaults?.length) return undefined;
	const out: Record<string, unknown> = {};
	for (const { templateIdentifier, expressionXml } of defaults) {
		out[templateIdentifier] = plainQtiValue(evaluateTestExpression(expressionXml, declarations, Math.random));
	}
	return out;
}
