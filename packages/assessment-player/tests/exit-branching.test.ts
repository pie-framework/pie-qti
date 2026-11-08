/**
 * QTI branchRule EXIT_* targets (issue: EXIT_* branching).
 *
 * EXIT_TEST terminates the test: remaining items are not presented and the test is
 * finalized exactly like a normal end of test (pending simultaneous responses submitted,
 * outcome processing run, results produced). EXIT_TESTPART / EXIT_SECTION continue with
 * the next item outside the ended scope, finalizing the ended part (or the test) when
 * nothing follows. After the end, navigation is impossible.
 *
 * Every case is driven from raw assessmentTest XML. EXIT_TEST runs through the reference
 * backend's real branch-rule evaluation; the literal EXIT_TESTPART / EXIT_SECTION
 * responses (which production backends may return) are scripted on top of the reference
 * adapter so scoring and persistence stay real.
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

const ref = (identifier: string, inner = '') =>
	`<assessmentItemRef identifier="${identifier}" href="${identifier}.xml">${inner}</assessmentItemRef>`;
const section = (identifier: string, inner: string, attrs = '') =>
	`<assessmentSection identifier="${identifier}" title="${identifier}" visible="true" ${attrs}>${inner}</assessmentSection>`;
const part = (
	identifier: string,
	inner: string,
	{ navigationMode = 'linear', submissionMode = 'individual' }: { navigationMode?: string; submissionMode?: string } = {},
) =>
	`<testPart identifier="${identifier}" navigationMode="${navigationMode}" submissionMode="${submissionMode}">${inner}</testPart>`;
const assessmentTest = (inner: string) =>
	`<assessmentTest ${NS} identifier="exit-branching" title="Exit branching">${inner}</assessmentTest>`;
const exitTestOnScore = (variable: string) =>
	`<branchRule target="EXIT_TEST"><gte><variable identifier="${variable}"/><baseValue baseType="float">1</baseValue></gte></branchRule>`;

const items = (...ids: string[]) => Object.fromEntries(ids.map((id) => [id, choiceItem(id)]));

const VERSIONS = {
	'QTI 2.2': (xml: string) => xml,
	'QTI 3.0': (xml: string) => convertQti2ToQti3(xml),
};
type Version = keyof typeof VERSIONS;

afterEach(() => localStorage.clear());

/** Real reference backend for parsing, scoring and persistence. */
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

/** Delegating wrapper that scripts the backend's branching decision for chosen items. */
class ScriptedNextBackend extends CountingBackend {
	constructor(
		inner: BackendAdapter,
		private readonly script: Record<string, string>,
	) {
		super(inner);
	}
	async submitResponses(request: SubmitResponsesRequest): Promise<SubmitResponsesResponse> {
		const res = await super.submitResponses(request);
		const scripted = this.script[request.itemIdentifier];
		return scripted ? { ...res, nextItemIdentifier: scripted } : res;
	}
}

async function makePlayer(backend: BackendAdapter, assessmentId: string, onComplete: () => void = () => {}) {
	localStorage.clear();
	const player = await AssessmentPlayer.create({
		backend,
		initSession: { assessmentId, candidateId: 'candidate' },
		onComplete,
	});
	await player.navigateTo(0);
	return player;
}

function errorCode(error: unknown): string {
	expect(isAssessmentPlayerError(error)).toBe(true);
	return (error as AssessmentPlayerError).code;
}

describe.each(Object.keys(VERSIONS) as Version[])('%s EXIT_TEST branching', (version) => {
	test('finalizes like a normal end of test and closes navigation', async () => {
		const convert = VERSIONS[version];
		const xml = assessmentTest(part('part-1', section('s1', `${ref('i1', exitTestOnScore('i1.SCORE'))}${ref('i2')}`)));
		const { parsed, backend } = await referenceBackend(convert, xml, items('i1', 'i2'));
		const counting = new CountingBackend(backend);
		let completions = 0;
		const player = await makePlayer(counting, parsed.identifier, () => {
			completions += 1;
		});
		expect(player.getCurrentItem()?.identifier).toBe('i1');

		player.updateResponse('RESPONSE', 'A');
		await player.next();

		// The correct answer scores 1, the branch rule fires EXIT_TEST, the test finalizes.
		expect(completions).toBe(1);
		expect(counting.finalizeCalls).toBe(1);
		expect(player.getNavigationState().isComplete).toBe(true);
		expect(player.getNavigationState().canNext).toBe(false);
		expect(player.getNavigationState().canPrevious).toBe(false);

		// Remaining items are not presented; navigation after the end is impossible.
		expect(player.getCurrentItem()?.identifier).toBe('i1');
		try {
			await player.navigateTo(1);
			expect.unreachable();
		} catch (error) {
			expect(errorCode(error)).toBe('testFinalized');
		}
		try {
			await player.navigateToSection('s1');
			expect.unreachable();
		} catch (error) {
			expect(errorCode(error)).toBe('testFinalized');
		}

		// Further next() is a no-op and submit() returns the same results without re-finalizing.
		await player.next();
		const results = await player.submit();
		expect(counting.finalizeCalls).toBe(1);
		expect(completions).toBe(1);
		expect(results.itemResults.map((r) => r.itemIdentifier)).toEqual(['i1']);
	});

	test('submits pending simultaneous responses before finalizing', async () => {
		const convert = VERSIONS[version];
		const xml = assessmentTest(
			`${part('part-1', section('s1', ref('i1', exitTestOnScore('i1.SCORE'))))}`
			+ `${part('part-2', section('s2', `${ref('i2')}${ref('i3')}`), { submissionMode: 'simultaneous' })}`,
		);
		const { parsed, backend } = await referenceBackend(convert, xml, items('i1', 'i2', 'i3'));
		const counting = new CountingBackend(backend);
		let completions = 0;
		const player = await makePlayer(counting, parsed.identifier, () => {
			completions += 1;
		});

		player.updateResponse('RESPONSE', 'A');
		await player.next();

		// EXIT_TEST on the individual item also flushes the untouched simultaneous part.
		expect(completions).toBe(1);
		expect(counting.finalizeCalls).toBe(1);
		expect(counting.submittedItems.sort()).toEqual(['i1', 'i2', 'i3']);
		const results = await player.submit();
		expect(results.itemResults.map((r) => r.itemIdentifier).sort()).toEqual(['i1', 'i2', 'i3']);
	});
});

describe('EXIT_TESTPART branching', () => {
	test('continues with the next test part', async () => {
		const xml = assessmentTest(
			`${part('part-1', section('s1', ref('i1')))}${part('part-2', section('s2', ref('i2')))}`,
		);
		const { parsed, backend } = await referenceBackend((x) => x, xml, items('i1', 'i2'));
		const scripted = new ScriptedNextBackend(backend, { i1: 'EXIT_TESTPART' });
		let completions = 0;
		const player = await makePlayer(scripted, parsed.identifier, () => {
			completions += 1;
		});

		player.updateResponse('RESPONSE', 'A');
		await player.next();

		expect(player.getCurrentItem()?.identifier).toBe('i2');
		expect(scripted.finalizeCalls).toBe(0);
		expect(completions).toBe(0);
		expect(player.getNavigationState().isComplete).not.toBe(true);
	});

	test('finalizes the test when no test part follows', async () => {
		const xml = assessmentTest(part('part-1', section('s1', ref('i1'))));
		const { parsed, backend } = await referenceBackend((x) => x, xml, items('i1'));
		const scripted = new ScriptedNextBackend(backend, { i1: 'EXIT_TESTPART' });
		let completions = 0;
		const player = await makePlayer(scripted, parsed.identifier, () => {
			completions += 1;
		});

		player.updateResponse('RESPONSE', 'A');
		// The only item has no Next; the decision arrives through its submission.
		await player.submitCurrentItem();

		expect(completions).toBe(1);
		expect(scripted.finalizeCalls).toBe(1);
		expect(player.getNavigationState().isComplete).toBe(true);
	});
});

describe('EXIT_SECTION branching', () => {
	test('continues after the current section', async () => {
		const xml = assessmentTest(
			part('part-1', `${section('s1', `${ref('i1')}${ref('i2')}`)}${section('s2', ref('i3'))}`),
		);
		const { parsed, backend } = await referenceBackend((x) => x, xml, items('i1', 'i2', 'i3'));
		const scripted = new ScriptedNextBackend(backend, { i2: 'EXIT_SECTION' });
		const player = await makePlayer(scripted, parsed.identifier);

		player.updateResponse('RESPONSE', 'A');
		await player.next();
		expect(player.getCurrentItem()?.identifier).toBe('i2');

		await player.next();
		// The section ended; delivery continues with the next item outside it.
		expect(player.getCurrentItem()?.identifier).toBe('i3');
		expect(scripted.finalizeCalls).toBe(0);
	});

	test('finalizes when nothing follows in the test part or the test', async () => {
		const xml = assessmentTest(part('part-1', section('s1', `${ref('i1')}${ref('i2')}`)));
		const { parsed, backend } = await referenceBackend((x) => x, xml, items('i1', 'i2'));
		const scripted = new ScriptedNextBackend(backend, { i2: 'EXIT_SECTION' });
		let completions = 0;
		const player = await makePlayer(scripted, parsed.identifier, () => {
			completions += 1;
		});

		player.updateResponse('RESPONSE', 'A');
		await player.next();
		// i2 is the last item: the EXIT_SECTION decision arrives through its submission.
		await player.submitCurrentItem();

		expect(completions).toBe(1);
		expect(scripted.finalizeCalls).toBe(1);
		expect(player.getNavigationState().isComplete).toBe(true);
	});

	test('submits the ended part\'s pending simultaneous responses before crossing parts', async () => {
		const xml = assessmentTest(
			`${part('part-1', section('s1', `${ref('i1')}${ref('i2')}`), { submissionMode: 'simultaneous' })}`
			+ `${part('part-2', section('s2', ref('i3')))}`,
		);
		const { parsed, backend } = await referenceBackend((x) => x, xml, items('i1', 'i2', 'i3'));
		const scripted = new ScriptedNextBackend(backend, { i2: 'EXIT_SECTION' });
		const player = await makePlayer(scripted, parsed.identifier);

		// Move to i2 without submitting (simultaneous part), then end the section.
		await player.next();
		expect(player.getCurrentItem()?.identifier).toBe('i2');
		player.updateResponse('RESPONSE', 'A');
		await player.submitCurrentItem();

		// i1's saved response was flushed with the ended part; delivery continues in part 2.
		expect(scripted.submittedItems).toContain('i1');
		expect(scripted.submittedItems).toContain('i2');
		expect(player.getCurrentItem()?.identifier).toBe('i3');
		expect(scripted.finalizeCalls).toBe(0);
	});

	test('resolves over the enclosing chain: an outer-section EXIT leaves the whole outer section', async () => {
		// part-1 { outer { inner-a { i1, i2 } , inner-b { i3 } } }, part-2 { i4 }.
		// EXIT_SECTION on i2 — the inner section's boundary — continues with i3 inside the
		// outer section. EXIT_SECTION on i3 — the item where the whole outer section ends —
		// leaves the outer section entirely and crosses into part 2.
		const xml = assessmentTest(
			part(
				'part-1',
				section('outer', `${section('inner-a', `${ref('i1')}${ref('i2')}`)}${section('inner-b', ref('i3'))}`),
			) + part('part-2', section('s2', ref('i4'))),
		);
		const { parsed, backend } = await referenceBackend((x) => x, xml, items('i1', 'i2', 'i3', 'i4'));
		const scripted = new ScriptedNextBackend(backend, { i2: 'EXIT_SECTION', i3: 'EXIT_SECTION' });
		const player = await makePlayer(scripted, parsed.identifier);

		player.updateResponse('RESPONSE', 'A');
		await player.next();
		expect(player.getCurrentItem()?.identifier).toBe('i2');
		player.updateResponse('RESPONSE', 'A');
		await player.submitCurrentItem();
		// The inner section ended; the outer section continues with its next child.
		expect(player.getCurrentItem()?.identifier).toBe('i3');
		expect(scripted.finalizeCalls).toBe(0);

		player.updateResponse('RESPONSE', 'A');
		await player.submitCurrentItem();
		// i3 ends the whole outer section: delivery crosses into part 2, outside outer.
		expect(player.getCurrentItem()?.identifier).toBe('i4');
		expect(scripted.finalizeCalls).toBe(0);
	});
});
