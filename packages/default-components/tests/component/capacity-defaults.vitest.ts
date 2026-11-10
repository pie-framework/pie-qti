/**
 * Freezes the capacity values the item-player extractors deliver to these components —
 * maxChoices, maxAssociations and matchMax — absent, explicitly 0, and explicitly set. The
 * components read them as given (0 means no restriction) and impose no defaults of their own,
 * so the spec defaults live in one place, the extractors; this pins them so a dedup of the
 * components' capacity rules cannot normalize them on either side.
 */
import { createAssessmentItemDefinition } from '@pie-qti/item-player';
import { describe, expect, test } from 'vitest';

const QTI21 = 'http://www.imsglobal.org/xsd/imsqti_v2p1';
const QTI22 = 'http://www.imsglobal.org/xsd/imsqti_v2p2';
const QTI30 = 'http://www.imsglobal.org/xsd/imsqtiasi_v3p0';

/** The delivered data of the item's one interaction. */
function delivered(itemXml: string): Record<string, any> {
	const session = createAssessmentItemDefinition({ itemXml }).openSession();
	try {
		const node = session.present().flow.find((entry) => entry.kind === 'interaction');
		if (!node || node.kind !== 'interaction') throw new Error('no interaction delivered');
		return node.mount.interaction as Record<string, any>;
	} finally {
		session.dispose();
	}
}

function qti2(namespace: string, declaration: string, body: string): string {
	return `<assessmentItem xmlns="${namespace}" identifier="caps" adaptive="false" timeDependent="false">
		<responseDeclaration identifier="RESPONSE" ${declaration}/>
		<itemBody>${body}</itemBody>
	</assessmentItem>`;
}

function qti3(declaration: string, body: string): string {
	return `<qti-assessment-item xmlns="${QTI30}" identifier="caps" adaptive="false" time-dependent="false">
		<qti-response-declaration identifier="RESPONSE" ${declaration}/>
		<qti-item-body>${body}</qti-item-body>
	</qti-assessment-item>`;
}

const IMAGE = '<object type="image/png" data="i.png" width="400" height="100"/>';
const hotspots = (tag: string, attrs = '') =>
	['H1', 'H2'].map((id, i) => `<${tag} identifier="${id}" shape="rect" coords="${i * 100},0,${i * 100 + 90},90"${attrs}/>`).join('');

/** Each interaction's capacity values: [label, item XML for `attrs` on the interaction and `choiceAttrs` on its choices, reader]. */
const cases: Array<{
	name: string;
	xml: (attrs: string, choiceAttrs: string) => string;
	read: (data: Record<string, any>) => Record<string, unknown>;
	absent: Record<string, unknown>;
	zero: Record<string, unknown>;
	three: Record<string, unknown>;
}> = [
	{
		name: 'choice (QTI 2.2, multiple)',
		xml: (a) => qti2(QTI22, 'cardinality="multiple" baseType="identifier"', `<choiceInteraction responseIdentifier="RESPONSE"${a}><simpleChoice identifier="A">a</simpleChoice><simpleChoice identifier="B">b</simpleChoice><simpleChoice identifier="C">c</simpleChoice></choiceInteraction>`),
		read: (d) => ({ maxChoices: d.maxChoices }),
		absent: { maxChoices: 1 },
		zero: { maxChoices: 0 },
		three: { maxChoices: 3 },
	},
	{
		name: 'choice (QTI 2.1, multiple)',
		xml: (a) => qti2(QTI21, 'cardinality="multiple" baseType="identifier"', `<choiceInteraction responseIdentifier="RESPONSE"${a}><simpleChoice identifier="A">a</simpleChoice><simpleChoice identifier="B">b</simpleChoice><simpleChoice identifier="C">c</simpleChoice></choiceInteraction>`),
		read: (d) => ({ maxChoices: d.maxChoices }),
		absent: { maxChoices: 0 },
		zero: { maxChoices: 0 },
		three: { maxChoices: 3 },
	},
	{
		name: 'choice (QTI 2.1, single)',
		xml: (a) => qti2(QTI21, 'cardinality="single" baseType="identifier"', `<choiceInteraction responseIdentifier="RESPONSE"${a}><simpleChoice identifier="A">a</simpleChoice><simpleChoice identifier="B">b</simpleChoice><simpleChoice identifier="C">c</simpleChoice></choiceInteraction>`),
		read: (d) => ({ maxChoices: d.maxChoices }),
		absent: { maxChoices: 1 },
		zero: { maxChoices: 0 },
		three: { maxChoices: 3 },
	},
	{
		name: 'choice (QTI 3.0, multiple)',
		xml: (a) => qti3('cardinality="multiple" base-type="identifier"', `<qti-choice-interaction response-identifier="RESPONSE"${a.replace('maxChoices', 'max-choices')}><qti-simple-choice identifier="A">a</qti-simple-choice><qti-simple-choice identifier="B">b</qti-simple-choice><qti-simple-choice identifier="C">c</qti-simple-choice></qti-choice-interaction>`),
		read: (d) => ({ maxChoices: d.maxChoices }),
		absent: { maxChoices: 1 },
		zero: { maxChoices: 0 },
		three: { maxChoices: 3 },
	},
	{
		name: 'hottext',
		xml: (a) => qti2(QTI22, 'cardinality="multiple" baseType="identifier"', `<hottextInteraction responseIdentifier="RESPONSE"${a}><p><hottext identifier="A">a</hottext> <hottext identifier="B">b</hottext> <hottext identifier="C">c</hottext></p></hottextInteraction>`),
		read: (d) => ({ maxChoices: d.maxChoices }),
		absent: { maxChoices: 1 },
		zero: { maxChoices: 0 },
		three: { maxChoices: 3 },
	},
	{
		name: 'hotspot',
		xml: (a) => qti2(QTI22, 'cardinality="multiple" baseType="identifier"', `<hotspotInteraction responseIdentifier="RESPONSE"${a}>${IMAGE}${hotspots('hotspotChoice')}<hotspotChoice identifier="H3" shape="rect" coords="200,0,290,90"/></hotspotInteraction>`),
		read: (d) => ({ maxChoices: d.maxChoices }),
		absent: { maxChoices: 1 },
		zero: { maxChoices: 0 },
		three: { maxChoices: 3 },
	},
	{
		name: 'position object',
		xml: (a) => qti2(QTI22, 'cardinality="multiple" baseType="point"', `<positionObjectStage>${IMAGE}<positionObjectInteraction responseIdentifier="RESPONSE"${a}><object type="image/png" data="o.png" width="20" height="20"/></positionObjectInteraction></positionObjectStage>`),
		read: (d) => ({ maxChoices: d.maxChoices, stageMatchMax: d.positionObjectStages?.[0]?.matchMax }),
		absent: { maxChoices: 1, stageMatchMax: 1 },
		zero: { maxChoices: 0, stageMatchMax: 0 },
		three: { maxChoices: 3, stageMatchMax: 3 },
	},
	{
		name: 'select point (QTI 2.2, multiple)',
		xml: (a) => qti2(QTI22, 'cardinality="multiple" baseType="point"', `<selectPointInteraction responseIdentifier="RESPONSE"${a}>${IMAGE}</selectPointInteraction>`),
		read: (d) => ({ maxChoices: d.maxChoices }),
		absent: { maxChoices: 0 },
		zero: { maxChoices: 0 },
		three: { maxChoices: 3 },
	},
	{
		name: 'select point (QTI 2.2, single)',
		xml: (a) => qti2(QTI22, 'cardinality="single" baseType="point"', `<selectPointInteraction responseIdentifier="RESPONSE"${a}>${IMAGE}</selectPointInteraction>`),
		read: (d) => ({ maxChoices: d.maxChoices }),
		absent: { maxChoices: 1 },
		zero: { maxChoices: 0 },
		three: { maxChoices: 3 },
	},
	{
		name: 'associate',
		xml: (a, c) => qti2(QTI22, 'cardinality="multiple" baseType="pair"', `<associateInteraction responseIdentifier="RESPONSE"${a.replace('maxChoices', 'maxAssociations')}>${['A', 'B', 'C'].map((id) => `<simpleAssociableChoice identifier="${id}"${c}>${id}</simpleAssociableChoice>`).join('')}</associateInteraction>`),
		read: (d) => ({ maxAssociations: d.maxAssociations, matchMax: d.choices?.map((c: any) => c.matchMax) }),
		absent: { maxAssociations: 1, matchMax: [1, 1, 1] },
		zero: { maxAssociations: 0, matchMax: [0, 0, 0] },
		three: { maxAssociations: 3, matchMax: [3, 3, 3] },
	},
	{
		name: 'match',
		xml: (a, c) => qti2(QTI22, 'cardinality="multiple" baseType="directedPair"', `<matchInteraction responseIdentifier="RESPONSE"${a.replace('maxChoices', 'maxAssociations')}><simpleMatchSet><simpleAssociableChoice identifier="S1"${c}>s</simpleAssociableChoice></simpleMatchSet><simpleMatchSet><simpleAssociableChoice identifier="T1"${c}>t</simpleAssociableChoice></simpleMatchSet></matchInteraction>`),
		read: (d) => ({ maxAssociations: d.maxAssociations, matchMax: [d.sourceSet?.[0]?.matchMax, d.targetSet?.[0]?.matchMax] }),
		absent: { maxAssociations: 1, matchMax: [1, 1] },
		zero: { maxAssociations: 0, matchMax: [0, 0] },
		three: { maxAssociations: 3, matchMax: [3, 3] },
	},
	{
		name: 'gap match (QTI 2.2)',
		xml: (a, c) => qti2(QTI22, 'cardinality="multiple" baseType="directedPair"', `<gapMatchInteraction responseIdentifier="RESPONSE"${a.replace('maxChoices', 'maxAssociations')}><gapText identifier="W"${c}>w</gapText><gapImg identifier="I"${c}><object type="image/png" data="w.png" width="10" height="10"/></gapImg><p>a <gap identifier="G1"/> b <gap identifier="G2"/></p></gapMatchInteraction>`),
		read: (d) => ({ maxAssociations: d.maxAssociations, matchMax: [d.gapTexts?.[0]?.matchMax, d.gapImages?.[0]?.matchMax] }),
		absent: { maxAssociations: 1, matchMax: [1, 1] },
		zero: { maxAssociations: 0, matchMax: [0, 0] },
		three: { maxAssociations: 3, matchMax: [3, 3] },
	},
	{
		name: 'gap match (QTI 2.1)',
		xml: (a, c) => qti2(QTI21, 'cardinality="multiple" baseType="directedPair"', `<gapMatchInteraction responseIdentifier="RESPONSE"${a.replace('maxChoices', 'maxAssociations')}><gapText identifier="W"${c}>w</gapText><p>a <gap identifier="G1"/> b <gap identifier="G2"/></p></gapMatchInteraction>`),
		read: (d) => ({ maxAssociations: d.maxAssociations, matchMax: [d.gapTexts?.[0]?.matchMax] }),
		absent: { maxAssociations: 0, matchMax: [1] },
		zero: { maxAssociations: 0, matchMax: [0] },
		three: { maxAssociations: 3, matchMax: [3] },
	},
	{
		name: 'graphic associate',
		xml: (a, c) => qti2(QTI22, 'cardinality="multiple" baseType="pair"', `<graphicAssociateInteraction responseIdentifier="RESPONSE"${a.replace('maxChoices', 'maxAssociations')}>${IMAGE}${hotspots('associableHotspot', c)}</graphicAssociateInteraction>`),
		read: (d) => ({ maxAssociations: d.maxAssociations, matchMax: d.associableHotspots?.map((h: any) => h.matchMax) }),
		absent: { maxAssociations: 1, matchMax: [1, 1] },
		zero: { maxAssociations: 0, matchMax: [0, 0] },
		three: { maxAssociations: 3, matchMax: [3, 3] },
	},
	{
		name: 'graphic gap match (QTI 2.2)',
		xml: (a, c) => qti2(QTI22, 'cardinality="multiple" baseType="directedPair"', `<graphicGapMatchInteraction responseIdentifier="RESPONSE"${a.replace('maxChoices', 'maxAssociations')}>${IMAGE}<gapText identifier="W"${c}>w</gapText><gapImg identifier="I"${c}><object type="image/png" data="w.png" width="10" height="10"/></gapImg>${hotspots('associableHotspot', c)}</graphicGapMatchInteraction>`),
		read: (d) => ({
			maxAssociations: d.maxAssociations,
			matchMax: [d.gapTexts?.[0]?.matchMax, d.gapImages?.[0]?.matchMax, ...(d.hotspots ?? []).map((h: any) => h.matchMax)],
		}),
		absent: { maxAssociations: 1, matchMax: [1, 1, 1, 1] },
		zero: { maxAssociations: 0, matchMax: [0, 0, 0, 0] },
		three: { maxAssociations: 3, matchMax: [3, 3, 3, 3] },
	},
	{
		name: 'graphic gap match (QTI 2.1)',
		xml: (a, c) => qti2(QTI21, 'cardinality="multiple" baseType="directedPair"', `<graphicGapMatchInteraction responseIdentifier="RESPONSE"${a.replace('maxChoices', 'maxAssociations')}>${IMAGE}<gapText identifier="W"${c}>w</gapText>${hotspots('associableHotspot', c)}</graphicGapMatchInteraction>`),
		read: (d) => ({ maxAssociations: d.maxAssociations }),
		absent: { maxAssociations: 0 },
		zero: { maxAssociations: 0 },
		three: { maxAssociations: 3 },
	},
];

describe('extractor capacity defaults, as the components receive them', () => {
	for (const entry of cases) {
		test(`${entry.name}: absent, 0 and 3`, () => {
			expect(entry.read(delivered(entry.xml('', ''))), 'absent').toEqual(entry.absent);
			expect(entry.read(delivered(entry.xml(' maxChoices="0"', ' matchMax="0"'))), 'explicit 0').toEqual(entry.zero);
			expect(entry.read(delivered(entry.xml(' maxChoices="3"', ' matchMax="3"'))), 'explicit 3').toEqual(entry.three);
		});
	}

	test('an authored limit message is delivered as written, and absent when not authored', () => {
		const choice = (attrs: string) =>
			delivered(
				qti2(QTI22, 'cardinality="multiple" baseType="identifier"', `<choiceInteraction responseIdentifier="RESPONSE" maxChoices="2"${attrs}><simpleChoice identifier="A">a</simpleChoice><simpleChoice identifier="B">b</simpleChoice><simpleChoice identifier="C">c</simpleChoice></choiceInteraction>`),
			);
		expect(choice(' data-max-selections-message=" Two at most. "').maxSelectionsMessage).toBe(' Two at most. ');
		expect(choice('').maxSelectionsMessage).toBeUndefined();
	});
});
