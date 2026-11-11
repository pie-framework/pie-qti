import { afterEach, describe, expect, test, vi } from 'vitest';

// The toolkit is inert here: the bar mounts its shell and its marker without the
// real coordinator, elements or tool modules.
vi.mock('@pie-players/pie-assessment-toolkit', () => ({
	ToolkitCoordinator: class {
		updateAssessment() {}
		dispose() {
			return Promise.resolve();
		}
	},
	ToolRegistry: class {
		register() {}
		setComponentOverrides() {}
		setToolModuleLoaders() {}
	},
}));
vi.mock('@pie-players/pie-default-tool-loaders', () => ({
	calculatorToolRegistration: {},
	protractorToolRegistration: {},
	rulerToolRegistration: {},
	ttsToolRegistration: {},
	DEFAULT_TOOL_MODULE_LOADERS: { ruler: () => {}, protractor: () => {} },
}));
vi.mock('@pie-players/pie-assessment-toolkit/components/item-scope-element', () => ({}));
vi.mock('@pie-players/pie-assessment-toolkit/components/item-toolbar-element', () => ({}));
vi.mock('@pie-players/pie-assessment-toolkit/components/pie-assessment-toolkit-element', () => ({}));

import QtiToolButtonBar from '../../src/components/QtiToolButtonBar.svelte';
import { mountInto, settle, type Mounted } from './helpers';

const mounted: Mounted[] = [];

/** The toolkit's ownFontAwesome check: any stylesheet link matching its pattern. */
function fontAwesomeLinks() {
	return Array.from(document.querySelectorAll('link[rel="stylesheet"][href]')).filter((link) =>
		/font.?awesome|fa-?pro/i.test((link as HTMLLinkElement).href),
	);
}

function markers() {
	return Array.from(document.querySelectorAll('link[href*="fontawesome-pie-qti-fallback"]'));
}

afterEach(() => {
	for (const m of mounted.splice(0)) m.destroy();
});

describe('the FontAwesome suppression marker', () => {
	test('renders inside the bar shell, not the host head, and satisfies the toolkit check', async () => {
		const headMarkersBefore = markers().length;
		const m = mountInto(QtiToolButtonBar, { tools: [{ toolId: 'calculator' }], scopeId: 'q1', scopeLabel: 'item' });
		mounted.push(m);
		await settle();

		expect(document.head.querySelectorAll('link[href*="fontawesome-pie-qti-fallback"]')).toHaveLength(0);
		const inShell = m.host.querySelectorAll('link[href*="fontawesome-pie-qti-fallback"]');
		expect(inShell).toHaveLength(1);
		expect(markers()).toHaveLength(headMarkersBefore + 1);
		// The toolkit skips its injection when its document-wide check matches a link.
		expect(fontAwesomeLinks().length).toBeGreaterThan(0);
	});

	test('one marker per page: a second bar adds none', async () => {
		const first = mountInto(QtiToolButtonBar, { tools: [{ toolId: 'calculator' }], scopeId: 'q1', scopeLabel: 'item' });
		mounted.push(first);
		await settle();

		const second = mountInto(QtiToolButtonBar, { tools: [{ toolId: 'ruler' }], scopeId: 'q2', scopeLabel: 'passage' });
		mounted.push(second);
		await settle();

		expect(markers()).toHaveLength(1);
		expect(second.host.querySelectorAll('link[href*="fontawesome-pie-qti-fallback"]')).toHaveLength(0);
	});

	test('a page whose head already links FontAwesome gains no marker', async () => {
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = 'https://cdn.example.com/fontawesome.min.css';
		document.head.appendChild(link);
		try {
			const m = mountInto(QtiToolButtonBar, { tools: [{ toolId: 'calculator' }], scopeId: 'q1', scopeLabel: 'item' });
			mounted.push(m);
			await settle();
			expect(markers()).toHaveLength(0);
		} finally {
			link.remove();
		}
	});
});
