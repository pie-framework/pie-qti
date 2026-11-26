import { createAssessmentItemDefinition, type SerializedItemSessionState } from '@pie-qti/item-player';
import type {
	AssessmentSessionState,
	FinalizeAssessmentResponse,
	SecureAssessment,
} from '../../src/integration/api-contract.js';

const QTI22 = 'http://www.imsglobal.org/xsd/imsqti_v2p2';

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

/** A full, scored assessment results dataset for the Results Reporting writers. */
export function resultsData(): {
	assessment: SecureAssessment;
	state: AssessmentSessionState;
	finalized: FinalizeAssessmentResponse;
} {
	const first = scoredSession(CHOICE_ITEM, 'A');
	const assessment: SecureAssessment = {
		identifier: 'TEST',
		title: 'Results test',
		outcomeDeclarations: [{ identifier: 'TOTAL', baseType: 'float', cardinality: 'single' }],
		testParts: [
			{
				identifier: 'P1',
				navigationMode: 'nonlinear',
				submissionMode: 'individual',
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
