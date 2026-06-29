import { describe, expect, it } from 'bun:test';
import { emitInteractionChange } from '../src/shared/utils/eventHelpers';
import { createInteractionShell } from '../src/shared/utils/webComponentHelpers';

describe('interaction web-component shell helpers', () => {
	it('parses object-or-JSON interaction props and derives correct-answer mode', () => {
		const shell = createInteractionShell<
			{ responseId: string; choices: Array<{ identifier: string }> },
			string | string[],
			string | string[]
		>({
			interaction: JSON.stringify({ responseId: 'RESPONSE', choices: [{ identifier: 'A' }] }),
			response: JSON.stringify(['A']),
			correctResponse: '"A"',
			role: 'scorer',
		});

		expect(shell.responseId).toBe('RESPONSE');
		expect(shell.interaction?.choices[0]?.identifier).toBe('A');
		expect(shell.response).toEqual(['A']);
		expect(shell.correctResponse).toBe('A');
		expect(shell.isShowingCorrect).toBe(true);
	});

	it('emits one callback and one composed qti-change event', () => {
		const target = new EventTarget();
		const events: Array<CustomEvent> = [];
		const changes: string[] = [];
		target.addEventListener('qti-change', (event) => events.push(event as CustomEvent));

		emitInteractionChange({
			target,
			responseId: 'RESPONSE',
			value: 'A',
			onChange: (value) => changes.push(value),
		});

		expect(changes).toEqual(['A']);
		expect(events).toHaveLength(1);
		expect(events[0]?.detail).toMatchObject({ responseId: 'RESPONSE', value: 'A' });
		expect(events[0]?.bubbles).toBe(true);
		expect(events[0]?.composed).toBe(true);
	});
});
