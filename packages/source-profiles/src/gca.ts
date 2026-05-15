import type {
	DetectionEvidence,
	QtiSourceProfile,
	QtiSourceProfileItemContext,
	QtiSourceProfilePackageContext,
} from '@pie-qti/transform-types';

const PROFILE_ID = 'partner.gca';

export const gcaProfile: QtiSourceProfile = {
	id: PROFILE_ID,
	label: 'GCA/UGA Partner QTI',
	vendor: 'gca',
	product: 'GCA Assessment Content',
	capabilities: ['detect', 'standards', 'passages', 'rubrics', 'package-assembly'],
	detectPackage(context) {
		const evidence = collectPackageEvidence(context);
		if (!hasSourceIdentity(evidence) || evidence.length < 2) return null;
		return {
			profileId: PROFILE_ID,
			scope: 'package',
			vendor: 'gca',
			product: 'GCA Assessment Content',
			packageFamily: 'ims-cp',
			confidence: confidenceFromEvidence(evidence),
			capabilities: ['standards', 'passages', 'rubrics', 'package-assembly'],
			evidence,
		};
	},
	detectItem(context) {
		const evidence = collectItemEvidence(context);
		if (!hasItemSourceIdentity(context, evidence)) return null;
		if (evidence.length === 0) return null;
		return {
			profileId: PROFILE_ID,
			scope: 'item',
			vendor: 'gca',
			product: 'GCA Assessment Content',
			confidence: confidenceFromEvidence(evidence),
			capabilities: ['passages', 'rubrics'],
			evidence,
		};
	},
	extractItem(context) {
		const xml = context.xml ?? '';
		const evidence = collectItemEvidence(context);
		if (!hasItemSourceIdentity(context, evidence)) return null;
		if (!isPassageLike(xml)) return null;
		return {
			metadata: {
				gcaPassageCandidate: true,
				gcaPassageSignals: evidence.map((item) => item.type),
			},
		};
	},
};

function collectPackageEvidence(context: QtiSourceProfilePackageContext): DetectionEvidence[] {
	const manifestXml = context.manifestXml ?? '';
	const files = context.files ?? [];
	const evidence: DetectionEvidence[] = [];

	if (hasGcaIdentity(manifestXml) || files.some((file) => hasGcaIdentity(file))) {
		evidence.push({
			type: 'source-identity',
			scope: 'package',
			message: 'Package contains GCA/UGA source identity markers.',
			snippet: snippet(manifestXml, 'GCA') ?? snippet(manifestXml, 'UGA') ?? snippet(manifestXml, 'Georgia'),
		});
	}

	if (/(?:csm|imscsmd):(?:curriculumStandardsMetadataSet|labelledGUID|GUID)\b/i.test(manifestXml)) {
		evidence.push({
			type: 'csm-standards',
			scope: 'package',
			message: 'Package contains Common Cartridge CSM standards metadata used by GCA-style imports.',
		});
	}

	if (/assessmentPassage|assessmentStimulus|partBody/i.test(manifestXml) || files.some((file) => /passage|stimulus/i.test(file))) {
		evidence.push({
			type: 'passage-signature',
			scope: 'package',
			message: 'Package contains passage/stimulus signatures associated with GCA imports.',
		});
	}

	if (/rubric/i.test(manifestXml) || files.some((file) => /rubric/i.test(file))) {
		evidence.push({
			type: 'rubric-signature',
			scope: 'package',
			message: 'Package contains rubric signatures associated with GCA imports.',
		});
	}

	return evidence;
}

function collectItemEvidence(context: QtiSourceProfileItemContext): DetectionEvidence[] {
	const xml = context.xml ?? '';
	const evidence: DetectionEvidence[] = [];

	if (/<assessmentPassage\b/i.test(xml) || /<assessmentStimulus\b/i.test(xml)) {
		evidence.push({
			type: 'assessment-passage',
			scope: 'item',
			itemId: context.itemId,
			resourceId: context.resourceId,
			sourcePath: context.sourcePath,
			message: 'Item XML is an assessmentPassage/assessmentStimulus resource.',
			snippet: snippet(xml, 'assessmentPassage') ?? snippet(xml, 'assessmentStimulus'),
		});
	}

	if (/<partBody\b/i.test(xml)) {
		evidence.push({
			type: 'part-body',
			scope: 'item',
			itemId: context.itemId,
			resourceId: context.resourceId,
			sourcePath: context.sourcePath,
			message: 'Item XML contains partBody passage content.',
			snippet: snippet(xml, 'partBody'),
		});
	}

	if (hasGcaIdentity(context.itemId ?? '') || hasGcaIdentity(context.sourcePath ?? '')) {
		evidence.push({
			type: 'source-path',
			scope: 'item',
			itemId: context.itemId,
			resourceId: context.resourceId,
			sourcePath: context.sourcePath,
			message: 'Item identifier or source path contains GCA/UGA source markers.',
		});
	}

	return evidence;
}

function hasSourceIdentity(evidence: DetectionEvidence[]) {
	return evidence.some((item) => item.type === 'source-identity' || item.type === 'source-path');
}

function hasItemSourceIdentity(context: QtiSourceProfileItemContext, evidence: DetectionEvidence[]) {
	if (hasSourceIdentity(evidence)) return true;
	return Boolean(context.package && hasSourceIdentity(collectPackageEvidence(context.package)));
}

function hasGcaIdentity(value: string) {
	return /(^|[^a-z0-9])(?:gca|uga)(?=$|[^a-z0-9])|georgia\s+center/i.test(value);
}

function isPassageLike(xml: string) {
	return /<(?:assessmentPassage|assessmentStimulus|partBody)\b/i.test(xml);
}

function confidenceFromEvidence(evidence: DetectionEvidence[]) {
	return Math.min(0.95, 0.4 + evidence.length * 0.18 + (hasSourceIdentity(evidence) ? 0.15 : 0));
}

function snippet(value: string, needle: string) {
	const index = value.search(new RegExp(needle, 'i'));
	if (index === -1) return undefined;
	return value.slice(Math.max(0, index - 100), index + needle.length + 100);
}
