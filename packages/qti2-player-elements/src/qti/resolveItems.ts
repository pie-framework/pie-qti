import type { ParsedAssessmentSection, ParsedAssessmentTest, ParsedQuestionRef, ParsedTestPart } from './types.js';

export type QtiItemMap = Record<string, string>;

function collectQuestionRefsFromSections(sections: ParsedAssessmentSection[] | undefined): ParsedQuestionRef[] {
	if (!sections) return [];
	const out: ParsedQuestionRef[] = [];
	for (const s of sections) {
		if (s.questionRefs) out.push(...s.questionRefs);
		if (s.sections) out.push(...collectQuestionRefsFromSections(s.sections));
	}
	return out;
}

function collectQuestionRefs(assessment: ParsedAssessmentTest): ParsedQuestionRef[] {
	const parts = assessment.testParts ?? [];
	const out: ParsedQuestionRef[] = [];
	for (const p of parts) {
		out.push(...collectQuestionRefsFromSections(p.sections));
	}
	return out;
}

function setQuestionRefItemXmlInPlace(
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
			if (s.questionRefs) {
				for (const q of s.questionRefs) {
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

	// Mutate in-place (questionRefs are nested); return same reference.
	const refs = collectQuestionRefs(assessment);

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
			setQuestionRefItemXmlInPlace(assessment, q.identifier, q.href, xml);
		}
	});

	await Promise.all(tasks);
	return assessment;
}


