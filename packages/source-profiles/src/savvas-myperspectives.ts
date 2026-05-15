import type {
	DetectionEvidence,
	QtiSourceProfile,
	QtiSourceProfileItemContext,
	QtiSourceProfilePackageContext,
	TransformWarning,
} from '@pie-qti/transform-types';

const PROFILE_ID = 'savvas.myperspectives.examview.qti21';

export const savvasMyPerspectivesProfile: QtiSourceProfile = {
	id: PROFILE_ID,
	label: 'Savvas myPerspectives ExamView QTI 2.1',
	vendor: 'savvas',
	product: 'myPerspectives',
	capabilities: ['detect', 'standards', 'assets', 'interactions', 'package-assembly'],
	detectPackage(context) {
		const evidence = collectPackageEvidence(context);
		if (!hasSavvasPackageSignal(evidence)) return null;
		if (evidence.length < 2) return null;
		return {
			profileId: PROFILE_ID,
			scope: 'package',
			vendor: 'savvas',
			product: 'myPerspectives',
			authoringTool: 'ExamView',
			packageFamily: 'ims-cp',
			qtiVersions: evidence.some((item) => item.type === 'qti-version') ? ['2.1'] : undefined,
			confidence: confidenceFromEvidence(evidence),
			capabilities: ['standards', 'assets', 'interactions', 'package-assembly'],
			evidence,
		};
	},
	detectItem(context) {
		const evidence = collectItemEvidence(context);
		if (evidence.length === 0) return null;
		return {
			profileId: PROFILE_ID,
			scope: 'item',
			vendor: 'savvas',
			product: 'myPerspectives',
			authoringTool: 'ExamView',
			qtiVersions: context.qtiVersion === '2.1' ? ['2.1'] : undefined,
			confidence: confidenceFromEvidence(evidence),
			capabilities: ['interactions'],
			evidence,
		};
	},
	extractItem(context) {
		if (!containsHighlighter(context.xml ?? '')) return null;
		const warning: TransformWarning = {
			itemId: context.itemId,
			code: 'SAVVAS_TEI_TEXTHIGHLIGHTER_REVIEW_REQUIRED',
			message:
				'Savvas/myPerspectives tei-texthighlighter customInteraction was detected. A source profile must map it to a PIE interaction or leave the item review-only; generic QTI conversion must not silently reduce it.',
		};
		return {
			warnings: [warning],
			metadata: {
				proprietaryInteractions: ['tei-texthighlighter'],
			},
		};
	},
};

function collectPackageEvidence(context: QtiSourceProfilePackageContext): DetectionEvidence[] {
	const manifestXml = context.manifestXml ?? '';
	const files = context.files ?? [];
	const evidence: DetectionEvidence[] = [];
	if (/imsqti_(?:item|test)_xmlv2p1/i.test(manifestXml)) {
		evidence.push({
			type: 'qti-version',
			scope: 'package',
			message: 'Manifest declares QTI 2.1 item/test resources.',
			value: '2.1',
		});
	}
	if (/assesmentExamView\.xml/i.test(manifestXml) || files.some((file) => /assesmentExamView\.xml/i.test(file))) {
		evidence.push({
			type: 'examview-assessment-file',
			scope: 'package',
			message: 'Package contains the ExamView-style assesmentExamView.xml file name.',
			value: 'assesmentExamView.xml',
		});
	}
	if (/\bQUAD_[^"']+\.xml\b/i.test(manifestXml) || files.some((file) => /\bQUAD_[^/]+\.xml\b/i.test(file))) {
		evidence.push({
			type: 'quad-item-file',
			scope: 'package',
			message: 'Package contains QUAD item XML files.',
		});
	}
	if (/(?:csm|imscsmd):(?:curriculumStandardsMetadataSet|labelledGUID|GUID)\b/i.test(manifestXml)) {
		evidence.push({
			type: 'csm-standards',
			scope: 'package',
			message: 'Manifest contains Common Cartridge CSM standards metadata.',
		});
	}
	return evidence;
}

function collectItemEvidence(context: QtiSourceProfileItemContext): DetectionEvidence[] {
	const xml = context.xml ?? '';
	const evidence: DetectionEvidence[] = [];
	if (containsHighlighter(xml)) {
		evidence.push({
			type: 'tei-texthighlighter',
			scope: 'item',
			itemId: context.itemId,
			resourceId: context.resourceId,
			sourcePath: context.sourcePath,
			message: 'Item contains Savvas/myPerspectives tei-texthighlighter customInteraction.',
			snippet: snippet(xml, 'tei-texthighlighter'),
		});
	}
	if (/\bprcqti:/i.test(xml)) {
		evidence.push({
			type: 'prcqti-namespace',
			scope: 'item',
			itemId: context.itemId,
			resourceId: context.resourceId,
			sourcePath: context.sourcePath,
			message: 'Item contains prcqti namespace markup.',
		});
	}
	return evidence;
}

function hasSavvasPackageSignal(evidence: DetectionEvidence[]) {
	return evidence.some((item) => item.type === 'examview-assessment-file' || item.type === 'quad-item-file');
}

function containsHighlighter(xml: string) {
	return /<customInteraction\b[^>]*(?:class=["'][^"']*tei-texthighlighter|tei-texthighlighter)/i.test(xml);
}

function confidenceFromEvidence(evidence: DetectionEvidence[]) {
	return Math.min(0.99, 0.45 + evidence.length * 0.16);
}

function snippet(value: string, needle: string) {
	const index = value.indexOf(needle);
	if (index === -1) return undefined;
	return value.slice(Math.max(0, index - 100), index + needle.length + 100);
}
