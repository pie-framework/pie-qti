/**
 * Test-level navigation: branch rules, preconditions, and eligibility.
 *
 * Pure functions over the parsed assessment; the adapter threads its RNG so
 * conditional evaluation stays deterministic per session.
 */

import type { DeclarationMap, QtiValue } from '@pie-qti/qti-processing';
import type {
	SecureAssessment,
	SecureBranchRule,
	SecureItemRef,
	SecureSection,
	SecureTestPart,
	TestOutcomeValues,
} from './api-contract.js';
import {
	addItemVariableDeclarations,
	applyVariableMappings,
	type DeliveredItem,
	deliveredItems,
	evaluateTestCondition,
	testOutcomeDeclarations,
} from '../core/testStructure.js';
import type { StoredSession } from './session-store.js';

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

/**
 * Next item after `delivered[index]`. Branch rules come first: the item's, then each enclosing
 * section's it ends (inner to outer), then the test part's when it ends that too. Item and
 * section rules apply in linear navigation only. With no matching rule, navigation falls through
 * to the following item. Preconditions then skip forward from the target. EXIT_TEST means the
 * remaining items are all skipped; undefined means the current item was the last.
 */
export function nextItemIdentifier(
assessment: SecureAssessment,
delivered: DeliveredItem[],
index: number,
decls: DeclarationMap,
rng: () => number,
): string | undefined {
	const start = branchTarget(assessment, delivered, index, decls, rng) ?? index + 1;
	const next = firstEligibleItem(assessment, delivered, start, delivered[index], decls, rng);
	return next ?? (index + 1 < delivered.length ? 'EXIT_TEST' : undefined);
}

function branchTarget(
	assessment: SecureAssessment,
	delivered: DeliveredItem[],
	index: number,
	decls: DeclarationMap,
	rng: () => number,
): number | undefined {
	const current = delivered[index]!;
	const following = delivered[index + 1];
	const linear = isLinear(assessment, current.testPart);
	const holders: Array<{ rules?: SecureBranchRule[]; exitSection?: SecureSection }> = [];
	if (linear) {
		holders.push({ rules: current.item.branchRule, exitSection: current.sections[current.sections.length - 1] });
		for (let level = current.sections.length - 1; level >= 0; level--) {
			const section = current.sections[level]!;
			if (following?.sections.includes(section)) break;
			holders.push({ rules: section.branchRule, exitSection: current.sections[level - 1] });
		}
	}
	if (following?.testPart !== current.testPart) holders.push({ rules: current.testPart.branchRule });

	for (const { rules, exitSection } of holders) {
		for (const rule of rules ?? []) {
			if (rule.conditionXml && !evaluateTestCondition(rule.conditionXml, decls, rng)) continue;
			const target = resolveBranchTarget(rule.target, delivered, index, exitSection);
			if (target !== undefined) return target;
		}
	}
	return undefined;
}

/** Index a branch target resolves to, forward of `index`; delivered.length ends the test. */
function resolveBranchTarget(
	target: string,
	delivered: DeliveredItem[],
	index: number,
	exitSection: SecureSection | undefined,
): number | undefined {
	const current = delivered[index]!;
	const firstAfter = (match: (d: DeliveredItem) => boolean): number | undefined => {
		for (let j = index + 1; j < delivered.length; j++) if (match(delivered[j]!)) return j;
		return undefined;
	};
	switch (target) {
		case 'EXIT_TEST':
			return delivered.length;
		case 'EXIT_TESTPART':
			return firstAfter((d) => d.testPart !== current.testPart) ?? delivered.length;
		case 'EXIT_SECTION':
			if (!exitSection) return undefined;
			return firstAfter((d) => !d.sections.includes(exitSection)) ?? delivered.length;
		default:
			return (
				firstAfter((d) => d.item.identifier === target) ??
				firstAfter((d) => d.sections.some((section) => section.identifier === target)) ??
				firstAfter((d) => d.testPart.identifier === target)
			);
	}
}

/**
 * First item from `start` whose preconditions hold. A test part's are checked on entering it in
 * any navigation mode; a newly entered section's (outermost first) and the item's only in linear
 * navigation. A failing part or section skips everything inside it.
 */
export function firstEligibleItem(
	assessment: SecureAssessment,
	delivered: DeliveredItem[],
	start: number,
	from: DeliveredItem | undefined,
	decls: DeclarationMap,
	rng: () => number,
): string | undefined {
	const holds = (conditions: string[] | undefined): boolean =>
		(conditions ?? []).every((condition) => evaluateTestCondition(condition, decls, rng));
	const skipPast = (j: number, inside: (d: DeliveredItem) => boolean): number => {
		let next = j + 1;
		while (next < delivered.length && inside(delivered[next]!)) next++;
		return next;
	};
	let j = start;
	candidates: while (j < delivered.length) {
		const candidate = delivered[j]!;
		const previous = j === start ? from : delivered[j - 1];
		if (candidate.testPart !== previous?.testPart && !holds(candidate.testPart.preConditions)) {
			j = skipPast(j, (d) => d.testPart === candidate.testPart);
			continue;
		}
		if (isLinear(assessment, candidate.testPart)) {
			for (const section of candidate.sections) {
				if (previous?.sections.includes(section) || holds(section.preConditions)) continue;
				j = skipPast(j, (d) => d.sections.includes(section));
				continue candidates;
			}
			if (!holds(candidate.item.preConditions)) {
				j++;
				continue;
			}
		}
		return candidate.item.identifier;
	}
	return undefined;
}

function isLinear(assessment: SecureAssessment, testPart: SecureTestPart): boolean {
	return (testPart.navigationMode ?? assessment.navigationMode) === 'linear';
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
