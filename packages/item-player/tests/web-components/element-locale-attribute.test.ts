import { describe, expect, test } from 'bun:test';
import { PieQtiItemPlayerElement } from '../../src/element-class.js';

describe('<pie-qti-item-player> locale attribute', () => {
	// Without `locale` in observedAttributes a host cannot set the locale in markup
	// at all — it is reachable only as a JS property, which rules out declarative
	// embedding and any server-rendered page.
	test('locale is observed, so markup and live attribute edits both reach the player', () => {
		expect(PieQtiItemPlayerElement.observedAttributes).toContain('locale');
	});

	test('the previously observed attributes are still observed', () => {
		expect(PieQtiItemPlayerElement.observedAttributes).toEqual([
			'item-xml',
			'role',
			'disabled',
			'locale',
		]);
	});
});
