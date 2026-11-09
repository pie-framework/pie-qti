/**
 * Phase 5 pinning tests (player-cleanup plan): submission timing and the clocks,
 * on a deterministic injected clock. The submission's timing evidence and its
 * duration are captured before the item clock stops; a simultaneous part is
 * submitted while its clocks still run, before the next part's scopes start;
 * Next at an item `maxTime` minus ε is not expired and the recorded time freezes
 * at the leave; crossing a simultaneous part's `maxTime` collects the part as
 * `time-expired` only at the end of the test.
 */

import './setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { AssessmentPlayer } from '../src/core/AssessmentPlayer.js';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';
import type { SubmitResponsesRequest, SubmitResponsesResponse } from '../src/integration/api-contract.js';

const players: AssessmentPlayer[] = [];
const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

afterEach(() => {
	for (const player of players.splice(0)) player.destroy();
	players.length = 0;
	localStorage.clear();
});

const choiceItemXml = (identifier: string, timeLimits = '') =>
	`<assessmentItem ${NS} identifier="${identifier}" title="${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"><correctResponse><value>A</value></correctResponse></responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"><defaultValue><value>0</value></defaultValue></outcomeDeclaration>
  <itemBody><choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice><simpleChoice identifier="B">B</simpleChoice></choiceInteraction></itemBody>
  <responseProcessing><responseCondition><responseIf>
    <match><variable identifier="RESPONSE"/><correct identifier="RESPONSE"/></match>
    <setOutcomeValue identifier="SCORE"><baseValue baseType="float">1</baseValue></setOutcomeValue>
  </responseIf></responseCondition></responseProcessing>
</assessmentItem>`;

const itemRef = (identifier: string, timeLimits = '') =>
	`<assessmentItemRef identifier="${identifier}" href="${identifier}.xml">${timeLimits}</assessmentItemRef>`;
const sectionXml = (identifier: string, inner: string) =>
	`<assessmentSection identifier="${identifier}" title="${identifier}" visible="true">${inner}</assessmentSection>`;
const partXml = (identifier: string, submissionMode: string, timeLimits: string, inner: string) =>
	`<testPart identifier="${identifier}" navigationMode="nonlinear" submissionMode="${submissionMode}">${timeLimits}${inner}</testPart>`;
const testXml = (inner: string) => `<assessmentTest ${NS} identifier="timing-pinning" title="Timing">${inner}</assessmentTest>`;

const itemsXml = (...ids: string[]) => Object.fromEntries(ids.map((id) => [`${id}.xml`, choiceItemXml(id)]));

interface RecordedCall extends SubmitResponsesRequest {
	finalize?: boolean;
}

/**
 * Deliver `testXml` on a deterministic clock (`now` starts at 1_000). `onRequest`
 * runs before each submission is answered — the hook a test uses to let the fake
 * clock move while a submission is in flight.
 */
async function deliverWithClock(
	testXmlString: string,
	files: Record<string, string>,
	onRequest?: (request: SubmitResponsesRequest, callIndex: number) => void,
) {
	let now = 1_000;
	const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(testXmlString, { itemXmlMap: files });
	const backend = new ReferenceBackendAdapter();
	backend.registerAssessment(parsed.identifier, parsed);
	const calls: RecordedCall[] = [];
	const submit = backend.submitResponses.bind(backend);
	backend.submitResponses = async (request): Promise<SubmitResponsesResponse> => {
		calls.push(structuredClone(request));
		onRequest?.(request, calls.length - 1);
		return submit(request);
	};
	const finalize = backend.finalizeAssessment.bind(backend);
	backend.finalizeAssessment = async (request) => {
		calls.push({ ...request, finalize: true } as unknown as RecordedCall);
		return finalize(request);
	};
	const player = await AssessmentPlayer.create({
		backend,
		initSession: { assessmentId: parsed.identifier, candidateId: 'candidate' },
		now: () => now,
	});
	players.push(player);
	await player.navigateTo(0);
	return {
		player,
		calls,
		advance: (ms: number) => {
			now += ms;
		},
		nowMs: () => now,
	};
}

const timingOf = (call: SubmitResponsesRequest | RecordedCall | undefined) =>
	call?.timing as Record<string, unknown> | undefined;

/** Wait until delivery stands on `itemIdentifier` (the expiry hop is unawaited). */
async function waitForItem(player: AssessmentPlayer, itemIdentifier: string, timeoutMs = 2_000): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (player.getState().currentItemIdentifier === itemIdentifier) return;
		await new Promise((resolve) => setTimeout(resolve, 25));
	}
	throw new Error(`Delivery never reached ${itemIdentifier}; on ${player.getState().currentItemIdentifier}`);
}

describe('submission evidence vs the item clock', () => {
	test('timing evidence and duration are captured before the item clock stops', async () => {
		// Item maxTime only, so the evidence's governing scope is the item itself.
		const xml = testXml(
			partXml('part-1', 'individual', '', sectionXml('s1', itemRef('i1', '<timeLimits maxTime="60"/>') + itemRef('i2'))),
		);
		// While the submission is in flight the clock keeps running (+7 s).
		const { player, calls, advance } = await deliverWithClock(xml, itemsXml('i1', 'i2'), () => advance(7_000));

		advance(10_000); // 10 s on the item before Next.
		player.updateResponse('RESPONSE', 'A');
		await player.next();

		// The request's evidence: elapsed 10 s — captured at request construction,
		// before the in-flight +7 s and before the leave folded the clock.
		expect(calls).toHaveLength(1);
		expect(timingOf(calls[0])).toMatchObject({
			scope: 'item',
			limitSeconds: 60,
			elapsedMs: 10_000,
			expired: false,
		});
		// The request carried a (session-measured) duration as it stood.
		expect(typeof calls[0]!.timeSpent).toBe('number');

		// After the move, the leave has folded the item clock — at the post-flight
		// now: 17 s. The evidence (10 s) therefore preceded the clock stop.
		const timing = player.getState().timing;
		expect(timing.itemTimes['i1']).toBe(17_000);
		expect(timing.currentItemIdentifier).toBe('i2');
	});
});

describe('simultaneous part flush vs the clocks', () => {
	test('the part is submitted while its clock still runs, before the next scopes start', async () => {
		const xml = testXml(
			partXml(
				'part-1',
				'simultaneous',
				'<timeLimits maxTime="600"/>',
				sectionXml('s1', itemRef('i1') + itemRef('i2')),
			) +
				partXml('part-2', 'individual', '<timeLimits maxTime="600"/>', sectionXml('s2', itemRef('i3'))),
		);
		// The first flush request takes +5 s of clock; the second request's evidence
		// shows whether the part clock was still running through it.
		const { player, calls, advance } = await deliverWithClock(xml, itemsXml('i1', 'i2', 'i3'), (_request, index) => {
			if (index === 0) advance(5_000);
		});

		player.updateResponse('RESPONSE', 'A');
		await player.next(); // within the part: no submission
		advance(10_000); // 10 s into the part before the crossing
		player.updateResponse('RESPONSE', 'A');
		await player.next(); // crossing: flushes both items

		expect(calls).toHaveLength(2);
		// Request 1: the part clock at the flush start.
		expect(timingOf(calls[0])).toMatchObject({ scope: 'testPart', limitSeconds: 600, elapsedMs: 10_000 });
		// Request 2: five seconds later, and the part clock had NOT been stopped
		// before the flush — it read the elapsed time including the in-flight time.
		expect(timingOf(calls[1])).toMatchObject({ scope: 'testPart', limitSeconds: 600, elapsedMs: 15_000 });

		// The leave folded the part clock after the flush (15 s), and part-2's scope
		// started only then.
		const timing = player.getState().timing;
		expect(timing.testPartTimes?.['part-1']).toBe(15_000);
		expect(timing.currentTestPartIdentifier).toBe('part-2');

		// The next part's clock started at/after the flush: a submission from it
		// carries zero elapsed part time at the same fake instant. (i3 is the last
		// item — Next submits nothing once nothing follows — so the item path is
		// submitCurrentItem.)
		player.updateResponse('RESPONSE', 'A');
		await player.submitCurrentItem();
		expect(calls).toHaveLength(3);
		expect(timingOf(calls[2])).toMatchObject({ scope: 'testPart', limitSeconds: 600, elapsedMs: 0 });
	});

	test('Next at a simultaneous part maxTime minus ε still submits the part, not expired', async () => {
		const xml = testXml(
			partXml(
				'part-1',
				'simultaneous',
				'<timeLimits maxTime="30" allowLateSubmission="false"/>',
				sectionXml('s1', itemRef('i1') + itemRef('i2')),
			) + partXml('part-2', 'individual', '', sectionXml('s2', itemRef('i3'))),
		);
		const { player, calls, advance } = await deliverWithClock(xml, itemsXml('i1', 'i2', 'i3'));

		player.updateResponse('RESPONSE', 'A');
		await player.next();
		advance(29_500); // ε = 0.5 s before the part limit
		player.updateResponse('RESPONSE', 'A');
		await player.next();

		expect(calls).toHaveLength(2);
		expect(timingOf(calls[0])).toMatchObject({
			scope: 'testPart',
			limitSeconds: 30,
			elapsedMs: 29_500,
			expired: false,
			allowLateSubmission: false,
		});
		expect(timingOf(calls[1])).toMatchObject({ elapsedMs: 29_500, expired: false });
		// The crossing landed in the next part.
		expect(player.getState().currentItemIdentifier).toBe('i3');
	});
});

describe('item maxTime with allowLateSubmission=false, on the fake clock', () => {
	test('Next at the limit minus ε is not expired, and leaving freezes the recorded time', async () => {
		const xml = testXml(
			partXml(
				'part-1',
				'individual',
				'',
				sectionXml('s1', itemRef('i1', '<timeLimits maxTime="30" allowLateSubmission="false"/>') + itemRef('i2')),
			),
		);
		const { player, calls, advance } = await deliverWithClock(xml, itemsXml('i1', 'i2'));

		advance(29_500); // ε = 0.5 s before the item limit
		player.updateResponse('RESPONSE', 'A');
		await player.next();

		// Not expired: the submission went out as a normal candidate move.
		expect(calls).toHaveLength(1);
		expect(timingOf(calls[0])).toMatchObject({
			scope: 'item',
			limitSeconds: 30,
			elapsedMs: 29_500,
			expired: false,
			allowLateSubmission: false,
		});

		// The leave recorded the item time as it stood at the leave...
		expect(player.getState().timing.itemTimes['i1']).toBe(29_500);

		// ...and the recorded time is frozen afterwards: the clock runs on (the
		// whole-test counter grows on the next tick) but the left item's time does
		// not move.
		const scopeEvents: unknown[] = [];
		player.onScopeTimeExpired((event) => scopeEvents.push(event));
		advance(120_000);
		await new Promise((resolve) => setTimeout(resolve, 1_100));
		expect(player.getState().timing.totalTime).toBeGreaterThanOrEqual(120_000);
		expect(player.getState().timing.itemTimes['i1']).toBe(29_500);
		// The expired item is no longer an active scope (delivery is on i2), so its
		// expiry fires no scope event — the recording was closed at the leave.
		expect(scopeEvents).toEqual([]);
	});
});

describe('crossing a simultaneous part maxTime', () => {
	test('the expiry hops delivery to the next part without submitting; the end of the test collects the part as time-expired', async () => {
		const xml = testXml(
			partXml(
				'part-1',
				'simultaneous',
				'<timeLimits maxTime="30" allowLateSubmission="false"/>',
				sectionXml('s1', itemRef('i1') + itemRef('i2')),
			) + partXml('part-2', 'individual', '', sectionXml('s2', itemRef('i3'))),
		);
		const { player, calls, advance } = await deliverWithClock(xml, itemsXml('i1', 'i2', 'i3'));

		player.updateResponse('RESPONSE', 'A');
		await player.next();
		player.updateResponse('RESPONSE', 'A');

		// The part hard-expires while the candidate is still inside it.
		advance(31_000);
		await new Promise((resolve) => setTimeout(resolve, 1_100));
		// The pending responses did NOT go out at the expiry; delivery hopped to the
		// next part instead.
		expect(calls).toHaveLength(0);
		await waitForItem(player, 'i3');
		// The left part cannot be re-entered (a backward jump into a previous part is
		// refused before the scope-lock check can fire).
		await expect(player.navigateTo(1)).rejects.toThrow('Navigation is not allowed.');
		// The part's lock is what the end-of-test collection reports: every item of
		// the expired part goes out as time-expired (asserted below).

		// The candidate's submit collects the part as it stands: time-expired, with
		// the expired evidence, then the current item, then finalize.
		const results = await player.submit();
		expect(calls.map((call) => (call.finalize ? 'finalize' : call.itemIdentifier))).toEqual([
			'i1',
			'i2',
			'i3',
			'finalize',
		]);
		expect(timingOf(calls[0])).toMatchObject({ scope: 'testPart', expired: true, submissionReason: 'time-expired' });
		expect(timingOf(calls[1])).toMatchObject({ scope: 'testPart', expired: true, submissionReason: 'time-expired' });
		expect(timingOf(calls[2])?.submissionReason).toBeUndefined();
		expect(results.itemResults.map((result) => result.itemIdentifier).sort()).toEqual(['i1', 'i2', 'i3']);
		// The end reason reflects the delivery as a whole (open on i3): the candidate's
		// own submit is a candidate end, even though the left part was collected
		// time-expired. A whole-test expiry is what makes the end an `expiry` end.
		expect(results.endReason).toBe('candidate');
	});
});
