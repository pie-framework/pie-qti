/**
 * The item body's error channel (final-review finding): interaction mount/update and
 * component-registry failures report `render-failed` through the coded error channel while
 * the rest of the item keeps rendering, with a visible `role="alert"` placeholder standing
 * in for the failed interaction; a rejected response write reports its own honest code
 * (`response-dispatch-failed`) instead of borrowing `render-failed`.
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import ItemPlayer from '../../src/components/ItemPlayer.svelte';
import type { AssessmentItemDefinitionPlugin, ElementExtractor } from '../../src/index.js';
import { mountInto, settle, type Mounted } from './helpers';

const ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="error-channel">
	<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
	<itemBody>
		<p>Static paragraph.</p>
		<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
			<simpleChoice identifier="A">Mars</simpleChoice>
		</choiceInteraction>
	</itemBody>
</assessmentItem>`;

const MYSTERY_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="error-channel-registry">
	<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
	<itemBody>
		<p>Registry failure paragraph.</p>
		<mysteryInteraction responseIdentifier="RESPONSE"/>
	</itemBody>
</assessmentItem>`;

const mounted: Mounted[] = [];

afterEach(() => {
	for (const m of mounted.splice(0)) m.destroy();
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

/**
 * A web component whose `interaction` property setter fails, simulating an interaction
 * whose constructor throws during mount. Defined once: jsdom's custom element registry
 * lives for the whole file.
 */
class ThrowingChoice extends HTMLElement {
	set interaction(_value: unknown) {
		throw new Error('interaction mount failed');
	}
}

let throwingChoiceDefined = false;
function defineThrowingChoice(): void {
	if (throwingChoiceDefined) return;
	throwingChoiceDefined = true;
	customElements.define('pie-qti-choice', ThrowingChoice);
}

describe('interaction mount failures', () => {
	test('a throwing interaction reports render-failed and stands in an alert', async () => {
		defineThrowingChoice();
		const onError = vi.fn();
		const m = await render({ itemXml: ITEM, onError });

		expect(onError).toHaveBeenCalledTimes(1);
		const detail = onError.mock.calls[0][0] as { code: string; message: string };
		expect(detail.code).toBe('render-failed');
		expect(detail.message).toContain('interaction mount failed');

		const alert = m.host.querySelector<HTMLElement>('.qti-item-body [role="alert"].qti-interaction-error');
		expect(alert).not.toBeNull();
		expect(alert?.textContent).toMatch(/choice/i);
		// The placeholder stands in the slot at the interaction's authored position.
		expect(alert?.closest('[data-qti-interaction-slot]')).not.toBeNull();

		// The rest of the item still renders.
		expect(body(m.host)).toContain('Static paragraph.');
	});
});

describe('response dispatch failures', () => {
	test('a rejected response write reports response-dispatch-failed, not render-failed', async () => {
		defineThrowingChoice();
		const onError = vi.fn();
		const m = await render({ itemXml: ITEM, onError });
		onError.mockClear();

		const bodyEl = m.host.querySelector('.qti-item-body');
		bodyEl?.dispatchEvent(
			new CustomEvent('qti-change', {
				detail: { responseId: 'NOT_DECLARED', value: 'A' },
			}),
		);
		await settle();

		expect(onError).toHaveBeenCalledTimes(1);
		const detail = onError.mock.calls[0][0] as { code: string; message: string };
		expect(detail.code).toBe('response-dispatch-failed');
		// A rejected write still takes the generic processing message, as before.
		expect(m.host.querySelector('[role="alert"]')?.textContent).toContain('Failed to process responses');
	});
});

describe('component registry failures', () => {
	test('an interaction no component renders reports render-failed and stands in an alert', async () => {
		const extractor: ElementExtractor = {
			id: 'error-channel:mystery',
			name: 'Mystery interaction extractor',
			priority: 100,
			elementTypes: ['mysteryInteraction'],
			canHandle: () => true,
			extract: () => ({ prompt: 'Mystery', choices: [], shuffle: false }),
		};
		const plugin: AssessmentItemDefinitionPlugin = {
			kind: 'assessment-item-definition-plugin',
			name: 'mystery-extractor-plugin',
			version: '0.0.0',
			registerExtractors(registry) {
				registry.register(extractor);
			},
		};
		const onError = vi.fn();
		const m = await render({ itemXml: MYSTERY_ITEM, plugins: [plugin], onError });

		expect(onError).toHaveBeenCalledTimes(1);
		const detail = onError.mock.calls[0][0] as { code: string; message: string };
		expect(detail.code).toBe('render-failed');
		expect(detail.message).toMatch(/No component registered/);
		// The item body itself keeps rendering.
		expect(body(m.host)).toContain('Registry failure paragraph.');
		// The candidate does not get a silent gap either: the same placeholder a failed mount
		// gets stands where the interaction was authored.
		const alert = m.host.querySelector<HTMLElement>('.qti-item-body [role="alert"].qti-interaction-error');
		expect(alert).not.toBeNull();
		expect(alert?.textContent).toMatch(/mystery/i);
		expect(alert?.closest('[data-qti-interaction-slot]')).not.toBeNull();
	});
});

describe('render-failed placeholder styling', () => {
	test('the placeholder border strokes with the error-text token, not the low-contrast fill (WCAG 1.4.11)', async () => {
		defineThrowingChoice();
		await render({ itemXml: ITEM, onError: vi.fn() });

		const css = Array.from(document.querySelectorAll('style'))
			.map((style) => style.textContent ?? '')
			.join('\n');
		const rule = css.match(/\.qti-item-body \.qti-interaction-error\s*\{[^}]*\}/);
		expect(rule).not.toBeNull();
		// The border is a non-text indicator, so it strokes with the >= 4.5:1 error TEXT
		// token; the fill stays a tinted background, never the border colour.
		expect(rule![0]).toContain('--pie-qti-error-text');
		expect(rule![0]).not.toMatch(/border[^;]*var\(--pie-qti-error,/);
	});
});
