/**
 * The element vocabulary each QTI version defines, for checking authored element names without
 * an XSD engine. Built on the XSD-verified QTI 3.0 element map (`qti3-element-mappings.ts`),
 * which `qti3-xsd-conformance.test.ts` checks against the vendored QTI 3.0 ASI schema and the
 * QTI 2.2 schema; `vocabulary.test.ts` checks the QTI 2.x reading below against the QTI 2.2 schema.
 *
 * Only element names in the QTI namespace are QTI vocabulary. MathML, SSML, PCI, APIP, XInclude
 * and other foreign vocabularies keep their own namespaces and are not checked here.
 */
import { QTI3_HTML_ELEMENTS } from '../element-mapper/qti2-to-qti3.js';
import { QTI3_ELEMENT_MAPPINGS } from '../element-mapper/qti3-element-mappings.js';

/** The vocabularies distinguished here. QTI 2.0 and 2.1 items are checked against QTI 2.2's. */
export type QtiVocabularyVersion = '2.x' | '3.0';

/** XHTML elements the QTI 2.2 schema declares in its own namespace. */
export const QTI2_XHTML_ELEMENTS: ReadonlySet<string> = new Set(
	(
		'a abbr acronym address b bdo big blockquote br caption cite code col colgroup dd dfn div dl dt em ' +
		'h1 h2 h3 h4 h5 h6 hr i img kbd label li object ol p param pre q samp small span strong sub sup ' +
		'table tbody td tfoot th thead tr tt ul var'
	).split(' '),
);

/** QTI 3.0 elements with no QTI 2.2 counterpart, by canonical (lowercase) name. */
const QTI3_ONLY_CANONICAL_ELEMENTS: ReadonlySet<string> = new Set(
	(
		'contentbody contextdeclaration portablecustominteraction interactionmodules interactionmodule ' +
		'interactionmarkup catalog cataloginfo card cardentry htmlcontent filehref contextvariable ' +
		'templatevariable companionmaterialsinfo calculator calculatorinfo calculatortype description ' +
		'digitalmaterial physicalmaterial label protractor rule rulesystemsi rulesystemus incrementsi ' +
		'incrementus majorincrement minorincrement minimumlength adaptiveselection adaptiveengineref ' +
		'adaptivesettingsref metadataref usagedataref resourceicon'
	).split(' '),
);

/** QTI 2.2 elements that QTI 3.0 removed. */
const QTI2_ONLY_ELEMENTS: readonly string[] = ['infoControl'];

/** QTI 2.x names that are not the mechanical camelCase reading of their QTI 3.0 name. */
const QTI2_IRREGULAR_NAMES: Readonly<Record<string, string>> = {
	'qti-duration-gte': 'durationGTE',
	'qti-duration-lt': 'durationLT',
};

const qti2Name = (qti3Name: string): string =>
	QTI2_IRREGULAR_NAMES[qti3Name] ??
	qti3Name.slice('qti-'.length).replace(/-([a-z0-9])/g, (_match, character: string) => character.toUpperCase());

/** QTI-defined QTI 2.x element names, exactly as the QTI 2.2 schema spells them. */
export const QTI2_ELEMENTS: ReadonlySet<string> = new Set([
	...Object.entries(QTI3_ELEMENT_MAPPINGS)
		.filter(([, canonical]) => !QTI3_ONLY_CANONICAL_ELEMENTS.has(canonical))
		.map(([qti3Name]) => qti2Name(qti3Name)),
	...QTI2_ONLY_ELEMENTS,
]);

/** QTI-defined QTI 3.0 element names (`qti-*`), as the QTI 3.0 ASI schema declares them. */
export const QTI3_ELEMENTS: ReadonlySet<string> = new Set(Object.keys(QTI3_ELEMENT_MAPPINGS));

/**
 * Whether `localName` is an element the version's schema declares in the QTI namespace: a
 * QTI-defined element, or one of the HTML elements the schema admits there. Names are compared
 * exactly; XML element names are case-sensitive.
 */
export function isQtiVocabularyElement(localName: string, version: QtiVocabularyVersion): boolean {
	if (version === '3.0') return QTI3_ELEMENTS.has(localName) || QTI3_HTML_ELEMENTS.has(localName);
	return QTI2_ELEMENTS.has(localName) || QTI2_XHTML_ELEMENTS.has(localName);
}
