import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The item player element is the item player package's; a stand-in keeps these tests on
// the section's own behaviour.
vi.mock('@pie-qti/item-player/element', () => {
	if (!customElements.get('pie-qti-item-player')) {
		customElements.define('pie-qti-item-player', class extends HTMLElement {});
	}
	return {};
});

import SectionPlayerSplitPane from '../../src/components/SectionPlayerSplitPane.svelte';
import SectionPlayerVertical from '../../src/components/SectionPlayerVertical.svelte';
import SplitPaneResizer from '../../src/components/SplitPaneResizer.svelte';
import type {
	QtiSectionDisplaySettingsEvent,
	ResolvedQtiSectionComposition,
} from '../../src/contracts/index.js';
import { resolveQtiSectionComposition } from '../../src/composition/resolveQtiSectionComposition.js';
import { mountInto, settle, type Mounted } from './helpers';

const mounted: Mounted[] = [];
const originalMatchMedia = window.matchMedia;
let assessmentCounter = 0;
let restoreDialog: (() => void) | null = null;

function viewportIsNarrow(narrow: boolean) {
	window.matchMedia = ((query: string) => ({
		matches: narrow,
		media: query,
		onchange: null,
		addEventListener() {},
		removeEventListener() {},
		addListener() {},
		removeListener() {},
		dispatchEvent: () => false,
	})) as typeof window.matchMedia;
}

const ITEM_XML = `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="q1" title="Q1" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <itemBody><choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice></choiceInteraction></itemBody>
</assessmentItem>`;

function composition(
	options: { pnp?: ResolvedQtiSectionComposition['pnp']; onDisplaySettingsChange?: (event: QtiSectionDisplaySettingsEvent) => void } = {},
): ResolvedQtiSectionComposition {
	assessmentCounter += 1;
	return resolveQtiSectionComposition({
		assessmentId: `assessment-${assessmentCounter}`,
		pnp: options.pnp,
		host: { onDisplaySettingsChange: options.onDisplaySettingsChange },
		section: {
			identifier: 'section-1',
			itemRefs: [{ identifier: 'q1', title: 'Question one', itemXml: ITEM_XML }],
			sharedContext: {
				passages: [
					{ identifier: 'p1', kind: 'passage', scope: 'section', view: ['candidate'], rawHtml: '<p>The water cycle.</p>' },
				],
				stimuli: [],
				rubricBlocks: [],
				testFeedback: [],
				stylesheets: [],
				catalogSources: [],
				assetDiagnostics: [],
			},
		},
	});
}

async function waitFor<T>(find: () => T | null | undefined, timeoutMs = 2000): Promise<T> {
	const start = Date.now();
	for (;;) {
		await settle();
		const found = find();
		if (found) return found;
		if (Date.now() - start > timeoutMs) throw new Error('Timed out waiting for the section to render');
	}
}

function settingsButton(host: HTMLElement) {
	return waitFor(() => host.querySelector<HTMLButtonElement>('[data-testid="section-display-settings-button"]'));
}

function dialogOf(host: HTMLElement): HTMLDialogElement {
	const dialog = host.querySelector<HTMLDialogElement>('[data-testid="section-display-settings-dialog"]');
	if (!dialog) throw new Error('No display settings dialog');
	return dialog;
}

beforeEach(() => {
	viewportIsNarrow(false);
});

afterEach(() => {
	for (const m of mounted.splice(0)) m.destroy();
	window.matchMedia = originalMatchMedia;
	restoreDialog?.();
	restoreDialog = null;
});

describe('section PNP surface', () => {
	test('the vertical layout applies the display needs to the whole section it renders', async () => {
		const m = mountInto(SectionPlayerVertical, {
			composition: composition({ pnp: { display: { colorScheme: 'yellowblue', textAppearance: { lineHeight: 2 } } } }),
		});
		mounted.push(m);
		await settle();

		const surface = m.host.querySelector<HTMLElement>('.section-player-vertical')!;
		expect(surface.hasAttribute('data-qti-pnp-surface')).toBe(true);
		expect(surface.getAttribute('data-qti-colorscheme')).toBe('yellowblue');
		expect(surface.getAttribute('data-qti-text-appearance')).toBe('line-height');
		// The passage is inside the surface, so it takes the scheme and the text appearance.
		expect(surface.contains(m.host.querySelector('article.passage'))).toBe(true);
		// The host page outside the section is untouched.
		expect(m.host.hasAttribute('data-qti-colorscheme')).toBe(false);
		expect(document.body.hasAttribute('data-qti-colorscheme')).toBe(false);
	});

	test('a pnp prop wins over the composition profile', async () => {
		const m = mountInto(SectionPlayerVertical, {
			composition: composition({ pnp: { display: { colorScheme: 'yellowblue' } } }),
			pnp: { display: { colorScheme: 'blackcream' } },
		});
		mounted.push(m);
		await settle();
		expect(m.host.querySelector('.section-player-vertical')?.getAttribute('data-qti-colorscheme')).toBe('blackcream');
	});

	test('the split layout is the surface, and a single-column need stacks its panes at any width', async () => {
		const state = mountInto(SplitPaneResizer, { pnp: { display: { singleColumn: true, colorScheme: 'whiteblack' } } });
		mounted.push(state);
		await settle();

		const layout = state.host.querySelector<HTMLElement>('.split-layout')!;
		expect(layout.hasAttribute('data-qti-pnp-surface')).toBe(true);
		expect(layout.getAttribute('data-qti-colorscheme')).toBe('whiteblack');
		expect(layout.getAttribute('data-qti-layout')).toBe('single-column');
		expect(layout.getAttribute('data-layout')).toBe('stacked');
		expect(state.host.querySelector('[role="tablist"]')).not.toBeNull();
		expect(state.host.querySelector('[role="separator"]')).toBeNull();
	});

	test('without a single-column need a wide split layout keeps its splitter', async () => {
		const state = mountInto(SplitPaneResizer, { pnp: { display: { colorScheme: 'whiteblack' } } });
		mounted.push(state);
		await settle();
		expect(state.host.querySelector('[role="separator"]')).not.toBeNull();
	});
});

describe('display settings tool', () => {
	test('the item tool bar opens an accessible modal, and changes reach the surface and the host', async () => {
		const hostEvents: QtiSectionDisplaySettingsEvent[] = [];
		const onDisplaySettingsChange = vi.fn();
		const m = mountInto(SectionPlayerVertical, {
			composition: composition({
				pnp: { display: { colorScheme: 'yellowblue' } },
				onDisplaySettingsChange: (event) => hostEvents.push(event),
			}),
			onDisplaySettingsChange,
		});
		mounted.push(m);

		const button = await settingsButton(m.host);
		expect(button.textContent?.trim()).toBe('Display settings');
		expect(button.getAttribute('aria-haspopup')).toBe('dialog');
		button.focus();
		button.click();
		await settle();

		const dialog = dialogOf(m.host);
		expect(dialog.hasAttribute('open')).toBe(true);
		// The dialog sits on the PNP surface, so it takes the candidate's display needs too.
		expect(m.host.querySelector('.section-player-vertical')?.contains(dialog)).toBe(true);
		const title = dialog.querySelector('h2')!;
		expect(dialog.getAttribute('aria-labelledby')).toBe(title.id);
		expect(document.getElementById(dialog.getAttribute('aria-describedby')!)).not.toBeNull();
		expect(document.activeElement).toBe(title);
		expect(dialog.querySelector('legend')?.textContent?.trim()).toBe('Text size');
		expect(dialog.querySelectorAll('input[type="radio"]')).toHaveLength(4);

		const surface = m.host.querySelector<HTMLElement>('.section-player-vertical')!;
		const largest = dialog.querySelectorAll<HTMLInputElement>('input[type="radio"]')[3]!;
		largest.click();
		flushSync();
		expect(surface.getAttribute('data-qti-text-appearance')).toContain('font-size');
		expect(surface.style.getPropertyValue('--qti-font-size')).toBe('20pt');

		const contrast = dialog.querySelector<HTMLInputElement>('[data-testid="section-display-settings-contrast"]')!;
		contrast.click();
		flushSync();
		expect(surface.getAttribute('data-qti-colorscheme')).toBe('blackwhite');
		contrast.click();
		flushSync();
		expect(surface.getAttribute('data-qti-colorscheme')).toBe('yellowblue');

		const spacing = dialog.querySelector<HTMLInputElement>('[data-testid="section-display-settings-spacing"]')!;
		spacing.click();
		flushSync();
		expect(surface.getAttribute('data-qti-text-appearance')?.split(' ')).toEqual(
			expect.arrayContaining(['line-height', 'letter-spacing', 'word-spacing']),
		);

		// Every change reports the settings and the effective profile, to the prop and the host contract.
		expect(onDisplaySettingsChange).toHaveBeenCalledTimes(4);
		const last = hostEvents[hostEvents.length - 1]!;
		expect(last.sectionIdentifier).toBe('section-1');
		expect(last.settings).toEqual({ textSize: 3, highContrast: false, textSpacing: true });
		expect(last.pnp.display).toMatchObject({
			colorScheme: 'yellowblue',
			textAppearance: { fontSize: 20, lineHeight: 1.5, letterSpacing: 0.12, wordSpacing: 0.16 },
		});

		dialog.querySelector<HTMLButtonElement>('[data-testid="section-display-settings-close"]')!.click();
		await settle();
		expect(dialog.hasAttribute('open')).toBe(false);
		expect(document.activeElement).toBe(button);
		// Closing keeps the settings.
		expect(surface.style.getPropertyValue('--qti-font-size')).toBe('20pt');
	});

	test('Escape closes the dialog and focus returns to the trigger', async () => {
		const m = mountInto(SectionPlayerVertical, { composition: composition() });
		mounted.push(m);
		const button = await settingsButton(m.host);
		button.focus();
		button.click();
		await settle();
		const dialog = dialogOf(m.host);
		expect(dialog.hasAttribute('open')).toBe(true);

		dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
		await settle();
		expect(dialog.hasAttribute('open')).toBe(false);
		expect(document.activeElement).toBe(button);
	});

	test('a close event queued by an earlier close does not shut the reopened dialog', async () => {
		// Browsers fire `close` from a queued task, and Chromium runs input (the click that
		// reopens the dialog) before it, so the stale event can arrive after the reopen.
		// jsdom has no showModal(); stand in for the browser's modal dialog.
		const prototype = HTMLDialogElement.prototype as Partial<HTMLDialogElement>;
		const original = { showModal: prototype.showModal, close: prototype.close };
		restoreDialog = () => Object.assign(prototype, original);
		prototype.showModal = function showModal(this: HTMLDialogElement) {
			this.setAttribute('open', '');
		};
		prototype.close = function close(this: HTMLDialogElement) {
			this.removeAttribute('open');
			setTimeout(() => this.dispatchEvent(new Event('close')), 20);
		};
		const m = mountInto(SectionPlayerVertical, { composition: composition() });
		mounted.push(m);
		const button = await settingsButton(m.host);

		button.click();
		await settle();
		const dialog = dialogOf(m.host);
		dialog.querySelector<HTMLButtonElement>('[data-testid="section-display-settings-close"]')!.click();
		await settle();
		expect(dialog.hasAttribute('open')).toBe(false);
		button.click();
		await settle();
		await new Promise((resolve) => setTimeout(resolve, 50));

		expect(dialog.hasAttribute('open')).toBe(true);
	});

	test('the settings last for the session when the shell swaps layouts', async () => {
		const shared = composition();
		const vertical = mountInto(SectionPlayerVertical, { composition: shared });
		mounted.push(vertical);
		(await settingsButton(vertical.host)).click();
		await settle();
		dialogOf(vertical.host).querySelectorAll<HTMLInputElement>('input[type="radio"]')[2]!.click();
		flushSync();
		vertical.destroy();
		mounted.splice(mounted.indexOf(vertical), 1);

		const split = mountInto(SectionPlayerSplitPane, { composition: shared });
		mounted.push(split);
		await settle();
		const layout = split.host.querySelector<HTMLElement>('.split-layout')!;
		expect(layout.style.getPropertyValue('--qti-font-size')).toBe('16pt');
		expect(layout.contains(dialogOf(split.host))).toBe(true);
		(await settingsButton(split.host)).click();
		await settle();
		expect(dialogOf(split.host).querySelectorAll<HTMLInputElement>('input[type="radio"]')[2]!.checked).toBe(true);
	});

	test('a host can leave the tool out', async () => {
		const m = mountInto(SectionPlayerVertical, { composition: composition(), displaySettings: false });
		mounted.push(m);
		await waitFor(() => m.host.querySelector('pie-qti-item-player'));
		expect(m.host.querySelector('[data-testid="section-display-settings-button"]')).toBeNull();
		expect(m.host.querySelector('[data-testid="section-display-settings-dialog"]')).toBeNull();
	});
});
