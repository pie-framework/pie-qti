/**
 * Navigation serialization (issue: navigation race).
 *
 * In individual submission mode Next submits before advancing. While that backend round
 * trip is in flight the core must not start a second transition: concurrent navigation
 * and submit calls reject as busy, `getNavigationState().isLoading` reflects the real
 * in-flight flag, and a failed submit leaves the candidate on the same item with the
 * response intact and retryable.
 *
 * The backend is a stub whose submitResponses returns a manually settled promise, driven
 * from a raw assessmentTest XML parsed by the reference parser.
 */

import './setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { AssessmentPlayer } from '../src/core/AssessmentPlayer.js';
import { AssessmentPlayerError, isAssessmentPlayerError } from '../src/core/errors.js';
import type {
	BackendAdapter,
	FinalizeAssessmentRequest,
	FinalizeAssessmentResponse,
	InitSessionRequest,
	InitSessionResponse,
	SaveAssessmentStateRequest,
	SaveAssessmentStateResponse,
	SubmitResponsesRequest,
	SubmitResponsesResponse,
} from '../src/integration/api-contract.js';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

const makeItem = (identifier: string) =>
	`<assessmentItem ${NS} identifier="${identifier}" title="${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"><correctResponse><value>A</value></correctResponse></responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"><defaultValue><value>0</value></defaultValue></outcomeDeclaration>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice><simpleChoice identifier="B">B</simpleChoice></choiceInteraction>
  </itemBody>
</assessmentItem>`;

const TEST_XML = `<assessmentTest ${NS} identifier="nav-race" title="Navigation race">
  <testPart identifier="part-1" navigationMode="linear" submissionMode="individual">
    <assessmentSection identifier="s1" title="Section 1" visible="true">
      <assessmentItemRef identifier="i1" href="i1.xml"/>
      <assessmentItemRef identifier="i2" href="i2.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

/** Backend with a manually settled submitResponses; everything else is a stub. */
class DeferredBackend implements BackendAdapter {
	readonly submitCalls: SubmitResponsesRequest[] = [];
	#pending: Array<{ resolve: (response: SubmitResponsesResponse) => void; reject: (error: unknown) => void }> = [];

	constructor(private readonly assessment: Awaited<ReturnType<typeof ReferenceBackendAdapter.parseAssessmentTestXml>>) {}

	async initSession(request: InitSessionRequest): Promise<InitSessionResponse> {
		const first = this.assessment.testParts[0]?.sections[0]?.assessmentItemRefs[0]?.identifier;
		return {
			sessionId: `${request.assessmentId}:${request.candidateId}:1`,
			assessment: this.assessment,
			currentItemIdentifier: first,
		};
	}
	async saveState(_request: SaveAssessmentStateRequest): Promise<SaveAssessmentStateResponse> {
		return { success: true, savedAt: Date.now() };
	}
	async finalizeAssessment(_request: FinalizeAssessmentRequest): Promise<FinalizeAssessmentResponse> {
		return { success: true, totalScore: 1, maxScore: 2, itemScores: {}, finalizedAt: Date.now() };
	}
	async submitResponses(request: SubmitResponsesRequest): Promise<SubmitResponsesResponse> {
		this.submitCalls.push(request);
		return new Promise<SubmitResponsesResponse>((resolve, reject) => {
			this.#pending.push({ resolve, reject });
		});
	}

	get hasPending(): boolean {
		return this.#pending.length > 0;
	}
	settle(response: SubmitResponsesResponse): void {
		const pending = this.#pending.shift();
		if (!pending) throw new Error('No pending submission to settle');
		pending.resolve(response);
	}
	fail(message: string): void {
		const pending = this.#pending.shift();
		if (!pending) throw new Error('No pending submission to fail');
		pending.reject(new Error(message));
	}
}

const scoringResult = (itemIdentifier: string) => ({
	itemIdentifier,
	score: 1,
	maxScore: 1,
	completed: true,
	outcomeValues: {},
});

function errorCode(error: unknown): string {
	expect(isAssessmentPlayerError(error)).toBe(true);
	return (error as AssessmentPlayerError).code;
}

afterEach(() => localStorage.clear());

async function makePlayer(backend: DeferredBackend): Promise<AssessmentPlayer> {
	const player = await AssessmentPlayer.create({
		backend,
		initSession: { assessmentId: 'nav-race', candidateId: 'candidate' },
	});
	await player.navigateTo(0);
	return player;
}

describe('navigation serialization', () => {
	test('a second next() while a submit is in flight is rejected as busy', async () => {
		const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(TEST_XML, {
			itemXmlMap: { 'i1.xml': makeItem('i1'), 'i2.xml': makeItem('i2') },
		});
		const backend = new DeferredBackend(parsed);
		const player = await makePlayer(backend);
		const busyEvents: boolean[] = [];
		player.onBusyChange((busy) => busyEvents.push(busy));

		player.updateResponse('RESPONSE', 'A');
		const first = player.next();
		expect(backend.hasPending).toBe(true);
		expect(backend.submitCalls.length).toBe(1);
		expect(player.getNavigationState().isLoading).toBe(true);
		expect(player.isBusy()).toBe(true);

		let secondError: unknown = null;
		const second = player.next().catch((error) => {
			secondError = error;
		});

		backend.settle({ success: true, result: scoringResult('i1') });
		await first;
		await second;

		expect(errorCode(secondError)).toBe('navigationInFlight');
		// The racing click did not cause a second submission or a discarded item.
		expect(backend.submitCalls.length).toBe(1);
		expect(player.getNavigationState().currentIndex).toBe(1);
		expect(player.getNavigationState().isLoading).toBe(false);
		expect(player.isBusy()).toBe(false);
		expect(busyEvents).toEqual([true, false]);
	});

	test('a failed submit keeps the candidate on the item with the response intact and retryable', async () => {
		const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(TEST_XML, {
			itemXmlMap: { 'i1.xml': makeItem('i1'), 'i2.xml': makeItem('i2') },
		});
		const backend = new DeferredBackend(parsed);
		const player = await makePlayer(backend);

		player.updateResponse('RESPONSE', 'A');
		const attempt = player.next();
		backend.fail('Backend exploded');
		await expect(attempt).rejects.toThrow('Backend exploded');

		// Still on the same item, response preserved, no attempt burned.
		expect(player.getNavigationState().currentIndex).toBe(0);
		expect(player.getResponses().RESPONSE).toBe('A');
		expect(player.isBusy()).toBe(false);
		expect(player.getItemSessionInfo()?.canSubmit).toBe(true);

		// Retry succeeds and advances.
		const retry = player.next();
		backend.settle({ success: true, result: scoringResult('i1') });
		await retry;
		expect(backend.submitCalls.length).toBe(2);
		expect(player.getNavigationState().currentIndex).toBe(1);
	});

	test('submit() is rejected while a navigation transition is in flight', async () => {
		const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(TEST_XML, {
			itemXmlMap: { 'i1.xml': makeItem('i1'), 'i2.xml': makeItem('i2') },
		});
		const backend = new DeferredBackend(parsed);
		const player = await makePlayer(backend);

		const inFlight = player.next();
		try {
			await player.submit();
			expect.unreachable();
		} catch (error) {
			expect(errorCode(error)).toBe('navigationInFlight');
		}

		backend.settle({ success: true, result: scoringResult('i1') });
		await inFlight;
		expect(backend.submitCalls.length).toBe(1);
	});
});
