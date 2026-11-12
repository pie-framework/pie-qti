import { describe, expect, test } from 'bun:test';
import { Qti2xElementNameMapper, Qti3ElementNameMapper } from '@pie-qti/qti-common';
import { findAssessmentItem, parseXml } from '@pie-qti/qti-processing';
import { createAssessmentItemDefinition } from '../../src/core/AssessmentItemDefinition.js';
import {
	findMatchGroupViolations,
	isMatchGroupCompatible,
	readMatchGroupConstraints,
} from '../../src/core/matchGroups.js';
import { Player } from '../../src/core/Player.js';

const QTI22 = 'http://www.imsglobal.org/xsd/imsqti_v2p2';

const choice = (identifier: string, ...matchGroup: string[]) => ({ identifier, matchGroup });

describe('isMatchGroupCompatible', () => {
	test('an empty matchGroup is unrestricted', () => {
		expect(isMatchGroupCompatible(choice('A'), choice('B', 'X'))).toBe(true);
	});

	test('reads matchGroup as the partner identifiers QTI defines', () => {
		expect(isMatchGroupCompatible(choice('A', 'C', 'D'), choice('C', 'A'))).toBe(true);
		expect(isMatchGroupCompatible(choice('A', 'C'), choice('C', 'X'))).toBe(false);
	});

	test('also accepts tokens shared as group labels', () => {
		expect(isMatchGroupCompatible(choice('A', 'set-a'), choice('B', 'set-a', 'set-b'))).toBe(true);
		expect(isMatchGroupCompatible(choice('A', 'set-a'), choice('B', 'set-b'))).toBe(false);
	});
});

describe('findMatchGroupViolations', () => {
	const sources = new Map([
		['W1', choice('W1', 'G1')],
		['W2', choice('W2')],
	]);
	const targets = new Map([
		['G1', choice('G1', 'W1')],
		['G2', choice('G2', 'W2')],
	]);

	test('lists the disallowed pairs of a directed response', () => {
		const constraints = { directed: true, sources, targets };
		expect(findMatchGroupViolations(['W1 G1', 'W1 G2', 'W2 G2'], constraints)).toEqual(['W1 G2']);
		expect(findMatchGroupViolations('W1 G2', constraints)).toEqual(['W1 G2']);
	});

	test('ignores NULL, malformed entries and unknown identifiers', () => {
		const constraints = { directed: true, sources, targets };
		expect(findMatchGroupViolations(null, constraints)).toEqual([]);
		expect(findMatchGroupViolations(['W1', '', 'X G2', 7], constraints)).toEqual([]);
	});
});

describe('readMatchGroupConstraints', () => {
	test('reads the source and target choices of each pairing interaction', () => {
		const item = findAssessmentItem(
			parseXml(`<assessmentItem xmlns="${QTI22}" identifier="i"><itemBody>
				<matchInteraction responseIdentifier="MATCH">
					<simpleMatchSet><simpleAssociableChoice identifier="S1" matchMax="1" matchGroup="T2">s</simpleAssociableChoice></simpleMatchSet>
					<simpleMatchSet><simpleAssociableChoice identifier="T1" matchMax="1">t</simpleAssociableChoice><simpleAssociableChoice identifier="T2" matchMax="1">t</simpleAssociableChoice></simpleMatchSet>
				</matchInteraction>
				<associateInteraction responseIdentifier="PLAIN">
					<simpleAssociableChoice identifier="A" matchMax="1">a</simpleAssociableChoice>
				</associateInteraction>
			</itemBody></assessmentItem>`),
		);
		const constraints = readMatchGroupConstraints(item, new Qti2xElementNameMapper());

		// An interaction that authors no matchGroup has nothing to check.
		expect([...constraints.keys()]).toEqual(['MATCH']);
		const match = constraints.get('MATCH');
		expect(match?.directed).toBe(true);
		expect([...(match?.sources.keys() ?? [])]).toEqual(['S1']);
		expect([...(match?.targets.keys() ?? [])]).toEqual(['T1', 'T2']);
	});

	test('reads QTI 3.0 kebab-case names and attributes', () => {
		const item = findAssessmentItem(
			parseXml(`<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="i"><qti-item-body>
				<qti-gap-match-interaction response-identifier="GAPS">
					<qti-gap-text identifier="W1" match-max="1" match-group="set-a">w</qti-gap-text>
					<p><qti-gap identifier="G1" match-group="set-b"/></p>
				</qti-gap-match-interaction>
			</qti-item-body></qti-assessment-item>`),
		);
		const gaps = readMatchGroupConstraints(item, new Qti3ElementNameMapper()).get('GAPS');
		expect(gaps?.sources.get('W1')?.matchGroup).toEqual(['set-a']);
		expect(gaps?.targets.get('G1')?.matchGroup).toEqual(['set-b']);
	});
});

function item(body: string, declarations: string): string {
	return `<assessmentItem xmlns="${QTI22}" identifier="mg">${declarations}<itemBody>${body}</itemBody></assessmentItem>`;
}

const ASSOCIATE = item(
	`<associateInteraction responseIdentifier="RESPONSE" maxAssociations="2">
		<simpleAssociableChoice identifier="cat" matchMax="2" matchGroup="animal">Cat</simpleAssociableChoice>
		<simpleAssociableChoice identifier="dog" matchMax="2" matchGroup="animal">Dog</simpleAssociableChoice>
		<simpleAssociableChoice identifier="oak" matchMax="2" matchGroup="plant">Oak</simpleAssociableChoice>
	</associateInteraction>`,
	'<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="pair"/>',
);

const GAP_MATCH = item(
	`<gapMatchInteraction responseIdentifier="RESPONSE" maxAssociations="2">
		<gapText identifier="W1" matchMax="1">one</gapText>
		<gapText identifier="W2" matchMax="1" matchGroup="G2">two</gapText>
		<p>First <gap identifier="G1" matchGroup="W1"/> then <gap identifier="G2"/>.</p>
	</gapMatchInteraction>`,
	'<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair"/>',
);

const GRAPHIC_GAP_MATCH = item(
	`<graphicGapMatchInteraction responseIdentifier="RESPONSE">
		<object type="image/png" data="map.png" width="100" height="100"/>
		<gapImg identifier="FLAG" matchMax="1" matchGroup="CITY"><object type="image/png" data="flag.png" width="10" height="10"/></gapImg>
		<associableHotspot identifier="CITY" shape="circle" coords="10,10,5" matchMax="1"/>
		<associableHotspot identifier="SEA" shape="circle" coords="50,50,5" matchMax="1" matchGroup="BOAT"/>
	</graphicGapMatchInteraction>`,
	'<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair"/>',
);

const GRAPHIC_ASSOCIATE = item(
	`<graphicAssociateInteraction responseIdentifier="RESPONSE" maxAssociations="2">
		<object type="image/png" data="map.png" width="100" height="100"/>
		<associableHotspot identifier="H1" shape="circle" coords="10,10,5" matchMax="2" matchGroup="H2"/>
		<associableHotspot identifier="H2" shape="circle" coords="50,50,5" matchMax="2" matchGroup="H1"/>
		<associableHotspot identifier="H3" shape="circle" coords="90,90,5" matchMax="2" matchGroup="H3-only"/>
	</graphicAssociateInteraction>`,
	'<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="pair"/>',
);

const MATCH = item(
	`<matchInteraction responseIdentifier="RESPONSE" maxAssociations="2">
		<simpleMatchSet>
			<simpleAssociableChoice identifier="S1" matchMax="1" matchGroup="T1">s1</simpleAssociableChoice>
			<simpleAssociableChoice identifier="S2" matchMax="1">s2</simpleAssociableChoice>
		</simpleMatchSet>
		<simpleMatchSet>
			<simpleAssociableChoice identifier="T1" matchMax="1">t1</simpleAssociableChoice>
			<simpleAssociableChoice identifier="T2" matchMax="1" matchGroup="S2">t2</simpleAssociableChoice>
		</simpleMatchSet>
	</matchInteraction>`,
	'<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair"/>',
);

function matchGroupIssues(itemXml: string, response: unknown) {
	const player = new Player({ itemXml });
	return player.validateResponses({ RESPONSE: response }).issues.filter((issue) => issue.code === 'match_group');
}

describe('response validation enforces matchGroup', () => {
	const cases: Array<{ name: string; itemXml: string; allowed: unknown; disallowed: unknown; pair: string }> = [
		{ name: 'associateInteraction', itemXml: ASSOCIATE, allowed: ['cat dog'], disallowed: ['cat dog', 'dog oak'], pair: 'dog with oak' },
		{ name: 'matchInteraction', itemXml: MATCH, allowed: ['S1 T1', 'S2 T2'], disallowed: ['S1 T2'], pair: 'S1 with T2' },
		{ name: 'gapMatchInteraction', itemXml: GAP_MATCH, allowed: ['W1 G1', 'W2 G2'], disallowed: ['W2 G1'], pair: 'W2 with G1' },
		{ name: 'graphicGapMatchInteraction', itemXml: GRAPHIC_GAP_MATCH, allowed: ['FLAG CITY'], disallowed: ['FLAG SEA'], pair: 'FLAG with SEA' },
		{ name: 'graphicAssociateInteraction', itemXml: GRAPHIC_ASSOCIATE, allowed: ['H1 H2'], disallowed: ['H2 H3'], pair: 'H2 with H3' },
	];

	for (const { name, itemXml, allowed, disallowed, pair } of cases) {
		test(`${name}: accepts allowed pairs and rejects ${pair}`, () => {
			expect(matchGroupIssues(itemXml, allowed)).toEqual([]);
			const issues = matchGroupIssues(itemXml, disallowed);
			expect(issues).toHaveLength(1);
			expect(issues[0]).toMatchObject({ responseId: 'RESPONSE', severity: 'error' });
			expect(issues[0]?.message).toContain(pair);
		});
	}

	test('a restored response that breaks matchGroup cannot be submitted', () => {
		const definition = createAssessmentItemDefinition({ itemXml: ASSOCIATE });
		const session = definition.openSession({ responses: { RESPONSE: ['cat oak'] } });
		expect(session.state().canSubmit).toBe(false);
		session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: ['cat dog'] });
		expect(session.state().canSubmit).toBe(true);
		session.dispose();
	});

	test('shape errors keep their own issue code', () => {
		const player = new Player({ itemXml: ASSOCIATE });
		const { issues } = player.validateResponses({ RESPONSE: 'cat oak' });
		expect(issues.map((issue) => issue.code)).toEqual(['invalid_shape', 'match_group']);
	});
});
