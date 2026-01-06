import type { QTIRole, RubricBlock } from '@pie-qti/qti2-assessment-player';
import { DOMParser as LinkedomDOMParser } from 'linkedom';
import type { ParsedAssessmentSection, ParsedAssessmentTest, ParsedQuestionRef, ParsedTestPart } from './types.js';

// Use native DOMParser in browser, linkedom in Node/Bun
const DOMParserImpl = typeof DOMParser !== 'undefined' ? DOMParser : LinkedomDOMParser;

function firstByLocalName(parent: ParentNode, localName: string): Element | null {
	const all = (parent as any).getElementsByTagNameNS
		? (parent as any).getElementsByTagNameNS('*', localName)
		: (parent as any).getElementsByTagName?.(localName);
	return all?.[0] ?? null;
}

function childrenByLocalName(parent: ParentNode, localName: string): Element[] {
	const all = (parent as any).getElementsByTagNameNS
		? (parent as any).getElementsByTagNameNS('*', localName)
		: (parent as any).getElementsByTagName?.(localName);
	return all ? Array.from(all) : [];
}

function serializeInnerXml(el: Element): string {
	// In linkedom, use innerHTML; in browser, use XMLSerializer
	if (typeof XMLSerializer !== 'undefined') {
		const s = new XMLSerializer();
		let out = '';
		for (const node of Array.from(el.childNodes)) {
			out += s.serializeToString(node);
		}
		return out.trim();
	} else {
		// linkedom: use innerHTML which works for both HTML and XML
		return el.innerHTML.trim();
	}
}

function getAttr(el: Element, name: string): string | undefined {
	const v = el.getAttribute(name);
	return v === null ? undefined : v;
}

function parseQtiRoleList(viewAttr: string | undefined): QTIRole[] {
	if (!viewAttr) return ['candidate'];
	const roles = viewAttr
		.split(/\s+/g)
		.map((r) => r.trim())
		.filter(Boolean) as QTIRole[];
	return roles.length ? roles : ['candidate'];
}

function parseRubricBlocks(sectionEl: Element): RubricBlock[] | undefined {
	const blocks = childrenByLocalName(sectionEl, 'rubricBlock');
	if (blocks.length === 0) return undefined;

	return blocks.map((b, idx) => ({
		identifier: getAttr(b, 'identifier') ?? `${getAttr(sectionEl, 'identifier') ?? 'section'}-rubric-${idx + 1}`,
		view: parseQtiRoleList(getAttr(b, 'view')),
		use: getAttr(b, 'use'),
		content: serializeInnerXml(b),
	}));
}

function parseItemRefs(sectionEl: Element): ParsedQuestionRef[] | undefined {
	const itemRefs = Array.from(sectionEl.childNodes)
		.filter((n): n is Element => n.nodeType === 1)
		.filter((el) => (el as Element).localName === 'assessmentItemRef');

	if (itemRefs.length === 0) return undefined;

	return itemRefs.map((el) => {
		const identifier = getAttr(el, 'identifier') ?? 'item';
		const href = getAttr(el, 'href');
		const requiredRaw = getAttr(el, 'required');
		const required = requiredRaw === undefined ? undefined : requiredRaw !== 'false';
		return {
			identifier,
			href,
			title: getAttr(el, 'title'),
			required,
		};
	});
}

function parseSection(sectionEl: Element): ParsedAssessmentSection {
	const identifier = getAttr(sectionEl, 'identifier') ?? 'section';
	const title = getAttr(sectionEl, 'title') ?? undefined;
	const visibleRaw = getAttr(sectionEl, 'visible');
	const visible = visibleRaw === undefined ? undefined : visibleRaw !== 'false';

	const rubricBlocks = parseRubricBlocks(sectionEl);
	const questionRefs = parseItemRefs(sectionEl);

	// Only parse direct child sections (not deep descendants)
	const childSections = Array.from(sectionEl.childNodes)
		.filter((n): n is Element => n.nodeType === 1)
		.filter((el) => (el as Element).localName === 'assessmentSection')
		.map(parseSection);

	return {
		identifier,
		title,
		visible,
		rubricBlocks,
		questionRefs,
		sections: childSections.length ? childSections : undefined,
	};
}

function parseTestPart(testPartEl: Element): ParsedTestPart {
	const identifier = getAttr(testPartEl, 'identifier') ?? 'part-1';
	const navigationMode = (getAttr(testPartEl, 'navigationMode') ?? 'nonlinear') as ParsedTestPart['navigationMode'];
	const submissionMode = (getAttr(testPartEl, 'submissionMode') ?? 'simultaneous') as ParsedTestPart['submissionMode'];

	// Only direct child sections
	const sections = Array.from(testPartEl.childNodes)
		.filter((n): n is Element => n.nodeType === 1)
		.filter((el) => (el as Element).localName === 'assessmentSection')
		.map(parseSection);

	return {
		identifier,
		navigationMode,
		submissionMode,
		sections,
	};
}

export function parseAssessmentTestXml(xml: string): ParsedAssessmentTest {
	const doc = new DOMParserImpl().parseFromString(xml, 'application/xml' as any);
	const parserError = firstByLocalName(doc as ParentNode, 'parsererror');
	if (parserError) {
		throw new Error('Failed to parse assessmentTest XML');
	}

	const assessmentTestEl = firstByLocalName(doc as ParentNode, 'assessmentTest') ?? doc.documentElement;
	if (!assessmentTestEl || assessmentTestEl.localName !== 'assessmentTest') {
		throw new Error('No <assessmentTest> root element found');
	}

	const identifier = getAttr(assessmentTestEl as Element, 'identifier');
	const title = getAttr(assessmentTestEl as Element, 'title');

	// Prefer explicit testPart(s); if missing, synthesize one from top-level sections
	const testPartsEls = Array.from(assessmentTestEl.childNodes)
		.filter((n): n is Element => (n as any).nodeType === 1)
		.filter((el) => (el as Element).localName === 'testPart');

	let testParts: ParsedTestPart[] | undefined;
	if (testPartsEls.length > 0) {
		testParts = testPartsEls.map(parseTestPart);
	} else {
		const topSections = Array.from(assessmentTestEl.childNodes)
			.filter((n): n is Element => (n as any).nodeType === 1)
			.filter((el) => (el as Element).localName === 'assessmentSection')
			.map(parseSection);

		testParts = [
			{
				identifier: 'part-1',
				navigationMode: 'nonlinear',
				submissionMode: 'simultaneous',
				sections: topSections,
			},
		];
	}

	return {
		identifier,
		title,
		testParts,
	};
}


