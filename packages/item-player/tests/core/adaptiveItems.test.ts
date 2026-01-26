import { describe, expect, test } from 'bun:test';
import { Player } from '../../src/core/Player.js';

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
		const attempt1 = player.submitAttempt();
		expect(attempt1.numAttempts).toBe(1);
		expect(attempt1.completionStatus).toBe('unknown');
		expect(attempt1.canContinue).toBe(true);

		// Second attempt (incorrect)
		player.setResponses({ RESPONSE: 'B' });
		const attempt2 = player.submitAttempt();
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
		const hintResult = player.submitAttempt(false);
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
		const attempt1 = player.submitAttempt();
		expect(attempt1.completed).toBe(true);
		expect(attempt1.canContinue).toBe(false);
		expect(attempt1.completionStatus).toBe('completed');
		expect(player.isCompleted()).toBe(true);

		// Try to submit again
		expect(() => player.submitAttempt()).toThrow('Cannot submit: item is already completed');
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
		const attempt1 = player.submitAttempt();
		expect(attempt1.numAttempts).toBe(1);
		expect(attempt1.modalFeedback?.[0]?.identifier).toBe('tryagain');
		expect(attempt1.canContinue).toBe(true);

		// Second incorrect attempt
		player.setResponses({ RESPONSE: 'B' });
		const attempt2 = player.submitAttempt();
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
		const attempt1 = player.submitAttempt();
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
		const attempt1 = player.submitAttempt();
		expect(attempt1.completionStatus).toBe('unknown'); // Changed from not_attempted
		expect(attempt1.completed).toBe(false);
		expect(attempt1.canContinue).toBe(true);
	});
});
