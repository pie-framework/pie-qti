import {
	childElements,
	firstChildElement,
	getAttr,
	localName,
} from '../xml/traverse.js';
import { newAstId } from './id.js';
import type {
	ExpressionNode,
	OutcomeConditionStmt,
	ProcessingProgram,
	ResponseConditionStmt,
	StatementNode,
	TemplateConditionStmt,
} from './types.js';

export function buildTemplateProcessingAst(templateProcessingEl: Element): ProcessingProgram {
	const scope: ProcessingScope = 'item';
	return {
		kind: 'program',
		id: newAstId('program'),
		statements: buildStatements(childElements(templateProcessingEl), 'template', { scope }),
	};
}

export function buildResponseProcessingAst(responseProcessingEl: Element): ProcessingProgram {
	const scope: ProcessingScope = 'item';
	return {
		kind: 'program',
		id: newAstId('program'),
		statements: buildStatements(childElements(responseProcessingEl), 'response', { scope }),
	};
}

export type ProcessingScope = 'item' | 'test';

export function buildOutcomeProcessingAst(
	outcomeProcessingEl: Element,
	options?: { scope?: ProcessingScope }
): ProcessingProgram {
	const scope: ProcessingScope = options?.scope ?? 'item';
	return {
		kind: 'program',
		id: newAstId('program'),
		statements: buildStatements(childElements(outcomeProcessingEl), 'outcome', { scope }),
	};
}

type StatementMode = 'template' | 'response' | 'outcome';

function buildStatements(els: Element[], mode: StatementMode, options: { scope: ProcessingScope }): StatementNode[] {
	const out: StatementNode[] = [];
	for (const el of els) {
		const tag = (localName(el) || '').toLowerCase();
		switch (tag) {
			case 'responseprocessingfragment': {
				// Inline fragments are equivalent to a grouped list of response rules.
				// Spec: ResponseProcessingFragment.Type (QTI 2.2.2) allows the same rule set as responseProcessing.
				if (mode !== 'response') break;
				out.push(...buildStatements(childElements(el), mode, options));
				break;
			}
				case 'outcomeprocessingfragment': {
					// Inline fragments are equivalent to a grouped list of outcome rules.
					// Spec: OutcomeProcessingFragment.Type (QTI 2.2.2) allows the same rule set as outcomeProcessing.
					if (mode !== 'outcome') break;
					out.push(...buildStatements(childElements(el), mode, options));
					break;
				}
			case 'include': {
				// xi:include (XInclude) - we currently don't resolve external resources for item-only processing.
				// Fail fast with a helpful error rather than silently ignoring processing rules.
				throw new Error(
					'xi:include is not supported in processing (responseProcessing/templateProcessing/outcomeProcessing). Inline the rules instead.',
				);
			}
			case 'setoutcomevalue': {
				const identifier = getAttr(el, 'identifier');
				const exprEl = firstChildElement(el);
				if (!identifier || !exprEl) break;
				out.push({
					kind: 'stmt.setOutcomeValue',
					id: newAstId('stmt'),
					identifier,
					expr: buildExpression(exprEl, options),
				});
				break;
			}
			case 'lookupoutcomevalue': {
				if (mode !== 'outcome' && mode !== 'response') break;
				const identifier = getAttr(el, 'identifier');
				const exprEl = firstChildElement(el);
				if (!identifier || !exprEl) break;
				out.push({
					kind: 'stmt.lookupOutcomeValue',
					id: newAstId('stmt'),
					identifier,
					expr: buildExpression(exprEl, options),
				});
				break;
			}
			case 'setresponsevalue': {
				if (mode !== 'response') break;
				const identifier = getAttr(el, 'identifier');
				const exprEl = firstChildElement(el);
				if (!identifier || !exprEl) break;
				out.push({
					kind: 'stmt.setResponseValue',
					id: newAstId('stmt'),
					identifier,
					expr: buildExpression(exprEl, options),
				});
				break;
			}
			case 'settemplatevalue': {
				const identifier = getAttr(el, 'identifier');
				const exprEl = firstChildElement(el);
				if (!identifier || !exprEl) break;
				out.push({
					kind: 'stmt.setTemplateValue',
					id: newAstId('stmt'),
					identifier,
					expr: buildExpression(exprEl, options),
				});
				break;
			}
			case 'setcorrectresponse': {
				if (mode !== 'template') break;
				const identifier = getAttr(el, 'identifier');
				const exprEl = firstChildElement(el);
				if (!identifier || !exprEl) break;
				out.push({
					kind: 'stmt.setCorrectResponse',
					id: newAstId('stmt'),
					identifier,
					expr: buildExpression(exprEl, options),
				});
				break;
			}
			case 'setdefaultvalue': {
				// Commonly used in responseProcessing to reset a response to its declared <defaultValue>
				const identifier = getAttr(el, 'identifier');
				if (!identifier) break;
				out.push({
					kind: 'stmt.setDefaultValue',
					id: newAstId('stmt'),
					identifier,
				});
				break;
			}
			case 'exitresponse': {
				if (mode !== 'response') break;
				out.push({
					kind: 'stmt.exitResponse',
					id: newAstId('stmt'),
				});
				break;
			}
			case 'exittemplate': {
				if (mode !== 'template') break;
				out.push({
					kind: 'stmt.exitTemplate',
					id: newAstId('stmt'),
				});
				break;
			}
			case 'exittest': {
				// exitTest exists in outcomeProcessing (QTI 2.2.2). This is a test-level control-flow construct.
				// In the item-only player we still parse it so fixtures can track its presence.
				if (mode !== 'outcome') break;
				out.push({
					kind: 'stmt.exitTest',
					id: newAstId('stmt'),
				});
				break;
			}
			case 'responsecondition': {
				if (mode !== 'response') break;
				out.push(buildResponseCondition(el, options));
				break;
			}
			case 'outcomecondition': {
				if (mode !== 'outcome') break;
				out.push(buildOutcomeCondition(el, options));
				break;
			}
			case 'templatecondition': {
				if (mode !== 'template') break;
				out.push(buildTemplateCondition(el, options));
				break;
			}
			case 'templateconstraint': {
				if (mode !== 'template') break;
				const exprEl = firstChildElement(el);
				if (!exprEl) {
					throw new Error('<templateConstraint> requires exactly 1 child expression');
				}
				out.push({
					kind: 'stmt.templateConstraint',
					id: newAstId('stmt'),
					expr: buildExpression(exprEl, options),
				});
				break;
			}
			default:
				// Unknown statement tags in processing are almost always a correctness bug.
				// Fail loudly so we surface missing QTI coverage via fixtures/tests.
				throw new Error(`Unknown processing statement tag: <${tag}> (mode=${mode})`);
		}
	}
	return out;
}

function buildResponseCondition(el: Element, options: { scope: ProcessingScope }): ResponseConditionStmt {
	const children = childElements(el);
	const id = newAstId('stmt');

	const ifEl = children.find((c) => (localName(c) || '').toLowerCase() === 'responseif') || null;
	const elseIfEls = children.filter((c) => (localName(c) || '').toLowerCase() === 'responseelseif');
	const elseEl = children.find((c) => (localName(c) || '').toLowerCase() === 'responseelse') || null;

	const ifBranch = ifEl ? buildConditionalBranch(ifEl, 'response', options) : undefined;
	const elseIfBranches = elseIfEls.map((e) => buildConditionalBranch(e, 'response', options)).filter(Boolean) as any;
	const elseBranch = elseEl ? buildElseBranch(elseEl, 'response', options) : undefined;

	return {
		kind: 'stmt.responseCondition',
		id,
		ifBranch,
		elseIfBranches,
		elseBranch,
	};
}

function buildTemplateCondition(el: Element, options: { scope: ProcessingScope }): TemplateConditionStmt {
	const children = childElements(el);
	const id = newAstId('stmt');

	const ifEl = children.find((c) => (localName(c) || '').toLowerCase() === 'templateif') || null;
	const elseIfEls = children.filter((c) => (localName(c) || '').toLowerCase() === 'templateelseif');
	const elseEl = children.find((c) => (localName(c) || '').toLowerCase() === 'templateelse') || null;

	const ifBranch = ifEl ? buildConditionalBranch(ifEl, 'template', options) : undefined;
	const elseIfBranches = elseIfEls.map((e) => buildConditionalBranch(e, 'template', options)).filter(Boolean) as any;
	const elseBranch = elseEl ? buildElseBranch(elseEl, 'template', options) : undefined;

	return {
		kind: 'stmt.templateCondition',
		id,
		ifBranch,
		elseIfBranches,
		elseBranch,
	};
}

function buildOutcomeCondition(el: Element, options: { scope: ProcessingScope }): OutcomeConditionStmt {
	const children = childElements(el);
	const id = newAstId('stmt');

	const ifEl = children.find((c) => (localName(c) || '').toLowerCase() === 'outcomeif') || null;
	const elseIfEls = children.filter((c) => (localName(c) || '').toLowerCase() === 'outcomeelseif');
	const elseEl = children.find((c) => (localName(c) || '').toLowerCase() === 'outcomeelse') || null;

	const ifBranch = ifEl ? buildConditionalBranch(ifEl, 'outcome', options) : undefined;
	const elseIfBranches = elseIfEls.map((e) => buildConditionalBranch(e, 'outcome', options)).filter(Boolean) as any;
	const elseBranch = elseEl ? buildElseBranch(elseEl, 'outcome', options) : undefined;

	return {
		kind: 'stmt.outcomeCondition',
		id,
		ifBranch,
		elseIfBranches,
		elseBranch,
	};
}

function buildConditionalBranch(el: Element, mode: StatementMode, options: { scope: ProcessingScope }) {
	const condEl = firstChildElement(el);
	if (!condEl) return undefined;
	const cond = buildExpression(condEl, options);

	// Remaining child elements after condition are statements
	const els = childElements(el).slice(1);
	const statements = buildStatements(els, mode, options);

	return { condition: cond, statements };
}

function buildElseBranch(el: Element, mode: StatementMode, options: { scope: ProcessingScope }) {
	const statements = buildStatements(childElements(el), mode, options);
	return { statements };
}

export function buildExpression(el: Element, options?: { scope?: ProcessingScope }): ExpressionNode {
	const scope: ProcessingScope = options?.scope ?? 'item';
	const tag = (localName(el) || '').toLowerCase();
	const id = newAstId('expr');
	const kids = childElements(el);

	const boolAttr = (name: string, defaultValue: boolean): boolean => {
		const raw = (getAttr(el, name) || '').trim().toLowerCase();
		if (!raw) return defaultValue;
		if (raw === 'true' || raw === '1') return true;
		if (raw === 'false' || raw === '0') return false;
		return defaultValue;
	};

	const numAttr = (name: string, defaultValue: number): number => {
		const raw = (getAttr(el, name) || '').trim();
		if (!raw) return defaultValue;
		const n = Number(raw);
		return Number.isFinite(n) ? n : defaultValue;
	};

	const strAttr = (name: string): string | undefined => {
		const raw = (getAttr(el, name) || '').trim();
		return raw ? raw : undefined;
	};

	// QTI XSD uses "VariableString.Type" in many operator attributes (e.g. randomInteger@min/max/step).
	// For now we interpret:
	// - numeric literal => <baseValue>
	// - otherwise => <variable identifier="...">
	const attrAsExpr = (name: string, baseType: string): ExpressionNode | undefined => {
		const raw = (getAttr(el, name) || '').trim();
		if (!raw) return undefined;
		const n = Number(raw);
		if (Number.isFinite(n)) {
			return { kind: 'expr.baseValue', id: newAstId('expr'), baseType, text: raw };
		}
		return { kind: 'expr.variable', id: newAstId('expr'), identifier: raw };
	};

	const listAttr = (name: string): string[] | undefined => {
		const raw = (getAttr(el, name) || '').trim();
		if (!raw) return undefined;
		return raw.split(/\s+/).filter(Boolean);
	};

	switch (tag) {
		case 'testvariables':
		case 'outcomeminimum':
		case 'outcomemaximum': {
			if (scope !== 'test') {
				throw new Error(
					`${localName(el)} is a test-level outcomeProcessing expression and is not supported by the item-only player`,
				);
			}
			if (tag === 'testvariables') {
				const variableIdentifier = getAttr(el, 'variableIdentifier') || '';
				if (!variableIdentifier) throw new Error('<testVariables> requires variableIdentifier');
				return {
					kind: 'expr.testVariables',
					id,
					variableIdentifier,
					baseType: (getAttr(el, 'baseType') || '').trim() || undefined,
					sectionIdentifier: (getAttr(el, 'sectionIdentifier') || '').trim() || undefined,
					includeCategory: listAttr('includeCategory'),
					excludeCategory: listAttr('excludeCategory'),
					weightIdentifier: (getAttr(el, 'weightIdentifier') || '').trim() || undefined,
				} as any;
			}
			const outcomeIdentifier = getAttr(el, 'outcomeIdentifier') || '';
			if (!outcomeIdentifier) throw new Error(`<${tag}> requires outcomeIdentifier`);
			return {
				kind: tag === 'outcomeminimum' ? 'expr.outcomeMinimum' : 'expr.outcomeMaximum',
				id,
				outcomeIdentifier,
				sectionIdentifier: (getAttr(el, 'sectionIdentifier') || '').trim() || undefined,
				includeCategory: listAttr('includeCategory'),
				excludeCategory: listAttr('excludeCategory'),
				weightIdentifier: (getAttr(el, 'weightIdentifier') || '').trim() || undefined,
			} as any;
		}

		case 'basevalue': {
			return {
				kind: 'expr.baseValue',
				id,
				baseType: getAttr(el, 'baseType') || 'string',
				text: (el.textContent || '').trim(),
			};
		}
		case 'null': {
			return { kind: 'expr.null', id };
		}
		case 'variable': {
			const identifier = getAttr(el, 'identifier') || '';
			return { kind: 'expr.variable', id, identifier };
		}
		case 'correct': {
			const identifier = getAttr(el, 'identifier') || '';
			return { kind: 'expr.correct', id, identifier };
		}
		case 'default': {
			const identifier = getAttr(el, 'identifier') || '';
			return { kind: 'expr.default', id, identifier };
		}
		case 'numbercorrect':
		case 'numberincorrect':
		case 'numberpresented':
		case 'numberresponded':
		case 'numberselected': {
			if (scope !== 'test') {
				// QTI 2.2.2: these are Outcome Processing expressions providing summative information and
				// include test-section/category filtering attributes. They are not meaningful for item-only processing.
				throw new Error(
					`<${tag}> is a test-level outcome processing expression and is not supported in the item-only player.`,
				);
			}
			const kind =
				tag === 'numbercorrect' ? 'expr.numberCorrect' :
				tag === 'numberincorrect' ? 'expr.numberIncorrect' :
				tag === 'numberpresented' ? 'expr.numberPresented' :
				tag === 'numberresponded' ? 'expr.numberResponded' :
				'expr.numberSelected';
			return {
				kind,
				id,
				sectionIdentifier: (getAttr(el, 'sectionIdentifier') || '').trim() || undefined,
				includeCategory: listAttr('includeCategory'),
				excludeCategory: listAttr('excludeCategory'),
			} as any;
		}
		case 'customoperator': {
			const klass = (getAttr(el, 'class') || '').trim();
			const definition = (getAttr(el, 'definition') || '').trim();
			return {
				kind: 'expr.customOperator',
				id,
				class: klass || undefined,
				definition: definition || undefined,
				values: kids.map((k) => buildExpression(k, options)),
			};
		}
		case 'precondition': {
			const exprEl = kids[0];
			if (!exprEl) throw new Error('<preCondition> missing expression');
			return { kind: 'expr.preCondition', id, expr: buildExpression(exprEl, options) };
		}
		case 'match': {
			return { kind: 'expr.match', id, a: buildExpression(kids[0]!, options), b: buildExpression(kids[1]!, options) };
		}
		case 'equal': {
			const toleranceModeRaw = (getAttr(el, 'toleranceMode') || '').trim().toLowerCase();
			const toleranceMode =
				toleranceModeRaw === 'absolute' || toleranceModeRaw === 'relative' || toleranceModeRaw === 'exact'
					? (toleranceModeRaw as 'exact' | 'absolute' | 'relative')
					: undefined;

			const toleranceRaw = strAttr('tolerance');
			const tolerance = toleranceRaw ? toleranceRaw.split(/\s+/).filter(Boolean) : undefined;

			return {
				kind: 'expr.equal',
				id,
				a: buildExpression(kids[0]!, options),
				b: buildExpression(kids[1]!, options),
				toleranceMode,
				tolerance,
				includeLowerBound: toleranceMode ? boolAttr('includeLowerBound', true) : undefined,
				includeUpperBound: toleranceMode ? boolAttr('includeUpperBound', true) : undefined,
			};
		}
		case 'equalrounded': {
			// QTI 2.2.2: roundingMode is optional (default="significantFigures").
			// For compatibility with QTI 2.1 and real-world content, accept singular forms and normalize.
			const roundingModeRaw = (getAttr(el, 'roundingMode') || 'significantFigures').trim();
			const figures = getAttr(el, 'figures') || '';
			if (!figures) throw new Error('<equalRounded> requires figures');
			const rm = roundingModeRaw.toLowerCase();
			const roundingMode =
				rm === 'decimalplace' || rm === 'decimalplaces'
					? 'decimalPlaces'
					: rm === 'significantfigure' || rm === 'significantfigures'
						? 'significantFigures'
						: null;
			if (!roundingMode) {
				throw new Error(
					'<equalRounded> roundingMode must be "decimalPlaces"|"significantFigures" (or legacy singular forms)',
				);
			}
			return {
				kind: 'expr.equalRounded',
				id,
				a: buildExpression(kids[0]!, options),
				b: buildExpression(kids[1]!, options),
				roundingMode,
				figures,
			};
		}
		case 'notequal': {
			return { kind: 'expr.notEqual', id, a: buildExpression(kids[0]!, options), b: buildExpression(kids[1]!, options) };
		}
		case 'member': {
			return {
				kind: 'expr.member',
				id,
				value: buildExpression(kids[0]!, options),
				container: buildExpression(kids[1]!, options),
			};
		}
		case 'contains': {
			return {
				kind: 'expr.contains',
				id,
				container: buildExpression(kids[0]!, options),
				value: buildExpression(kids[1]!, options),
			};
		}
		case 'containersize': {
			return { kind: 'expr.containerSize', id, container: buildExpression(kids[0]!, options) };
		}
		case 'index': {
			return {
				kind: 'expr.index',
				id,
				container: buildExpression(kids[0]!, options),
				index: buildExpression(kids[1]!, options),
			};
		}
		case 'ordered': {
			return { kind: 'expr.ordered', id, values: kids.map((k) => buildExpression(k, options)) };
		}
		case 'multiple': {
			return { kind: 'expr.multiple', id, values: kids.map((k) => buildExpression(k, options)) };
		}
		case 'delete': {
			return {
				kind: 'expr.delete',
				id,
				container: buildExpression(kids[0]!, options),
				value: buildExpression(kids[1]!, options),
			};
		}
		case 'repeat': {
			const raw = (getAttr(el, 'numberRepeats') || '').trim();
			if (!raw) throw new Error('<repeat> requires numberRepeats attribute');

			const asNum = Number(raw);
			const numberRepeats = Number.isFinite(asNum) && /^-?\d+$/.test(raw) ? asNum : raw;

			if (kids.length < 1) throw new Error('<repeat> requires at least one child expression');
			return {
				kind: 'expr.repeat',
				id,
				numberRepeats,
				values: kids.map((k) => buildExpression(k, options)),
			};
		}
		case 'durationlt': {
			if (kids.length !== 2) throw new Error('<durationLT> requires exactly two child expressions');
			return { kind: 'expr.durationLT', id, a: buildExpression(kids[0]!), b: buildExpression(kids[1]!) };
		}
		case 'durationgte': {
			if (kids.length !== 2) throw new Error('<durationGTE> requires exactly two child expressions');
			return { kind: 'expr.durationGTE', id, a: buildExpression(kids[0]!), b: buildExpression(kids[1]!) };
		}
		case 'inside': {
			const shape = (getAttr(el, 'shape') || '').trim() as any;
			const coords = (getAttr(el, 'coords') || '').trim();
			if (!shape) throw new Error('<inside> requires shape attribute');
			if (!coords) throw new Error('<inside> requires coords attribute');
			if (kids.length !== 1) throw new Error('<inside> requires exactly one child expression');
			return { kind: 'expr.inside', id, shape, coords, value: buildExpression(kids[0]!) };
		}
		case 'statsoperator': {
			const name = (getAttr(el, 'name') || '').trim() as any;
			if (!name) throw new Error('<statsOperator> requires name attribute');
			if (kids.length !== 1) throw new Error('<statsOperator> requires exactly one child expression');
			return { kind: 'expr.statsOperator', id, name, values: buildExpression(kids[0]!) };
		}
		case 'record': {
			// QTI record: children are <fieldValue fieldIdentifier="...">VALUE</fieldValue>
			const fields = childElements(el)
				.filter((c) => (localName(c) || '').toLowerCase() === 'fieldvalue')
				.map((c) => ({
					fieldIdentifier: getAttr(c, 'fieldIdentifier') || '',
					value: buildExpression(childElements(c)[0] ?? c),
				}))
				.filter((f) => Boolean(f.fieldIdentifier));
			return { kind: 'expr.record', id, fields };
		}
		case 'fieldvalue': {
			const fieldIdentifier = getAttr(el, 'fieldIdentifier') || '';
			return { kind: 'expr.fieldValue', id, fieldIdentifier, record: buildExpression(kids[0]!) };
		}
		case 'substring': {
			return {
				kind: 'expr.substring',
				id,
				value: buildExpression(kids[0]!),
				start: buildExpression(kids[1]!),
				length: kids[2] ? buildExpression(kids[2]) : undefined,
			};
		}
		case 'lookuptable': {
			const source = buildExpression(kids[0]!);
			const tableEl = kids[1];
			if (!tableEl) {
				throw new Error('<lookupTable> is missing its table element child');
			}
			const tableTag = (localName(tableEl) || '').toLowerCase();
			const tableKids = childElements(tableEl);

			const numAttrOn = (node: Element, name: string): number | undefined => {
				const raw = (getAttr(node, name) || '').trim();
				if (!raw) return undefined;
				const n = Number(raw);
				return Number.isFinite(n) ? n : undefined;
			};

			if (tableTag === 'matchtable') {
				const entries = tableKids
					.filter((e) => (localName(e) || '').toLowerCase() === 'matchtableentry')
					.map((e) => ({
						sourceValue: getAttr(e, 'sourceValue') || '',
						targetValue: getAttr(e, 'targetValue') || '',
					}));

				return {
					kind: 'expr.lookupTable',
					id,
					source,
					table: {
						kind: 'table.matchTable',
						defaultValue: numAttrOn(tableEl, 'defaultValue'),
						entries,
					},
				};
			}

			if (tableTag === 'interpolationtable') {
				const entries = tableKids
					.filter((e) => (localName(e) || '').toLowerCase() === 'interpolationtableentry')
					.map((e) => ({
						sourceValue: Number(getAttr(e, 'sourceValue') || ''),
						targetValue: Number(getAttr(e, 'targetValue') || ''),
					}))
					.filter((e) => Number.isFinite(e.sourceValue) && Number.isFinite(e.targetValue));

				return {
					kind: 'expr.lookupTable',
					id,
					source,
					table: {
						kind: 'table.interpolationTable',
						defaultValue: numAttrOn(tableEl, 'defaultValue'),
						interpolationMethod: (getAttr(tableEl, 'interpolationMethod') || 'linear').trim(),
						entries,
					},
				};
			}

			throw new Error(`<lookupTable> unsupported table element: <${tableTag}>`);
		}
		case 'power': {
			return { kind: 'expr.power', id, a: buildExpression(kids[0]!), b: buildExpression(kids[1]!) };
		}
		case 'mod': {
			return { kind: 'expr.mod', id, a: buildExpression(kids[0]!), b: buildExpression(kids[1]!) };
		}
		case 'integerdivide': {
			return { kind: 'expr.integerDivide', id, a: buildExpression(kids[0]!), b: buildExpression(kids[1]!) };
		}
		case 'mean': {
			return { kind: 'expr.mean', id, values: buildExpression(kids[0]!) };
		}
		case 'samplevariance': {
			return { kind: 'expr.sampleVariance', id, values: buildExpression(kids[0]!) };
		}
		case 'samplesd': {
			return { kind: 'expr.sampleSD', id, values: buildExpression(kids[0]!) };
		}
		case 'popvariance': {
			return { kind: 'expr.popVariance', id, values: buildExpression(kids[0]!) };
		}
		case 'popsd': {
			return { kind: 'expr.popSD', id, values: buildExpression(kids[0]!) };
		}
		case 'istypeof': {
			return {
				kind: 'expr.isTypeOf',
				id,
				value: buildExpression(kids[0]!),
				baseType: buildExpression(kids[1]!),
			};
		}
		case 'stringmatch': {
			return {
				kind: 'expr.stringMatch',
				id,
				a: buildExpression(kids[0]!),
				b: buildExpression(kids[1]!),
				caseSensitive: boolAttr('caseSensitive', false),
				substring: boolAttr('substring', false),
			};
		}
		case 'patternmatch': {
			return {
				kind: 'expr.patternMatch',
				id,
				value: buildExpression(kids[0]!),
				pattern: buildExpression(kids[1]!),
				caseSensitive: boolAttr('caseSensitive', true),
			};
		}
		case 'isnull': {
			return { kind: 'expr.isNull', id, expr: buildExpression(kids[0]!) };
		}
		case 'isnotnull': {
			return { kind: 'expr.isNotNull', id, expr: buildExpression(kids[0]!) };
		}
		case 'lt': {
			return { kind: 'expr.lt', id, a: buildExpression(kids[0]!), b: buildExpression(kids[1]!) };
		}
		case 'lte': {
			return { kind: 'expr.lte', id, a: buildExpression(kids[0]!), b: buildExpression(kids[1]!) };
		}
		case 'gt': {
			return { kind: 'expr.gt', id, a: buildExpression(kids[0]!), b: buildExpression(kids[1]!) };
		}
		case 'gte': {
			return { kind: 'expr.gte', id, a: buildExpression(kids[0]!), b: buildExpression(kids[1]!) };
		}
		case 'and': {
			return { kind: 'expr.and', id, ops: kids.map((k) => buildExpression(k, options)) };
		}
		case 'or': {
			return { kind: 'expr.or', id, ops: kids.map((k) => buildExpression(k, options)) };
		}
		case 'not': {
			return { kind: 'expr.not', id, expr: buildExpression(kids[0]!) };
		}
		case 'anyn': {
			// QTI anyN: true if min <= #true(children) <= max
			const min = numAttr('min', 1);
			const max = numAttr('max', kids.length);
			return { kind: 'expr.anyN', id, min, max, ops: kids.map((k) => buildExpression(k, options)) };
		}
		case 'alln': {
			// Historical/non-standard: true if #true(children) <= max
			const max = numAttr('max', kids.length);
			return { kind: 'expr.allN', id, max, ops: kids.map((k) => buildExpression(k, options)) };
		}
		case 'sum': {
			return { kind: 'expr.sum', id, values: kids.map((k) => buildExpression(k, options)) };
		}
		case 'subtract': {
			return { kind: 'expr.subtract', id, a: buildExpression(kids[0]!), b: buildExpression(kids[1]!) };
		}
		case 'product': {
			return { kind: 'expr.product', id, values: kids.map((k) => buildExpression(k, options)) };
		}
		case 'divide': {
			return { kind: 'expr.divide', id, a: buildExpression(kids[0]!), b: buildExpression(kids[1]!) };
		}
		case 'random': {
			if (kids.length !== 1) throw new Error('<random> requires exactly one child expression');
			return { kind: 'expr.random', id, value: buildExpression(kids[0]!) };
		}
		case 'max': {
			return { kind: 'expr.max', id, values: kids.map((k) => buildExpression(k, options)) };
		}
		case 'min': {
			return { kind: 'expr.min', id, values: kids.map((k) => buildExpression(k, options)) };
		}
		case 'round': {
			return { kind: 'expr.round', id, value: buildExpression(kids[0]!) };
		}
		case 'truncate': {
			return { kind: 'expr.truncate', id, value: buildExpression(kids[0]!) };
		}
		case 'mapresponse': {
			return { kind: 'expr.mapResponse', id, identifier: getAttr(el, 'identifier') || '' };
		}
		case 'mapoutcome': {
			return { kind: 'expr.mapOutcome', id, identifier: getAttr(el, 'identifier') || '' };
		}
		case 'mapresponsepoint': {
			return { kind: 'expr.mapResponsePoint', id, identifier: getAttr(el, 'identifier') || '' };
		}
		case 'randominteger': {
			// QTI 2.2.2: randomInteger is an empty element with min/max/step attributes.
			// For compatibility with older/variant content, also accept the legacy child-expression form.
			const minAttr = attrAsExpr('min', 'integer');
			const maxAttr = attrAsExpr('max', 'integer');
			const stepAttr = attrAsExpr('step', 'integer');
			if (minAttr && maxAttr) {
				return { kind: 'expr.randomInteger', id, min: minAttr, max: maxAttr, step: stepAttr };
			}
			if (!kids[0] || !kids[1]) throw new Error('<randomInteger> requires min/max attributes or 2 child expressions');
			return {
				kind: 'expr.randomInteger',
				id,
				min: buildExpression(kids[0]),
				max: buildExpression(kids[1]),
				step: kids[2] ? buildExpression(kids[2]) : undefined,
			};
		}
		case 'randomfloat': {
			// QTI 2.2.2: empty element with min/max attributes.
			// For compatibility with older/variant content, also accept the legacy child-expression form.
			const minAttr = attrAsExpr('min', 'float');
			const maxAttr = attrAsExpr('max', 'float');
			if (minAttr && maxAttr) {
				return { kind: 'expr.randomFloat', id, min: minAttr, max: maxAttr };
			}
			if (!kids[0] || !kids[1]) throw new Error('<randomFloat> requires min/max attributes or 2 child expressions');
			return { kind: 'expr.randomFloat', id, min: buildExpression(kids[0]), max: buildExpression(kids[1]) };
		}
		case 'mathconstant': {
			const name = (getAttr(el, 'name') || '').trim().toLowerCase();
			if (name !== 'pi' && name !== 'e') {
				throw new Error(`<mathConstant> requires name="pi"|"e" (got ${JSON.stringify(name)})`);
			}
			return { kind: 'expr.mathConstant', id, name };
		}
		case 'mathoperator': {
			const name = (getAttr(el, 'name') || '').trim() as any;
			if (!name) throw new Error('<mathOperator> requires name attribute');
			if (kids.length < 1) throw new Error('<mathOperator> requires at least one child expression');
			return { kind: 'expr.mathOperator', id, name, values: kids.map((k) => buildExpression(k, options)) };
		}
		case 'integermodulus': {
			if (!kids[0] || !kids[1]) throw new Error('<integerModulus> requires 2 child expressions');
			return { kind: 'expr.integerModulus', id, a: buildExpression(kids[0]), b: buildExpression(kids[1]) };
		}
		case 'integertofloat': {
			if (!kids[0]) throw new Error('<integerToFloat> requires 1 child expression');
			return { kind: 'expr.integerToFloat', id, value: buildExpression(kids[0]) };
		}
		case 'gcd': {
			if (kids.length < 1) throw new Error('<gcd> requires at least one child expression');
			return { kind: 'expr.gcd', id, values: kids.map((k) => buildExpression(k, options)) };
		}
		case 'lcm': {
			if (kids.length < 1) throw new Error('<lcm> requires at least one child expression');
			return { kind: 'expr.lcm', id, values: kids.map((k) => buildExpression(k, options)) };
		}
		case 'roundto': {
			const roundingMode = (getAttr(el, 'roundingMode') || '').trim() as
				| 'decimalPlaces'
				| 'significantFigures';
			if (roundingMode !== 'decimalPlaces' && roundingMode !== 'significantFigures') {
				throw new Error('<roundTo> requires roundingMode="decimalPlaces"|"significantFigures"');
			}
			const figuresAttr = attrAsExpr('figures', 'integer');
			if (!figuresAttr) throw new Error('<roundTo> requires figures attribute');
			if (!kids[0]) throw new Error('<roundTo> requires a single child expression');
			return { kind: 'expr.roundTo', id, value: buildExpression(kids[0]), roundingMode, figures: figuresAttr };
		}
		default: {
			// Unknown expression tags in processing are almost always a correctness bug.
			// Fail loudly so we surface missing QTI coverage via fixtures/tests.
			throw new Error(`Unknown processing expression tag: <${tag}>`);
		}
	}
}


