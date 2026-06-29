import { describe, expect, test } from 'bun:test';
import { buildPackageFileIndex } from '../src/package-file-resolver.js';
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
			readText: (path) => {
				if (path === 'items/stimuli/passage.xml') return stimulusXml;
				if (path === 'items/unit/item.css') return '.item-term { font-weight: bold; }';
				if (path === 'items/stimuli/passage.css') return '.stimulus-term { color: blue; }';
				return null;
			},
			resolveAssetUrl: (path) => `asset://${path}`,
		});

		expect(context.stimuli.passage_1.resolvedHref).toBe('items/stimuli/passage.xml');
		expect(context.stimuli.passage_1.bodyHtml).toContain('asset://items/stimuli/images/river.png');
		expect(context.stylesheets.map((style) => style.resolvedHref)).toEqual([
			'items/unit/item.css',
			'items/stimuli/passage.css',
		]);
		expect(context.stylesheets.map((style) => style.cssText)).toEqual([
			'.item-term { font-weight: bold; }',
			'.stimulus-term { color: blue; }',
		]);
		expect(context.catalogSources.map((source) => source.scope)).toEqual(['item', 'stimulus']);
		expect(context.validationMessages).toEqual([]);
	});

	test('uses package file resolver evidence for stimuli, stylesheets, catalog files, and stimulus media', () => {
		const itemXml = `<qti-assessment-item identifier="item-1">
  <qti-stylesheet href="styles/theme.css"/>
  <qti-assessment-stimulus-ref identifier="passage_1" href="shared/passage.xml"/>
  <qti-item-body><p>Question body.</p></qti-item-body>
  <qti-catalog-info>
    <qti-card identifier="term_1">
      <qti-card-entry usage="illustrated-glossary">
        <qti-file-href src="icons/term.png"/>
      </qti-card-entry>
    </qti-card>
  </qti-catalog-info>
</qti-assessment-item>`;
		const stimulusXml = `<qti-assessment-stimulus identifier="passage_1">
  <qti-stimulus-body>
    <p><img src="graphics/diagram.png" alt="Diagram"/> Shared passage.</p>
  </qti-stimulus-body>
</qti-assessment-stimulus>`;
		const fileIndex = buildPackageFileIndex([
			'content/items/item.xml',
			'content/shared/passage.xml',
			'shared/styles/theme.css',
			'assets/graphics/diagram.png',
			'shared/icons/term.png',
		]);

		const context = createResolvedItemDeliveryContext({
			itemXml,
			itemHref: 'content/items/item.xml',
			fileIndex,
			manifestEvidencePaths: new Set(['content/shared/passage.xml']),
			readText: (path) => {
				if (path === 'content/shared/passage.xml') return stimulusXml;
				if (path === 'shared/styles/theme.css') return '.stem { color: red; }';
				return null;
			},
			resolveAssetUrl: (path) => `asset://${path}`,
		});

		expect(context.stimuli.passage_1.resolvedHref).toBe('content/shared/passage.xml');
		expect(context.stylesheets[0].resolvedHref).toBe('shared/styles/theme.css');
		expect(context.stylesheets[0].cssText).toBe('.stem { color: red; }');
		expect(context.stimuli.passage_1.bodyHtml).toContain('asset://assets/graphics/diagram.png');
		expect(context.catalogSources[0].xml).toContain('src="shared/icons/term.png"');
		expect(context.validationMessages).toEqual([]);
	});

	test('blocks unsafe stylesheet CSS text while preserving safe stylesheet metadata', () => {
		const itemXml = `<qti-assessment-item identifier="item-1">
  <qti-stylesheet href="safe.css"/>
  <qti-stylesheet href="unsafe.css"/>
  <qti-stylesheet href="comment-bypass.css"/>
  <qti-stylesheet href="escaped-bypass.css"/>
  <qti-stylesheet href="image-set-bypass.css"/>
  <qti-item-body><p>Question body.</p></qti-item-body>
</qti-assessment-item>`;

		const context = createResolvedItemDeliveryContext({
			itemXml,
			itemHref: 'items/unit/item.xml',
			readText: (path) => {
				if (path === 'items/unit/safe.css') return '.term { color: #123456; }';
				if (path === 'items/unit/unsafe.css') return '@import "https://evil.example/unsafe.css"; .term { color: red; }';
				if (path === 'items/unit/comment-bypass.css') return '.term { background-image: u/**/rl("https://evil.example/a.png"); }';
				if (path === 'items/unit/escaped-bypass.css') return '.term { background-image: \\75 rl("https://evil.example/a.png"); }';
				if (path === 'items/unit/image-set-bypass.css') return '.term { background-image: image-set("https://evil.example/a.png" 1x); }';
				return null;
			},
		});

		expect(context.stylesheets.map((style) => style.resolvedHref)).toEqual([
			'items/unit/safe.css',
			'items/unit/unsafe.css',
			'items/unit/comment-bypass.css',
			'items/unit/escaped-bypass.css',
			'items/unit/image-set-bypass.css',
		]);
		expect(context.stylesheets[0].cssText).toBe('.term { color: #123456; }');
		expect(context.stylesheets[1].cssText).toBeUndefined();
		expect(context.stylesheets[2].cssText).toBeUndefined();
		expect(context.stylesheets[3].cssText).toBeUndefined();
		expect(context.stylesheets[4].cssText).toBeUndefined();
		expect(context.validationMessages.join(' ')).toContain('Stylesheet blocked by policy: items/unit/unsafe.css');
		expect(context.validationMessages.join(' ')).toContain('Stylesheet blocked by policy: items/unit/comment-bypass.css');
		expect(context.validationMessages.join(' ')).toContain('Stylesheet blocked by policy: items/unit/escaped-bypass.css');
		expect(context.validationMessages.join(' ')).toContain('Stylesheet blocked by policy: items/unit/image-set-bypass.css');
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
		expect(context.stimuli.passage_1.bodyHtml).toContain('https://evil.example/video.mp4');
		expect(context.stimuli.passage_1.bodyHtml).not.toContain('/poster.png');
		expect(context.stimuli.passage_1.bodyHtml).toContain(
			'srcset="asset://items/stimuli/images/river-small.png 1x, https://evil.example/river.png 2x"'
		);
		expect(context.catalogSources[0].xml).not.toContain('private.png');
		expect(context.catalogSources[0].xml).not.toContain('/private-audio.mp3');
		expect(context.catalogSources[0].xml).not.toContain('private-audio');
	});

	test('preserves external catalog file refs for player URL policy', () => {
		const itemXml = `<qti-assessment-item identifier="item-1">
  <qti-item-body><p>Question body.</p></qti-item-body>
  <qti-catalog-info>
    <qti-card identifier="term_1">
      <qti-card-entry usage="illustrated-glossary">
        <qti-file-href src="https://cdn.example/card.png"/>
      </qti-card-entry>
    </qti-card>
  </qti-catalog-info>
</qti-assessment-item>`;

		const context = createResolvedItemDeliveryContext({
			itemXml,
			itemHref: 'items/unit/item.xml',
			readText: () => null,
		});

		expect(context.catalogSources[0].xml).toContain('https://cdn.example/card.png');
		expect(context.validationMessages).toEqual([]);
	});
});
