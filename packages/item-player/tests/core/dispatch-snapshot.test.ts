/**
 * What a dispatch hands out, and how often it computes it.
 *
 * - One validation per dispatch: the serializer and the view's canSubmit read the SAME
 *   response-snapshot record at the same response revision, so the validation memo hits and
 *   the engine validates a candidate response change exactly once.
 * - One frozen snapshot per dispatch, shared by every listener: the transition is deeply
 *   frozen, so the frozen plain structure is shareable — no listener can observe another's
 *   view of it through mutation. What the platform cannot freeze (typed arrays) stays
 *   per-recipient; that isolation is pinned separately (see
 *   assessment-item-definition.test.ts "detaches drawing response data").
 * - The session view's variable records are independent of the engine: state() and the
 *   serializer hand out their own copies of typed-array payloads.
 */

import { describe, expect, test } from 'bun:test';
import { createAssessmentItemDefinition } from '../../src/core/AssessmentItemDefinition.js';
import type { ItemSessionTransition } from '../../src/core/ItemSession.js';
import { Player } from '../../src/core/Player.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

const CHOICE_ITEM = `<assessmentItem ${NS} identifier="dispatch-snapshot" adaptive="false" timeDependent="false">
	<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
	<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
	<itemBody>
		<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
			<simpleChoice identifier="A">A</simpleChoice>
			<simpleChoice identifier="B">B</simpleChoice>
		</choiceInteraction>
	</itemBody>
	<responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
</assessmentItem>`;

/** A drawing response travels typed-array pixels through views, transitions and snapshots. */
const DRAWING_ITEM = `<assessmentItem ${NS} identifier="dispatch-snapshot-drawing" adaptive="false" timeDependent="false">
	<responseDeclaration identifier="DRAW" cardinality="single" baseType="file"/>
	<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="integer"/>
	<itemBody>
		<drawingInteraction responseIdentifier="DRAW"><prompt>Draw</prompt></drawingInteraction>
	</itemBody>
</assessmentItem>`;

function plainNodesFrozen(value: unknown): boolean {
	if (!value || typeof value !== 'object') return true;
	if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return true;
	const prototype = Object.getPrototypeOf(value);
	if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return true;
	if (!Object.isFrozen(value)) return false;
	return Object.values(value as Record<string, unknown>).every((child) => plainNodesFrozen(child));
}

describe('dispatch hand-out', () => {
	test('a candidate response change validates exactly once', () => {
		// The two reads of one dispatch — the serializer's validation and the view's canSubmit —
		// both go through validateResponses; a memo hit returns the SAME result object, so the
		// number of distinct results is the number of computations.
		const results: unknown[] = [];
		const original = Player.prototype.validateResponses;
		Player.prototype.validateResponses = function (this: Player, responses) {
			const result = original.call(this, responses);
			results.push(result);
			return result;
		};
		const session = createAssessmentItemDefinition({ itemXml: CHOICE_ITEM }).openSession();
		try {
			results.length = 0;
			session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 'A' });
			expect(results.length).toBeGreaterThan(0);
			expect(new Set(results).size).toBe(1);
			expect(session.state().canSubmit).toBe(true);
		} finally {
			Player.prototype.validateResponses = original;
			session.dispose();
		}
	});

	test('every listener receives the same deeply frozen transition when nothing needs isolating', () => {
		const session = createAssessmentItemDefinition({ itemXml: CHOICE_ITEM }).openSession();
		try {
			const received: ItemSessionTransition[] = [];
			const unsubscribers = [0, 1, 2].map(() => session.subscribe((transition) => received.push(transition)));

			const returned = session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 'A' });

			expect(received).toHaveLength(3);
			for (const transition of received) {
				expect(transition).toBe(returned);
				expect(Object.isFrozen(transition)).toBe(true);
				expect(plainNodesFrozen(transition)).toBe(true);
				expect(plainNodesFrozen(transition.result?.sessionState)).toBe(true);
			}
			for (const unsubscribe of unsubscribers) unsubscribe();
		} finally {
			session.dispose();
		}
	});

	test('typed-array leaves stay per-recipient while the frozen structure is shared', () => {
		const session = createAssessmentItemDefinition({ itemXml: DRAWING_ITEM }).openSession();
		try {
			const pixels = (transition: ItemSessionTransition) =>
				(transition.current.responses.DRAW as { imageData: { data: Uint8ClampedArray } }).imageData.data;
			const firstSeen: Uint8ClampedArray[] = [];
			const secondSeen: Uint8ClampedArray[] = [];
			session.subscribe((transition) => firstSeen.push(pixels(transition)));
			session.subscribe((transition) => secondSeen.push(pixels(transition)));

			const returned = session.dispatch({
				action: 'setResponse',
				responseIdentifier: 'DRAW',
				value: {
					fileName: 'drawing.png',
					mimeType: 'image/png',
					data: 'base64',
					imageData: { data: new Uint8ClampedArray([10, 20, 30, 255]), width: 1, height: 1 },
				},
			});

			const returnedPixels = pixels(returned);
			expect(Object.isFrozen(returned)).toBe(true);
			expect(plainNodesFrozen(returned)).toBe(true);
			expect(firstSeen).toHaveLength(1);
			expect(secondSeen).toHaveLength(1);
			// Every recipient owns its own pixels; each reads the delivered value.
			const allPixels = [returnedPixels, ...firstSeen, ...secondSeen];
			for (const own of allPixels) {
				expect([...own]).toEqual([10, 20, 30, 255]);
			}
			expect(new Set(allPixels).size).toBe(allPixels.length);

			// A listener mutating its own copy never reaches another recipient or the engine.
			firstSeen[0]![0] = 50;
			expect([...pixels(returned)]).toEqual([10, 20, 30, 255]);
			expect([...secondSeen[0]!]).toEqual([10, 20, 30, 255]);
			const statePixels = (session.state().responses.DRAW as { imageData: { data: Uint8ClampedArray } }).imageData.data;
			expect([...statePixels]).toEqual([10, 20, 30, 255]);
			expect(statePixels).not.toBe(returnedPixels);
		} finally {
			session.dispose();
		}
	});

	test('the session view is independent of the engine and of the previous transition', () => {
		const session = createAssessmentItemDefinition({ itemXml: DRAWING_ITEM }).openSession();
		try {
			const first = session.dispatch({
				action: 'setResponse',
				responseIdentifier: 'DRAW',
				value: {
					fileName: 'a.png',
					mimeType: 'image/png',
					data: 'base64',
					imageData: { data: new Uint8ClampedArray([1, 2]), width: 1, height: 1 },
				},
			});
			const second = session.dispatch({
				action: 'setResponse',
				responseIdentifier: 'DRAW',
				value: {
					fileName: 'b.png',
					mimeType: 'image/png',
					data: 'base64',
					imageData: { data: new Uint8ClampedArray([3, 4]), width: 1, height: 1 },
				},
			});

			const firstPixels = (first.current.responses.DRAW as { imageData: { data: Uint8ClampedArray } }).imageData.data;
			const secondPixels = (second.current.responses.DRAW as { imageData: { data: Uint8ClampedArray } }).imageData.data;
			expect(firstPixels).not.toBe(secondPixels);
			// Mutating a past transition's pixels cannot leak into the current view or state().
			firstPixels[0] = 99;
			expect([...secondPixels]).toEqual([3, 4]);
			const state = session.state();
			const statePixels = (state.responses.DRAW as { imageData: { data: Uint8ClampedArray } }).imageData.data;
			expect([...statePixels]).toEqual([3, 4]);
			expect(statePixels).not.toBe(secondPixels);
		} finally {
			session.dispose();
		}
	});
});
