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
			response: ['A'],
			correctResponse: 'A',
			role: 'scorer',
		});

		expect(shell.responseId).toBe('RESPONSE');
		expect(shell.interaction?.choices[0]?.identifier).toBe('A');
		expect(shell.response).toEqual(['A']);
		expect(shell.correctResponse).toBe('A');
		expect(shell.isShowingCorrect).toBe(true);
	});

	// The item player sets every prop as a JavaScript property. A response is the value itself: a
	// string response is the candidate's text or a choice identifier, even when it reads as JSON.
	it.each(['1.50', '1e5', 'true', 'false', 'null', '"quoted"', '[1]'])(
		'keeps the string response %s exactly as given',
		(value) => {
			const shell = createInteractionShell<{ responseId: string }, unknown, unknown>({
				interaction: { responseId: 'RESPONSE' },
				response: value,
				correctResponse: value,
				role: 'scorer',
			});

			expect(shell.response).toBe(value);
			expect(shell.correctResponse).toBe(value);
			expect(shell.isShowingCorrect).toBe(true);
		},
	);

	it('passes list and number responses through unchanged and reads null as none', () => {
		const list = ['A', 'B'];
		const shell = createInteractionShell<{ responseId: string }, string[], number>({
			interaction: { responseId: 'RESPONSE' },
			response: list,
			correctResponse: 0,
			role: 'scorer',
		});
		expect(shell.response).toBe(list);
		expect(shell.correctResponse).toBe(0);
		expect(shell.isShowingCorrect).toBe(true);

		const empty = createInteractionShell<{ responseId: string }, string[], string[]>({
			interaction: { responseId: 'RESPONSE' },
			response: null,
			correctResponse: null,
			role: 'scorer',
		});
		expect(empty.response).toBeUndefined();
		expect(empty.correctResponse).toBeUndefined();
		expect(empty.isShowingCorrect).toBe(false);
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
