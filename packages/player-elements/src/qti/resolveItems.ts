import type { ParsedAssessmentItemRef, ParsedAssessmentSection, ParsedAssessmentTest, ParsedTestPart } from './types.js';

export type QtiItemMap = Record<string, string>;

function collectAssessmentItemRefsFromSections(sections: ParsedAssessmentSection[] | undefined): ParsedAssessmentItemRef[] {
	if (!sections) return [];
	const out: ParsedAssessmentItemRef[] = [];
	for (const s of sections) {
		if (s.assessmentItemRefs) out.push(...s.assessmentItemRefs);
		if (s.sections) out.push(...collectAssessmentItemRefsFromSections(s.sections));
	}
	return out;
}

function collectAssessmentItemRefs(assessment: ParsedAssessmentTest): ParsedAssessmentItemRef[] {
	const parts = assessment.testParts ?? [];
	const out: ParsedAssessmentItemRef[] = [];
	for (const p of parts) {
		out.push(...collectAssessmentItemRefsFromSections(p.sections));
	}
	return out;
}

function setAssessmentItemRefXmlInPlace(
	assessment: ParsedAssessmentTest,
	identifier: string,
	href: string | undefined,
	itemXml: string,
) {
	const parts = assessment.testParts ?? [];
	for (const p of parts) {
		const stack: ParsedAssessmentSection[] = [...(p.sections ?? [])];
		while (stack.length) {
			const s = stack.pop()!;
			if (s.assessmentItemRefs) {
				for (const q of s.assessmentItemRefs) {
					if (q.identifier === identifier || (href && q.href === href)) {
						q.itemXml = itemXml;
					}
				}
			}
			if (s.sections) stack.push(...s.sections);
		}
	}
}

function normalizeBaseUrl(baseUrl: string) {
	try {
		return new URL(baseUrl, window.location.href).toString();
	} catch {
		return baseUrl;
	}
}

export async function resolveItemsForAssessment(options: {
	assessment: ParsedAssessmentTest;
	itemBaseUrl?: string;
	items?: QtiItemMap;
}): Promise<ParsedAssessmentTest> {
	const { assessment, itemBaseUrl, items } = options;
	const baseUrl = itemBaseUrl ? normalizeBaseUrl(itemBaseUrl) : undefined;

	// Mutate in-place (assessmentItemRefs are nested); return same reference.
	const refs = collectAssessmentItemRefs(assessment);

	const tasks = refs.map(async (q) => {
		if (q.itemXml) return;

		// A) fallback convenience: host provides item XML map by href or identifier
		if (items) {
			const fromHref = q.href ? items[q.href] : undefined;
			const fromId = items[q.identifier];
			const xml = fromHref ?? fromId;
			if (xml) {
				q.itemXml = xml;
				return;
			}
		}

		// B) standard: fetch item XML using href relative to a base URL
		if (baseUrl && q.href) {
			const url = new URL(q.href, baseUrl).toString();
			const res = await fetch(url);
			if (!res.ok) throw new Error(`Failed to fetch QTI item: ${url} (${res.status})`);
			const xml = await res.text();
			setAssessmentItemRefXmlInPlace(assessment, q.identifier, q.href, xml);
		}
	});

	await Promise.all(tasks);
	return assessment;
}


