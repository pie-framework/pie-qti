/**
 * The documented integrator event API: onItemChange, onSectionChange,
 * onResponseChange, onComplete, onTimeWarning, onTimeTick, and
 * navigateToSection. These are the primary integration points hosts wire into
 * their UI; until now they had no unit coverage.
 */

import './setup';
import { describe, expect, test } from 'bun:test';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';
import { AssessmentPlayer } from '../src/core/AssessmentPlayer.js';

const CHOICE_XML = (identifier: string) =>
	`<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="${identifier}" title="${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <itemBody><choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
    <simpleChoice identifier="A">A</simpleChoice>
    <simpleChoice identifier="B">B</simpleChoice>
  </choiceInteraction></itemBody>
</assessmentItem>`;

/** Two sections with two items each; nonlinear so sections can be jumped between. */
const TWO_SECTION_ASSESSMENT = {
	identifier: 'events-two-sections',
	title: 'Event API fixture',
	navigationMode: 'nonlinear',
	submissionMode: 'individual',
	testParts: [
		{
			identifier: 'part-1',
			sections: [
				{
					identifier: 'section-1',
					title: 'Section 1',
					visible: true,
					assessmentItemRefs: [
						{ identifier: 'item-1', role: 'candidate', itemXml: CHOICE_XML('item-1') },
						{ identifier: 'item-2', role: 'candidate', itemXml: CHOICE_XML('item-2') },
					],
				},
				{
					identifier: 'section-2',
					title: 'Section 2',
					visible: true,
					assessmentItemRefs: [
						{ identifier: 'item-3', role: 'candidate', itemXml: CHOICE_XML('item-3') },
						{ identifier: 'item-4', role: 'candidate', itemXml: CHOICE_XML('item-4') },
					],
				},
			],
		},
	],
};

/** Single item with a test-level time limit, for the time listener tests. */
const TIMED_ASSESSMENT = {
	identifier: 'events-timed',
	title: 'Timed fixture',
	navigationMode: 'nonlinear',
	submissionMode: 'individual',
	timeLimits: { maxTime: 300 },
	testParts: [
		{
			identifier: 'part-1',
			sections: [
				{
					identifier: 'section-1',
					title: 'Section 1',
					visible: true,
					assessmentItemRefs: [{ identifier: 'item-1', role: 'candidate', itemXml: CHOICE_XML('item-1') }],
				},
			],
		},
	],
};

type Assessment = typeof TWO_SECTION_ASSESSMENT;

async function createPlayer(
	assessment: Assessment,
	options: { now?: () => number; timeWarningThreshold?: number } = {},
): Promise<AssessmentPlayer> {
	localStorage.clear();
	const backend = new ReferenceBackendAdapter();
	backend.registerAssessment(assessment.identifier, assessment as never);
	const player = await AssessmentPlayer.create({
		backend,
		initSession: { assessmentId: assessment.identifier, candidateId: 'candidate' },
		timeWarningThreshold: options.timeWarningThreshold,
		now: options.now,
	});
	await player.navigateTo(0);
	return player;
}

describe('onItemChange / onSectionChange', () => {
	test('navigation notifies item and section listeners with indexes and totals', async () => {
		const player = await createPlayer(TWO_SECTION_ASSESSMENT);
		const items: Array<[number, number]> = [];
		const sections: Array<[number, number]> = [];
		player.onItemChange((index, total) => items.push([index, total]));
		player.onSectionChange((index, total) => sections.push([index, total]));

		await player.navigateTo(2);

		expect(items).toContainEqual([2, 4]);
		expect(sections).toContainEqual([1, 2]);
		player.destroy();
	});

	test('the returned unsubscribe function stops further notifications', async () => {
		const player = await createPlayer(TWO_SECTION_ASSESSMENT);
		let calls = 0;
		const unsubscribe = player.onItemChange(() => calls++);
		unsubscribe();

		await player.navigateTo(1);

		expect(calls).toBe(0);
		player.destroy();
	});
});

describe('onResponseChange', () => {
	test('updating a response notifies listeners with the active responses', async () => {
		const player = await createPlayer(TWO_SECTION_ASSESSMENT);
		const updates: Array<Record<string, unknown>> = [];
		player.onResponseChange((responses) => updates.push(responses));

		player.updateResponse('RESPONSE', 'A');

		expect(updates.length).toBeGreaterThan(0);
		expect(updates.at(-1)).toMatchObject({ RESPONSE: 'A' });
		player.destroy();
	});
});

describe('onComplete', () => {
	test('submitting the assessment notifies the completion listener once', async () => {
		const player = await createPlayer(TWO_SECTION_ASSESSMENT);
		let completed = 0;
		player.onComplete(() => completed++);

		for (let i = 0; i < 4; i++) {
			await player.navigateTo(i);
			player.updateResponse('RESPONSE', 'A');
			await player.submitCurrentItem();
		}
		await player.submit();

		expect(completed).toBe(1);
		player.destroy();
	});
});

describe('navigateToSection', () => {
	test('lands on the first item of the requested section and announces the section', async () => {
		const player = await createPlayer(TWO_SECTION_ASSESSMENT);
		const sections: Array<[number, number]> = [];
		player.onSectionChange((index, total) => sections.push([index, total]));

		await player.navigateToSection('section-2');

		expect(player.getCurrentItem()?.identifier).toBe('item-3');
		expect(sections.at(-1)).toEqual([1, 2]);
		player.destroy();
	});

	test('an unknown section id leaves delivery where it was', async () => {
		const player = await createPlayer(TWO_SECTION_ASSESSMENT);
		await player.navigateToSection('no-such-section');
		expect(player.getCurrentItem()?.identifier).toBe('item-1');
		player.destroy();
	});
});

describe('onTimeWarning / onTimeTick', () => {
	test('crossing the warning threshold notifies once with the remaining seconds', async () => {
		let now = 1_000;
		const player = await createPlayer(TIMED_ASSESSMENT, {
			now: () => now,
			timeWarningThreshold: 120,
		});
		const warnings: number[] = [];
		player.onTimeWarning((remainingSeconds) => warnings.push(remainingSeconds));

		// 200 s consumed of 300 s: 100 s remain, below the 120 s threshold.
		now += 200_000;
		await new Promise((resolve) => setTimeout(resolve, 1_100));

		expect(warnings.length).toBe(1);
		expect(warnings[0]).toBe(100);
		player.destroy();
	});

	test('every clock tick reports remaining and elapsed seconds', async () => {
		let now = 1_000;
		const player = await createPlayer(TIMED_ASSESSMENT, { now: () => now });
		const ticks: Array<[number, number]> = [];
		player.onTimeTick((remaining, elapsed) => ticks.push([remaining, elapsed]));

		now += 5_000;
		// The ticking is a real 1s interval reading the injected clock.
		await new Promise((resolve) => setTimeout(resolve, 1_100));

		expect(ticks.length).toBeGreaterThanOrEqual(1);
		expect(ticks[0]![0]).toBe(295); // 300 s limit minus 5 s consumed
		expect(ticks[0]![1]).toBe(5);
		player.destroy();
	});
});
