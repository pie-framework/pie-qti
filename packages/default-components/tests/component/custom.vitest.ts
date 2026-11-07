import { afterEach, describe, expect, test, vi } from 'vitest';
import type { I18nProvider } from '@pie-qti/i18n';
import type { CustomInteractionData } from '@pie-qti/item-player';
import CustomInteraction from '../../src/plugins/custom/CustomInteraction.svelte';
import { cleanupInteraction, mountInteraction, q, settle, type } from './helpers';

/**
 * English fallback provider. The component calls `i18n?.t(key, fallback)`, so with no
 * provider at all no text is produced; this stub reproduces what the player supplies.
 */
const i18n: I18nProvider = {
	getLocale: () => 'en',
	setLocale: () => {},
	t: (key, defaultOrValues) => (typeof defaultOrValues === 'string' ? defaultOrValues : key),
};

function customData(overrides: Partial<CustomInteractionData> = {}): CustomInteractionData {
	return {
		type: 'customInteraction',
		responseId: 'RESPONSE',
		prompt: '<p>Sequence the tiles using the vendor widget.</p>',
		rawAttributes: { 'vendor-type': 'sequencer.v2', class: 'my-vendor-widget' },
		xml: '<customInteraction responseIdentifier="RESPONSE" vendor-type="sequencer.v2"/>',
		...overrides,
	};
}

afterEach(() => {
	vi.restoreAllMocks();
	for (const node of Array.from(document.body.children)) node.remove();
});

describe('CustomInteraction fallback (pie-qti-custom)', () => {
	test('renders without crashing for a minimal custom definition and explains the fallback', async () => {
		const mounted = mountInteraction(CustomInteraction, { interaction: customData(), i18n });
		await settle();

		// The fallback warning is the candidate-facing headline.
		const warning = q(mounted, '.qti-custom-warning');
		expect(warning?.textContent).toContain('Unsupported customInteraction');
		expect(warning?.textContent).toContain(
			'This item contains a vendor-specific interaction. This player does not execute custom interactions.',
		);
		// The authored prompt is still visible to the candidate.
		expect(warning?.textContent).toContain('Sequence the tiles using the vendor widget.');

		// Manual response entry keeps the item answerable despite the unsupported logic.
		expect(q<HTMLTextAreaElement>(mounted, 'textarea')?.getAttribute('id')).toBe('custom-RESPONSE');
		// Show details works: attributes and XML are inspectable on demand.
		expect(q(mounted, '.qti-custom-details')).toBeNull();
		q<HTMLButtonElement>(mounted, 'button.qti-custom-toggle')!.click();
		await settle();
		expect(q(mounted, '.qti-custom-details')?.textContent).toContain('vendor-type');
		expect(q(mounted, '.qti-custom-details')?.textContent).toContain('customInteraction responseIdentifier');
	});

	test('the manual textarea is labelled and the manual entry propagates through the standard change event', async () => {
		const mounted = mountInteraction(CustomInteraction, { interaction: customData(), i18n });
		await settle();

		const textarea = q<HTMLTextAreaElement>(mounted, 'textarea')!;
		// The visible label element points at the textarea.
		const labelFor = q<HTMLLabelElement>(mounted, 'label[for]')?.getAttribute('for');
		expect(labelFor).toBe(textarea.getAttribute('id'));

		type(textarea, 'Candidate typed this by hand');
		await settle();

		expect(mounted.instance.response).toBe('Candidate typed this by hand');
		expect(mounted.events).toHaveLength(1);
		expect(mounted.events[0]!.type).toBe('qti-change');
		expect(mounted.events[0]!.detail).toMatchObject({ responseId: 'RESPONSE', value: 'Candidate typed this by hand' });
		expect(mounted.events[0]!.bubbles).toBe(true);
		expect(mounted.events[0]!.composed).toBe(true);

		// Clearing the field clears the response (empty string is stored as null).
		type(textarea, '');
		await settle();
		expect(mounted.instance.response).toBeNull();
		expect(mounted.events[mounted.events.length - 1]!.detail).toMatchObject({ value: null });
	});

	test('a restored session value is shown in the manual entry', async () => {
		const mounted = mountInteraction(CustomInteraction, {
			interaction: customData(),
			response: 'kept-answer',
			i18n,
		});
		await settle();

		expect(q<HTMLTextAreaElement>(mounted, 'textarea')?.value).toBe('kept-answer');
	});

	test('disabled: the manual entry is disabled and cannot be operated', async () => {
		const mounted = mountInteraction(CustomInteraction, {
			interaction: customData(),
			disabled: true,
			i18n,
		});
		await settle();

		const textarea = q<HTMLTextAreaElement>(mounted, 'textarea')!;
		expect(textarea.disabled).toBe(true);
		// A real user cannot type into a disabled textarea; the component dispatched
		// nothing on its own, so no response exists.
		expect(mounted.instance.response).toBeUndefined();
		expect(mounted.events).toHaveLength(0);
	});

	test('a missing interaction is announced as an error and no fallback renders', async () => {
		const mounted = mountInteraction(CustomInteraction, { interaction: undefined, i18n });
		await settle();

		const alert = q(mounted, '.alert-error');
		expect(alert?.textContent).toContain('No interaction data provided');
		expect(q(mounted, 'textarea')).toBeNull();
	});

	test('an authored accessibility label names the interaction group', async () => {
		const mounted = mountInteraction(CustomInteraction, {
			interaction: customData({ accessibility: { label: 'Vendor sequencing task' } }),
			i18n,
		});
		await settle();

		const root = q(mounted, '.qti-custom-interaction');
		expect(root?.getAttribute('role')).toBe('group');
		expect(root?.getAttribute('aria-label')).toBe('Vendor sequencing task');
	});

	test('an authored accessibility description is referenced by the interaction root', async () => {
		const mounted = mountInteraction(CustomInteraction, {
			interaction: customData({ accessibility: { description: 'Type your final ordering below.' } }),
			i18n,
		});
		await settle();

		const root = q(mounted, '.qti-custom-interaction');
		const describedBy = root?.getAttribute('aria-describedby');
		expect(describedBy).toBeTruthy();
		expect(mounted.host.querySelector(`#${CSS.escape(describedBy!)}`)?.textContent).toBe(
			'Type your final ordering below.',
		);
	});

	test('the fallback answerable input is reachable by keyboard (not opt-out of tab order)', async () => {
		const mounted = mountInteraction(CustomInteraction, { interaction: customData(), i18n });
		await settle();

		const textarea = q<HTMLTextAreaElement>(mounted, 'textarea')!;
		expect(textarea.disabled).toBe(false);
		expect(textarea.getAttribute('tabindex')).not.toBe('-1');
	});

	// FIXME — known product bug (duplicate ids across instances): the fallback derives its textarea
	// id purely from the response id (`custom-${responseId}`), so two renderings of the same
	// item — candidate + scorer view, two players on one page — produce two elements with
	// id `custom-RESPONSE`. The second instance's `label[for]` then resolves to the first
	// instance's textarea (label/name association broken for AT). Same-id hygiene is
	// enforced elsewhere: the choice interaction keeps instance-unique ids on purpose, and
	// match/associate moved their ids to $props.id() the same way.
	// Repro: mount CustomInteraction twice with the same interaction data; both textareas
	// have id 'custom-RESPONSE' (CustomInteraction.svelte passes
	// testIdInput={`custom-input-${responseId}`}, CustomInteractionFallback.svelte uses
	// id={`custom-${responseId}`}).
	// Vitest has no `test.fixme`: `test.skip` is the marker. Remove it in the change that
	// fixes the bug.
	test.skip('two renderings of the same item keep unique textarea ids and labels', async () => {
		const first = mountInteraction(CustomInteraction, { interaction: customData(), i18n });
		const second = mountInteraction(CustomInteraction, { interaction: customData(), i18n });
		await settle();

		const firstInput = q<HTMLTextAreaElement>(first, 'textarea')!;
		const secondInput = q<HTMLTextAreaElement>(second, 'textarea')!;
		expect(firstInput.id).not.toBe(secondInput.id);

		// Label/for wiring stays inside each instance.
		for (const mounted of [first, second]) {
			const textarea = q<HTMLTextAreaElement>(mounted, 'textarea')!;
			expect(q<HTMLLabelElement>(mounted, `label[for="${textarea.id}"]`)).not.toBeNull();
		}
		cleanupInteraction(first, second);
	});

	// FIXME — known product bug (i18n provider never reaches the fallback): CustomInteraction
	// accepts an `i18n` prop but does not forward it to CustomInteractionFallback, which
	// renders its English literal defaults for every candidate-facing string. Hosts with a
	// translating provider get English fallback UI (the wrapper's own aria attributes and
	// InteractionDescription do respect the provider, so the gap is the fallback body).
	// Repro: mount CustomInteraction with a provider that translates
	// 'interactions.custom.unsupported' to French; the warning headline still reads
	// "Unsupported customInteraction" (CustomInteraction.svelte renders
	// <CustomInteractionFallback …> without {i18n}). Skipped until fixed, as above.
	test.skip('the fallback speaks the language of the provided i18n provider', async () => {
		const translations: Record<string, string> = {
			'interactions.custom.unsupported': 'customInteraction non prise en charge',
			'interactions.custom.manualResponse': 'Réponse manuelle (facultatif)',
			'interactions.custom.placeholder': 'Saisissez une réponse manuelle',
		};
		const french: I18nProvider = {
			getLocale: () => 'fr',
			setLocale: () => {},
			t: (key, defaultOrValues) =>
				translations[key] ?? (typeof defaultOrValues === 'string' ? defaultOrValues : key),
		};
		const mounted = mountInteraction(CustomInteraction, { interaction: customData(), i18n: french });
		await settle();

		expect(q(mounted, '.qti-custom-warning')?.textContent).toContain('customInteraction non prise en charge');
		expect(q(mounted, 'label[for]')?.textContent).toContain('Réponse manuelle (facultatif)');
		expect(q<HTMLTextAreaElement>(mounted, 'textarea')?.getAttribute('placeholder')).toBe(
			'Saisissez une réponse manuelle',
		);
	});
});
