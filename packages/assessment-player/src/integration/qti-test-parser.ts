/**
 * QTI assessmentTest XML parser for the reference backend.
 *
 * Extracted verbatim from ReferenceBackendAdapter; the adapter's static
 * `parseAssessmentTestXml` delegates here. Its output feeds both the adapter's
 * session model and (via player-elements' discovery parser) element-side
 * prefetch; keep identifier/href extraction in lockstep with
 * packages/player-elements/src/qti/parseAssessmentTest.ts.
 */

import { parseXml, serializeXml } from '@pie-qti/qti-processing';
import {
	createResolvedItemDeliveryContext,
	extractAssessmentStimulusRefs,
	extractProcessingIncludeRefs,
	extractQtiStylesheets,
	parseAssessmentStimulusXml,
	resolveCheckedPackagePath,
	resolveCheckedPackagePathFromFile,
} from '@pie-qti/ims-cp-core';
import { parse } from 'node-html-parser';
import type {
	SecureAssessment,
	SecureBranchRule,
	SecureItemRef,
	SecureItemSessionControl,
	TestFeedbackItem,
	SecureSection,
	SecureTestPart,
} from './api-contract.js';
import { toCanonicalQtiName } from '../core/testStructure.js';

/** Maximum assessmentSection nesting before parsing gives up (QTI 3.0 §2.2). */
class AssessmentSectionReferenceLimitError extends Error {}
/**
 * Parse a QTI assessmentTest XML string into a SecureAssessment structure.
 *
 * Handles:
 * - S1: section-level itemSessionControl
 * - S9: assessmentSectionRef href resolution (requires fileResolver)
 * - T9/T1: outcomeDeclarations + outcomeProcessing extraction
 *
 * @param testXml - Raw QTI assessmentTest XML string
 * @param options.role - Role to assign to items (default: 'candidate')
 * @param options.itemXmlMap - Map of item identifier -> itemXml for pre-loaded items
 * @param options.fileResolver - Async function to load external files by relative href
 * @param options.baseUrl - Base URL for resolving relative hrefs
 */
export async function parseAssessmentTestXml(
	testXml: string,
	options: {
		role?: SecureItemRef['role'];
		itemXmlMap?: Record<string, string>;
		fileResolver?: (href: string) => Promise<string>;
		baseUrl?: string;
		/**
		 * Shared catalog files the package manifest lists (resource type
		 * `imsqti_catalog_xmlv3p0`): href, XML, or both. Their entries back
		 * every item's `data-catalog-idref` terms; item-level catalogs win
		 * identifier collisions (QTI 3.0 §6.3).
		 */
		sharedCatalogs?: ReadonlyArray<{ href?: string; xml?: string }>;
		sectionReferenceLimits?: {
			/** Maximum total inline and external assessmentSection nesting. Defaults to 32. */
			maxDepth?: number;
		};
	} = {}
): Promise<SecureAssessment> {
	const { role = 'candidate', itemXmlMap = {}, fileResolver, baseUrl, sharedCatalogs } = options;
	const maxSectionDepth = options.sectionReferenceLimits?.maxDepth ?? 32;
	if (!Number.isInteger(maxSectionDepth) || maxSectionDepth < 1) {
		throw new Error('sectionReferenceLimits.maxDepth must be a positive integer');
	}
	const doc = parseXml(testXml);
	const root = doc.documentElement;
	if (!root) throw new Error('Empty assessmentTest XML');

	// Reads camelCase and QTI 3 kebab-case attribute spellings alike. Empty values
	// are treated as missing here; the player-elements discovery parser keeps '' —
	// the two are intentionally not shared so each call site keeps its semantics.
	const getAttr = (el: Element, name: string): string | undefined => {
		const direct = el.getAttribute(name);
		if (direct !== null && direct !== '') return direct;
		const mapped = el.getAttribute(name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`));
		return mapped === null || mapped === '' ? undefined : mapped;
	};

	const childElements = (el: Element): Element[] =>
		Array.from(el.childNodes).filter((n): n is Element => n.nodeType === 1);

	const childrenByTag = (el: Element, tag: string): Element[] =>
		childElements(el).filter((c) => toCanonicalQtiName(c.localName) === tag);

	// Parse itemSessionControl element
	const parseItemSessionControl = (el: Element): SecureItemSessionControl | undefined => {
		const isc = childrenByTag(el, 'itemSessionControl')[0];
		if (!isc) return undefined;
		const boolAttr = (name: string): boolean | undefined => {
			const v = getAttr(isc, name);
			return v === undefined ? undefined : v !== 'false';
		};
		const intAttr = (name: string): number | undefined => {
			const v = getAttr(isc, name);
			return v === undefined ? undefined : parseInt(v, 10);
		};
		return {
			maxAttempts: intAttr('maxAttempts'),
			showFeedback: boolAttr('showFeedback') ?? boolAttr('show-feedback'),
			allowReview: boolAttr('allowReview') ?? boolAttr('allow-review'),
			showSolution: boolAttr('showSolution') ?? boolAttr('show-solution'),
			allowComment: boolAttr('allowComment') ?? boolAttr('allow-comment'),
			allowSkipping: boolAttr('allowSkipping') ?? boolAttr('allow-skipping'),
			validateResponses: boolAttr('validateResponses') ?? boolAttr('validate-responses'),
		};
	};

	const parseTimeLimits = (el: Element): SecureAssessment['timeLimits'] | undefined => {
		const limitsEl = childrenByTag(el, 'timeLimit')[0] ?? childrenByTag(el, 'timeLimits')[0];
		if (!limitsEl) return undefined;
		const numberAttr = (name: string): number | undefined => {
			const value = getAttr(limitsEl, name);
			if (value === undefined) return undefined;
			const parsed = Number(value);
			return Number.isFinite(parsed) ? parsed : undefined;
		};
		const boolAttr = (name: string): boolean | undefined => {
			const value = getAttr(limitsEl, name);
			return value === undefined ? undefined : value === 'true';
		};
		return {
			minTime: numberAttr('minTime'),
			maxTime: numberAttr('maxTime'),
			allowLateSubmission: boolAttr('allowLateSubmission'),
		};
	};

	const parseConditionExpressions = (el: Element, tag: string): string[] | undefined => {
		const expressions = childrenByTag(el, tag)
			.map((condition) => childElements(condition)[0])
			.filter((expression): expression is Element => Boolean(expression))
			.map((expression) => serializeXml(expression));
		return expressions.length > 0 ? expressions : undefined;
	};

	const parseBranchRules = (el: Element): SecureBranchRule[] | undefined => {
		const rules = childrenByTag(el, 'branchRule').flatMap((rule) => {
			const target = getAttr(rule, 'target');
			if (!target) return [];
			const expression = childElements(rule)[0];
			return [{ target, conditionXml: expression ? serializeXml(expression) : undefined }];
		});
		return rules.length > 0 ? rules : undefined;
	};

	const parseSelection = (el: Element): SecureSection['selection'] => {
		const selection = childrenByTag(el, 'selection')[0];
		if (!selection) return undefined;
		const select = Number.parseInt(getAttr(selection, 'select') ?? '', 10);
		if (!Number.isInteger(select) || select < 0) return undefined;
		const withReplacementRaw = getAttr(selection, 'withReplacement');
		return {
			select,
			withReplacement: withReplacementRaw === undefined ? undefined : withReplacementRaw === 'true',
		};
	};

	const parseOrdering = (el: Element): SecureSection['ordering'] => {
		const ordering = childrenByTag(el, 'ordering')[0];
		if (!ordering) return undefined;
		return { shuffle: getAttr(ordering, 'shuffle') === 'true' };
	};

	const resolveCheckedHref = (
		href: string | undefined,
		sourceHref?: string,
	): string | undefined => {
		if (!href) return undefined;
		if (sourceHref) {
			return resolveCheckedPackagePathFromFile(sourceHref, href) ?? undefined;
		}
		return baseUrl
			? resolveCheckedPackagePathFromFile(baseUrl, href) ?? undefined
			: resolveCheckedPackagePath(undefined, href) ?? undefined;
	};

	const loadText = async (
		href: string | undefined,
		sourceHref?: string,
	): Promise<string | undefined> => {
		if (!href) return undefined;
		const candidates = [href, resolveCheckedHref(href, sourceHref)].filter((value, index, all): value is string =>
			Boolean(value) && all.indexOf(value) === index
		);
		for (const candidate of candidates) {
			if (itemXmlMap[candidate] !== undefined) {
				return itemXmlMap[candidate];
			}
		}
		if (!fileResolver) return undefined;
		for (const candidate of candidates) {
			try {
				return await fileResolver(candidate);
			} catch {
				// Try the next candidate before giving up.
			}
		}
		return undefined;
	};

	const buildDeliveryContext = async (
		itemXml: string,
		itemHref: string | undefined
	): Promise<SecureItemRef['deliveryContext'] | undefined> => {
		if (!itemHref) {
			return undefined;
		}
		const stimulusXmlByPath: Record<string, string> = {};
		const packageTextByPath: Record<string, string> = {};
		const preloadText = async (baseHref: string, href: string): Promise<void> => {
			const resolvedPath = resolveCheckedPackagePathFromFile(baseHref, href);
			if (!resolvedPath) return;
			const text = await loadText(resolvedPath);
			if (text !== undefined) {
				packageTextByPath[resolvedPath] = text;
			}
		};
		for (const stylesheet of extractQtiStylesheets(itemXml)) {
			await preloadText(itemHref, stylesheet.href);
		}
		for (const ref of extractAssessmentStimulusRefs(itemXml)) {
			const stimulusPath = resolveCheckedPackagePathFromFile(itemHref, ref.href);
			if (!stimulusPath) continue;
			const stimulusXml = await loadText(stimulusPath);
			if (stimulusXml) {
				stimulusXmlByPath[stimulusPath] = stimulusXml;
				for (const stylesheet of parseAssessmentStimulusXml(stimulusXml).stylesheets) {
					await preloadText(stimulusPath, stylesheet.href);
				}
			}
		}
		// Preload external processing fragments so the item session's synchronous
		// resolver stays package-contained. Nested includes resolve relative to the
		// fragment that references them; the processing engine still validates
		// namespace, mode, depth, and cycles at build time.
		const processingFragments: Record<string, string> = {};
		const collectProcessingFragments = async (
			sourceXml: string,
			sourceHref: string,
			seen: Set<string>,
		): Promise<void> => {
			for (const includeHref of extractProcessingIncludeRefs(sourceXml)) {
				const fragmentPath = resolveCheckedPackagePathFromFile(sourceHref, includeHref);
				if (!fragmentPath || seen.has(fragmentPath)) continue;
				seen.add(fragmentPath);
				const fragmentXml = await loadText(fragmentPath);
				if (fragmentXml === undefined) continue;
				processingFragments[fragmentPath] = fragmentXml;
				await collectProcessingFragments(fragmentXml, fragmentPath, seen);
			}
		};
		const fragmentSeen = new Set<string>();
		await collectProcessingFragments(itemXml, itemHref, fragmentSeen);
		// Shared catalog files resolve against the package root, not the item.
		const packageCatalogSources: Array<{ href?: string; xml?: string }> = [];
		for (const shared of sharedCatalogs ?? []) {
			if (shared.xml) {
				packageCatalogSources.push({ href: shared.href, xml: shared.xml });
				continue;
			}
			if (!shared.href) continue;
			const href = resolveCheckedHref(shared.href);
			if (!href) continue;
			const xml = await loadText(href);
			if (xml !== undefined) packageCatalogSources.push({ href, xml });
		}
		return createResolvedItemDeliveryContext({
			itemXml,
			itemHref,
			readText: (path) => packageTextByPath[path] ?? stimulusXmlByPath[path] ?? itemXmlMap[path],
			...(Object.keys(processingFragments).length > 0 ? { processingFragments } : {}),
			...(packageCatalogSources.length > 0 ? { packageCatalogSources } : {}),
		});
	};

	let resolveSectionRef: (
		sectionRefEl: Element,
		sourceHref?: string,
		ancestorHrefs?: readonly string[],
		depth?: number,
	) => Promise<SecureSection | null>;

	const parseItemRef = async (ref: Element, sourceHref?: string): Promise<SecureItemRef> => {
		const itemId = getAttr(ref, 'identifier') ?? 'item';
		const href = getAttr(ref, 'href');
		const itemHref = resolveCheckedHref(href, sourceHref);
		const resolvedXml = href && !itemHref
			? ''
			: itemXmlMap[itemId] ??
				(href ? itemXmlMap[href] : undefined) ??
				(itemHref ? itemXmlMap[itemHref] : undefined) ??
				(await loadText(itemHref)) ??
				'';
		const requiredRaw = getAttr(ref, 'required');
		const fixedRaw = getAttr(ref, 'fixed');
		const categories = (getAttr(ref, 'category') ?? '').split(/\s+/).filter(Boolean);
		const weights = childrenByTag(ref, 'weight').flatMap((weight) => {
			const identifier = getAttr(weight, 'identifier');
			const value = Number(getAttr(weight, 'value'));
			return identifier && Number.isFinite(value) ? [{ identifier, value }] : [];
		});
		const variableMappings = childrenByTag(ref, 'variableMapping').flatMap((mapping) => {
			const sourceIdentifier = getAttr(mapping, 'sourceIdentifier');
			const targetIdentifier = getAttr(mapping, 'targetIdentifier');
			return sourceIdentifier && targetIdentifier ? [{ sourceIdentifier, targetIdentifier }] : [];
		});
		const templateDefaults = childrenByTag(ref, 'templateDefault').flatMap((templateDefault) => {
			const templateIdentifier = getAttr(templateDefault, 'templateIdentifier');
			const expression = childElements(templateDefault)[0];
			return templateIdentifier && expression
				? [{ templateIdentifier, expressionXml: serializeXml(expression) }]
				: [];
		});
		return {
			identifier: itemId,
			itemXml: resolvedXml,
			role,
			required: requiredRaw === undefined ? undefined : requiredRaw !== 'false',
			fixed: fixedRaw === undefined ? undefined : fixedRaw !== 'false',
			timeLimits: parseTimeLimits(ref),
			deliveryContext: await buildDeliveryContext(resolvedXml, itemHref),
			branchRule: parseBranchRules(ref),
			preConditions: parseConditionExpressions(ref, 'preCondition'),
			weights: weights.length > 0 ? weights : undefined,
			categories: categories.length > 0 ? categories : undefined,
			itemSessionControl: parseItemSessionControl(ref),
			variableMappings: variableMappings.length > 0 ? variableMappings : undefined,
			templateDefaults: templateDefaults.length > 0 ? templateDefaults : undefined,
		};
	};

	// Parse a single assessmentSection element without flattening nested sections.
	const parseSection = async (
		sectionEl: Element,
		sourceHref?: string,
		ancestorHrefs: readonly string[] = [],
		depth = 1,
	): Promise<SecureSection> => {
		const identifier = getAttr(sectionEl, 'identifier') ?? 'section';
		if (depth > maxSectionDepth) {
			throw new AssessmentSectionReferenceLimitError(
				`assessmentSection nesting exceeds maxDepth (${maxSectionDepth}) at "${identifier}"`,
			);
		}
		const title = getAttr(sectionEl, 'title');
		const visibleRaw = getAttr(sectionEl, 'visible');
		const visible = visibleRaw === undefined ? true : visibleRaw !== 'false';
		const requiredRaw = getAttr(sectionEl, 'required');
		const fixedRaw = getAttr(sectionEl, 'fixed');
		const keepTogetherRaw = getAttr(sectionEl, 'keepTogether');

		const itemSessionControl = parseItemSessionControl(sectionEl);
		const timeLimits = parseTimeLimits(sectionEl);

		// rubricBlocks
		const rubricBlockEls = childrenByTag(sectionEl, 'rubricBlock');
		const rubricBlocks = rubricBlockEls.length > 0
			? rubricBlockEls.map((b, idx) => ({
				identifier: getAttr(b, 'identifier') ?? `${identifier}-rubric-${idx + 1}`,
				view: (getAttr(b, 'view') ?? 'candidate').split(/\s+/).filter(Boolean) as any[],
				use: getAttr(b, 'use'),
				content: serializeXml(b),
			}))
			: undefined;

		const assessmentItemRefs: SecureItemRef[] = [];
		const sections: SecureSection[] = [];
		const children: NonNullable<SecureSection['children']> = [];
		for (const child of childElements(sectionEl)) {
			const name = toCanonicalQtiName(child.localName);
			if (name === 'assessmentItemRef') {
				const item = await parseItemRef(child, sourceHref);
				assessmentItemRefs.push(item);
				children.push({ type: 'item', item });
			} else if (name === 'assessmentSection') {
				const section = await parseSection(child, sourceHref, ancestorHrefs, depth + 1);
				sections.push(section);
				children.push({ type: 'section', section });
			} else if (name === 'assessmentSectionRef') {
				const section = await resolveSectionRef(child, sourceHref, ancestorHrefs, depth + 1);
				if (section) {
					sections.push(section);
					children.push({ type: 'section', section });
				}
			}
		}

		return {
			identifier,
			title,
			visible,
			required: requiredRaw === undefined ? undefined : requiredRaw !== 'false',
			fixed: fixedRaw === undefined ? undefined : fixedRaw !== 'false',
			assessmentItemRefs,
			sections: sections.length > 0 ? sections : undefined,
			children: children.length > 0 ? children : undefined,
			rubricBlocks,
			itemSessionControl,
			timeLimits,
			selection: parseSelection(sectionEl),
			ordering: parseOrdering(sectionEl),
			preConditions: parseConditionExpressions(sectionEl, 'preCondition'),
			branchRule: parseBranchRules(sectionEl),
			keepTogether: keepTogetherRaw === undefined ? undefined : keepTogetherRaw !== 'false',
		};
	};

	// Resolve assessmentSectionRef: load and parse referenced section file
	resolveSectionRef = async (
		sectionRefEl: Element,
		sourceHref?: string,
		ancestorHrefs: readonly string[] = [],
		depth = 1,
	): Promise<SecureSection | null> => {
		const href = getAttr(sectionRefEl, 'href');
		if (!href) {
			console.warn('[ReferenceBackendAdapter] assessmentSectionRef missing href, skipping');
			return null;
		}

		if (!fileResolver) {
			console.warn(
				`[ReferenceBackendAdapter] assessmentSectionRef href="${href}" found but no fileResolver provided, skipping`
			);
			return null;
		}

		try {
			const resolvedHref = resolveCheckedHref(href, sourceHref);
			if (!resolvedHref) {
				console.warn(`[ReferenceBackendAdapter] assessmentSectionRef href="${href}" is unsafe, skipping`);
				return null;
			}
			if (ancestorHrefs.includes(resolvedHref)) {
				throw new AssessmentSectionReferenceLimitError(
					`Cyclic assessmentSectionRef detected: ${[...ancestorHrefs, resolvedHref].join(' -> ')}`,
				);
			}
			if (depth > maxSectionDepth) {
				throw new AssessmentSectionReferenceLimitError(
					`assessmentSectionRef nesting exceeds maxDepth (${maxSectionDepth}) at "${resolvedHref}"`,
				);
			}
			const sectionXml = await fileResolver(resolvedHref);
			const secDoc = parseXml(sectionXml);
			const secRoot = secDoc.documentElement;
			if (!secRoot || toCanonicalQtiName(secRoot.localName) !== 'assessmentSection') {
				console.warn(
					`[ReferenceBackendAdapter] assessmentSectionRef href="${href}": root element is not <assessmentSection>, skipping`
				);
				return null;
			}
			return parseSection(secRoot, resolvedHref, [...ancestorHrefs, resolvedHref], depth);
		} catch (err) {
			if (err instanceof AssessmentSectionReferenceLimitError) throw err;
			console.warn(
				`[ReferenceBackendAdapter] Failed to load assessmentSectionRef href="${href}":`,
				err
			);
			return null;
		}
	};

	// Parse testPart children (sections + sectionRefs)
	const parseSectionsForTestPart = async (testPartEl: Element): Promise<SecureSection[]> => {
		const sections: SecureSection[] = [];
		for (const child of childElements(testPartEl)) {
			if (toCanonicalQtiName(child.localName) === 'assessmentSection') {
				sections.push(await parseSection(child));
			} else if (toCanonicalQtiName(child.localName) === 'assessmentSectionRef') {
				const resolved = await resolveSectionRef(child);
				if (resolved) sections.push(resolved);
			}
		}
		return sections;
	};

	// Extract outcomeDeclarations
	const outcomeDeclarations = childrenByTag(root, 'outcomeDeclaration').map((d) => {
		const identifier = getAttr(d, 'identifier') ?? 'OUTCOME';
		const baseType = getAttr(d, 'baseType') ?? 'float';
		const cardinality = getAttr(d, 'cardinality') ?? 'single';
		// Parse defaultValue if present
		const defaultValueEl = childrenByTag(d, 'defaultValue')[0];
		let defaultValue: unknown = undefined;
		if (defaultValueEl) {
			const valueEl = childrenByTag(defaultValueEl, 'value')[0];
			if (valueEl) {
				const text = valueEl.textContent?.trim() ?? '0';
				if (baseType === 'float' || baseType === 'integer') {
					defaultValue = Number(text);
				} else {
					defaultValue = text;
				}
			}
		}
		return { identifier, baseType, cardinality, defaultValue };
	});

	// Extract outcomeProcessing XML
	const outcomeProcessingEl = childrenByTag(root, 'outcomeProcessing')[0];
	const outcomeProcessingXml = outcomeProcessingEl
		? serializeXml(outcomeProcessingEl)
		: undefined;
	// QTI 3 wraps testFeedback content in qti-content-body.
	const parseTestFeedback = (parent: Element): TestFeedbackItem[] | undefined => {
		const items = childrenByTag(parent, 'testFeedback').flatMap((feedback, index) => {
			const outcomeIdentifier = getAttr(feedback, 'outcomeIdentifier');
			if (!outcomeIdentifier) return [];
			const body = childrenByTag(feedback, 'contentBody')[0] ?? feedback;
			const content = Array.from(body.childNodes).map((node) => serializeXml(node)).join('');
			return [{
				identifier: getAttr(feedback, 'identifier') ?? `test-feedback-${index + 1}`,
				outcomeIdentifier,
				showHide: (getAttr(feedback, 'showHide') ?? 'show') as 'show' | 'hide',
				access: (getAttr(feedback, 'access') ?? 'atEnd') as 'atEnd' | 'during',
				content,
			}];
		});
		return items.length > 0 ? items : undefined;
	};
	const testFeedback = parseTestFeedback(root);

	// Extract assessment-level timeLimits.
	const timeLimits = parseTimeLimits(root);

	// Parse testParts
	const testPartEls = childrenByTag(root, 'testPart');
	const firstTestPart = testPartEls[0];

	// Retain top-level compatibility fields while preserving the authoritative
	// mode on every testPart below.
	const navigationMode = (getAttr(firstTestPart ?? root, 'navigationMode') ?? 'nonlinear') as
		| 'linear'
		| 'nonlinear';
	const submissionMode = (getAttr(firstTestPart ?? root, 'submissionMode') ?? 'simultaneous') as
		| 'individual'
		| 'simultaneous';

	const testParts: SecureTestPart[] = [];
	for (const tp of testPartEls) {
		const tpIdentifier = getAttr(tp, 'identifier') ?? 'part-1';
		const tpNavigationMode = (getAttr(tp, 'navigationMode') ?? 'nonlinear') as 'linear' | 'nonlinear';
		const tpSubmissionMode = (getAttr(tp, 'submissionMode') ?? 'simultaneous') as
			| 'individual'
			| 'simultaneous';
		const tpItemSessionControl = parseItemSessionControl(tp);
		const tpTimeLimits = parseTimeLimits(tp);
		const tpRubricBlockEls = childrenByTag(tp, 'rubricBlock');
		const tpRubricBlocks = tpRubricBlockEls.length > 0
			? tpRubricBlockEls.map((b, idx) => ({
				identifier: getAttr(b, 'identifier') ?? `${tpIdentifier}-rubric-${idx + 1}`,
				view: (getAttr(b, 'view') ?? 'candidate').split(/\s+/).filter(Boolean) as any[],
				use: getAttr(b, 'use'),
				content: serializeXml(b),
			}))
			: undefined;

		const sections = await parseSectionsForTestPart(tp);
		testParts.push({
			identifier: tpIdentifier,
			navigationMode: tpNavigationMode,
			submissionMode: tpSubmissionMode,
			sections,
			rubricBlocks: tpRubricBlocks,
			testFeedback: parseTestFeedback(tp),
			itemSessionControl: tpItemSessionControl,
			timeLimits: tpTimeLimits,
			preConditions: parseConditionExpressions(tp, 'preCondition'),
			branchRule: parseBranchRules(tp),
		});
	}

	// If no testParts, try top-level sections
	if (testParts.length === 0) {
		const topSections: SecureSection[] = [];
		for (const child of childElements(root)) {
			if (toCanonicalQtiName(child.localName) === 'assessmentSection') {
				topSections.push(await parseSection(child));
			} else if (toCanonicalQtiName(child.localName) === 'assessmentSectionRef') {
				const resolved = await resolveSectionRef(child);
				if (resolved) topSections.push(resolved);
			}
		}
		if (topSections.length > 0) {
			testParts.push({
				identifier: 'part-1',
				navigationMode,
				submissionMode,
				sections: topSections,
			});
		}
	}

	return {
		identifier: getAttr(root, 'identifier') ?? 'assessment',
		title: getAttr(root, 'title') ?? 'Assessment',
		navigationMode,
		submissionMode,
		testParts,
		timeLimits,
		outcomeDeclarations: outcomeDeclarations.length > 0 ? outcomeDeclarations : undefined,
		outcomeProcessingXml,
		testFeedback,
		baseUrl,
	};
}
