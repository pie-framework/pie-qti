/**
 * Integrated feedback is a status message (WCAG 4.1.3): feedbackInline and feedbackBlock shown
 * by the candidate's attempt are announced through the player's live region. These are the pure
 * rules behind that announcement — what the shown feedback says, which transitions announce it,
 * and how an identical repeat still reaches assistive technology.
 */

import { describe, expect, test } from 'bun:test';
import {
	extractShownFeedback,
	isCandidateAttemptFeedback,
	nextFeedbackAnnouncement,
} from '../../src/presentation/feedbackAnnouncement.js';
import type { ItemSessionTransition } from '../../src/core/ItemSession.js';

const BODY = `
	<p>What is 2 + 2?</p>
	<p>Answer <feedbackInline outcomeIdentifier="FEEDBACK" identifier="CORRECT" showHide="show">Well done.</feedbackInline><feedbackInline outcomeIdentifier="FEEDBACK" identifier="INCORRECT" showHide="show">Not quite.</feedbackInline></p>
	<feedbackBlock outcomeIdentifier="FEEDBACK" identifier="CORRECT" showHide="show"><p>Four is the <strong>sum</strong>.</p></feedbackBlock>
	<p>The end.</p>
`;

describe('extractShownFeedback', () => {
	test('reads the shown feedback in document order and nothing that is hidden', () => {
		// Inline markup joins its text (`<strong>sum</strong>.` reads "sum."); blocks separate.
		expect(extractShownFeedback(BODY, { FEEDBACK: 'CORRECT' })).toEqual({
			shown: true,
			text: 'Well done. Four is the sum.',
		});
		expect(extractShownFeedback(BODY, { FEEDBACK: 'INCORRECT' })).toEqual({ shown: true, text: 'Not quite.' });
	});

	test('reports nothing shown before an outcome selects any feedback', () => {
		expect(extractShownFeedback(BODY, {})).toEqual({ shown: false, text: '' });
		expect(extractShownFeedback(BODY, { FEEDBACK: null })).toEqual({ shown: false, text: '' });
		expect(extractShownFeedback('<p>No feedback here.</p>', { FEEDBACK: 'CORRECT' })).toEqual({ shown: false, text: '' });
		expect(extractShownFeedback('', { FEEDBACK: 'CORRECT' })).toEqual({ shown: false, text: '' });
	});

	test('a test-level showFeedback="false" shows nothing whatever the outcome', () => {
		expect(extractShownFeedback(BODY, { FEEDBACK: 'CORRECT' }, { hideAll: true })).toEqual({ shown: false, text: '' });
	});

	test('reads QTI 3 elements and attribute spellings', () => {
		const qti3 = `<p><qti-feedback-inline outcome-identifier="FEEDBACK" identifier="A" show-hide="show">Bravo.</qti-feedback-inline></p><qti-feedback-block outcome-identifier="FEEDBACK" identifier="A"><p>Encore.</p></qti-feedback-block>`;
		expect(extractShownFeedback(qti3, { FEEDBACK: 'A' })).toEqual({ shown: true, text: 'Bravo. Encore.' });
	});

	test('showHide="hide" shows the feedback unless the outcome matches; containers match by membership', () => {
		const hide = `<feedbackInline outcomeIdentifier="FEEDBACK" identifier="X" showHide="hide">Shown unless X.</feedbackInline>`;
		expect(extractShownFeedback(hide, { FEEDBACK: 'Y' }).text).toBe('Shown unless X.');
		expect(extractShownFeedback(hide, { FEEDBACK: 'X' }).shown).toBe(false);
		const multiple = `<feedbackBlock outcomeIdentifier="FEEDBACK" identifier="B">Part B.</feedbackBlock>`;
		expect(extractShownFeedback(multiple, { FEEDBACK: ['A', 'B'] }).text).toBe('Part B.');
	});

	test('nested feedback resolves inside shown feedback; hidden feedback drops everything inside it', () => {
		const nested = `<feedbackBlock outcomeIdentifier="FEEDBACK" identifier="OUTER"><p>Outer.</p><feedbackInline outcomeIdentifier="DETAIL" identifier="ON">Detail on.</feedbackInline><feedbackInline outcomeIdentifier="DETAIL" identifier="OFF">Detail off.</feedbackInline><p>After.</p></feedbackBlock>`;
		expect(extractShownFeedback(nested, { FEEDBACK: 'OUTER', DETAIL: 'ON' }).text).toBe('Outer. Detail on. After.');
		expect(extractShownFeedback(nested, { FEEDBACK: 'OTHER', DETAIL: 'ON' })).toEqual({ shown: false, text: '' });
	});

	test('reads an image by its alt text; an image-only feedback with no alt is shown without text', () => {
		const withAlt = `<feedbackBlock outcomeIdentifier="FEEDBACK" identifier="A"><img src="tick.png" alt="Correct"/></feedbackBlock>`;
		expect(extractShownFeedback(withAlt, { FEEDBACK: 'A' })).toEqual({ shown: true, text: 'Correct' });
		const imageOnly = `<feedbackBlock outcomeIdentifier="FEEDBACK" identifier="A"><img src="tick.png"/></feedbackBlock>`;
		expect(extractShownFeedback(imageOnly, { FEEDBACK: 'A' })).toEqual({ shown: true, text: '' });
		const decorative = `<feedbackBlock outcomeIdentifier="FEEDBACK" identifier="A"><img src="tick.png" alt=""/></feedbackBlock>`;
		expect(extractShownFeedback(decorative, { FEEDBACK: 'A' })).toEqual({ shown: true, text: '' });
	});

	test('decodes character references and collapses whitespace', () => {
		const encoded = `<feedbackInline outcomeIdentifier="FEEDBACK" identifier="A">  Tom &amp; Jerry&#8217;s&nbsp;&#x2713;
			answer &lt;ok&gt;  </feedbackInline>`;
		expect(extractShownFeedback(encoded, { FEEDBACK: 'A' }).text).toBe('Tom & Jerry’s ✓ answer <ok>');
	});

	test('script and style content inside feedback is never read out', () => {
		const noisy = `<feedbackBlock outcomeIdentifier="FEEDBACK" identifier="A"><style>.x { color: red; }</style><script>alert(1)</script><p>Visible.</p></feedbackBlock>`;
		expect(extractShownFeedback(noisy, { FEEDBACK: 'A' }).text).toBe('Visible.');
	});

	test('line breaks and list items separate words', () => {
		const list = `<feedbackBlock outcomeIdentifier="FEEDBACK" identifier="A">First<br/>second<ul><li>third</li><li>fourth</li></ul></feedbackBlock>`;
		expect(extractShownFeedback(list, { FEEDBACK: 'A' }).text).toBe('First second third fourth');
	});
});

describe('isCandidateAttemptFeedback', () => {
	const transition = (action: string) =>
		({ command: { action } }) as unknown as Pick<ItemSessionTransition, 'command'>;

	test('a candidate submit, end-attempt or adaptive attempt announces', () => {
		expect(isCandidateAttemptFeedback(transition('endAttempt'), 'candidate')).toBe(true);
		expect(isCandidateAttemptFeedback(transition('submitAttempt'), 'candidate')).toBe(true);
	});

	test('response changes, display settings, suspension and disposal never announce', () => {
		for (const action of ['setResponse', 'setResponses', 'updatePnp', 'suspendAttempt', 'scoreAttempt', 'newTemplate', 'dispose']) {
			expect(isCandidateAttemptFeedback(transition(action), 'candidate')).toBe(false);
		}
	});

	test('a scorer, author or proctor render is not the candidate attempt and never announces', () => {
		for (const role of ['scorer', 'author', 'tutor', 'proctor', 'testConstructor'] as const) {
			expect(isCandidateAttemptFeedback(transition('endAttempt'), role)).toBe(false);
		}
	});
});

describe('nextFeedbackAnnouncement', () => {
	test('new text is announced as is', () => {
		expect(nextFeedbackAnnouncement('', 'Well done.')).toBe('Well done.');
		expect(nextFeedbackAnnouncement(null, 'Well done.')).toBe('Well done.');
		expect(nextFeedbackAnnouncement('Not quite.', 'Well done.')).toBe('Well done.');
	});

	test('identical repeated text toggles a trailing zero-width space so the region still changes', () => {
		const first = nextFeedbackAnnouncement('', 'Try again.');
		const second = nextFeedbackAnnouncement(first, 'Try again.');
		const third = nextFeedbackAnnouncement(second, 'Try again.');
		expect(second).toBe('Try again.\u200b');
		expect(second).not.toBe(first);
		expect(third).toBe('Try again.');
		expect(third).not.toBe(second);
	});
});
