import {
	getStandardInteractionModule,
	normalizeInteractionTypeFromTagName,
	type Player,
} from '@pie-qti/item-player';
import { detectQtiVersion, type QtiVersion } from '@pie-qti/qti-common';
import publicCoverageMatrix from '../../../../docs/certification/public-coverage-matrix.json';

export type DiagnosticSeverity = 'info' | 'success' | 'warning' | 'error';

export interface QtiDiagnosticIssue {
	severity: DiagnosticSeverity;
	title: string;
	detail?: string;
	code?: string;
}

export interface QtiInteractionDiagnostic {
	type: string;
	count: number;
	supported: boolean;
	extractedCount: number;
	certificationRows: string[];
}

export interface QtiResponseTemplateDiagnostic {
	template: string;
	name: string;
	supported: boolean;
}

export interface QtiCompatibilityReport {
	status: 'ready' | 'usable-with-warnings' | 'blocked';
	version: QtiVersion;
	itemIdentifier?: string;
	itemTitle?: string;
	interactions: QtiInteractionDiagnostic[];
	responseTemplates: QtiResponseTemplateDiagnostic[];
	issues: QtiDiagnosticIssue[];
	summary: {
		interactions: number;
		responseVariables: number;
		outcomeVariables: number;
		templateVariables: number;
		certificationRows: number;
	};
}

interface AnalyzeOptions {
	player?: Player;
	sourcePath?: string;
	packageFiles?: string[];
}

const SUPPORTED_RESPONSE_TEMPLATES = new Set([
	'match_correct',
	'cc2_match',
	'map_response',
	'cc2_map_response',
	'map_response_point',
	'cc2_map_response_point',
]);

type CoverageRow = {
	id: string;
	feature: string;
	notes?: string;
};

const coverageRows = (publicCoverageMatrix as { rows: CoverageRow[] }).rows ?? [];

export function analyzeQtiItemCompatibility(
	xml: string,
	options: AnalyzeOptions = {}
): QtiCompatibilityReport {
	const issues: QtiDiagnosticIssue[] = [];
	const version = detectQtiVersion(xml);
	const doc = parseXml(xml, issues);

	if (!doc) {
		return buildReport({
			status: 'blocked',
			version,
			interactions: [],
			responseTemplates: [],
			issues,
			summary: {
				interactions: 0,
				responseVariables: 0,
				outcomeVariables: 0,
				templateVariables: 0,
				certificationRows: 0,
			},
		});
	}

	const root = doc.documentElement;
	const itemIdentifier = root.getAttribute('identifier') ?? undefined;
	const itemTitle = root.getAttribute('title') ?? undefined;
	const scannedInteractions = scanInteractionElements(doc);
	const extractedTypeCounts = getExtractedInteractionCounts(options.player, xml, issues);
	const interactions = [...scannedInteractions.entries()]
		.map(([type, count]) => {
			const supported = getStandardInteractionModule(type) !== null;
			const certificationRows = getCertificationRowsForInteraction(type);
			return {
				type,
				count,
				supported,
				extractedCount: extractedTypeCounts.get(type) ?? 0,
				certificationRows,
			};
		})
		.sort((a, b) => a.type.localeCompare(b.type));

	for (const interaction of interactions) {
		if (!interaction.supported) {
			issues.push({
				severity: 'warning',
				title: `Unsupported interaction: ${formatInteractionType(interaction.type)}`,
				detail: `${interaction.count} element${interaction.count === 1 ? '' : 's'} will not render with the standard component registry.`,
				code: interaction.type,
			});
		} else if (interaction.extractedCount < interaction.count) {
			issues.push({
				severity: 'warning',
				title: `Partial extraction: ${formatInteractionType(interaction.type)}`,
				detail: `${interaction.extractedCount} of ${interaction.count} detected element${interaction.count === 1 ? '' : 's'} extracted successfully. Check response identifiers and required child elements.`,
				code: interaction.type,
			});
		}
	}

	const responseTemplates = scanResponseProcessingTemplates(doc);
	for (const template of responseTemplates) {
		if (!template.supported) {
			issues.push({
				severity: 'warning',
				title: `Unsupported response processing template: ${template.name}`,
				detail: `The player supports ${[...SUPPORTED_RESPONSE_TEMPLATES].join(', ')}. Custom statement-based response processing is still analyzed by the AST builder.`,
			});
		}
	}

	validateResponseDeclarations(options.player, interactions, issues);
	validateResponseProcessing(options.player, issues);
	validateAssetReferences(doc, options, issues);

	const certificationRows = new Set(interactions.flatMap((interaction) => interaction.certificationRows));
	if (interactions.length > 0 && certificationRows.size === 0) {
		issues.push({
			severity: 'info',
			title: 'No direct public certification row matched these interactions',
			detail: 'The item may still be supported, but it is not directly named in the public coverage matrix.',
		});
	}

	return buildReport({
		status: issues.some((issue) => issue.severity === 'error')
			? 'blocked'
			: issues.some((issue) => issue.severity === 'warning')
				? 'usable-with-warnings'
				: 'ready',
		version,
		itemIdentifier,
		itemTitle,
		interactions,
		responseTemplates,
		issues,
		summary: {
			interactions: interactions.reduce((total, interaction) => total + interaction.count, 0),
			responseVariables: countDeclarations(doc, 'response'),
			outcomeVariables: countDeclarations(doc, 'outcome'),
			templateVariables: countDeclarations(doc, 'template'),
			certificationRows: certificationRows.size,
		},
	});
}

function buildReport(report: QtiCompatibilityReport): QtiCompatibilityReport {
	if (report.status === 'ready') {
		report.issues.unshift({
			severity: 'success',
			title: 'Ready for the standard PIE-QTI player path',
			detail: 'The item parsed, interactions extracted, and response processing diagnostics found no blocking issues.',
		});
	}
	return report;
}

function parseXml(xml: string, issues: QtiDiagnosticIssue[]): Document | null {
	if (!xml.trim()) {
		issues.push({
			severity: 'info',
			title: 'No QTI XML loaded',
			detail: 'Select a sample, paste XML, or upload an item to run compatibility diagnostics.',
		});
		return null;
	}

	if (typeof DOMParser === 'undefined') {
		issues.push({
			severity: 'error',
			title: 'XML diagnostics require a browser DOM parser',
		});
		return null;
	}

	const doc = new DOMParser().parseFromString(xml, 'text/xml');
	if (doc.querySelector('parsererror') || doc.documentElement.nodeName === 'parsererror') {
		issues.push({
			severity: 'error',
			title: 'Invalid XML',
			detail: 'The browser XML parser reported a syntax error before the QTI player could run.',
		});
		return null;
	}

	const rootType = normalizeElementName(doc.documentElement);
	if (rootType !== 'assessmentItem') {
		issues.push({
			severity: 'error',
			title: 'Expected an assessment item',
			detail: `This diagnostics panel analyzes single-item player compatibility. Root element was <${doc.documentElement.tagName}>.`,
		});
	}

	return doc;
}

function scanInteractionElements(doc: Document): Map<string, number> {
	const counts = new Map<string, number>();
	for (const element of Array.from(doc.getElementsByTagName('*'))) {
		const type = normalizeInteractionTypeFromTagName(element.localName || element.tagName);
		if (!isInteractionType(type)) continue;
		counts.set(type, (counts.get(type) ?? 0) + 1);
	}
	return counts;
}

function getExtractedInteractionCounts(
	player: Player | undefined,
	xml: string,
	issues: QtiDiagnosticIssue[]
): Map<string, number> {
	const counts = new Map<string, number>();
	if (!player) {
		if (!xml.trim()) return counts;
		issues.push({
			severity: 'error',
			title: 'Player initialization failed',
			detail: 'The item could not be instantiated by @pie-qti/item-player.',
		});
		return counts;
	}

	try {
		for (const interaction of player.getInteractionData() as Array<{ type?: string }>) {
			if (!interaction.type) continue;
			const type = normalizeInteractionTypeFromTagName(interaction.type);
			counts.set(type, (counts.get(type) ?? 0) + 1);
		}
	} catch (error) {
		issues.push({
			severity: 'error',
			title: 'Interaction extraction failed',
			detail: error instanceof Error ? error.message : String(error),
		});
	}
	return counts;
}

function validateResponseDeclarations(
	player: Player | undefined,
	interactions: QtiInteractionDiagnostic[],
	issues: QtiDiagnosticIssue[]
): void {
	if (!player) return;
	const declarations = player.getDeclarations();
	const responseInteractionIds = player
		.getResponseInteractions()
		.map((interaction) => interaction.responseIdentifier)
		.filter(Boolean);

	for (const responseId of responseInteractionIds) {
		if (!declarations[responseId]) {
			issues.push({
				severity: 'error',
				title: `Missing response declaration: ${responseId}`,
				detail: 'Every response interaction needs a matching responseDeclaration for scoring and submission.',
			});
		}
	}

	if (interactions.length > 0 && responseInteractionIds.length === 0) {
		issues.push({
			severity: 'warning',
			title: 'No response interactions extracted',
			detail: 'The item has interaction elements, but none produced a submittable response interaction.',
		});
	}
}

function validateResponseProcessing(player: Player | undefined, issues: QtiDiagnosticIssue[]): void {
	if (!player) return;
	try {
		const emptyResponses = Object.fromEntries(
			player.getResponseIdentifiers().map((responseId) => [responseId, null])
		);
		player.setResponses(emptyResponses);
		player.processResponses();
	} catch (error) {
		issues.push({
			severity: 'error',
			title: 'Response processing failed',
			detail: error instanceof Error ? error.message : String(error),
		});
	}
}

function scanResponseProcessingTemplates(doc: Document): QtiResponseTemplateDiagnostic[] {
	return Array.from(doc.getElementsByTagName('*'))
		.filter((element) => normalizeElementName(element) === 'responseProcessing')
		.map((element) => element.getAttribute('template'))
		.filter((template): template is string => !!template)
		.map((template) => {
			const name = template.split('/').pop()?.toLowerCase().replace(/\.xml$/, '') ?? template;
			return {
				template,
				name,
				supported: SUPPORTED_RESPONSE_TEMPLATES.has(name),
			};
		});
}

function validateAssetReferences(
	doc: Document,
	options: AnalyzeOptions,
	issues: QtiDiagnosticIssue[]
): void {
	const refs = getAssetReferences(doc);
	if (refs.length === 0) return;

	const relativeRefs = refs.filter((ref) => isRelativeAssetRef(ref.value));
	if (relativeRefs.length === 0) return;

	if (!options.packageFiles || !options.sourcePath) {
		issues.push({
			severity: 'info',
			title: 'Relative asset references need package context',
			detail: `${relativeRefs.length} relative asset reference${relativeRefs.length === 1 ? '' : 's'} found. Upload the full package to validate asset resolution.`,
		});
		return;
	}

	const packageFiles = new Set(options.packageFiles.map(normalizePath));
	for (const ref of relativeRefs) {
		const resolvedPath = resolveRelativePath(options.sourcePath, ref.value);
		if (!packageFiles.has(resolvedPath)) {
			issues.push({
				severity: 'warning',
				title: `Unresolved asset reference: ${ref.value}`,
				detail: `Expected package file ${resolvedPath} for <${ref.element}> ${ref.attribute}.`,
			});
		}
	}
}

function getAssetReferences(doc: Document): Array<{ element: string; attribute: string; value: string }> {
	const selectors = [
		['img', 'src'],
		['object', 'data'],
		['audio', 'src'],
		['video', 'src'],
		['source', 'src'],
		['track', 'src'],
	] as const;

	const refs: Array<{ element: string; attribute: string; value: string }> = [];
	for (const [tag, attribute] of selectors) {
		for (const element of Array.from(doc.getElementsByTagName(tag))) {
			const value = element.getAttribute(attribute);
			if (value) refs.push({ element: tag, attribute, value });
		}
	}
	return refs;
}

function countDeclarations(doc: Document, kind: 'response' | 'outcome' | 'template'): number {
	const target = `${kind}Declaration`;
	return Array.from(doc.getElementsByTagName('*')).filter(
		(element) => normalizeElementName(element) === target
	).length;
}

function normalizeElementName(element: Element): string {
	const raw = element.localName || element.tagName;
	if (raw.startsWith('qti-')) {
		return raw.slice(4).replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
	}
	return raw;
}

function isInteractionType(type: string): boolean {
	return type.endsWith('Interaction');
}

function getCertificationRowsForInteraction(type: string): string[] {
	const needles = new Set([
		type.toLowerCase(),
		type.replace(/Interaction$/, '').toLowerCase(),
		type.replace(/([A-Z])/g, ' $1').trim().toLowerCase(),
	]);
	return coverageRows
		.filter((row) => {
			const haystack = `${row.feature} ${row.notes ?? ''}`.toLowerCase();
			return [...needles].some((needle) => needle && haystack.includes(needle));
		})
		.map((row) => row.id);
}

function formatInteractionType(type: string): string {
	return type.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
}

function isRelativeAssetRef(value: string): boolean {
	return !/^(?:data:|blob:|https?:|#)/i.test(value);
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
