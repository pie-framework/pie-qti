/**
 * Every interaction reads exactly the selection-message attributes its QTI 3.0 element defines
 * (imsqti_asiv3p0_v1p0.xsd): `data-max-selections-message` and `data-min-selections-message`,
 * under those spec names. No interaction invents or reads a non-spec name, and an interaction
 * whose element defines neither (associate, graphic order, graphic associate, select point,
 * position object) reads neither.
 */

import { describe, expect, test } from 'bun:test';
import { Player } from '../../core/Player.js';

const qti3Item = (identifier: string, body: string, declaration: string) =>
	`<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
  identifier="${identifier}" title="${identifier}" adaptive="false" time-dependent="false">
  ${declaration}
  <qti-item-body>${body}</qti-item-body>
</qti-assessment-item>`;

const firstInteraction = (xml: string): any => new Player({ itemXml: xml }).getInteractionData()[0];

const MAX = 'data-max-selections-message="No more."';
const MIN = 'data-min-selections-message="At least one."';

/** One QTI 3 body per interaction, minimal but valid, carrying both message attributes. */
const BODIES: Array<[type: string, body: string, declaration: string]> = [
	[
		'choiceInteraction',
		`<qti-choice-interaction response-identifier="RESPONSE" max-choices="2" ${MAX} ${MIN}>
      <qti-simple-choice identifier="a">Red</qti-simple-choice>
      <qti-simple-choice identifier="b">Blue</qti-simple-choice>
    </qti-choice-interaction>`,
		'<qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="identifier"/>',
	],
	[
		'orderInteraction',
		`<qti-order-interaction response-identifier="RESPONSE" min-choices="1" ${MAX} ${MIN}>
      <qti-simple-choice identifier="a">Spring</qti-simple-choice>
      <qti-simple-choice identifier="b">Summer</qti-simple-choice>
    </qti-order-interaction>`,
		'<qti-response-declaration identifier="RESPONSE" cardinality="ordered" base-type="identifier"/>',
	],
	[
		'matchInteraction',
		`<qti-match-interaction response-identifier="RESPONSE" ${MAX} ${MIN}>
      <qti-simple-match-set><qti-simple-associable-choice identifier="s1" match-max="1">Cat</qti-simple-associable-choice></qti-simple-match-set>
      <qti-simple-match-set><qti-simple-associable-choice identifier="t1" match-max="1">Kitten</qti-simple-associable-choice></qti-simple-match-set>
    </qti-match-interaction>`,
		'<qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>',
	],
	[
		'associateInteraction',
		`<qti-associate-interaction response-identifier="RESPONSE" ${MAX} ${MIN}>
      <qti-simple-associable-choice identifier="a" match-max="1">Cat</qti-simple-associable-choice>
      <qti-simple-associable-choice identifier="b" match-max="1">Kitten</qti-simple-associable-choice>
    </qti-associate-interaction>`,
		'<qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="pair"/>',
	],
	[
		'gapMatchInteraction',
		`<qti-gap-match-interaction response-identifier="RESPONSE" ${MAX} ${MIN}>
      <qti-gap-text identifier="t1" match-max="1">producer</qti-gap-text>
      <qti-p>A plant is a <qti-gap identifier="g1"/>.</qti-p>
    </qti-gap-match-interaction>`,
		'<qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>',
	],
	[
		'inlineChoiceInteraction',
		`<qti-p>A <qti-inline-choice-interaction response-identifier="RESPONSE" ${MIN}>
      <qti-inline-choice identifier="a">rose</qti-inline-choice>
      <qti-inline-choice identifier="b">tulip</qti-inline-choice>
    </qti-inline-choice-interaction> is here.</qti-p>`,
		'<qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>',
	],
	[
		'hotspotInteraction',
		`<qti-hotspot-interaction response-identifier="RESPONSE" max-choices="2" ${MAX} ${MIN}>
      <img src="map.png" alt="Map" width="400" height="300"/>
      <qti-hotspot-choice identifier="h1" shape="circle" coords="50,50,20"/>
      <qti-hotspot-choice identifier="h2" shape="circle" coords="150,50,20"/>
    </qti-hotspot-interaction>`,
		'<qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="identifier"/>',
	],
	[
		'hottextInteraction',
		`<qti-hottext-interaction response-identifier="RESPONSE" max-choices="2" ${MAX} ${MIN}>
      <qti-p><qti-hottext identifier="h1">one</qti-hottext> <qti-hottext identifier="h2">two</qti-hottext></qti-p>
    </qti-hottext-interaction>`,
		'<qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="identifier"/>',
	],
	[
		'graphicGapMatchInteraction',
		`<qti-graphic-gap-match-interaction response-identifier="RESPONSE" ${MAX} ${MIN}>
      <img src="map.png" alt="Map" width="400" height="300"/>
      <qti-gap-text identifier="t1" match-max="1">Harbour</qti-gap-text>
      <qti-associable-hotspot identifier="h1" shape="circle" coords="50,50,20" match-max="1"/>
    </qti-graphic-gap-match-interaction>`,
		'<qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>',
	],
	[
		'graphicOrderInteraction',
		`<qti-graphic-order-interaction response-identifier="RESPONSE" ${MAX} ${MIN}>
      <img src="map.png" alt="Map" width="400" height="300"/>
      <qti-hotspot-choice identifier="h1" shape="circle" coords="50,50,20"/>
      <qti-hotspot-choice identifier="h2" shape="circle" coords="150,50,20"/>
    </qti-graphic-order-interaction>`,
		'<qti-response-declaration identifier="RESPONSE" cardinality="ordered" base-type="identifier"/>',
	],
];

/** The message attributes each QTI 3.0 element defines per imsqti_asiv3p0_v1p0.xsd. */
const DEFINES_MAX: Record<string, boolean> = {
	choiceInteraction: true,
	orderInteraction: true,
	matchInteraction: true,
	associateInteraction: false,
	gapMatchInteraction: true,
	inlineChoiceInteraction: false,
	hotspotInteraction: true,
	hottextInteraction: true,
	graphicGapMatchInteraction: true,
	graphicOrderInteraction: false,
};
const DEFINES_MIN: Record<string, boolean> = {
	choiceInteraction: true,
	orderInteraction: true,
	matchInteraction: true,
	associateInteraction: false,
	gapMatchInteraction: true,
	inlineChoiceInteraction: true,
	hotspotInteraction: true,
	hottextInteraction: true,
	graphicGapMatchInteraction: true,
	graphicOrderInteraction: false,
};

describe('QTI 3.0 selection messages are read exactly as the element defines them', () => {
	for (const [type, body, declaration] of BODIES) {
		test(`${type}: the spec attributes are delivered, non-spec names are ignored`, () => {
			const interaction = firstInteraction(qti3Item(`messages-${type}`, body, declaration));

			if (DEFINES_MAX[type]) {
				expect(interaction.maxSelectionsMessage).toBe('No more.');
				// The data-qti- spelling no QTI version defines is not read.
				const prefixed = firstInteraction(
					qti3Item(
						`messages-prefixed-${type}`,
						body.replace(MAX, 'data-qti-max-selections-message="Prefixed."'),
						declaration,
					),
				);
				expect(prefixed).not.toHaveProperty('maxSelectionsMessage');
			} else {
				expect(interaction).not.toHaveProperty('maxSelectionsMessage');
			}

			if (DEFINES_MIN[type]) {
				expect(interaction.minSelectionsMessage).toBe('At least one.');
				const prefixed = firstInteraction(
					qti3Item(
						`messages-prefixed-min-${type}`,
						body.replace(MIN, 'data-qti-min-selections-message="Prefixed."'),
						declaration,
					),
				);
				expect(prefixed).not.toHaveProperty('minSelectionsMessage');
			} else {
				expect(interaction).not.toHaveProperty('minSelectionsMessage');
			}
		});
	}
});
