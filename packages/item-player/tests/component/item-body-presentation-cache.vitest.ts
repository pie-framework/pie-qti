/**
 * The item body's presentation cache (perf round 4):
 *
 * - Building a presentation re-serializes the body DOM, sanitizes it twice and re-sanitizes
 *   every stimulus — so the body builds once per content-bearing input, NOT once per response
 *   dispatch. Typing N times into an item whose content prints no response calls present()
 *   once (the initial build), while the mounted interaction still receives every new value.
 * - A response the content prints (printedVariable of a response) is part of the markup, so
 *   typing re-presents, and the body shows the new value. The same holds for a printed
 *   context variable: `duration` changes with every dispatch, and an item that prints it
 *   must show the elapsed time move — one that prints no context variable must not rebuild.
 * - Integrated feedback is outcome-driven: answering does not re-present, the attempt's
 *   response processing does.
 * - The wiring effect (PnP application, the `qti-change` listener) runs per element identity
 *   and per PnP change, never per keystroke: dispatching neither re-binds the listener the
 *   interactions dispatch through nor rewrites the display attributes.
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { createAssessmentItemDefinition } from '../../src/core/AssessmentItemDefinition.js';
import { LiveItemSession, type ItemSession } from '../../src/core/ItemSession.js';
import { Player } from '../../src/core/Player.js';
import { PieQtiItemPlayerElement } from '../../src/element-class.js';
import { settle } from './helpers';

const TAG = 'pie-qti-item-body-cache';
if (!customElements.get(TAG)) customElements.define(TAG, PieQtiItemPlayerElement);

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

/** Typing target without any response-printing or feedback content. */
const MEMO_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem ${NS} identifier="memo-typing" adaptive="false" timeDependent="false">
	<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string"/>
	<itemBody><p>Answer here: <textEntryInteraction responseIdentifier="RESPONSE" expectedLength="10"/>.</p></itemBody>
</assessmentItem>`;

/** The body prints the candidate's response: typing is part of the markup. */
const PRINTED_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem ${NS} identifier="memo-printed" adaptive="false" timeDependent="false">
	<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string"/>
	<itemBody>
		<p>You typed: <printedVariable identifier="RESPONSE"/>.</p>
		<p><textEntryInteraction responseIdentifier="RESPONSE" expectedLength="10"/></p>
	</itemBody>
</assessmentItem>`;

/** The body prints the built-in `duration` context variable: the printed elapsed time is markup. */
const DURATION_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem ${NS} identifier="memo-duration" adaptive="false" timeDependent="false">
	<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string"/>
	<itemBody>
		<p>Elapsed: <printedVariable identifier="duration"/> s.</p>
		<p><textEntryInteraction responseIdentifier="RESPONSE" expectedLength="10"/></p>
	</itemBody>
</assessmentItem>`;

/** A different item, for element reuse. */
const OTHER_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem ${NS} identifier="memo-other" adaptive="false" timeDependent="false">
	<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string"/>
	<itemBody><p>The other item body.</p></itemBody>
</assessmentItem>`;

/** Feedback the attempt's response processing shows: outcome-driven, not response-driven. */
const FEEDBACK_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem ${NS} identifier="memo-feedback" adaptive="false" timeDependent="false">
	<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
		<correctResponse><value>A</value></correctResponse>
	</responseDeclaration>
	<outcomeDeclaration identifier="FEEDBACK" cardinality="single" baseType="identifier"/>
	<itemBody>
		<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
			<simpleChoice identifier="A">Mars</simpleChoice>
			<simpleChoice identifier="B">Venus</simpleChoice>
		</choiceInteraction>
		<feedbackBlock outcomeIdentifier="FEEDBACK" identifier="correct" showHide="show"><p>Well done.</p></feedbackBlock>
	</itemBody>
	<responseProcessing>
		<responseCondition>
			<responseIf>
				<match><variable identifier="RESPONSE"/><correct identifier="RESPONSE"/></match>
				<setOutcomeValue identifier="FEEDBACK"><baseValue baseType="identifier">correct</baseValue></setOutcomeValue>
			</responseIf>
		</responseCondition>
	</responseProcessing>
</assessmentItem>`;

const elements: HTMLElement[] = [];
const sessions: ItemSession[] = [];

afterEach(() => {
	vi.restoreAllMocks();
	for (const session of sessions.splice(0)) session.dispose();
	for (const element of elements.splice(0)) element.remove();
});

async function render(itemXml: string, setup: (element: PieQtiItemPlayerElement) => void = () => {}): Promise<PieQtiItemPlayerElement> {
	const element = document.createElement(TAG) as PieQtiItemPlayerElement;
	setup(element);
	element.itemXml = itemXml;
	document.body.appendChild(element);
	elements.push(element);
	await settle();
	return element;
}

/** A candidate keystroke, dispatched the way the interaction elements do. */
function typeInto(element: PieQtiItemPlayerElement, value: string): void {
	element.querySelector('input')?.dispatchEvent(
		new CustomEvent('qti-change', {
			bubbles: true,
			composed: true,
			detail: { responseId: 'RESPONSE', value, timestamp: Date.now() },
		})
	);
}

function bodyText(element: PieQtiItemPlayerElement): string {
	return element.querySelector('.qti-item-body-content')?.textContent ?? '';
}

describe('ItemBody presentation cache', () => {
	test('typing N times presents once, and the interaction still receives every value', async () => {
		const present = vi.spyOn(LiveItemSession.prototype, 'present');
		const element = await render(MEMO_ITEM);
		expect(present).toHaveBeenCalledTimes(1); // the initial build

		for (const value of ['1', '12', '123', '1234']) {
			typeInto(element, value);
			await settle();
			// The mounted input echoes the session value each time, without a rebuild.
			expect((element.querySelector('input') as HTMLInputElement).value).toBe(value);
			expect(element.responses?.['RESPONSE']).toBe(value);
		}
		expect(present).toHaveBeenCalledTimes(1);
	});

	test('typing a response the content prints re-presents and updates the body', async () => {
		const present = vi.spyOn(LiveItemSession.prototype, 'present');
		const element = await render(PRINTED_ITEM);
		const initialBuilds = present.mock.calls.length;
		expect(bodyText(element)).not.toContain('You typed: 42');

		typeInto(element, '4');
		await settle();
		typeInto(element, '42');
		await settle();

		expect(present.mock.calls.length).toBe(initialBuilds + 2);
		expect(bodyText(element)).toContain('You typed: 42.');
	});

	test('a body that prints duration re-presents as it changes: the elapsed time advances', async () => {
		const present = vi.spyOn(LiveItemSession.prototype, 'present');
		const element = await render(DURATION_ITEM);
		const printedSeconds = () => Number(/Elapsed: ([\d.]+) s\./.exec(bodyText(element))?.[1] ?? Number.NaN);
		const buildsBefore = present.mock.calls.length;
		const secondsBefore = printedSeconds();
		expect(Number.isFinite(secondsBefore)).toBe(true);

		// A second of attempt time later, a dispatch carries a changed `duration`: the printed
		// value must move with it, so the presentation cache must rebuild the markup.
		await new Promise((resolve) => setTimeout(resolve, 1100));
		typeInto(element, 'x');
		await settle();

		expect(printedSeconds()).toBeGreaterThan(secondsBefore);
		expect(present.mock.calls.length).toBe(buildsBefore + 1);
	});

	test('answering does not re-present; the attempt that shows integrated feedback does', async () => {
		const present = vi.spyOn(LiveItemSession.prototype, 'present');
		const element = await render(FEEDBACK_ITEM, (el) => {
			el.showFeedback = true;
		});
		expect(bodyText(element)).not.toContain('Well done.');
		const afterMount = present.mock.calls.length;

		element.querySelector('pie-qti-choice')?.dispatchEvent(
			new CustomEvent('qti-change', {
				bubbles: true,
				composed: true,
				detail: { responseId: 'RESPONSE', value: 'A', timestamp: Date.now() },
			})
		);
		await settle();
		expect(present.mock.calls.length).toBe(afterMount); // the answer carries no markup change

		present.mockClear();
		element.submit();
		await settle();
		// Response processing completed the attempt: feedback markup is built and shown.
		expect(present.mock.calls.length).toBeGreaterThanOrEqual(1);
		expect(bodyText(element)).toContain('Well done.');
	});

	test('reusing the element for a different item re-presents', async () => {
		const present = vi.spyOn(LiveItemSession.prototype, 'present');
		const element = await render(MEMO_ITEM);
		const afterFirst = present.mock.calls.length;
		expect(afterFirst).toBeGreaterThanOrEqual(1);

		element.itemXml = OTHER_ITEM;
		await settle();
		expect(bodyText(element)).toContain('The other item body.');
		expect(present.mock.calls.length).toBeGreaterThan(afterFirst);
	});
});

describe('ItemBody wiring effect', () => {
	test('keystrokes neither re-bind the qti-change listener nor rewrite the display attributes', async () => {
		const applyPnp = vi.spyOn(Player.prototype, 'applyPnp');

		// Count listener registrations while the component mounts, so "bound once" is observable.
		const registrations: Array<{ target: unknown; type: string }> = [];
		const originalAddEventListener = EventTarget.prototype.addEventListener;
		EventTarget.prototype.addEventListener = function (this: EventTarget, type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) {
			registrations.push({ target: this, type });
			return originalAddEventListener.call(this, type, listener, options);
		};

		try {
			const element = await render(MEMO_ITEM);
			// An injected session is dispatchable from the test; the player adopts it.
			const session = createAssessmentItemDefinition({ itemXml: MEMO_ITEM }).openSession();
			sessions.push(session);
			// The injection re-runs the wiring effect for the new session binding; count only
			// that latest wiring round from here on.
			registrations.length = 0;
			applyPnp.mockClear();
			element.session = session;
			await settle();

			const root = element.querySelector('.qti-item-body');
			expect(root).not.toBeNull();
			const boundOnRoot = () =>
				registrations.filter((entry) => entry.type === 'qti-change' && entry.target === root);
			expect(boundOnRoot()).toHaveLength(1);

			const applicationsAtMount = applyPnp.mock.calls.length;
			expect(applicationsAtMount).toBeGreaterThanOrEqual(1);

			for (const value of ['a', 'ab', 'abc', 'abcd', 'abcde']) {
				typeInto(element, value);
				await settle();
			}
			expect(applyPnp.mock.calls.length).toBe(applicationsAtMount);
			expect(boundOnRoot()).toHaveLength(1);

			// A PnP change is the one revision-carrying change this surface re-applies for.
			session.dispatch({ action: 'updatePnp', profile: { display: { colorScheme: 'blackrose' } } });
			await settle();
			expect(applyPnp.mock.calls.length).toBe(applicationsAtMount + 1);
			expect(root?.getAttribute('data-qti-colorscheme')).toBe('blackrose');

			// ... and typing afterwards stays quiet again.
			typeInto(element, 'abcdef');
			await settle();
			expect(applyPnp.mock.calls.length).toBe(applicationsAtMount + 1);
			expect(boundOnRoot()).toHaveLength(1);
		} finally {
			EventTarget.prototype.addEventListener = originalAddEventListener;
		}
	});
});
