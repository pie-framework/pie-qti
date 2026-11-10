/**
 * Response validation: the field checks every interaction's response must satisfy, and
 * the end-attempt gate that additionally rejects incomplete required responses.
 *
 * The generic checks run for every interaction, keyed on the delivered interaction type
 * (the extractor's output type — a vendor extractor may deliver its own type with its own
 * data); interaction-shaped fields (minChoices, matchMin, requiredGaps, patternMask,
 * matchGroup) are read generically from the interaction data.
 */
import { type DeclarationMap, xsdPatternToRegExp } from '@pie-qti/qti-processing';
import type { MatchGroupConstraints } from '../matchGroups.js';
import { findMatchGroupViolations } from '../matchGroups.js';
import { type OrderChoiceLimits, orderChoiceLimits } from '../../interactions/order/limits.js';
import type { ResponseValidationResult } from '../../types/responseValidation.js';

/** What response validation reads from the session engine. */
export interface ResponseValidationHost {
	readonly decls: DeclarationMap;
	/** matchGroup constraints of the item's pairing interactions, by response identifier. */
	readonly matchGroupConstraints: ReadonlyMap<string, MatchGroupConstraints>;
	getInteractions(): Array<{ type: string; responseIdentifier: string } & Record<string, any>>;
	getResponseInteractions(): Array<{ type: string; responseIdentifier: string } & Record<string, any>>;
}

export function validateResponses(host: ResponseValidationHost, responses: Record<string, any>): ResponseValidationResult {
	const interactions = host.getInteractions();
	const entries: ResponseValidationResult['entries'] = {};
	const issues: ResponseValidationResult['issues'] = [];

	for (const i of interactions) {
		const responseId = i.responseIdentifier;
		const decl = host.decls[responseId];
		const value = responses[responseId];
		const isMeaningfulEntry = (entry: unknown): boolean => isMeaningfulResponseEntry(entry, i);

		const constrainedChoices: Array<{ identifier: string; matchMin?: number }> = [
			...(i.choices ?? []),
			...(i.gapTexts ?? []),
			...(i.gapImages ?? []),
			...(i.sourceSet ?? []),
			...(i.targetSet ?? []),
			...(i.associableHotspots ?? []),
		];
		const minimum = Math.max(
			0,
			Number(i.minChoices ?? 0),
			Number(i.minAssociations ?? 0),
			Number(i.minStrings ?? 0),
			Number(i.minPlays ?? 0),
		);
		// gap `required` (QTI 2.1 gap; QTI 3.0 §5.55.5): "this gap must be filled by the candidate
		// in order to form a valid response to the interaction".
		const requiredGaps: string[] = Array.isArray(i.requiredGaps) ? i.requiredGaps : [];
		const required =
			i.type !== 'endAttemptInteraction' &&
			(minimum > 0 ||
				requiredGaps.length > 0 ||
				constrainedChoices.some((choice) => Number(choice.matchMin ?? 0) > 0));

		let complete = !required;
		if (i.type === 'mediaInteraction' && required) {
			const minPlays = Number(i.minPlays || 0);
			complete = Number(value || 0) >= minPlays;
		} else if (required) {
			if (Array.isArray(value)) {
				const nonEmptyValues = value.filter(isMeaningfulEntry);
				complete = nonEmptyValues.length > 0;
				// Enforce minChoices / minAssociations where applicable
					const minChoices = Math.max(
						Number(i.minChoices ?? 0),
						Number(i.minAssociations ?? 0),
						Number(i.minStrings ?? 0),
					);
				if (complete && minChoices > 0) {
					complete = nonEmptyValues.length >= minChoices;
				}
				// Enforce matchMin per-choice: each pairing entry "id1 id2" in value must
				// appear at least matchMin times for the relevant choice.
				// Collect all choice arrays that can carry matchMin across all pairing interaction types.
					for (const choice of constrainedChoices) {
					const min = Number(choice.matchMin || 0);
					if (min > 0) {
						const count = (value as string[]).filter((p) => {
							const parts = p.split(' ');
							return parts[0] === choice.identifier || parts[1] === choice.identifier;
						}).length;
						if (count < min) {
							complete = false;
							break;
						}
					}
				}
			} else if (decl?.cardinality === 'record') {
				const stringValue = value && typeof value === 'object'
					? (value as Record<string, unknown>).stringValue
					: undefined;
				complete = isMeaningfulEntry(stringValue);
			} else {
				complete = isMeaningfulEntry(value);
			}
		}

		// A gap-match response pairs "gapText gap": each required gap must be the target of a pair.
		if (requiredGaps.length > 0) {
			const filled = new Set(
				(Array.isArray(value) ? value.filter(isMeaningfulEntry) : []).map((pair) => String(pair).split(' ')[1]),
			);
			if (requiredGaps.some((gap) => !filled.has(gap))) complete = false;
		}

		// orderInteraction / graphicOrderInteraction: an order that has begun is complete once it
		// holds the minimum its mode sets — every choice when no subset is requested (minChoices
		// unspecified: "all of the choices must be ordered"), at least minChoices when one is.
		// An untouched order stays a skip, as before, which allowSkipping governs.
		const orderLimits = orderInteractionLimits(i);
		const orderedCount = orderLimits && Array.isArray(value) ? value.filter(isMeaningfulEntry).length : 0;
		if (orderLimits && orderedCount > 0) {
			complete = orderedCount >= orderLimits.minOrdered;
		}

		const errors: string[] = [];
		const warnings: string[] = [];

		if (decl) {
			if (decl.cardinality === 'multiple' || decl.cardinality === 'ordered') {
				if (!(value === null || value === undefined || Array.isArray(value))) {
					errors.push(`Expected an array for ${decl.cardinality} response '${responseId}'`);
				}
			} else if (decl.cardinality === 'record') {
				if (!(value === null || value === undefined || (typeof value === 'object' && !Array.isArray(value)))) {
					errors.push(`Expected an object for record response '${responseId}'`);
				}
			} else {
				if (Array.isArray(value)) {
					errors.push(`Expected a single value for response '${responseId}'`);
				}
			}
		}
		if (
			i.type === 'extendedTextInteraction' &&
			Array.isArray(value) &&
			Number(i.maxStrings ?? 0) > 0 &&
			value.filter(isMeaningfulEntry).length > Number(i.maxStrings)
		) {
			errors.push(`Response '${responseId}' exceeds maxStrings=${i.maxStrings}`);
		}
		// patternMask (QTI 2.1; QTI 3.0 §5.48.4, §5.162.5): "a regular expression that the
		// candidate's response must match in order to be considered valid", in XSD syntax. A string
		// response holds the text as entered; a numeric one does not, and its input checks the text.
		const patternMask = typeof i.patternMask === 'string' ? xsdPatternToRegExp(i.patternMask) : null;
		if (patternMask && decl?.baseType === 'string') {
			const entered = (Array.isArray(value) ? value : [value]).filter(
				(text): text is string => typeof text === 'string' && text !== '',
			);
			if (entered.some((text) => !patternMask.test(text))) {
				errors.push(`Response '${responseId}' does not match its patternMask`);
			}
		}
		// The order-subset cap: when a subset is requested, a restored or programmatic response
		// may not order more than maxChoices (clamped to the choices); the delivered UI refuses it.
		if (orderLimits?.subset && orderedCount > orderLimits.maxOrdered) {
			errors.push(`Response '${responseId}' exceeds maxChoices=${orderLimits.maxOrdered}`);
		}
		// graphicGapMatch maxima: the delivered interface does not cap them all, so a response
		// built or restored over a limit is checked here.
		if (i.type === 'graphicGapMatchInteraction' && Array.isArray(value)) {
			errors.push(
				...graphicGapMatchMaximaErrors(responseId, value.filter(isMeaningfulEntry), {
					maxAssociations: i.maxAssociations,
					gapTexts: i.gapTexts,
					gapImages: i.gapImages,
					hotspots: i.hotspots,
				}),
			);
		}
		// gapMatch maxAssociations (0 = no restriction): the delivered interface refuses a
		// placement past it; a restored or programmatic response over it is checked here.
		const gapMatchMax = i.type === 'gapMatchInteraction' ? Number(i.maxAssociations ?? 0) : 0;
		if (gapMatchMax > 0 && Array.isArray(value) && value.filter(isMeaningfulEntry).length > gapMatchMax) {
			errors.push(`Response '${responseId}' exceeds maxAssociations=${gapMatchMax}`);
		}
		const shapeErrorCount = errors.length;

		// matchGroup restricts which choices may pair. The renderers enforce it while the
		// candidate works; a restored or programmatic response is checked here.
		const matchGroups = host.matchGroupConstraints.get(responseId);
		if (matchGroups) {
			for (const pair of findMatchGroupViolations(value, matchGroups)) {
				errors.push(`Response '${responseId}' pairs ${pair.replace(' ', ' with ')}, which matchGroup does not allow`);
			}
		}

		const valid = errors.length === 0;
		entries[responseId] = {
			responseId,
			interactionType: i.type,
			required,
			complete,
			valid,
			errors,
			warnings,
		};

		errors.forEach((e, index) => {
			issues.push({
				responseId,
				code: index < shapeErrorCount ? 'invalid_shape' : 'match_group',
				message: e,
				severity: 'error',
			});
		});
	}

	const allValid = Object.values(entries).every((e) => e.valid);
	return { valid: allValid, entries, issues };
}

/**
 * The validation the end attempt with `validateResponses` gates on (QTI ASI §4
 * itemSessionControl validateResponses). An invalid response "does not satisfy the
 * constraints imposed by the interaction": beyond a malformed value or a matchGroup
 * pairing (`validateResponses`), an interaction that requires input — minChoices,
 * minAssociations, minStrings, minPlays, matchMin — rejects an incomplete one. Those
 * entries turn invalid with an `incomplete` issue, so the result reads invalid through
 * the same channel as every other rejection.
 *
 * An item with no response at all is a skip, which allowSkipping governs ("delivery
 * engines must ensure that the candidate can choose to submit no response" when it is
 * true). The item cannot see allowSkipping, so completeness applies only once the
 * candidate has responded and a skip is the caller's decision.
 */
export function validateAttemptResponses(host: ResponseValidationHost, responses: Record<string, any>): ResponseValidationResult {
	const validation = validateResponses(host, responses);
	if (!isAttempted(host, responses)) return validation;
	const entries: ResponseValidationResult['entries'] = {};
	const issues = [...validation.issues];
	for (const entry of Object.values(validation.entries)) {
		if (entry.complete) {
			entries[entry.responseId] = entry;
			continue;
		}
		const message = `Response '${entry.responseId}' does not satisfy the constraints of its ${entry.interactionType}`;
		entries[entry.responseId] = { ...entry, valid: false, errors: [...entry.errors, message] };
		issues.push({ responseId: entry.responseId, code: 'incomplete', message, severity: 'error' });
	}
	return { valid: Object.values(entries).every((e) => e.valid), entries, issues };
}

export function isAttempted(host: ResponseValidationHost, responses: Record<string, any>): boolean {
	for (const i of host.getResponseInteractions()) {
		const id = i.responseIdentifier;
		const v = responses[id];
		const isMeaningful = (entry: unknown): boolean => isMeaningfulResponseEntry(entry, i);
		if (i.type === 'mediaInteraction') {
			if (Number(v || 0) > 0) return true;
			continue;
		}
		if (Array.isArray(v)) {
			if (v.some(isMeaningful)) return true;
			continue;
		}
		if (v && typeof v === 'object') {
			const record = v as Record<string, unknown>;
			if (
				Object.values(record).some(isMeaningful)
			) return true;
			continue;
		}
		if (isMeaningful(v)) return true;
	}
	return false;
}

/**
 * True when a response entry carries meaningful learner input. Extended-text items
 * authored as XHTML are stripped to plain text first, so markup-only answers do not
 * count as "answered". Shared by response validation and attempted-state tracking.
 */
export function isMeaningfulResponseEntry(
	entry: unknown,
	interaction: { type?: string; format?: string },
): boolean {
	if (entry === null || entry === undefined) return false;
	if (typeof entry !== 'string') return true;
	const comparable = interaction.type === 'extendedTextInteraction' && interaction.format === 'xhtml'
		? entry.replace(/<[^>]*>/g, '').replace(/&nbsp;|&#160;/gi, ' ')
		: entry;
	return comparable.trim().length > 0;
}

/**
 * The graphicGapMatchInteraction maxima a response breaks (QTI ASI graphicGapMatchInteraction,
 * gapChoice and associableHotspot): at most `maxAssociations` associations, and each gap choice
 * (gapText, gapImg) and each hotspot in at most its `matchMax` associations; 0 means no
 * restriction. Associations are directed pairs "choice hotspot"; other entries count towards
 * `maxAssociations` only.
 */
function graphicGapMatchMaximaErrors(
	responseId: string,
	entries: readonly unknown[],
	interaction: {
		maxAssociations?: number;
		gapTexts?: ReadonlyArray<{ identifier: string; matchMax?: number }>;
		gapImages?: ReadonlyArray<{ identifier: string; matchMax?: number }>;
		hotspots?: ReadonlyArray<{ identifier: string; matchMax?: number }>;
	},
): string[] {
	const errors: string[] = [];
	const maxAssociations = Number(interaction.maxAssociations ?? 0);
	if (maxAssociations > 0 && entries.length > maxAssociations) {
		errors.push(`Response '${responseId}' exceeds maxAssociations=${maxAssociations}`);
	}
	const pairs = entries
		.filter((entry): entry is string => typeof entry === 'string')
		.map((entry) => entry.trim().split(/\s+/))
		.filter((parts) => parts.length === 2);
	const checkMatchMax = (choices: ReadonlyArray<{ identifier: string; matchMax?: number }>, side: 0 | 1): void => {
		for (const choice of choices) {
			const matchMax = Number(choice.matchMax ?? 0);
			if (!(matchMax > 0)) continue;
			const count = pairs.filter((parts) => parts[side] === choice.identifier).length;
			if (count > matchMax) {
				errors.push(`Response '${responseId}' uses ${choice.identifier} in ${count} associations, more than matchMax=${matchMax}`);
			}
		}
	};
	checkMatchMax([...(interaction.gapTexts ?? []), ...(interaction.gapImages ?? [])], 0);
	checkMatchMax(interaction.hotspots ?? [], 1);
	return errors;
}

/**
 * The order-subset limits of an orderInteraction or graphicOrderInteraction (QTI ASI §5.73,
 * §5.42), read with the same rule the order renderers use; null for any other interaction.
 */
function orderInteractionLimits(interaction: {
	type?: string;
	minChoices?: number;
	maxChoices?: number;
	choices?: readonly unknown[];
	hotspotChoices?: readonly unknown[];
}): OrderChoiceLimits | null {
	const choices =
		interaction.type === 'orderInteraction'
			? interaction.choices
			: interaction.type === 'graphicOrderInteraction'
				? interaction.hotspotChoices
				: undefined;
	if (!choices) return null;
	return orderChoiceLimits({
		minChoices: interaction.minChoices,
		maxChoices: interaction.maxChoices,
		choiceCount: choices.length,
	});
}
