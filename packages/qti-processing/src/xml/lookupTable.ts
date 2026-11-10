import type { ElementNameMapper } from '@pie-qti/qti-common';
import type { InterpolationTableDef, MatchTableDef } from '../runtime/types.js';
import { findDescendants, getAttr } from './traverse.js';

/**
 * The lookup table attached to an `outcomeDeclaration`, read the way the QTI
 * spec paths it: from the authored declaration element, through a name mapper
 * for the item's QTI version (required — there is no version-neutral spelling),
 * with every value trimmed and kept in its lexical form. Coercion to the
 * outcome's base type happens in `lookupOutcomeValue`, not here.
 */

/** Parse an outcome declaration's `<matchTable>`: exact source matches, lexical targets. */
export function parseMatchTableDeclaration(el: Element, mapper: ElementNameMapper): MatchTableDef {
	return {
		kind: 'table.matchTable',
		defaultValue: (getAttr(el, 'defaultValue') || '').trim() || undefined,
		entries: findDescendants(el, mapper.toNative('matchtableentry')).map((e) => ({
			sourceValue: (getAttr(e, 'sourceValue') || '').trim(),
			targetValue: (getAttr(e, 'targetValue') || '').trim(),
		})),
	};
}

/**
 * Parse an outcome declaration's `<interpolationTable>`: entries in document
 * order with numeric sources (non-numeric sources dropped), lexical targets,
 * and `includeBoundary` true unless authored `"false"`.
 */
export function parseInterpolationTableDeclaration(
	el: Element,
	mapper: ElementNameMapper,
): InterpolationTableDef {
	return {
		kind: 'table.interpolationTable',
		defaultValue: (getAttr(el, 'defaultValue') || '').trim() || undefined,
		entries: findDescendants(el, mapper.toNative('interpolationtableentry'))
			.map((e) => ({
				sourceValue: Number((getAttr(e, 'sourceValue') || '').trim() || Number.NaN),
				targetValue: (getAttr(e, 'targetValue') || '').trim(),
				includeBoundary: (getAttr(e, 'includeBoundary') || '').trim() !== 'false',
			}))
			.filter((e) => Number.isFinite(e.sourceValue)),
	};
}
