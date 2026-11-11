import { durationSeconds } from '@pie-qti/qti-processing';
import { inferBaseType } from './inferBaseType.js';
import type {
	AssessmentItemResult,
	AssessmentResultReport,
	AssessmentResultVersion,
	ResultBaseType,
	ResultCardinality,
	ResultDatestamp,
	ResultSessionStatus,
	ResultVariable,
} from './types.js';

/**
 * The QTI Results Reporting namespaces and schema locations, as the 1EdTech schemas declare them:
 * `imsqti_result_v2p2.xsd` (QTI 2.2) and `imsqti_resultv3p0_v1p0.xsd` (QTI 3.0). Both versions use
 * the same camelCase element and attribute names.
 */
export const ASSESSMENT_RESULT_NAMESPACES: Readonly<
	Record<AssessmentResultVersion, { readonly namespace: string; readonly schemaLocation: string }>
> = {
	'2.2': {
		namespace: 'http://www.imsglobal.org/xsd/imsqti_result_v2p2',
		schemaLocation: 'http://www.imsglobal.org/xsd/qti/qtiv2p2/imsqti_result_v2p2.xsd',
	},
	'3.0': {
		namespace: 'http://www.imsglobal.org/xsd/imsqti_result_v3p0',
		schemaLocation: 'https://purl.imsglobal.org/spec/qti/v3p0/schema/xsd/imsqti_resultv3p0_v1p0.xsd',
	},
};

export interface SerializeAssessmentResultOptions {
	readonly version: AssessmentResultVersion;
	/** Declare `xsi:schemaLocation` for the version's results schema. Default: true. */
	readonly schemaLocation?: boolean;
}

/** The report cannot be written as a schema-valid `assessmentResult` of the requested version. */
export class AssessmentResultSerializationError extends Error {
	constructor(message: string) {
		super(`[QTI results] ${message}`);
		this.name = 'AssessmentResultSerializationError';
	}
}

const BASE_TYPES: ReadonlySet<string> = new Set<ResultBaseType>([
	'boolean',
	'directedPair',
	'duration',
	'file',
	'float',
	'identifier',
	'integer',
	'pair',
	'point',
	'string',
	'uri',
]);
const CARDINALITIES: ReadonlySet<string> = new Set<ResultCardinality>(['single', 'multiple', 'ordered', 'record']);
const SESSION_STATUSES: Readonly<Record<AssessmentResultVersion, ReadonlySet<ResultSessionStatus>>> = {
	'2.2': new Set(['final', 'initial', 'pendingResponseProcessing', 'pendingSubmission']),
	'3.0': new Set(['final', 'initial', 'pendingExternalScoring', 'pendingResponseProcessing', 'pendingSubmission']),
};
const VIEWS: ReadonlySet<string> = new Set(['author', 'candidate', 'proctor', 'scorer', 'testConstructor', 'tutor']);

/** XML 1.0 (5th edition) NCName: a Name without colons. */
const NAME_START =
	'A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D' +
	'\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\u{10000}-\\u{EFFFF}';
const NCNAME = new RegExp(`^[${NAME_START}][${NAME_START}\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$`, 'u');

/**
 * Writes a QTI Results Reporting `assessmentResult` document. Every value and attribute is
 * XML-escaped (characters XML 1.0 cannot carry become U+FFFD); identifiers the version's schema
 * types as NCName, an unknown base type or cardinality, a session status the version lacks, or an
 * invalid date throw an `AssessmentResultSerializationError`. Durations are written as seconds,
 * the xsd:double form QTI defines.
 */
export function serializeAssessmentResult(
	report: AssessmentResultReport,
	options: SerializeAssessmentResultOptions,
): string {
	const { version } = options;
	const target = ASSESSMENT_RESULT_NAMESPACES[version];
	if (!target) throw new AssessmentResultSerializationError(`Unsupported results version "${String(version)}"`);

	const out = new XmlWriter();
	out.line('<?xml version="1.0" encoding="UTF-8"?>');
	const rootAttributes: Array<[string, string | undefined]> = [['xmlns', target.namespace]];
	if (options.schemaLocation !== false) {
		rootAttributes.push(
			['xmlns:xsi', 'http://www.w3.org/2001/XMLSchema-instance'],
			['xsi:schemaLocation', `${target.namespace} ${target.schemaLocation}`],
		);
	}
	out.open('assessmentResult', rootAttributes);

	const { sourcedId, sessionIdentifiers = [] } = report.context;
	const contextAttributes: Array<[string, string | undefined]> = [
		['sourcedId', sourcedId === undefined ? undefined : ncName(sourcedId, 'context sourcedId')],
	];
	if (sessionIdentifiers.length === 0) {
		out.empty('context', contextAttributes);
	} else {
		out.open('context', contextAttributes);
		for (const session of sessionIdentifiers) {
			out.empty('sessionIdentifier', [
				['sourceID', required(session.sourceID, 'sessionIdentifier sourceID')],
				['identifier', identifierFor(version, session.identifier, 'sessionIdentifier identifier')],
			]);
		}
		out.close('context');
	}

	if (report.testResult) {
		const test = report.testResult;
		const attributes: Array<[string, string | undefined]> = [
			['identifier', identifierFor(version, test.identifier, 'testResult identifier')],
			['datestamp', dateTime(test.datestamp, 'testResult datestamp')],
		];
		writeVariablesElement(out, 'testResult', attributes, test.variables, version);
	}

	for (const item of report.itemResults) writeItemResult(out, item, version);

	out.close('assessmentResult');
	return out.toString();
}

function writeItemResult(out: XmlWriter, item: AssessmentItemResult, version: AssessmentResultVersion): void {
	if (!SESSION_STATUSES[version].has(item.sessionStatus)) {
		throw new AssessmentResultSerializationError(
			`itemResult "${item.identifier}" has sessionStatus "${item.sessionStatus}", which QTI ${version} results do not define`,
		);
	}
	if (item.sequenceIndex !== undefined && !Number.isInteger(item.sequenceIndex)) {
		throw new AssessmentResultSerializationError(
			`itemResult "${item.identifier}" sequenceIndex must be an integer, not ${item.sequenceIndex}`,
		);
	}
	const attributes: Array<[string, string | undefined]> = [
		['identifier', identifierFor(version, item.identifier, 'itemResult identifier')],
		['sequenceIndex', item.sequenceIndex === undefined ? undefined : String(item.sequenceIndex)],
		['datestamp', dateTime(item.datestamp, `itemResult "${item.identifier}" datestamp`)],
		['sessionStatus', item.sessionStatus],
	];
	writeVariablesElement(out, 'itemResult', attributes, item.variables, version, item.candidateComment);
}

function writeVariablesElement(
	out: XmlWriter,
	name: 'testResult' | 'itemResult',
	attributes: Array<[string, string | undefined]>,
	variables: readonly ResultVariable[],
	version: AssessmentResultVersion,
	candidateComment?: string,
): void {
	const written = variables.filter((variable) => variable.kind !== 'context' || version === '3.0');
	if (written.length === 0 && candidateComment === undefined) {
		out.empty(name, attributes);
		return;
	}
	out.open(name, attributes);
	for (const variable of written) writeVariable(out, variable);
	if (candidateComment !== undefined) out.text('candidateComment', candidateComment, { normalized: false });
	out.close(name);
}

function writeVariable(out: XmlWriter, variable: ResultVariable): void {
	const where = `variable "${variable.identifier}"`;
	if (!CARDINALITIES.has(variable.cardinality)) {
		throw new AssessmentResultSerializationError(`${where} has unknown cardinality "${variable.cardinality}"`);
	}
	const record = variable.cardinality === 'record';
	if (!record && (!variable.baseType || !BASE_TYPES.has(variable.baseType))) {
		throw new AssessmentResultSerializationError(`${where} has unknown baseType "${String(variable.baseType)}"`);
	}
	const attributes: Array<[string, string | undefined]> = [
		['identifier', ncName(variable.identifier, `${where} identifier`)],
		['cardinality', variable.cardinality],
		['baseType', record ? undefined : variable.baseType],
	];

	switch (variable.kind) {
		case 'response': {
			if (variable.choiceSequence?.length) {
				attributes.push([
					'choiceSequence',
					variable.choiceSequence.map((id) => ncName(id, `${where} choiceSequence`)).join(' '),
				]);
			}
			out.open('responseVariable', attributes);
			const correct = valueElements(variable.correctResponse, variable, where);
			if (correct.length > 0) {
				out.open('correctResponse');
				for (const value of correct) out.text('value', value.text, { attributes: value.attributes });
				out.close('correctResponse');
			}
			writeValues(out, 'candidateResponse', valueElements(variable.value, variable, where));
			out.close('responseVariable');
			return;
		}
		case 'outcome': {
			const view = (variable.view ?? []).filter((role) => VIEWS.has(role));
			attributes.push(
				['view', view.length > 0 ? view.join(' ') : undefined],
				['interpretation', variable.interpretation],
				['longInterpretation', variable.longInterpretation],
				['normalMaximum', optionalDouble(variable.normalMaximum)],
				['normalMinimum', optionalDouble(variable.normalMinimum)],
				['masteryValue', optionalDouble(variable.masteryValue)],
			);
			writeValues(out, 'outcomeVariable', valueElements(variable.value, variable, where), attributes);
			return;
		}
		case 'template':
			writeValues(out, 'templateVariable', valueElements(variable.value, variable, where), attributes);
			return;
		case 'context':
			writeValues(out, 'contextVariable', valueElements(variable.value, variable, where), attributes);
			return;
	}
}

interface ValueElement {
	readonly text: string;
	readonly attributes?: Array<[string, string | undefined]>;
}

function writeValues(
	out: XmlWriter,
	name: string,
	values: readonly ValueElement[],
	attributes: Array<[string, string | undefined]> = [],
): void {
	if (values.length === 0) {
		out.empty(name, attributes);
		return;
	}
	out.open(name, attributes);
	for (const value of values) out.text('value', value.text, { attributes: value.attributes });
	out.close(name);
}

/** The `value` elements of a variable value: none for NULL, one per member of a container. */
function valueElements(
	raw: unknown,
	variable: Pick<ResultVariable, 'baseType' | 'cardinality'>,
	where: string,
): ValueElement[] {
	if (raw === null || raw === undefined) return [];
	if (variable.cardinality === 'record') return recordValueElements(raw, where);
	const baseType = variable.baseType as ResultBaseType;
	const members = variable.cardinality === 'single' ? [raw] : Array.isArray(raw) ? raw : [raw];
	const values: ValueElement[] = [];
	for (const member of members) {
		const text = formatValue(baseType, member);
		if (text !== null) values.push({ text });
	}
	return values;
}

/** A record's fields, each as a `value` carrying its fieldIdentifier and baseType. */
function recordValueElements(raw: unknown, where: string): ValueElement[] {
	if (typeof raw !== 'object' || Array.isArray(raw)) return [];
	const values: ValueElement[] = [];
	for (const [fieldIdentifier, field] of Object.entries(raw as Record<string, unknown>)) {
		// A serialized field is { baseType, cardinality, value }; a public one is the plain value.
		const serialized =
			field !== null && typeof field === 'object' && !Array.isArray(field) && 'value' in field;
		const fieldValue = serialized ? (field as { value: unknown }).value : field;
		if (fieldValue === null || fieldValue === undefined || Array.isArray(fieldValue)) continue;
		const declared = serialized ? (field as { baseType?: unknown }).baseType : undefined;
		const baseType =
			typeof declared === 'string' && BASE_TYPES.has(declared) ? (declared as ResultBaseType) : inferBaseType(fieldValue);
		const text = formatValue(baseType, fieldValue);
		if (text === null) continue;
		values.push({
			text,
			attributes: [
				['fieldIdentifier', ncName(fieldIdentifier, `${where} field identifier`)],
				['baseType', baseType],
			],
		});
	}
	return values;
}

/** A single value in its QTI lexical form, or null when there is nothing to write. */
function formatValue(baseType: ResultBaseType, value: unknown): string | null {
	if (value === null || value === undefined) return null;
	switch (baseType) {
		case 'boolean':
			if (typeof value === 'boolean') return value ? 'true' : 'false';
			if (value === 'true' || value === '1' || value === 1) return 'true';
			if (value === 'false' || value === '0' || value === 0) return 'false';
			return String(value);
		case 'integer':
			return typeof value === 'number' ? formatInteger(value) : String(value).trim();
		case 'float':
			return typeof value === 'number' ? formatDouble(value) : String(value).trim();
		case 'duration': {
			// QTI durations are seconds, written as xsd:double.
			const seconds = durationSeconds(value);
			return seconds === null ? String(value).trim() : formatDouble(seconds);
		}
		case 'pair':
		case 'directedPair':
			return String(value).trim().split(/\s+/).join(' ');
		case 'point':
			if (typeof value === 'object' && value !== null && 'x' in value && 'y' in value) {
				const { x, y } = value as { x: unknown; y: unknown };
				return `${String(x)} ${String(y)}`;
			}
			return String(value).trim().split(/\s+/).join(' ');
		case 'file':
			if (typeof value === 'object') {
				const file = value as { dataUrl?: unknown; name?: unknown };
				if (typeof file.dataUrl === 'string' && file.dataUrl) return file.dataUrl;
				if (typeof file.name === 'string' && file.name) return file.name;
				return null;
			}
			return String(value);
		default:
			return typeof value === 'object' ? JSON.stringify(value) : String(value);
	}
}

/** xsd:double: the shortest round-tripping decimal, INF, -INF or NaN. */
function formatDouble(value: number): string {
	if (Number.isNaN(value)) return 'NaN';
	if (value === Number.POSITIVE_INFINITY) return 'INF';
	if (value === Number.NEGATIVE_INFINITY) return '-INF';
	return String(value);
}

function formatInteger(value: number): string {
	if (!Number.isFinite(value)) return formatDouble(value);
	const integer = Math.trunc(value);
	return Number.isSafeInteger(integer) ? String(integer) : BigInt(integer).toString();
}

function optionalDouble(value: number | undefined): string | undefined {
	return value === undefined ? undefined : formatDouble(value);
}

function ncName(value: string, what: string): string {
	if (!NCNAME.test(value)) {
		throw new AssessmentResultSerializationError(`${what} "${value}" is not an NCName`);
	}
	return value;
}

/** Item, test and session identifiers are NCNames in QTI 3.0 results, normalized strings in 2.2. */
function identifierFor(version: AssessmentResultVersion, value: string, what: string): string {
	return version === '3.0' ? ncName(value, what) : required(value, what);
}

function required(value: string, what: string): string {
	if (typeof value !== 'string' || value.trim() === '') {
		throw new AssessmentResultSerializationError(`${what} is required`);
	}
	return value;
}

function dateTime(value: ResultDatestamp, what: string): string {
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) {
		throw new AssessmentResultSerializationError(`${what} "${String(value)}" is not a valid date-time`);
	}
	return date.toISOString();
}

/** Characters XML 1.0 can carry: tab, newline, carriage return, and #x20 upward minus surrogates and #xFFFE/#xFFFF. */
function xmlCharacters(value: string): string {
	let out = '';
	for (const character of value) {
		const code = character.codePointAt(0) as number;
		const allowed =
			code === 0x9 ||
			code === 0xa ||
			code === 0xd ||
			(code >= 0x20 && code <= 0xd7ff) ||
			(code >= 0xe000 && code <= 0xfffd) ||
			code >= 0x10000;
		out += allowed ? character : '\uFFFD';
	}
	return out;
}

/**
 * Escapes markup characters. `normalized` text (attributes, and `value`, an xs:normalizedString)
 * also writes tab and newline as character references, so a consumer that does not normalize
 * whitespace reads the original; a carriage return is always a reference, or XML end-of-line
 * handling would drop it.
 */
function escapeXml(value: string, { normalized, attribute }: { normalized: boolean; attribute: boolean }): string {
	let escaped = xmlCharacters(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/\r/g, '&#13;');
	if (attribute) escaped = escaped.replace(/"/g, '&quot;');
	if (normalized || attribute) escaped = escaped.replace(/\t/g, '&#9;').replace(/\n/g, '&#10;');
	return escaped;
}

class XmlWriter {
	private readonly lines: string[] = [];
	private depth = 0;

	line(text: string): void {
		this.lines.push(`${'  '.repeat(this.depth)}${text}`);
	}

	open(name: string, attributes: Array<[string, string | undefined]> = []): void {
		this.line(`<${name}${formatAttributes(attributes)}>`);
		this.depth++;
	}

	close(name: string): void {
		this.depth--;
		this.line(`</${name}>`);
	}

	empty(name: string, attributes: Array<[string, string | undefined]> = []): void {
		this.line(`<${name}${formatAttributes(attributes)}/>`);
	}

	text(
		name: string,
		value: string,
		{ attributes = [], normalized = true }: { attributes?: Array<[string, string | undefined]>; normalized?: boolean } = {},
	): void {
		this.line(`<${name}${formatAttributes(attributes)}>${escapeXml(value, { normalized, attribute: false })}</${name}>`);
	}

	toString(): string {
		return `${this.lines.join('\n')}\n`;
	}
}

function formatAttributes(attributes: Array<[string, string | undefined]>): string {
	return attributes
		.filter((attribute): attribute is [string, string] => attribute[1] !== undefined)
		.map(([name, value]) => ` ${name}="${escapeXml(value, { normalized: true, attribute: true })}"`)
		.join('');
}
