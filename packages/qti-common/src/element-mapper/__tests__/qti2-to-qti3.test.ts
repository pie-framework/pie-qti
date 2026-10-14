import { describe, expect, it } from 'bun:test';
import {
	convertQti2ToQti3,
	QTI3_NAMESPACE,
	qti3AttributeName,
	qti3ElementName,
	qti3TemplateUri,
} from '../qti2-to-qti3.js';

const item = (body: string, extra = '') =>
	'<?xml version="1.0" encoding="UTF-8"?>\n' +
	'<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" ' +
	'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
	'xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p2 http://www.imsglobal.org/xsd/qti/qtiv2p2/imsqti_v2p2p2.xsd" ' +
	`identifier="i" title="T" adaptive="false" timeDependent="false">${extra}<itemBody>${body}</itemBody></assessmentItem>`;

describe('convertQti2ToQti3', () => {
	it('renames the root, namespace, schema location and camelCase attributes', () => {
		const xml = convertQti2ToQti3(item('<choiceInteraction responseIdentifier="R" maxChoices="1"/>'));
		expect(xml).toContain(`<qti-assessment-item xmlns="${QTI3_NAMESPACE}"`);
		expect(xml).toContain(
			`xsi:schemaLocation="${QTI3_NAMESPACE} https://purl.imsglobal.org/spec/qti/v3p0/schema/xsd/imsqti_asiv3p0_v1p0.xsd"`,
		);
		expect(xml).toContain('time-dependent="false"');
		expect(xml).toContain('<qti-choice-interaction response-identifier="R" max-choices="1"/>');
		expect(xml).toEndWith('</qti-item-body></qti-assessment-item>');
	});

	it('keeps HTML element names, data and aria attributes, text and entities', () => {
		const body = '<p class="x" data-catalogIdref="c" aria-hidden="true">a &amp; b<br/><label>L</label></p>';
		expect(convertQti2ToQti3(item(body))).toContain(`<qti-item-body>${body}</qti-item-body>`);
	});

	it('passes MathML, SVG and other namespaces through untouched', () => {
		const math = '<math xmlns="http://www.w3.org/1998/Math/MathML"><apply><and/><max/><sum/></apply></math>';
		const svg = '<svg viewBox="0 0 1 1"><rect fillOpacity="1"/></svg>';
		const prefixed = '<ssml:sub alias="x" xmlns:ssml="http://www.w3.org/2001/10/synthesis">X</ssml:sub>';
		const xml = convertQti2ToQti3(item(`<div>${math}${svg}${prefixed}</div>`));
		expect(xml).toContain(`<div>${math}${svg}${prefixed}</div>`);
	});

	it('converts QTI elements after a foreign subtree closes', () => {
		const xml = convertQti2ToQti3(
			item('<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>x</mi></math><textEntryInteraction responseIdentifier="R"/>'),
		);
		expect(xml).toContain('</math><qti-text-entry-interaction response-identifier="R"/>');
	});

	it('keeps comments, CDATA and processing instructions verbatim', () => {
		const body = '<!-- <choiceInteraction> --><p><![CDATA[<itemBody>]]></p><?pi x?>';
		expect(convertQti2ToQti3(item(body))).toContain(body);
	});

	it('wraps rubric block content in qti-content-body after its stylesheets and defaults use', () => {
		const xml = convertQti2ToQti3(
			item('<rubricBlock view="scorer">\n<stylesheet href="r.css" type="text/css"/>\n<p>Full</p>\n</rubricBlock>'),
		);
		expect(xml).toContain(
			'<qti-rubric-block view="scorer" use="scoring">\n<qti-stylesheet href="r.css" type="text/css"/>\n<qti-content-body><p>Full</p>\n</qti-content-body></qti-rubric-block>',
		);
		expect(convertQti2ToQti3(item('<rubricBlock view="candidate" use="navigation"></rubricBlock>'))).toContain(
			'<qti-rubric-block view="candidate" use="navigation"><qti-content-body/></qti-rubric-block>',
		);
		expect(convertQti2ToQti3(item('<rubricBlock view="tutor candidate"/>'))).toContain(
			'<qti-rubric-block view="tutor candidate" use="instructions"><qti-content-body/></qti-rubric-block>',
		);
	});

	it('maps response processing templates to their QTI 3.0 URIs', () => {
		const xml = convertQti2ToQti3(
			item('', '<responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/map_response"/>'),
		);
		expect(xml).toContain(
			'<qti-response-processing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/map_response.xml"/>',
		);
	});

	it('converts tests and stimuli', () => {
		const test =
			'<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1" identifier="t" title="T">' +
			'<testPart identifier="p" navigationMode="linear" submissionMode="individual">' +
			'<assessmentSection identifier="s" title="S" visible="true"><assessmentItemRef identifier="i" href="i.xml"/>' +
			'</assessmentSection></testPart></assessmentTest>';
		expect(convertQti2ToQti3(test)).toBe(
			`<qti-assessment-test xmlns="${QTI3_NAMESPACE}" identifier="t" title="T">` +
				'<qti-test-part identifier="p" navigation-mode="linear" submission-mode="individual">' +
				'<qti-assessment-section identifier="s" title="S" visible="true"><qti-assessment-item-ref identifier="i" href="i.xml"/>' +
				'</qti-assessment-section></qti-test-part></qti-assessment-test>',
		);
		expect(
			convertQti2ToQti3(
				'<assessmentStimulus xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="s" title="S"><stimulusBody><p>x</p></stimulusBody></assessmentStimulus>',
			),
		).toBe(
			`<qti-assessment-stimulus xmlns="${QTI3_NAMESPACE}" identifier="s" title="S"><qti-stimulus-body><p>x</p></qti-stimulus-body></qti-assessment-stimulus>`,
		);
	});

	it('rejects unbalanced markup', () => {
		expect(() => convertQti2ToQti3('<assessmentItem><itemBody></assessmentItem>')).toThrow();
		expect(() => convertQti2ToQti3('<assessmentItem>')).toThrow();
	});
});

describe('QTI 3.0 names', () => {
	it('names elements, attributes and templates', () => {
		expect(qti3ElementName('durationGTE')).toBe('qti-duration-gte');
		expect(qti3ElementName('assessmentStimulusRef')).toBe('qti-assessment-stimulus-ref');
		expect(qti3ElementName('label')).toBe('label');
		expect(qti3ElementName('video')).toBe('video');
		expect(qti3AttributeName('responseIdentifier')).toBe('response-identifier');
		expect(qti3AttributeName('mimeType')).toBe('mime-type');
		expect(qti3AttributeName('xml:lang')).toBe('xml:lang');
		expect(qti3TemplateUri('http://www.imsglobal.org/question/qti_v2p1/rptemplates/match_correct.xml')).toBe(
			'https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct.xml',
		);
		expect(qti3TemplateUri('custom.xml')).toBe('custom.xml');
	});
});
