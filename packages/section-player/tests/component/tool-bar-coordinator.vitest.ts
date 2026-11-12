import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The toolkit is a recording fake: the tests observe which coordinator calls the
// bar makes — construction, the live mutators, and disposal — without loading the
// real coordinator or tool modules.
const { created, disposed, placements, toolConfigUpdates } = vi.hoisted(() => ({
	created: [] as Array<{ config: Record<string, unknown> }>,
	disposed: [] as unknown[],
	placements: [] as unknown[],
	toolConfigUpdates: [] as Array<[string, unknown]>,
}));

vi.mock('@pie-players/pie-assessment-toolkit', () => ({
	ToolkitCoordinator: class {
		config: Record<string, unknown>;
		constructor(config: Record<string, unknown>) {
			this.config = config;
			created.push(this);
		}
		updateAssessment() {}
		updateToolConfig(toolId: string, updates: unknown) {
			toolConfigUpdates.push([toolId, updates]);
		}
		updateToolsPlacement(partial: unknown) {
			placements.push(partial);
		}
		dispose() {
			disposed.push(this);
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
import { reactiveProps } from './reactive-props.svelte';

const mounted: Mounted[] = [];

beforeEach(() => {
	created.length = 0;
	disposed.length = 0;
	placements.length = 0;
	toolConfigUpdates.length = 0;
});

afterEach(() => {
	for (const m of mounted.splice(0)) m.destroy();
});

describe('the bar’s toolkit coordinator', () => {
	test('a placement change reaches the live coordinator without rebuilding it', async () => {
		const state = reactiveProps({ tools: [{ toolId: 'calculator' }], scopeId: 'q1', scopeLabel: 'item' });
		const m = mountInto(QtiToolButtonBar, state);
		mounted.push(m);
		await settle();
		expect(created).toHaveLength(1);

		// The same tools move from the item level to the passage level: the allowlist
		// is unchanged, so the coordinator stays and only its placement moves.
		state.scopeLabel = 'passage';
		await settle();

		expect(created).toHaveLength(1);
		expect(disposed).toHaveLength(0);
		expect(placements).toEqual([{ section: [], item: [], passage: ['calculator'] }]);
	});

	test('a provider change reaches the live coordinator as a tool config update', async () => {
		const state = reactiveProps({ tools: [{ toolId: 'textToSpeech' }], scopeId: 'q1', scopeLabel: 'item' });
		const m = mountInto(QtiToolButtonBar, state);
		mounted.push(m);
		await settle();
		expect(created).toHaveLength(1);

		// The scope's content language refines the read-aloud provider config.
		state.language = 'nl-NL';
		await settle();

		expect(created).toHaveLength(1);
		expect(disposed).toHaveLength(0);
		const ttsUpdates = toolConfigUpdates.filter(([toolId]) => toolId === 'textToSpeech');
		expect(ttsUpdates).toHaveLength(1);
		const [, updates] = ttsUpdates[0]!;
		expect(updates).toMatchObject({ language: 'nl-NL', defaultVoice: 'Lotte' });
	});

	test('an allowlist change rebuilds the coordinator and disposes the one it replaces', async () => {
		const state = reactiveProps({ tools: [{ toolId: 'calculator' }], scopeId: 'q1', scopeLabel: 'item' });
		const m = mountInto(QtiToolButtonBar, state);
		mounted.push(m);
		await settle();
		expect(created).toHaveLength(1);
		const first = created[0]!;

		// The toolkit exposes no mutator for `tools.policy`, so a different allowlist
		// can only take effect in a coordinator built with it.
		state.tools = [{ toolId: 'ruler' }];
		await settle();

		expect(created).toHaveLength(2);
		expect(disposed).toContain(first);
		const replacement = created[1]!;
		expect(replacement).not.toBe(first);
		expect((replacement.config.tools as { policy: { allowed: string[] } }).policy.allowed).toEqual(['ruler']);
		expect((replacement.config.tools as { placement: { item: string[] } }).placement.item).toEqual(['ruler']);
		// The replacement was built with the new config, so the mutators had nothing
		// left to apply.
		expect(placements).toHaveLength(0);
		expect(toolConfigUpdates).toHaveLength(0);
	});

	test('unmounting the bar disposes the coordinator it owns', async () => {
		const m = mountInto(QtiToolButtonBar, reactiveProps({ tools: [{ toolId: 'calculator' }], scopeId: 'q1', scopeLabel: 'item' }));
		mounted.push(m);
		await settle();
		expect(created).toHaveLength(1);

		mounted.splice(mounted.indexOf(m), 1);
		m.destroy();
		expect(disposed).toEqual(created);
	});
});
