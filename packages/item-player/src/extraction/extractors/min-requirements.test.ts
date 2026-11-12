/**
 * The minimum-response constraints and their authored messages reach the renderers, which
 * state an unmet requirement on the question itself (WCAG 3.3.2 / 3.3.3): QTI 2.2 camelCase
 * and QTI 3.0 kebab-case attributes alike.
 */

import { describe, expect, it } from 'bun:test';
import { Player } from '../../core/Player.js';

const qti2Item = (identifier: string, body: string, declarations: string) => `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="${identifier}" title="${identifier}" adaptive="false" timeDependent="false">
  ${declarations}
  <itemBody>${body}</itemBody>
</assessmentItem>`;

const qti3Item = (identifier: string, body: string, declarations: string) => `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
  identifier="${identifier}" title="${identifier}" adaptive="false" time-dependent="false">
  ${declarations}
  <qti-item-body>${body}</qti-item-body>
</qti-assessment-item>`;

const firstInteraction = (xml: string): any => new Player({ itemXml: xml }).getInteractionData()[0];

describe('minimum-response requirements in extracted interaction data', () => {
	it('orderInteraction: minChoices and its authored message (QTI 3.0)', () => {
		const interaction = firstInteraction(
			qti3Item(
				'order-min',
				`<qti-order-interaction response-identifier="RESPONSE" min-choices="2"
          data-min-selections-message="Put at least two events in order.">
          <qti-simple-choice identifier="a">Spring</qti-simple-choice>
          <qti-simple-choice identifier="b">Summer</qti-simple-choice>
          <qti-simple-choice identifier="c">Autumn</qti-simple-choice>
        </qti-order-interaction>`,
				'<qti-response-declaration identifier="RESPONSE" cardinality="ordered" base-type="identifier"/>',
			),
		);
		expect(interaction.minChoices).toBe(2);
		expect(interaction.minSelectionsMessage).toBe('Put at least two events in order.');
	});

	it('orderInteraction: no message is authored, none is delivered', () => {
		const interaction = firstInteraction(
			qti2Item(
				'order-no-message',
				`<orderInteraction responseIdentifier="RESPONSE" minChoices="2">
          <simpleChoice identifier="a">One</simpleChoice>
          <simpleChoice identifier="b">Two</simpleChoice>
        </orderInteraction>`,
				'<responseDeclaration identifier="RESPONSE" cardinality="ordered" baseType="identifier"/>',
			),
		);
		expect(interaction.minChoices).toBe(2);
		expect(interaction).not.toHaveProperty('minSelectionsMessage');
	});

	it('associateInteraction: minAssociations is read; it defines no selections message', () => {
		const interaction = firstInteraction(
			qti2Item(
				'associate-min',
				`<associateInteraction responseIdentifier="RESPONSE" maxAssociations="3" minAssociations="2"
          data-min-selections-message="Make at least two pairs.">
          <simpleAssociableChoice identifier="a" matchMax="1">Cat</simpleAssociableChoice>
          <simpleAssociableChoice identifier="b" matchMax="1">Kitten</simpleAssociableChoice>
          <simpleAssociableChoice identifier="c" matchMax="1">Dog</simpleAssociableChoice>
          <simpleAssociableChoice identifier="d" matchMax="1">Puppy</simpleAssociableChoice>
        </associateInteraction>`,
				'<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="pair"/>',
			),
		);
		expect(interaction.minAssociations).toBe(2);
		// No QTI version defines a selections message on associateInteraction, so one is
		// never delivered — the component states the minimum with its localized hint.
		expect(interaction).not.toHaveProperty('minSelectionsMessage');
	});

	it('graphicOrderInteraction: minChoices and its authored message (QTI 2.2 and 3.0)', () => {
		const qti2 = firstInteraction(
			qti2Item(
				'graphic-order-min-2',
				`<graphicOrderInteraction responseIdentifier="RESPONSE" minChoices="2"
          data-min-selections-message="Order at least two stops.">
          <object data="map.png" type="image/png" width="400" height="300">Map</object>
          <hotspotChoice identifier="a" shape="circle" coords="50,50,20" hotspotLabel="Harbour"/>
          <hotspotChoice identifier="b" shape="circle" coords="150,50,20" hotspotLabel="Station"/>
          <hotspotChoice identifier="c" shape="circle" coords="250,50,20" hotspotLabel="Museum"/>
        </graphicOrderInteraction>`,
				'<responseDeclaration identifier="RESPONSE" cardinality="ordered" baseType="identifier"/>',
			),
		);
		expect(qti2.minChoices).toBe(2);
		// No QTI version defines a selections message on graphicOrderInteraction.
		expect(qti2).not.toHaveProperty('minSelectionsMessage');

		const qti3 = firstInteraction(
			qti3Item(
				'graphic-order-min-3',
				`<qti-graphic-order-interaction response-identifier="RESPONSE" min-choices="3">
          <img src="map.png" alt="Map" width="400" height="300"/>
          <qti-hotspot-choice identifier="a" shape="circle" coords="50,50,20"/>
          <qti-hotspot-choice identifier="b" shape="circle" coords="150,50,20"/>
          <qti-hotspot-choice identifier="c" shape="circle" coords="250,50,20"/>
        </qti-graphic-order-interaction>`,
				'<qti-response-declaration identifier="RESPONSE" cardinality="ordered" base-type="identifier"/>',
			),
		);
		expect(qti3.minChoices).toBe(3);
		expect(qti3).not.toHaveProperty('minSelectionsMessage');
	});

	it('graphicOrderInteraction: response validation enforces the same minimum the hint states', () => {
		const player = new Player({
			itemXml: qti2Item(
				'graphic-order-gate',
				`<graphicOrderInteraction responseIdentifier="RESPONSE" minChoices="2">
          <object data="map.png" type="image/png" width="400" height="300">Map</object>
          <hotspotChoice identifier="a" shape="circle" coords="50,50,20"/>
          <hotspotChoice identifier="b" shape="circle" coords="150,50,20"/>
          <hotspotChoice identifier="c" shape="circle" coords="250,50,20"/>
        </graphicOrderInteraction>`,
				'<responseDeclaration identifier="RESPONSE" cardinality="ordered" baseType="identifier"/>',
			),
		});
		const entry = (value: unknown) => player.validateResponses({ RESPONSE: value }).entries.RESPONSE!;

		expect(entry(null)).toMatchObject({ required: true, complete: false });
		expect(entry(['a'])).toMatchObject({ complete: false });
		expect(entry(['a', 'b'])).toMatchObject({ complete: true });
	});

	it('graphicOrderInteraction without a minimum delivers none', () => {
		const interaction = firstInteraction(
			qti2Item(
				'graphic-order-plain',
				`<graphicOrderInteraction responseIdentifier="RESPONSE">
          <object data="map.png" type="image/png" width="400" height="300">Map</object>
          <hotspotChoice identifier="a" shape="circle" coords="50,50,20"/>
          <hotspotChoice identifier="b" shape="circle" coords="150,50,20"/>
        </graphicOrderInteraction>`,
				'<responseDeclaration identifier="RESPONSE" cardinality="ordered" baseType="identifier"/>',
			),
		);
		expect(interaction).not.toHaveProperty('minChoices');
	});

	it('matchInteraction: the QTI 3.0 data-min-selections-message is read too', () => {
		const body = (attribute: string) =>
			`<qti-match-interaction response-identifier="RESPONSE" max-associations="2" min-associations="2" ${attribute}>
        <qti-simple-match-set>
          <qti-simple-associable-choice identifier="s1" match-max="1">H2O</qti-simple-associable-choice>
          <qti-simple-associable-choice identifier="s2" match-max="1">NaCl</qti-simple-associable-choice>
        </qti-simple-match-set>
        <qti-simple-match-set>
          <qti-simple-associable-choice identifier="t1" match-max="1">Water</qti-simple-associable-choice>
          <qti-simple-associable-choice identifier="t2" match-max="1">Salt</qti-simple-associable-choice>
        </qti-simple-match-set>
      </qti-match-interaction>`;
		const declaration = '<qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair"/>';

		const standard = firstInteraction(qti3Item('match-min', body('data-min-selections-message="Match both."'), declaration));
		expect(standard.minAssociations).toBe(2);
		expect(standard.minSelectionsMessage).toBe('Match both.');

		// The data-qti- spelling no QTI version defines is not read: only the spec name is.
		const both = firstInteraction(
			qti3Item(
				'match-min-both',
				body('data-qti-min-selections-message="Prefixed." data-min-selections-message="Standard."'),
				declaration,
			),
		);
		expect(both.minSelectionsMessage).toBe('Standard.');
	});

	it('gapMatchInteraction: each choice carries its matchMin', () => {
		const interaction = firstInteraction(
			qti2Item(
				'gap-match-min',
				`<gapMatchInteraction responseIdentifier="RESPONSE">
          <gapText identifier="producer" matchMax="1" matchMin="1">producer</gapText>
          <gapText identifier="consumer" matchMax="1">consumer</gapText>
          <p>A plant is a <gap identifier="g1"/>; a cow is a <gap identifier="g2"/>.</p>
        </gapMatchInteraction>`,
				'<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair"/>',
			),
		);
		const byId = Object.fromEntries(
			interaction.gapTexts.map((choice: any) => [choice.identifier, choice.matchMin]),
		);
		expect(byId).toEqual({ producer: 1, consumer: undefined });
	});
});
