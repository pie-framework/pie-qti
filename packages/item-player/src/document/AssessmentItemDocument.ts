import type { AttributeNameMapper, ElementNameMapper } from '@pie-qti/qti-common';
import {
	findAssessmentItem,
	findDescendants,
	findFirstDescendant,
	parseXml,
	serializeXml,
} from '@pie-qti/qti-processing';
import { parse } from 'node-html-parser';
import { enforceItemXmlLimits } from '../core/parsingLimits.js';
import { normalizeInteractionTypeFromTagName } from '../interactions/modules.js';
import type { PlayerSecurityConfig } from '../types/index.js';
import type { QTIElement } from '../types/interactions.js';

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

export class AssessmentItemDocument {
	private readonly itemXml: string;
	private readonly security?: PlayerSecurityConfig;
	private readonly mathMlPrefixes: Set<string>;
	readonly elementNameMapper: ElementNameMapper;
	readonly attributeNameMapper: AttributeNameMapper;
	private readonly xmlDocument: Document;
	private readonly assessmentItem: Element;
	private extractionDocument: QTIElement | null = null;
	private extractionRoot: QTIElement | null = null;

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
	}

	getAssessmentItem(): Element {
		return this.assessmentItem;
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

	findRubricElements(): Element[] {
		return findDescendants(this.assessmentItem, this.elementNameMapper.toNative('rubricblock'));
	}

	findModalFeedbackElements(): Element[] {
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

	serializeChildren(element: Element): string {
		return normalizeMathMlPrefixes(
			unwrapCdataSections(this.serializeChildNodes(element)),
			this.mathMlPrefixes
		);
	}

	findExtractionElements(elementTypes: Iterable<string>): DiscoveredInteractionElement[] {
		const root = this.getExtractionRoot();
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

	private getExtractionRoot(): QTIElement | null {
		if (this.extractionRoot) return this.extractionRoot;

		const docRoot = this.getExtractionDocument();
		const itemBodyTag = this.elementNameMapper.toNative('itembody').toLowerCase();
		this.extractionRoot = (docRoot.querySelector?.(itemBodyTag) as QTIElement | null) ?? null;
		return this.extractionRoot;
	}

	private getExtractionDocument(): QTIElement {
		if (!this.extractionDocument) {
			enforceItemXmlLimits(this.itemXml, this.security);
			this.extractionDocument = parse(this.serializeItemBodyForExtraction(), {
				lowerCaseTagName: false,
				comment: false,
			}) as unknown as QTIElement;
		}
		return this.extractionDocument;
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
