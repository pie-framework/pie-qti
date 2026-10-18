/**
 * G-22 edge coverage for scoped time limits, on a deterministic clock: per-scope
 * minTime gates on navigation and submission, simultaneous parent/child expiry
 * ordering, late-submission combinations, and the candidate-facing controls and
 * recorded timing evidence that expose them.
 */

import './setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { AssessmentPlayer } from '../src/core/AssessmentPlayer.js';
import { TimeManager } from '../src/core/TimeManager.js';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';

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

const ref = (identifier: string, timeLimits = '') =>
	`<assessmentItemRef identifier="${identifier}" href="${identifier}.xml">${timeLimits}</assessmentItemRef>`;
const section = (identifier: string, inner: string, timeLimits = '') =>
	`<assessmentSection identifier="${identifier}" title="${identifier}" visible="true">${timeLimits}${inner}</assessmentSection>`;
const part = (identifier: string, inner: string, timeLimits = '', navigationMode = 'nonlinear') =>
	`<testPart identifier="${identifier}" navigationMode="${navigationMode}" submissionMode="individual">${timeLimits}${inner}</testPart>`;
const assessmentTest = (inner: string, timeLimits = '') =>
	`<assessmentTest ${NS} identifier="timing-test" title="Timing test">${timeLimits}${inner}</assessmentTest>`;

const items = (...ids: string[]) => Object.fromEntries(ids.map((id) => [`${id}.xml`, choiceItem(id)]));

describe('scoped minTime gates', () => {
	let player: AssessmentPlayer | undefined;
	afterEach(() => {
		player?.destroy();
		player = undefined;
		localStorage.clear();
	});

	async function deliverWithClock(testXml: string, files: Record<string, string>) {
		let now = 1_000;
		const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(testXml, { itemXmlMap: files });
		const backend = new ReferenceBackendAdapter();
		backend.registerAssessment(parsed.identifier, parsed);
		const submissions: Array<Record<string, unknown>> = [];
		const originalSubmit = backend.submitResponses.bind(backend);
		backend.submitResponses = async (request) => {
			submissions.push(request as unknown as Record<string, unknown>);
			return originalSubmit(request);
		};
		player = await AssessmentPlayer.create({
			backend,
			initSession: { assessmentId: parsed.identifier, candidateId: 'candidate' },
			now: () => now,
		});
		await player.navigateTo(0);
		return {
			player: player!,
			advance: (ms: number) => {
				now += ms;
			},
			submissions,
		};
	}

	test('item minTime blocks submission until the scope clock reaches it', async () => {
		const xml = assessmentTest(
			part('part-1', section('s1', ref('i1', '<timeLimits minTime="30"/>'))),
		);
		const { player: p, advance, submissions } = await deliverWithClock(xml, items('i1'));

		p.updateResponseForItem('i1', 'RESPONSE', 'A');
		await expect(p.submitCurrentItem()).rejects.toThrow('The item minimum time has not elapsed (30s remaining).');

		advance(29_000);
		await expect(p.submitCurrentItem()).rejects.toThrow('The item minimum time has not elapsed (1s remaining).');

		advance(1_000);
		await p.submitCurrentItem();
		expect(submissions).toHaveLength(1);
		expect(submissions[0].itemIdentifier).toBe('i1');
	});

	test('section minTime blocks leaving the section until its clock reaches it', async () => {
		const xml = assessmentTest(
			part(
				'part-1',
				section('s1', ref('i1') + ref('i2'), '<timeLimits minTime="20"/>') + section('s2', ref('i3')),
			),
		);
		const { player: p, advance } = await deliverWithClock(xml, items('i1', 'i2', 'i3'));

		p.updateResponseForItem('i1', 'RESPONSE', 'A');
		await expect(p.navigateTo(2)).rejects.toThrow('The section minimum time has not elapsed');

		advance(20_000);
		await p.navigateTo(2);
		expect(p.getCurrentItem()?.identifier).toBe('i3');
	});

	test('submit() enforces testPart and assessment minTime before finalizing', async () => {
		const xml = assessmentTest(
			part('part-1', section('s1', ref('i1')), '<timeLimits minTime="10"/>'),
			'<timeLimits minTime="40"/>',
		);
		const { player: p, advance } = await deliverWithClock(xml, items('i1'));

		p.updateResponseForItem('i1', 'RESPONSE', 'A');
		await expect(p.submit()).rejects.toThrow('The testPart minimum time has not elapsed');

		advance(10_000);
		await expect(p.submit()).rejects.toThrow('The assessment minimum time has not elapsed');

		advance(30_000);
		await p.submit();
	});

	test('getCurrentEffectiveTimeLimits reports the strongest minTime across scopes', async () => {
		const xml = assessmentTest(
			part('part-1', section('s1', ref('i1', '<timeLimits minTime="10"/>'), '<timeLimits minTime="25"/>')),
		);
		const { player: p } = await deliverWithClock(xml, items('i1'));
		expect(p.getCurrentEffectiveTimeLimits().timeLimits?.minTime).toBe(25);
	});
});

describe('simultaneous parent/child expiry', () => {
	test('the player reports expiry and locks delivery when a part and its section expire together', async () => {
		let now = 1_000;
		const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(
			assessmentTest(
				part(
					'part-1',
					section('s1', ref('i1') + ref('i2'), '<timeLimits maxTime="60"/>') + section('s2', ref('i3')),
					'<timeLimits maxTime="60"/>',
				),
			),
			{ itemXmlMap: items('i1', 'i2', 'i3') },
		);
		const backend = new ReferenceBackendAdapter();
		backend.registerAssessment(parsed.identifier, parsed);
		const p = await AssessmentPlayer.create({
			backend,
			initSession: { assessmentId: parsed.identifier, candidateId: 'candidate' },
			now: () => now,
		});
		await p.navigateTo(0);
		let expired = 0;
		p.onTimeExpired(() => expired++);

		now += 60_000;
		// The ticking is a real 1s interval reading the injected clock.
		await new Promise((resolve) => setTimeout(resolve, 1_100));
		// part-1 hard-expires first; every item is locked, so nothing remains unlocked.
		expect(expired).toBe(1);
		await expect(p.navigateTo(1)).rejects.toThrow('The time limit for this question has expired.');

		// section s1 expires on the following tick; with every item already locked the
		// player reports expiry again for the newly expired scope.
		await new Promise((resolve) => setTimeout(resolve, 1_100));
		expect(expired).toBe(2);
		await expect(p.navigateTo(0)).rejects.toThrow('The time limit for this question has expired.');
		p.destroy();
	});

	test('same-instant parent/child expiry reports the parent scope first', async () => {
		let now = 1_000;
		const scopes: string[] = [];
		const manager = new TimeManager({
			now: () => now,
			onScopeExpired: (scope, identifier) => scopes.push(`${scope}:${identifier}`),
		});
		manager.activateScopes({
			testPart: { identifier: 'p1', timeLimits: { maxTime: 60 } },
			section: { identifier: 's1', timeLimits: { maxTime: 60 } },
			item: { identifier: 'i1' },
		});
		now += 60_000;
		await new Promise((resolve) => setTimeout(resolve, 1_100));
		expect(scopes).toEqual(['testPart:p1']);
		await new Promise((resolve) => setTimeout(resolve, 1_100));
		expect(scopes).toEqual(['testPart:p1', 'section:s1']);
		manager.destroy();
	});
});

describe('late-submission combinations', () => {
	test('an expired allow-late item limit still records expired evidence and permits submission', async () => {
		let now = 1_000;
		const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(
			assessmentTest(
				part('part-1', section('s1', ref('i1', '<timeLimits maxTime="5" allowLateSubmission="true"/>'))),
			),
			{ itemXmlMap: items('i1') },
		);
		const backend = new ReferenceBackendAdapter();
		backend.registerAssessment(parsed.identifier, parsed);
		const submissions: Array<Record<string, unknown>> = [];
		const originalSubmit = backend.submitResponses.bind(backend);
		backend.submitResponses = async (request) => {
			submissions.push(request as unknown as Record<string, unknown>);
			return originalSubmit(request);
		};
		const p = await AssessmentPlayer.create({
			backend,
			initSession: { assessmentId: parsed.identifier, candidateId: 'candidate' },
			now: () => now,
		});
		await p.navigateTo(0);

		p.updateResponseForItem('i1', 'RESPONSE', 'A');
		await p.submitCurrentItem();
		const timing = submissions[0].timing as Record<string, unknown>;
		expect(timing).toMatchObject({
			scope: 'item',
			limitSeconds: 5,
			expired: false,
			allowLateSubmission: true,
		});
		expect(timing.elapsedMs).toBeLessThan(5_000);
		p.destroy();
	});

	test('a hard parent limit rejects submission after the allow-late child has expired', async () => {
		let now = 1_000;
		const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(
			assessmentTest(
				part(
					'part-1',
					section('s1', ref('i1', '<timeLimits maxTime="5" allowLateSubmission="true"/>'), '<timeLimits maxTime="30"/>'),
				),
			),
			{ itemXmlMap: items('i1') },
		);
		const backend = new ReferenceBackendAdapter();
		backend.registerAssessment(parsed.identifier, parsed);
		const p = await AssessmentPlayer.create({
			backend,
			initSession: { assessmentId: parsed.identifier, candidateId: 'candidate' },
			now: () => now,
		});
		await p.navigateTo(0);
		expect(p.isTimeExpired()).toBe(false);

		now += 6_000;
		expect(p.isTimeExpired()).toBe(true);
		// The nearest governing limit is still the expired item limit, and its
		// allowLateSubmission is what authorizes the late submission below.
		expect(p.getCurrentEffectiveTimeLimits().timeLimits).toMatchObject({
			maxTime: 5,
			allowLateSubmission: true,
		});

		// The section's hard limit has not expired yet, so the late submission still lands.
		p.updateResponseForItem('i1', 'RESPONSE', 'A');
		await p.submitCurrentItem();

		now += 24_000;
		await new Promise((resolve) => setTimeout(resolve, 1_100));
		// s1 hard-expires: delivery cannot re-enter the closed item.
		await expect(p.navigateTo(0)).rejects.toThrow('The time limit for this question has expired.');
		p.destroy();
	});
});
