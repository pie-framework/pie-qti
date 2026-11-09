import type { AttributeNameMapper } from '@pie-qti/qti-common';

/**
 * Read an element's response binding: the one helper behind interaction
 * discovery (extraction), slot hiding and diagnostics.
 *
 * It accepts the union of spellings an item may bind a response with — the
 * mapper-native name when a mapper is given, plus the QTI 2 `responseIdentifier`
 * and QTI 3 `response-identifier` forms — and reads them case-insensitively on
 * HTML trees (node-html-parser folds attribute names), case-sensitively on XML
 * trees. The value is returned as authored: trimming is a caller's choice
 * (diagnostics trim; extraction and slot hiding keep the authored form).
 *
 * The three call sites stay separate predicates on purpose — slot hiding,
 * extraction and diagnostics differ in defaults and in what a missing binding
 * means — they only share this vocabulary.
 */
export function readResponseIdentifier(
	element: { getAttribute?: (name: string) => string | null | undefined },
	attributeNameMapper?: AttributeNameMapper,
): string | undefined {
	const names = ['responseIdentifier'];
	const native = attributeNameMapper?.toNative('responseIdentifier');
	if (native && native !== 'responseIdentifier') names.push(native);
	names.push('response-identifier');
	for (const name of names) {
		const value = element.getAttribute?.(name);
		if (value) return value;
	}
	return undefined;
}
