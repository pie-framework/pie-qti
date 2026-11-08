/**
 * QTI variable JSON at the PCI boundary (PCI v1.0 Appendix A, adopted by QTI 3.0 for
 * `qti-portable-custom-interaction`): `getResponse()` answers, and `getInstance` state is seeded,
 * in this binding. Single values wrap as `{"base": {"<baseType>": v}}`, multiple and ordered as
 * `{"list": {"<baseType>": [...]}}`, records as `{"record": [{"name", "base" | "list"}]}`.
 * pair, directedPair and point are two-element arrays, a duration is an ISO 8601 string, a file is
 * `{data, mime, name}`. The player's runtime values differ — pairs and points as "A B" strings,
 * durations as seconds, files as QTIFileResponse — so the conversion runs by base type in both
 * directions.
 */

import { describe, expect, it, mock } from 'bun:test';
import type { BaseType } from '@pie-qti/qti-processing';
import { Player } from '../core/Player.js';
import { fromQtiVariableJson, toQtiVariableJson } from '../pci/qtiVariableJson.js';
import { PCI_REGISTRY_GLOBAL } from '../pci/registry.js';
import type { ExtractedPci, PciModuleResolver, QtiPciInstance } from '../pci/types.js';

const FILE_A = {
	name: 'hello.txt',
	type: 'text/plain',
	size: 5,
	lastModified: 0,
	dataUrl: 'data:text/plain;base64,aGVsbG8=',
};
const FILE_A_JSON = { data: 'aGVsbG8=', mime: 'text/plain', name: 'hello.txt' };
const FILE_B = {
	name: 'pixel.png',
	type: 'image/png',
	size: 3,
	lastModified: 0,
	dataUrl: 'data:image/png;base64,AAEC',
};
const FILE_B_JSON = { data: 'AAEC', mime: 'image/png', name: 'pixel.png' };

/** Two runtime values per base type, with the spec JSON value each one binds to. */
const BASE_TYPE_CASES: Array<{ baseType: BaseType; values: Array<[runtime: unknown, json: unknown]> }> = [
	{ baseType: 'boolean', values: [[true, true], [false, false]] },
	{ baseType: 'integer', values: [[3, 3], [-7, -7]] },
	{ baseType: 'float', values: [[2.5, 2.5], [0.125, 0.125]] },
	{ baseType: 'string', values: [['hello', 'hello'], ['two words', 'two words']] },
	{ baseType: 'identifier', values: [['A', 'A'], ['choice_2', 'choice_2']] },
	{ baseType: 'uri', values: [['https://example.org/a', 'https://example.org/a'], ['urn:example:b', 'urn:example:b']] },
	{ baseType: 'pair', values: [['A B', ['A', 'B']], ['C D', ['C', 'D']]] },
	{ baseType: 'directedPair', values: [['S1 T2', ['S1', 'T2']], ['T2 S1', ['T2', 'S1']]] },
	{ baseType: 'point', values: [['10 20', [10, 20]], ['0 7', [0, 7]]] },
	{ baseType: 'duration', values: [[90, 'PT90S'], [0.5, 'PT0.5S']] },
	{ baseType: 'file', values: [[FILE_A, FILE_A_JSON], [FILE_B, FILE_B_JSON]] },
];

describe('QTI variable JSON: every base type and cardinality', () => {
	for (const { baseType, values } of BASE_TYPE_CASES) {
		const [[a, aJson], [b, bJson]] = values as [[unknown, unknown], [unknown, unknown]];

		it(`${baseType} single: player value to {"base"} and back`, () => {
			expect(toQtiVariableJson(a, baseType, 'single')).toEqual({ base: { [baseType]: aJson } });
			expect(fromQtiVariableJson({ base: { [baseType]: aJson } })).toEqual(a);
			expect(fromQtiVariableJson(toQtiVariableJson(b, baseType, 'single'))).toEqual(b);
		});

		for (const cardinality of ['multiple', 'ordered'] as const) {
			it(`${baseType} ${cardinality}: player value to {"list"} and back`, () => {
				expect(toQtiVariableJson([a, b], baseType, cardinality)).toEqual({ list: { [baseType]: [aJson, bJson] } });
				expect(fromQtiVariableJson({ list: { [baseType]: [aJson, bJson] } })).toEqual([a, b]);
				expect(fromQtiVariableJson(toQtiVariableJson([b, a], baseType, cardinality))).toEqual([b, a]);
			});
		}
	}

	it('round-trips spec JSON through the player value unchanged', () => {
		for (const { baseType, values } of BASE_TYPE_CASES) {
			const json = values.map(([, j]) => j);
			const single = { base: { [baseType]: json[0] } };
			const list = { list: { [baseType]: json } };
			expect(toQtiVariableJson(fromQtiVariableJson(single), baseType, 'single')).toEqual(single);
			expect(toQtiVariableJson(fromQtiVariableJson(list), baseType, 'multiple')).toEqual(list);
		}
	});

	it('maps NULL to null in both directions', () => {
		expect(toQtiVariableJson(null, 'identifier', 'single')).toBeNull();
		expect(toQtiVariableJson(undefined, 'pair', 'multiple')).toBeNull();
		expect(fromQtiVariableJson({ base: null })).toBeNull();
		expect(fromQtiVariableJson({ list: null })).toBeNull();
		expect(fromQtiVariableJson(null)).toBeNull();
		expect(fromQtiVariableJson(undefined)).toBeNull();
	});
});

describe('QTI variable JSON: records', () => {
	/** The player's typed record form: each field keeps its base type and cardinality. */
	const TYPED_RECORD = {
		ok: { baseType: 'boolean', cardinality: 'single', value: true },
		pick: { baseType: 'pair', cardinality: 'single', value: 'A B' },
		when: { baseType: 'duration', cardinality: 'single', value: 30 },
		tags: { baseType: 'string', cardinality: 'multiple', value: ['p', 'q'] },
		missing: { cardinality: 'single', value: null },
	};
	const SPEC_RECORD = {
		record: [
			{ name: 'ok', base: { boolean: true } },
			{ name: 'pick', base: { pair: ['A', 'B'] } },
			{ name: 'when', base: { duration: 'PT30S' } },
			{ name: 'tags', list: { string: ['p', 'q'] } },
			{ name: 'missing', base: null },
		],
	};

	it('binds a record as an array of named base/list members', () => {
		expect(toQtiVariableJson(TYPED_RECORD, undefined, 'record')).toEqual(SPEC_RECORD);
	});

	it('reads a spec record back keyed by member name, keeping each base type', () => {
		expect(fromQtiVariableJson(SPEC_RECORD)).toEqual(TYPED_RECORD);
	});

	it('round-trips a record in both directions', () => {
		expect(toQtiVariableJson(fromQtiVariableJson(SPEC_RECORD), undefined, 'record')).toEqual(SPEC_RECORD);
		expect(fromQtiVariableJson(toQtiVariableJson(TYPED_RECORD, undefined, 'record'))).toEqual(TYPED_RECORD);
	});

	it('infers member base types from plain field values', () => {
		expect(toQtiVariableJson({ score: 1, ratio: 0.5, text: 'why', flag: false, list: ['x'] }, undefined, 'record')).toEqual({
			record: [
				{ name: 'score', base: { integer: 1 } },
				{ name: 'ratio', base: { float: 0.5 } },
				{ name: 'text', base: { string: 'why' } },
				{ name: 'flag', base: { boolean: false } },
				{ name: 'list', list: { string: ['x'] } },
			],
		});
	});

	it('accepts runtime QTI values as record fields', () => {
		const fields = {
			a: { kind: 'value', baseType: 'identifier', cardinality: 'single', value: 'X' },
			b: { kind: 'null', baseType: 'integer', cardinality: 'single' },
		};
		expect(toQtiVariableJson(fields, undefined, 'record')).toEqual({
			record: [
				{ name: 'a', base: { identifier: 'X' } },
				{ name: 'b', base: null },
			],
		});
	});

	it('still accepts the earlier name-keyed record form on input', () => {
		expect(
			fromQtiVariableJson({ record: { a: { base: { integer: 1 } }, b: { list: { identifier: ['x', 'y'] } } } }),
		).toEqual({
			a: { baseType: 'integer', cardinality: 'single', value: 1 },
			b: { baseType: 'identifier', cardinality: 'multiple', value: ['x', 'y'] },
		});
	});

	it('skips a member without a name', () => {
		expect(fromQtiVariableJson({ record: [{ name: 'a', base: { integer: 1 } }, { name: null }] })).toEqual({
			a: { baseType: 'integer', cardinality: 'single', value: 1 },
		});
	});
});

describe('QTI variable JSON: compatibility and declaration fallback', () => {
	it('accepts the earlier player shapes for pairs, points and durations', () => {
		expect(fromQtiVariableJson({ base: { pair: 'A B' } })).toBe('A B');
		expect(fromQtiVariableJson({ list: { point: ['1 2'] } })).toEqual(['1 2']);
		expect(fromQtiVariableJson({ base: { duration: 90 } })).toBe(90);
		expect(fromQtiVariableJson('plain')).toBe('plain');
	});

	it('converts by the declared base type when the JSON names an unknown one', () => {
		expect(fromQtiVariableJson({ base: { custom: ['A', 'B'] } }, { baseType: 'pair', cardinality: 'single' })).toBe('A B');
	});
});

// ---------------------------------------------------------------------------
// Player integration: a conformant PCI's responses score, and restored values seed spec JSON
// ---------------------------------------------------------------------------

function pciItem(declaration: string, responseProcessing: string): string {
	return `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="pci-json" title="PCI JSON" adaptive="false" time-dependent="false">
  ${declaration}
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
    <qti-default-value><qti-value>0</qti-value></qti-default-value>
  </qti-outcome-declaration>
  <qti-item-body>
    <qti-portable-custom-interaction response-identifier="RESPONSE" custom-interaction-type-identifier="urn:example:json-pci">
      <qti-interaction-modules>
        <qti-interaction-module id="jsonModule" primary-path="pci/json.js"/>
      </qti-interaction-modules>
      <qti-interaction-markup><div class="json-pci"></div></qti-interaction-markup>
    </qti-portable-custom-interaction>
  </qti-item-body>
  <qti-response-processing>
    <qti-response-condition>
      <qti-response-if>
        ${responseProcessing}
        <qti-set-outcome-value identifier="SCORE"><qti-base-value base-type="float">1</qti-base-value></qti-set-outcome-value>
      </qti-response-if>
    </qti-response-condition>
  </qti-response-processing>
</qti-assessment-item>`;
}

const PAIR_ITEM = pciItem(
	`<qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="pair">
    <qti-correct-response><qti-value>A B</qti-value></qti-correct-response>
  </qti-response-declaration>`,
	`<qti-match><qti-variable identifier="RESPONSE"/><qti-correct identifier="RESPONSE"/></qti-match>`,
);

const RECORD_ITEM = pciItem(
	`<qti-response-declaration identifier="RESPONSE" cardinality="record"/>`,
	`<qti-and>
          <qti-match>
            <qti-field-value field-identifier="choice"><qti-variable identifier="RESPONSE"/></qti-field-value>
            <qti-base-value base-type="identifier">A</qti-base-value>
          </qti-match>
          <qti-match>
            <qti-field-value field-identifier="link"><qti-variable identifier="RESPONSE"/></qti-field-value>
            <qti-base-value base-type="pair">B C</qti-base-value>
          </qti-match>
        </qti-and>`,
);

const DURATION_ITEM = pciItem(
	`<qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="duration"/>`,
	`<qti-gte><qti-variable identifier="RESPONSE"/><qti-base-value base-type="duration">60</qti-base-value></qti-gte>`,
);

/** A PCI module answering `response` and recording the state each instantiation receives. */
function jsonModule(response: unknown) {
	const states: unknown[] = [];
	const resolver: PciModuleResolver = mock(async () => {
		(globalThis as any)[PCI_REGISTRY_GLOBAL]?.register({
			typeIdentifier: 'urn:example:json-pci',
			getInstance: (_dom: HTMLElement, _configuration: unknown, state?: unknown) => {
				states.push(state);
				return {
					getResponse: () => response,
					getState: () => undefined,
				} as unknown as QtiPciInstance;
			},
		});
		return {};
	});
	return { resolver, states };
}

async function mountPci(itemXml: string, response: unknown, seed?: Record<string, unknown>) {
	const module = jsonModule(response);
	const player = new Player({ itemXml, pci: { moduleResolver: module.resolver } });
	const host = player.createPciHost(player.getInteractionData()[0] as ExtractedPci);
	if (seed) player.setResponses(seed);
	await host.load();
	host.initialize({ appendChild: () => {} } as unknown as HTMLElement);
	return { player, host, states: module.states };
}

describe('Player with a conformant PCI', () => {
	it('stores a spec pair response as a pair and scores it', async () => {
		const { player } = await mountPci(PAIR_ITEM, { base: { pair: ['A', 'B'] } });
		expect(player.getResponses().RESPONSE).toBe('A B');
		expect(player.processResponses().score).toBe(1);
		player.destroy();
	});

	it('stores a spec record response by member name with its member base types', async () => {
		const { player } = await mountPci(RECORD_ITEM, {
			record: [
				{ name: 'choice', base: { identifier: 'A' } },
				{ name: 'link', base: { pair: ['B', 'C'] } },
				{ name: 'tags', list: { identifier: ['x', 'y'] } },
			],
		});
		expect(player.getResponses().RESPONSE).toEqual({ choice: 'A', link: 'B C', tags: ['x', 'y'] });
		expect(player.processResponses().score).toBe(1);
		player.destroy();
	});

	it('stores a spec ISO 8601 duration response in seconds', async () => {
		const { player } = await mountPci(DURATION_ITEM, { base: { duration: 'PT1M30S' } });
		expect(player.getResponses().RESPONSE).toBe(90);
		expect(player.processResponses().score).toBe(1);
		player.destroy();
	});

	it('seeds a restored pair and duration as spec JSON state', async () => {
		const pair = await mountPci(PAIR_ITEM, undefined, { RESPONSE: 'A B' });
		expect(pair.states[0]).toEqual({ base: { pair: ['A', 'B'] } });
		pair.player.destroy();

		const duration = await mountPci(DURATION_ITEM, undefined, { RESPONSE: 90 });
		expect(duration.states[0]).toEqual({ base: { duration: 'PT90S' } });
		duration.player.destroy();
	});

	it('seeds a restored record as spec JSON state, keeping member base types', async () => {
		const { player, states } = await mountPci(RECORD_ITEM, undefined);
		player.restoreResponses({
			RESPONSE: {
				choice: { baseType: 'identifier', cardinality: 'single', value: 'A' },
				link: { baseType: 'pair', cardinality: 'single', value: 'B C' },
			},
		});
		// No renderer is wired, so the host re-instantiates the module with the restored state.
		expect(states.at(-1)).toEqual({
			record: [
				{ name: 'choice', base: { identifier: 'A' } },
				{ name: 'link', base: { pair: ['B', 'C'] } },
			],
		});
		player.destroy();
	});
});
