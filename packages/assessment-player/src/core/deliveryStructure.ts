/**
 * The delivery structure: the assessment flattened into delivered items with
 * their enclosing scopes, and the candidate-facing section list.
 *
 * Moved out of `AssessmentPlayer.ts` verbatim (pure code motion): pure functions
 * over the parsed assessment, no lock, no session state. `FlatItem` is the
 * orchestrator's unit of delivery — every policy module reads it.
 */

import type {
	SecureAssessment,
	SecureItemRef,
	SecureSection,
	SecureTestPart,
} from '../integration/api-contract.js';
import { deliveredItems, sectionComponents } from './testStructure.js';

export type FlatItem = {
	identifier: string;
	item: SecureItemRef;
	/** Innermost enclosing section. */
	section: SecureSection;
	/** Enclosing sections, outermost first. */
	sections: SecureSection[];
	/** Outermost enclosing section the candidate is actually shown (QTI visible="false" merges content into the parent). */
	presentedSection: SecureSection | undefined;
	testPart: SecureTestPart;
	index: number;
	/** Index of `presentedSection` in the candidate-facing section list; -1 when none is visible. */
	sectionIndex: number;
};

export type CurrentItemView = {
	identifier: string;
	title?: string;
	required?: boolean;
	itemXml: string;
	deliveryContext?: SecureItemRef['deliveryContext'];
};

export type SectionItemRefView = {
	identifier: string;
	href?: string;
	title?: string;
	itemXml: string;
	deliveryContext?: SecureItemRef['deliveryContext'];
};

/** What the presentation of an item session shows: QTI showFeedback / showSolution, resolved. */
export type PresentationPolicy = { showFeedback: boolean; showSolution: boolean };

export function flattenItems(assessment: SecureAssessment): FlatItem[] {
	const sectionIndexes = new Map(
		presentedSections(assessment).map((section, index) => [section.identifier, index]),
	);
	return deliveredItems(assessment).map(({ item, testPart, sections }, index) => {
		const section = sections[sections.length - 1];
		const presentedSection = presentedSectionOf(sections);
		return {
			identifier: item.identifier,
			item,
			section,
			sections,
			presentedSection,
			testPart,
			index,
			sectionIndex: presentedSection ? (sectionIndexes.get(presentedSection.identifier) ?? -1) : -1,
		};
	});
}

/**
 * Sections presented to the candidate: visible themselves and under visible ancestors.
 * A QTI `visible="false"` section is not presented as a section — its content appears as
 * part of the parent — so neither it nor its descendants surface a title here. Items
 * inside keep being delivered in order.
 */
export function presentedSections(assessment: SecureAssessment): SecureSection[] {
	const out: SecureSection[] = [];
	const seen = new Set<string>();
	const visit = (section: SecureSection, underInvisible: boolean): void => {
		const hidden = underInvisible || section.visible === false;
		if (!hidden && !seen.has(section.identifier)) {
			seen.add(section.identifier);
			out.push(section);
		}
		for (const component of sectionComponents(section)) {
			if (component.type === 'section') visit(component.section, hidden);
		}
	};
	for (const tp of assessment.testParts || []) {
		for (const section of tp.sections || []) visit(section, false);
	}
	return out;
}

/** Outermost enclosing section of an item that the candidate is shown, if any. */
export function presentedSectionOf(sections: readonly SecureSection[]): SecureSection | undefined {
	let underInvisible = false;
	for (const section of sections) {
		if (section.visible === false) {
			underInvisible = true;
			continue;
		}
		if (!underInvisible) return section;
	}
	return undefined;
}

/** Delivery order of the item's test part (parts are delivered in sequence). */
export function partOrderOf(assessment: SecureAssessment, q: FlatItem | undefined): number {
	if (!q) return 0;
	return (assessment.testParts ?? []).findIndex((part) => part.identifier === q.testPart.identifier);
}
