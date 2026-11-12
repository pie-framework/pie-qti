import { describe, expect, test } from 'bun:test';
import { createAssessmentItemDefinition } from '../../src/core/AssessmentItemDefinition.js';
import { Player } from '../../src/core/Player.js';
import type { AdaptiveAttemptResult } from '../../src/types/index.js';

function submitAdaptiveAttempt(player: Player, countAttempt: boolean = true): AdaptiveAttemptResult {
	const result = player.runItemSessionAction({ action: 'submitAttempt', countAttempt }).scoring;
	if (!result) throw new Error('Adaptive submission did not produce a scoring result');
	return result as AdaptiveAttemptResult;
}

describe('Adaptive Items', () => {
	test('should detect adaptive="true" attribute', () => {
		const xml = `
			<assessmentItem identifier="adaptive-item" title="Adaptive Test" adaptive="true" timeDependent="false">
				<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
					<correctResponse><value>C</value></correctResponse>
				</responseDeclaration>
				<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
					<defaultValue><value>0</value></defaultValue>
				</outcomeDeclaration>
				<itemBody>
					<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
						<prompt>What is the capital of Australia?</prompt>
						<simpleChoice identifier="A">Sydney</simpleChoice>
						<simpleChoice identifier="B">Melbourne</simpleChoice>
						<simpleChoice identifier="C">Canberra</simpleChoice>
					</choiceInteraction>
				</itemBody>
				<responseProcessing>
					<responseCondition>
						<responseIf>
							<match>
								<variable identifier="RESPONSE"/>
								<correct identifier="RESPONSE"/>
							</match>
							<setOutcomeValue identifier="SCORE">
								<baseValue baseType="float">1</baseValue>
							</setOutcomeValue>
						</responseIf>
					</responseCondition>
				</responseProcessing>
			</assessmentItem>
		`;

		const player = new Player({ itemXml: xml });
		expect(player.isAdaptive()).toBe(true);
	});

	test('should detect non-adaptive items (adaptive="false")', () => {
		const xml = `
			<assessmentItem identifier="non-adaptive-item" title="Non-Adaptive Test" adaptive="false" timeDependent="false">
				<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
					<correctResponse><value>C</value></correctResponse>
				</responseDeclaration>
				<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
					<defaultValue><value>0</value></defaultValue>
				</outcomeDeclaration>
				<itemBody>
					<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
						<prompt>What is 2 + 2?</prompt>
						<simpleChoice identifier="A">3</simpleChoice>
						<simpleChoice identifier="B">4</simpleChoice>
					</choiceInteraction>
				</itemBody>
				<responseProcessing>
					<responseCondition>
						<responseIf>
							<match>
								<variable identifier="RESPONSE"/>
								<correct identifier="RESPONSE"/>
							</match>
							<setOutcomeValue identifier="SCORE">
								<baseValue baseType="float">1</baseValue>
							</setOutcomeValue>
						</responseIf>
					</responseCondition>
				</responseProcessing>
			</assessmentItem>
		`;

		const player = new Player({ itemXml: xml });
		expect(player.isAdaptive()).toBe(false);
	});

	test('should increment numAttempts on each submission', () => {
		const xml = `
			<assessmentItem identifier="adaptive-item" title="Adaptive Test" adaptive="true" timeDependent="false">
				<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
					<correctResponse><value>C</value></correctResponse>
				</responseDeclaration>
				<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
					<defaultValue><value>0</value></defaultValue>
				</outcomeDeclaration>
				<outcomeDeclaration identifier="FEEDBACK" cardinality="single" baseType="identifier">
					<defaultValue><value></value></defaultValue>
				</outcomeDeclaration>
				<itemBody>
					<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
						<prompt>What is the capital of Australia?</prompt>
						<simpleChoice identifier="A">Sydney</simpleChoice>
						<simpleChoice identifier="B">Melbourne</simpleChoice>
						<simpleChoice identifier="C">Canberra</simpleChoice>
					</choiceInteraction>
				</itemBody>
				<responseProcessing>
					<responseCondition>
						<responseIf>
							<match>
								<variable identifier="RESPONSE"/>
								<correct identifier="RESPONSE"/>
							</match>
							<setOutcomeValue identifier="SCORE">
								<baseValue baseType="float">1</baseValue>
							</setOutcomeValue>
							<setOutcomeValue identifier="completionStatus">
								<baseValue baseType="identifier">completed</baseValue>
							</setOutcomeValue>
						</responseIf>
						<responseElse>
							<setOutcomeValue identifier="SCORE">
								<baseValue baseType="float">0</baseValue>
							</setOutcomeValue>
							<setOutcomeValue identifier="FEEDBACK">
								<baseValue baseType="identifier">tryagain</baseValue>
							</setOutcomeValue>
						</responseElse>
					</responseCondition>
				</responseProcessing>
			</assessmentItem>
		`;

		const player = new Player({ itemXml: xml });

		// Initial state
		expect(player.getNumAttempts()).toBe(0);

		// First attempt (incorrect)
		player.setResponses({ RESPONSE: 'A' });
		const attempt1 = submitAdaptiveAttempt(player);
		expect(attempt1.numAttempts).toBe(1);
		expect(attempt1.completionStatus).toBe('unknown');
		expect(attempt1.canContinue).toBe(true);

		// Second attempt (incorrect)
		player.setResponses({ RESPONSE: 'B' });
		const attempt2 = submitAdaptiveAttempt(player);
		expect(attempt2.numAttempts).toBe(2);
		expect(attempt2.canContinue).toBe(true);
	});

	test('should not increment when countAttempt=false', () => {
		const xml = `
			<assessmentItem identifier="adaptive-item" title="Adaptive Test" adaptive="true" timeDependent="false">
				<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
					<correctResponse><value>C</value></correctResponse>
				</responseDeclaration>
				<responseDeclaration identifier="HINT" cardinality="single" baseType="boolean"/>
				<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
					<defaultValue><value>0</value></defaultValue>
				</outcomeDeclaration>
				<outcomeDeclaration identifier="FEEDBACK" cardinality="single" baseType="identifier">
					<defaultValue><value></value></defaultValue>
				</outcomeDeclaration>
				<itemBody>
					<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
						<prompt>What is the capital of Australia?</prompt>
						<simpleChoice identifier="A">Sydney</simpleChoice>
						<simpleChoice identifier="B">Melbourne</simpleChoice>
						<simpleChoice identifier="C">Canberra</simpleChoice>
					</choiceInteraction>
					<endAttemptInteraction responseIdentifier="HINT" title="Request Hint" countAttempt="false"/>
				</itemBody>
				<responseProcessing>
					<responseCondition>
						<responseIf>
							<variable identifier="HINT"/>
							<setOutcomeValue identifier="FEEDBACK">
								<baseValue baseType="identifier">hint</baseValue>
							</setOutcomeValue>
						</responseIf>
						<responseElseIf>
							<match>
								<variable identifier="RESPONSE"/>
								<correct identifier="RESPONSE"/>
							</match>
							<setOutcomeValue identifier="SCORE">
								<baseValue baseType="float">1</baseValue>
							</setOutcomeValue>
							<setOutcomeValue identifier="completionStatus">
								<baseValue baseType="identifier">completed</baseValue>
							</setOutcomeValue>
						</responseElseIf>
					</responseCondition>
				</responseProcessing>
			</assessmentItem>
		`;

		const player = new Player({ itemXml: xml });

		// Click hint button (countAttempt=false)
		player.setResponses({ HINT: true });
		const hintResult = submitAdaptiveAttempt(player, false);
		expect(hintResult.numAttempts).toBe(0); // Not incremented
		expect(hintResult.canContinue).toBe(true);
	});

	test('should prevent submission after completion', () => {
		const xml = `
			<assessmentItem identifier="adaptive-item" title="Adaptive Test" adaptive="true" timeDependent="false">
				<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
					<correctResponse><value>C</value></correctResponse>
				</responseDeclaration>
				<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
					<defaultValue><value>0</value></defaultValue>
				</outcomeDeclaration>
				<itemBody>
					<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
						<prompt>What is the capital of Australia?</prompt>
						<simpleChoice identifier="A">Sydney</simpleChoice>
						<simpleChoice identifier="B">Melbourne</simpleChoice>
						<simpleChoice identifier="C">Canberra</simpleChoice>
					</choiceInteraction>
				</itemBody>
				<responseProcessing>
					<responseCondition>
						<responseIf>
							<match>
								<variable identifier="RESPONSE"/>
								<correct identifier="RESPONSE"/>
							</match>
							<setOutcomeValue identifier="SCORE">
								<baseValue baseType="float">1</baseValue>
							</setOutcomeValue>
							<setOutcomeValue identifier="completionStatus">
								<baseValue baseType="identifier">completed</baseValue>
							</setOutcomeValue>
						</responseIf>
					</responseCondition>
				</responseProcessing>
			</assessmentItem>
		`;

		const player = new Player({ itemXml: xml });

		// Submit correct answer
		player.setResponses({ RESPONSE: 'C' });
		const attempt1 = submitAdaptiveAttempt(player);
		expect(attempt1.completed).toBe(true);
		expect(attempt1.canContinue).toBe(false);
		expect(attempt1.completionStatus).toBe('completed');
		expect(player.isCompleted()).toBe(true);

		// Try to submit again
		expect(() => submitAdaptiveAttempt(player)).toThrow('Cannot submit: item is already completed');
	});

	test('should show progressive feedback based on attempts', () => {
		const xml = `
			<assessmentItem identifier="adaptive-item" title="Adaptive Test" adaptive="true" timeDependent="false">
				<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
					<correctResponse><value>C</value></correctResponse>
				</responseDeclaration>
				<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
					<defaultValue><value>0</value></defaultValue>
				</outcomeDeclaration>
				<outcomeDeclaration identifier="FEEDBACK" cardinality="single" baseType="identifier">
					<defaultValue><value></value></defaultValue>
				</outcomeDeclaration>
				<itemBody>
					<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
						<prompt>What is the capital of Australia?</prompt>
						<simpleChoice identifier="A">Sydney</simpleChoice>
						<simpleChoice identifier="B">Melbourne</simpleChoice>
						<simpleChoice identifier="C">Canberra</simpleChoice>
					</choiceInteraction>
				</itemBody>
				<responseProcessing>
					<responseCondition>
						<responseIf>
							<match>
								<variable identifier="RESPONSE"/>
								<correct identifier="RESPONSE"/>
							</match>
							<setOutcomeValue identifier="SCORE">
								<baseValue baseType="float">1</baseValue>
							</setOutcomeValue>
							<setOutcomeValue identifier="FEEDBACK">
								<baseValue baseType="identifier">correct</baseValue>
							</setOutcomeValue>
							<setOutcomeValue identifier="completionStatus">
								<baseValue baseType="identifier">completed</baseValue>
							</setOutcomeValue>
						</responseIf>
						<responseElse>
							<responseCondition>
								<responseIf>
									<lt>
										<variable identifier="numAttempts"/>
										<baseValue baseType="integer">2</baseValue>
									</lt>
									<setOutcomeValue identifier="FEEDBACK">
										<baseValue baseType="identifier">tryagain</baseValue>
									</setOutcomeValue>
								</responseIf>
								<responseElse>
									<setOutcomeValue identifier="FEEDBACK">
										<baseValue baseType="identifier">answer</baseValue>
									</setOutcomeValue>
									<setOutcomeValue identifier="completionStatus">
										<baseValue baseType="identifier">completed</baseValue>
									</setOutcomeValue>
								</responseElse>
							</responseCondition>
						</responseElse>
					</responseCondition>
				</responseProcessing>
				<modalFeedback outcomeIdentifier="FEEDBACK" identifier="tryagain" showHide="show" title="Try Again">
					<p>That's not correct. You have one more attempt.</p>
				</modalFeedback>
				<modalFeedback outcomeIdentifier="FEEDBACK" identifier="answer" showHide="show" title="Correct Answer">
					<p>The answer is Canberra.</p>
				</modalFeedback>
				<modalFeedback outcomeIdentifier="FEEDBACK" identifier="correct" showHide="show" title="Correct!">
					<p>Well done! Canberra is indeed the capital of Australia.</p>
				</modalFeedback>
			</assessmentItem>
		`;

		const player = new Player({ itemXml: xml });

		// First incorrect attempt
		player.setResponses({ RESPONSE: 'A' });
		const attempt1 = submitAdaptiveAttempt(player);
		expect(attempt1.numAttempts).toBe(1);
		expect(attempt1.modalFeedback?.[0]?.identifier).toBe('tryagain');
		expect(attempt1.canContinue).toBe(true);

		// Second incorrect attempt
		player.setResponses({ RESPONSE: 'B' });
		const attempt2 = submitAdaptiveAttempt(player);
		expect(attempt2.numAttempts).toBe(2);
		expect(attempt2.modalFeedback?.[0]?.identifier).toBe('answer');
		expect(attempt2.completed).toBe(true);
		expect(attempt2.canContinue).toBe(false);
	});

	test('should handle correct answer on first attempt', () => {
		const xml = `
			<assessmentItem identifier="adaptive-item" title="Adaptive Test" adaptive="true" timeDependent="false">
				<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
					<correctResponse><value>C</value></correctResponse>
				</responseDeclaration>
				<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
					<defaultValue><value>0</value></defaultValue>
				</outcomeDeclaration>
				<outcomeDeclaration identifier="FEEDBACK" cardinality="single" baseType="identifier">
					<defaultValue><value></value></defaultValue>
				</outcomeDeclaration>
				<itemBody>
					<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
						<prompt>What is the capital of Australia?</prompt>
						<simpleChoice identifier="A">Sydney</simpleChoice>
						<simpleChoice identifier="B">Melbourne</simpleChoice>
						<simpleChoice identifier="C">Canberra</simpleChoice>
					</choiceInteraction>
				</itemBody>
				<responseProcessing>
					<responseCondition>
						<responseIf>
							<match>
								<variable identifier="RESPONSE"/>
								<correct identifier="RESPONSE"/>
							</match>
							<setOutcomeValue identifier="SCORE">
								<baseValue baseType="float">1</baseValue>
							</setOutcomeValue>
							<setOutcomeValue identifier="FEEDBACK">
								<baseValue baseType="identifier">correct</baseValue>
							</setOutcomeValue>
							<setOutcomeValue identifier="completionStatus">
								<baseValue baseType="identifier">completed</baseValue>
							</setOutcomeValue>
						</responseIf>
					</responseCondition>
				</responseProcessing>
				<modalFeedback outcomeIdentifier="FEEDBACK" identifier="correct" showHide="show" title="Correct!">
					<p>Well done! Canberra is indeed the capital of Australia.</p>
				</modalFeedback>
			</assessmentItem>
		`;

		const player = new Player({ itemXml: xml });

		// Correct answer on first attempt
		player.setResponses({ RESPONSE: 'C' });
		const attempt1 = submitAdaptiveAttempt(player);
		expect(attempt1.numAttempts).toBe(1);
		expect(attempt1.score).toBe(1);
		expect(attempt1.modalFeedback?.[0]?.identifier).toBe('correct');
		expect(attempt1.completed).toBe(true);
		expect(attempt1.canContinue).toBe(false);
	});

	test('should update completionStatus from not_attempted to unknown', () => {
		const xml = `
			<assessmentItem identifier="adaptive-item" title="Adaptive Test" adaptive="true" timeDependent="false">
				<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
					<correctResponse><value>C</value></correctResponse>
				</responseDeclaration>
				<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
					<defaultValue><value>0</value></defaultValue>
				</outcomeDeclaration>
				<itemBody>
					<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
						<prompt>What is the capital of Australia?</prompt>
						<simpleChoice identifier="A">Sydney</simpleChoice>
						<simpleChoice identifier="B">Melbourne</simpleChoice>
						<simpleChoice identifier="C">Canberra</simpleChoice>
					</choiceInteraction>
				</itemBody>
				<responseProcessing>
					<responseCondition>
						<responseIf>
							<match>
								<variable identifier="RESPONSE"/>
								<correct identifier="RESPONSE"/>
							</match>
							<setOutcomeValue identifier="SCORE">
								<baseValue baseType="float">1</baseValue>
							</setOutcomeValue>
						</responseIf>
					</responseCondition>
				</responseProcessing>
			</assessmentItem>
		`;

		const player = new Player({ itemXml: xml });

		// Initial state should be not_attempted
		expect(player.isCompleted()).toBe(false);

		// First submission (doesn't set completionStatus to 'completed')
		player.setResponses({ RESPONSE: 'A' });
		const attempt1 = submitAdaptiveAttempt(player);
		expect(attempt1.completionStatus).toBe('unknown'); // Changed from not_attempted
		expect(attempt1.completed).toBe(false);
		expect(attempt1.canContinue).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// QTI ASI §5.2/§8: adaptive items retain outcome values across attempts
// ---------------------------------------------------------------------------

/**
 * A typical adaptive item: full credit when correct on the first counted
 * attempt, partial credit when correct later. TRIES accumulates once per
 * response-processing run and gates the credit.
 */
const ADAPTIVE_PARTIAL_CREDIT_ITEM = `
	<assessmentItem identifier="adaptive-partial" title="Adaptive partial credit" adaptive="true" timeDependent="false">
		<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
			<correctResponse><value>C</value></correctResponse>
		</responseDeclaration>
		<outcomeDeclaration identifier="TRIES" cardinality="single" baseType="integer">
			<defaultValue><value>0</value></defaultValue>
		</outcomeDeclaration>
		<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
			<defaultValue><value>0</value></defaultValue>
		</outcomeDeclaration>
		<itemBody>
			<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
				<prompt>Pick the answer.</prompt>
				<simpleChoice identifier="A">Wrong</simpleChoice>
				<simpleChoice identifier="C">Right</simpleChoice>
			</choiceInteraction>
		</itemBody>
		<responseProcessing>
			<setOutcomeValue identifier="TRIES">
				<sum>
					<variable identifier="TRIES"/>
					<baseValue baseType="integer">1</baseValue>
				</sum>
			</setOutcomeValue>
			<responseCondition>
				<responseIf>
					<match>
						<variable identifier="RESPONSE"/>
						<correct identifier="RESPONSE"/>
					</match>
					<responseCondition>
						<responseIf>
							<gte>
								<variable identifier="TRIES"/>
								<baseValue baseType="integer">2</baseValue>
							</gte>
							<setOutcomeValue identifier="SCORE">
								<baseValue baseType="float">0.5</baseValue>
							</setOutcomeValue>
							<setOutcomeValue identifier="completionStatus">
								<baseValue baseType="identifier">completed</baseValue>
							</setOutcomeValue>
						</responseIf>
						<responseElse>
							<setOutcomeValue identifier="SCORE">
								<baseValue baseType="float">1</baseValue>
							</setOutcomeValue>
							<setOutcomeValue identifier="completionStatus">
								<baseValue baseType="identifier">completed</baseValue>
							</setOutcomeValue>
						</responseElse>
					</responseCondition>
				</responseIf>
			</responseCondition>
		</responseProcessing>
	</assessmentItem>
`;

function outcomeOf(result: AdaptiveAttemptResult, id: string): unknown {
	return result.outcomeValues[id];
}

describe('Adaptive outcome retention (QTI ASI §5.2)', () => {
	test('outcome values accumulate across attempts instead of resetting to defaults', () => {
		const player = new Player({ itemXml: ADAPTIVE_PARTIAL_CREDIT_ITEM });

		player.setResponses({ RESPONSE: 'A' });
		const attempt1 = submitAdaptiveAttempt(player);
		expect(attempt1.numAttempts).toBe(1);
		expect(outcomeOf(attempt1, 'TRIES')).toBe(1);

		player.setResponses({ RESPONSE: 'A' });
		const attempt2 = submitAdaptiveAttempt(player);
		expect(attempt2.numAttempts).toBe(2);
		// §5.2: "For Adaptive Items the outcome variables retain the values that
		// were assigned to them during the previous invocation of response
		// processing", so TRIES must read 2 after the second run.
		expect(outcomeOf(attempt2, 'TRIES')).toBe(2);
	});

	test('wrong-then-right scores the second-attempt partial credit, not first-attempt full credit', () => {
		const player = new Player({ itemXml: ADAPTIVE_PARTIAL_CREDIT_ITEM });

		player.setResponses({ RESPONSE: 'A' });
		const attempt1 = submitAdaptiveAttempt(player);
		expect(attempt1.score).toBe(0);
		expect(attempt1.completed).toBe(false);

		player.setResponses({ RESPONSE: 'C' });
		const attempt2 = submitAdaptiveAttempt(player);
		// Correct on the second invocation: the retained TRIES=1 (plus this
		// run's increment to 2) must gate the partial credit. A reset would
		// make TRIES read 1 and award full credit.
		expect(attempt2.score).toBe(0.5);
		expect(attempt2.completed).toBe(true);
		expect(attempt2.canContinue).toBe(false);
	});

	test('correct on the first attempt scores full credit', () => {
		const player = new Player({ itemXml: ADAPTIVE_PARTIAL_CREDIT_ITEM });

		player.setResponses({ RESPONSE: 'C' });
		const attempt1 = submitAdaptiveAttempt(player);
		expect(attempt1.score).toBe(1);
		expect(outcomeOf(attempt1, 'TRIES')).toBe(1);
		expect(attempt1.completed).toBe(true);
	});

	test('restore mid-adaptive continues outcomes from the snapshot, not from defaults', () => {
		const first = new Player({ itemXml: ADAPTIVE_PARTIAL_CREDIT_ITEM });

		first.setResponses({ RESPONSE: 'A' });
		const attempt1 = submitAdaptiveAttempt(first);
		expect(outcomeOf(attempt1, 'TRIES')).toBe(1);

		const snapshot = first.saveItemSession();
		const resumed = new Player({ itemXml: ADAPTIVE_PARTIAL_CREDIT_ITEM });
		resumed.restoreItemSession(snapshot);

		resumed.setResponses({ RESPONSE: 'C' });
		const attempt2 = submitAdaptiveAttempt(resumed);
		expect(attempt2.numAttempts).toBe(2);
		// Attempt 2 continues from attempt 1's outcomes: TRIES reaches 2 and the
		// partial credit applies. Restoring defaults would score full credit.
		expect(outcomeOf(attempt2, 'TRIES')).toBe(2);
		expect(attempt2.score).toBe(0.5);
		expect(attempt2.completed).toBe(true);
	});

	/**
	 * The contract a host scorer relies on, through the public ItemSession API:
	 * a serialized adaptive session carries its outcomes as last assigned, a
	 * restore reinstates them exactly (no reset, no response-processing rerun),
	 * and the next counted attempt builds on them.
	 */
	test('ItemSession: serialize/restore carries adaptive outcomes and the next attempt builds on them', () => {
		const definition = createAssessmentItemDefinition({ itemXml: ADAPTIVE_PARTIAL_CREDIT_ITEM });
		const first = definition.openSession();
		first.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 'A' });
		first.dispatch({ action: 'submitAttempt' });
		const snapshot = first.serialize();
		first.dispose();
		expect(snapshot.outcomeVariables.TRIES?.value).toBe(1);
		expect(snapshot.numAttempts).toBe(1);

		const resumed = definition.openSession({ restore: snapshot });
		try {
			// Restore reinstates the saved outcomes as-is.
			expect(resumed.state().outcomes.TRIES).toBe(1);
			expect(resumed.state().outcomes.SCORE).toBe(0);
			expect(resumed.state().numAttempts).toBe(1);

			resumed.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 'C' });
			const attempt2 = resumed.dispatch({ action: 'submitAttempt' }).result?.scoring;
			expect(attempt2?.outcomeValues.TRIES).toBe(2);
			expect(attempt2?.score).toBe(0.5);
			expect(resumed.state().completionStatus).toBe('completed');
		} finally {
			resumed.dispose();
		}
	});

	/**
	 * Every response-processing invocation of an adaptive item builds on the
	 * outcomes the previous one left (§5.2) — scoreAttempt included. Rescoring
	 * a restored adaptive session therefore applies its rules again; a scorer
	 * that wants the session's score reads the restored outcomes instead.
	 */
	test('ItemSession: scoreAttempt on a restored adaptive session is another invocation, not a recomputation', () => {
		const definition = createAssessmentItemDefinition({ itemXml: ADAPTIVE_PARTIAL_CREDIT_ITEM });
		const first = definition.openSession();
		first.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 'A' });
		first.dispatch({ action: 'submitAttempt' });
		const snapshot = first.serialize();
		first.dispose();

		const rescored = definition.openSession({ restore: snapshot });
		try {
			const scoring = rescored.dispatch({ action: 'scoreAttempt' }).result?.scoring;
			expect(scoring?.outcomeValues.TRIES).toBe(2);
			// scoreAttempt does not count an attempt.
			expect(rescored.state().numAttempts).toBe(1);
		} finally {
			rescored.dispose();
		}
	});

	test('non-adaptive items still reset outcomes to defaults before every response-processing run', () => {
		const nonAdaptive = ADAPTIVE_PARTIAL_CREDIT_ITEM.replace('adaptive="true"', 'adaptive="false"');
		const session = createAssessmentItemDefinition({ itemXml: nonAdaptive }).openSession();
		try {
			session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 'A' });
			const first = session.dispatch({ action: 'scoreAttempt' }).result?.scoring;
			const second = session.dispatch({ action: 'scoreAttempt' }).result?.scoring;
			expect(first?.outcomeValues.TRIES).toBe(1);
			expect(second?.outcomeValues.TRIES).toBe(1);
		} finally {
			session.dispose();
		}
	});

	test('newTemplate restarts an adaptive item from its outcome defaults', () => {
		const session = createAssessmentItemDefinition({ itemXml: ADAPTIVE_PARTIAL_CREDIT_ITEM }).openSession();
		try {
			session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 'A' });
			session.dispatch({ action: 'submitAttempt' });
			const restarted = session.dispatch({ action: 'newTemplate' }).current;
			expect(restarted.outcomes.TRIES).toBe(0);
			expect(restarted.numAttempts).toBe(0);

			session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 'C' });
			const fresh = session.dispatch({ action: 'submitAttempt' }).result?.scoring;
			expect(fresh?.outcomeValues.TRIES).toBe(1);
			expect(fresh?.score).toBe(1);
		} finally {
			session.dispose();
		}
	});
});
