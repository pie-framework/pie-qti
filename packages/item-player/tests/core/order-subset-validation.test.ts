/**
 * orderInteraction / graphicOrderInteraction subset ordering (QTI 2.2 ASI §5.73, §5.42;
 * §2.4.1.2): `minChoices` requests a subset ("the candidate must select a subset of the
 * choices and impose an ordering on them"), `maxChoices` caps it, and with neither the
 * candidate orders all of the choices. The engine enforces both directions: an over-long
 * restored/programmatic response is invalid, and the minimum gate stays consistent with
 * the spec — unspecified means all N, so nothing is complete until all N are ordered.
 */

import { describe, expect, test } from 'bun:test';
import { Player } from '../../src/core/Player.js';
import type {
	GraphicOrderInteractionData,
	OrderInteractionData,
} from '../../src/interactions/shared/types.js';

const qti22Item = (identifier: string, body: string, declarations: string) => `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="${identifier}" title="${identifier}" adaptive="false" timeDependent="false">
  ${declarations}
  <itemBody>${body}</itemBody>
</assessmentItem>`;

const orderItem = (attributes: string, choiceCount = 5) => {
	const choices = Array.from({ length: choiceCount }, (_, i) => {
		const id = String.fromCharCode(97 + i);
		return `<simpleChoice identifier="${id}">${id.toUpperCase()}</simpleChoice>`;
	}).join('\n');
	return qti22Item(
		'order-subset',
		`<orderInteraction responseIdentifier="RESPONSE" ${attributes}>
      ${choices}
    </orderInteraction>`,
		'<responseDeclaration identifier="RESPONSE" cardinality="ordered" baseType="identifier"/>',
	);
};

const graphicOrderItem = (attributes: string, choiceCount = 5) => {
	const hotspots = Array.from({ length: choiceCount }, (_, i) => {
		const id = String.fromCharCode(97 + i);
		return `<hotspotChoice identifier="${id}" shape="circle" coords="${50 * (i + 1)},50,20" hotspotLabel="${id.toUpperCase()}"/>`;
	}).join('\n');
	return qti22Item(
		'graphic-order-subset',
		`<graphicOrderInteraction responseIdentifier="RESPONSE" ${attributes}>
      <object data="map.png" type="image/png" width="400" height="200">Map</object>
      ${hotspots}
    </graphicOrderInteraction>`,
		'<responseDeclaration identifier="RESPONSE" cardinality="ordered" baseType="identifier"/>',
	);
};

describe('orderInteraction subset response validation (Player.validateResponses)', () => {
	test('subset item: maxChoices=2 with minChoices=2 rejects a 3-item response', () => {
		const player = new Player({ itemXml: orderItem('minChoices="2" maxChoices="2"') });
		const result = player.validateResponses({ RESPONSE: ['a', 'b', 'c'] });
		expect(result.valid).toBe(false);
		expect(result.entries.RESPONSE?.valid).toBe(false);
		expect(result.entries.RESPONSE?.errors.join(' ')).toContain('maxChoices=2');
	});

	test('subset item: maxChoices=3 accepts responses at and under the cap', () => {
		const player = new Player({ itemXml: orderItem('minChoices="2" maxChoices="3"') });
		expect(player.validateResponses({ RESPONSE: ['a', 'b', 'c'] }).valid).toBe(true);
		expect(player.validateResponses({ RESPONSE: ['d', 'a'] }).valid).toBe(true);
		expect(player.validateResponses({ RESPONSE: null }).valid).toBe(true);
	});

	test('subset item: an over-long response is still complete-reporting invalid, not merely incomplete', () => {
		// A restored response with too many items must not be waved through as "answered".
		const player = new Player({ itemXml: orderItem('minChoices="1" maxChoices="2"') });
		const entry = player.validateResponses({ RESPONSE: ['a', 'b', 'c'] }).entries.RESPONSE!;
		expect(entry.complete).toBe(true);
		expect(entry.valid).toBe(false);
	});

	test('subset cap clamps to the choice count: maxChoices beyond N orders all N', () => {
		const player = new Player({ itemXml: orderItem('minChoices="2" maxChoices="99"') });
		expect(player.validateResponses({ RESPONSE: ['a', 'b', 'c', 'd', 'e'] }).valid).toBe(true);
	});

	test('full mode (no minChoices): a started order must hold all five, and maxChoices is ignored', () => {
		const player = new Player({ itemXml: orderItem('maxChoices="2"') });
		// maxChoices is ignored without minChoices: all N must be ordered. An untouched order is
		// still a skip (not required), which allowSkipping governs, as before.
		expect(player.validateResponses({ RESPONSE: ['a', 'b'] }).entries.RESPONSE).toMatchObject({
			required: false,
			complete: false,
			valid: true,
		});
		expect(player.validateResponses({ RESPONSE: ['a', 'b', 'c', 'd', 'e'] }).entries.RESPONSE).toMatchObject({
			complete: true,
			valid: true,
		});
	});

	test('full mode keeps the current skip and no-maximum behaviour', () => {
		const player = new Player({ itemXml: orderItem('') });
		expect(player.validateResponses({ RESPONSE: null }).entries.RESPONSE).toMatchObject({
			required: false,
			complete: true,
			valid: true,
		});
		expect(player.validateResponses({ RESPONSE: [] }).entries.RESPONSE).toMatchObject({ complete: true });
		expect(player.validateResponses({ RESPONSE: ['a', 'b'] }).valid).toBe(true);
		// Progress and submit gating are unchanged for an unconstrained order.
		expect(player.getProgress({ RESPONSE: null })).toEqual({ total: 0, answered: 0, unanswered: 0 });
		expect(player.canSubmitResponses({ RESPONSE: null })).toBe(true);
	});

	test('an incomplete full-mode order fails endAttempt validation, a complete one passes', () => {
		const player = new Player({ itemXml: orderItem('') });
		player.setResponses({ RESPONSE: ['a', 'b'] });
		const refused = player.endAttempt({ validateResponses: true });
		expect(refused.validation?.valid).toBe(false);
		expect(refused.validation?.issues.map((issue) => issue.code)).toContain('incomplete');

		player.setResponses({ RESPONSE: ['e', 'd', 'c', 'b', 'a'] });
		expect(player.endAttempt({ validateResponses: true }).validation?.valid).toBe(true);
	});

	test('minChoices >= N is effectively full: all N ordered', () => {
		const player = new Player({ itemXml: orderItem('minChoices="5" maxChoices="5"') });
		expect(player.validateResponses({ RESPONSE: ['a', 'b', 'c', 'd'] }).entries.RESPONSE).toMatchObject({
			complete: false,
		});
		expect(player.validateResponses({ RESPONSE: ['a', 'b', 'c', 'd', 'e'] }).entries.RESPONSE).toMatchObject({
			complete: true,
			valid: true,
		});
	});

	test('subset minimum: at least minChoices must be ordered (validates the same minimum the hint states)', () => {
		const player = new Player({ itemXml: orderItem('minChoices="2" maxChoices="3"') });
		expect(player.validateResponses({ RESPONSE: ['a'] }).entries.RESPONSE).toMatchObject({
			complete: false,
		});
		expect(player.validateResponses({ RESPONSE: ['a', 'b'] }).entries.RESPONSE).toMatchObject({
			complete: true,
		});
	});
});

describe('graphicOrderInteraction subset response validation (Player.validateResponses)', () => {
	test('subset item: maxChoices=2 rejects a 3-item response', () => {
		const player = new Player({ itemXml: graphicOrderItem('minChoices="1" maxChoices="2"') });
		const result = player.validateResponses({ RESPONSE: ['a', 'b', 'c'] });
		expect(result.valid).toBe(false);
		expect(result.entries.RESPONSE?.errors.join(' ')).toContain('maxChoices=2');
	});

	test('subset item: within-cap responses are valid', () => {
		const player = new Player({ itemXml: graphicOrderItem('minChoices="2" maxChoices="3"') });
		expect(player.validateResponses({ RESPONSE: ['a', 'b', 'c'] }).valid).toBe(true);
		expect(player.validateResponses({ RESPONSE: ['e', 'a'] }).valid).toBe(true);
		expect(player.validateResponses({ RESPONSE: null }).valid).toBe(true);
	});

	test('full mode (no minChoices): a started order must hold all five', () => {
		const player = new Player({ itemXml: graphicOrderItem('maxChoices="2"') });
		expect(player.validateResponses({ RESPONSE: ['a', 'b'] }).entries.RESPONSE).toMatchObject({
			required: false,
			complete: false,
			valid: true,
		});
		expect(player.validateResponses({ RESPONSE: ['a', 'b', 'c', 'd', 'e'] }).entries.RESPONSE).toMatchObject({
			complete: true,
			valid: true,
		});
	});

	test('subset minimum: below minChoices is incomplete', () => {
		const player = new Player({ itemXml: graphicOrderItem('minChoices="2" maxChoices="3"') });
		expect(player.validateResponses({ RESPONSE: ['a'] }).entries.RESPONSE).toMatchObject({ complete: false });
		expect(player.validateResponses({ RESPONSE: ['a', 'b'] }).entries.RESPONSE).toMatchObject({ complete: true });
	});
});

describe('extracted interaction data carries the subset fields', () => {
	test('orderInteraction data reaches the component with minChoices and maxChoices', () => {
		const interaction = new Player({ itemXml: orderItem('minChoices="2" maxChoices="3"') }).getInteractionData()[0] as OrderInteractionData;
		expect(interaction.minChoices).toBe(2);
		expect(interaction.maxChoices).toBe(3);
	});

	test('QTI 3.0 min-choices / max-choices reach both interactions', () => {
		const qti3Item = (body: string) => `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
  identifier="subset-3" title="subset-3" adaptive="false" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="ordered" base-type="identifier"/>
  <qti-item-body>${body}</qti-item-body>
</qti-assessment-item>`;
		const order = new Player({
			itemXml: qti3Item(`<qti-order-interaction response-identifier="RESPONSE" min-choices="2" max-choices="3">
        <qti-simple-choice identifier="a">A</qti-simple-choice>
        <qti-simple-choice identifier="b">B</qti-simple-choice>
        <qti-simple-choice identifier="c">C</qti-simple-choice>
        <qti-simple-choice identifier="d">D</qti-simple-choice>
      </qti-order-interaction>`),
		});
		expect(order.getInteractionData()[0]).toMatchObject({ minChoices: 2, maxChoices: 3 });
		expect(order.validateResponses({ RESPONSE: ['a', 'b', 'c', 'd'] }).valid).toBe(false);

		const graphic = new Player({
			itemXml: qti3Item(`<qti-graphic-order-interaction response-identifier="RESPONSE" min-choices="1" max-choices="2">
        <img src="map.png" alt="Map" width="400" height="300"/>
        <qti-hotspot-choice identifier="a" shape="circle" coords="50,50,20"/>
        <qti-hotspot-choice identifier="b" shape="circle" coords="150,50,20"/>
        <qti-hotspot-choice identifier="c" shape="circle" coords="250,50,20"/>
      </qti-graphic-order-interaction>`),
		});
		expect(graphic.getInteractionData()[0]).toMatchObject({ minChoices: 1, maxChoices: 2 });
		expect(graphic.validateResponses({ RESPONSE: ['a', 'b', 'c'] }).valid).toBe(false);
		expect(graphic.validateResponses({ RESPONSE: ['c'] }).valid).toBe(true);
	});

	test('graphicOrderInteraction data carries maxChoices too', () => {
		const interaction = new Player({ itemXml: graphicOrderItem('minChoices="2" maxChoices="3"') }).getInteractionData()[0] as GraphicOrderInteractionData;
		expect(interaction.minChoices).toBe(2);
		expect(interaction.maxChoices).toBe(3);
	});

	test('unspecified minChoices leaves subset mode off in the data', () => {
		const interaction = new Player({ itemXml: orderItem('maxChoices="2"') }).getInteractionData()[0] as OrderInteractionData;
		expect(interaction.minChoices).toBe(0);
		expect(interaction.maxChoices).toBe(2);
	});
});
