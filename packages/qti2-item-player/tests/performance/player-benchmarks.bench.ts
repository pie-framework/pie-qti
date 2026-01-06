/**
 * Performance Benchmarks - QTI Player
 *
 * Benchmarks critical performance paths:
 * - QTI parsing
 * - Response processing
 * - Interaction rendering
 *
 * Run with: bun bench
 */

import { bench, describe } from 'bun:test';
import { Player } from '../../src/core/Player.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

const SIMPLE_CHOICE_XML = `<?xml version="1.0"?>
<assessmentItem ${NS} identifier="bench-1" title="Benchmark Item" adaptive="false" timeDependent="false">
	<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
		<correctResponse><value>A</value></correctResponse>
	</responseDeclaration>
	<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
		<defaultValue><value>0</value></defaultValue>
	</outcomeDeclaration>
	<itemBody>
		<p>What is 2 + 2?</p>
		<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
			<prompt>Select the correct answer:</prompt>
			<simpleChoice identifier="A">4</simpleChoice>
			<simpleChoice identifier="B">3</simpleChoice>
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
					<baseValue baseType="float">1.0</baseValue>
				</setOutcomeValue>
			</responseIf>
			<responseElse>
				<setOutcomeValue identifier="SCORE">
					<baseValue baseType="float">0.0</baseValue>
				</setOutcomeValue>
			</responseElse>
		</responseCondition>
	</responseProcessing>
</assessmentItem>`;

const COMPLEX_CHOICE_XML = `<?xml version="1.0"?>
<assessmentItem ${NS} identifier="bench-2" title="Complex Item" adaptive="false" timeDependent="false">
	<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="identifier">
		<correctResponse>
			<value>A</value>
			<value>C</value>
			<value>E</value>
		</correctResponse>
	</responseDeclaration>
	<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
		<defaultValue><value>0</value></defaultValue>
	</outcomeDeclaration>
	<itemBody>
		<p>Select all prime numbers:</p>
		<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="5">
			<simpleChoice identifier="A">2</simpleChoice>
			<simpleChoice identifier="B">4</simpleChoice>
			<simpleChoice identifier="C">5</simpleChoice>
			<simpleChoice identifier="D">6</simpleChoice>
			<simpleChoice identifier="E">7</simpleChoice>
			<simpleChoice identifier="F">8</simpleChoice>
			<simpleChoice identifier="G">9</simpleChoice>
			<simpleChoice identifier="H">10</simpleChoice>
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
					<baseValue baseType="float">1.0</baseValue>
				</setOutcomeValue>
			</responseIf>
		</responseCondition>
	</responseProcessing>
</assessmentItem>`;

describe('Player Initialization', () => {
	bench('parse and initialize simple item', () => {
		new Player({ itemXml: SIMPLE_CHOICE_XML });
	});

	bench('parse and initialize complex item', () => {
		new Player({ itemXml: COMPLEX_CHOICE_XML });
	});

	bench('parse item with state restoration', () => {
		new Player({
			itemXml: SIMPLE_CHOICE_XML,
			sessionState: { RESPONSE: 'A', SCORE: 1.0 }
		});
	});
});

describe('Interaction Extraction', () => {
	const player = new Player({ itemXml: SIMPLE_CHOICE_XML });

	bench('get interactions from parsed item', () => {
		player.getInteractions();
	});

	const complexPlayer = new Player({ itemXml: COMPLEX_CHOICE_XML });

	bench('get interactions from complex item', () => {
		complexPlayer.getInteractions();
	});
});

describe('Response Processing', () => {
	bench('process correct response', () => {
		const player = new Player({ itemXml: SIMPLE_CHOICE_XML });
		player.setResponses({ RESPONSE: 'A' });
		player.processResponses();
	});

	bench('process incorrect response', () => {
		const player = new Player({ itemXml: SIMPLE_CHOICE_XML });
		player.setResponses({ RESPONSE: 'B' });
		player.processResponses();
	});

	bench('process complex multiple response', () => {
		const player = new Player({ itemXml: COMPLEX_CHOICE_XML });
		player.setResponses({ RESPONSE: ['A', 'C', 'E'] });
		player.processResponses();
	});
});

describe('Session State', () => {
	const player = new Player({ itemXml: SIMPLE_CHOICE_XML });
	player.setResponses({ RESPONSE: 'A' });

	bench('get session state', () => {
		player.getSessionState();
	});

	bench('set and get session state', () => {
		player.setResponses({ RESPONSE: 'B' });
		player.getSessionState();
	});
});

describe('Item Body HTML', () => {
	const player = new Player({ itemXml: SIMPLE_CHOICE_XML });

	bench('generate item body HTML', () => {
		player.getItemBodyHtml();
	});

	const complexPlayer = new Player({ itemXml: COMPLEX_CHOICE_XML });

	bench('generate complex item body HTML', () => {
		complexPlayer.getItemBodyHtml();
	});
});

describe('Full Item Lifecycle', () => {
	bench('complete item lifecycle (parse -> interact -> process)', () => {
		const player = new Player({ itemXml: SIMPLE_CHOICE_XML });
		player.getInteractions();
		player.setResponses({ RESPONSE: 'A' });
		const result = player.processResponses();
		player.getSessionState();
		return result;
	});

	bench('complete complex item lifecycle', () => {
		const player = new Player({ itemXml: COMPLEX_CHOICE_XML });
		player.getInteractions();
		player.setResponses({ RESPONSE: ['A', 'C', 'E'] });
		const result = player.processResponses();
		player.getSessionState();
		return result;
	});
});
