import { describe, expect, test } from 'bun:test';
import { createAssessmentItemDefinition } from '../../src/core/AssessmentItemDefinition.js';

/**
 * The three response-identifier vocabularies the player applies — extraction
 * (HTML tree, union of mapper-native/camel/kebab spellings, case-insensitive),
 * slot hiding (HTML tree, camel/kebab), and diagnostics (XML tree,
 * case-sensitive camel/kebab) — agree where they must and differ on purpose
 * where they must. This table pins the extracted, slotted/hidden and diagnosed
 * sets per fixture so the shared lookup helper cannot move any of them.
 */
interface Row {
	/** `type@responseId` of every delivered interaction mount, sorted. */
	extracted: string[];
	/** Response ids that got an interaction slot, sorted. */
	slotted: string[];
	/** `qti-hidden-interaction` wrappers in the delivered body markup. */
	hidden: number;
	/** `code` or `code@responseIdentifier` (or `code:element` without one), sorted. */
	diagnosed: string[];
	itemXml: string;
}

const QTI2_NS = `xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"`;
const QTI3_NS = `xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"`;

const rows: Array<{ name: string } & Row> = [
	{
		name: 'QTI 2: choice and endAttempt interactions extract, slot and diagnose clean',
		itemXml: `<assessmentItem ${QTI2_NS} identifier="q2" title="q2">
			<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
			<responseDeclaration identifier="HINT" cardinality="single" baseType="identifier"/>
			<itemBody>
				<p>Answer:</p>
				<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
					<simpleChoice identifier="A">A</simpleChoice>
				</choiceInteraction>
				<endAttemptInteraction responseIdentifier="HINT" title="Done" countAttempt="false"/>
			</itemBody>
		</assessmentItem>`,
		extracted: ['choiceInteraction@RESPONSE', 'endAttemptInteraction@HINT'],
		slotted: ['HINT', 'RESPONSE'],
		hidden: 0,
		diagnosed: [],
	},
	{
		name: 'QTI 3: kebab element and attribute spellings extract, slot and diagnose clean',
		itemXml: `<qti-assessment-item ${QTI3_NS} identifier="q3" title="q3">
			<qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
			<qti-response-declaration identifier="HINT" cardinality="single" base-type="identifier"/>
			<qti-item-body>
				<p>Answer:</p>
				<qti-choice-interaction response-identifier="RESPONSE" max-choices="1">
					<qti-simple-choice identifier="A">A</qti-simple-choice>
				</qti-choice-interaction>
				<qti-end-attempt-interaction response-identifier="HINT" title="Done"/>
			</qti-item-body>
		</qti-assessment-item>`,
		extracted: ['choiceInteraction@RESPONSE', 'endAttemptInteraction@HINT'],
		slotted: ['HINT', 'RESPONSE'],
		hidden: 0,
		diagnosed: [],
	},
	{
		name: 'mixed vocabulary: QTI 3 spellings in a QTI 2 item stay unextracted, hidden and diagnosed',
		itemXml: `<assessmentItem ${QTI2_NS} identifier="mx" title="mx">
			<responseDeclaration identifier="CAMEL" cardinality="single" baseType="identifier"/>
			<responseDeclaration identifier="KEBAB" cardinality="single" baseType="identifier"/>
			<itemBody>
				<qti-choice-interaction response-identifier="KEBAB" max-choices="1">
					<qti-simple-choice identifier="K">K</qti-simple-choice>
				</qti-choice-interaction>
				<choiceInteraction responseIdentifier="CAMEL" maxChoices="1">
					<simpleChoice identifier="C">C</simpleChoice>
				</choiceInteraction>
			</itemBody>
		</assessmentItem>`,
		extracted: ['choiceInteraction@CAMEL'],
		slotted: ['CAMEL'],
		hidden: 1,
		diagnosed: [
			'unknown-element:qti-choice-interaction',
			'unknown-element:qti-simple-choice',
			'unregistered-interaction@KEBAB',
		],
	},
	{
		name: 'mixed attribute spellings: kebab binds; an upper-case camel attribute renders but is diagnosed missing',
		itemXml: `<assessmentItem ${QTI2_NS} identifier="attrs" title="attrs">
			<responseDeclaration identifier="KEBAB" cardinality="single" baseType="identifier"/>
			<responseDeclaration identifier="UPPER" cardinality="single" baseType="identifier"/>
			<itemBody>
				<choiceInteraction response-identifier="KEBAB" maxChoices="1">
					<simpleChoice identifier="K">K</simpleChoice>
				</choiceInteraction>
				<choiceInteraction RESPONSEIDENTIFIER="UPPER" maxChoices="1">
					<simpleChoice identifier="U">U</simpleChoice>
				</choiceInteraction>
			</itemBody>
		</assessmentItem>`,
		extracted: ['choiceInteraction@KEBAB', 'choiceInteraction@UPPER'],
		slotted: ['KEBAB', 'UPPER'],
		hidden: 0,
		// The XML diagnostic tree reads attribute names case-sensitively, on purpose.
		diagnosed: ['missing-response-identifier:choiceInteraction'],
	},
	{
		name: 'vendor element: not extracted, left as authored markup, diagnosed unregistered',
		itemXml: `<assessmentItem ${QTI2_NS} xmlns:v="urn:vendor" identifier="vd" title="vd">
			<responseDeclaration identifier="GRAPH" cardinality="single" baseType="identifier"/>
			<itemBody>
				<v:graphInteraction responseIdentifier="GRAPH"/>
			</itemBody>
		</assessmentItem>`,
		extracted: [],
		slotted: [],
		hidden: 0,
		diagnosed: ['unregistered-interaction@GRAPH'],
	},
	{
		name: 'PCI inside customInteraction: the portable interaction is extracted and slotted once',
		itemXml: `<assessmentItem ${QTI2_NS} identifier="pci" title="pci">
			<responseDeclaration identifier="PCI" cardinality="single" baseType="identifier"/>
			<itemBody>
				<customInteraction responseIdentifier="PCI">
					<portableCustomInteraction customInteractionTypeIdentifier="urn:acme:pci-1">
						<qti-interaction-markup><div>hi</div></qti-interaction-markup>
						<qti-interaction-modules>
							<qti-interaction-module id="pci-1" primary-path="pci-1.js"/>
						</qti-interaction-modules>
					</portableCustomInteraction>
				</customInteraction>
			</itemBody>
		</assessmentItem>`,
		extracted: ['portableCustomInteraction@PCI'],
		slotted: ['PCI'],
		hidden: 0,
		diagnosed: [],
	},
	{
		name: 'unbound interaction: extracted and slotted, diagnosed as naming no responseDeclaration',
		itemXml: `<assessmentItem ${QTI2_NS} identifier="ub" title="ub">
			<responseDeclaration identifier="OTHER" cardinality="single" baseType="identifier"/>
			<itemBody>
				<choiceInteraction responseIdentifier="NOWHERE" maxChoices="1">
					<simpleChoice identifier="A">A</simpleChoice>
				</choiceInteraction>
			</itemBody>
		</assessmentItem>`,
		extracted: ['choiceInteraction@NOWHERE'],
		slotted: ['NOWHERE'],
		hidden: 0,
		diagnosed: ['unbound-interaction@NOWHERE'],
	},
	{
		name: 'interaction without a response binding: not extracted, hidden, diagnosed missing',
		itemXml: `<assessmentItem ${QTI2_NS} identifier="mi" title="mi">
			<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
			<itemBody>
				<sliderInteraction lowerBound="0" upperBound="10"/>
			</itemBody>
		</assessmentItem>`,
		extracted: [],
		slotted: [],
		hidden: 1,
		diagnosed: ['missing-response-identifier:sliderInteraction'],
	},
];

const observed = (itemXml: string) => {
	const definition = createAssessmentItemDefinition({ itemXml });
	const session = definition.openSession();
	try {
		const plan = session.present();
		const mounts = plan.flow.flatMap((node) => (node.kind === 'interaction' ? [node.mount] : []));
		const html = plan.flow.find((node) => node.kind === 'html')?.html ?? '';
		return {
			extracted: mounts
				.map((mount) => `${mount.interaction.type}@${mount.interaction.responseId}`)
				.sort(),
			slotted: mounts
				.filter((mount) => mount.slot !== null)
				.map((mount) => mount.interaction.responseId)
				.sort(),
			hidden: (html.match(/qti-hidden-interaction/g) ?? []).length,
			diagnosed: definition.diagnostics
				.map((diagnostic) =>
					diagnostic.responseIdentifier
						? `${diagnostic.code}@${diagnostic.responseIdentifier}`
						: `${diagnostic.code}${diagnostic.element ? `:${diagnostic.element}` : ''}`,
				)
				.sort(),
		};
	} finally {
		session.dispose();
	}
};

describe.each(rows)('interaction detection: $name', (row) => {
	test('extracted, slotted/hidden and diagnosed sets match the pinned policy', () => {
		expect(observed(row.itemXml)).toEqual({
			extracted: [...row.extracted].sort(),
			slotted: [...row.slotted].sort(),
			hidden: row.hidden,
			diagnosed: [...row.diagnosed].sort(),
		});
	});
});
