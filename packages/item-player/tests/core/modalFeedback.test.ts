import { describe, expect, test } from 'bun:test';
import { Player } from '../../src/core/Player.js';

describe('Modal Feedback', () => {
	test('should extract and show feedback when outcome matches', () => {
		const xml = `
			<assessmentItem identifier="item1" title="Test Item" adaptive="false" timeDependent="false">
				<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
					<correctResponse>
						<value>B</value>
					</correctResponse>
				</responseDeclaration>
				<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
					<defaultValue>
						<value>0</value>
					</defaultValue>
				</outcomeDeclaration>
				<outcomeDeclaration identifier="FEEDBACK" cardinality="single" baseType="identifier">
					<defaultValue>
						<value>incorrect</value>
					</defaultValue>
				</outcomeDeclaration>
				<itemBody>
					<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
						<prompt>What is 2 + 2?</prompt>
						<simpleChoice identifier="A">3</simpleChoice>
						<simpleChoice identifier="B">4</simpleChoice>
						<simpleChoice identifier="C">5</simpleChoice>
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
						</responseIf>
						<responseElse>
							<setOutcomeValue identifier="SCORE">
								<baseValue baseType="float">0</baseValue>
							</setOutcomeValue>
							<setOutcomeValue identifier="FEEDBACK">
								<baseValue baseType="identifier">incorrect</baseValue>
							</setOutcomeValue>
						</responseElse>
					</responseCondition>
				</responseProcessing>
				<modalFeedback outcomeIdentifier="FEEDBACK" identifier="correct" showHide="show" title="Correct!">
					<p>Well done! 2 + 2 = 4 is the correct answer.</p>
				</modalFeedback>
				<modalFeedback outcomeIdentifier="FEEDBACK" identifier="incorrect" showHide="show" title="Incorrect">
					<p>Sorry, that's not correct. 2 + 2 = 4.</p>
				</modalFeedback>
			</assessmentItem>
		`;

		const player = new Player({ itemXml: xml });

		// Test correct answer
		player.setResponses({ RESPONSE: 'B' });
		const correctResult = player.processResponses();

		expect(correctResult.score).toBe(1);
		expect(correctResult.outcomeValues.FEEDBACK).toBe('correct');
		expect(correctResult.modalFeedback).toBeDefined();
		expect(correctResult.modalFeedback?.length).toBe(1);
		expect(correctResult.modalFeedback?.[0].identifier).toBe('correct');
		expect(correctResult.modalFeedback?.[0].title).toBe('Correct!');
		expect(correctResult.modalFeedback?.[0].content).toContain('Well done');

		// Test incorrect answer
		player.setResponses({ RESPONSE: 'A' });
		const incorrectResult = player.processResponses();

		expect(incorrectResult.score).toBe(0);
		expect(incorrectResult.outcomeValues.FEEDBACK).toBe('incorrect');
		expect(incorrectResult.modalFeedback).toBeDefined();
		expect(incorrectResult.modalFeedback?.length).toBe(1);
		expect(incorrectResult.modalFeedback?.[0].identifier).toBe('incorrect');
		expect(incorrectResult.modalFeedback?.[0].title).toBe('Incorrect');
		expect(incorrectResult.modalFeedback?.[0].content).toContain("Sorry, that's not correct");
	});

	test('should support showHide="hide" mode', () => {
		const xml = `
			<assessmentItem identifier="item2" title="Test Item" adaptive="false" timeDependent="false">
				<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
					<correctResponse>
						<value>B</value>
					</correctResponse>
				</responseDeclaration>
				<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
					<defaultValue>
						<value>0</value>
					</defaultValue>
				</outcomeDeclaration>
				<outcomeDeclaration identifier="FEEDBACK" cardinality="single" baseType="identifier">
					<defaultValue>
						<value></value>
					</defaultValue>
				</outcomeDeclaration>
				<itemBody>
					<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
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
							<setOutcomeValue identifier="FEEDBACK">
								<baseValue baseType="identifier">suppress</baseValue>
							</setOutcomeValue>
						</responseIf>
						<responseElse>
							<setOutcomeValue identifier="SCORE">
								<baseValue baseType="float">0</baseValue>
							</setOutcomeValue>
							<setOutcomeValue identifier="FEEDBACK">
								<baseValue baseType="identifier">show</baseValue>
							</setOutcomeValue>
						</responseElse>
					</responseCondition>
				</responseProcessing>
				<modalFeedback outcomeIdentifier="FEEDBACK" identifier="suppress" showHide="hide" title="Try Again">
					<p>Please review the question and try again.</p>
				</modalFeedback>
			</assessmentItem>
		`;

		const player = new Player({ itemXml: xml });

		// When FEEDBACK="suppress", showHide="hide" means don't show (outcome matches identifier)
		player.setResponses({ RESPONSE: 'B' });
		const suppressResult = player.processResponses();
		expect(suppressResult.modalFeedback?.length).toBe(0);

		// When FEEDBACK="show", showHide="hide" means show (outcome does NOT match identifier)
		player.setResponses({ RESPONSE: 'A' });
		const showResult = player.processResponses();
		expect(showResult.modalFeedback?.length).toBe(1);
		expect(showResult.modalFeedback?.[0].content).toContain('Please review the question');
	});

	test('should handle multiple feedback blocks', () => {
		const xml = `
			<assessmentItem identifier="item3" title="Test Item" adaptive="false" timeDependent="false">
				<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
					<correctResponse>
						<value>B</value>
					</correctResponse>
				</responseDeclaration>
				<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
				<outcomeDeclaration identifier="FEEDBACK1" cardinality="single" baseType="identifier"/>
				<outcomeDeclaration identifier="FEEDBACK2" cardinality="single" baseType="identifier"/>
				<itemBody>
					<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
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
							<setOutcomeValue identifier="FEEDBACK1">
								<baseValue baseType="identifier">show</baseValue>
							</setOutcomeValue>
							<setOutcomeValue identifier="FEEDBACK2">
								<baseValue baseType="identifier">show</baseValue>
							</setOutcomeValue>
						</responseIf>
					</responseCondition>
				</responseProcessing>
				<modalFeedback outcomeIdentifier="FEEDBACK1" identifier="show" showHide="show">
					<p>Feedback block 1</p>
				</modalFeedback>
				<modalFeedback outcomeIdentifier="FEEDBACK2" identifier="show" showHide="show">
					<p>Feedback block 2</p>
				</modalFeedback>
			</assessmentItem>
		`;

		const player = new Player({ itemXml: xml });
		player.setResponses({ RESPONSE: 'B' });
		const result = player.processResponses();

		expect(result.modalFeedback?.length).toBe(2);
		expect(result.modalFeedback?.[0].content).toContain('Feedback block 1');
		expect(result.modalFeedback?.[1].content).toContain('Feedback block 2');
	});

	test('should handle missing modalFeedback elements', () => {
		const xml = `
			<assessmentItem identifier="item4" title="Test Item" adaptive="false" timeDependent="false">
				<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
					<correctResponse>
						<value>B</value>
					</correctResponse>
				</responseDeclaration>
				<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
				<itemBody>
					<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
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
		player.setResponses({ RESPONSE: 'B' });
		const result = player.processResponses();

		expect(result.modalFeedback).toBeDefined();
		expect(result.modalFeedback?.length).toBe(0);
	});

	test('should handle feedback with HTML content and MathML', () => {
		const xml = `
			<assessmentItem identifier="item5" title="Test Item" adaptive="false" timeDependent="false">
				<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
					<correctResponse>
						<value>B</value>
					</correctResponse>
				</responseDeclaration>
				<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
				<outcomeDeclaration identifier="FEEDBACK" cardinality="single" baseType="identifier"/>
				<itemBody>
					<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
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
							<setOutcomeValue identifier="FEEDBACK">
								<baseValue baseType="identifier">correct</baseValue>
							</setOutcomeValue>
						</responseIf>
					</responseCondition>
				</responseProcessing>
				<modalFeedback outcomeIdentifier="FEEDBACK" identifier="correct" showHide="show" title="Correct Answer">
					<p><strong>Correct!</strong> The formula is: <math><mrow><mn>2</mn><mo>+</mo><mn>2</mn><mo>=</mo><mn>4</mn></mrow></math></p>
					<ul>
						<li>Addition is commutative</li>
						<li>This is a basic arithmetic fact</li>
					</ul>
				</modalFeedback>
			</assessmentItem>
		`;

		const player = new Player({ itemXml: xml });
		player.setResponses({ RESPONSE: 'B' });
		const result = player.processResponses();

		expect(result.modalFeedback?.length).toBe(1);
		expect(result.modalFeedback?.[0].content).toContain('<strong>Correct!</strong>');
		expect(result.modalFeedback?.[0].content).toContain('<math>');
		expect(result.modalFeedback?.[0].content).toContain('<ul>');
		expect(result.modalFeedback?.[0].content).toContain('Addition is commutative');
	});
});
