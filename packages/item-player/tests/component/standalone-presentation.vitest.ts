/**
 * Standalone delivery presentation defaults (final-review finding): an `ItemPlayer` that owns
 * its session hides integrated feedback unless the host opts in with `showFeedback`, as QTI
 * `itemSessionControl@showFeedback` (default false) requires, and reports load failure through
 * the `onError` / `onReady` callbacks with the raw detail kept away from the candidate.
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import ItemPlayer from '../../src/components/ItemPlayer.svelte';
import { createAssessmentItemDefinition } from '../../src/core/AssessmentItemDefinition.js';
import type { ItemSession } from '../../src/core/ItemSession.js';
import { mountInto, settle, type Mounted } from './helpers';

const ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="standalone-presentation" adaptive="false" timeDependent="false">
	<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
		<correctResponse><value>A</value></correctResponse>
	</responseDeclaration>
	<outcomeDeclaration identifier="FEEDBACK" cardinality="single" baseType="identifier"/>
	<itemBody>
		<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
			<simpleChoice identifier="A">Mars</simpleChoice>
			<simpleChoice identifier="B">Venus</simpleChoice>
		</choiceInteraction>
		<p><feedbackInline outcomeIdentifier="FEEDBACK" identifier="INCORRECT" showHide="show">Not quite.</feedbackInline></p>
	</itemBody>
	<responseProcessing>
		<responseCondition>
			<responseIf>
				<match><variable identifier="RESPONSE"/><correct identifier="RESPONSE"/></match>
				<setOutcomeValue identifier="FEEDBACK"><baseValue baseType="identifier">CORRECT</baseValue></setOutcomeValue>
			</responseIf>
			<responseElse>
				<setOutcomeValue identifier="FEEDBACK"><baseValue baseType="identifier">INCORRECT</baseValue></setOutcomeValue>
			</responseElse>
		</responseCondition>
	</responseProcessing>
</assessmentItem>`;

const BROKEN = '<assessmentItem><itemBody><p>Unclosed';

const mounted: Mounted[] = [];
const sessions: ItemSession[] = [];

afterEach(() => {
	for (const m of mounted.splice(0)) m.destroy();
	for (const session of sessions.splice(0)) session.dispose();
	vi.restoreAllMocks();
});

async function render(props: Record<string, unknown>): Promise<Mounted> {
	const m = mountInto(ItemPlayer, props);
	mounted.push(m);
	await settle();
	return m;
}

function body(host: HTMLElement): string {
	return host.querySelector('.qti-item-body-content')?.textContent ?? '';
}

function submit(m: Mounted) {
	return (m.instance.submit as (countAttempt?: boolean) => unknown)();
}

describe('standalone integrated feedback defaults', () => {
	test('a submit shows no integrated feedback unless the host opts in', async () => {
		const m = await render({ itemXml: ITEM, responses: { RESPONSE: 'B' } });
		submit(m);
		await settle();
		expect(body(m.host)).not.toContain('Not quite.');
	});

	test('showFeedback: true opts in', async () => {
		const m = await render({ itemXml: ITEM, responses: { RESPONSE: 'B' }, showFeedback: true });
		submit(m);
		await settle();
		expect(body(m.host)).toContain('Not quite.');
	});

	test('showFeedback: false hides feedback an opted-in default would otherwise show', async () => {
		const m = await render({
			itemXml: ITEM,
			responses: { RESPONSE: 'B' },
			showFeedback: false,
		});
		submit(m);
		await settle();
		expect(body(m.host)).not.toContain('Not quite.');
	});

	test('an injected session keeps the engine presentation policy (opt-out only there)', async () => {
		// The engine default stays show-unless-hidden: the standalone player applies the QTI
		// default, an assessment passes its itemSessionControl explicitly.
		const session = createAssessmentItemDefinition({ itemXml: ITEM }).openSession();
		sessions.push(session);
		session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 'B' });
		session.dispatch({ action: 'endAttempt' });
		const m = await render({ itemXml: ITEM, session });
		expect(body(m.host)).toContain('Not quite.');
	});
});

describe('load failure callbacks', () => {
	test('a broken item reports onError with the raw detail and renders a generic message', async () => {
		const onError = vi.fn();
		const m = await render({ itemXml: BROKEN, onError });
		expect(onError).toHaveBeenCalledTimes(1);
		const detail = onError.mock.calls[0][0] as { code: string; message: string };
		expect(detail.code).toBe('item-load-failed');
		expect(detail.message).toMatch(/\S/);

		const alert = m.host.querySelector('[role="alert"]');
		expect(alert?.textContent).toContain('Failed to load item');
		expect(alert?.textContent).not.toBe(detail.message);
	});

	test('onReady runs once the item rendered, not when it failed to load', async () => {
		const onReady = vi.fn();
		await render({ itemXml: ITEM, onReady });
		expect(onReady).toHaveBeenCalledTimes(1);

		const failed = await render({ itemXml: BROKEN, onReady: vi.fn() });
		expect(failed.host.querySelector('[role="alert"]')).not.toBeNull();
	});
});
