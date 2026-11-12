/**
 * A test-scope branch rule or preCondition that cannot be evaluated (it fails to parse
 * or evaluate) reads as false — delivery proceeds on the default path, per the documented
 * divergence in `evaluateTestCondition` — but the failure must never be indistinguishable
 * from an authored false: the player reports it as a coded `testConditionFailed` error
 * through `config.onError`, once per distinct failed rule, however often delivery
 * re-evaluates it.
 */

import './setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { qtiNull, qtiValue, type DeclarationMap } from '@pie-qti/qti-processing';
import { AssessmentPlayer } from '../src/core/AssessmentPlayer.js';
import { AssessmentPlayerError, isAssessmentPlayerError } from '../src/core/errors.js';
import {
	deliveredItems,
	evaluateTestCondition,
	testOutcomeDeclarations,
} from '../src/core/testStructure.js';
import type { BackendAdapter } from '../src/integration/api-contract.js';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';

const rng = (): number => 0.5;

const decls: DeclarationMap = {
	SCORE: {
		identifier: 'SCORE',
		baseType: 'float',
		cardinality: 'single',
		defaultValue: qtiValue('float', 'single', 0),
		value: qtiValue('float', 'single', 1),
	},
	NULL_OUTCOME: {
		identifier: 'NULL_OUTCOME',
		baseType: 'float',
		cardinality: 'single',
		defaultValue: qtiNull('float', 'single'),
		value: qtiNull('float', 'single'),
	},
};

const BROKEN_CONDITION = '<unknownExpression/>';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

const choiceItem = (identifier: string) =>
	`<assessmentItem ${NS} identifier="${identifier}" title="${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"><correctResponse><value>A</value></correctResponse></responseDeclaration>
  <itemBody><p>Question ${identifier}</p></itemBody>
</assessmentItem>`;

const TEST_XML = `<assessmentTest ${NS} identifier="condition-fail" title="Condition failure">
  <testPart identifier="part" navigationMode="linear" submissionMode="individual">
    <assessmentSection identifier="s1" title="Section A" visible="true">
      <assessmentItemRef identifier="q1" href="q1.xml">
        <branchRule target="EXIT_TEST"><unknownExpression/></branchRule>
      </assessmentItemRef>
      <assessmentItemRef identifier="q2" href="q2.xml"/>
      <assessmentItemRef identifier="q3" href="q3.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

const players: AssessmentPlayer[] = [];
afterEach(() => {
	for (const player of players.splice(0)) player.destroy();
	localStorage.clear();
});

async function deliver(stripBackendDecisions = false) {
	const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(TEST_XML, {
		itemXmlMap: {
			'q1.xml': choiceItem('q1'),
			'q2.xml': choiceItem('q2'),
			'q3.xml': choiceItem('q3'),
		},
	});
	const reference = new ReferenceBackendAdapter();
	reference.registerAssessment(parsed.identifier, parsed);
	// A backend that leaves branching to the player (no `nextItemIdentifier` in its
	// responses): the player then evaluates the delivery rules itself — the path the
	// `config.onError` reporting is threaded into.
	const backend: BackendAdapter = stripBackendDecisions
		? {
				canSaveState: reference.canSaveState,
				requiresItemSession: reference.requiresItemSession,
				initSession: (request) => reference.initSession(request),
				saveState: (request) => reference.saveState(request),
				submitResponses: async (request) => {
					const response = await reference.submitResponses(request);
					const { nextItemIdentifier: _omitted, ...rest } = response;
					return rest;
				},
				finalizeAssessment: (request) => reference.finalizeAssessment(request),
			}
		: reference;
	const errors: Error[] = [];
	const player = await AssessmentPlayer.create({
		backend,
		initSession: { assessmentId: parsed.identifier, candidateId: 'candidate' },
		onError: (error) => errors.push(error),
	});
	players.push(player);
	await new Promise((resolve) => setTimeout(resolve, 50));
	return { player, errors };
}

describe('evaluateTestCondition error handling', () => {
	test('NULL still reads as false and reports nothing (QTI: NULL is not an error)', () => {
		const errors: unknown[] = [];
		const result = evaluateTestCondition(
			'<match><variable identifier="NULL_OUTCOME"/><baseValue baseType="float">0</baseValue></match>',
			decls,
			rng,
			(_xml, error) => errors.push(error),
		);
		expect(result).toBe(false);
		expect(errors).toHaveLength(0);
	});

	test('a broken condition reads as false and reports exactly once', () => {
		const errors: unknown[] = [];
		const result = evaluateTestCondition(BROKEN_CONDITION, decls, rng, (_xml, error) => errors.push(error));
		expect(result).toBe(false);
		expect(errors).toHaveLength(1);
	});

	test('a true condition still reads as true', () => {
		const result = evaluateTestCondition(
			'<match><variable identifier="SCORE"/><baseValue baseType="float">1</baseValue></match>',
			decls,
			rng,
		);
		expect(result).toBe(true);
	});

	test('without a reporter the failure stays a console warning (reference backend evaluation)', () => {
		const warns: unknown[][] = [];
		const original = console.warn;
		console.warn = (...args: unknown[]) => warns.push(args);
		try {
			expect(evaluateTestCondition(BROKEN_CONDITION, decls, rng)).toBe(false);
		} finally {
			console.warn = original;
		}
		expect(warns).toHaveLength(1);
	});
});

describe('player delivery with an unevaluable branch rule', () => {
	test('delivery follows the default path and onError reports the coded failure once per rule', async () => {
		const { player, errors } = await deliver(true);

		// The broken rule would have ended the test (EXIT_TEST) had it read as true;
		// it reads as false, so delivery moves to the adjacent item.
		await player.next();
		expect(player.getCurrentItem()?.identifier).toBe('q2');

		const reported = errors.filter(isAssessmentPlayerError).filter((e) => e.code === 'testConditionFailed');
		expect(reported).toHaveLength(1);
		expect(reported[0]).toBeInstanceOf(AssessmentPlayerError);

		// The rule re-evaluates on the next step; the host must not hear about it again.
		await player.next();
		expect(player.getCurrentItem()?.identifier).toBe('q3');
		const stillOne = errors.filter(isAssessmentPlayerError).filter((e) => e.code === 'testConditionFailed');
		expect(stillOne).toHaveLength(1);
	});
});

describe('reference backend decisions with an unevaluable precondition', () => {
	test('the adapter keeps deciding on the default path without a reporter', async () => {
		const PART_SKIP_XML = `<assessmentTest ${NS} identifier="precond-fail" title="Precondition failure">
  <testPart identifier="part-skipped" navigationMode="linear" submissionMode="individual">
    <preCondition><unknownExpression/></preCondition>
    <assessmentSection identifier="s1" title="Section A" visible="true">
      <assessmentItemRef identifier="q1" href="q1.xml"/>
    </assessmentSection>
  </testPart>
  <testPart identifier="part-kept" navigationMode="nonlinear" submissionMode="individual">
    <assessmentSection identifier="s2" title="Section B" visible="true">
      <assessmentItemRef identifier="q2" href="q2.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;
		const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(PART_SKIP_XML, {
			itemXmlMap: { 'q1.xml': choiceItem('q1'), 'q2.xml': choiceItem('q2') },
		});
		const assessment = parsed;
		// The broken precondition must not abort the walk: the skipped part yields nothing,
		// and the first eligible item comes from the part the precondition held for.
		const first = await (async () => {
			const { firstEligibleItem } = await import('../src/core/testStructure.js');
			const warns: unknown[][] = [];
			const original = console.warn;
			console.warn = (...args: unknown[]) => warns.push(args);
			try {
				return firstEligibleItem(
					assessment,
					deliveredItems(assessment),
					0,
					undefined,
					testOutcomeDeclarations(assessment),
					rng,
				);
			} finally {
				console.warn = original;
			}
		})();
		expect(first).toBe('q2');
	});
});
