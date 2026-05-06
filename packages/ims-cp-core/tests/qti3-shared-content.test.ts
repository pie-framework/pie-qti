import { describe, expect, test } from 'bun:test';
import {
	createResolvedItemDeliveryContext,
	extractAssessmentStimulusRefs,
	extractCatalogInfoXml,
	extractQtiStylesheets,
	extractStimulusBodyHtml,
	parseAssessmentStimulusXml,
	resolveRelativePath,
} from '../src/qti3-shared-content.js';

describe('QTI 3 shared content parsing', () => {
	test('extracts qti-assessment-stimulus-ref values with QTI 3 attributes', () => {
		const itemXml = `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="item-1">
  <qti-assessment-stimulus-ref identifier="passage_1" href="../stimuli/passage.xml" title="River passage"/>
  <qti-item-body>
    <p>Question body.</p>
  </qti-item-body>
</qti-assessment-item>`;

		expect(extractAssessmentStimulusRefs(itemXml)).toEqual([
			{
				identifier: 'passage_1',
				href: '../stimuli/passage.xml',
				title: 'River passage',
			},
		]);
	});

	test('parses stimulus body, stylesheet, catalog info, and language', () => {
		const stimulusXml = `<qti-assessment-stimulus xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="passage_1" title="River passage" xml:lang="en-US">
  <qti-stylesheet href="passage.css" type="text/css"/>
  <qti-stimulus-body>
    <p data-catalog-idref="term_delta">A river delta forms where sediment gathers.</p>
  </qti-stimulus-body>
  <qti-catalog-info>
    <qti-card support="glossary" id="term_delta"/>
  </qti-catalog-info>
</qti-assessment-stimulus>`;

		const parsed = parseAssessmentStimulusXml(stimulusXml);

		expect(parsed.identifier).toBe('passage_1');
		expect(parsed.title).toBe('River passage');
		expect(parsed.lang).toBe('en-US');
		expect(parsed.bodyHtml).toContain('river delta');
		expect(parsed.stylesheets[0].href).toBe('passage.css');
		expect(parsed.catalogInfoXml).toContain('qti-catalog-info');
		expect(parsed.validationMessages).toEqual([]);
	});

	test('reports invalid stimulus child order', () => {
		const stimulusXml = `<qti-assessment-stimulus identifier="passage_1">
  <qti-catalog-info/>
  <qti-stimulus-body><p>Body</p></qti-stimulus-body>
  <qti-stylesheet href="late.css"/>
</qti-assessment-stimulus>`;

		const parsed = parseAssessmentStimulusXml(stimulusXml);
		expect(parsed.validationMessages.length).toBeGreaterThan(0);
		expect(parsed.validationMessages.join(' ')).toContain('qti-stimulus-body must precede qti-catalog-info');
		expect(parsed.validationMessages.join(' ')).toContain('qti-stylesheet must precede');
	});

	test('extract helper functions expose stimulus body, stylesheets, and catalog info', () => {
		const stimulusXml = `<qti-assessment-stimulus identifier="passage_1">
  <qti-stylesheet href="passage.css"/>
  <qti-stimulus-body><p>Shared passage body</p></qti-stimulus-body>
  <qti-catalog-info><qti-card support="glossary" id="term_1"/></qti-catalog-info>
</qti-assessment-stimulus>`;

		expect(extractStimulusBodyHtml(stimulusXml)).toContain('Shared passage body');
		expect(extractQtiStylesheets(stimulusXml)[0].href).toBe('passage.css');
		expect(extractCatalogInfoXml(stimulusXml)[0]).toContain('qti-card');
	});

	test('resolves package-relative stimulus paths', () => {
		expect(resolveRelativePath('items/grade4/item.xml', '../stimuli/passage.xml')).toBe('items/stimuli/passage.xml');
		expect(resolveRelativePath('items/unit/item.xml', '../../shared/passage.xml')).toBe('shared/passage.xml');
	});

	test('keeps exported relative path resolution non-throwing for legacy callers', () => {
		expect(resolveRelativePath('items/unit/item.xml', '../../../outside.xml')).toBe('outside.xml');
	});

	test('creates a resolved item delivery context without package traversal', () => {
		// Clean-room fixture authored for this repository: exercises QTI 3 shared
		// stimulus/package-relative resolution without official conformance assets.
		const itemXml = `<qti-assessment-item identifier="item-1">
  <qti-stylesheet href="item.css"/>
  <qti-assessment-stimulus-ref identifier="passage_1" href="../stimuli/passage.xml" title="River passage"/>
  <qti-item-body>
    <p>Question body.</p>
  </qti-item-body>
  <qti-catalog-info>
    <qti-card identifier="term_delta" support="glossary-on-screen">
      <qti-html-content>Item-local definition</qti-html-content>
    </qti-card>
  </qti-catalog-info>
</qti-assessment-item>`;
		const stimulusXml = `<qti-assessment-stimulus identifier="passage_1" xml:lang="en-US">
  <qti-stylesheet href="passage.css"/>
  <qti-stimulus-body>
    <p><img src="images/river.png" alt="River"/> Shared passage body.</p>
  </qti-stimulus-body>
  <qti-catalog-info>
    <qti-card identifier="term_sediment" support="glossary-on-screen">
      <qti-html-content>Small pieces of earth carried by water.</qti-html-content>
    </qti-card>
  </qti-catalog-info>
</qti-assessment-stimulus>`;

		const context = createResolvedItemDeliveryContext({
			itemXml,
			itemHref: 'items/unit/item.xml',
			readText: (path) => (path === 'items/stimuli/passage.xml' ? stimulusXml : null),
			resolveAssetUrl: (path) => `asset://${path}`,
		});

		expect(context.stimuli.passage_1.resolvedHref).toBe('items/stimuli/passage.xml');
		expect(context.stimuli.passage_1.bodyHtml).toContain('asset://items/stimuli/images/river.png');
		expect(context.stylesheets.map((style) => style.resolvedHref)).toEqual([
			'items/unit/item.css',
			'items/stimuli/passage.css',
		]);
		expect(context.catalogSources.map((source) => source.scope)).toEqual(['item', 'stimulus']);
		expect(context.validationMessages).toEqual([]);
	});

	test('blocks unsafe stimulus and stylesheet package references', () => {
		const itemXml = `<qti-assessment-item identifier="item-1">
  <qti-stylesheet href="javascript:alert"/>
  <qti-stylesheet href="../../../outside.css"/>
  <qti-assessment-stimulus-ref identifier="remote" href="https://example.test/passage.xml"/>
  <qti-assessment-stimulus-ref identifier="escape" href="../../../outside.xml"/>
  <qti-item-body>
    <p>Question body.</p>
  </qti-item-body>
</qti-assessment-item>`;

		const context = createResolvedItemDeliveryContext({
			itemXml,
			itemHref: 'items/unit/item.xml',
			readText: () => null,
		});

		expect(context.stylesheets).toEqual([]);
		expect(context.stimuli).toEqual({});
		expect(context.validationMessages.join(' ')).toContain('Item stylesheet href is not a package-relative path');
		expect(context.validationMessages.join(' ')).toContain('Item stylesheet href escapes the package root');
		expect(context.validationMessages.join(' ')).toContain('Stimulus remote href is not a package-relative path');
		expect(context.validationMessages.join(' ')).toContain('Stimulus escape href escapes the package root');
	});

	test('removes unsafe relative asset and catalog file references during context resolution', () => {
		const itemXml = `<qti-assessment-item identifier="item-1">
  <qti-assessment-stimulus-ref identifier="passage_1" href="../stimuli/passage.xml"/>
  <qti-item-body>
    <p>Question body.</p>
  </qti-item-body>
  <qti-catalog-info>
    <qti-card identifier="term_1">
      <qti-card-entry usage="illustrated-glossary">
        <qti-file-href src="../../../private.png"/>
      </qti-card-entry>
      <qti-card-entry usage="audio-description">
        <qti-file-href>/private-audio.mp3</qti-file-href>
      </qti-card-entry>
    </qti-card>
  </qti-catalog-info>
</qti-assessment-item>`;
		const stimulusXml = `<qti-assessment-stimulus identifier="passage_1">
  <qti-stimulus-body>
    <p>
      <img src="../../../private.png" srcset="images/river-small.png 1x, https://evil.example/river.png 2x"/>
      <video poster="/poster.png"><source src="https://evil.example/video.mp4"/></video>
      Shared passage.
    </p>
  </qti-stimulus-body>
</qti-assessment-stimulus>`;

		const context = createResolvedItemDeliveryContext({
			itemXml,
			itemHref: 'items/unit/item.xml',
			readText: (path) => (path === 'items/stimuli/passage.xml' ? stimulusXml : null),
			resolveAssetUrl: (path) => `asset://${path}`,
		});

		expect(context.stimuli.passage_1.bodyHtml).not.toContain('private.png');
		expect(context.stimuli.passage_1.bodyHtml).not.toContain('evil.example');
		expect(context.stimuli.passage_1.bodyHtml).not.toContain('/poster.png');
		expect(context.stimuli.passage_1.bodyHtml).not.toContain('srcset=');
		expect(context.catalogSources[0].xml).not.toContain('private.png');
		expect(context.catalogSources[0].xml).not.toContain('/private-audio.mp3');
		expect(context.catalogSources[0].xml).not.toContain('private-audio');
	});
});
