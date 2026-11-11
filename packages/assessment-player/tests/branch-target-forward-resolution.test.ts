/**
 * Branch-rule target resolution is forward-only everywhere (QTI 2.2 §5.15: the test "jumps
 * forward" and the target must refer to an item or section that has not yet been presented, so
 * a delivered test never re-enters an earlier one).
 *
 * The reference backend (`testStructure.resolveBranchTarget`) and the client
 * (`exitBoundaries.branchTargetIndex`, `AssessmentPlayer.followBranch`) resolve the same
 * authored XML through one shared helper (`firstForwardBranchTarget`); the parity pins below
 * keep the two engines from drifting apart again. A target naming an already-presented item is
 * skipped — delivery falls through to the next item, exactly as the backend's own walk falls
 * through from an unresolvable target — or lands on the target's first forward occurrence when
 * its identifier names something presented again later.
 *
 * The player cases are driven from raw assessmentTest XML: the backend leg runs authored
 * backward-target rules through the real reference backend's branch-rule evaluation, the client
 * leg scripts the same raw target on top of the adapter (what a production backend returning
 * raw decisions would deliver). Both must land on the same item.
 */

import './setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { AssessmentPlayer } from '../src/core/AssessmentPlayer.js';
import { flattenItems } from '../src/core/deliveryStructure.js';
import { branchExitLeavesPart, branchTargetIndex } from '../src/core/exitBoundaries.js';
import {
	deliveredItems,
	firstForwardBranchTarget,
	type ScopedDeliveredItem,
} from '../src/core/testStructure.js';
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
	`<assessmentTest ${NS} identifier="branch-target-resolution" title="Branch target resolution">${inner}</assessmentTest>`;
/** A rule on `holder` that fires once `holder` scored 1 (the correct answer) and names `target`. */
const branchRuleTo = (holder: string, target: string) =>
	`<branchRule target="${target}"><gte><variable identifier="${holder}.SCORE"/><baseValue baseType="float">1</baseValue></gte></branchRule>`;

const items = (...ids: string[]) => Object.fromEntries(ids.map((id) => [id, choiceItem(id)]));

/** Two counted attempts with revealed feedback: the check control's requirement. */
const twoAttempts = `<itemSessionControl maxAttempts="2" showFeedback="true"/>`;

afterEach(() => localStorage.clear());

/** The parsed assessment and a real reference backend registered for it. */
async function referenceBackend(testXml: string, itemsMap: Record<string, string>) {
	const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(testXml, {
		itemXmlMap: Object.fromEntries(Object.entries(itemsMap).map(([id, xml]) => [`${id}.xml`, xml])),
	});
	const backend = new ReferenceBackendAdapter();
	backend.registerAssessment(parsed.identifier, parsed);
	return { parsed, backend };
}

/** Delegating wrapper that scripts the backend's branching decision for chosen items. */
class ScriptedNextBackend implements BackendAdapter {
	constructor(
		private readonly inner: BackendAdapter,
		private readonly script: Record<string, string>,
	) {}
	async initSession(request: InitSessionRequest): Promise<InitSessionResponse> {
		return this.inner.initSession(request);
	}
	async saveState(request: SaveAssessmentStateRequest): Promise<SaveAssessmentStateResponse> {
		return this.inner.saveState(request);
	}
	async finalizeAssessment(request: FinalizeAssessmentRequest): Promise<FinalizeAssessmentResponse> {
		return this.inner.finalizeAssessment(request);
	}
	async submitResponses(request: SubmitResponsesRequest): Promise<SubmitResponsesResponse> {
		const res = await this.inner.submitResponses(request);
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

describe('firstForwardBranchTarget (the shared literal-target resolver)', () => {
	const delivered: ScopedDeliveredItem[] = [
		{ item: { identifier: 'i1' }, sections: [{ identifier: 'dup' }], testPart: { identifier: 'part-1' } },
		{ item: { identifier: 'i2' }, sections: [{ identifier: 'dup' }], testPart: { identifier: 'part-1' } },
		{ item: { identifier: 'i3' }, sections: [{ identifier: 'dup' }], testPart: { identifier: 'part-2' } },
	];

	test('never resolves backwards: an already-presented target resolves to nothing', () => {
		expect(firstForwardBranchTarget('i1', delivered, 1)).toBeUndefined();
		expect(firstForwardBranchTarget('i1', delivered, 2)).toBeUndefined();
		expect(firstForwardBranchTarget('i2', delivered, 2)).toBeUndefined();
	});

	test('resolves to the first forward occurrence when the identifier is presented again later', () => {
		// The section identifier `dup` is presented in both parts: from inside part-1 the
		// target lands on its later occurrence (i3), never on the presented one (i1).
		expect(firstForwardBranchTarget('dup', delivered, 1)).toBe(2);
		expect(firstForwardBranchTarget('part-2', delivered, 0)).toBe(2);
		expect(firstForwardBranchTarget('i3', delivered, 1)).toBe(2);
	});

	test('tries item, then section, then test part, each pass over all remaining items', () => {
		// `sX` names a section presented at index 1 and an item presented at index 2: the
		// item pass runs before the section pass, so the item match wins over the earlier
		// section match — the QTI target resolution order, not the nearest match.
		const order: ScopedDeliveredItem[] = [
			{ item: { identifier: 'i1' }, sections: [{ identifier: 'sA' }], testPart: { identifier: 'p1' } },
			{ item: { identifier: 'i2' }, sections: [{ identifier: 'sX' }], testPart: { identifier: 'p1' } },
			{ item: { identifier: 'sX' }, sections: [{ identifier: 'sX' }], testPart: { identifier: 'p1' } },
		];
		expect(firstForwardBranchTarget('sX', order, 0)).toBe(2);
		// From the item itself, the earlier matches are behind and are not honored.
		expect(firstForwardBranchTarget('sX', order, 2)).toBeUndefined();
	});

	test('an unknown target resolves to nothing', () => {
		expect(firstForwardBranchTarget('nowhere', delivered, 0)).toBeUndefined();
	});
});

describe('client and backend resolvers agree', () => {
	test('branchTargetIndex matches the shared forward resolution for every item and target', async () => {
		const xml = assessmentTest(
			part('part-1', `${section('s1', `${ref('i1')}${ref('i2')}`)}${section('s2', ref('i3'))}`)
				+ part('part-2', section('s3', ref('i4'))),
		);
		const { parsed } = await referenceBackend(xml, items('i1', 'i2', 'i3', 'i4'));
		const delivered = deliveredItems(parsed);
		const flat = flattenItems(parsed);
		const targets = new Set<string>(['missing-target']);
		for (const item of delivered) {
			targets.add(item.item.identifier);
			for (const scoped of item.sections) targets.add(scoped.identifier);
			targets.add(item.testPart.identifier);
		}
		for (let index = 0; index < flat.length; index++) {
			for (const target of targets) {
				expect(branchTargetIndex(flat[index]!, target, flat, index)).toBe(
					firstForwardBranchTarget(target, delivered, index) ?? -1,
				);
			}
		}
		// A backward target never lands behind: it resolves to nothing forward.
		expect(branchTargetIndex(flat[1]!, 'i1', flat, 1)).toBe(-1);
		expect(branchTargetIndex(flat[3]!, 's1', flat, 3)).toBe(-1);
	});

	test('a skipped literal crosses no test part boundary', async () => {
		const xml = assessmentTest(part('part-1', section('s1', `${ref('i1')}${ref('i2')}`)));
		const { parsed } = await referenceBackend(xml, items('i1', 'i2'));
		const flat = flattenItems(parsed);
		// A target with no forward occurrence is skipped — the rule does not fire — so it
		// takes delivery nowhere, in particular not out of the part.
		expect(branchExitLeavesPart(flat[1]!, 'i1', flat, 1)).toBe(false);
		// A forward literal in the same part does not leave either; an EXIT does.
		expect(branchExitLeavesPart(flat[0]!, 'i2', flat, 0)).toBe(false);
		expect(branchExitLeavesPart(flat[1]!, 'EXIT_TEST', flat, 1)).toBe(true);
	});
});

describe('backward branch targets in delivery', () => {
	test('a decision onto a presented item falls through forward — the authored rule on the same XML lands identically', async () => {
		// Client path: a production backend may return the raw rule target; the player must
		// not hop back to the presented i1 but fall through, as the backend's own walk does.
		const xml = assessmentTest(part('part-1', section('s1', `${ref('i1')}${ref('i2')}${ref('i3')}`)));
		const { parsed, backend } = await referenceBackend(xml, items('i1', 'i2', 'i3'));
		let completions = 0;
		const player = await makePlayer(new ScriptedNextBackend(backend, { i2: 'i1' }), parsed.identifier, () => {
			completions += 1;
		});

		player.updateResponse('RESPONSE', 'A');
		await player.next();
		expect(player.getCurrentItem()?.identifier).toBe('i2');

		player.updateResponse('RESPONSE', 'A');
		await player.next();
		// The backward target is skipped: delivery falls through to i3, never re-entering i1.
		expect(player.getCurrentItem()?.identifier).toBe('i3');
		expect(completions).toBe(0);
		expect(player.getNavigationState().isComplete).not.toBe(true);

		// Backend path: the same XML with the rule authored on i2 (the reference backend's
		// real branch-rule evaluation) resolves the same unresolvable target to the same
		// fall-through landing.
		const backendXml = assessmentTest(
			part('part-1', section('s1', `${ref('i1')}${ref('i2', branchRuleTo('i2', 'i1'))}${ref('i3')}`)),
		);
		const backendParsed = await referenceBackend(backendXml, items('i1', 'i2', 'i3'));
		const backendPlayer = await makePlayer(backendParsed.backend, backendParsed.parsed.identifier);
		backendPlayer.updateResponse('RESPONSE', 'A');
		await backendPlayer.next();
		expect(backendPlayer.getCurrentItem()?.identifier).toBe('i2');
		backendPlayer.updateResponse('RESPONSE', 'A');
		await backendPlayer.next();
		expect(backendPlayer.getCurrentItem()?.identifier).toBe('i3');
	});

	test('a backward target on the last item skips; the test ends through submit only', async () => {
		const xml = assessmentTest(part('part-1', section('s1', `${ref('i1')}${ref('i2')}`)));
		const { parsed, backend } = await referenceBackend(xml, items('i1', 'i2'));
		let completions = 0;
		const player = await makePlayer(new ScriptedNextBackend(backend, { i2: 'i1' }), parsed.identifier, () => {
			completions += 1;
		});

		player.updateResponse('RESPONSE', 'A');
		await player.next();
		expect(player.getCurrentItem()?.identifier).toBe('i2');

		player.updateResponse('RESPONSE', 'A');
		await player.submitCurrentItem();
		// The decision cannot be followed forward and does not re-enter i1; nothing follows,
		// so delivery stands on i2 and the skipped rule does not finalize the test.
		expect(player.getCurrentItem()?.identifier).toBe('i2');
		expect(completions).toBe(0);
		expect(player.getNavigationState().isComplete).not.toBe(true);

		const results = await player.submit();
		expect(completions).toBe(1);
		expect(results.itemResults.map((r) => r.itemIdentifier)).toEqual(['i1', 'i2']);
	});

	test('a target presented again later lands on its forward occurrence', async () => {
		// part-1 { dup { i1, i2 } }, part-2 { dup { i3 } }: a decision naming `dup` from i2
		// must land on the later `dup` (i3), not re-enter the presented one (i1).
		const xml = assessmentTest(
			`${part('part-1', section('dup', `${ref('i1')}${ref('i2')}`))}${part('part-2', section('dup', ref('i3')))}`,
		);
		const { parsed, backend } = await referenceBackend(xml, items('i1', 'i2', 'i3'));
		const player = await makePlayer(new ScriptedNextBackend(backend, { i2: 'dup' }), parsed.identifier);

		player.updateResponse('RESPONSE', 'A');
		await player.next();
		expect(player.getCurrentItem()?.identifier).toBe('i2');

		player.updateResponse('RESPONSE', 'A');
		await player.next();
		expect(player.getCurrentItem()?.identifier).toBe('i3');
		expect(player.getNavigationState().isComplete).not.toBe(true);
	});
});

describe('a kept skipped literal: every consumer agrees', () => {
	test('resolver, boundary check, Next preview and Next itself all skip a kept backward decision identically', async () => {
		// A production backend may return the raw target for the check on i2; the decision
		// `i1` is kept (delivery stayed). The shared resolver resolves it to nothing
		// (forward-only), the part-boundary check has it cross no boundary, the Next preview
		// reports the delivery-rules step it falls through to, and Next lands exactly there —
		// one policy, so preview and landing cannot drift.
		const xml = assessmentTest(part('part-1', section('s1', `${ref('i1')}${ref('i2', twoAttempts)}${ref('i3')}`)));
		const { parsed, backend } = await referenceBackend(xml, items('i1', 'i2', 'i3'));
		const delivered = deliveredItems(parsed);
		const flat = flattenItems(parsed);
		let completions = 0;
		const player = await makePlayer(new ScriptedNextBackend(backend, { i2: 'i1' }), parsed.identifier, () => {
			completions += 1;
		});

		player.updateResponse('RESPONSE', 'A');
		await player.next();
		expect(player.getCurrentItem()?.identifier).toBe('i2');

		// With no decision on record the preview is the plain delivery-rules step (i3, same part).
		const previewWithoutDecision = player.getForwardTransitionInfo();
		expect(previewWithoutDecision).toEqual({ nextIndex: 2, leavesTestPart: false });

		// The check keeps the raw backward decision `i1` for i2; delivery stays on i2.
		await player.checkCurrentItem();
		expect(player.getCurrentItem()?.identifier).toBe('i2');

		// Every consumer of the decision agrees it is skipped.
		expect(firstForwardBranchTarget('i1', delivered, 1)).toBeUndefined();
		expect(branchTargetIndex(flat[1]!, 'i1', flat, 1)).toBe(-1);
		expect(branchExitLeavesPart(flat[1]!, 'i1', flat, 1)).toBe(false);

		// The preview with the kept decision reports the same step as with none.
		expect(player.getForwardTransitionInfo()).toEqual(previewWithoutDecision);

		// And Next lands exactly there — no re-entry of i1, no re-submission, no early end.
		await player.next();
		expect(player.getCurrentItem()?.identifier).toBe('i3');
		expect(completions).toBe(0);
		expect(player.getNavigationState().isComplete).not.toBe(true);
	});
});
