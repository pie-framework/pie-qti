/**
 * QTI 2.x → QTI 3.0 rename
 *
 * QTI 3.0 is QTI 2.2's information model under new names: `qti-` prefixed kebab-case elements,
 * kebab-case attributes, the `imsqtiasi_v3p0` namespace. `convertQti2ToQti3` applies that rename
 * to a QTI 2.x item, test or stimulus document, plus the three structural changes 3.0 makes to
 * what the generators emit:
 *
 * - `rubricBlock` content goes inside `qti-content-body`, after any `qti-stylesheet`, and the
 *   now-required `use` defaults to `scoring` for a scorer view, else `instructions`.
 * - Response-processing template URIs take their 3.0 form; the item player and other 3.0
 *   processors resolve them by file name.
 * - `xsi:schemaLocation` names the 3.0 ASI schema for the QTI namespace.
 *
 * The document is rewritten as a token stream, so markup, entities and whitespace outside tag
 * names and attribute names are kept byte for byte. HTML elements keep their names, as QTI 3
 * does. Foreign subtrees — MathML, SVG, any prefixed element and any element declaring another
 * default namespace — pass through untouched: Content MathML's `and`, `max` or `sum` would
 * otherwise collide with QTI expressions.
 *
 * Elements 3.0 has no counterpart for (`infoControl`) and APIP are not converted; the input is
 * expected to carry neither, and they come out unchanged.
 */

import { Qti3ElementNameMapper } from './Qti3ElementNameMapper.js';
import { QTI3_ATTRIBUTE_TO_QTI2 } from './qti3-attribute-map.js';

export const QTI3_NAMESPACE = 'http://www.imsglobal.org/xsd/imsqtiasi_v3p0';
export const QTI3_ASI_SCHEMA_LOCATION =
	'https://purl.imsglobal.org/spec/qti/v3p0/schema/xsd/imsqti_asiv3p0_v1p0.xsd';
export const QTI3_RPTEMPLATE_BASE = 'https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/';

const QTI2_NAMESPACES = new Set([
	'http://www.imsglobal.org/xsd/imsqti_v2p0',
	'http://www.imsglobal.org/xsd/imsqti_v2p1',
	'http://www.imsglobal.org/xsd/imsqti_v2p2',
]);

/** A QTI 2.x response-processing template URI; the file name is group 1. */
const QTI2_RPTEMPLATE = /^https?:\/\/www\.imsglobal\.org\/question\/qti_v2p[012]\/rptemplates\/([A-Za-z_]+?)(?:\.xml)?$/;

/** The HTML elements the QTI 3.0 ASI schema declares; they keep their names. */
export const QTI3_HTML_ELEMENTS: ReadonlySet<string> = new Set(
	(
		'a abbr acronym address article aside audio b bdi bdo big blockquote br caption cite code col ' +
		'colgroup dd details dfn div dl dt em figcaption figure footer h1 h2 h3 h4 h5 h6 header hr i img ' +
		'kbd label li nav object ol p param picture pre q rb rp rt rtc ruby samp section small source span ' +
		'strong sub summary sup table tbody td template tfoot th thead tr track tt ul var video'
	).split(' '),
);

/** Unprefixed roots of a foreign vocabulary. */
const FOREIGN_ROOTS = new Set(['math', 'svg']);

const elementMapper = new Qti3ElementNameMapper();

const QTI3_ATTRIBUTE_BY_QTI2 = new Map<string, string>();
for (const [kebab, camel] of QTI3_ATTRIBUTE_TO_QTI2) {
	if (QTI3_ATTRIBUTE_BY_QTI2.has(camel)) {
		throw new Error(`QTI 2 attribute "${camel}" has two QTI 3 names`);
	}
	QTI3_ATTRIBUTE_BY_QTI2.set(camel, kebab);
}

const START_TAG = /<([A-Za-z_][\w.:-]*)((?:\s+[^\s=>/]+\s*=\s*(?:"[^"]*"|'[^']*'))*)(\s*)(\/?)>/y;
const END_TAG = /<\/([A-Za-z_][\w.:-]*)\s*>/y;
const ATTRIBUTE = /(\s+)([^\s=>/]+)(\s*=\s*)(?:"([^"]*)"|'([^']*)')/g;

interface OpenElement {
	/** The name as written in the output. */
	name: string;
	/** A `qti-rubric-block` whose `qti-content-body` is open, or still to open. */
	rubric?: { opened: boolean };
}

/** The QTI 3.0 name of a QTI 2.x element; HTML and unknown names are kept. */
export function qti3ElementName(qti2Name: string): string {
	if (QTI3_HTML_ELEMENTS.has(qti2Name)) return qti2Name;
	const native = elementMapper.toNative(qti2Name.toLowerCase());
	return native.startsWith('qti-') ? native : qti2Name;
}

/** The QTI 3.0 name of a QTI 2.x attribute: kebab-case for a QTI camelCase name, else unchanged. */
export function qti3AttributeName(qti2Name: string): string {
	if (!/[A-Z]/.test(qti2Name) || qti2Name.includes(':') || qti2Name.startsWith('data-')) return qti2Name;
	return QTI3_ATTRIBUTE_BY_QTI2.get(qti2Name) ?? qti2Name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

/** A QTI 2.x response-processing template URI in its QTI 3.0 form; other URIs are kept. */
export function qti3TemplateUri(uri: string): string {
	const match = QTI2_RPTEMPLATE.exec(uri.trim());
	return match ? `${QTI3_RPTEMPLATE_BASE}${match[1]}.xml` : uri;
}

/** Convert a QTI 2.x item, test or stimulus document to QTI 3.0. */
export function convertQti2ToQti3(xml: string): string {
	const out: string[] = [];
	const stack: OpenElement[] = [];
	let foreignDepth = 0;
	let index = 0;
	let rootSeen = false;

	const rubric = (): OpenElement['rubric'] => stack[stack.length - 1]?.rubric;
	/** Open the rubric's content body before content that is not a leading stylesheet. */
	const openContentBody = (): void => {
		const open = rubric();
		if (open && !open.opened) {
			out.push('<qti-content-body>');
			open.opened = true;
		}
	};

	while (index < xml.length) {
		const lt = xml.indexOf('<', index);
		if (lt === -1) {
			out.push(xml.slice(index));
			break;
		}
		if (lt > index) {
			const text = xml.slice(index, lt);
			if (foreignDepth === 0 && text.trim()) openContentBody();
			out.push(text);
		}

		const special = specialToken(xml, lt);
		if (special !== undefined) {
			if (foreignDepth === 0 && !xml.startsWith('<?', lt) && !xml.startsWith('<!--', lt)) openContentBody();
			out.push(xml.slice(lt, special));
			index = special;
			continue;
		}

		END_TAG.lastIndex = lt;
		const end = END_TAG.exec(xml);
		if (end) {
			index = END_TAG.lastIndex;
			if (foreignDepth > 0) {
				foreignDepth -= 1;
				out.push(end[0]);
				continue;
			}
			const open = stack.pop();
			if (!open) throw new Error(`Unexpected </${end[1]}> at offset ${lt}`);
			if (open.rubric) out.push(open.rubric.opened ? '</qti-content-body>' : '<qti-content-body/>');
			out.push(`</${open.name}>`);
			continue;
		}

		START_TAG.lastIndex = lt;
		const start = START_TAG.exec(xml);
		if (!start) throw new Error(`Malformed markup at offset ${lt}`);
		index = START_TAG.lastIndex;
		const [tag, name, attrs, space, selfClosing] = start as unknown as [string, string, string, string, string];

		if (foreignDepth > 0) {
			if (!selfClosing) foreignDepth += 1;
			out.push(tag);
			continue;
		}
		if (isForeign(name, attrs)) {
			openContentBody();
			rootSeen = true;
			if (!selfClosing) foreignDepth = 1;
			out.push(tag);
			continue;
		}

		const qti3Name = qti3ElementName(name);
		if (qti3Name !== 'qti-stylesheet') openContentBody();
		const element: OpenElement = { name: qti3Name };
		let converted = convertAttributes(attrs, !rootSeen);
		rootSeen = true;
		if (qti3Name === 'qti-rubric-block') {
			converted = withRubricUse(converted);
			element.rubric = { opened: false };
		}
		if (selfClosing) {
			out.push(
				element.rubric
					? `<${qti3Name}${converted}><qti-content-body/></${qti3Name}>`
					: `<${qti3Name}${converted}${space}/>`,
			);
			continue;
		}
		out.push(`<${qti3Name}${converted}${space}>`);
		stack.push(element);
	}

	if (stack.length > 0 || foreignDepth > 0) {
		throw new Error(`Unclosed <${stack[stack.length - 1]?.name ?? 'element'}>`);
	}
	return out.join('');
}

/** The end offset of a comment, CDATA section, processing instruction or doctype at `at`. */
function specialToken(xml: string, at: number): number | undefined {
	const close = (marker: string, open: string): number => {
		const found = xml.indexOf(marker, at + open.length);
		if (found === -1) throw new Error(`Unterminated ${open} at offset ${at}`);
		return found + marker.length;
	};
	if (xml.startsWith('<!--', at)) return close('-->', '<!--');
	if (xml.startsWith('<![CDATA[', at)) return close(']]>', '<![CDATA[');
	if (xml.startsWith('<?', at)) return close('?>', '<?');
	if (xml.startsWith('<!', at)) return close('>', '<!');
	return undefined;
}

function isForeign(name: string, attrs: string): boolean {
	if (name.includes(':') || FOREIGN_ROOTS.has(name)) return true;
	for (const match of attrs.matchAll(ATTRIBUTE)) {
		if (match[2] === 'xmlns' && !QTI2_NAMESPACES.has((match[4] ?? match[5] ?? '').trim())) return true;
	}
	return false;
}

function convertAttributes(attrs: string, isRoot: boolean): string {
	return attrs.replace(ATTRIBUTE, (_match, lead: string, name: string, eq: string, dq?: string, sq?: string) => {
		const quote = dq === undefined ? "'" : '"';
		let value = dq ?? sq ?? '';
		if (name === 'xmlns' && QTI2_NAMESPACES.has(value.trim())) value = QTI3_NAMESPACE;
		else if (name === 'template') value = qti3TemplateUri(value);
		else if (isRoot && name === 'xsi:schemaLocation') value = qti3SchemaLocation(value);
		return `${lead}${qti3AttributeName(name)}${eq}${quote}${value}${quote}`;
	});
}

/** `xsi:schemaLocation` with the QTI 2.x namespace pair replaced by the 3.0 ASI schema. */
function qti3SchemaLocation(value: string): string {
	const parts = value.trim().split(/\s+/);
	const pairs: string[] = [];
	for (let i = 0; i + 1 < parts.length; i += 2) {
		const [namespace, location] = [parts[i] as string, parts[i + 1] as string];
		pairs.push(
			QTI2_NAMESPACES.has(namespace) ? `${QTI3_NAMESPACE} ${QTI3_ASI_SCHEMA_LOCATION}` : `${namespace} ${location}`,
		);
	}
	return pairs.join(' ');
}

/** A rubric block's attributes with `use`, which QTI 3.0 requires, defaulted from `view`. */
function withRubricUse(attrs: string): string {
	const names = [...attrs.matchAll(ATTRIBUTE)].map((match) => match[2]);
	if (names.includes('use')) return attrs;
	const view = [...attrs.matchAll(ATTRIBUTE)].find((match) => match[2] === 'view');
	const views = (view?.[4] ?? view?.[5] ?? '').split(/\s+/);
	return `${attrs} use="${views.includes('scorer') ? 'scoring' : 'instructions'}"`;
}
