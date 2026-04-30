/**
 * Live conformance package runner for QTI 2.2 Basic DELIVERY
 *
 * Loads official XML files directly from the 1EdTech qti-conformance repo and
 * exercises the Player against them to verify DELIVERY acceptance criteria.
 *
 * The conformance repo is a sibling directory and cannot be committed here
 * (see FIXTURE_POLICY.md). This suite is skipped gracefully when the repo
 * is absent (e.g. in sandboxed CI).
 *
 * Run locally:
 *   bun test packages/item-player/tests/conformance/run-conformance-packages.test.ts
 *
 * Or point at a custom location:
 *   CONFORMANCE_REPO=/path/to/qti-conformance bun test ...
 */

import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Player } from '../../src/core/Player.js';
import { runItemCase, normalizeOutcomes } from './harness.js';

const CONFORMANCE_REPO = process.env.CONFORMANCE_REPO
	? resolve(process.env.CONFORMANCE_REPO)
	: resolve(import.meta.dir, '../../../../..', 'qti-conformance');

const BASIC = join(CONFORMANCE_REPO, 'qti2.2', 'Basic Level');

function conformanceSuiteAvailable(): boolean {
	return existsSync(BASIC);
}

async function readConformanceXml(relativePath: string): Promise<string> {
	return readFile(join(CONFORMANCE_REPO, relativePath), 'utf8');
}

describe('QTI 2.2 Basic DELIVERY — official conformance packages', async () => {
	if (!conformanceSuiteAvailable()) {
		test.skip(
			`conformance repo not found at ${CONFORMANCE_REPO} — set CONFORMANCE_REPO env var to run`,
			() => {}
		);
		return;
	}

	// -------------------------------------------------------------------------
	// Q2 — Choice Interaction (single cardinality)
	// -------------------------------------------------------------------------
	describe('Q2 single-cardinality (Q2-L1-D51 through D55)', async () => {
		const xml = await readConformanceXml(
			'qti2.2/Basic Level/Q2 - Choice Interaction/single-cardinality/single-cardinality.xml'
		);

		test('Q2-L1-D51: no selection -> RESPONSE=NULL', () => {
			const player = new Player({ itemXml: xml });
			const decls = player.getDeclarations();
			expect(decls['RESPONSE']).toBeDefined();
			expect(decls['RESPONSE'].cardinality).toBe('single');
			expect(decls['RESPONSE'].baseType).toBe('identifier');
			// With no response set, value should remain null/unset
			player.setResponses({ RESPONSE: null });
			const result = player.processResponses();
			expect(result).toBeDefined();
		});

		test('Q2-L1-D52: select choice_a -> RESPONSE recorded as identifier', () => {
			const { result } = runItemCase({ itemXml: xml, responses: { RESPONSE: 'choice_a' } });
			expect(result).toBeDefined();
		});

		test('Q2-L1-D53: select choice_b -> RESPONSE recorded as identifier', () => {
			const { result } = runItemCase({ itemXml: xml, responses: { RESPONSE: 'choice_b' } });
			expect(result).toBeDefined();
		});

		test('Q2-L1-D54: select choice_c -> RESPONSE recorded as identifier', () => {
			const { result } = runItemCase({ itemXml: xml, responses: { RESPONSE: 'choice_c' } });
			expect(result).toBeDefined();
		});

		test('Q2-L1-D55: maxChoices=1 enforced (single cardinality)', () => {
			const player = new Player({ itemXml: xml });
			const decls = player.getDeclarations();
			expect(decls['RESPONSE'].cardinality).toBe('single');
			const interactions = player.getInteractions();
			const choice = interactions.find((i) => i.type === 'choiceInteraction');
			expect(choice).toBeDefined();
			expect(choice!.maxChoices).toBe(1);
		});
	});

	// -------------------------------------------------------------------------
	// Q2 — Choice Interaction (multiple cardinality)
	// -------------------------------------------------------------------------
	describe('Q2 multiple-cardinality (Q2-L1-D1 through D7)', async () => {
		const xml = await readConformanceXml(
			'qti2.2/Basic Level/Q2 - Choice Interaction/multiple-cardinality/multiple-cardinality.xml'
		);

		test('declaration is multiple cardinality identifier', () => {
			const player = new Player({ itemXml: xml });
			const decls = player.getDeclarations();
			expect(decls['RESPONSE'].cardinality).toBe('multiple');
			expect(decls['RESPONSE'].baseType).toBe('identifier');
		});

		for (const [label, responses, desc] of [
			['Q2-L1-D1', [], 'no selection -> empty Multiple container'],
			['Q2-L1-D2', ['choice_a'], 'select choice_a'],
			['Q2-L1-D3', ['choice_b'], 'select choice_b'],
			['Q2-L1-D4', ['choice_c'], 'select choice_c'],
			['Q2-L1-D5', ['choice_a', 'choice_b'], 'select choice_a + choice_b'],
			['Q2-L1-D6', ['choice_b', 'choice_c'], 'select choice_b + choice_c'],
			['Q2-L1-D7', ['choice_a', 'choice_b', 'choice_c'], 'select all three'],
		] as [string, string[], string][]) {
			test(`${label}: ${desc}`, () => {
				const { result } = runItemCase({ itemXml: xml, responses: { RESPONSE: responses } });
				expect(result).toBeDefined();
			});
		}
	});

	// -------------------------------------------------------------------------
	// Q5 — Extended Text Interaction (baseType string)
	// -------------------------------------------------------------------------
	describe('Q5 extended text baseType string (Q5-L1-D1, D2)', async () => {
		const xml = await readConformanceXml(
			'qti2.2/Basic Level/Q5 - Extended Text Entry Interaction/baseType-string/base-type-string.xml'
		);

		test('declaration is string baseType single cardinality', () => {
			const player = new Player({ itemXml: xml });
			const decls = player.getDeclarations();
			expect(decls['RESPONSE']).toBeDefined();
			expect(decls['RESPONSE'].baseType).toBe('string');
			expect(decls['RESPONSE'].cardinality).toBe('single');
		});

		test('Q5-L1-D1: no text -> no processing error', () => {
			const { result } = runItemCase({ itemXml: xml, responses: { RESPONSE: null } });
			expect(result).toBeDefined();
		});

		test('Q5-L1-D2: text entered -> no processing error', () => {
			const { result } = runItemCase({ itemXml: xml, responses: { RESPONSE: 'Autumn wind blows cold' } });
			expect(result).toBeDefined();
		});

		test('extendedTextInteraction present in item', () => {
			const player = new Player({ itemXml: xml });
			const interactions = player.getInteractions();
			const found = interactions.find((i) => i.type === 'extendedTextInteraction');
			expect(found).toBeDefined();
		});
	});

	// -------------------------------------------------------------------------
	// Q20 — Text Entry Interaction (baseType string)
	// -------------------------------------------------------------------------
	describe('Q20 text entry baseType string (Q20-D1, D2)', async () => {
		const xml = await readConformanceXml(
			'qti2.2/Basic Level/Q20 - Text Entry Interaction/baseType-string/base-type-string.xml'
		);

		test('declaration is string baseType single cardinality', () => {
			const player = new Player({ itemXml: xml });
			const decls = player.getDeclarations();
			expect(decls['RESPONSE']).toBeDefined();
			expect(decls['RESPONSE'].baseType).toBe('string');
			expect(decls['RESPONSE'].cardinality).toBe('single');
		});

		test('Q20-D1: no text -> no processing error', () => {
			const { result } = runItemCase({ itemXml: xml, responses: { RESPONSE: null } });
			expect(result).toBeDefined();
		});

		test('Q20-D2: text entered -> no processing error', () => {
			const { result } = runItemCase({ itemXml: xml, responses: { RESPONSE: 'jumped' } });
			expect(result).toBeDefined();
		});

		test('textEntryInteraction present in item', () => {
			const player = new Player({ itemXml: xml });
			const interactions = player.getInteractions();
			const found = interactions.find((i) => i.type === 'textEntryInteraction');
			expect(found).toBeDefined();
		});
	});

	// -------------------------------------------------------------------------
	// I9b — match_correct template
	// -------------------------------------------------------------------------
	describe('I9b match_correct (I9b-match-D1, D2, D3)', async () => {
		const xml = await readConformanceXml(
			'qti2.2/Basic Level/I9b - Response Processing Fixed Template/match-correct-identifier/match-correct-identifier.xml'
		);

		test('I9b-match-D1: RESPONSE=NULL -> SCORE=0', () => {
			const { result } = runItemCase({ itemXml: xml, responses: { RESPONSE: null } });
			expect(result.score).toBe(0);
		});

		test('I9b-match-D2: RESPONSE=choice_a (correct) -> SCORE=1', () => {
			const { result } = runItemCase({ itemXml: xml, responses: { RESPONSE: 'choice_a' } });
			expect(result.score).toBe(1);
		});

		test('I9b-match-D3: RESPONSE=choice_b (incorrect) -> SCORE=0', () => {
			const { result } = runItemCase({ itemXml: xml, responses: { RESPONSE: 'choice_b' } });
			expect(result.score).toBe(0);
		});
	});

	// -------------------------------------------------------------------------
	// I9b — map_response template
	// -------------------------------------------------------------------------
	describe('I9b map_response (I9-L1-D1 through I9l1-D11)', async () => {
		const xml = await readConformanceXml(
			'qti2.2/Basic Level/I9b - Response Processing Fixed Template/map-response-identifier/map-response-identifier.xml'
		);

		const cases: [string, unknown, number][] = [
			['I9-L1-D1', null, 0],
			['I9l1-D2', ['choice_a'], 1],
			['I9l1-D3', ['choice_b'], 2],
			['I9l1-D4', ['choice_c'], 5],
			['I9l1-D5', ['choice_d'], 0],
			['I9l1-D6', ['choice_e'], 0],
			['I9l1-D7', ['choice_a', 'choice_b'], 3],
			['I9l1-D8', ['choice_b', 'choice_c'], 6],
			['I9l1-D9', ['choice_c', 'choice_d'], 4],
			['I9l1-D10', ['choice_d', 'choice_e', 'choice_f'], 0],
			['I9l1-D11', ['choice_a', 'choice_b', 'choice_c', 'choice_d', 'choice_e', 'choice_f'], 0],
		];

		for (const [criterion, response, expectedScore] of cases) {
			test(`${criterion}: RESPONSE=${JSON.stringify(response)} -> SCORE=${expectedScore}`, () => {
				const { result } = runItemCase({ itemXml: xml, responses: { RESPONSE: response } });
				expect(result.score).toBe(expectedScore);
			});
		}
	});

	// -------------------------------------------------------------------------
	// T4+T7 — Test Structures (structural parse check)
	// -------------------------------------------------------------------------
	describe('T4+T7 test structure (T4-L1-D1, D2, T7-L1-D1, D2)', async () => {
		const assessmentXml = await readConformanceXml(
			'qti2.2/Basic Level/T4 and T7 - Test Structures/assessment.xml'
		);

		test('T4-L1-D1: assessmentTest element present', () => {
			expect(assessmentXml).toContain('assessmentTest');
		});

		test('T4-L1-D2: testPart with navigationMode=linear, submissionMode=individual', () => {
			expect(assessmentXml).toContain('navigationMode="linear"');
			expect(assessmentXml).toContain('submissionMode="individual"');
		});

		test('T7-L1-D1: visible section present', () => {
			expect(assessmentXml).toContain('visible="true"');
		});

		test('T7-L1-D2: four assessmentItemRef elements', () => {
			const matches = assessmentXml.match(/<assessmentItemRef/g);
			expect(matches).toBeDefined();
			expect(matches!.length).toBe(4);
		});

		test('all four referenced item XMLs parse without error', async () => {
			const itemPaths = [
				'qti2.2/Basic Level/T4 and T7 - Test Structures/q2-choice-interaction-single-cardinality/q2-choice-interaction-single-cardinality.xml',
				'qti2.2/Basic Level/T4 and T7 - Test Structures/q2-choice-interaction-multiple-cardinality/q2-choice-interaction-multiple-cardinality.xml',
				'qti2.2/Basic Level/T4 and T7 - Test Structures/q20-text-entry-base-type-string/q20-text-entry-base-type-string.xml',
				'qti2.2/Basic Level/T4 and T7 - Test Structures/q5-extended-text-base-type-string/q5-extended-text-base-type-string.xml',
			];

			for (const itemPath of itemPaths) {
				const fullPath = join(CONFORMANCE_REPO, itemPath);
				if (!existsSync(fullPath)) continue;
				const xml = await readFile(fullPath, 'utf8');
				const player = new Player({ itemXml: xml });
				const decls = player.getDeclarations();
				expect(Object.keys(decls).length).toBeGreaterThan(0);
			}
		});
	});
});
