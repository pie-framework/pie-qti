import { afterEach, describe, expect, test, vi } from 'vitest';

// The toolkit's element chunks fail like a broken deployment: the bar reports the
// failure to the host instead of staying silent.
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
vi.mock('@pie-players/pie-assessment-toolkit/components/pie-assessment-toolkit-element', () => {
	throw new Error('chunk fetch failed');
});

import QtiToolButtonBar from '../../src/components/QtiToolButtonBar.svelte';
import { mountInto, settle, type Mounted } from './helpers';

const mounted: Mounted[] = [];

afterEach(() => {
	for (const m of mounted.splice(0)) m.destroy();
});

describe('a failed toolkit element load', () => {
	test('reports to the host and renders no raw failure text', async () => {
		const onFrameworkError = vi.fn();
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		try {
			const m = mountInto(QtiToolButtonBar, {
				tools: [{ toolId: 'calculator' }],
				scopeId: 'q1',
				scopeLabel: 'question',
				onFrameworkError,
			});
			mounted.push(m);
			await settle();

			expect(onFrameworkError).toHaveBeenCalledTimes(1);
			const report = onFrameworkError.mock.calls[0]![0] as Record<string, unknown>;
			expect(report.code).toBe('toolkit-load-failed');
			expect(report.itemIdentifier).toBe('q1');
			// The scope is named, and the raw import failure travels as the message.
			expect(String(report.message)).toContain('q1');
			expect(report.cause).toBeInstanceOf(Error);
			// The raw message is for host logs only: it never reaches the candidate's DOM.
			expect(m.host.textContent).not.toContain(String(report.message));
			expect(m.host.querySelector('pie-assessment-toolkit')).toBeNull();
			// The console still carries the failure for the developer.
			expect(consoleError).toHaveBeenCalled();
		} finally {
			consoleError.mockRestore();
		}
	});
});
