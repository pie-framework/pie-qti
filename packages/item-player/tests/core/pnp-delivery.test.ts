/**
 * AfA PNP needs in delivery: a profile parsed from AfA reaches a QTI 2.2 item and its QTI 3.0
 * twin as answer masking on the choice mount and as display attributes on the player root.
 */

import { describe, expect, test } from 'bun:test';
import { convertQti2ToQti3 } from '@pie-qti/qti-common';
import { createAssessmentItemDefinition } from '../../src/core/AssessmentItemDefinition.js';
import { Player } from '../../src/core/Player.js';
import { parsePnpXml } from '../../src/pnp/parsePnpXml.js';

const QTI22 = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="masked" title="Masked"
  adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <simpleChoice identifier="A">Alpha</simpleChoice>
      <simpleChoice identifier="B">Beta</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;

const PNP = parsePnpXml(`<access-for-all-pnp xmlns="http://www.imsglobal.org/xsd/qtiv3p0/imsafa3p0pnp_v1p0">
	<answer-masking/>
	<layout-single-column/>
	<text-appearance><font-size>18</font-size></text-appearance>
	<calculator-on-screen calculator-type="basic"/>
</access-for-all-pnp>`);

function makeRoot(): HTMLElement & { attrs: Record<string, string>; props: Record<string, string> } {
	const attrs: Record<string, string> = {};
	const props: Record<string, string> = {};
	return {
		attrs,
		props,
		style: {
			setProperty: (k: string, v: string) => {
				props[k] = v;
			},
			removeProperty: (k: string) => {
				delete props[k];
			},
		},
		setAttribute: (k: string, v: string) => {
			attrs[k] = v;
		},
		removeAttribute: (k: string) => {
			delete attrs[k];
		},
	} as unknown as HTMLElement & { attrs: Record<string, string>; props: Record<string, string> };
}

describe.each([
	['QTI 2.2', QTI22],
	['QTI 3.0', convertQti2ToQti3(QTI22)],
])('AfA PNP in delivery (%s)', (_version, itemXml) => {
	test('masks the choices of a choice interaction', () => {
		const session = createAssessmentItemDefinition({ itemXml, pnp: PNP }).openSession();
		const block = session.present().flow.find((node) => node.kind === 'interaction');
		if (block?.kind !== 'interaction' || block.mount.placement !== 'block') throw new Error('Expected a block mount');
		expect(block.mount.answerMasking).toBe(true);
		expect(block.mount.eliminationTool).toBe(false);
		session.dispose();
	});

	test('applies the display needs to the player root', () => {
		const player = new Player({ itemXml, pnp: PNP });
		const root = makeRoot();
		player.applyPnp(root);
		expect(root.attrs).toEqual({ 'data-qti-layout': 'single-column', 'data-qti-text-appearance': 'font-size' });
		expect(root.props).toEqual({ '--qti-font-size': '18pt' });
	});

	test('keeps the tool supports for the host', () => {
		expect(new Player({ itemXml, pnp: PNP }).getPnp()?.tools).toEqual({
			supports: ['calculator'],
			toolParameters: { calculator: { type: 'basic' } },
		});
	});
});
