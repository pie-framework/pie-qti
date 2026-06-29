import { detectQtiVersion, type QtiVersion } from '@pie-qti/qti-common';

export interface PackageItemReference {
	identifier: string;
	href: string;
	title?: string;
}

export interface AssessmentItemRefSummary {
	identifier: string;
	href?: string;
	resolvedHref?: string;
	resolvedItem?: PackageItemReference;
	isResolved: boolean;
}

export interface AssessmentSectionSummary {
	identifier: string;
	title?: string;
	visible?: string;
	itemRefs: AssessmentItemRefSummary[];
	sections: AssessmentSectionSummary[];
}

export interface TestPartSummary {
	identifier: string;
	navigationMode?: string;
	submissionMode?: string;
	sections: AssessmentSectionSummary[];
	itemRefs: AssessmentItemRefSummary[];
}

export interface AssessmentTestStructure {
	identifier?: string;
	title?: string;
	version: QtiVersion;
	testParts: TestPartSummary[];
	directSections: AssessmentSectionSummary[];
	directItemRefs: AssessmentItemRefSummary[];
	unresolvedRefs: AssessmentItemRefSummary[];
	errors: string[];
	summary: {
		testParts: number;
		sections: number;
		itemRefs: number;
		unresolvedRefs: number;
	};
}

interface AnalyzeTestOptions {
	testHref?: string;
	items?: PackageItemReference[];
}

export function analyzeAssessmentTestStructure(
	xml: string,
	options: AnalyzeTestOptions = {}
): AssessmentTestStructure {
	const version = detectQtiVersion(xml);
	const errors: string[] = [];
	const doc = parseXml(xml, errors);
	const empty = emptyStructure(version, errors);
	if (!doc) return empty;

	const root = doc.documentElement;
	const rootName = normalizeElementName(root);
	if (rootName !== 'assessmentTest') {
		errors.push(`Expected assessmentTest root but found <${root.tagName}>.`);
		return emptyStructure(version, errors);
	}

	const context = {
		testHref: options.testHref,
		items: options.items ?? [],
	};
	const testParts = directChildren(root, 'testPart').map((part) => parseTestPart(part, context));
	const directSections = directChildren(root, 'assessmentSection').map((section) =>
		parseSection(section, context)
	);
	const directItemRefs = directChildren(root, 'assessmentItemRef').map((ref) =>
		parseItemRef(ref, context)
	);
	const unresolvedRefs = collectItemRefs({ testParts, directSections, directItemRefs }).filter(
		(ref) => !ref.isResolved
	);
	const sectionCount = countSections(directSections) + testParts.reduce((total, part) => total + countSections(part.sections), 0);
	const itemRefCount = collectItemRefs({ testParts, directSections, directItemRefs }).length;

	return {
		identifier: root.getAttribute('identifier') ?? undefined,
		title: root.getAttribute('title') ?? undefined,
		version,
		testParts,
		directSections,
		directItemRefs,
		unresolvedRefs,
		errors,
		summary: {
			testParts: testParts.length,
			sections: sectionCount,
			itemRefs: itemRefCount,
			unresolvedRefs: unresolvedRefs.length,
		},
	};
}

function parseXml(xml: string, errors: string[]): Document | null {
	if (!xml.trim()) {
		errors.push('No assessment XML loaded.');
		return null;
	}
	if (typeof DOMParser === 'undefined') {
		errors.push('Assessment test preview requires a browser DOM parser.');
		return null;
	}
	const doc = new DOMParser().parseFromString(xml, 'text/xml');
	if (doc.querySelector('parsererror') || doc.documentElement.nodeName === 'parsererror') {
		errors.push('Invalid XML: the browser parser reported a syntax error.');
		return null;
	}
	return doc;
}

function parseTestPart(element: Element, context: Required<Pick<AnalyzeTestOptions, 'items'>> & Pick<AnalyzeTestOptions, 'testHref'>): TestPartSummary {
	return {
		identifier: element.getAttribute('identifier') ?? 'unnamed-test-part',
		navigationMode: getMappedAttribute(element, 'navigationMode'),
		submissionMode: getMappedAttribute(element, 'submissionMode'),
		sections: directChildren(element, 'assessmentSection').map((section) =>
			parseSection(section, context)
		),
		itemRefs: directChildren(element, 'assessmentItemRef').map((ref) => parseItemRef(ref, context)),
	};
}

function parseSection(element: Element, context: Required<Pick<AnalyzeTestOptions, 'items'>> & Pick<AnalyzeTestOptions, 'testHref'>): AssessmentSectionSummary {
	return {
		identifier: element.getAttribute('identifier') ?? 'unnamed-section',
		title: element.getAttribute('title') ?? undefined,
		visible: element.getAttribute('visible') ?? undefined,
		itemRefs: directChildren(element, 'assessmentItemRef').map((ref) => parseItemRef(ref, context)),
		sections: directChildren(element, 'assessmentSection').map((section) =>
			parseSection(section, context)
		),
	};
}

function parseItemRef(element: Element, context: Required<Pick<AnalyzeTestOptions, 'items'>> & Pick<AnalyzeTestOptions, 'testHref'>): AssessmentItemRefSummary {
	const identifier = element.getAttribute('identifier') ?? 'unnamed-item-ref';
	const href = element.getAttribute('href') ?? undefined;
	const resolvedHref = href && context.testHref ? resolveRelativePath(context.testHref, href) : href;
	const resolvedItem = resolvePackageItem(identifier, resolvedHref, context.items);
	return {
		identifier,
		href,
		resolvedHref,
		resolvedItem,
		isResolved: !!resolvedItem,
	};
}

function resolvePackageItem(
	identifier: string,
	resolvedHref: string | undefined,
	items: PackageItemReference[]
): PackageItemReference | undefined {
	if (resolvedHref) {
		const normalizedHref = normalizePath(resolvedHref);
		const byHref = items.find((item) => normalizePath(item.href) === normalizedHref);
		if (byHref) return byHref;
	}
	return items.find((item) => item.identifier === identifier);
}

function directChildren(element: Element, canonicalName: string): Element[] {
	return Array.from(element.children).filter((child) => normalizeElementName(child) === canonicalName);
}

function normalizeElementName(element: Element): string {
	const raw = element.localName || element.tagName;
	if (raw.startsWith('qti-')) {
		return raw.slice(4).replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
	}
	return raw;
}

function getMappedAttribute(element: Element, canonicalName: string): string | undefined {
	const kebab = canonicalName.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
	return element.getAttribute(canonicalName) ?? element.getAttribute(kebab) ?? undefined;
}

function collectItemRefs(structure: {
	testParts: TestPartSummary[];
	directSections: AssessmentSectionSummary[];
	directItemRefs: AssessmentItemRefSummary[];
}): AssessmentItemRefSummary[] {
	const refs = [...structure.directItemRefs];
	for (const part of structure.testParts) {
		refs.push(...part.itemRefs);
		for (const section of part.sections) refs.push(...collectSectionItemRefs(section));
	}
	for (const section of structure.directSections) refs.push(...collectSectionItemRefs(section));
	return refs;
}

function collectSectionItemRefs(section: AssessmentSectionSummary): AssessmentItemRefSummary[] {
	return [
		...section.itemRefs,
		...section.sections.flatMap((child) => collectSectionItemRefs(child)),
	];
}

function countSections(sections: AssessmentSectionSummary[]): number {
	return sections.reduce((total, section) => total + 1 + countSections(section.sections), 0);
}

function emptyStructure(version: QtiVersion, errors: string[]): AssessmentTestStructure {
	return {
		version,
		testParts: [],
		directSections: [],
		directItemRefs: [],
		unresolvedRefs: [],
		errors,
		summary: {
			testParts: 0,
			sections: 0,
			itemRefs: 0,
			unresolvedRefs: 0,
		},
	};
}

function normalizePath(path: string): string {
	return path.replace(/^\.?\//, '').replace(/\/+/g, '/');
}

function resolveRelativePath(sourcePath: string, relativePath: string): string {
	const sourceDirectory = sourcePath.includes('/') ? sourcePath.slice(0, sourcePath.lastIndexOf('/') + 1) : '';
	const parts = `${sourceDirectory}${relativePath}`.split('/');
	const resolved: string[] = [];
	for (const part of parts) {
		if (!part || part === '.') continue;
		if (part === '..') {
			resolved.pop();
		} else {
			resolved.push(part);
		}
	}
	return resolved.join('/');
}
