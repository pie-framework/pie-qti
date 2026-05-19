import type {
	DetectionEvidence,
	QtiSourceProfile,
	QtiSourceProfilePackageContext,
	StandardCandidate,
} from '@pie-qti/transform-types';

const CSM_GUID_PATTERN =
	/<(?<prefix>csm|imscsmd):labelledGUID\b[^>]*>(?<body>[\s\S]*?)<\/\k<prefix>:labelledGUID>/gi;
const CSM_STANDALONE_GUID_PATTERN = /<(?:csm|imscsmd):GUID\b[^>]*>(?<value>[^<]+)<\/(?:csm|imscsmd):GUID>/gi;

export const commonCartridgeCsmProfile: QtiSourceProfile = {
	id: 'common-cartridge-csm',
	label: 'Common Cartridge Curriculum Standards Metadata',
	capabilities: ['detect', 'standards', 'metadata'],
	detectPackage(context) {
		const manifestXml = context.manifestXml ?? '';
		if (!hasCsmMetadata(manifestXml)) return null;
		return {
			profileId: 'common-cartridge-csm',
			scope: 'package',
			confidence: 0.82,
			packageFamily: 'common-cartridge',
			capabilities: ['standards', 'metadata'],
			evidence: [
				{
					type: 'manifest-namespace',
					scope: 'package',
					message: 'Manifest contains Common Cartridge curriculum standards metadata.',
					snippet: snippet(manifestXml, 'curriculumStandardsMetadataSet'),
				},
			],
		};
	},
	extractPackage(context) {
		const standardCandidates = extractCsmStandardCandidates(context);
		if (standardCandidates.length === 0) return null;
		return {
			standardCandidates,
			metadata: {
				csmStandardCandidateCount: standardCandidates.length,
			},
		};
	},
};

export function extractCsmStandardCandidates(
	context: QtiSourceProfilePackageContext
): StandardCandidate[] {
	const manifestXml = context.manifestXml ?? '';
	const candidates = new Map<string, StandardCandidate>();
	const rawValues = new Set<string>();
	for (const match of manifestXml.matchAll(CSM_GUID_PATTERN)) {
		const body = match.groups?.body ?? '';
		const rawValue = readTag(body, 'GUID');
		if (!rawValue) continue;
		rawValues.add(rawValue);
		const label = readTag(body, 'label') ?? readTag(body, 'labelledGUID');
		const evidence = evidenceForGuid(rawValue, label);
		candidates.set(candidateKey(rawValue, label), {
			id: `csm:${slug(rawValue)}:${candidates.size + 1}`,
			rawValue,
			label,
			namespace: 'csm',
			profileId: commonCartridgeCsmProfile.id,
			matchHint: classifyStandard(rawValue),
			evidence,
		});
	}

	for (const match of manifestXml.matchAll(CSM_STANDALONE_GUID_PATTERN)) {
		const rawValue = match.groups?.value?.trim();
		if (!rawValue) continue;
		if (rawValues.has(rawValue)) continue;
		const key = candidateKey(rawValue);
		if (candidates.has(key)) continue;
		candidates.set(key, {
			id: `csm:${slug(rawValue)}:${candidates.size + 1}`,
			rawValue,
			namespace: 'csm',
			profileId: commonCartridgeCsmProfile.id,
			matchHint: classifyStandard(rawValue),
			evidence: evidenceForGuid(rawValue),
		});
	}

	return [...candidates.values()];
}

function hasCsmMetadata(manifestXml: string) {
	return /(?:csm|imscsmd):(?:curriculumStandardsMetadataSet|labelledGUID|GUID)\b/i.test(manifestXml);
}

function readTag(body: string, localName: string): string | undefined {
	const match = body.match(new RegExp(`<(?:csm|imscsmd):${localName}\\b[^>]*>([^<]+)<\\/(?:csm|imscsmd):${localName}>`, 'i'));
	return match?.[1]?.trim();
}

function classifyStandard(rawValue: string): StandardCandidate['matchHint'] {
	if (/^https?:\/\/.*case/i.test(rawValue)) return 'case';
	if (/^https?:\/\/.*asn/i.test(rawValue)) return 'asn';
	if (/^[A-Z]{1,6}\.[A-Z0-9.-]+$/i.test(rawValue)) return 'human-code';
	return 'vendor-mapping';
}

function evidenceForGuid(rawValue: string, label?: string): DetectionEvidence[] {
	return [
		{
			type: 'csm-guid',
			scope: 'package',
			message: label ? `Extracted CSM standard candidate ${label}.` : 'Extracted CSM standard candidate.',
			value: rawValue,
		},
	];
}

function candidateKey(rawValue: string, label = '') {
	return `${rawValue}\u0000${label}`;
}

function slug(value: string) {
	return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 80) || 'standard';
}

function snippet(value: string, needle: string) {
	const index = value.indexOf(needle);
	if (index === -1) return undefined;
	return value.slice(Math.max(0, index - 80), index + needle.length + 80);
}
