import type { AttributeNameMapper, ElementNameMapper } from '@pie-qti/qti-common';
import {
	childElements,
	findAssessmentItem,
	findDescendants,
	findFirstDescendant,
	getAttr,
	parseXml,
	serializeXml,
} from '@pie-qti/qti-processing';
import { parse } from 'node-html-parser';
import { enforceItemXmlLimits } from '../core/parsingLimits.js';
import { normalizeInteractionTypeFromTagName } from '../interactions/modules.js';
import type { PlayerSecurityConfig } from '../types/index.js';
import type { QTIElement } from '../interactions/shared/types.js';

export type ProcessingKind = 'template' | 'response' | 'outcome';

export interface DiscoveredInteractionElement {
	element: QTIElement;
	contextRoot: QTIElement;
	responseIdentifier: string;
	normalizedType: string;
}

export interface AssessmentItemDocumentInput {
	itemXml: string;
	elementNameMapper: ElementNameMapper;
	attributeNameMapper: AttributeNameMapper;
	security?: PlayerSecurityConfig;
}

export interface ResponseProcessingDescriptor {
	readonly present: boolean;
	readonly hasStatements: boolean;
	readonly template?: string;
}

export interface DocumentRubricBlock {
	readonly view: readonly string[];
	readonly use?: string;
	readonly scope: 'direct' | 'itemBody';
	readonly content: string;
}

export interface DocumentModalFeedback {
	readonly identifier: string;
	readonly outcomeIdentifier: string;
	readonly showHide: 'show' | 'hide';
	readonly title?: string;
	readonly content: string;
}

export class AssessmentItemDocument {
	private readonly itemXml: string;
	private readonly security?: PlayerSecurityConfig;
	private readonly mathMlPrefixes: Set<string>;
	readonly elementNameMapper: ElementNameMapper;
	readonly attributeNameMapper: AttributeNameMapper;
	private readonly xmlDocument: Document;
	private readonly assessmentItem: Element;
	/** Immutable serialized source for session-local mutable extraction views. */
	private readonly extractionSource: string;

	constructor({
		itemXml,
		elementNameMapper,
		attributeNameMapper,
		security,
	}: AssessmentItemDocumentInput) {
		this.itemXml = itemXml;
		this.security = security;
		this.mathMlPrefixes = findMathMlPrefixes(itemXml);
		this.elementNameMapper = elementNameMapper;
		this.attributeNameMapper = attributeNameMapper;

		enforceItemXmlLimits(this.itemXml, this.security);
		this.xmlDocument = parseXml(this.itemXml);
		this.assessmentItem = findAssessmentItem(this.xmlDocument);
		this.extractionSource = this.serializeItemBodyForExtraction();
	}

	detectVersion(): '2.0' | '2.1' | '2.2' | '3.0' | 'unknown' {
		const namespace = this.assessmentItem.namespaceURI;
		if (namespace?.includes('v3p0') || namespace?.includes('imsqtiasi_v3p0')) return '3.0';
		if (namespace?.includes('v2p2') || namespace?.includes('imsqti_v2p2')) return '2.2';
		if (namespace?.includes('v2p1') || namespace?.includes('imsqti_v2p1')) return '2.1';
		if (namespace?.includes('v2p0') || namespace?.includes('imsqti_v2p0')) return '2.0';

		const localName = this.assessmentItem.localName || this.assessmentItem.tagName;
		if (localName === 'qti-assessment-item' || localName === 'qti-assessment-test') return '3.0';

		const version = this.assessmentItem.getAttribute('version');
		if (version?.startsWith('3.')) return '3.0';
		if (version === '2.2' || version === '2.1' || version === '2.0') return version;
		return 'unknown';
	}

	getProcessingElement(kind: ProcessingKind): Element | null {
		const tagName =
			kind === 'template'
				? 'templateprocessing'
				: kind === 'response'
					? 'responseprocessing'
					: 'outcomeprocessing';
		return findFirstDescendant(this.assessmentItem, this.elementNameMapper.toNative(tagName));
	}

	serializeItemBodyChildren(): string {
		const itemBody = this.getItemBodyElement();
		if (!itemBody) return '';
		return this.serializeChildren(itemBody);
	}

	describeResponseProcessing(): ResponseProcessingDescriptor {
		const element = this.getProcessingElement('response');
		if (!element) return Object.freeze({ present: false, hasStatements: false });
		const template = getAttr(element, 'template')?.trim() || undefined;
		return Object.freeze({
			present: true,
			hasStatements: childElements(element).length > 0,
			...(template ? { template } : {}),
		});
	}

	readRubricBlocks(): readonly DocumentRubricBlock[] {
		return this.findRubricElements().map((element) => {
			const view = (getAttr(element, 'view') || '').trim().split(/[\s,]+/).filter(Boolean);
			const use = (getAttr(element, 'use') || '').trim() || undefined;
			return Object.freeze({
				view: Object.freeze(view),
				...(use ? { use } : {}),
				scope: this.rubricElementScope(element),
				content: this.serializeChildren(element) || element.textContent || '',
			});
		});
	}

	readModalFeedback(): readonly DocumentModalFeedback[] {
		return this.findModalFeedbackElements().map((element) => {
			const identifier = this.getMappedAttribute(element, 'identifier') || '';
			const outcomeIdentifier = this.getMappedAttribute(element, 'outcomeIdentifier') || '';
			const showHide = (this.getMappedAttribute(element, 'showHide') || 'show') as 'show' | 'hide';
			const title = this.getMappedAttribute(element, 'title') || undefined;
			return Object.freeze({
				identifier,
				outcomeIdentifier,
				showHide,
				...(title ? { title } : {}),
				content: this.serializeChildren(element) || element.textContent || '',
			});
		});
	}

	getExtendedTextBase(responseIdentifier: string): number | undefined {
		const interaction = this.findExtractionElements(['extendedTextInteraction']).find(
			(candidate) => candidate.responseIdentifier === responseIdentifier,
		);
		if (!interaction) return undefined;
		const base = Number(interaction.element.getAttribute?.('base') ?? 10);
		return Number.isInteger(base) && base >= 2 && base <= 36 ? base : 10;
	}

	private findRubricElements(): Element[] {
		return findDescendants(this.assessmentItem, this.elementNameMapper.toNative('rubricblock'));
	}

	private rubricElementScope(element: Element): 'direct' | 'itemBody' {
		const itemBodyTag = this.elementNameMapper.toNative('itembody').toLowerCase();
		let parent = element.parentNode;
		while (parent && parent !== this.assessmentItem) {
			const parentTag = (parent as Element).tagName?.toLowerCase();
			if (parentTag === itemBodyTag) {
				return 'itemBody';
			}
			parent = parent.parentNode;
		}
		return 'direct';
	}

	private findModalFeedbackElements(): Element[] {
		return findDescendants(this.assessmentItem, this.elementNameMapper.toNative('modalfeedback'));
	}

	findDeclarationElements(kind: 'response' | 'outcome' | 'template'): Element[] {
		const tagName =
			kind === 'response'
				? 'responsedeclaration'
				: kind === 'outcome'
					? 'outcomedeclaration'
					: 'templatedeclaration';
		return findDescendants(this.assessmentItem, this.elementNameMapper.toNative(tagName));
	}

	getAssessmentItemAttribute(name: string): string | null {
		return this.assessmentItem.getAttribute(this.attributeNameMapper.toNative(name));
	}

	private getMappedAttribute(element: Element, name: string): string | null {
		return element.getAttribute(this.attributeNameMapper.toNative(name));
	}

	private serializeChildren(element: Element): string {
		return normalizeMathMlPrefixes(
			unwrapCdataSections(this.serializeChildNodes(element)),
			this.mathMlPrefixes
		);
	}

	findExtractionElements(elementTypes: Iterable<string>): DiscoveredInteractionElement[] {
		const root = this.createExtractionRoot();
		if (!root) return [];

		const canonicalTypes = new Set(
			[...elementTypes].map((elementType) => this.elementNameMapper.toCanonical(elementType))
		);
		const elements: DiscoveredInteractionElement[] = [];

		this.walkExtractionChildren(root, (element) => {
			const rawTagName = element.rawTagName;
			if (!rawTagName) return;
			if (!canonicalTypes.has(this.elementNameMapper.toCanonical(rawTagName))) return;

			const responseIdentifier = this.getExtractionResponseIdentifier(element);
			if (!responseIdentifier) return;

			elements.push({
				element,
				contextRoot: root,
				responseIdentifier,
				normalizedType: normalizeInteractionTypeFromTagName(rawTagName),
			});
		});

		return elements;
	}

	private createExtractionRoot(): QTIElement | null {
		// node-html-parser elements are intentionally mutable for plugin compatibility.
		// Parse one private view for each extraction pass so a plugin cannot mutate
		// the compiled document observed by a later item session.
		const docRoot = parse(this.extractionSource, {
			lowerCaseTagName: false,
			comment: false,
		}) as unknown as QTIElement;
		const itemBodyTag = this.elementNameMapper.toNative('itembody').toLowerCase();
		return (docRoot.querySelector?.(itemBodyTag) as QTIElement | null) ?? null;
	}

	private getItemBodyElement(): Element | null {
		return findFirstDescendant(
			this.assessmentItem,
			this.elementNameMapper.toNative('itembody')
		);
	}

	private serializeItemBodyForExtraction(): string {
		const itemBodyTag = this.elementNameMapper.toNative('itembody');
		const itemBody = this.getItemBodyElement();
		const itemBodyChildren = itemBody ? this.serializeChildren(itemBody) : '';

		return `<assessmentItem><${itemBodyTag}>${itemBodyChildren}</${itemBodyTag}></assessmentItem>`;
	}

	private serializeChildNodes(element: Element): string {
		const children = (element as any).childNodes as NodeListOf<Node> | undefined;
		if (!children) return '';

		const serialized: string[] = [];
		for (let index = 0; index < children.length; index++) {
			const child = children[index];
			if (child) {
				serialized.push(serializeXml(child));
			}
		}

		return serialized.join('');
	}

	private walkExtractionChildren(root: QTIElement, visit: (element: QTIElement) => void): void {
		for (const child of root.childNodes ?? []) {
			const element = child as QTIElement;
			if (!element.rawTagName) continue;
			if (isRubricBlockTagName(element.rawTagName)) continue;
			visit(element);
			this.walkExtractionChildren(element, visit);
		}
	}

	private getExtractionResponseIdentifier(element: QTIElement): string {
		const nativeName = this.attributeNameMapper.toNative('responseIdentifier');
		return (
			element.getAttribute?.('responseIdentifier') ||
			element.getAttribute?.(nativeName) ||
			element.getAttribute?.('response-identifier') ||
			element.getAttribute?.('responseidentifier') ||
			''
		);
	}
}

function isRubricBlockTagName(tagName: string): boolean {
	const lower = tagName.toLowerCase();
	return lower === 'rubricblock' || lower === 'qti-rubric-block';
}

export function parseAssessmentItemDocument(input: AssessmentItemDocumentInput): AssessmentItemDocument {
	return new AssessmentItemDocument(input);
}

function unwrapCdataSections(xml: string): string {
	return xml.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_match, content: string) => content);
}

function findMathMlPrefixes(xml: string): Set<string> {
	const prefixes = new Set<string>();
	for (const match of xml.matchAll(
		/\sxmlns:([A-Za-z_][\w.-]*)=(["'])http:\/\/www\.w3\.org\/1998\/Math\/MathML\2/g
	)) {
		const prefix = match[1];
		if (prefix) {
			prefixes.add(prefix);
		}
	}
	return prefixes;
}

function normalizeMathMlPrefixes(xml: string, prefixes: Set<string>): string {
	let normalized = xml;
	for (const prefix of prefixes) {
		const escapedPrefix = escapeRegExp(prefix);
		normalized = normalized
			.replace(new RegExp(`(<\\/?)${escapedPrefix}:([A-Za-z][\\w.-]*)(?=[\\s>/])`, 'g'), '$1$2')
			.replace(
				new RegExp(
					`\\sxmlns:${escapedPrefix}=(["'])http:\\/\\/www\\.w3\\.org\\/1998\\/Math\\/MathML\\1`,
					'g'
				),
				''
			);
	}
	return normalized;
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
