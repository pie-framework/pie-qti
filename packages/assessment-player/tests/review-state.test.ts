/**
 * Candidate review state: the shared "answered" definition, per-item flags for review,
 * the review-screen views and the forward-transition warning info.
 *
 * One helper decides what "answered" means (a non-null, non-empty response, per
 * interaction for composite items), and one set of player APIs feeds the review screen,
 * the section menu and the submit confirmation.
 */

import './setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { AssessmentPlayer } from '../src/core/AssessmentPlayer.js';
import {
	interactionResponseIdentifiers,
	isAnsweredValue,
	itemAnswerStatus,
	itemTitleFromXml,
} from '../src/core/reviewState.js';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

const SINGLE_ITEM = (identifier: string) => `<assessmentItem ${NS} identifier="${identifier}" title="Choice ${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <itemBody><p>Question ${identifier}</p><choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice><simpleChoice identifier="B">B</simpleChoice></choiceInteraction></itemBody>
</assessmentItem>`;

/** A composite item: two interactions bound to two response declarations. */
const COMPOSITE_ITEM = `<assessmentItem ${NS} identifier="composite" title="Two interactions" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <responseDeclaration identifier="RESPONSE2" cardinality="single" baseType="identifier"/>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice></choiceInteraction>
    <choiceInteraction responseIdentifier="RESPONSE2" maxChoices="1"><simpleChoice identifier="C">C</simpleChoice></choiceInteraction>
  </itemBody>
</assessmentItem>`;

const QTI3_ITEM = `<qti-assessment-item xmlns="https://purl.imsglobal.org/spec/qti/v3p0" identifier="q3" title="QTI 3 item">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-item-body><qti-choice-interaction response-identifier="RESPONSE" max-choices="1"><qti-simple-choice identifier="A">A</qti-simple-choice></qti-choice-interaction></qti-item-body>
</qti-assessment-item>`;

/** Part 1 is linear; part 2 nonlinear, so review views expose both behaviours. */
function buildAssessment() {
	return `<assessmentTest ${NS} identifier="REVIEW-001" title="Review test">
  <testPart identifier="part-1" navigationMode="linear" submissionMode="simultaneous">
    <assessmentSection identifier="s1" title="Part One" visible="true">
      <assessmentItemRef identifier="l1" href="l1.xml"/>
      <assessmentItemRef identifier="l2" href="l2.xml"/>
    </assessmentSection>
  </testPart>
  <testPart identifier="part-2" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSection identifier="s2" title="Part Two" visible="true">
      <assessmentItemRef identifier="c1" href="c1.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;
}

const ITEM_XML_MAP = {
	'l1.xml': SINGLE_ITEM('l1'),
	'l2.xml': SINGLE_ITEM('l2'),
	'c1.xml': COMPOSITE_ITEM.replace('identifier="composite"', 'identifier="c1"'),
};

async function createPlayer(): Promise<AssessmentPlayer> {
	const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(buildAssessment(), {
		itemXmlMap: ITEM_XML_MAP,
	});
	const backend = new ReferenceBackendAdapter();
	backend.registerAssessment(parsed.identifier, parsed);
	return AssessmentPlayer.create({
		backend,
		initSession: { assessmentId: parsed.identifier, candidateId: 'candidate' },
	});
}

afterEach(() => localStorage.clear());

describe('answered-state helpers', () => {
	test('isAnsweredValue treats null, blank and empty values as unanswered', () => {
		expect(isAnsweredValue(undefined)).toBe(false);
		expect(isAnsweredValue(null)).toBe(false);
		expect(isAnsweredValue('')).toBe(false);
		expect(isAnsweredValue('   ')).toBe(false);
		expect(isAnsweredValue([])).toBe(false);
		expect(isAnsweredValue([''])).toBe(false);
		expect(isAnsweredValue({})).toBe(false);
		expect(isAnsweredValue('A')).toBe(true);
		expect(isAnsweredValue(['A', ''])).toBe(true);
		expect(isAnsweredValue({ g1: 'A' })).toBe(true);
	});

	test('itemAnswerStatus: single-interaction items are answered or unanswered only', () => {
		expect(itemAnswerStatus({}, ['RESPONSE'])).toBe('unanswered');
		expect(itemAnswerStatus({ RESPONSE: null }, ['RESPONSE'])).toBe('unanswered');
		expect(itemAnswerStatus({ RESPONSE: 'A' }, ['RESPONSE'])).toBe('answered');
	});

	test('itemAnswerStatus: composite items can be partially answered', () => {
		expect(itemAnswerStatus({ RESPONSE: 'A', RESPONSE2: 'C' }, ['RESPONSE', 'RESPONSE2'])).toBe('answered');
		expect(itemAnswerStatus({ RESPONSE: 'A' }, ['RESPONSE', 'RESPONSE2'])).toBe('partiallyAnswered');
		expect(itemAnswerStatus({}, ['RESPONSE', 'RESPONSE2'])).toBe('unanswered');
	});

	test('interactionResponseIdentifiers reads QTI 2.x and QTI 3.0 items', () => {
		expect(interactionResponseIdentifiers(SINGLE_ITEM('x'))).toEqual(['RESPONSE']);
		expect(interactionResponseIdentifiers(COMPOSITE_ITEM)).toEqual(['RESPONSE', 'RESPONSE2']);
		expect(interactionResponseIdentifiers(QTI3_ITEM)).toEqual(['RESPONSE']);
	});

	test('itemTitleFromXml reads the item root title', () => {
		expect(itemTitleFromXml(SINGLE_ITEM('x'))).toBe('Choice x');
		expect(itemTitleFromXml(QTI3_ITEM)).toBe('QTI 3 item');
		expect(itemTitleFromXml('<assessmentItem identifier="t"><itemBody/></assessmentItem>')).toBeUndefined();
	});
});

describe('player review APIs', () => {
	test('statuses come from the core responses, per interaction for composite items', async () => {
		const player = await createPlayer();
		try {
			// Nothing answered yet: everything unanswered, none visited.
			const before = player.getReviewItems();
			expect(before.map((item) => item.status)).toEqual(['unanswered', 'unanswered', 'unanswered']);
			expect(before.map((item) => item.number)).toEqual([1, 2, 3]);
			expect(before.map((item) => item.visited)).toEqual([true, false, false]);

			await player.navigateTo(1);
			await player.navigateTo(2); // the composite item in part 2, after leaving part 1
			player.updateResponseForItem('c1', 'RESPONSE', 'A');
			expect(player.getItemAnswerStatus('c1')).toBe('partiallyAnswered');
			player.updateResponseForItem('c1', 'RESPONSE2', 'C');
			expect(player.getItemAnswerStatus('c1')).toBe('answered');
			expect(player.getAnsweredItemCount()).toBe(1);

			player.updateResponseForItem('c1', 'RESPONSE2', '');
			expect(player.getItemAnswerStatus('c1')).toBe('partiallyAnswered');
		} finally {
			player.destroy();
		}
	});

	test('jump legality follows the navigation rules; linear parts list forward-only targets', async () => {
		const player = await createPlayer();
		try {
			// On l1 (linear part 1): staying is legal, the immediate next item is reachable,
			// part 2 is not.
			expect(player.isNavigationTargetLegal(0)).toBe(true);
			expect(player.isNavigationTargetLegal(1)).toBe(true);
			expect(player.isNavigationTargetLegal(2)).toBe(false);
			let items = player.getReviewItems();
			expect(items.map((item) => item.jumpAllowed)).toEqual([true, true, false]);

			await player.navigateTo(1);
			await player.navigateTo(2);
			// From part 2 nothing earlier can be reached.
			items = player.getReviewItems();
			expect(items.map((item) => item.jumpAllowed)).toEqual([false, false, true]);
			expect(items.filter((item) => !item.jumpAllowed).every((item) => !item.isCurrent)).toBe(true);
		} finally {
			player.destroy();
		}
	});

	test('flags live in the session state, survive navigation and ride the save snapshot', async () => {
		const player = await createPlayer();
		try {
			expect(player.isItemFlagged()).toBe(false);
			expect(player.toggleItemFlag()).toBe(true);
			expect(player.isItemFlagged('l1')).toBe(true);
			expect(player.getFlaggedItemIdentifiers()).toEqual(['l1']);

			await player.navigateTo(1);
			expect(player.isItemFlagged()).toBe(false);
			expect(player.isItemFlagged('l1')).toBe(true);

			let flagged = player.getReviewItems().filter((item) => item.flagged);
			expect(flagged.map((item) => item.identifier)).toEqual(['l1']);

			player.setItemFlag(false, 'l1');
			expect(player.getFlaggedItemIdentifiers()).toEqual([]);

			player.setItemFlag(true, 'l2');
			const snapshot = player.getState();
			expect(snapshot.itemFlags).toEqual({ l2: true });
		} finally {
			player.destroy();
		}
	});

	test('restoreState rehydrates flags', async () => {
		const player = await createPlayer();
		let snapshot;
		try {
			player.setItemFlag(true, 'c1');
			snapshot = player.getState();
		} finally {
			player.destroy();
		}

		const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(buildAssessment(), {
			itemXmlMap: ITEM_XML_MAP,
		});
		const backend = new ReferenceBackendAdapter();
		backend.registerAssessment(parsed.identifier, parsed);
		const restored = await AssessmentPlayer.create({
			backend,
			initSession: { assessmentId: parsed.identifier, candidateId: 'candidate' },
		});
		try {
			await restored.restoreState(snapshot);
			expect(restored.isItemFlagged('c1')).toBe(true);
		} finally {
			restored.destroy();
		}
	});

	test('getForwardTransitionInfo warns where the next step leaves the current test part', async () => {
		const player = await createPlayer();
		try {
			expect(player.getForwardTransitionInfo()).toEqual({ nextIndex: 1, leavesTestPart: false });
			await player.navigateTo(1);
			expect(player.getForwardTransitionInfo()).toEqual({ nextIndex: 2, leavesTestPart: true });
			await player.navigateTo(2);
			// No further item: nothing to warn about.
			expect(player.getForwardTransitionInfo()).toEqual({ nextIndex: null, leavesTestPart: false });
		} finally {
			player.destroy();
		}
	});
});
