/**
 * QTI 3.0 §6.3 Catalog types.
 * A CatalogIndex maps card identifiers to their CatalogCard.
 * Cards hold multiple CatalogEntry records, one per usage/language combination.
 */

export type CatalogIndex = Map<string, CatalogCard>;

export interface CatalogCard {
	entries: CatalogEntry[];
}

export interface CatalogEntry {
	/**
	 * QTI 3.0 catalog usage type.
	 * The 8 standard types are listed below; additional string values are accepted
	 * for forward-compatibility and host-defined extensions.
	 */
	usage:
		| 'glossary-on-screen'
		| 'keyword-translation'
		| 'illustrated-glossary'
		| 'tts-pronunciation'
		| 'signing-definition'
		| 'braille-text'
		| 'audio-description'
		| 'extended-description'
		| string;
	/** xml:lang value (e.g. 'en-US', 'es'). Undefined when no language is specified. */
	lang?: string;
	/**
	 * Inner HTML from <qti-html-content>, or the src URL from <qti-file-href>.
	 * For illustrated-glossary entries the player checks whether this looks like a URL
	 * and renders an <img> instead of innerHTML.
	 */
	html: string;
}
