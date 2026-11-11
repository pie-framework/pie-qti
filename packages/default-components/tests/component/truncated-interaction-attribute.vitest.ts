import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import ChoiceInteraction from '../../src/plugins/choice/ChoiceInteraction.svelte';
import { cleanupInteraction, mountInteraction, qa, q, settle } from './helpers';

/**
 * A truncated interaction attribute (`interaction='{"choices":…'` — what a host's
 * templating leaves behind when it cuts a long attribute off) is not the data
 * object its component requires: `parseJsonProp` reads it as no value and says so
 * once on the console, and the component renders its no-data state instead of an
 * empty rendering with no diagnostic.
 */

beforeEach(() => {
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
	for (const node of Array.from(document.body.children)) node.remove();
});

describe('a truncated interaction attribute', () => {
	test('shows the no-data state with a console diagnostic, and takes no input', async () => {
		const mounted = mountInteraction(ChoiceInteraction, { interaction: '{"responseId":"RESPONSE","choices":' });
		await settle();

		const alert = q(mounted, '.alert-error');
		expect(alert?.textContent).toContain('No interaction data provided');
		// No interaction data: no choices to answer with.
		expect(qa(mounted, 'input[type="radio"]')).toHaveLength(0);
		expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('not the JSON object'));
		cleanupInteraction(mounted);
	});

	test('a different broken attribute warns again (once per distinct text)', async () => {
		const mounted = mountInteraction(ChoiceInteraction, { interaction: '{"responseId":"OTHER","maxC' });
		await settle();

		expect(q(mounted, '.alert-error')).not.toBeNull();
		expect(console.warn).toHaveBeenCalledTimes(1);
		cleanupInteraction(mounted);
	});

	test('a valid attribute keeps rendering the interaction', async () => {
		const mounted = mountInteraction(ChoiceInteraction, {
			interaction:
				'{"type":"choiceInteraction","responseId":"RESPONSE","shuffle":false,"maxChoices":1,"minChoices":1,"prompt":null,"choices":[{"identifier":"A","text":"<p>Alpha</p>"}]}',
		});
		await settle();

		expect(qa(mounted, 'input[type="radio"]')).toHaveLength(1);
		expect(console.warn).not.toHaveBeenCalled();
		cleanupInteraction(mounted);
	});
});
