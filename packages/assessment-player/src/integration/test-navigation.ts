/**
 * Test-level navigation: the session-fed declarations the branch rules and preconditions
 * read, and the delivered item refs in order.
 *
 * The pure delivery-rules walk itself (branch rules, preconditions, eligibility) is shared
 * with the player through `core/testStructure.ts` and re-exported here — the reference
 * backend and the client evaluate the same rules; this module is the backend's entry. The
 * adapter threads its RNG so conditional evaluation stays deterministic per session.
 */

import type { DeclarationMap, QtiValue } from '@pie-qti/qti-processing';
import type { SecureAssessment, SecureItemRef, TestOutcomeValues } from './api-contract.js';
import {
	addItemVariableDeclarations,
	applyVariableMappings,
	deliveredItems,
	testOutcomeDeclarations,
} from '../core/testStructure.js';
import type { StoredSession } from './session-store.js';

export { firstEligibleItem, nextItemIdentifier } from '../core/testStructure.js';

/**
 * Context for branch rules and preconditions: test outcomes, every submitted item's variables as
 * `itemIdentifier.VARIABLE`, and `current` unprefixed where the test declares no such outcome.
 */
export function navigationDeclarations(
	session: StoredSession,
	outcomes: TestOutcomeValues | undefined,
	current: Record<string, QtiValue> = {},
): DeclarationMap {
	const itemVariables: Record<string, Record<string, QtiValue>> = {};
	for (const { item } of deliveredItems(session.assessment)) {
		const variables = session.itemTestStates?.[item.identifier]?.variables;
		if (variables) itemVariables[item.identifier] = applyVariableMappings(variables, item.variableMappings);
	}
	return addItemVariableDeclarations(testOutcomeDeclarations(session.assessment, outcomes), itemVariables, current);
}

/** Delivered item refs in order, each with the identifiers of the sections containing it (outermost first). */
export function getItemRefsInOrder(
	assessment: SecureAssessment
): Array<{ item: SecureItemRef; sectionIdentifiers: string[] }> {
	return deliveredItems(assessment).map(({ item, sections }) => ({
		item,
		sectionIdentifiers: sections.map((section) => section.identifier),
	}));
}
