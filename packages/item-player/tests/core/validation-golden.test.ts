/**
 * Validation golden: today's response validation, pinned so that reorganizing the session engine
 * can prove it changes nothing.
 *
 * Covered: every clean-room conformance fixture (`tests/conformance/fixtures`), as authored in
 * QTI 2.2 and converted to QTI 3.0; an item whose interaction a vendor extractor delivers under
 * its own `outputType`; and the interactions validation special-cases today (media `minPlays`,
 * XHTML extended text, end attempt). acme-likert, a vendor extractor that delivers
 * `choiceInteraction` with its own data, sits downstream of this package, so its golden lives in
 * `packages/acme-likert-plugin/tests`.
 *
 * Each item is validated with a set of probes — no responses, each fixture case's responses, and
 * every bound response given the wrong cardinality, which exercises the generic shape checks every
 * interaction gets — through two channels:
 *
 * - `engine`: the session engine's `validateResponses` and `isAttempted` on the raw responses;
 * - `session`: what a host sees through the public session API once the same responses are set
 *   (and coerced): `canSubmit`, the serialized `validationMessages`, and the issues of the
 *   end-attempt gate (`endAttempt` with `validateResponses`), which reports an incomplete required
 *   response only when the responses count as attempted.
 *
 * The golden (`validation-golden.json`) is sorted JSON, one line per validation entry. Errors and
 * issues are sorted, because `shuffle` makes extraction order differ per session. A QTI 3.0 record
 * identical to its QTI 2.2 one reads "same as qti22". A failure prints a line diff of the item that
 * changed. After an intended change, regenerate it and review the diff:
 *
 *     UPDATE_VALIDATION_GOLDEN=1 bun test tests/core/validation-golden.test.ts
 */

import { afterAll, beforeAll, describe, expect, spyOn, test } from 'bun:test';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { convertQti2ToQti3, Qti2xElementNameMapper } from '@pie-qti/qti-common';
import {
	type AssessmentItemDefinition,
	type AssessmentItemDefinitionPlugin,
	createAssessmentItemDefinition,
} from '../../src/core/AssessmentItemDefinition.js';
import { Player } from '../../src/core/Player.js';
import {
	createExtractionRegistry,
	type ExtractionRegistry,
	registerFrameworkDeliveryFields,
} from '../../src/extraction/ExtractionRegistry.js';
import type { ElementExtractor } from '../../src/extraction/types.js';
import { getStandardInteractionModules } from '../../src/interactions/modules.js';
import type { ResponseValidationResult } from '../../src/types/responseValidation.js';

const GOLDEN_PATH = join(import.meta.dir, 'validation-golden.json');
const FIXTURES_ROOT = join(import.meta.dir, '../conformance/fixtures');
const UPDATE = process.env.UPDATE_VALIDATION_GOLDEN === '1';
const UPDATE_HINT = 'UPDATE_VALIDATION_GOLDEN=1 bun test tests/core/validation-golden.test.ts';
/** Compliance findings are reported elsewhere; here they would only flood the output. */
const QUIET = { logDeviations: false } as const;

type Responses = Record<string, unknown>;

interface Probe {
	readonly name: string;
	readonly responses: Responses;
}

interface Golden {
	fixtures: Record<string, Record<string, unknown>>;
	items: Record<string, Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Items beyond the fixtures
// ---------------------------------------------------------------------------

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

/** A choiceInteraction a vendor extractor delivers as `acmeConfidenceInteraction`, beside a standard one. */
const VENDOR_OUTPUT_TYPE_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem ${NS} identifier="golden-vendor-output-type" title="Vendor outputType" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="CONFIDENCE" cardinality="single" baseType="identifier"/>
  <responseDeclaration identifier="NOTE" cardinality="single" baseType="string"/>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
  <itemBody>
    <choiceInteraction responseIdentifier="CONFIDENCE" class="acme-confidence" minChoices="1" maxChoices="1">
      <prompt>How sure are you?</prompt>
      <simpleChoice identifier="LOW">Low</simpleChoice>
      <simpleChoice identifier="MID">Medium</simpleChoice>
      <simpleChoice identifier="HIGH">High</simpleChoice>
    </choiceInteraction>
    <p>Why? <textEntryInteraction responseIdentifier="NOTE"/></p>
  </itemBody>
</assessmentItem>`;

const CONFIDENCE_EXTRACTOR: ElementExtractor<
	{ levels: Array<{ identifier: string; label: string }>; minChoices: number; scale: 'confidence' },
	'acmeConfidenceInteraction'
> = {
	id: 'golden:acme-confidence',
	name: 'Golden ACME confidence scale',
	priority: 1000,
	elementTypes: ['choiceInteraction'],
	outputType: 'acmeConfidenceInteraction',
	canHandle: (element, context) =>
		context.utils.getAttribute(element, 'class', '').split(/\s+/).includes('acme-confidence'),
	extract: (element, context) => ({
		levels: context.utils.getChildrenByTag(element, 'simpleChoice').map((choice) => ({
			identifier: context.utils.getAttribute(choice, 'identifier', ''),
			label: context.utils.getTextContent(choice),
		})),
		minChoices: Number(context.utils.getAttribute(element, 'minChoices', '0')),
		scale: 'confidence',
	}),
};

const CONFIDENCE_PLUGIN: AssessmentItemDefinitionPlugin = {
	kind: 'assessment-item-definition-plugin',
	name: 'golden-acme-confidence',
	version: '1.0.0',
	registerExtractors: (registry) => registry.register(CONFIDENCE_EXTRACTOR),
};

/** The extraction registry a definition with CONFIDENCE_PLUGIN compiles, for the engine channel. */
function confidenceRegistry(): ExtractionRegistry {
	const registry = createExtractionRegistry(new Qti2xElementNameMapper());
	for (const module of getStandardInteractionModules()) {
		registry.register(module.extractor);
		registerFrameworkDeliveryFields(registry, module.type, module.delivery);
	}
	registry.register(CONFIDENCE_EXTRACTOR);
	return registry.seal();
}

/** The interactions response validation special-cases today. */
const SPECIAL_CASES_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem ${NS} identifier="golden-special-cases" title="Validation special cases" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="MEDIA" cardinality="single" baseType="integer"/>
  <responseDeclaration identifier="ESSAY" cardinality="multiple" baseType="string"/>
  <responseDeclaration identifier="HINT" cardinality="single" baseType="boolean"/>
  <itemBody>
    <mediaInteraction responseIdentifier="MEDIA" minPlays="2" maxPlays="0" autostart="false" loop="false">
      <audio><source src="clip.mp3" type="audio/mpeg"/></audio>
    </mediaInteraction>
    <extendedTextInteraction responseIdentifier="ESSAY" format="xhtml" minStrings="1" maxStrings="2"/>
    <endAttemptInteraction responseIdentifier="HINT" title="Hint" countAttempt="false"/>
  </itemBody>
</assessmentItem>`;

const SPECIAL_CASES_PROBES: readonly Probe[] = [
	{ name: 'media not played', responses: { MEDIA: 0 } },
	{ name: 'media played once', responses: { MEDIA: 1 } },
	{ name: 'media played twice', responses: { MEDIA: 2 } },
	{ name: 'essay holding only markup', responses: { ESSAY: ['<p>&nbsp;</p>', '<p></p>'] } },
	{ name: 'essay over maxStrings', responses: { ESSAY: ['<p>one</p>', '<p>two</p>', '<p>three</p>'] } },
	{ name: 'media and essay complete', responses: { MEDIA: 2, ESSAY: ['<p>one</p>'] } },
	{ name: 'hint only', responses: { HINT: true } },
];

const VENDOR_PROBES: readonly Probe[] = [
	{ name: 'vendor interaction answered', responses: { CONFIDENCE: 'HIGH' } },
	{ name: 'standard interaction answered', responses: { NOTE: 'because' } },
	{ name: 'both answered', responses: { CONFIDENCE: 'HIGH', NOTE: 'because' } },
];

// ---------------------------------------------------------------------------
// Probes and channels
// ---------------------------------------------------------------------------

/** Every bound response given the other cardinality: arrays for single and record, a scalar for containers. */
function wrongCardinality(player: Player): Responses {
	const declarations = player.getDeclarations();
	const responses: Responses = {};
	for (const id of Object.keys(player.validateResponses({}).entries).sort()) {
		const cardinality = declarations[id]?.cardinality;
		if (cardinality === 'single') responses[id] = ['golden-a', 'golden-b'];
		else if (cardinality === 'multiple' || cardinality === 'ordered') responses[id] = 'golden-a';
		else if (cardinality === 'record') responses[id] = ['golden-a'];
	}
	return responses;
}

function probesFor(player: Player, probes: readonly Probe[]): Probe[] {
	return [
		{ name: '(no responses)', responses: {} },
		...probes,
		{ name: '(wrong cardinality)', responses: wrongCardinality(player) },
	];
}

/**
 * One line per entry — `interactionType, required|optional, complete|incomplete, valid|invalid` —
 * followed by its errors and warnings when it has any.
 */
function entriesOf(validation: ResponseValidationResult): Record<string, string | string[]> {
	return Object.fromEntries(
		Object.keys(validation.entries)
			.sort()
			.map((id) => {
				const entry = validation.entries[id]!;
				const summary = [
					entry.interactionType,
					entry.required ? 'required' : 'optional',
					entry.complete ? 'complete' : 'incomplete',
					entry.valid ? 'valid' : 'invalid',
				].join(', ');
				const details = [
					...[...entry.errors].sort().map((error) => `error: ${error}`),
					...[...entry.warnings].sort().map((warning) => `warning: ${warning}`),
				];
				return [id, details.length > 0 ? [summary, ...details] : summary];
			}),
	);
}

/** Issues as `responseId code`; their messages are in the entries' errors. */
function issueCodes(issues: ResponseValidationResult['issues']): string[] {
	return issues
		.map((issue) => `${issue.responseId} ${issue.code}${issue.severity === 'error' ? '' : ` (${issue.severity})`}`)
		.sort();
}

function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function engineChannel(player: Player, responses: Responses): unknown {
	try {
		const validation = player.validateResponses(responses);
		return {
			attempted: player.isAttempted(responses),
			entries: entriesOf(validation),
			issues: issueCodes(validation.issues),
		};
	} catch (error) {
		return { error: messageOf(error) };
	}
}

/**
 * The session view: `canSubmit`, the serialized validation issues, and the issues of the
 * end-attempt gate (none means it accepted the attempt). An entry is invalid exactly when it has
 * an issue, so an empty list reads "valid".
 */
function sessionChannel(definition: AssessmentItemDefinition, responses: Responses): unknown {
	let session: ReturnType<AssessmentItemDefinition['openSession']> | undefined;
	try {
		session = definition.openSession({ responses });
		const canSubmit = session.state().canSubmit;
		const issues = issueCodes(session.serialize().validationMessages);
		const gate = session.dispatch({ action: 'endAttempt', validateResponses: true }).result?.validation;
		return { canSubmit, issues, gateIssues: gate ? issueCodes(gate.issues) : null };
	} catch (error) {
		return { error: messageOf(error) };
	} finally {
		session?.dispose();
	}
}

function recordItem(options: {
	itemXml: string;
	seed?: number;
	probes: readonly Probe[];
	vendor?: boolean;
}): Record<string, unknown> {
	const { itemXml, seed = 42, vendor = false } = options;
	let player: Player;
	let definition: AssessmentItemDefinition;
	try {
		player = new Player({
			itemXml,
			seed,
			strictQtiCompliance: QUIET,
			...(vendor ? { extractionRegistry: confidenceRegistry() } : {}),
		});
		definition = createAssessmentItemDefinition({
			itemXml,
			seed,
			strictQtiCompliance: QUIET,
			...(vendor ? { plugins: [CONFIDENCE_PLUGIN] } : {}),
		});
	} catch (error) {
		return { error: messageOf(error) };
	}
	try {
		const probes: Record<string, unknown> = {};
		for (const probe of probesFor(player, options.probes)) {
			let key = probe.name;
			for (let n = 2; key in probes; n += 1) key = `${probe.name} #${n}`;
			probes[key] = {
				engine: engineChannel(player, probe.responses),
				session: sessionChannel(definition, probe.responses),
			};
		}
		return { probes };
	} finally {
		player.destroy();
	}
}

// ---------------------------------------------------------------------------
// Golden comparison
// ---------------------------------------------------------------------------

/** Objects with sorted keys, so the serialized golden is stable and reviewable. */
function sortDeep(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sortDeep);
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.keys(value as Record<string, unknown>)
				.sort()
				.map((key) => [key, sortDeep((value as Record<string, unknown>)[key])]),
		);
	}
	return value;
}

function serialize(value: unknown): string {
	return `${JSON.stringify(sortDeep(value), null, 2)}\n`;
}

/** The QTI 2.2 and converted QTI 3.0 records, the latter as "same as qti22" when they agree. */
function byVersion(qti22: Record<string, unknown>, qti30: Record<string, unknown>): Record<string, unknown> {
	return { qti22, qti30: serialize(qti30) === serialize(qti22) ? 'same as qti22' : qti30 };
}

/** One `path › to › leaf: value` line per leaf, so every line of a diff says where it is. */
function flatten(value: unknown, path: string[] = [], out: string[] = []): string[] {
	if (value && typeof value === 'object' && !Array.isArray(value)) {
		for (const key of Object.keys(value as Record<string, unknown>).sort()) {
			flatten((value as Record<string, unknown>)[key], [...path, key], out);
		}
	} else {
		out.push(`${path.join(' › ')}: ${JSON.stringify(value)}`);
	}
	return out;
}

/** The lines only `expected` has (-) and only `actual` has (+), in order, removals first. */
function lineDiff(expected: readonly string[], actual: readonly string[]): string {
	const lcs: number[][] = Array.from({ length: expected.length + 1 }, () =>
		new Array<number>(actual.length + 1).fill(0),
	);
	for (let i = expected.length - 1; i >= 0; i -= 1) {
		for (let j = actual.length - 1; j >= 0; j -= 1) {
			lcs[i]![j] =
				expected[i] === actual[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
		}
	}
	const out: string[] = [];
	let i = 0;
	let j = 0;
	while (i < expected.length || j < actual.length) {
		if (i < expected.length && j < actual.length && expected[i] === actual[j]) {
			i += 1;
			j += 1;
		} else if (i < expected.length && (j >= actual.length || lcs[i + 1]![j]! >= lcs[i]![j + 1]!)) {
			out.push(`- ${expected[i]}`);
			i += 1;
		} else {
			out.push(`+ ${actual[j]}`);
			j += 1;
		}
	}
	return out.join('\n');
}

const golden: Golden | undefined = existsSync(GOLDEN_PATH)
	? (JSON.parse(readFileSync(GOLDEN_PATH, 'utf8')) as Golden)
	: undefined;
const computed: Golden = { fixtures: {}, items: {} };

function expectGolden(section: keyof Golden, key: string, record: Record<string, unknown>): void {
	computed[section][key] = record;
	if (UPDATE) return;
	const expected = golden?.[section]?.[key];
	if (expected === undefined) {
		throw new Error(`No golden entry for ${section}/${key}. Generate it with ${UPDATE_HINT} and review the diff.`);
	}
	if (serialize(expected) !== serialize(record)) {
		throw new Error(
			`Validation of ${section}/${key} changed (- golden, + now):\n` +
				`${lineDiff(flatten(expected), flatten(sortDeep(record)))}\n\n` +
				`If the change is intended, regenerate the golden with ${UPDATE_HINT} and review the diff.`,
		);
	}
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

interface FixtureCases {
	seed?: number;
	cases: Array<{ name: string; responses: Responses }>;
}

const fixtureNames = readdirSync(FIXTURES_ROOT, { withFileTypes: true })
	.filter((entry) => entry.isDirectory())
	.map((entry) => entry.name)
	.sort();

const consoleSpies: Array<{ mockRestore(): void }> = [];

beforeAll(() => {
	// Template-processing and MAXSCORE notices would print once per probe session.
	consoleSpies.push(spyOn(console, 'warn').mockImplementation(() => {}));
	consoleSpies.push(spyOn(console, 'info').mockImplementation(() => {}));
});

afterAll(() => {
	for (const spy of consoleSpies.splice(0)) spy.mockRestore();
	if (!UPDATE) return;
	const complete =
		Object.keys(computed.fixtures).length === fixtureNames.length &&
		['specialCases', 'vendorOutputType'].every((key) => key in computed.items);
	if (!complete) {
		throw new Error('Refusing to write a partial validation golden: run the whole file, without a test filter.');
	}
	writeFileSync(GOLDEN_PATH, serialize(computed));
});

describe('validation golden', () => {
	test('covers every conformance fixture, and only those', () => {
		if (UPDATE) return;
		expect(Object.keys(golden?.fixtures ?? {}).sort()).toEqual(fixtureNames);
	});

	test.each(fixtureNames)('fixture %s', (name) => {
		const itemXml = readFileSync(join(FIXTURES_ROOT, name, 'item.xml'), 'utf8');
		const { seed, cases } = JSON.parse(readFileSync(join(FIXTURES_ROOT, name, 'cases.json'), 'utf8')) as FixtureCases;
		const probes = cases.map((entry) => ({ name: entry.name, responses: entry.responses }));
		let qti30: Record<string, unknown>;
		try {
			qti30 = recordItem({ itemXml: convertQti2ToQti3(itemXml), seed, probes });
		} catch (error) {
			qti30 = { error: `conversion failed: ${messageOf(error)}` };
		}
		expectGolden('fixtures', name, byVersion(recordItem({ itemXml, seed, probes }), qti30));
	});

	test('the interactions validation special-cases (QTI 2.2 and 3.0)', () => {
		expectGolden(
			'items',
			'specialCases',
			byVersion(
				recordItem({ itemXml: SPECIAL_CASES_ITEM, probes: SPECIAL_CASES_PROBES }),
				recordItem({ itemXml: convertQti2ToQti3(SPECIAL_CASES_ITEM), probes: SPECIAL_CASES_PROBES }),
			),
		);
	});

	test('an interaction delivered under a vendor outputType', () => {
		expectGolden('items', 'vendorOutputType', {
			qti22: recordItem({ itemXml: VENDOR_OUTPUT_TYPE_ITEM, probes: VENDOR_PROBES, vendor: true }),
		});
	});
});
