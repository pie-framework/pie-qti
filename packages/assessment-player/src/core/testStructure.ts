/**
 * QTI test structure shared by backends and the client: the itemSessionControl cascade, the
 * session-start draw of selection and ordering, delivery order, the delivery-rules walk
 * (branch rules, preconditions, eligibility), and test-scope expressions.
 */

import {
	buildExpression,
	DeclarationContext,
	type DeclarationMap,
	durationSecondsFromMilliseconds,
	evalExpr,
	parseXml,
	type QtiValue,
	qtiNull,
	qtiValue,
} from '@pie-qti/qti-processing';
import type {
	SecureAssessment,
	SecureBranchRule,
	SecureItemRef,
	SecureItemSessionControl,
	SecureSection,
	SecureSectionComponent,
	SecureTestPart,
	TestOutcomeValue,
	TestOutcomeValues,
} from '../integration/api-contract.js';

export type ResolvedItemSessionControl = Required<SecureItemSessionControl>;

/** QTI itemSessionControl defaults, applied where no level of the cascade sets an attribute. */
export const DEFAULT_ITEM_SESSION_CONTROL: Readonly<ResolvedItemSessionControl> = Object.freeze({
	maxAttempts: 1,
	showFeedback: false,
	allowReview: true,
	showSolution: false,
	allowComment: false,
	allowSkipping: true,
	validateResponses: false,
});

const ITEM_SESSION_CONTROL_KEYS = Object.keys(DEFAULT_ITEM_SESSION_CONTROL) as Array<keyof ResolvedItemSessionControl>;

const ADAPTIVE_ITEM_ROOT = /<(?:[\w-]+:)?(?:qti-assessment-item|assessmentItem)\b[^>]*\badaptive\s*=\s*["']true["']/;

/** True when the item root declares `adaptive="true"`. */
export function isAdaptiveItemXml(itemXml: string): boolean {
	return ADAPTIVE_ITEM_ROOT.test(itemXml);
}

export interface EndAttemptInteractionInfo {
	/** The response declaration the interaction is bound to. */
	responseIdentifier: string;
	/** QTI `countAttempt` (QTI 3 `count-attempt`); true unless authored as false. */
	countAttempt: boolean;
}

/**
 * The item's endAttemptInteraction bindings, read from the item XML. Assessment delivery uses this
 * to recognize an end-attempt response on the session's normal response path: activation counts the
 * attempt unless authored with countAttempt="false" (a hint request).
 */
export function endAttemptInteractionInfo(itemXml: string): EndAttemptInteractionInfo[] {
	const out: EndAttemptInteractionInfo[] = [];
	let root: Element | null = null;
	try {
		root = parseXml(itemXml).documentElement;
	} catch {
		return out;
	}
	if (!root) return out;
	const visit = (element: Element): void => {
		const name = toCanonicalQtiName(element.localName ?? element.nodeName).toLowerCase();
		if (name === 'endattemptinteraction') {
			const responseIdentifier =
				element.getAttribute('responseIdentifier') ?? element.getAttribute('response-identifier');
			const raw = element.getAttribute('countAttempt') ?? element.getAttribute('count-attempt');
			if (responseIdentifier) {
				out.push({
					responseIdentifier,
					countAttempt: raw ? raw.trim().toLowerCase() !== 'false' : true,
				});
			}
		}
		for (let child = element.firstChild; child; child = child.nextSibling) {
			if (child.nodeType === 1) visit(child as Element);
		}
	};
	visit(root);
	return out;
}

/**
 * Effective itemSessionControl for an item: the test part, each enclosing section from outer to
 * inner, then the item ref, each set attribute overriding the level above. Adaptive items allow
 * unlimited attempts whatever maxAttempts says.
 */
export function resolveItemSessionControl(
	testPart: SecureTestPart,
	sections: readonly SecureSection[],
	item: SecureItemRef,
): ResolvedItemSessionControl {
	const out: ResolvedItemSessionControl = { ...DEFAULT_ITEM_SESSION_CONTROL };
	const levels = [testPart.itemSessionControl, ...sections.map((s) => s.itemSessionControl), item.itemSessionControl];
	for (const level of levels) {
		if (!level) continue;
		for (const key of ITEM_SESSION_CONTROL_KEYS) {
			const value = level[key];
			if (value === undefined || (typeof value === 'number' && !Number.isFinite(value))) continue;
			(out as Record<string, unknown>)[key] = value;
		}
	}
	if (isAdaptiveItemXml(item.itemXml)) out.maxAttempts = 0;
	return out;
}

/** Direct delivery components of a section, in document order. */
export function sectionComponents(section: SecureSection): SecureSectionComponent[] {
	return section.children
		? [...section.children]
		: [
			...(section.assessmentItemRefs ?? []).map((item) => ({ type: 'item' as const, item })),
			...(section.sections ?? []).map((child) => ({ type: 'section' as const, section: child })),
		];
}

export interface DeliveredItem {
	item: SecureItemRef;
	testPart: SecureTestPart;
	/** Enclosing sections, outermost first. */
	sections: SecureSection[];
}

/** Items in delivery order. Draws nothing: call it on an assessment the backend has drawn. */
export function deliveredItems(assessment: SecureAssessment): DeliveredItem[] {
	const out: DeliveredItem[] = [];
	const visit = (section: SecureSection, testPart: SecureTestPart, path: SecureSection[]): void => {
		const sections = [...path, section];
		for (const component of sectionComponents(section)) {
			if (component.type === 'item') out.push({ item: component.item, testPart, sections });
			else visit(component.section, testPart, sections);
		}
	};
	for (const testPart of assessment.testParts ?? []) {
		for (const section of testPart.sections ?? []) visit(section, testPart, []);
	}
	return out;
}

/**
 * Next item after `delivered[index]`. Branch rules come first: the item's, then each enclosing
 * section's it ends (inner to outer), then the test part's when it ends that too. Item and
 * section rules apply in linear navigation only. With no matching rule, navigation falls through
 * to the following item. Preconditions then skip forward from the target. EXIT_TEST means the
 * remaining items are all skipped; undefined means the current item was the last.
 */
export function nextItemIdentifier(
	assessment: SecureAssessment,
	delivered: DeliveredItem[],
	index: number,
	decls: DeclarationMap,
	rng: () => number,
): string | undefined {
	const start = branchTarget(assessment, delivered, index, decls, rng) ?? index + 1;
	const next = firstEligibleItem(assessment, delivered, start, delivered[index], decls, rng);
	return next ?? (index + 1 < delivered.length ? 'EXIT_TEST' : undefined);
}

function branchTarget(
	assessment: SecureAssessment,
	delivered: DeliveredItem[],
	index: number,
	decls: DeclarationMap,
	rng: () => number,
): number | undefined {
	const current = delivered[index]!;
	const following = delivered[index + 1];
	const linear = isLinear(assessment, current.testPart);
	const holders: Array<{ rules?: SecureBranchRule[]; exitSection?: SecureSection }> = [];
	if (linear) {
		holders.push({ rules: current.item.branchRule, exitSection: current.sections[current.sections.length - 1] });
		for (let level = current.sections.length - 1; level >= 0; level--) {
			const section = current.sections[level]!;
			if (following?.sections.includes(section)) break;
			holders.push({ rules: section.branchRule, exitSection: current.sections[level - 1] });
		}
	}
	if (following?.testPart !== current.testPart) holders.push({ rules: current.testPart.branchRule });

	for (const { rules, exitSection } of holders) {
		for (const rule of rules ?? []) {
			if (rule.conditionXml && !evaluateTestCondition(rule.conditionXml, decls, rng)) continue;
			const target = resolveBranchTarget(rule.target, delivered, index, exitSection);
			if (target !== undefined) return target;
		}
	}
	return undefined;
}

/** Index a branch target resolves to, forward of `index`; delivered.length ends the test. */
function resolveBranchTarget(
	target: string,
	delivered: DeliveredItem[],
	index: number,
	exitSection: SecureSection | undefined,
): number | undefined {
	const current = delivered[index]!;
	const firstAfter = (match: (d: DeliveredItem) => boolean): number | undefined => {
		for (let j = index + 1; j < delivered.length; j++) if (match(delivered[j]!)) return j;
		return undefined;
	};
	switch (target) {
		case 'EXIT_TEST':
			return delivered.length;
		case 'EXIT_TESTPART':
			return firstAfter((d) => d.testPart !== current.testPart) ?? delivered.length;
		case 'EXIT_SECTION':
			if (!exitSection) return undefined;
			return firstAfter((d) => !d.sections.includes(exitSection)) ?? delivered.length;
		default:
			return (
				firstAfter((d) => d.item.identifier === target) ??
				firstAfter((d) => d.sections.some((section) => section.identifier === target)) ??
				firstAfter((d) => d.testPart.identifier === target)
			);
	}
}

/**
 * First item from `start` whose preconditions hold. A test part's are checked on entering it in
 * any navigation mode; a newly entered section's (outermost first) and the item's only in linear
 * navigation. A failing part or section skips everything inside it.
 */
export function firstEligibleItem(
	assessment: SecureAssessment,
	delivered: DeliveredItem[],
	start: number,
	from: DeliveredItem | undefined,
	decls: DeclarationMap,
	rng: () => number,
): string | undefined {
	const holds = (conditions: string[] | undefined): boolean =>
		(conditions ?? []).every((condition) => evaluateTestCondition(condition, decls, rng));
	const skipPast = (j: number, inside: (d: DeliveredItem) => boolean): number => {
		let next = j + 1;
		while (next < delivered.length && inside(delivered[next]!)) next++;
		return next;
	};
	let j = start;
	candidates: while (j < delivered.length) {
		const candidate = delivered[j]!;
		const previous = j === start ? from : delivered[j - 1];
		if (candidate.testPart !== previous?.testPart && !holds(candidate.testPart.preConditions)) {
			j = skipPast(j, (d) => d.testPart === candidate.testPart);
			continue;
		}
		if (isLinear(assessment, candidate.testPart)) {
			for (const section of candidate.sections) {
				if (previous?.sections.includes(section) || holds(section.preConditions)) continue;
				j = skipPast(j, (d) => d.sections.includes(section));
				continue candidates;
			}
			if (!holds(candidate.item.preConditions)) {
				j++;
				continue;
			}
		}
		return candidate.item.identifier;
	}
	return undefined;
}

function isLinear(assessment: SecureAssessment, testPart: SecureTestPart): boolean {
	return (testPart.navigationMode ?? assessment.navigationMode) === 'linear';
}

/**
 * Draws selection and ordering for one session. Required children are always selected; selected
 * children keep source order before ordering shuffles the non-fixed ones. A child selected more
 * than once with replacement is cloned, its identifier and every descendant identifier suffixed
 * `.2`, `.3` and so on. An invisible child section with keepTogether false is mixed into its
 * parent's shuffle. The result carries no selection or ordering, so drawing it again changes
 * nothing.
 */
export function drawAssessment(assessment: SecureAssessment, rng: () => number): SecureAssessment {
	const copy = structuredClone(assessment);
	return {
		...copy,
		testParts: copy.testParts.map((testPart) => ({
			...testPart,
			sections: testPart.sections.map((section) => drawSection(section, rng)),
		})),
	};
}

function drawSection(section: SecureSection, rng: () => number): SecureSection {
	let components = sectionComponents(section);
	if (section.selection) components = selectComponents(section, components, rng);
	components = components.map((component) =>
		component.type === 'section' ? { type: 'section', section: drawSection(component.section, rng) } : component
	);

	if (section.ordering?.shuffle) {
		const sourceOf = new Map<SecureSection, SecureSection>();
		const expanded: SecureSectionComponent[] = [];
		for (const component of components) {
			if (component.type === 'section' && !component.section.visible && component.section.keepTogether === false) {
				for (const child of sectionComponents(component.section)) {
					const fragment = withComponents({ ...component.section, fixed: isFixedSectionComponent(child) }, [child]);
					sourceOf.set(fragment, component.section);
					expanded.push({ type: 'section', section: fragment });
				}
			} else {
				expanded.push(component);
			}
		}
		components = mergeAdjacentFragments(shuffleSectionComponents(expanded, rng), sourceOf);
	}

	const { selection: _selection, ordering: _ordering, ...rest } = section;
	return withComponents(rest, components);
}

function selectComponents(
	section: SecureSection,
	components: SecureSectionComponent[],
	rng: () => number,
): SecureSectionComponent[] {
	const count = Math.max(0, section.selection?.select ?? components.length);
	const indexed = components.map((component, sourceIndex) => ({ component, sourceIndex }));
	const required = indexed.filter(({ component }) => isRequiredSectionComponent(component));
	if (count < required.length) {
		throw new Error(
			`Section "${section.identifier}" selects ${count} components but contains ${required.length} required components.`,
		);
	}
	let chosen: typeof indexed;
	if (section.selection?.withReplacement === true) {
		if (indexed.length === 0 && count > 0) {
			throw new Error(`Section "${section.identifier}" selects ${count} components but contains none.`);
		}
		const draws = Array.from(
			{ length: count - required.length },
			() => indexed[Math.min(indexed.length - 1, Math.floor(rng() * indexed.length))]!,
		);
		chosen = [...required, ...draws];
	} else {
		if (count > indexed.length) {
			throw new Error(
				`Section "${section.identifier}" selects ${count} components without replacement but only contains ${indexed.length}.`,
			);
		}
		const optional = shuffleArray(indexed.filter(({ component }) => !isRequiredSectionComponent(component)), rng);
		chosen = [...required, ...optional.slice(0, count - required.length)];
	}
	const seen = new Map<number, number>();
	return chosen
		.sort((a, b) => a.sourceIndex - b.sourceIndex)
		.map(({ component, sourceIndex }) => {
			const occurrence = (seen.get(sourceIndex) ?? 0) + 1;
			seen.set(sourceIndex, occurrence);
			return occurrence === 1 ? component : renameComponent(component, `.${occurrence}`);
		});
}

function renameComponent(component: SecureSectionComponent, suffix: string): SecureSectionComponent {
	const copy = structuredClone(component);
	const renamed = new Set<object>();
	const renameItem = (item: SecureItemRef): void => {
		if (renamed.has(item)) return;
		renamed.add(item);
		item.identifier += suffix;
	};
	const renameSection = (section: SecureSection): void => {
		if (renamed.has(section)) return;
		renamed.add(section);
		section.identifier += suffix;
		for (const item of section.assessmentItemRefs ?? []) renameItem(item);
		for (const child of section.sections ?? []) renameSection(child);
		for (const child of section.children ?? []) {
			if (child.type === 'item') renameItem(child.item);
			else renameSection(child.section);
		}
	};
	if (copy.type === 'item') renameItem(copy.item);
	else renameSection(copy.section);
	return copy;
}

function withComponents(section: SecureSection, components: SecureSectionComponent[]): SecureSection {
	const sections = components.flatMap((c) => (c.type === 'section' ? [c.section] : []));
	return {
		...section,
		children: components,
		assessmentItemRefs: components.flatMap((c) => (c.type === 'item' ? [c.item] : [])),
		sections: sections.length > 0 ? sections : undefined,
	};
}

function mergeAdjacentFragments(
	components: SecureSectionComponent[],
	sourceOf: Map<SecureSection, SecureSection>,
): SecureSectionComponent[] {
	const out: SecureSectionComponent[] = [];
	for (const component of components) {
		const previous = out[out.length - 1];
		const source = component.type === 'section' ? sourceOf.get(component.section) : undefined;
		if (source && previous?.type === 'section' && sourceOf.get(previous.section) === source && component.type === 'section') {
			const merged = withComponents(previous.section, [
				...sectionComponents(previous.section),
				...sectionComponents(component.section),
			]);
			sourceOf.set(merged, source);
			out[out.length - 1] = { type: 'section', section: merged };
		} else {
			out.push(component);
		}
	}
	return out;
}

/** Fisher-Yates shuffle using a provided RNG (returns a new array). */
export function shuffleArray<T>(arr: readonly T[], rng: () => number): T[] {
	const out = [...arr];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[out[i], out[j]] = [out[j]!, out[i]!];
	}
	return out;
}

function isRequiredSectionComponent(component: SecureSectionComponent): boolean {
	return component.type === 'item' ? component.item.required === true : component.section.required === true;
}

function isFixedSectionComponent(component: SecureSectionComponent): boolean {
	return component.type === 'item' ? component.item.fixed === true : component.section.fixed === true;
}

/** Shuffle non-fixed children while retaining fixed children at their post-selection positions. */
function shuffleSectionComponents(components: SecureSectionComponent[], rng: () => number): SecureSectionComponent[] {
	const result = [...components];
	const movableIndexes = components.flatMap((component, index) => (isFixedSectionComponent(component) ? [] : [index]));
	const shuffled = shuffleArray(movableIndexes.map((index) => components[index]!), rng);
	for (let index = 0; index < movableIndexes.length; index++) {
		result[movableIndexes[index]!] = shuffled[index]!;
	}
	return result;
}

// ---------------------------------------------------------------------------
// Test-scope expressions
// ---------------------------------------------------------------------------

/** Canonical QTI 2.x element name for a QTI 2.x or QTI 3 (`qti-` kebab-case) element name. */
export function toCanonicalQtiName(name: string | null | undefined): string {
	const withoutPrefix = (name ?? '').replace(/^qti-/, '');
	return withoutPrefix.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
}

/** Reads QTI 2.x camelCase and QTI 3 `qti-` kebab-case element names alike. */
export const qtiElementNameMapper = {
	version: 'qti2x-or-qti3',
	toCanonical: (elementName: string) => toCanonicalQtiName(elementName).toLowerCase(),
	toNative: (canonicalName: string) => canonicalName,
	isValidElementName: () => true,
};

function toQtiValue(baseType: string, cardinality: string, value: unknown): QtiValue {
	if (value === null || value === undefined) return qtiNull(baseType as never, cardinality as never);
	return qtiValue(baseType as never, cardinality as never, value);
}

function declaration(identifier: string, value: QtiValue, defaultValue: QtiValue = value): DeclarationMap[string] {
	return {
		identifier,
		baseType: value.baseType,
		cardinality: value.cardinality ?? 'single',
		defaultValue,
		value: { ...value },
	};
}

/**
 * Declarations for the test's outcome variables, set to `outcomes` where given and to their
 * defaults otherwise. A numeric outcome with no declared default starts at 0.
 */
export function testOutcomeDeclarations(
	assessment: SecureAssessment,
	outcomes?: TestOutcomeValues | null,
): DeclarationMap {
	const decls: DeclarationMap = {};
	for (const d of assessment.outcomeDeclarations ?? []) {
		const defaultValue =
			d.defaultValue !== undefined
				? toQtiValue(d.baseType, d.cardinality, d.defaultValue)
				: d.baseType === 'float' || d.baseType === 'integer'
					? qtiValue(d.baseType, 'single', 0)
					: qtiNull(d.baseType as never, d.cardinality as never);
		const current = outcomes && d.identifier in outcomes
			? toQtiValue(d.baseType, d.cardinality, outcomes[d.identifier] as TestOutcomeValue)
			: defaultValue;
		decls[d.identifier] = {
			identifier: d.identifier,
			baseType: d.baseType as never,
			cardinality: d.cardinality as never,
			defaultValue,
			value: { ...current },
		};
	}
	return decls;
}

/**
 * Adds item variables as `itemIdentifier.VARIABLE`, the form test-scope expressions use, and the
 * `unprefixed` variables under their own identifiers where the test declares no such outcome.
 */
export function addItemVariableDeclarations(
	decls: DeclarationMap,
	itemVariables: Record<string, Record<string, QtiValue>>,
	unprefixed: Record<string, QtiValue> = {},
): DeclarationMap {
	for (const [itemIdentifier, variables] of Object.entries(itemVariables)) {
		for (const [identifier, value] of Object.entries(variables)) {
			const key = `${itemIdentifier}.${identifier}`;
			if (!decls[key]) decls[key] = declaration(key, value);
		}
	}
	for (const [identifier, value] of Object.entries(unprefixed)) {
		if (!decls[identifier]) decls[identifier] = declaration(identifier, value);
	}
	return decls;
}

/** Millisecond scope clocks the timing state carries; absent clocks read as 0 seconds. */
export interface ScopeTiming {
	/** Total assessment elapsed time (ms). */
	totalTime?: number;
	/** Elapsed time per testPart identifier (ms). */
	testPartTimes?: Record<string, number>;
	/** Elapsed time per section identifier (ms). */
	sectionTimes?: Record<string, number>;
}

/**
 * Adds the QTI built-in duration variables test-scope expressions read: `duration` for the whole
 * test, `TESTPART_ID.duration` and `SECTION_ID.duration` for each delivered part and section.
 * QTI durations are seconds; the timing state keeps milliseconds, so the values are converted.
 * Authored identifiers win: an existing declaration is never replaced.
 */
export function addScopeDurationDeclarations(
	decls: DeclarationMap,
	assessment: SecureAssessment,
	timing: ScopeTiming | undefined,
): DeclarationMap {
	const durationSeconds = (ms: number | undefined): number =>
		durationSecondsFromMilliseconds(Number(ms) || 0);
	const putDuration = (identifier: string, seconds: number): void => {
		if (!decls[identifier]) decls[identifier] = declaration(identifier, qtiValue('duration', 'single', seconds));
	};
	putDuration('duration', durationSeconds(timing?.totalTime));
	const visitSections = (sections: readonly SecureSection[]): void => {
		for (const section of sections) {
			putDuration(`${section.identifier}.duration`, durationSeconds(timing?.sectionTimes?.[section.identifier]));
			visitSections(section.sections ?? []);
		}
	};
	for (const testPart of assessment.testParts ?? []) {
		putDuration(`${testPart.identifier}.duration`, durationSeconds(timing?.testPartTimes?.[testPart.identifier]));
		visitSections(testPart.sections ?? []);
	}
	return decls;
}

/** Item variables with each variableMapping's source also readable as its target identifier. */
export function applyVariableMappings(
	variables: Record<string, QtiValue>,
	mappings: SecureItemRef['variableMappings'],
): Record<string, QtiValue> {
	if (!mappings?.length) return variables;
	const out = { ...variables };
	for (const { sourceIdentifier, targetIdentifier } of mappings) {
		const value = variables[sourceIdentifier];
		if (value) out[targetIdentifier] = value;
	}
	return out;
}

/** Evaluates a serialized test-scope expression (QTI 2.x or 3) against `decls`. */
export function evaluateTestExpression(expressionXml: string, decls: DeclarationMap, rng: () => number): QtiValue {
	const root = parseXml(expressionXml).documentElement;
	if (!root) return qtiNull();
	const expr = buildExpression(root, { scope: 'test', elementNameMapper: qtiElementNameMapper });
	return evalExpr({ ctx: new DeclarationContext(structuredClone(decls)), rng }, expr);
}

/** True only when the expression evaluates to boolean true; NULL and errors read as false. */
export function evaluateTestCondition(expressionXml: string, decls: DeclarationMap, rng: () => number): boolean {
	try {
		const out = evaluateTestExpression(expressionXml, decls, rng);
		return out.kind === 'value' && out.value === true;
	} catch (err) {
		console.warn('[assessment-player] test condition failed to evaluate:', err);
		return false;
	}
}

/** Plain value of a QTI value, null for NULL, in the shape item template defaults take. */
export function plainQtiValue(value: QtiValue): unknown {
	return value.kind === 'value' ? value.value : null;
}

/** A serialized item-session variable, as `SerializedItemSessionState` carries it. */
interface SerializedVariableShape {
	baseType?: string;
	cardinality: string;
	value: unknown;
}

/**
 * The QTI values of a serialized item session's response, outcome and template
 * variables (NULL where unset), keyed by variable identifier — the item's variables a
 * test-scope expression reads as `ITEM.VARIABLE`.
 */
export function itemSessionVariableValues(session: {
	responseVariables?: Record<string, SerializedVariableShape>;
	outcomeVariables?: Record<string, SerializedVariableShape>;
	templateVariables?: Record<string, SerializedVariableShape>;
}): Record<string, QtiValue> {
	const out: Record<string, QtiValue> = {};
	for (const group of [session.responseVariables, session.outcomeVariables, session.templateVariables]) {
		for (const [identifier, variable] of Object.entries(group ?? {})) {
			out[identifier] = toQtiValue(variable.baseType as string, variable.cardinality, variable.value);
		}
	}
	return out;
}

/**
 * An item's variables as test-level branch rules and preconditions read them (`ITEM.VARIABLE`),
 * in the shape the reference backend records after a counted submission (its item test state):
 * the session's context (numAttempts, duration, completionStatus), template, outcome and response
 * variables, with `scoredOutcomes` — the backend's scored outcome values, authoritative where the
 * delivered item carries no response processing — over them, typed by the session's own
 * declarations (a value without one is read as the reference backend reads a bare score: a
 * number as float, anything else as string). Record outcomes keep the session's value.
 */
export function recordedItemVariableValues(
	session:
		| {
				contextVariables?: Record<string, SerializedVariableShape>;
				responseVariables?: Record<string, SerializedVariableShape>;
				outcomeVariables?: Record<string, SerializedVariableShape>;
				templateVariables?: Record<string, SerializedVariableShape>;
		  }
		| undefined,
	scoredOutcomes: Record<string, unknown> | undefined,
): Record<string, QtiValue> {
	const out: Record<string, QtiValue> = {};
	for (const group of [
		session?.contextVariables,
		session?.templateVariables,
		session?.outcomeVariables,
		session?.responseVariables,
	]) {
		for (const [identifier, variable] of Object.entries(group ?? {})) {
			out[identifier] = toQtiValue(variable.baseType as string, variable.cardinality, variable.value);
		}
	}
	for (const [identifier, value] of Object.entries(scoredOutcomes ?? {})) {
		const declared = out[identifier];
		if (value === undefined || declared?.cardinality === 'record') continue;
		if (declared?.baseType) {
			out[identifier] = toQtiValue(declared.baseType, declared.cardinality ?? 'single', value);
		} else if (typeof value === 'number') {
			out[identifier] = qtiValue('float', 'single', value);
		} else if (value !== null && typeof value !== 'object') {
			out[identifier] = qtiValue('string', 'single', String(value));
		}
	}
	return out;
}
