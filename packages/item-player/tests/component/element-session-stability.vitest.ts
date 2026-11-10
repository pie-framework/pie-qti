/**
 * Regression matrix for the final-review finding: any property write on a mounted
 * <pie-qti-item-player> — or a no-op write such as `el.disabled = false` — used to
 * re-create the item's owned `AssessmentItemDefinition` + `ItemSession`, destroying
 * attempt state: shuffle re-rolled, `numAttempts` reset, submitted modal feedback wiped,
 * and a detach/reattach losing the attempt. Only a change of the item's definition-fixed
 * inputs may re-open the session.
 *
 * The choice interaction renders into an inert custom element (`test-stability-choice`),
 * so the shuffled order is readable as its `interaction` prop and a stable element
 * identity proves the interaction did not remount.
 */

import { afterEach, describe, expect, test } from 'vitest';
import type { ComponentRegistry } from '../../src/core/ComponentRegistry.js';
import { PieQtiItemPlayerElement } from '../../src/element-class.js';
import { settle } from './helpers';

const TAG = 'pie-qti-item-player-stability';
if (!customElements.get(TAG)) customElements.define(TAG, PieQtiItemPlayerElement);

const CHOICE_TAG = 'test-stability-choice';

const choiceRendererPlugin = {
	kind: 'assessment-item-definition-plugin' as const,
	name: 'stability-choice-renderer',
	version: '1.0.0',
	registerComponents: (registry: ComponentRegistry) => {
		registry.register('choiceInteraction', {
			name: 'stability-choice',
			tagName: CHOICE_TAG,
			priority: 100,
		});
	},
};

const SHUFFLE_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="stability-shuffle" adaptive="false" timeDependent="false">
	<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
	<itemBody>
		<p>Pick one.</p>
		<choiceInteraction responseIdentifier="RESPONSE" shuffle="true" maxChoices="1">
			<simpleChoice identifier="c1">One</simpleChoice>
			<simpleChoice identifier="c2">Two</simpleChoice>
			<simpleChoice identifier="c3">Three</simpleChoice>
			<simpleChoice identifier="c4">Four</simpleChoice>
			<simpleChoice identifier="c5">Five</simpleChoice>
		</choiceInteraction>
	</itemBody>
</assessmentItem>`;

/** Adaptive: the item completes only when the SECOND attempt answers correctly. */
const ADAPTIVE_TWO_ATTEMPTS = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="stability-adaptive" adaptive="true" timeDependent="false">
	<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
		<correctResponse><value>A</value></correctResponse>
	</responseDeclaration>
	<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"><defaultValue><value>0</value></defaultValue></outcomeDeclaration>
	<itemBody>
		<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
			<simpleChoice identifier="A">Mars</simpleChoice>
			<simpleChoice identifier="B">Venus</simpleChoice>
		</choiceInteraction>
	</itemBody>
	<responseProcessing>
		<responseCondition>
			<responseIf>
				<and>
					<match><variable identifier="RESPONSE"/><correct identifier="RESPONSE"/></match>
					<match><variable identifier="numAttempts"/><baseValue baseType="integer">2</baseValue></match>
				</and>
				<setOutcomeValue identifier="SCORE"><baseValue baseType="float">1</baseValue></setOutcomeValue>
				<setOutcomeValue identifier="completionStatus"><baseValue baseType="identifier">completed</baseValue></setOutcomeValue>
			</responseIf>
		</responseCondition>
	</responseProcessing>
</assessmentItem>`;

const MODAL_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="stability-modal" adaptive="false" timeDependent="false">
	<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
		<correctResponse><value>A</value></correctResponse>
	</responseDeclaration>
	<outcomeDeclaration identifier="FEEDBACK" cardinality="single" baseType="identifier"/>
	<itemBody>
		<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
			<simpleChoice identifier="A">Mars</simpleChoice>
			<simpleChoice identifier="B">Venus</simpleChoice>
		</choiceInteraction>
	</itemBody>
	<responseProcessing>
		<responseCondition>
			<responseIf>
				<match><variable identifier="RESPONSE"/><correct identifier="RESPONSE"/></match>
				<setOutcomeValue identifier="FEEDBACK"><baseValue baseType="identifier">correct</baseValue></setOutcomeValue>
			</responseIf>
			<responseElse>
				<setOutcomeValue identifier="FEEDBACK"><baseValue baseType="identifier">incorrect</baseValue></setOutcomeValue>
			</responseElse>
		</responseCondition>
	</responseProcessing>
	<modalFeedback outcomeIdentifier="FEEDBACK" identifier="incorrect" showHide="show" title="Not yet"><p>Look again.</p></modalFeedback>
</assessmentItem>`;

/** A different item whose response identifier is not RESPONSE, for element reuse. */
const OTHER_RESPONSE_ID_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="stability-other" adaptive="false" timeDependent="false">
	<responseDeclaration identifier="ANSWER" cardinality="single" baseType="identifier"/>
	<itemBody><p>The second item body.</p></itemBody>
</assessmentItem>`;

/** A templated item: the printed room number comes from templateProcessing's random draw. */
const TEMPLATE_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="stability-template" adaptive="false" timeDependent="false">
	<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string"/>
	<templateDeclaration identifier="N" cardinality="single" baseType="integer"/>
	<itemBody><p class="tv">Room number <printedVariable identifier="N"/>.</p><textEntryInteraction responseIdentifier="RESPONSE" expectedLength="4"/></itemBody>
	<templateProcessing>
		<setTemplateValue identifier="N"><randomInteger min="1" max="1000000"/></setTemplateValue>
	</templateProcessing>
</assessmentItem>`;

/** An adaptive item with an end-attempt hint button, like the documented pattern. */
const HINT_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="stability-hint" adaptive="true" timeDependent="false">
	<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
		<correctResponse><value>A</value></correctResponse>
	</responseDeclaration>
	<responseDeclaration identifier="HINT" cardinality="single" baseType="boolean"/>
	<outcomeDeclaration identifier="FEEDBACK" cardinality="single" baseType="identifier"/>
	<itemBody>
		<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
			<simpleChoice identifier="A">Mars</simpleChoice>
			<simpleChoice identifier="B">Venus</simpleChoice>
		</choiceInteraction>
		<p><endAttemptInteraction responseIdentifier="HINT" title="Show a hint" countAttempt="false"/></p>
		<feedbackBlock outcomeIdentifier="FEEDBACK" identifier="hint" showHide="show"><p>Hint: it is named after the Roman god of war.</p></feedbackBlock>
	</itemBody>
	<responseProcessing>
		<responseCondition>
			<responseIf>
				<match><variable identifier="HINT"/><baseValue baseType="boolean">true</baseValue></match>
				<setOutcomeValue identifier="FEEDBACK"><baseValue baseType="identifier">hint</baseValue></setOutcomeValue>
			</responseIf>
		</responseCondition>
	</responseProcessing>
</assessmentItem>`;

const elements: HTMLElement[] = [];

afterEach(() => {
	for (const element of elements.splice(0)) element.remove();
});

async function render(
	itemXml: string,
	setup: (element: PieQtiItemPlayerElement) => void = () => {},
): Promise<PieQtiItemPlayerElement> {
	const element = document.createElement(TAG) as PieQtiItemPlayerElement;
	element.plugins = [choiceRendererPlugin];
	setup(element);
	element.itemXml = itemXml;
	document.body.appendChild(element);
	elements.push(element);
	await settle();
	return element;
}

function bodyText(host: HTMLElement): string {
	return host.querySelector('.qti-item-body-content')?.textContent ?? '';
}

function choiceElement(host: HTMLElement): HTMLElement {
	const element = host.querySelector(CHOICE_TAG);
	expect(element, 'choice interaction element rendered').not.toBeNull();
	return element as HTMLElement;
}

function choiceOrder(host: HTMLElement): string[] {
	const interaction = (choiceElement(host) as unknown as { interaction?: { choices: { identifier: string }[] } })
		.interaction;
	return (interaction?.choices ?? []).map((choice) => choice.identifier);
}

/** A candidate selection, dispatched the way the interaction elements do. */
function answer(host: HTMLElement, value: string) {
	choiceElement(host).dispatchEvent(
		new CustomEvent('qti-change', {
			bubbles: true,
			composed: true,
			detail: { responseId: 'RESPONSE', value, timestamp: Date.now() },
		}),
	);
}

function markInteraction(host: HTMLElement): void {
	(choiceElement(host) as unknown as Record<string, unknown>).__stabilityMarker = 'kept';
}

describe('<pie-qti-item-player> session stability across property writes', () => {
	test('a selection and a no-op disabled write keep the shuffle order and the mounted interaction', async () => {
		const element = await render(SHUFFLE_ITEM);
		const before = choiceOrder(element);
		markInteraction(element);

		answer(element, 'c1');
		await settle();
		element.disabled = false; // no-op write: the property already holds false
		await settle();

		expect(choiceOrder(element)).toEqual(before);
		expect((choiceElement(element) as unknown as Record<string, unknown>).__stabilityMarker).toBe('kept');
	});

	test('a no-op disabled write after submit keeps the modal feedback shown', async () => {
		const element = await render(MODAL_ITEM);
		answer(element, 'B');
		await settle();
		element.submit();
		await settle();
		expect(element.querySelector('dialog[open]')).not.toBeNull();

		element.disabled = false;
		await settle();
		expect(element.querySelector('dialog[open]')).not.toBeNull();
		expect(element.textContent).toContain('Look again.');
	});

	test('a no-op disabled write keeps adaptive attempt state (item completes on attempt 2)', async () => {
		const element = await render(ADAPTIVE_TWO_ATTEMPTS);
		const completions: unknown[] = [];
		element.addEventListener('complete', (event) => completions.push((event as CustomEvent).detail));

		element.submit(); // attempt 1, unanswered: wrong
		await settle();
		answer(element, 'A');
		await settle();
		element.disabled = false; // no-op write
		await settle();
		element.submit(); // attempt 2, correct: the item must complete
		await settle();

		expect(completions).toHaveLength(1);
	});

	test('a detach and reattach keeps adaptive attempt state', async () => {
		const element = await render(ADAPTIVE_TWO_ATTEMPTS);
		const completions: unknown[] = [];
		element.addEventListener('complete', (event) => completions.push((event as CustomEvent).detail));

		element.submit(); // attempt 1
		await settle();

		const elsewhere = document.createElement('div');
		document.body.appendChild(elsewhere);
		elsewhere.appendChild(element); // moves the element: disconnect + connect
		await settle();

		answer(element, 'A');
		await settle();
		element.submit(); // attempt 2 on the resumed session
		await settle();

		expect(completions).toHaveLength(1);
		elsewhere.remove();
	});

	test('reusing the element across items renders the new item despite stale responses', async () => {
		const element = await render(SHUFFLE_ITEM);
		answer(element, 'c2');
		await settle();

		element.itemXml = OTHER_RESPONSE_ID_ITEM;
		await settle();

		expect(element.querySelector('[role="alert"]')).toBeNull();
		expect(element.textContent).toContain('The second item body.');
	});
});

describe('what does and does not re-open the session', () => {
	/** `ready` fires once per successful session application: the precise re-open probe. */
	async function renderCountingReady(
		itemXml: string,
		setup: (element: PieQtiItemPlayerElement) => void = () => {}
	): Promise<{
		element: PieQtiItemPlayerElement;
		readyCount: () => number;
	}> {
		let readyCount = 0;
		const element = await render(itemXml, (el) => {
			setup(el);
			el.addEventListener('ready', () => {
				readyCount += 1;
			});
		});
		await settle();
		return { element, readyCount: () => readyCount };
	}

	test('template values do not re-randomize mid-answer', async () => {
		const { element, readyCount } = await renderCountingReady(TEMPLATE_ITEM);
		const atMount = bodyText(element);

		element.querySelector('input')?.dispatchEvent(
			new CustomEvent('qti-change', {
				bubbles: true,
				composed: true,
				detail: { responseId: 'RESPONSE', value: '42', timestamp: Date.now() },
			})
		);
		await settle();
		element.disabled = false;
		await settle();

		expect(bodyText(element)).toBe(atMount);
		expect(readyCount()).toBe(1);
	});

	test('noise writes never re-open: disabled, responses, equal plugins, equal options', async () => {
		const plugins = [choiceRendererPlugin];
		const { element, readyCount } = await renderCountingReady(SHUFFLE_ITEM, (el) => {
			el.plugins = plugins;
			el.stringComparison = { foldScriptInput: true };
		});
		const atMount = choiceOrder(element);
		markInteraction(element);

		element.disabled = true;
		element.disabled = false;
		element.renderItemBodyRubrics = true;
		element.plugins = plugins; // the same list, re-assigned
		element.stringComparison = { foldScriptInput: true }; // equal record, re-assigned
		element.responses = { RESPONSE: 'c1' };
		await settle();

		expect(readyCount()).toBe(1);
		expect(choiceOrder(element)).toEqual(atMount);
		expect((choiceElement(element) as unknown as Record<string, unknown>).__stabilityMarker).toBe('kept');
	});

	test('a true definition change re-opens exactly once and carries the responses', async () => {
		const { element, readyCount } = await renderCountingReady(SHUFFLE_ITEM);
		answer(element, 'c3');
		await settle();

		element.role = 'scorer';
		await settle();

		expect(readyCount()).toBe(2); // exactly one re-open for the definition change
		// The response survived the re-open.
		expect(element.responses?.['RESPONSE']).toBe('c3');
	});

	test('an end-attempt interaction submits the resumed session after a reattach', async () => {
		const { element, readyCount } = await renderCountingReady(HINT_ITEM, (el) => {
			el.showFeedback = true; // the hint is integrated feedback; standalone hides it by default
		});
		element.submit(); // attempt 1
		await settle();

		const elsewhere = document.createElement('div');
		document.body.appendChild(elsewhere);
		elsewhere.appendChild(element);
		await settle();

		let submissions = 0;
		element.addEventListener('submit', () => {
			submissions += 1;
		});
		element.querySelector('pie-qti-end-attempt')?.dispatchEvent(
			new CustomEvent('qti-change', {
				bubbles: true,
				composed: true,
				detail: { responseId: 'HINT', value: true, timestamp: Date.now() },
			})
		);
		await settle();

		// One ready per mount (initial + resume): the session itself was adopted, not re-opened.
		expect(readyCount()).toBe(2);
		expect(submissions).toBe(1); // the end-attempt request still auto-submits
		expect(bodyText(element)).toContain('Hint: it is named after the Roman god of war.');
		elsewhere.remove();
	});
});
