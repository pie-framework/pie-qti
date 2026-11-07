/** Blocks of running text an inline interaction can sit in. */
const SENTENCE_CONTAINERS =
	'p, li, dt, dd, td, th, caption, figcaption, blockquote, h1, h2, h3, h4, h5, h6, legend, summary';

/**
 * The id of the sentence or paragraph an inline interaction's slot sits in, which describes the
 * blank to assistive technology ("The capital of France is …"), giving that element an id from
 * `nextId` when it has none. Undefined when the slot is in no such block inside `root`.
 */
export function sentenceContextId(
	slot: Element,
	root: Element,
	nextId: () => string
): string | undefined {
	const context = slot.parentElement?.closest(SENTENCE_CONTAINERS);
	if (!context || context === root || !root.contains(context)) return undefined;
	if (!context.id) context.id = nextId();
	return context.id;
}
