import { describe, expect, test } from 'bun:test';
import { Qti2xElementNameMapper } from '@pie-qti/qti-common';
import { createAssessmentItemDefinition } from '../../src/core/AssessmentItemDefinition.js';
import { Player } from '../../src/core/Player.js';
import { QtiComplianceError } from '../../src/core/compliance.js';
import type { QtiItemDiagnostic } from '../../src/core/compliance.js';
import { createExtractionRegistry } from '../../src/extraction/ExtractionRegistry.js';

const QTI22 = 'http://www.imsglobal.org/xsd/imsqti_v2p2';
const QTI30 = 'http://www.imsglobal.org/xsd/imsqtiasi_v3p0';

function captureConsole(action: () => void): { warns: string[]; errors: string[] } {
	const warns: string[] = [];
	const errors: string[] = [];
	const originalWarn = console.warn;
	const originalError = console.error;
	console.warn = (...args: unknown[]) => warns.push(args.map(String).join(' '));
	console.error = (...args: unknown[]) => errors.push(args.map(String).join(' '));
	try {
		action();
	} finally {
		console.warn = originalWarn;
		console.error = originalError;
	}
	return { warns, errors };
}

function codes(diagnostics: readonly QtiItemDiagnostic[]): string[] {
	return diagnostics.map((diagnostic) => diagnostic.code);
}

/** A well-formed 2.2 choice item. */
const CLEAN_QTI22 = `<assessmentItem xmlns="${QTI22}" identifier="clean22">
	<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
	<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"><defaultValue><value>0</value></defaultValue></outcomeDeclaration>
	<itemBody>
		<p>Choose.</p>
		<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
			<simpleChoice identifier="A">A</simpleChoice>
		</choiceInteraction>
	</itemBody>
	<responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
</assessmentItem>`;

/** The same item in QTI 3.0 form. */
const CLEAN_QTI30 = `<qti-assessment-item xmlns="${QTI30}" identifier="clean30">
	<qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
	<qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
	<qti-item-body>
		<p>Choose.</p>
		<qti-choice-interaction response-identifier="RESPONSE" max-choices="1">
			<qti-simple-choice identifier="A">A</qti-simple-choice>
		</qti-choice-interaction>
	</qti-item-body>
	<qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
</qti-assessment-item>`;

describe('QTI compliance diagnostics', () => {
	test('a clean QTI 2.2 and 3.0 item has no diagnostics, strict or not', () => {
		for (const itemXml of [CLEAN_QTI22, CLEAN_QTI30]) {
			const definition = createAssessmentItemDefinition({
				itemXml,
				strictQtiCompliance: { enabled: true, rejectUnknownExtensions: true },
			});
			expect(definition.diagnostics).toEqual([]);
		}
	});

	test('an element outside the QTI vocabulary is a strict error, and a warning otherwise', () => {
		const itemXml = CLEAN_QTI22.replace(
			'<p>Choose.</p>',
			'<p>Choose.</p><vendorWidget data-x="1"/><vendorWidget/>',
		);
		const lenient = createAssessmentItemDefinition({ itemXml });
		expect(codes(lenient.diagnostics)).toEqual(['unknown-element']);
		expect(lenient.diagnostics[0]).toMatchObject({
			severity: 'warning',
			element: 'vendorWidget',
			occurrences: 2,
		});

		let caught: unknown;
		try {
			createAssessmentItemDefinition({
				itemXml,
				strictQtiCompliance: { enabled: true, rejectUnknownExtensions: true },
			});
		} catch (error) {
			caught = error;
		}
		expect(caught).toBeInstanceOf(QtiComplianceError);
		const error = caught as QtiComplianceError;
		expect(codes(error.diagnostics)).toEqual(['unknown-element']);
		expect(error.diagnostics[0]?.severity).toBe('error');
		expect(error.message).toContain('vendorWidget');
	});

	test('a qti- prefixed element that QTI 3.0 does not define is a strict error', () => {
		const itemXml = CLEAN_QTI30.replace(
			'<p>Choose.</p>',
			'<p>Choose.</p><qti-composite-interaction/>',
		);
		expect(() =>
			createAssessmentItemDefinition({
				itemXml,
				strictQtiCompliance: { enabled: true, rejectUnknownExtensions: true },
			}),
		).toThrow(/qti-composite-interaction/);
	});

	test('an interaction responseIdentifier with no responseDeclaration is a strict error', () => {
		const itemXml = CLEAN_QTI22.replace(
			'<p>Choose.</p>',
			'<p>Choose.</p><textEntryInteraction responseIdentifier="MISSING"/>',
		);
		const definition = createAssessmentItemDefinition({ itemXml });
		expect(definition.diagnostics).toMatchObject([
			{
				code: 'unbound-interaction',
				severity: 'warning',
				responseIdentifier: 'MISSING',
				element: 'textEntryInteraction',
			},
		]);
		expect(() =>
			createAssessmentItemDefinition({
				itemXml,
				strictQtiCompliance: { enabled: true, rejectUnknownExtensions: true },
			}),
		).toThrow(QtiComplianceError);
	});

	test('a QTI interaction element with no responseIdentifier is reported', () => {
		const itemXml = CLEAN_QTI22.replace(
			'<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">',
			'<choiceInteraction maxChoices="1">',
		);
		const definition = createAssessmentItemDefinition({ itemXml });
		expect(definition.diagnostics).toMatchObject([
			{ code: 'missing-response-identifier', severity: 'warning', element: 'choiceInteraction' },
		]);
	});

	test('a response-bound element no extractor handles is reported, naming the element', () => {
		const itemXml = CLEAN_QTI22.replace(
			'<p>Choose.</p>',
			'<p>Choose.</p><mathEntryInteraction responseIdentifier="RESPONSE"/>',
		);
		const definition = createAssessmentItemDefinition({ itemXml });
		expect(definition.diagnostics).toMatchObject([
			{ code: 'unknown-element', element: 'mathEntryInteraction' },
			{
				code: 'unregistered-interaction',
				severity: 'warning',
				element: 'mathEntryInteraction',
				responseIdentifier: 'RESPONSE',
			},
		]);
		expect(definition.diagnostics[1]?.message).toContain('<mathEntryInteraction responseIdentifier="RESPONSE">');
		expect(() =>
			createAssessmentItemDefinition({
				itemXml,
				strictQtiCompliance: { enabled: true, rejectUnknownExtensions: true },
			}),
		).toThrow(/unregistered-interaction/);
	});

	test('a standard interaction missing from a custom extraction registry is reported', () => {
		const mapper = new Qti2xElementNameMapper();
		const player = new Player({
			itemXml: CLEAN_QTI22,
			elementNameMapper: mapper,
			extractionRegistry: createExtractionRegistry(mapper).seal(),
			strictQtiCompliance: { logDeviations: false },
		});
		expect(player.getDiagnostics()).toMatchObject([
			{ code: 'unregistered-interaction', element: 'choiceInteraction', responseIdentifier: 'RESPONSE' },
		]);
		// Extraction skips it, which the diagnostic now says out loud.
		expect(player.getInteractionData()).toEqual([]);
	});

	test('an unversioned item carries a version-assumed warning', () => {
		const itemXml = CLEAN_QTI22.replace(` xmlns="${QTI22}"`, '');
		const definition = createAssessmentItemDefinition({ itemXml });
		expect(codes(definition.diagnostics)).toEqual(['version-assumed']);
		expect(definition.diagnostics[0]?.severity).toBe('warning');
	});

	test('a QTI 2.0 item is warned about, and a QTI 2.1 item is only strict-flagged', () => {
		const qti20 = CLEAN_QTI22.replace(QTI22, 'http://www.imsglobal.org/xsd/imsqti_v2p0');
		expect(codes(createAssessmentItemDefinition({ itemXml: qti20 }).diagnostics)).toEqual([
			'unsupported-version',
		]);

		const qti21 = CLEAN_QTI22.replace(QTI22, 'http://www.imsglobal.org/xsd/imsqti_v2p1');
		expect(createAssessmentItemDefinition({ itemXml: qti21 }).diagnostics).toEqual([]);
		let caught: unknown;
		try {
			createAssessmentItemDefinition({
				itemXml: qti21,
				strictQtiCompliance: { enabled: true, rejectUnknownExtensions: true },
			});
		} catch (error) {
			caught = error;
		}
		expect(codes((caught as QtiComplianceError).diagnostics)).toEqual(['unsupported-version']);
	});

	test('findings are logged unless logDeviations is false', () => {
		const itemXml = CLEAN_QTI22.replace('<p>Choose.</p>', '<p>Choose.</p><vendorWidget/>');
		const logged = captureConsole(() => createAssessmentItemDefinition({ itemXml }));
		expect(logged.warns.join('\n')).toMatch(/1 QTI compliance warning/);
		expect(logged.warns.join('\n')).toContain('unknown-element');

		const silent = captureConsole(() =>
			createAssessmentItemDefinition({ itemXml, strictQtiCompliance: { logDeviations: false } }),
		);
		expect(silent.warns.join('\n')).not.toContain('unknown-element');
	});

	test('session diagnostics come from the definition, and a Player reports them through getDiagnostics()', () => {
		const itemXml = CLEAN_QTI22.replace('<p>Choose.</p>', '<p>Choose.</p><vendorWidget/>');
		const definition = createAssessmentItemDefinition({ itemXml });
		const session = definition.openSession();
		expect(session.state().disposed).toBe(false);
		session.dispose();

		expect(new Player({ itemXml }).getDiagnostics()).toHaveLength(1);
		expect(new Player({ itemXml: CLEAN_QTI22 }).getDiagnostics()).toEqual([]);
	});

	test('without strict mode a 3.0 item with an unregistered interaction still opens sessions', () => {
		const itemXml = CLEAN_QTI30.replace(
			'<p>Choose.</p>',
			'<p>Choose.</p><qti-math-entry-interaction response-identifier="RESPONSE"/>',
		);
		const definition = createAssessmentItemDefinition({ itemXml });
		expect(codes(definition.diagnostics)).toEqual(['unknown-element', 'unregistered-interaction']);
		expect(definition.diagnostics[1]?.message).toContain(
			'<qti-math-entry-interaction response-identifier="RESPONSE">',
		);
		const session = definition.openSession();
		expect(session.state().disposed).toBe(false);
		session.dispose();
	});
});
