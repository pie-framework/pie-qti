import {
	detectQtiVersionDetailed,
	type ElementNameMapper,
	isQtiVocabularyElement,
	type QtiVersionDetection,
	type QtiVocabularyVersion,
} from '@pie-qti/qti-common';
import { childElements, findAssessmentItem, findFirstDescendant, getAttr, parseXml } from '@pie-qti/qti-processing';
import type { ExtractionRegistry } from '../extraction/ExtractionRegistry.js';
import { findUnextractableInteractions } from '../extraction/interactionCoverage.js';

export type QtiItemDiagnosticCode =
	/** Strict mode checks QTI 2.2 and 3.0, the certifiable versions; this item is another version. */
	| 'unsupported-version'
	/** The item's QTI version was inferred or assumed rather than declared by its namespace. */
	| 'version-assumed'
	/** An element in the QTI namespace (or a `qti-` element in QTI 3.0) the version does not define. */
	| 'unknown-element'
	/** An interaction's `responseIdentifier` names no `responseDeclaration`. */
	| 'unbound-interaction'
	/** A QTI interaction element without a `responseIdentifier`; it is neither rendered nor scored. */
	| 'missing-response-identifier'
	/** An element binds a response, but no registered extractor handles it; it is not rendered. */
	| 'unregistered-interaction';

export type QtiItemDiagnosticSeverity = 'error' | 'warning';

/**
 * A QTI compliance finding about an item, from compiling it. Errors in strict mode, warnings
 * otherwise; see `QTIComplianceConfig`.
 */
export interface QtiItemDiagnostic {
	readonly code: QtiItemDiagnosticCode;
	readonly severity: QtiItemDiagnosticSeverity;
	readonly message: string;
	/** The element name as authored. */
	readonly element?: string;
	readonly responseIdentifier?: string;
	/** For `unknown-element`: how many elements of that name the item has. */
	readonly occurrences?: number;
}

/**
 * Strict QTI compliance (`strictQtiCompliance: { enabled: true, rejectUnknownExtensions: true }`)
 * rejected the item. `diagnostics` lists every finding.
 */
export class QtiComplianceError extends Error {
	readonly code = 'qti-compliance';
	readonly diagnostics: readonly QtiItemDiagnostic[];
	readonly itemIdentifier?: string;

	constructor(diagnostics: readonly QtiItemDiagnostic[], itemIdentifier?: string) {
		super(
			`[QTI Player] Item${itemIdentifier ? ` "${itemIdentifier}"` : ''} fails strict QTI compliance:\n` +
				diagnostics.map((diagnostic) => `- ${diagnostic.code}: ${diagnostic.message}`).join('\n'),
		);
		this.name = 'QtiComplianceError';
		this.diagnostics = Object.freeze([...diagnostics]);
		if (itemIdentifier) this.itemIdentifier = itemIdentifier;
	}
}

export interface CollectItemDiagnosticsInput {
	/** The item XML as authored. */
	readonly itemXml: string;
	/** The item's version detection, when the caller already has it. */
	readonly versionDetection?: QtiVersionDetection;
	/** The mapper the player resolves the item's element names with. */
	readonly elementNameMapper: ElementNameMapper;
	readonly extractionRegistry: ExtractionRegistry;
	/** Identifiers of the item's response declarations. */
	readonly responseIdentifiers: ReadonlySet<string>;
	/** Strict compliance: findings are errors, and versions other than 2.2 and 3.0 are findings. */
	readonly strict: boolean;
}

/**
 * The item's compliance findings. Without an XSD engine this checks what a schema-valid,
 * deliverable item needs and the player can verify: the version's namespace, the element
 * vocabulary against the XSD-verified QTI vocabulary of `@pie-qti/qti-common` (the contents of
 * `customInteraction`, and in QTI 3.0 of HTML `template`, admit any element and are not
 * checked), and the response binding and extractability of every interaction.
 */
export function collectItemDiagnostics(input: CollectItemDiagnosticsInput): QtiItemDiagnostic[] {
	const severity: QtiItemDiagnosticSeverity = input.strict ? 'error' : 'warning';
	const findings: Array<Omit<QtiItemDiagnostic, 'severity'>> = [];

	const detection = input.versionDetection ?? detectQtiVersionDetailed(input.itemXml);
	if (detection.warnings.length > 0) {
		findings.push({ code: 'version-assumed', message: detection.warnings.join(' ') });
	}
	if (detection.version === '2.0' || (input.strict && detection.version === '2.1')) {
		findings.push({
			code: 'unsupported-version',
			message: input.strict
				? `Strict QTI compliance checks QTI 2.2 and 3.0 items; this item is QTI ${detection.version}.`
				: `QTI ${detection.version} detected. Some features may not be fully supported; QTI 2.2 is recommended.`,
		});
	}

	const item = findAssessmentItem(parseXml(input.itemXml));
	const vocabulary: QtiVocabularyVersion = input.elementNameMapper.version === '3.0' ? '3.0' : '2.x';
	findings.push(...unknownElementFindings(item, vocabulary));

	const itemBody = findFirstDescendant(item, input.elementNameMapper.toNative('itembody'));
	if (itemBody) {
		for (const unextractable of findUnextractableInteractions(itemBody, input)) {
			const tag = describeTag(unextractable.element, unextractable.responseIdentifier);
			findings.push(
				unextractable.reason === 'unregistered'
					? {
							code: 'unregistered-interaction',
							message: `${tag} is not rendered: no registered extractor handles <${unextractable.element}>.`,
							element: unextractable.element,
							responseIdentifier: unextractable.responseIdentifier,
						}
					: {
							code: 'missing-response-identifier',
							message: `${tag} has no responseIdentifier, so it is neither rendered nor scored.`,
							element: unextractable.element,
						},
			);
		}
		for (const { element, responseIdentifier } of responseBindings(itemBody, input.elementNameMapper)) {
			if (input.responseIdentifiers.has(responseIdentifier)) continue;
			findings.push({
				code: 'unbound-interaction',
				message: `${describeTag(element, responseIdentifier)} names no responseDeclaration "${responseIdentifier}".`,
				element,
				responseIdentifier,
			});
		}
	}

	return findings.map((finding) => Object.freeze({ ...withoutUndefined(finding), severity }));
}

export interface ReportItemDiagnosticsOptions {
	readonly itemIdentifier?: string;
	/** Throw a `QtiComplianceError` when there is any finding. */
	readonly reject: boolean;
	/** Write the findings to the console. */
	readonly log: boolean;
}

/** Rejects or logs the findings, as the compliance configuration asks. */
export function reportItemDiagnostics(
	diagnostics: readonly QtiItemDiagnostic[],
	{ itemIdentifier, reject, log }: ReportItemDiagnosticsOptions,
): void {
	if (diagnostics.length === 0) return;
	if (reject) throw new QtiComplianceError(diagnostics, itemIdentifier);
	if (!log) return;
	const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
	const kind = `compliance ${errors.length > 0 ? 'error' : 'warning'}${diagnostics.length === 1 ? '' : 's'}`;
	const message =
		`[QTI Player] Item${itemIdentifier ? ` "${itemIdentifier}"` : ''} has ${diagnostics.length} QTI ${kind}:\n` +
		diagnostics.map((diagnostic) => `- ${diagnostic.code}: ${diagnostic.message}`).join('\n');
	if (errors.length > 0) console.error(message);
	else console.warn(message);
}

/** Element names the version's vocabulary does not define, one finding per name. */
function unknownElementFindings(
	item: Element,
	vocabulary: QtiVocabularyVersion,
): Array<Omit<QtiItemDiagnostic, 'severity'>> {
	const qtiNamespace = item.namespaceURI ?? null;
	const unknown = new Map<string, number>();

	const visit = (element: Element): void => {
		const name = element.localName;
		const checked =
			(element.namespaceURI ?? null) === qtiNamespace || (vocabulary === '3.0' && name.startsWith('qti-'));
		if (checked && !isQtiVocabularyElement(name, vocabulary)) {
			unknown.set(element.nodeName, (unknown.get(element.nodeName) ?? 0) + 1);
		}
		// customInteraction (and QTI 3.0's HTML template) admit any content.
		if (checked && (name === 'customInteraction' || name === 'qti-custom-interaction' || (vocabulary === '3.0' && name === 'template'))) {
			return;
		}
		for (const child of childElements(element)) visit(child);
	};
	visit(item);

	const version = vocabulary === '3.0' ? 'QTI 3.0' : 'QTI 2.2';
	return [...unknown].map(([element, occurrences]) => ({
		code: 'unknown-element' as const,
		message:
			`<${element}> is not an element of the ${version} vocabulary` +
			`${occurrences > 1 ? ` (${occurrences} occurrences)` : ''}.`,
		element,
		occurrences,
	}));
}

/** Every element of the item body binding a response, rubric blocks aside. */
function responseBindings(
	itemBody: Element,
	elementNameMapper: ElementNameMapper,
): Array<{ element: string; responseIdentifier: string }> {
	const bindings: Array<{ element: string; responseIdentifier: string }> = [];
	const visit = (element: Element): void => {
		if (elementNameMapper.toCanonical(element.nodeName) === 'rubricblock') return;
		const responseIdentifier = getAttr(element, 'responseIdentifier')?.trim();
		if (responseIdentifier) bindings.push({ element: element.nodeName, responseIdentifier });
		for (const child of childElements(element)) visit(child);
	};
	for (const child of childElements(itemBody)) visit(child);
	return bindings;
}

function describeTag(element: string, responseIdentifier?: string): string {
	if (!responseIdentifier) return `<${element}>`;
	const attribute = element.startsWith('qti-') ? 'response-identifier' : 'responseIdentifier';
	return `<${element} ${attribute}="${responseIdentifier}">`;
}

function withoutUndefined<T extends object>(value: T): T {
	return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}
