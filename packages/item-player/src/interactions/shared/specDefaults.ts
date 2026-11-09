/**
 * Per-version QTI defaults for interaction attributes whose spec default changed between
 * QTI 2.1 and QTI 2.2, or that a response's cardinality constrains. See
 * docs/QTI_attribute_defaults.md for the audited table.
 */

import type { ExtractionContext } from '../../extraction/types.js';

/**
 * Whether the item predates QTI 2.2, whose information model and XSD changed several
 * interaction defaults (e.g. choiceInteraction `maxChoices` is 0 in 2.1, 1 in 2.2/3.0; the
 * gap match interactions gained `maxAssociations` in 2.2). An unknown or undetected version
 * follows the QTI 2.2 assumption `detectQtiVersion` makes for unversioned items.
 */
export function predatesQti22(context: Pick<ExtractionContext, 'config'>): boolean {
	const version = context.config.qtiVersion;
	return version === '2.0' || version === '2.1';
}

/**
 * The value an absent limit takes when its spec default is 0 (no restriction): 0, unless the
 * interaction is bound to a single-cardinality response, which holds one value. The spec only
 * allows a limit of 0 (or above 1) with a multiple-cardinality binding, so for a single binding
 * the one consistent limit is 1.
 */
export function unrestrictedLimitDefault(context: Pick<ExtractionContext, 'declarations' | 'responseId'>): number {
	return context.declarations.get(context.responseId)?.cardinality === 'single' ? 1 : 0;
}
