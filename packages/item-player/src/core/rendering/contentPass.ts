/**
 * The item content pass: the handlers that resolve printed variables, template-shown
 * choices, param variables and MathML template variables against the session's current
 * values while item body, rubric and feedback content serializes.
 */
import {
	type DeclarationContext,
	getAttr,
	isElement,
	localName,
	type QtiValue,
} from '@pie-qti/qti-processing';
import { type ElementNameMapper, isShownByIdentifier } from '@pie-qti/qti-common';
import { type ContentHandler, type ContentHandlers } from '../../document/contentPass.js';
import { printVariable, readPrintedVariableOptions } from '../../document/printedVariable.js';
import type { AssessmentItemDocument } from '../../document/AssessmentItemDocument.js';

/** Choices a template variable can show or hide, by canonical name. */
export const TEMPLATE_CHOICES = [
	'simplechoice',
	'simpleassociablechoice',
	'gaptext',
	'gapimg',
	'gap',
	'hottext',
	'inlinechoice',
	'hotspotchoice',
	'associablehotspot',
] as const;

/** What the content pass reads from the session engine. */
export interface ContentPassHost {
	readonly itemDocument: AssessmentItemDocument;
	readonly mapper: ElementNameMapper;
	readonly ctx: DeclarationContext;
	/** Template variables declared with `mathVariable`, substituted into MathML. */
	mathVariableIds: ReadonlySet<string> | null;
	/** Template variables declared with `paramVariable`, substituted into `<param>` values. */
	paramVariableIds: ReadonlySet<string> | null;
}

/**
 * The item content pass's handlers, reading the session's current variable values. QTI 3 wraps
 * rubric content in `qti-content-body`, which is unwrapped so a rubric renders as in QTI 2.2.
 * Feedback resolves here for rubric and modal feedback content; item body and choice feedback
 * resolve in presentation, which takes the outcome values to present as input.
 */
export function contentHandlers(host: ContentPassHost, { feedback = true }: { feedback?: boolean } = {}): ContentHandlers {
	const conditional = (variable: string) => (element: Element) =>
		isShownByVariable(host, element, variable, getAttr(element, 'identifier')) ? Array.from(element.childNodes) : [];
	const handlers = new Map<string, ContentHandler>([
		['printedvariable', (element) => printedVariableNodes(host, element)],
		['contentbody', (element) => Array.from(element.childNodes)],
		['templateinline', conditional('templateIdentifier')],
		['templateblock', conditional('templateIdentifier')],
		['param', (element) => expandParamVariable(host, element)],
	]);
	for (const choice of TEMPLATE_CHOICES) {
		handlers.set(choice, (element) =>
			!getAttr(element, 'templateIdentifier') ||
			isShownByVariable(host, element, 'templateIdentifier', getAttr(element, 'identifier'))
				? undefined
				: [],
		);
	}
	if (mathVariables(host).size > 0) {
		handlers.set('mi', (element) => mathVariableNodes(host, element, 'mn'));
		handlers.set('ci', (element) => mathVariableNodes(host, element, 'cn'));
	}
	if (feedback) {
		handlers.set('feedbackinline', conditional('outcomeIdentifier'));
		handlers.set('feedbackblock', conditional('outcomeIdentifier'));
	}
	return handlers;
}

/**
 * Whether `element` shows: the variable named by its `variableAttribute` against `identifier`,
 * by the shared visibility rule. A missing variable or identifier hides it.
 */
function isShownByVariable(host: ContentPassHost, element: Element, variableAttribute: string, identifier: string | null): boolean {
	const variable = (getAttr(element, variableAttribute) || '').trim();
	const id = (identifier || '').trim();
	if (!variable || !id) return false;
	const current = host.ctx.getValue(variable);
	return isShownByIdentifier(current.kind === 'value' ? current.value : null, id, getAttr(element, 'showHide'));
}

export function mathVariables(host: ContentPassHost): ReadonlySet<string> {
	host.mathVariableIds ??= new Set(
		host.itemDocument
			.findDeclarationElements('template')
			.filter((el) => getAttr(el, 'mathVariable')?.trim() === 'true')
			.map((el) => (getAttr(el, 'identifier') || '').trim()),
	);
	return host.mathVariableIds;
}

function paramVariables(host: ContentPassHost): ReadonlySet<string> {
	host.paramVariableIds ??= new Set(
		host.itemDocument
			.findDeclarationElements('template')
			.filter((el) => getAttr(el, 'paramVariable')?.trim() === 'true')
			.map((el) => (getAttr(el, 'identifier') || '').trim()),
	);
	return host.paramVariableIds;
}

/**
 * templateDeclaration@paramVariable (QTI 2.2 ASI TemplateDeclaration, `paramVariable`
 * characteristic; QTI 3.0 `param-variable`): a `<param>` inside an `<object>` whose `value`
 * names such a template variable is delivered with the variable's current value in place of
 * the variable's name, so a plugin-style object receives its computed parameter instead of a
 * literal.
 *
 * This resolves in the content pass — not in `prepareContentMarkup` (which runs once on the
 * raw XML, before template variables exist) and not on a stored copy — because template
 * variables change during the session (`setTemplateVariables`, `newTemplate`, restore).
 * Resolving with the pass means every (re)render, like printedVariable, delivers the value
 * the session holds at that moment.
 *
 * The spec defines substitution for a param value naming a declared `paramVariable`
 * variable. It is silent on a value naming an undeclared variable or one without the flag:
 * those, and NULL or container (multiple/ordered/record) values — a param carries one
 * opaque string, and joining container values would be invented semantics — deliver the
 * authored value unchanged, which is also the safe reading.
 */
function expandParamVariable(host: ContentPassHost, element: Element): undefined {
	const value = getAttr(element, 'value')?.trim();
	if (!value || !paramVariables(host).has(value)) return undefined;
	const parent = element.parentNode;
	if (
		!isElement(parent) ||
		host.mapper.toCanonical(localName(parent) ?? '') !== 'object'
	) {
		return undefined;
	}
	const current = host.ctx.getValue(value);
	if (current.kind !== 'value' || current.cardinality !== 'single') return undefined;
	// The pass resolves a clone, so this rewrite cannot touch the parsed source.
	element.setAttribute('value', String(current.value));
	return undefined;
}

/**
 * A MathML `mi` or `ci` naming a math variable, with the variable's single value in its place:
 * a number as `mn` or `cn` (`numberName`), any other value as the element's text. NULL and
 * container values leave the element as authored.
 */
function mathVariableNodes(host: ContentPassHost, element: Element, numberName: string): Node[] | undefined {
	const identifier = (element.textContent || '').trim();
	const document = element.ownerDocument;
	if (!document || !mathVariables(host).has(identifier)) return undefined;
	const value = host.ctx.getValue(identifier);
	if (value.kind !== 'value' || value.cardinality !== 'single') return undefined;
	const text = String(value.value);
	if (value.baseType !== 'integer' && value.baseType !== 'float') {
		// The pass resolves a copy, and the element is not walked again, so this cannot cycle.
		element.textContent = text;
		return undefined;
	}
	const name = element.prefix ? `${element.prefix}:${numberName}` : numberName;
	const replacement = document.createElementNS(element.namespaceURI, name);
	replacement.appendChild(document.createTextNode(text));
	return [replacement];
}

function printedVariableNodes(host: ContentPassHost, element: Element): Node[] {
	const identifier = (getAttr(element, 'identifier') || '').trim();
	const document = element.ownerDocument;
	if (!identifier || !document) return [];
	const variable = (id: string): QtiValue => host.ctx.getValue(id);
	const printed = printVariable(variable(identifier), readPrintedVariableOptions(element, variable));
	return printed.map((segment) => {
		if (typeof segment === 'string') return document.createTextNode(segment);
		const sup = document.createElementNS(element.namespaceURI, 'sup');
		sup.appendChild(document.createTextNode(segment.superscript));
		return sup;
	});
}
