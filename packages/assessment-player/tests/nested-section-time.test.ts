/**
 * Nested (enclosing) section clocks (S2).
 *
 * Delivery enters every enclosing section, not just the innermost one: an outer
 * section's `timeLimits` expire and gate like any other scope, and its duration
 * accumulates for outcome processing (`OUTER.duration`), while the innermost
 * behavior stays unchanged.
 */

import './setup';
import { afterEach, describe, expect, test } from 'bun:test';
import {
	AssessmentPlayer,
	type AssessmentTimeExpiryEvent,
	type BackendAssessmentPlayerConfig,
	type ScopeTimeExpiryEvent,
} from '../src/core/AssessmentPlayer.js';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';
import type { SubmitResponsesRequest } from '../src/integration/api-contract.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

const choiceItem = (identifier: string) =>
	`<assessmentItem ${NS} identifier="${identifier}" title="${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"><correctResponse><value>A</value></correctResponse></responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"><defaultValue><value>0</value></defaultValue></outcomeDeclaration>
  <itemBody><choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice><simpleChoice identifier="B">B</simpleChoice></choiceInteraction></itemBody>
  <responseProcessing><responseCondition><responseIf>
    <match><variable identifier="RESPONSE"/><correct identifier="RESPONSE"/></match>
    <setOutcomeValue identifier="SCORE"><baseValue baseType="float">1</baseValue></setOutcomeValue>
  </responseIf></responseCondition></responseProcessing>
</assessmentItem>`;

const items = (...ids: string[]) => Object.fromEntries(ids.map((id) => [`${id}.xml`, choiceItem(id)]));
const ref = (identifier: string) => `<assessmentItemRef identifier="${identifier}" href="${identifier}.xml"/>`;

function nestedTestXml(options: { outerLimits?: string; innerLimits?: string }) {
	return `<assessmentTest ${NS} identifier="nested-time" title="Nested time">
  <outcomeDeclaration identifier="OUTER_DURATION" baseType="duration"/>
  <testPart identifier="part-1" navigationMode="nonlinear" submissionMode="individual">
    <assessmentSection identifier="outer" title="Outer" visible="true">
      ${options.outerLimits ?? ''}
      <assessmentSection identifier="inner" title="Inner" visible="true">
        ${options.innerLimits ?? ''}
        ${ref('i1')}${ref('i2')}
      </assessmentSection>
    </assessmentSection>
  </testPart>
  <outcomeProcessing>
    <setOutcomeValue identifier="OUTER_DURATION"><variable identifier="outer.duration"/></setOutcomeValue>
  </outcomeProcessing>
</assessmentTest>`;
}

const players: AssessmentPlayer[] = [];
afterEach(() => {
	for (const player of players.splice(0)) player.destroy();
	localStorage.clear();
});

const tick = () => new Promise((resolve) => setTimeout(resolve, 1_100));

async function deliver(xml: string, files: Record<string, string>, config: Partial<BackendAssessmentPlayerConfig> = {}) {
	let now = 1_000;
	const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(xml, { itemXmlMap: files });
	const backend = new ReferenceBackendAdapter();
	backend.registerAssessment(parsed.identifier, parsed);
	const submissions: SubmitResponsesRequest[] = [];
	const originalSubmit = backend.submitResponses.bind(backend);
	backend.submitResponses = async (request) => {
		submissions.push(structuredClone(request));
		return originalSubmit(request);
	};
	let finalizeResponse: Awaited<ReturnType<ReferenceBackendAdapter['finalizeAssessment']>> | null = null;
	const originalFinalize = backend.finalizeAssessment.bind(backend);
	backend.finalizeAssessment = async (request) => {
		finalizeResponse = await originalFinalize(request);
		return finalizeResponse;
	};
	const player = await AssessmentPlayer.create({
		backend,
		initSession: { assessmentId: parsed.identifier, candidateId: 'candidate' },
		now: () => now,
		...config,
	});
	players.push(player);
	return {
		player,
		submissions,
		finalizeOutcomes: () => finalizeResponse?.outcomes ?? null,
		advance: (ms: number) => {
			now += ms;
		},
	};
}

describe('nested section clocks', () => {
	test('an outer section limit expires and locks its whole subtree', async () => {
		const xml = nestedTestXml({ outerLimits: '<timeLimits maxTime="2"/>' });
		const scopes: ScopeTimeExpiryEvent[] = [];
		const expiries: AssessmentTimeExpiryEvent[] = [];
		const { player, advance, submissions } = await deliver(xml, items('i1', 'i2'));
		player.onScopeTimeExpired((event) => scopes.push(event));
		player.onTimeExpired((event) => expiries.push(event));

		player.updateResponse('RESPONSE', 'A');
		advance(3_000);
		await tick();
		// The outer (enclosing) section expired: its subtree is locked and nothing
		// unlocked remains, so delivery asks for the terminal submission.
		expect(scopes).toEqual([{ scope: 'section', identifier: 'outer', deliveryContinues: false }]);
		expect(expiries).toEqual([
			{ scope: 'section', identifier: 'outer', autoFinalized: false, submissionRequired: true },
		]);

		const results = await player.submit();
		const i1 = submissions.find((s) => s.itemIdentifier === 'i1');
		expect(i1?.responses).toEqual({ RESPONSE: 'A' });
		expect(i1?.timing?.submissionReason).toBe('time-expired');
		expect(results.totalScore).toBe(1);
	});

	test('outer section duration accumulates for outcome processing', async () => {
		const xml = nestedTestXml({ outerLimits: '<timeLimits maxTime="600"/>' });
		const { player, advance, finalizeOutcomes } = await deliver(xml, items('i1', 'i2'));

		player.updateResponse('RESPONSE', 'A');
		advance(5_000);
		// getState folds the running clocks into the persisted section times.
		expect(player.getState().timing.sectionTimes?.outer).toBeGreaterThanOrEqual(5_000);
		expect(player.getState().timing.sectionTimes?.inner).toBeGreaterThanOrEqual(5_000);

		// Leave item 1 unsubmitted behind a nonlinear jump; finalize collects it.
		await player.navigateTo(1);
		player.updateResponse('RESPONSE', 'A');
		const results = await player.submit();
		expect(results.totalScore).toBe(2);
		// Outcome processing read `outer.duration` in QTI seconds from the player's clocks.
		const outcomes = finalizeOutcomes();
		expect(outcomes?.OUTER_DURATION).toBeGreaterThanOrEqual(5);
	});

	test('outer minTime gates moving to another top-level section', async () => {
		const xml = `<assessmentTest ${NS} identifier="nested-min" title="Nested min time">
  <testPart identifier="part-1" navigationMode="nonlinear" submissionMode="individual">
    <assessmentSection identifier="outer" title="Outer" visible="true">
      <timeLimits minTime="30"/>
      <assessmentSection identifier="inner" title="Inner" visible="true">
        ${ref('i1')}
      </assessmentSection>
    </assessmentSection>
    <assessmentSection identifier="s2" title="Section two" visible="true">
      ${ref('i2')}
    </assessmentSection>
  </testPart>
</assessmentTest>`;
		const { player, advance } = await deliver(xml, items('i1', 'i2'));

		player.updateResponse('RESPONSE', 'A');
		advance(1_000);
		// Leaving the outer section before its minimum time is rejected...
		await expect(player.navigateTo(1)).rejects.toMatchObject({ code: 'minTimeNotElapsed' });
		// ...and allowed once it has elapsed.
		advance(30_000);
		await player.navigateTo(1);
		expect(player.getCurrentItem()?.identifier).toBe('i2');
	});
});
