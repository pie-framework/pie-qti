/**
 * The scope-expiry hop runs under the transition lock.
 *
 * A timer-driven scope expiry (a test part, section or item limit without late submission
 * ran out) closes the scope at once and moves delivery to the next open item. That move is
 * a state-changing transition like any other: when the timer fires while a submission or
 * navigation transition is in flight, the hop queues behind that transition instead of
 * racing it — nothing moves mid-submission, there is exactly one backend submit, and
 * delivery never moves twice. A plain expiry (nothing in flight) still moves the candidate
 * where the delivery rules send them.
 */

import './setup';
import { afterEach, describe, expect, it } from 'bun:test';
import { AssessmentPlayer, type ScopeTimeExpiryEvent } from '../src/core/AssessmentPlayer.js';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';
import type {
	SecureAssessment,
	SecureItemRef,
	SecureSection,
	SecureTestPart,
} from '../src/integration/api-contract.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

const choiceItem = (identifier: string) =>
	`<assessmentItem ${NS} identifier="${identifier}" title="${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"><correctResponse><value>A</value></correctResponse></responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"><defaultValue><value>0</value></defaultValue></outcomeDeclaration>
  <itemBody><choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice><simpleChoice identifier="B">B</simpleChoice></choiceInteraction></itemBody>
  <responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
</assessmentItem>`;

const ref = (identifier: string, extra: Partial<SecureItemRef> = {}): SecureItemRef => ({
	identifier,
	role: 'candidate',
	itemXml: choiceItem(identifier),
	...extra,
});

/** A serialized preCondition expression that never holds: match(1, 2). */
const NEVER_HOLDS =
	'<match><baseValue baseType="integer">1</baseValue><baseValue baseType="integer">2</baseValue></match>';

const section = (identifier: string, items: SecureItemRef[], extra: Partial<SecureSection> = {}): SecureSection => ({
	identifier,
	visible: true,
	assessmentItemRefs: items,
	...extra,
});

const part = (identifier: string, sections: SecureSection[], extra: Partial<SecureTestPart> = {}): SecureTestPart => ({
	identifier,
	navigationMode: 'nonlinear',
	submissionMode: 'individual',
	sections,
	...extra,
});

const players: AssessmentPlayer[] = [];
afterEach(() => {
	for (const player of players.splice(0)) player.destroy();
	localStorage.clear();
});

/** A gate the test opens by hand: the first backend submit waits on it. */
function submitGate() {
	let release!: () => void;
	const held = new Promise<void>((resolve) => {
		release = resolve;
	});
	return { held, release };
}

interface CreateOptions {
	now?: () => number;
	/** Holds the first backend submit until the gate opens. */
	gate?: { held: Promise<void> };
	onError?: (error: Error) => void;
}

async function create(testParts: SecureTestPart[], options: CreateOptions = {}) {
	const assessment: SecureAssessment = {
		identifier: 'expiry-hop-lock',
		title: 'Expiry hop lock',
		navigationMode: testParts[0]?.navigationMode ?? 'nonlinear',
		submissionMode: testParts[0]?.submissionMode ?? 'individual',
		testParts,
	};
	// What happened, in order: backend submits as they are accepted, item changes, scope expiries.
	const log: string[] = [];
	const submitted: string[] = [];
	const backend = new ReferenceBackendAdapter();
	backend.registerAssessment(assessment.identifier, assessment);
	const submit = backend.submitResponses.bind(backend);
	let gated = options.gate !== undefined;
	backend.submitResponses = async (request) => {
		submitted.push(request.itemIdentifier);
		if (gated) {
			gated = false;
			await options.gate?.held;
		}
		const response = await submit(request);
		log.push(`submitted:${request.itemIdentifier}`);
		return response;
	};
	const player = await AssessmentPlayer.create({
		backend,
		initSession: { assessmentId: assessment.identifier, candidateId: 'candidate' },
		...(options.now ? { now: options.now } : {}),
		...(options.onError ? { onError: options.onError } : {}),
	});
	players.push(player);
	const scopes: ScopeTimeExpiryEvent[] = [];
	const watch = () => {
		player.onItemChange((index) => log.push(`change:${index}`));
		player.onScopeTimeExpired((event) => {
			scopes.push(event);
			log.push(`expired:${event.scope}:${event.identifier}`);
		});
	};
	return { player, log, submitted, scopes, watch };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 60));
/** One real tick of the time manager's one-second interval. */
const timerTick = () => new Promise((resolve) => setTimeout(resolve, 1_100));

describe('the expiry hop queues behind a transition in flight', () => {
	it('an item expiry while its submitting Next is in flight hops after it: nothing moves mid-submission', async () => {
		let now = 1_000;
		const gate = submitGate();
		const { player, log, submitted, scopes, watch } = await create(
			[part('part-1', [section('s1', [ref('q1', { timeLimits: { maxTime: 3 } }), ref('q2')])])],
			{ now: () => now, gate },
		);
		player.updateResponse('RESPONSE', 'A');
		watch();

		const moving = player.next();
		await settle();
		now += 4_000;
		await timerTick();
		await settle();

		// q1 ran out while its submission was in flight, but the hop waits for the
		// transition: nothing moved and nothing was reported yet.
		expect(player.isBusy()).toBe(true);
		expect(player.getCurrentItem()?.identifier).toBe('q1');
		expect(log).toEqual([]);

		gate.release();
		await moving;

		// The submission settled first; only then did the expiry move delivery — once. The
		// hop was already waiting: it ran as the transition released the lock, with no
		// further timer tick.
		expect(log).toEqual(['submitted:q1', 'change:0', 'expired:item:q1', 'change:1']);
		expect(scopes).toEqual([{ scope: 'item', identifier: 'q1', deliveryContinues: true, nextIndex: 1 }]);
		expect(player.getCurrentItem()?.identifier).toBe('q2');
		expect(player.getState().visitedItems).toEqual(['q1', 'q2']);
		// The closed item cannot be returned to.
		expect(player.isNavigationTargetLegal(0)).toBe(false);
		// Exactly one backend submit: the hop is a navigation, it re-sends nothing.
		expect(submitted).toEqual(['q1']);

		await settle();
		expect(log).toHaveLength(4);
		expect(player.isBusy()).toBe(false);
	});

	it('a test part expiry while a part-crossing navigateTo flush is in flight never moves delivery twice', async () => {
		let now = 1_000;
		const gate = submitGate();
		const { player, log, submitted, scopes, watch } = await create(
			[
				part('part-1', [section('s1', [ref('q1'), ref('q2')])], {
					submissionMode: 'simultaneous',
					timeLimits: { maxTime: 3 },
				}),
				part('part-2', [section('s2', [ref('q3')])]),
			],
			{ now: () => now, gate },
		);
		// The jump into the next part starts from the part's last item.
		await player.navigateTo(1);
		player.updateResponse('RESPONSE', 'A');
		watch();

		const jumping = player.navigateTo(2);
		await settle();
		expect(player.isNavigationTargetLegal(0)).toBe(true);
		now += 4_000;
		await timerTick();
		await settle();

		// part-1 ran out while the crossing's flush was in flight — the part closed at once
		// (q1 is no longer a legal target) — but the hop waits: nothing moved or was reported.
		expect(player.isBusy()).toBe(true);
		expect(player.isNavigationTargetLegal(0)).toBe(false);
		expect(player.getCurrentItem()?.identifier).toBe('q2');
		expect(log).toEqual([]);

		gate.release();
		await jumping;

		// The crossing landed on q3 once (after the flush handed q2 back at index 1); the
		// expiry then found delivery already outside the closed part and only reported it.
		expect(log).toEqual(['submitted:q1', 'submitted:q2', 'change:1', 'change:2', 'expired:testPart:part-1']);
		expect(scopes).toEqual([{ scope: 'testPart', identifier: 'part-1', deliveryContinues: true }]);
		expect(player.getCurrentItem()?.identifier).toBe('q3');
		expect(player.getState().visitedItems).toEqual(['q1', 'q2', 'q3']);
		expect(submitted).toEqual(['q1', 'q2']);

		await settle();
		expect(log).toHaveLength(5);
		expect(player.isBusy()).toBe(false);
	});

	it('a force submit queued ahead of the expiry ends the test first: the waiting hop is moot once it finalized', async () => {
		let now = 1_000;
		const gate = submitGate();
		const { player, log, submitted, scopes, watch } = await create(
			[part('part-1', [section('s1', [ref('q1', { timeLimits: { maxTime: 3 } }), ref('q2')])])],
			{ now: () => now, gate },
		);
		player.updateResponse('RESPONSE', 'A');
		watch();

		// The proctor's force submit queues before the expiry fires, so at the handoff it
		// owns the transition first.
		const moving = player.next();
		await settle();
		const ending = player.submit({ force: true });
		now += 4_000;
		await timerTick();
		await settle();
		expect(player.isBusy()).toBe(true);
		expect(log).toEqual([]);

		gate.release();
		const results = await ending;
		await moving;
		await settle();

		// The end collected where the candidate stood and finalized: the queued hop is moot.
		expect(results.endReason).toBe('proctor');
		expect(player.isFinalized()).toBe(true);
		expect(scopes).toEqual([]);
		expect(log).toEqual(['submitted:q1']);
		expect(player.getCurrentItem()?.identifier).toBe('q1');
		expect(submitted).toEqual(['q1']);
		expect(player.isBusy()).toBe(false);
	});

	it('a queued hop is dropped when the player is destroyed behind the transition', async () => {
		let now = 1_000;
		const gate = submitGate();
		const { player, log, watch } = await create(
			[part('part-1', [section('s1', [ref('q1', { timeLimits: { maxTime: 3 } }), ref('q2')])])],
			{ now: () => now, gate },
		);
		player.updateResponse('RESPONSE', 'A');
		watch();

		const moving = player.next();
		await settle();
		now += 4_000;
		await timerTick();
		await settle();
		expect(log).toEqual([]);

		player.destroy();
		gate.release();
		await moving;
		await settle();

		// The in-flight submission still settled, but no hop ran after the teardown: no
		// move, no expiry report, no unhandled rejection.
		expect(log).toEqual(['submitted:q1']);
		expect(player.getCurrentItem()?.identifier).toBe('q1');
		expect(player.isBusy()).toBe(false);
	});

	it('a failing expiry hop reports the entry failure for the shell Retry', async () => {
		let now = 1_000;
		const errors: Error[] = [];
		const { player } = await create(
			[
				part('part-1', [
					section('s1', [ref('q1')], { timeLimits: { maxTime: 3 } }),
					section('s2', [ref('q2', { itemXml: 'this is not xml <<<' }), ref('q3')]),
				]),
			],
			{ now: () => now, onError: (error) => errors.push(error) },
		);

		now += 4_000;
		await timerTick();
		await settle();

		// The hop failed on the broken item: reported once, kept for Retry — not swallowed.
		expect(errors).toHaveLength(1);
		expect(player.hasEntryFailure()).toBe(true);
		expect(player.getEntryError()).toBe(errors[0]);
		await expect(player.retryEntry()).rejects.toThrow();
		expect(errors).toHaveLength(2);
	});
});

describe('the plain expiry hop still moves delivery', () => {
	it('the expired section closes and the candidate lands where the delivery rules send them', async () => {
		let now = 1_000;
		const { player, log, submitted, scopes, watch } = await create(
			[
				part(
					'part-1',
					[
						section('s1', [ref('q1')], { timeLimits: { maxTime: 3 } }),
						section('s2', [ref('q2', { preConditions: [NEVER_HOLDS] }), ref('q3')]),
					],
					{ navigationMode: 'linear' },
				),
			],
			{ now: () => now },
		);
		watch();

		now += 4_000;
		await timerTick();
		await settle();

		// s1 closed; q2's precondition fails, so the delivery rules send the candidate to q3.
		expect(log).toEqual(['change:0', 'expired:section:s1', 'change:2']);
		expect(scopes).toEqual([{ scope: 'section', identifier: 's1', deliveryContinues: true, nextIndex: 2 }]);
		expect(player.getCurrentItem()?.identifier).toBe('q3');
		expect(player.getState().visitedItems).toEqual(['q1', 'q3']);
		// The hop is a navigation, not a submission.
		expect(submitted).toEqual([]);
		expect(player.isBusy()).toBe(false);
	});
});
