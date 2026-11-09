/**
 * The backend's branch decision (`nextItemIdentifier`) and where delivery goes with it.
 *
 * The player keeps the decision a counted submission returned for an item, and follows it
 * on the next forward step from that item that submits nothing (Check answer, then Next
 * with the response unchanged). The decision must not go stale (a later counted submission
 * voids it, so testPart rules in nonlinear parts re-evaluate), must survive a save/restore
 * (a restored session lands identically), and in a simultaneous test part must be read at
 * the part crossing, from the response for the part's last item — after the part's pending
 * responses went out, never during the end of the test's own collection.
 *
 * Every case is driven from raw assessmentTest XML (QTI 2.2 and converted QTI 3.0) through
 * the reference backend, whose real branch-rule evaluation produces `nextItemIdentifier`.
 */

import './setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { convertQti2ToQti3 } from '@pie-qti/qti-common';
import { AssessmentPlayer } from '../src/core/AssessmentPlayer.js';
import { AssessmentPlayerError, isAssessmentPlayerError } from '../src/core/errors.js';
import type {
	BackendAdapter,
	InitSessionRequest,
	InitSessionResponse,
	SaveAssessmentStateRequest,
	SaveAssessmentStateResponse,
	SubmitResponsesRequest,
	SubmitResponsesResponse,
} from '../src/integration/api-contract.js';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

/** A choice item scoring 1 for the correct answer "A", 0 otherwise. */
const choiceItem = (identifier: string) =>
	`<assessmentItem ${NS} identifier="${identifier}" title="${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"><correctResponse><value>A</value></correctResponse></responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"><defaultValue><value>0</value></defaultValue></outcomeDeclaration>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice><simpleChoice identifier="B">B</simpleChoice></choiceInteraction>
  </itemBody>
  <responseProcessing>
    <responseCondition><responseIf>
      <match><variable identifier="RESPONSE"/><correct identifier="RESPONSE"/></match>
      <setOutcomeValue identifier="SCORE"><baseValue baseType="float">1</baseValue></setOutcomeValue>
    </responseIf></responseCondition>
  </responseProcessing>
</assessmentItem>`;

/**
 * A choice item with a countAttempt="false" end-attempt (a hint): activating it submits
 * without consuming an attempt, and response processing sets SCORE to 5 for the hint's
 * rule inputs — so the hint's own backend decision (target i3) differs from the counted
 * check's (target i2), and a player that followed or kept the hint's decision is caught.
 */
const hintItem = (identifier: string) =>
	`<assessmentItem ${NS} identifier="${identifier}" title="${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"><correctResponse><value>A</value></correctResponse></responseDeclaration>
  <responseDeclaration identifier="END" cardinality="single" baseType="boolean"/>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"><defaultValue><value>0</value></defaultValue></outcomeDeclaration>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice><simpleChoice identifier="B">B</simpleChoice></choiceInteraction>
    <p><endAttemptInteraction responseIdentifier="END" title="Hint" countAttempt="false"/></p>
  </itemBody>
  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match><variable identifier="RESPONSE"/><correct identifier="RESPONSE"/></match>
        <setOutcomeValue identifier="SCORE"><baseValue baseType="float">1</baseValue></setOutcomeValue>
      </responseIf>
      <responseElseIf>
        <variable identifier="END"/>
        <setOutcomeValue identifier="SCORE"><baseValue baseType="float">5</baseValue></setOutcomeValue>
      </responseElseIf>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

const ref = (identifier: string, inner = '') =>
	`<assessmentItemRef identifier="${identifier}" href="${identifier}.xml">${inner}</assessmentItemRef>`;
const section = (identifier: string, inner: string, attrs = '') =>
	`<assessmentSection identifier="${identifier}" title="${identifier}" visible="true" ${attrs}>${inner}</assessmentSection>`;
const part = (
	identifier: string,
	inner: string,
	{ navigationMode = 'linear', submissionMode = 'individual', itemSessionControl, preCondition, branchRule }: {
		navigationMode?: string;
		submissionMode?: string;
		itemSessionControl?: string;
		preCondition?: string;
		branchRule?: string;
	} = {},
) =>
	`<testPart identifier="${identifier}" navigationMode="${navigationMode}" submissionMode="${submissionMode}">${itemSessionControl ?? ''}${preCondition ?? ''}${branchRule ?? ''}${inner}</testPart>`;
/** Two counted attempts with revealed feedback: the check control's requirement. */
const twoAttempts = `<itemSessionControl maxAttempts="2" showFeedback="true"/>`;
const branchRule = (target: string, condition = '') =>
	`<branchRule target="${target}">${condition}</branchRule>`;
const preCondition = (expression: string) => `<preCondition>${expression}</preCondition>`;
const assessmentTest = (inner: string, { outcomeProcessing = '' }: { outcomeProcessing?: string } = {}) =>
	`<assessmentTest ${NS} identifier="branch-decision" title="Branch decision">${
		outcomeProcessing ? `<outcomeDeclaration identifier="TOTAL" cardinality="single" baseType="float"><defaultValue><value>0</value></defaultValue></outcomeDeclaration>${outcomeProcessing}` : ''
	}${inner}</assessmentTest>`;
/** Test outcome processing summing every item's SCORE into TOTAL. */
const totalScoreProcessing =
	`<outcomeProcessing><setOutcomeValue identifier="TOTAL"><sum><testVariables variableIdentifier="SCORE"/></sum></setOutcomeValue></outcomeProcessing>`;
const alwaysFalse = `<baseValue baseType="boolean">false</baseValue>`;

const items = (...ids: string[]) => Object.fromEntries(ids.map((id) => [id, choiceItem(id)]));

const VERSIONS = {
	'QTI 2.2': (xml: string) => xml,
	'QTI 3.0': (xml: string) => convertQti2ToQti3(xml),
};
type Version = keyof typeof VERSIONS;

const players: AssessmentPlayer[] = [];

afterEach(() => {
	for (const player of players.splice(0)) player.destroy();
	localStorage.clear();
});

/** Real reference backend for parsing, scoring, branch-rule evaluation and persistence. */
async function referenceBackend(convert: (xml: string) => string, testXml: string, itemsMap: Record<string, string>) {
	const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(convert(testXml), {
		itemXmlMap: Object.fromEntries(Object.entries(itemsMap).map(([id, xml]) => [`${id}.xml`, convert(xml)])),
	});
	const backend = new ReferenceBackendAdapter();
	backend.registerAssessment(parsed.identifier, parsed);
	return { parsed, backend };
}

/** Delegating wrapper that counts finalize calls and submissions without changing behavior. */
class CountingBackend implements BackendAdapter {
	finalizeCalls = 0;
	readonly submittedItems: string[] = [];
	constructor(private readonly inner: BackendAdapter) {}
	async initSession(request: InitSessionRequest): Promise<InitSessionResponse> {
		return this.inner.initSession(request);
	}
	async saveState(request: SaveAssessmentStateRequest): Promise<SaveAssessmentStateResponse> {
		return this.inner.saveState(request);
	}
	async finalizeAssessment(request: Parameters<BackendAdapter['finalizeAssessment']>[0]) {
		this.finalizeCalls += 1;
		return this.inner.finalizeAssessment(request);
	}
	async submitResponses(request: SubmitResponsesRequest): Promise<SubmitResponsesResponse> {
		this.submittedItems.push(request.itemIdentifier);
		return this.inner.submitResponses(request);
	}
}

/** Delegating wrapper whose first submission for a chosen item fails once, then succeeds. */
class FailOnceBackend extends CountingBackend {
	private failedOnce = false;
	constructor(
		inner: BackendAdapter,
		private readonly itemIdentifier: string,
	) {
		super(inner);
	}
	async submitResponses(request: SubmitResponsesRequest): Promise<SubmitResponsesResponse> {
		if (request.itemIdentifier === this.itemIdentifier && !this.failedOnce) {
			this.failedOnce = true;
			return { success: false, error: 'backend unavailable' } as SubmitResponsesResponse;
		}
		return super.submitResponses(request);
	}
}

async function makePlayer(backend: BackendAdapter, assessmentId: string, onComplete: () => void = () => {}) {
	localStorage.clear();
	const player = await AssessmentPlayer.create({
		backend,
		initSession: { assessmentId, candidateId: 'candidate' },
		onComplete,
	});
	players.push(player);
	await player.navigateTo(0);
	return player;
}

function errorCode(error: unknown): string {
	expect(isAssessmentPlayerError(error)).toBe(true);
	return (error as AssessmentPlayerError).code;
}

async function waitFor(condition: () => boolean, description: string): Promise<void> {
	const deadline = Date.now() + 2000;
	while (!condition()) {
		if (Date.now() > deadline) throw new Error(`Timed out waiting for ${description}`);
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
}

/** Attempts recorded for an item in the persisted session state. */
function attemptsOf(player: AssessmentPlayer, identifier: string): number {
	return player.getState().itemSessionStates?.[identifier]?.attemptCount ?? 0;
}

describe.each(Object.keys(VERSIONS) as Version[])('%s branch decision', (version) => {
	const convert = VERSIONS[version];

	test('1. linear part: Check, then Next unchanged lands on the branch target with no extra submit and one attempt', async () => {
		const xml = assessmentTest(
			part('part-1', section('s1', `${ref('i1', branchRule('i3'))}${ref('i2')}${ref('i3')}`), {
				itemSessionControl: twoAttempts,
			}),
		);
		const { parsed, backend } = await referenceBackend(convert, xml, items('i1', 'i2', 'i3'));
		const counting = new CountingBackend(backend);
		const player = await makePlayer(counting, parsed.identifier);
		expect(player.getCurrentItem()?.identifier).toBe('i1');

		player.updateResponse('RESPONSE', 'A');
		await player.checkCurrentItem();

		// The check counted one attempt and kept the backend's decision; delivery stayed.
		expect(player.getCurrentItem()?.identifier).toBe('i1');
		expect(counting.submittedItems).toEqual(['i1']);
		expect(attemptsOf(player, 'i1')).toBe(1);

		await player.next();

		// Unchanged response: no re-submission, and the decision (i1 → i3) is what Next follows.
		expect(player.getCurrentItem()?.identifier).toBe('i3');
		expect(counting.submittedItems).toEqual(['i1']);
		expect(attemptsOf(player, 'i1')).toBe(1);
	});

	test('2. linear part: the same after both attempts were used through Check', async () => {
		const xml = assessmentTest(
			part('part-1', section('s1', `${ref('i1', branchRule('i3'))}${ref('i2')}${ref('i3')}`), {
				itemSessionControl: twoAttempts,
			}),
		);
		const { parsed, backend } = await referenceBackend(convert, xml, items('i1', 'i2', 'i3'));
		const counting = new CountingBackend(backend);
		const player = await makePlayer(counting, parsed.identifier);

		player.updateResponse('RESPONSE', 'B');
		await player.checkCurrentItem();
		player.updateResponse('RESPONSE', 'A');
		await player.checkCurrentItem();

		expect(attemptsOf(player, 'i1')).toBe(2);
		expect(counting.submittedItems).toEqual(['i1', 'i1']);

		await player.next();

		expect(player.getCurrentItem()?.identifier).toBe('i3');
		expect(counting.submittedItems).toEqual(['i1', 'i1']);
		expect(attemptsOf(player, 'i1')).toBe(2);
	});

	test('3. a changed answer re-submits on Next and follows the fresh decision', async () => {
		// The rule branches to i3 only for a correct answer (SCORE 1); otherwise delivery
		// falls through to the adjacent i2. The check decided on the wrong answer; the
		// corrected Next must land on the new decision's target.
		const xml = assessmentTest(
			part(
				'part-1',
				section(
					's1',
					`${ref(
						'i1',
						branchRule('i3', `<match><variable identifier="i1.SCORE"/><baseValue baseType="float">1</baseValue></match>`),
					)}${ref('i2')}${ref('i3')}`,
				),
				{ itemSessionControl: twoAttempts },
			),
		);
		const { parsed, backend } = await referenceBackend(convert, xml, items('i1', 'i2', 'i3'));
		const counting = new CountingBackend(backend);
		const player = await makePlayer(counting, parsed.identifier);

		player.updateResponse('RESPONSE', 'B');
		await player.checkCurrentItem();
		expect(player.getCurrentItem()?.identifier).toBe('i1');
		expect(attemptsOf(player, 'i1')).toBe(1);

		player.updateResponse('RESPONSE', 'A');
		await player.next();

		// The re-submission carried the correction (SCORE 1), so the branch rule now fires.
		expect(player.getCurrentItem()?.identifier).toBe('i3');
		expect(counting.submittedItems).toEqual(['i1', 'i1']);
		expect(attemptsOf(player, 'i1')).toBe(2);
	});

	test('4. a hint neither moves delivery nor spends an attempt; Next uses only the counted decision', async () => {
		// The rule branches to i3 when the item's SCORE >= 3 — the hint path alone computes
		// that (SCORE 5), so the hint's own submission returns a decision for i3 while the
		// counted check (SCORE 0) returned the fall-through i2. Next must follow the counted
		// decision (i2), never the hint's.
		const xml = assessmentTest(
			part(
				'part-1',
				section(
					's1',
					`${ref(
						'i1',
						branchRule('i3', `<gte><variable identifier="SCORE"/><baseValue baseType="float">3</baseValue></gte>`),
					)}${ref('i2')}${ref('i3')}`,
				),
				{ itemSessionControl: twoAttempts },
			),
		);
		const { parsed, backend } = await referenceBackend(convert, xml, { i1: hintItem('i1'), i2: choiceItem('i2'), i3: choiceItem('i3') });
		const counting = new CountingBackend(backend);
		const player = await makePlayer(counting, parsed.identifier);

		player.updateResponse('RESPONSE', 'B');
		await player.checkCurrentItem();
		expect(attemptsOf(player, 'i1')).toBe(1);
		expect(counting.submittedItems).toEqual(['i1']);

		// The hint submits (uncounted, no attempt) and must leave the candidate exactly
		// where they were, with the counted decision untouched.
		player.updateResponse('END', true);
		await waitFor(() => counting.submittedItems.length === 2 && !player.isBusy(), 'the hint submission');
		expect(player.getCurrentItem()?.identifier).toBe('i1');
		expect(attemptsOf(player, 'i1')).toBe(1);

		// Next submits nothing (the hint's response change rides the next real submission)
		// and follows the counted decision: the fall-through i2, not the hint's i3.
		await player.next();
		expect(player.getCurrentItem()?.identifier).toBe('i2');
		expect(attemptsOf(player, 'i1')).toBe(1);
		expect(counting.submittedItems).toEqual(['i1', 'i1']);
	});

	test('5. nonlinear part: a counted submission voids the kept decision, so the testPart rule re-evaluates', async () => {
		// part-1 (nonlinear) ends with i3; its testPart rule branches to i5 once the test
		// score TOTAL reaches 2. Checking i3 (TOTAL 1) keeps the fall-through decision (i4);
		// submitting i1 afterwards (TOTAL 2) voids it, so the later Next from i3 must land on
		// the rule's fresh target, not the stale one.
		const xml = assessmentTest(
			`${part(
				'part-1',
				section('s1', `${ref('i1')}${ref('i2')}${ref('i3')}`),
				{
					navigationMode: 'nonlinear',
					itemSessionControl: twoAttempts,
					branchRule: branchRule('i5', `<gte><variable identifier="TOTAL"/><baseValue baseType="float">2</baseValue></gte>`),
				},
			)}${part('part-2', section('s2', `${ref('i4')}${ref('i5')}`), { navigationMode: 'nonlinear' })}`,
			{ outcomeProcessing: totalScoreProcessing },
		);
		const { parsed, backend } = await referenceBackend(convert, xml, items('i1', 'i2', 'i3', 'i4', 'i5'));
		const counting = new CountingBackend(backend);
		const player = await makePlayer(counting, parsed.identifier);

		// Check the part's last item: TOTAL 1, decision kept for i3 (fall-through → i4).
		await player.navigateTo(2);
		player.updateResponse('RESPONSE', 'A');
		await player.checkCurrentItem();
		expect(player.getCurrentItem()?.identifier).toBe('i3');
		expect(attemptsOf(player, 'i3')).toBe(1);

		// Go back, answer and move on from i1: a counted submission that voids the decision.
		await player.navigateTo(0);
		player.updateResponse('RESPONSE', 'A');
		await player.next();
		expect(player.getCurrentItem()?.identifier).toBe('i2');

		// Return to the checked item and move on unchanged: the rule re-evaluates on TOTAL 2.
		await player.navigateTo(2);
		await player.next();
		expect(player.getCurrentItem()?.identifier).toBe('i5');
		expect(counting.submittedItems).toEqual(['i3', 'i1']);
		expect(attemptsOf(player, 'i3')).toBe(1);
	});

	test('6. a restored session lands identically: Check, getState, restoreState, Next', async () => {
		// The rule reads the test score TOTAL, so the backend's decision (i1 → i3 once TOTAL
		// is 1) cannot be re-derived by a restored session that has not re-run outcome
		// processing: the landing must come from the decision the snapshot carries.
		const xml = assessmentTest(
			part(
				'part-1',
				section(
					's1',
					`${ref(
						'i1',
						branchRule('i3', `<gte><variable identifier="TOTAL"/><baseValue baseType="float">1</baseValue></gte>`),
					)}${ref('i2')}${ref('i3')}`,
				),
				{ itemSessionControl: twoAttempts },
			),
			{ outcomeProcessing: totalScoreProcessing },
		);
		const { parsed, backend } = await referenceBackend(convert, xml, items('i1', 'i2', 'i3'));
		const live = new CountingBackend(backend);
		const player = await makePlayer(live, parsed.identifier);

		player.updateResponse('RESPONSE', 'A');
		await player.checkCurrentItem();
		const state = player.getState();

		// The live session's own Next: one submission total, landing on the target.
		await player.next();
		expect(player.getCurrentItem()?.identifier).toBe('i3');

		// A fresh player restored from the snapshot: same landing, no extra attempt.
		const restored = new CountingBackend(backend);
		const player2 = await makePlayer(restored, parsed.identifier);
		await player2.restoreState(state);
		expect(player2.getCurrentItem()?.identifier).toBe('i1');
		expect(attemptsOf(player2, 'i1')).toBe(1);

		await player2.next();
		expect(player2.getCurrentItem()?.identifier).toBe('i3');
		expect(restored.submittedItems).toEqual([]);
		expect(attemptsOf(player2, 'i1')).toBe(1);
	});

	test('7. a branch target whose testPart preCondition is false is skipped', async () => {
		// i1's rule targets part-2, whose preCondition is false: the decision must carry
		// delivery past it to part-3's first item.
		const xml = assessmentTest(
			`${part('part-1', section('s1', ref('i1', branchRule('part-2'))), { itemSessionControl: twoAttempts })}`
			+ `${part('part-2', section('s2', ref('i2')), { preCondition: preCondition(alwaysFalse) })}`
			+ `${part('part-3', section('s3', ref('i3')))}`,
		);
		const { parsed, backend } = await referenceBackend(convert, xml, items('i1', 'i2', 'i3'));
		const counting = new CountingBackend(backend);
		const player = await makePlayer(counting, parsed.identifier);

		player.updateResponse('RESPONSE', 'A');
		await player.checkCurrentItem();
		await player.next();

		expect(player.getCurrentItem()?.identifier).toBe('i3');
		expect(counting.submittedItems).toEqual(['i1']);
	});

	test('8a. simultaneous part: Next crosses on the decision its flush returns for the last item', async () => {
		// The part's testPart rule branches to i5 when the part's last item is correct. The
		// rule can only fire once the part's pending responses went out, so the crossing must
		// submit first and then follow the decision made for i3 — not land on the adjacent i4.
		const xml = assessmentTest(
			`${part(
				'part-1',
				section('s1', `${ref('i1')}${ref('i2')}${ref('i3')}`),
				{
					navigationMode: 'nonlinear',
					submissionMode: 'simultaneous',
					branchRule: branchRule('i5', `<gte><variable identifier="i3.SCORE"/><baseValue baseType="float">1</baseValue></gte>`),
				},
			)}${part('part-2', section('s2', ref('i4')), { navigationMode: 'nonlinear' })}`
			+ `${part('part-3', section('s3', ref('i5')), { navigationMode: 'nonlinear' })}`,
		);
		const { parsed, backend } = await referenceBackend(convert, xml, items('i1', 'i2', 'i3', 'i4', 'i5'));
		const counting = new CountingBackend(backend);
		const player = await makePlayer(counting, parsed.identifier);

		player.updateResponse('RESPONSE', 'A');
		await player.navigateTo(1);
		player.updateResponse('RESPONSE', 'A');
		await player.navigateTo(2);
		player.updateResponse('RESPONSE', 'A');
		expect(counting.submittedItems).toEqual([]);

		await player.next();

		expect(player.getCurrentItem()?.identifier).toBe('i5');
		expect(counting.submittedItems).toEqual(['i1', 'i2', 'i3']);
	});

	test('8b. simultaneous part: the following part whose preCondition is false is skipped', async () => {
		// A wrong last answer leaves the part rule unfired; delivery falls through to the
		// next item, skipping part-2 (its preCondition is false) into part-3.
		const xml = assessmentTest(
			`${part(
				'part-1',
				section('s1', `${ref('i1')}${ref('i2')}${ref('i3')}`),
				{
					navigationMode: 'nonlinear',
					submissionMode: 'simultaneous',
					branchRule: branchRule('i5', `<gte><variable identifier="i3.SCORE"/><baseValue baseType="float">1</baseValue></gte>`),
				},
			)}${part('part-2', section('s2', ref('i4')), { navigationMode: 'nonlinear', preCondition: preCondition(alwaysFalse) })}`
			+ `${part('part-3', section('s3', ref('i5')), { navigationMode: 'nonlinear' })}`,
		);
		const { parsed, backend } = await referenceBackend(convert, xml, items('i1', 'i2', 'i3', 'i4', 'i5'));
		const counting = new CountingBackend(backend);
		const player = await makePlayer(counting, parsed.identifier);

		player.updateResponse('RESPONSE', 'A');
		await player.navigateTo(1);
		player.updateResponse('RESPONSE', 'A');
		await player.navigateTo(2);
		player.updateResponse('RESPONSE', 'B');

		await player.next();

		expect(player.getCurrentItem()?.identifier).toBe('i5');
		expect(counting.submittedItems).toEqual(['i1', 'i2', 'i3']);
	});

	test('8c. simultaneous part: a failed crossing retried lands on the decision, without re-submitting accepted items', async () => {
		const xml = assessmentTest(
			`${part(
				'part-1',
				section('s1', `${ref('i1')}${ref('i2')}${ref('i3')}`),
				{
					navigationMode: 'nonlinear',
					submissionMode: 'simultaneous',
					branchRule: branchRule('i5', `<gte><variable identifier="i3.SCORE"/><baseValue baseType="float">1</baseValue></gte>`),
				},
			)}${part('part-2', section('s2', ref('i4')), { navigationMode: 'nonlinear' })}`
			+ `${part('part-3', section('s3', ref('i5')), { navigationMode: 'nonlinear' })}`,
		);
		const { parsed, backend } = await referenceBackend(convert, xml, items('i1', 'i2', 'i3', 'i4', 'i5'));
		const counting = new FailOnceBackend(backend, 'i2');
		const player = await makePlayer(counting, parsed.identifier);

		player.updateResponse('RESPONSE', 'A');
		await player.navigateTo(1);
		player.updateResponse('RESPONSE', 'A');
		await player.navigateTo(2);
		player.updateResponse('RESPONSE', 'A');

		// The flush fails on i2 (after i1 was accepted): the candidate stays for a retry.
		try {
			await player.next();
			expect.unreachable();
		} catch (error) {
			expect(errorCode(error)).toBe('submitFailed');
		}
		expect(player.getCurrentItem()?.identifier).toBe('i3');
		expect(counting.submittedItems).toEqual(['i1']);

		// The retry submits the rest and follows the decision made for the part's last item.
		await player.next();
		expect(player.getCurrentItem()?.identifier).toBe('i5');
		expect(counting.submittedItems).toEqual(['i1', 'i2', 'i3']);
	});

	test('8d. simultaneous part: an EXIT_TEST decision at the crossing finalizes once without navigating', async () => {
		const xml = assessmentTest(
			`${part(
				'part-1',
				section('s1', `${ref('i1')}${ref('i2')}${ref('i3')}`),
				{
					navigationMode: 'nonlinear',
					submissionMode: 'simultaneous',
					branchRule: branchRule('EXIT_TEST', `<gte><variable identifier="i3.SCORE"/><baseValue baseType="float">1</baseValue></gte>`),
				},
			)}${part('part-2', section('s2', ref('i4')), { navigationMode: 'nonlinear' })}`,
		);
		const { parsed, backend } = await referenceBackend(convert, xml, items('i1', 'i2', 'i3', 'i4'));
		const counting = new CountingBackend(backend);
		let completions = 0;
		const player = await makePlayer(counting, parsed.identifier, () => {
			completions += 1;
		});

		player.updateResponse('RESPONSE', 'A');
		await player.navigateTo(1);
		player.updateResponse('RESPONSE', 'A');
		await player.navigateTo(2);
		player.updateResponse('RESPONSE', 'A');

		await player.next();

		// The part's rule fired EXIT_TEST after its flush: the test ends where it stands.
		expect(completions).toBe(1);
		expect(counting.finalizeCalls).toBe(1);
		expect(player.getCurrentItem()?.identifier).toBe('i3');
		expect(player.getNavigationState().isComplete).toBe(true);
		expect(player.getNavigationState().canNext).toBe(false);
		expect(player.getEndReason()).toBe('branch');
		expect(counting.submittedItems).toEqual(['i1', 'i2', 'i3']);

		// Submitting again returns the same results without a second finalization.
		const results = await player.submit();
		expect(counting.finalizeCalls).toBe(1);
		expect(completions).toBe(1);
		expect(results.itemResults.map((result) => result.itemIdentifier)).toEqual(['i1', 'i2', 'i3']);
	});
});
