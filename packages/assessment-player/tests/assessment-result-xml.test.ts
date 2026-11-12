import { describe, expect, it } from 'bun:test';
import { createAssessmentItemDefinition, type SerializedItemSessionState } from '@pie-qti/item-player';
import { parseXml } from '@pie-qti/qti-processing';
import type {
	AssessmentSessionState,
	FinalizeAssessmentResponse,
	SecureAssessment,
} from '../src/integration/api-contract.js';
import {
	ASSESSMENT_RESULT_NAMESPACES,
	type AssessmentResultReport,
	AssessmentResultSerializationError,
	buildAssessmentResultReport,
	serializeAssessmentResult,
	toAssessmentResultXml,
} from '../src/reporting/index.js';
import { inferBaseType } from '../src/reporting/inferBaseType.js';

const QTI22 = 'http://www.imsglobal.org/xsd/imsqti_v2p2';

/** Parses the document (throwing if it is not well-formed) and checks its root. */
function parseResult(xml: string, version: '2.2' | '3.0'): Element {
	const root = parseXml(xml).documentElement as Element;
	expect(root.localName).toBe('assessmentResult');
	expect(root.namespaceURI).toBe(ASSESSMENT_RESULT_NAMESPACES[version].namespace);
	return root;
}

function children(element: Element, name?: string): Element[] {
	const out: Element[] = [];
	for (let child = element.firstChild; child; child = child.nextSibling) {
		if (child.nodeType === 1 && (!name || (child as Element).localName === name)) out.push(child as Element);
	}
	return out;
}

function variable(container: Element, identifier: string): Element {
	const found = children(container).find((child) => child.getAttribute('identifier') === identifier);
	if (!found) throw new Error(`no variable ${identifier}`);
	return found;
}

function values(element: Element): string[] {
	const holder = element.localName === 'responseVariable' ? children(element, 'candidateResponse')[0] : element;
	return holder ? children(holder, 'value').map((value) => value.textContent ?? '') : [];
}

const REPORT: AssessmentResultReport = {
	context: {
		sourcedId: 'candidate-42',
		sessionIdentifiers: [{ sourceID: 'https://delivery.example.org/', identifier: 'session-7' }],
	},
	testResult: {
		identifier: 'TEST',
		datestamp: '2026-03-01T10:00:00Z',
		variables: [
			{ kind: 'response', identifier: 'duration', cardinality: 'single', baseType: 'duration', value: 119.5 },
			{ kind: 'outcome', identifier: 'SCORE', cardinality: 'single', baseType: 'float', value: 2, masteryValue: 1 },
		],
	},
	itemResults: [
		{
			identifier: 'Q01',
			sequenceIndex: 1,
			datestamp: Date.UTC(2026, 2, 1, 9, 59, 0),
			sessionStatus: 'final',
			variables: [
				{ kind: 'response', identifier: 'numAttempts', cardinality: 'single', baseType: 'integer', value: 1 },
				{ kind: 'response', identifier: 'duration', cardinality: 'single', baseType: 'duration', value: 'PT25.25S' },
				{
					kind: 'response',
					identifier: 'RESPONSE',
					cardinality: 'multiple',
					baseType: 'identifier',
					value: ['choice_A', 'choice_C'],
					correctResponse: ['choice_A'],
				},
				{ kind: 'response', identifier: 'ORDER', cardinality: 'ordered', baseType: 'identifier', value: ['B', 'A'] },
				{ kind: 'response', identifier: 'EMPTY', cardinality: 'single', baseType: 'string', value: null },
				{
					kind: 'response',
					identifier: 'NUMERIC',
					cardinality: 'record',
					value: { stringValue: { baseType: 'string', value: '3.50' }, floatValue: 3.5 },
				},
				{ kind: 'outcome', identifier: 'completionStatus', cardinality: 'single', baseType: 'identifier', value: 'completed' },
				{ kind: 'outcome', identifier: 'SCORE', cardinality: 'single', baseType: 'float', value: 0.5, normalMaximum: 1 },
				{ kind: 'template', identifier: 'SEED', cardinality: 'single', baseType: 'integer', value: 7 },
				{ kind: 'context', identifier: 'QTI_CONTEXT', cardinality: 'record', value: null },
			],
			candidateComment: 'Line one\nline <two> & "three"',
		},
	],
};

describe('serializeAssessmentResult', () => {
	it('writes a well-formed QTI 3.0 assessmentResult', () => {
		const root = parseResult(serializeAssessmentResult(REPORT, { version: '3.0' }), '3.0');
		expect(root.getAttribute('xsi:schemaLocation')).toContain('imsqti_resultv3p0_v1p0.xsd');
		expect(children(root).map((child) => child.localName)).toEqual(['context', 'testResult', 'itemResult']);

		const [context] = children(root, 'context') as [Element];
		expect(context.getAttribute('sourcedId')).toBe('candidate-42');
		expect(children(context, 'sessionIdentifier')[0]?.getAttribute('identifier')).toBe('session-7');

		const [test] = children(root, 'testResult') as [Element];
		expect(test.getAttribute('datestamp')).toBe('2026-03-01T10:00:00.000Z');
		expect(values(variable(test, 'duration'))).toEqual(['119.5']);
		expect(variable(test, 'SCORE').getAttribute('masteryValue')).toBe('1');

		const [item] = children(root, 'itemResult') as [Element];
		expect(item.getAttribute('identifier')).toBe('Q01');
		expect(item.getAttribute('sequenceIndex')).toBe('1');
		expect(item.getAttribute('sessionStatus')).toBe('final');
		expect(item.getAttribute('datestamp')).toBe('2026-03-01T09:59:00.000Z');
	});

	it('writes each cardinality and base type in its QTI form', () => {
		const [item] = children(parseResult(serializeAssessmentResult(REPORT, { version: '3.0' }), '3.0'), 'itemResult') as [Element];

		const numAttempts = variable(item, 'numAttempts');
		expect(numAttempts.localName).toBe('responseVariable');
		expect(numAttempts.getAttribute('baseType')).toBe('integer');
		expect(values(numAttempts)).toEqual(['1']);
		// Durations are seconds, whatever lexical form they arrive in.
		expect(values(variable(item, 'duration'))).toEqual(['25.25']);

		const response = variable(item, 'RESPONSE');
		expect(response.getAttribute('cardinality')).toBe('multiple');
		expect(values(response)).toEqual(['choice_A', 'choice_C']);
		expect(children(children(response, 'correctResponse')[0] as Element, 'value').map((v) => v.textContent)).toEqual(['choice_A']);
		// correctResponse precedes candidateResponse, as the schema orders them.
		expect(children(response).map((child) => child.localName)).toEqual(['correctResponse', 'candidateResponse']);

		expect(values(variable(item, 'ORDER'))).toEqual(['B', 'A']);
		expect(children(variable(item, 'EMPTY'), 'candidateResponse')).toHaveLength(1);
		expect(values(variable(item, 'EMPTY'))).toEqual([]);

		const record = variable(item, 'NUMERIC');
		expect(record.hasAttribute('baseType')).toBe(false);
		const fields = children(children(record, 'candidateResponse')[0] as Element, 'value');
		expect(fields.map((field) => [field.getAttribute('fieldIdentifier'), field.getAttribute('baseType'), field.textContent])).toEqual([
			['stringValue', 'string', '3.50'],
			['floatValue', 'float', '3.5'],
		]);

		const score = variable(item, 'SCORE');
		expect(score.localName).toBe('outcomeVariable');
		expect(values(score)).toEqual(['0.5']);
		expect(score.getAttribute('normalMaximum')).toBe('1');
		expect(variable(item, 'SEED').localName).toBe('templateVariable');
		expect(variable(item, 'QTI_CONTEXT').localName).toBe('contextVariable');
	});

	it('escapes markup in values and attributes', () => {
		const xml = serializeAssessmentResult(
			{
				context: { sessionIdentifiers: [{ sourceID: 'https://x.example/?a=1&b="2"', identifier: 's' }] },
				itemResults: [
					{
						identifier: 'Q',
						datestamp: 0,
						sessionStatus: 'pendingSubmission',
						variables: [
							{
								kind: 'response',
								identifier: 'TEXT',
								cardinality: 'single',
								baseType: 'string',
								value: '</value><injected/> & \u0001 done\r\nnext',
							},
						],
						candidateComment: 'a\r\nb <c>',
					},
				],
			},
			{ version: '2.2' },
		);
		const [item] = children(parseResult(xml, '2.2'), 'itemResult') as [Element];
		expect(values(variable(item, 'TEXT'))).toEqual(['</value><injected/> & \uFFFD done\r\nnext']);
		expect(children(item, 'candidateComment')[0]?.textContent).toBe('a\r\nb <c>');
		expect(xml).not.toContain('<injected/>');
		const [context] = children(parseResult(xml, '2.2'), 'context') as [Element];
		expect(children(context, 'sessionIdentifier')[0]?.getAttribute('sourceID')).toBe('https://x.example/?a=1&b="2"');
	});

	it('writes the QTI 2.2 namespace and leaves out what QTI 2.2 lacks', () => {
		const xml = serializeAssessmentResult(REPORT, { version: '2.2', schemaLocation: false });
		const root = parseResult(xml, '2.2');
		expect(root.hasAttribute('xsi:schemaLocation')).toBe(false);
		const [item] = children(root, 'itemResult') as [Element];
		expect(children(item, 'contextVariable')).toEqual([]);
		expect(children(item).at(-1)?.localName).toBe('candidateComment');
	});

	it('infers undeclared record fields as integer or float, the one shared rule', () => {
		const xml = serializeAssessmentResult(
			{
				context: {},
				itemResults: [
					{
						identifier: 'Q',
						datestamp: 0,
						sessionStatus: 'final',
						variables: [
							{ kind: 'response', identifier: 'NUMERIC', cardinality: 'record', value: { whole: 3, fraction: 3.5 } },
						],
					},
				],
			},
			{ version: '3.0' },
		);
		const [item] = children(parseResult(xml, '3.0'), 'itemResult') as [Element];
		const fields = children(children(variable(item, 'NUMERIC'), 'candidateResponse')[0] as Element, 'value');
		expect(
			fields.map((field) => [field.getAttribute('fieldIdentifier'), field.getAttribute('baseType'), field.textContent]),
		).toEqual([
			['whole', 'integer', '3'],
			['fraction', 'float', '3.5'],
		]);
	});

	it('rejects what the target schema cannot carry', () => {
		const withStatus = (sessionStatus: 'pendingExternalScoring') => ({
			...REPORT,
			itemResults: [{ ...REPORT.itemResults[0]!, sessionStatus }],
		});
		expect(() => serializeAssessmentResult(withStatus('pendingExternalScoring'), { version: '2.2' })).toThrow(
			AssessmentResultSerializationError,
		);
		expect(() => serializeAssessmentResult(withStatus('pendingExternalScoring'), { version: '3.0' })).not.toThrow();

		const badSourcedId = { ...REPORT, context: { sourcedId: 'john smith@example.org' } };
		expect(() => serializeAssessmentResult(badSourcedId, { version: '3.0' })).toThrow(/not an NCName/);

		const badDate = { ...REPORT, testResult: { ...REPORT.testResult!, datestamp: 'yesterday' } };
		expect(() => serializeAssessmentResult(badDate, { version: '3.0' })).toThrow(/valid date-time/);

		// Item identifiers are NCNames in QTI 3.0 results, normalized strings in QTI 2.2.
		const spacedItem = { ...REPORT, itemResults: [{ ...REPORT.itemResults[0]!, identifier: 'item one' }] };
		expect(() => serializeAssessmentResult(spacedItem, { version: '3.0' })).toThrow(/NCName/);
		expect(() => serializeAssessmentResult(spacedItem, { version: '2.2' })).not.toThrow();
	});
});

// ---------------------------------------------------------------------------------------------
// From assessment results data
// ---------------------------------------------------------------------------------------------

const CHOICE_ITEM = `<assessmentItem xmlns="${QTI22}" identifier="choice" adaptive="false" timeDependent="false">
	<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
		<correctResponse><value>A</value></correctResponse>
	</responseDeclaration>
	<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float" normalMaximum="1">
		<defaultValue><value>0</value></defaultValue>
	</outcomeDeclaration>
	<itemBody>
		<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
			<simpleChoice identifier="A">A</simpleChoice>
			<simpleChoice identifier="B">B</simpleChoice>
		</choiceInteraction>
	</itemBody>
	<responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
</assessmentItem>`;

const TEXT_ITEM = `<assessmentItem xmlns="${QTI22}" identifier="text" adaptive="false" timeDependent="false">
	<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string"/>
	<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
	<itemBody><textEntryInteraction responseIdentifier="RESPONSE"/></itemBody>
</assessmentItem>`;

function scoredSession(itemXml: string, response: string): {
	session: SerializedItemSessionState;
	outcomes: Record<string, unknown>;
} {
	const session = createAssessmentItemDefinition({ itemXml, role: 'scorer' }).openSession();
	session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: response });
	const result = session.dispatch({ action: 'endAttempt' }).result;
	session.dispose();
	if (!result?.scoring) throw new Error('no scoring');
	return { session: result.sessionState, outcomes: result.scoring.outcomeValues };
}

function resultsData() {
	const first = scoredSession(CHOICE_ITEM, 'A');
	const assessment: SecureAssessment = {
		identifier: 'TEST',
		title: 'Results test',
		navigationMode: 'nonlinear',
		submissionMode: 'individual',
		outcomeDeclarations: [{ identifier: 'TOTAL', baseType: 'float', cardinality: 'single' }],
		testParts: [
			{
				identifier: 'P1',
				sections: [
					{
						identifier: 'S1',
						visible: true,
						assessmentItemRefs: [
							{ identifier: 'Q1', itemXml: CHOICE_ITEM, role: 'candidate' },
							{ identifier: 'Q2', itemXml: TEXT_ITEM, role: 'candidate' },
							{ identifier: 'Q3', itemXml: TEXT_ITEM, role: 'candidate' },
						],
					},
				],
			},
		],
	};
	const state: AssessmentSessionState = {
		currentItemIdentifier: 'Q2',
		visitedItems: ['Q1', 'Q2'],
		itemResponses: { Q1: { RESPONSE: 'A' }, Q2: { RESPONSE: 'draft <answer>' } },
		itemSessions: { Q1: { ...first.session, savedAt: '2026-03-01T09:00:00.000Z', duration: 12_345 } },
		itemSessionStates: {
			Q1: { itemIdentifier: 'Q1', attemptCount: 1, isAnswered: true, isSubmitted: true, lastSubmissionTime: Date.UTC(2026, 2, 1, 9, 0, 1) },
		},
		itemComments: { Q1: 'Easy' },
		timing: {
			startedAt: Date.UTC(2026, 2, 1, 8, 58),
			itemTimes: { Q1: 12_345, Q2: 4_000 },
			sectionTimes: { S1: 16_345 },
			testPartTimes: { P1: 16_345 },
			totalTime: 16_500,
		},
	};
	const finalized: FinalizeAssessmentResponse = {
		success: true,
		totalScore: 1,
		maxScore: 2,
		itemScores: {
			Q1: { itemIdentifier: 'choice', score: 1, maxScore: 1, completed: true, outcomeValues: first.outcomes, correctResponse: { RESPONSE: 'A' } },
		},
		outcomes: { TOTAL: 1 },
		finalizedAt: Date.UTC(2026, 2, 1, 9, 5),
	};
	return { assessment, state, finalized };
}

describe('toAssessmentResultXml', () => {
	it('reports the test with its outcomes and its durations in seconds', () => {
		const root = parseResult(toAssessmentResultXml(resultsData(), { version: '3.0', candidateSourcedId: 'cand1' }), '3.0');
		expect(children(root, 'context')[0]?.getAttribute('sourcedId')).toBe('cand1');

		const [test] = children(root, 'testResult') as [Element];
		expect(test.getAttribute('identifier')).toBe('TEST');
		expect(test.getAttribute('datestamp')).toBe('2026-03-01T09:05:00.000Z');
		expect(values(variable(test, 'duration'))).toEqual(['16.5']);
		expect(values(variable(test, 'P1.duration'))).toEqual(['16.345']);
		expect(values(variable(test, 'S1.duration'))).toEqual(['16.345']);
		expect(variable(test, 'S1.duration').getAttribute('baseType')).toBe('duration');
		const total = variable(test, 'TOTAL');
		expect([total.localName, total.getAttribute('baseType'), values(total)[0]]).toEqual(['outcomeVariable', 'float', '1']);
	});

	it('reports each recorded item in delivery order, with its status and variables', () => {
		const root = parseResult(toAssessmentResultXml(resultsData(), { version: '2.2' }), '2.2');
		const items = children(root, 'itemResult');
		// Q3 was never presented and has no recorded data.
		expect(items.map((item) => [item.getAttribute('identifier'), item.getAttribute('sequenceIndex'), item.getAttribute('sessionStatus')])).toEqual([
			['Q1', '1', 'final'],
			['Q2', '2', 'pendingSubmission'],
		]);

		const [scored, draft] = items as [Element, Element];
		expect(scored.getAttribute('datestamp')).toBe('2026-03-01T09:00:01.000Z');
		expect(values(variable(scored, 'numAttempts'))).toEqual(['1']);
		expect(values(variable(scored, 'duration'))).toEqual(['12.345']);
		expect(variable(scored, 'duration').localName).toBe('responseVariable');
		const response = variable(scored, 'RESPONSE');
		expect([response.getAttribute('cardinality'), response.getAttribute('baseType'), values(response)]).toEqual([
			'single',
			'identifier',
			['A'],
		]);
		expect(children(response, 'correctResponse')).toEqual([]);
		const score = variable(scored, 'SCORE');
		expect([score.localName, values(score), score.getAttribute('normalMaximum')]).toEqual(['outcomeVariable', ['1'], '1']);
		expect(values(variable(scored, 'completionStatus'))).toEqual(['completed']);
		expect(children(scored, 'candidateComment')[0]?.textContent).toBe('Easy');
		// numAttempts and duration are response variables only, not repeated as outcomes.
		expect(children(scored, 'outcomeVariable').map((v) => v.getAttribute('identifier'))).not.toContain('duration');

		// Without a session snapshot, the item's declarations type its variables.
		const draftResponse = variable(draft, 'RESPONSE');
		expect([draftResponse.getAttribute('baseType'), values(draftResponse)]).toEqual(['string', ['draft <answer>']]);
		expect(values(variable(draft, 'duration'))).toEqual(['4']);
	});

	it('infers undeclared outcome base types as integer or float, the one shared rule', () => {
		const data = { ...resultsData(), outcomes: { WHOLE: 3, FRACTION: 3.5, LIST: [3, 4], MIXED: [3, 3.5] } };
		const root = parseResult(toAssessmentResultXml(data, { version: '3.0', candidateSourcedId: 'cand1' }), '3.0');
		const [test] = children(root, 'testResult') as [Element];
		expect([variable(test, 'WHOLE').getAttribute('baseType'), values(variable(test, 'WHOLE'))]).toEqual(['integer', ['3']]);
		expect([variable(test, 'FRACTION').getAttribute('baseType'), values(variable(test, 'FRACTION'))]).toEqual(['float', ['3.5']]);
		// A list is integer only when every member is whole; one fraction makes it float, for every member.
		expect([variable(test, 'LIST').getAttribute('baseType'), values(variable(test, 'LIST'))]).toEqual(['integer', ['3', '4']]);
		expect([variable(test, 'MIXED').getAttribute('baseType'), values(variable(test, 'MIXED'))]).toEqual(['float', ['3', '3.5']]);
	});

	it('includes correct responses on request', () => {
		const report = buildAssessmentResultReport(resultsData(), { includeCorrectResponses: true });
		const response = report.itemResults[0]?.variables.find((v) => v.identifier === 'RESPONSE');
		expect(response).toMatchObject({ kind: 'response', correctResponse: 'A' });
	});

	it('marks an item edited after its scored submission as pending submission', () => {
		const data = resultsData();
		const Q1 = data.state.itemSessions?.Q1 as SerializedItemSessionState;
		data.state.itemSessions = { Q1: { ...Q1, lifecycleStatus: 'interacting', savedAt: '2026-03-01T09:03:00.000Z' } };
		const report = buildAssessmentResultReport(data);
		expect(report.itemResults[0]).toMatchObject({ identifier: 'Q1', sessionStatus: 'pendingSubmission' });
	});
});

describe('inferBaseType (the undeclared-value rule both writers share)', () => {
	it('types a boolean a boolean, a whole number an integer, a fraction a float, anything else a string', () => {
		expect(inferBaseType(true)).toBe('boolean');
		expect(inferBaseType(3)).toBe('integer');
		expect(inferBaseType(3.5)).toBe('float');
		expect(inferBaseType('3')).toBe('string');
		expect(inferBaseType(null)).toBe('string');
	});

	it('types a list by all of its members', () => {
		expect(inferBaseType([3, 4])).toBe('integer');
		expect(inferBaseType([3, 3.5])).toBe('float');
		expect(inferBaseType([true, false])).toBe('boolean');
		expect(inferBaseType(['a', 3])).toBe('string');
		expect(inferBaseType([])).toBe('string');
	});
});
