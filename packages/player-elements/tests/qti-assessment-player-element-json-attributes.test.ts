import './setup';
import { describe, expect, test } from 'bun:test';
import { QtiAssessmentPlayerElement } from '../src/elements/QtiAssessmentPlayerElement.js';

class JsonAttributeTestElement extends QtiAssessmentPlayerElement {
	protected override _mountOrUpdate() {}
}

const TEST_TAG = 'test-qti-assessment-player-json-attributes';
if (!customElements.get(TEST_TAG)) {
	customElements.define(TEST_TAG, JsonAttributeTestElement);
}

function createElement(): JsonAttributeTestElement {
	return document.createElement(TEST_TAG) as JsonAttributeTestElement;
}

/** Sets an attribute the way a host page would, collecting the element's answer. */
function setAttribute(element: JsonAttributeTestElement, name: string, value: string): string[] {
	const messages: string[] = [];
	const listener = (event: Event) => {
		messages.push((event as CustomEvent<{ message: string }>).detail.message);
	};
	element.addEventListener('load-error', listener);
	element.attributeChangedCallback(name, null, value);
	element.removeEventListener('load-error', listener);
	return messages;
}

function removeAttribute(element: JsonAttributeTestElement, name: string): string[] {
	const messages: string[] = [];
	const listener = (event: Event) => {
		messages.push((event as CustomEvent<{ message: string }>).detail.message);
	};
	element.addEventListener('load-error', listener);
	element.attributeChangedCallback(name, 'previous', null);
	element.removeEventListener('load-error', listener);
	return messages;
}

describe('JSON-object attributes', () => {
	test('items-json parses a valid item map', () => {
		const element = createElement();
		const messages = setAttribute(
			element,
			'items-json',
			JSON.stringify({ 'item-1': '<assessmentItem identifier="item-1" />' }),
		);
		expect(messages).toEqual([]);
		expect(element.items).toEqual({ 'item-1': '<assessmentItem identifier="item-1" />' });
	});

	test('config-json parses a valid config object', () => {
		const element = createElement();
		const messages = setAttribute(element, 'config-json', JSON.stringify({ role: 'candidate' }));
		expect(messages).toEqual([]);
		expect(element.config).toEqual({ role: 'candidate' });
	});

	test('security-json parses a valid security object', () => {
		const element = createElement();
		const messages = setAttribute(element, 'security-json', JSON.stringify({ parsingLimits: { enabled: false } }));
		expect(messages).toEqual([]);
		expect(element.security).toEqual({ parsingLimits: { enabled: false } });
	});

	test('malformed items-json reports load-error naming the attribute and clears the stale items', () => {
		const element = createElement();
		setAttribute(element, 'items-json', JSON.stringify({ 'item-1': '<assessmentItem />' }));
		expect(element.items).toEqual({ 'item-1': '<assessmentItem />' });

		const messages = setAttribute(element, 'items-json', '{"item-2": ');
		expect(messages).toHaveLength(1);
		expect(messages[0]).toContain('items-json');
		expect(element.items).toBeUndefined();
	});

	test('config-json that is not an object is rejected and names the attribute', () => {
		const element = createElement();
		for (const malformed of ['"x"', '5', 'true', '[]', 'null', '{']) {
			const messages = setAttribute(element, 'config-json', malformed);
			expect(messages, `config-json=${malformed}`).toHaveLength(1);
			expect(messages[0]).toContain('config-json');
			expect(element.config).toEqual({});
		}
	});

	test('security-json that is not an object is rejected and clears the stale security', () => {
		const element = createElement();
		setAttribute(element, 'security-json', JSON.stringify({ parsingLimits: { enabled: false } }));
		expect(element.security).toEqual({ parsingLimits: { enabled: false } });

		const messages = setAttribute(element, 'security-json', '5');
		expect(messages).toHaveLength(1);
		expect(messages[0]).toContain('security-json');
		expect(element.security).toBeUndefined();
	});

	test('removing a JSON attribute clears it without an error', () => {
		const element = createElement();
		setAttribute(element, 'items-json', JSON.stringify({ 'item-1': '<assessmentItem />' }));
		setAttribute(element, 'config-json', JSON.stringify({ role: 'candidate' }));
		setAttribute(element, 'security-json', JSON.stringify({ parsingLimits: { enabled: false } }));

		expect(removeAttribute(element, 'items-json')).toEqual([]);
		expect(removeAttribute(element, 'config-json')).toEqual([]);
		expect(removeAttribute(element, 'security-json')).toEqual([]);

		expect(element.items).toBeUndefined();
		expect(element.config).toEqual({});
		expect(element.security).toBeUndefined();
	});
});
