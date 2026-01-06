/**
 * Sample QTI assessments for demonstration
 */

import type { QTIRole, SecureAssessment } from '@pie-qti/qti2-assessment-player';

/**
 * Legacy (client-authoritative) demo model.
 *
 * The assessment player is now backend-authoritative, so these fixtures are
 * converted to `SecureAssessment` via `toSecureAssessment()` at runtime.
 */
export interface LegacyRubricBlock {
	id?: string;
	identifier?: string;
	view: string;
	use?: string;
	content: string;
}

export interface LegacyQuestionRef {
	identifier: string;
	title?: string;
	href?: string;
	required?: boolean;
	itemXml: string;
}

export interface LegacyAssessmentSection {
	identifier: string;
	title?: string;
	visible: boolean;
	rubricBlocks?: LegacyRubricBlock[];
	questionRefs: LegacyQuestionRef[];
}

export interface LegacyTestPart {
	identifier: string;
	navigationMode?: 'linear' | 'nonlinear';
	submissionMode?: 'individual' | 'simultaneous';
	sections: LegacyAssessmentSection[];
}

export interface LegacyAssessmentTest {
	identifier: string;
	title: string;
	testParts: LegacyTestPart[];
}

export interface SampleAssessment {
	id: string;
	name: string;
	description: string;
	assessment: LegacyAssessmentTest;
}

export function toSecureAssessment(
	legacy: LegacyAssessmentTest,
	opts?: { role?: QTIRole },
): SecureAssessment {
	const firstPart = legacy.testParts?.[0];
	const navigationMode = firstPart?.navigationMode ?? 'nonlinear';
	const submissionMode = firstPart?.submissionMode ?? 'individual';
	const role: QTIRole = opts?.role ?? 'candidate';

	return {
		identifier: legacy.identifier,
		title: legacy.title,
		navigationMode,
		submissionMode,
		testParts: (legacy.testParts || []).map((tp) => ({
			identifier: tp.identifier,
			sections: (tp.sections || []).map((s) => ({
				identifier: s.identifier,
				title: s.title,
				visible: s.visible,
				items: (s.questionRefs || []).map((q) => ({
					identifier: q.identifier,
					itemXml: q.itemXml,
					role,
					required: q.required,
				})),
				rubrics: (s.rubricBlocks || []).map((rb) => ({
					identifier: rb.identifier ?? rb.id,
					content: rb.content,
					view: [(rb.view ?? 'candidate') as QTIRole],
					use: rb.use,
				})),
			})),
		})),
	};
}

/**
 * Simple reading comprehension assessment with passage
 */
export const READING_COMPREHENSION_ASSESSMENT: SampleAssessment = {
	id: 'reading-comp-1',
	name: 'Reading Comprehension - The Water Cycle',
	description: 'A short assessment with a reading passage and multiple-choice questions',
	assessment: {
		identifier: 'READING-COMP-001',
		title: 'Reading Comprehension: The Water Cycle',
		testParts: [
			{
				identifier: 'part-1',
				navigationMode: 'nonlinear',
				submissionMode: 'simultaneous',
				sections: [
					{
						identifier: 'section-1',
						title: 'The Water Cycle',
						visible: true,
						rubricBlocks: [
							{
								view: 'candidate',
								use: 'passage',
								content: `
									<div class="passage">
										<h3>The Water Cycle</h3>
										<p>
											The water cycle, also known as the hydrologic cycle, describes the continuous movement
											of water on, above, and below the surface of the Earth. The water cycle involves several
											key processes: evaporation, condensation, precipitation, and collection.
										</p>
										<p>
											First, water from oceans, lakes, and rivers evaporates into the atmosphere due to heat
											from the sun. This water vapor rises and cools, forming clouds through a process called
											condensation. When the clouds become heavy enough, the water falls back to Earth as
											precipitation in the form of rain, snow, sleet, or hail.
										</p>
										<p>
											Finally, the precipitation collects in bodies of water like rivers, lakes, and oceans,
											where the cycle begins again. This continuous process is essential for life on Earth,
											providing fresh water for plants, animals, and humans.
										</p>
									</div>
								`,
							},
						],
						questionRefs: [
							{
								identifier: 'q1',
								title: 'Question 1: Main Process',
								itemXml: `
									<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
										identifier="q1"
										title="Water Cycle Process"
										adaptive="false"
										timeDependent="false">
										<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
											<correctResponse>
												<value>A</value>
											</correctResponse>
										</responseDeclaration>
										<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
											<defaultValue>
												<value>0</value>
											</defaultValue>
										</outcomeDeclaration>
										<itemBody>
											<p>What is the first step of the water cycle described in the passage?</p>
											<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
												<simpleChoice identifier="A">Evaporation</simpleChoice>
												<simpleChoice identifier="B">Condensation</simpleChoice>
												<simpleChoice identifier="C">Precipitation</simpleChoice>
												<simpleChoice identifier="D">Collection</simpleChoice>
											</choiceInteraction>
										</itemBody>
										<responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
									</assessmentItem>
								`,
							},
							{
								identifier: 'q2',
								title: 'Question 2: Cloud Formation',
								itemXml: `
									<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
										identifier="q2"
										title="Cloud Formation"
										adaptive="false"
										timeDependent="false">
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
										<itemBody>
											<p>According to the passage, clouds are formed through which process?</p>
											<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
												<simpleChoice identifier="A">Evaporation</simpleChoice>
												<simpleChoice identifier="B">Condensation</simpleChoice>
												<simpleChoice identifier="C">Precipitation</simpleChoice>
												<simpleChoice identifier="D">Collection</simpleChoice>
											</choiceInteraction>
										</itemBody>
										<responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
									</assessmentItem>
								`,
							},
							{
								identifier: 'q3',
								title: 'Question 3: Importance',
								itemXml: `
									<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
										identifier="q3"
										title="Water Cycle Importance"
										adaptive="false"
										timeDependent="false">
										<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
											<correctResponse>
												<value>C</value>
											</correctResponse>
										</responseDeclaration>
										<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
											<defaultValue>
												<value>0</value>
											</defaultValue>
										</outcomeDeclaration>
										<itemBody>
											<p>Why is the water cycle essential for life on Earth?</p>
											<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
												<simpleChoice identifier="A">It creates new water molecules</simpleChoice>
												<simpleChoice identifier="B">It prevents flooding</simpleChoice>
												<simpleChoice identifier="C">It provides fresh water for living things</simpleChoice>
												<simpleChoice identifier="D">It controls the weather</simpleChoice>
											</choiceInteraction>
										</itemBody>
										<responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
									</assessmentItem>
								`,
							},
						],
					},
				],
			},
		],
	},
};

/**
 * Math assessment with multiple sections
 */
export const MATH_ASSESSMENT: SampleAssessment = {
	id: 'math-1',
	name: 'Mathematics Assessment - Grade 5',
	description: 'A multi-section math assessment covering different topics',
	assessment: {
		identifier: 'MATH-GRADE5-001',
		title: 'Grade 5 Mathematics Assessment',
		testParts: [
			{
				identifier: 'part-1',
				navigationMode: 'nonlinear',
				submissionMode: 'simultaneous',
				sections: [
					{
						identifier: 'section-arithmetic',
						title: 'Arithmetic',
						visible: true,
						rubricBlocks: [
							{
								view: 'candidate',
								use: 'instructions',
								content: '<p>Answer all questions in this section. Show your work if needed.</p>',
							},
						],
						questionRefs: [
							{
								identifier: 'q1',
								title: 'Addition',
								itemXml: `
									<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
										identifier="q1"
										title="Addition Problem"
										adaptive="false"
										timeDependent="false">
										<responseDeclaration identifier="ANSWER" cardinality="single" baseType="integer">
											<correctResponse>
												<value>567</value>
											</correctResponse>
										</responseDeclaration>
										<responseDeclaration identifier="WORK" cardinality="single" baseType="string">
											<correctResponse>
												<value></value>
											</correctResponse>
										</responseDeclaration>
										<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
											<defaultValue>
												<value>0</value>
											</defaultValue>
										</outcomeDeclaration>
										<itemBody>
											<p><strong>What is 234 + 333?</strong></p>
											<div>
												<p>Final Answer: <textEntryInteraction responseIdentifier="ANSWER" expectedLength="3"/></p>
											</div>
											<div>
												<p><strong>Show your work:</strong></p>
												<extendedTextInteraction responseIdentifier="WORK" expectedLines="8" format="plain"/>
											</div>
										</itemBody>
										<responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
									</assessmentItem>
								`,
							},
							{
								identifier: 'q2',
								title: 'Multiplication',
								itemXml: `
									<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
										identifier="q2"
										title="Multiplication Problem"
										adaptive="false"
										timeDependent="false">
										<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="integer">
											<correctResponse>
												<value>72</value>
											</correctResponse>
										</responseDeclaration>
										<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
											<defaultValue>
												<value>0</value>
											</defaultValue>
										</outcomeDeclaration>
										<itemBody>
											<p>What is 8 × 9?</p>
											<p>Answer: <textEntryInteraction responseIdentifier="RESPONSE" expectedLength="2"/></p>
										</itemBody>
										<responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
									</assessmentItem>
								`,
							},
						],
					},
					{
						identifier: 'section-fractions',
						title: 'Fractions',
						visible: true,
						rubricBlocks: [
							{
								view: 'candidate',
								use: 'instructions',
								content: '<p>Simplify your answers when possible.</p>',
							},
						],
						questionRefs: [
							{
								identifier: 'q3',
								title: 'Fraction Addition',
								itemXml: `
									<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
										identifier="q3"
										title="Fraction Addition"
										adaptive="false"
										timeDependent="false">
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
										<itemBody>
											<p>What is 1/4 + 1/4?</p>
											<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
												<simpleChoice identifier="A">1/8</simpleChoice>
												<simpleChoice identifier="B">1/2</simpleChoice>
												<simpleChoice identifier="C">2/4</simpleChoice>
												<simpleChoice identifier="D">2/8</simpleChoice>
											</choiceInteraction>
										</itemBody>
										<responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
									</assessmentItem>
								`,
							},
						],
					},
				],
			},
		],
	},
};

/**
 * Science assessment with linear navigation
 */
export const SCIENCE_ASSESSMENT: SampleAssessment = {
	id: 'science-1',
	name: 'Science - Life Cycles',
	description: 'Linear assessment about plant and animal life cycles',
	assessment: {
		identifier: 'SCIENCE-001',
		title: 'Life Cycles Assessment',
		testParts: [
			{
				identifier: 'part-1',
				navigationMode: 'linear',
				submissionMode: 'individual',
				sections: [
					{
						identifier: 'section-1',
						title: 'Life Cycles',
						visible: true,
						rubricBlocks: [
							{
								view: 'candidate',
								use: 'instructions',
								content: `
									<div class="instructions">
										<h3>Instructions</h3>
										<p>This assessment covers plant and animal life cycles. You must answer each question before moving to the next.</p>
										<p><strong>You cannot go back to previous questions.</strong></p>
									</div>
								`,
							},
						],
						questionRefs: [
							{
								identifier: 'q1',
								title: 'Question 1: Butterfly Life Cycle',
								itemXml: `
									<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
										identifier="q1"
										title="Butterfly Life Cycle"
										adaptive="false"
										timeDependent="false">
										<responseDeclaration identifier="RESPONSE" cardinality="ordered" baseType="identifier">
											<correctResponse>
												<value>egg</value>
												<value>larva</value>
												<value>pupa</value>
												<value>adult</value>
											</correctResponse>
										</responseDeclaration>
										<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
											<defaultValue>
												<value>0</value>
											</defaultValue>
										</outcomeDeclaration>
										<itemBody>
											<p>Arrange the stages of a butterfly's life cycle in the correct order:</p>
											<orderInteraction responseIdentifier="RESPONSE" shuffle="true">
												<prompt>Drag the stages into the correct sequence</prompt>
												<simpleChoice identifier="egg">Egg</simpleChoice>
												<simpleChoice identifier="larva">Larva (Caterpillar)</simpleChoice>
												<simpleChoice identifier="pupa">Pupa (Chrysalis)</simpleChoice>
												<simpleChoice identifier="adult">Adult Butterfly</simpleChoice>
											</orderInteraction>
										</itemBody>
										<responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
									</assessmentItem>
								`,
							},
							{
								identifier: 'q2',
								title: 'Question 2: Plant Life Cycle',
								itemXml: `
									<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
										identifier="q2"
										title="Plant Life Cycle"
										adaptive="false"
										timeDependent="false">
										<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
											<correctResponse>
												<value>seed</value>
											</correctResponse>
										</responseDeclaration>
										<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
											<defaultValue>
												<value>0</value>
											</defaultValue>
										</outcomeDeclaration>
										<itemBody>
											<p>What is the first stage in a flowering plant's life cycle?</p>
											<choiceInteraction responseIdentifier="RESPONSE" shuffle="true" maxChoices="1">
												<simpleChoice identifier="seed">Seed</simpleChoice>
												<simpleChoice identifier="sprout">Sprout</simpleChoice>
												<simpleChoice identifier="flower">Flower</simpleChoice>
												<simpleChoice identifier="fruit">Fruit</simpleChoice>
											</choiceInteraction>
										</itemBody>
										<responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
									</assessmentItem>
								`,
							},
							{
								identifier: 'q3',
								title: 'Question 3: Metamorphosis',
								itemXml: `
									<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
										identifier="q3"
										title="Metamorphosis"
										adaptive="false"
										timeDependent="false">
										<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string">
											<correctResponse>
												<value>metamorphosis</value>
											</correctResponse>
										</responseDeclaration>
										<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
											<defaultValue>
												<value>0</value>
											</defaultValue>
										</outcomeDeclaration>
										<itemBody>
											<p>The process by which a caterpillar transforms into a butterfly is called <textEntryInteraction responseIdentifier="RESPONSE" expectedLength="15"/>.</p>
										</itemBody>
										<responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
									</assessmentItem>
								`,
							},
						],
					},
				],
			},
		],
	},
};

/**
 * Mixed-topic assessment demonstrating multiple sections
 */
export const MIXED_TOPICS_ASSESSMENT: SampleAssessment = {
	id: 'mixed-1',
	name: 'Mixed Topics - General Knowledge',
	description: 'Assessment covering geography, history, and science',
	assessment: {
		identifier: 'MIXED-001',
		title: 'General Knowledge Assessment',
		testParts: [
			{
				identifier: 'part-1',
				navigationMode: 'nonlinear',
				submissionMode: 'simultaneous',
				sections: [
					{
						identifier: 'section-geography',
						title: 'Geography',
						visible: true,
						rubricBlocks: [
							{
								view: 'candidate',
								use: 'instructions',
								content: '<p><strong>Section 1: Geography</strong> - Answer questions about world geography.</p>',
							},
						],
						questionRefs: [
							{
								identifier: 'geo1',
								title: 'Oceans',
								itemXml: `
									<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
										identifier="geo1"
										title="Largest Ocean"
										adaptive="false"
										timeDependent="false">
										<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
											<correctResponse>
												<value>pacific</value>
											</correctResponse>
										</responseDeclaration>
										<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
											<defaultValue>
												<value>0</value>
											</defaultValue>
										</outcomeDeclaration>
										<itemBody>
											<p>Which is the largest ocean on Earth?</p>
											<choiceInteraction responseIdentifier="RESPONSE" shuffle="true" maxChoices="1">
												<simpleChoice identifier="atlantic">Atlantic Ocean</simpleChoice>
												<simpleChoice identifier="pacific">Pacific Ocean</simpleChoice>
												<simpleChoice identifier="indian">Indian Ocean</simpleChoice>
												<simpleChoice identifier="arctic">Arctic Ocean</simpleChoice>
											</choiceInteraction>
										</itemBody>
										<responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
									</assessmentItem>
								`,
							},
							{
								identifier: 'geo2',
								title: 'Continents',
								itemXml: `
									<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
										identifier="geo2"
										title="Number of Continents"
										adaptive="false"
										timeDependent="false">
										<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
											<correctResponse>
												<value>seven</value>
											</correctResponse>
										</responseDeclaration>
										<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
											<defaultValue>
												<value>0</value>
											</defaultValue>
										</outcomeDeclaration>
										<itemBody>
											<p>How many continents are there on Earth?</p>
											<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
												<simpleChoice identifier="five">Five</simpleChoice>
												<simpleChoice identifier="six">Six</simpleChoice>
												<simpleChoice identifier="seven">Seven</simpleChoice>
												<simpleChoice identifier="eight">Eight</simpleChoice>
											</choiceInteraction>
										</itemBody>
										<responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
									</assessmentItem>
								`,
							},
						],
					},
					{
						identifier: 'section-history',
						title: 'History',
						visible: true,
						rubricBlocks: [
							{
								view: 'candidate',
								use: 'instructions',
								content: '<p><strong>Section 2: History</strong> - Test your knowledge of historical events.</p>',
							},
						],
						questionRefs: [
							{
								identifier: 'hist1',
								title: 'Moon Landing',
								itemXml: `
									<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
										identifier="hist1"
										title="Moon Landing Year"
										adaptive="false"
										timeDependent="false">
										<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
											<correctResponse>
												<value>y1969</value>
											</correctResponse>
										</responseDeclaration>
										<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
											<defaultValue>
												<value>0</value>
											</defaultValue>
										</outcomeDeclaration>
										<itemBody>
											<p>In what year did humans first land on the Moon?</p>
											<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
												<simpleChoice identifier="y1965">1965</simpleChoice>
												<simpleChoice identifier="y1969">1969</simpleChoice>
												<simpleChoice identifier="y1972">1972</simpleChoice>
												<simpleChoice identifier="y1975">1975</simpleChoice>
											</choiceInteraction>
										</itemBody>
										<responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
									</assessmentItem>
								`,
							},
						],
					},
					{
						identifier: 'section-science',
						title: 'Science',
						visible: true,
						rubricBlocks: [
							{
								view: 'candidate',
								use: 'instructions',
								content: '<p><strong>Section 3: Science</strong> - Basic science concepts.</p>',
							},
						],
						questionRefs: [
							{
								identifier: 'sci1',
								title: 'States of Matter',
								itemXml: `
									<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
										identifier="sci1"
										title="States of Matter"
										adaptive="false"
										timeDependent="false">
										<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="identifier">
											<correctResponse>
												<value>solid</value>
												<value>liquid</value>
												<value>gas</value>
											</correctResponse>
										</responseDeclaration>
										<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
											<defaultValue>
												<value>0</value>
											</defaultValue>
										</outcomeDeclaration>
										<itemBody>
											<p>Select all the common states of matter: (Select all that apply)</p>
											<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="4">
												<simpleChoice identifier="solid">Solid</simpleChoice>
												<simpleChoice identifier="liquid">Liquid</simpleChoice>
												<simpleChoice identifier="gas">Gas</simpleChoice>
												<simpleChoice identifier="energy">Energy</simpleChoice>
											</choiceInteraction>
										</itemBody>
										<responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
									</assessmentItem>
								`,
							},
						],
					},
				],
			},
		],
	},
};

/**
 * All sample assessments
 */
export const SAMPLE_ASSESSMENTS: SampleAssessment[] = [
	READING_COMPREHENSION_ASSESSMENT,
	MATH_ASSESSMENT,
	SCIENCE_ASSESSMENT,
	MIXED_TOPICS_ASSESSMENT,
];
