/**
 * The <pie-qti-item-player> element applies the parsing limits unless the host opts out with
 * `security.parsingLimits.enabled: false`: a DOCTYPE item is rejected with no security configured,
 * a configured limit applies without `enabled`, and the opt-out renders the item.
 */

import { afterEach, describe, expect, test } from 'vitest';
import { PieQtiItemPlayerElement } from '../../src/element-class.js';
import type { PlayerSecurityConfig } from '../../src/types/index.js';
import { settle } from './helpers';

const TAG = 'pie-qti-item-player-parsing-limits';
if (!customElements.get(TAG)) customElements.define(TAG, PieQtiItemPlayerElement);

const ITEM = `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="limits" title="Limits" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <itemBody><p>Limits body</p></itemBody>
</assessmentItem>`;

const DOCTYPE_ITEM = `<?xml version="1.0"?>
<!DOCTYPE assessmentItem>
${ITEM}`;

const elements: HTMLElement[] = [];

afterEach(() => {
	for (const element of elements.splice(0)) element.remove();
});

async function render(itemXml: string, security?: PlayerSecurityConfig): Promise<HTMLElement> {
	const element = document.createElement(TAG) as PieQtiItemPlayerElement;
	element.itemXml = itemXml;
	if (security) element.security = security;
	document.body.appendChild(element);
	elements.push(element);
	await settle();
	return element;
}

function alertText(element: HTMLElement): string {
	return element.querySelector('[role="alert"]')?.textContent ?? '';
}

describe('<pie-qti-item-player> parsing limits', () => {
	test('rejects a DOCTYPE item when the host configures no security', async () => {
		const element = await render(DOCTYPE_ITEM);
		expect(alertText(element)).toMatch(/DOCTYPE/);
		expect(element.textContent).not.toContain('Limits body');
	});

	test('applies a configured limit without enabled', async () => {
		const element = await render(ITEM, { parsingLimits: { maxItemXmlBytes: 1 } });
		expect(alertText(element)).toMatch(/maxItemXmlBytes/);
	});

	test('keeps other security settings when the host configures some', async () => {
		const element = await render(DOCTYPE_ITEM, { allowIframes: false });
		expect(alertText(element)).toMatch(/DOCTYPE/);
	});

	test('renders the item when the host opts out with enabled: false', async () => {
		const element = await render(DOCTYPE_ITEM, { parsingLimits: { enabled: false } });
		expect(alertText(element)).toBe('');
		expect(element.textContent).toContain('Limits body');
	});
});
