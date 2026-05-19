import { describe, expect, test } from 'bun:test';
import { Player } from '../../src/index.js';
import type { ElementExtractor, ExtractionContext } from '../../src/extraction/types.js';

const QTI22_NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

function qti22Item(body: string, declarations = ''): string {
	return `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem ${QTI22_NS} identifier="document-characterization" title="Document Characterization" adaptive="false" timeDependent="false">
	${declarations}
	<itemBody>
		${body}
	</itemBody>
</assessmentItem>`;
}

function qti3Item(body: string, declarations = ''): string {
	return `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="document-characterization" title="Document Characterization" adaptive="false" time-dependent="false">
	${declarations}
	<qti-item-body>
		${body}
	</qti-item-body>
</qti-assessment-item>`;
}

describe('Player document characterization', () => {
	test('preserves QTI 2.2 visible itemBody structure before sanitization sinks consume it', () => {
		const player = new Player({
			itemXml: qti22Item(
				`<p class="stem" data-purpose="visible">Solve <math><mi>x</mi></math>.</p>
				<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
					<simpleChoice identifier="A">Choice <strong>A</strong></simpleChoice>
				</choiceInteraction>`,
				`<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>`
			),
		});

		const html = String(player.getItemBodyHtml());

		expect(html).toContain('class="stem"');
		expect(html).toContain('data-purpose="visible"');
		expect(html).toContain('<math>');
		expect(html).toContain('<choiceInteraction');
		expect(html).toContain('responseIdentifier="RESPONSE"');
		expect(html).toContain('<strong>A</strong>');
	});

	test('normalizes prefixed MathML for browser rendering', () => {
		const player = new Player({
			itemXml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem ${QTI22_NS} xmlns:m="http://www.w3.org/1998/Math/MathML" identifier="prefixed-math" title="Prefixed Math" adaptive="false" timeDependent="false">
	<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
	<itemBody>
		<p>Solve <m:math><m:mi>x</m:mi><m:mo>+</m:mo><m:mn>1</m:mn></m:math>.</p>
		<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
			<simpleChoice identifier="A">A</simpleChoice>
		</choiceInteraction>
	</itemBody>
</assessmentItem>`,
		});

		const html = String(player.getItemBodyHtml());

		expect(html).toContain('<math>');
		expect(html).toContain('<mi>x</mi>');
		expect(html).toContain('<mo>+</mo>');
		expect(html).not.toContain('m:math');
		expect(html).not.toContain('m:mi');
	});

	test('preserves QTI 3.0 visible itemBody structure and kebab-case attributes', () => {
		const player = new Player({
			itemXml: qti3Item(
				`<p class="stem" data-purpose="visible">Solve <math><mi>x</mi></math>.</p>
				<qti-choice-interaction response-identifier="RESPONSE" shuffle="false" max-choices="1">
					<qti-simple-choice identifier="A">Choice <em>A</em></qti-simple-choice>
				</qti-choice-interaction>`,
				`<qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>`
			),
		});

		const html = String(player.getItemBodyHtml());

		expect(html).toContain('class="stem"');
		expect(html).toContain('data-purpose="visible"');
		expect(html).toContain('<math>');
		expect(html).toContain('<qti-choice-interaction');
		expect(html).toContain('response-identifier="RESPONSE"');
		expect(html).toContain('max-choices="1"');
		expect(html).toContain('<em>A</em>');
	});

	test('discovers mixed interactions in itemBody document order', () => {
		const player = new Player({
			itemXml: qti22Item(
				`<choiceInteraction responseIdentifier="CHOICE" shuffle="false" maxChoices="1">
					<simpleChoice identifier="A">A</simpleChoice>
				</choiceInteraction>
				<orderInteraction responseIdentifier="ORDER">
					<simpleChoice identifier="O1">First</simpleChoice>
					<simpleChoice identifier="O2">Second</simpleChoice>
				</orderInteraction>
				<textEntryInteraction responseIdentifier="TEXT" expectedLength="6"/>`,
				`<responseDeclaration identifier="CHOICE" cardinality="single" baseType="identifier"/>
				<responseDeclaration identifier="ORDER" cardinality="ordered" baseType="identifier"/>
				<responseDeclaration identifier="TEXT" cardinality="single" baseType="string"/>`
			),
		});

		expect(player.getInteractionData().map((interaction) => interaction.responseId)).toEqual([
			'CHOICE',
			'ORDER',
			'TEXT',
		]);
	});

	test('ignores interaction-looking markup outside itemBody', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem ${QTI22_NS} identifier="outside-body" title="Outside Body" adaptive="false" timeDependent="false">
	<responseDeclaration identifier="BODY_RESPONSE" cardinality="single" baseType="identifier"/>
	<responseDeclaration identifier="RUBRIC_RESPONSE" cardinality="single" baseType="identifier"/>
	<itemBody>
		<choiceInteraction responseIdentifier="BODY_RESPONSE" shuffle="false" maxChoices="1">
			<simpleChoice identifier="A">A</simpleChoice>
		</choiceInteraction>
	</itemBody>
	<rubricBlock view="candidate">
		<choiceInteraction responseIdentifier="RUBRIC_RESPONSE" shuffle="false" maxChoices="1">
			<simpleChoice identifier="B">B</simpleChoice>
		</choiceInteraction>
	</rubricBlock>
</assessmentItem>`;

		const player = new Player({ itemXml: xml });

		expect(player.getInteractionData().map((interaction) => interaction.responseId)).toEqual([
			'BODY_RESPONSE',
		]);
	});

	test('keeps self-closing inline interactions from swallowing following text', () => {
		const player = new Player({
			itemXml: qti22Item(
				`<p>Enter <textEntryInteraction responseIdentifier="TEXT" expectedLength="4"/> after the prompt.</p>`,
				`<responseDeclaration identifier="TEXT" cardinality="single" baseType="string"/>`
			),
		});

		const html = String(player.getItemBodyHtml());
		const interactions = player.getInteractionData();

		expect(html).toContain('after the prompt');
		expect(interactions).toHaveLength(1);
		expect(interactions[0].responseId).toBe('TEXT');
	});

	test('preserves nested prompt and choice HTML through interaction extraction', () => {
		const player = new Player({
			itemXml: qti22Item(
				`<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
					<prompt>Choose <math><mi>x</mi></math> and <strong>explain</strong>.</prompt>
					<simpleChoice identifier="A">A <span class="unit">meter</span></simpleChoice>
				</choiceInteraction>`,
				`<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>`
			),
		});

		const [interaction] = player.getInteractionData() as any[];

		expect(interaction.prompt).toContain('<math>');
		expect(interaction.prompt).toContain('<strong>explain</strong>');
		expect(String(interaction.choices[0].text)).toContain('<span class="unit">meter</span>');
	});

	test('extracts extended text prompts for block renderers', () => {
		const player = new Player({
			itemXml: qti22Item(
				`<extendedTextInteraction responseIdentifier="RESPONSE" expectedLines="5" expectedLength="500">
					<prompt>Read the passage and <strong>explain</strong> your answer.</prompt>
				</extendedTextInteraction>`,
				`<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string"/>`
			),
		});

		const [interaction] = player.getInteractionData() as any[];

		expect(interaction.type).toBe('extendedTextInteraction');
		expect(interaction.prompt).toContain('<strong>explain</strong>');
	});

	test('unwraps CDATA-wrapped item body XHTML before rendering and extraction', () => {
		const player = new Player({
			itemXml: qti22Item(
				`<![CDATA[
					<p class="passage">And with Jessica sitting there on her bed, smiling at me.</p>
					<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
						<prompt>Consider the narrator&rsquo;s word choices.</prompt>
						<simpleChoice identifier="A">hopeful</simpleChoice>
						<simpleChoice identifier="B">resentful with <em>admiration</em></simpleChoice>
					</choiceInteraction>
				]]>`,
				`<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>`
			),
		});

		const html = String(player.getItemBodyHtml());
		const [interaction] = player.getInteractionData() as any[];

		expect(html).toContain('<p class="passage">');
		expect(html).toContain('<choiceInteraction');
		expect(html).not.toContain('<![CDATA[');
		expect(html).not.toContain(']]>');
		expect(interaction.responseId).toBe('RESPONSE');
		expect(interaction.prompt).toContain('narrator&rsquo;s word choices');
		expect(String(interaction.choices[1].text)).toContain('<em>admiration</em>');
	});

	test('renders safe image object tags as images instead of dropping visible media', () => {
		const player = new Player({
			itemXml: qti22Item(
				`<p>Use the diagram.</p>
				<object type="image/png" data="images/diagram.png" width="320" height="180">Diagram alt text</object>
				<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
					<simpleChoice identifier="A">A</simpleChoice>
				</choiceInteraction>`,
				`<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>`
			),
		});

		const html = String(player.getItemBodyHtml());

		expect(html).toContain('<img');
		expect(html).toContain('src="images/diagram.png"');
		expect(html).toContain('alt="Diagram alt text"');
		expect(html).toContain('width="320"');
		expect(html).not.toContain('<object');
	});

	test('renders safe audio and video object tags as native media', () => {
		const player = new Player({
			itemXml: qti22Item(
				`<object type="audio/mpeg" data="media/prompt.mp3">Audio prompt</object>
				<object type="video/mp4" data="media/clip.mp4" poster="images/poster.png" width="640" height="360">Video prompt</object>
				<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
					<simpleChoice identifier="A">A</simpleChoice>
				</choiceInteraction>`,
				`<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>`
			),
		});

		const html = String(player.getItemBodyHtml());

		expect(html).toContain('<audio controls');
		expect(html).toContain('src="media/prompt.mp3"');
		expect(html).toContain('type="audio/mpeg"');
		expect(html).toContain('<video controls');
		expect(html).toContain('src="media/clip.mp4"');
		expect(html).toContain('poster="images/poster.png"');
		expect(html).not.toContain('<object');
	});

	test('projects response, outcome, and template declarations into extraction context', () => {
		let capturedContext: ExtractionContext | null = null;
		const capturingExtractor: ElementExtractor = {
			id: 'test:capture-choice-context',
			name: 'Capture Choice Context',
			priority: 10_000,
			elementTypes: ['choiceInteraction'],
			canHandle: (_element, context) => {
				capturedContext = context;
				return true;
			},
			extract: () => ({
				shuffle: false,
				maxChoices: 1,
				minChoices: 0,
				prompt: null,
				choices: [{ identifier: 'A', text: 'A' }],
			}),
		};

		const player = new Player({
			plugins: [{ registerExtractors: (registry: any) => registry.register(capturingExtractor) }],
			itemXml: qti22Item(
				`<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
					<simpleChoice identifier="A">A</simpleChoice>
				</choiceInteraction>`,
				`<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
				<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
				<templateDeclaration identifier="TEMPLATE_VALUE" cardinality="single" baseType="integer"/>`
			),
		});

		expect(player.getInteractionData()).toHaveLength(1);
		expect(capturedContext?.declarations.get('RESPONSE')).toMatchObject({
			identifier: 'RESPONSE',
			cardinality: 'single',
			baseType: 'identifier',
		});
		expect(capturedContext?.declarations.get('SCORE')).toMatchObject({
			identifier: 'SCORE',
			cardinality: 'single',
			baseType: 'float',
		});
		expect(capturedContext?.declarations.get('TEMPLATE_VALUE')).toMatchObject({
			identifier: 'TEMPLATE_VALUE',
			cardinality: 'single',
			baseType: 'integer',
		});
	});

	test('discovers registered plugin extractor element types beyond standard interactions', () => {
		const pluginExtractor: ElementExtractor = {
			id: 'test:plugin-interaction',
			name: 'Plugin Interaction',
			priority: 10_000,
			elementTypes: ['pluginInteraction'],
			canHandle: () => true,
			extract: () => ({ prompt: null, rawAttributes: {}, xml: '<pluginInteraction />' }),
		};

		const player = new Player({
			plugins: [{ registerExtractors: (registry: any) => registry.register(pluginExtractor) }],
			itemXml: qti22Item(
				`<pluginInteraction responseIdentifier="PLUGIN_RESPONSE" data-plugin="true"/>`,
				`<responseDeclaration identifier="PLUGIN_RESPONSE" cardinality="single" baseType="string"/>`
			),
		});

		expect(player.getInteractionData().map((interaction) => interaction.responseId)).toEqual([
			'PLUGIN_RESPONSE',
		]);
	});

	test('renders QTI 3 rubrics and modal feedback through the document boundary', () => {
		const player = new Player({
			itemXml: qti3Item(
				`<p>Answer the item.</p>
				<qti-rubric-block view="candidate"><p>Candidate rubric.</p></qti-rubric-block>`,
				`<qti-outcome-declaration identifier="FEEDBACK" cardinality="single" base-type="identifier">
					<qti-default-value><qti-value>SHOW_FEEDBACK</qti-value></qti-default-value>
				</qti-outcome-declaration>
				<qti-modal-feedback outcome-identifier="FEEDBACK" identifier="SHOW_FEEDBACK" show-hide="show" title="Hint">
					<p>Feedback body.</p>
				</qti-modal-feedback>`
			),
			role: 'candidate',
		});

		expect(String(player.getRubrics()[0].html)).toContain('Candidate rubric');
		expect(player.processResponses().modalFeedback[0]).toMatchObject({
			identifier: 'SHOW_FEEDBACK',
			outcomeIdentifier: 'FEEDBACK',
			showHide: 'show',
			title: 'Hint',
		});
		expect(String(player.processResponses().modalFeedback[0].content)).toContain('Feedback body');
	});

	test('applies extraction security after Player-level extraction', () => {
		const player = new Player({
			itemXml: qti22Item(
				`<mediaInteraction responseIdentifier="MEDIA" autostart="false">
					<audio><source src="javascript:alert(1)" type="audio/mpeg"/></audio>
				</mediaInteraction>`,
				`<responseDeclaration identifier="MEDIA" cardinality="single" baseType="integer"/>`
			),
			security: {
				urlPolicy: {
					allowHttps: true,
					allowHttp: false,
					allowDataImage: false,
					allowProtocolRelative: false,
				},
			},
		});

		const [interaction] = player.getInteractionData() as any[];

		expect(interaction.mediaElement.src).toBe('');
	});
});
