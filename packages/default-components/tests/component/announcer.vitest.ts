/**
 * The polite live-region announcer: a component sets the announcement, and a
 * repeat of the same text still changes the live region's DOM, so assistive
 * technology announces it again. One helper, used by every interaction that
 * renders a live region.
 */

import { describe, expect, test } from 'vitest';
import { createAnnouncer } from '../../src/shared/utils/announcer.svelte';

describe('createAnnouncer', () => {
	test('the message is the announced text', () => {
		const announcer = createAnnouncer();
		expect(announcer.message).toBe('');
		announcer.announce('Placed at 50%, 25%.');
		expect(announcer.message).toBe('Placed at 50%, 25%.');
	});

	test('a repeat appends a trailing zero-width space, so the DOM changes', () => {
		const announcer = createAnnouncer();
		announcer.announce('Association not possible.');
		const first = announcer.message;
		announcer.announce('Association not possible.');
		expect(announcer.message).toBe(`${first}\u200b`);
		expect(announcer.message.length).toBe(first.length + 1);
	});

	test('a different message replaces the previous one outright', () => {
		const announcer = createAnnouncer();
		announcer.announce('First.');
		announcer.announce('Second.');
		expect(announcer.message).toBe('Second.');
		expect(announcer.message.endsWith('\u200b')).toBe(false);
	});

	test('set states the text without the re-announce toggle', () => {
		const announcer = createAnnouncer();
		announcer.set('Position: 10%, 20%.');
		announcer.set('Position: 10%, 20%.');
		expect(announcer.message).toBe('Position: 10%, 20%.');
	});

	test('clear empties the region', () => {
		const announcer = createAnnouncer();
		announcer.announce('First.');
		announcer.clear();
		expect(announcer.message).toBe('');
	});
});
