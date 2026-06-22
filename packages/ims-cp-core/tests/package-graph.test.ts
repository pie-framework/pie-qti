import { describe, expect, test } from 'bun:test';
import { STRICT_QTI_CONFIG } from '../src/qti-heuristics';
import { analyzeContentPackage, serializeContentPackageEvidence } from '../src/package-graph';

const manifestXml = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="pkg1" xmlns="http://www.imsglobal.org/xsd/imscp_v1p1">
  <resources>
    <resource identifier="test1" type="imsqti_test_xmlv2p1" href="tests/test.xml">
      <file href="tests/test.xml"/>
      <dependency identifierref="item1"/>
      <dependency identifierref="missing"/>
    </resource>
    <resource identifier="item1" type="imsqti_item_xmlv2p1" href="items/item.xml">
      <file href="items/item.xml"/>
      <file href="items/images/chart.png"/>
      <dependency identifierref="passage1"/>
    </resource>
    <resource identifier="item2" type="imsqti_item_xmlv2p1" href="items/item2.xml">
      <file href="items/item2.xml"/>
      <file href="items/images/chart.png"/>
      <file href="items/audio/missing.mp3"/>
    </resource>
    <resource identifier="passage1" type="webcontent" href="passages/passage.html">
      <file href="passages/passage.html"/>
    </resource>
  </resources>
</manifest>`;

describe('analyzeContentPackage', () => {
	test('builds resource closures and package asset references', async () => {
		const analyzed = await analyzeContentPackage({
			manifestXml,
			fileAccess: {
				readText(path) {
					if (path === 'tests/test.xml') {
						return `<assessmentTest>
              <testPart>
                <assessmentSection>
                  <assessmentItemRef identifier="item-ref-2" href="../items/item2.xml"/>
                </assessmentSection>
              </testPart>
            </assessmentTest>`;
					}
					if (path === 'items/item.xml') {
						return `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1">
              <itemBody>
                <p><img src="images/chart.png"/></p>
                <stylesheet href="../styles/item.css" type="text/css"/>
              </itemBody>
            </assessmentItem>`;
					}
					if (path === 'items/item2.xml') {
						return `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1">
              <itemBody>
                <p><img src="images/chart.png"/></p>
                <p><img src="images/missing.png"/></p>
              </itemBody>
            </assessmentItem>`;
					}
					return null;
				},
				listFiles() {
					return [
						'tests/test.xml',
						'items/item.xml',
						'items/item2.xml',
						'items/images/chart.png',
						'styles/item.css',
						'passages/passage.html',
					];
				},
			},
		});

		expect(analyzed.packageId).toBe('pkg1');
		expect(analyzed.entrypoints.map((entrypoint) => entrypoint.resourceId)).toEqual([
			'test1',
			'item1',
			'item2',
			'passage1',
		]);
		expect(analyzed.diagnostics.some((diagnostic) => diagnostic.code === 'IMS_CP_DANGLING_DEPENDENCY')).toBe(true);
		expect(analyzed.diagnostics.some((diagnostic) => diagnostic.code === 'IMS_CP_MISSING_FILE')).toBe(true);
		expect(analyzed.diagnostics.some((diagnostic) => diagnostic.code === 'IMS_CP_MISSING_ASSET')).toBe(true);
		expect(analyzed.qtiVersion.version).toBe('2.1');
		expect(analyzed.qtiVersion.confidence).toBe('high');
		expect(analyzed.qtiVersion.signals.some((signal) => signal.source === 'manifest')).toBe(true);
		expect(analyzed.qtiVersion.signals.some((signal) => signal.source === 'qti_xml')).toBe(true);
		expect(analyzed.assets.has('items/images/chart.png')).toBe(true);
		expect(analyzed.assets.has('styles/item.css')).toBe(true);
		expect(analyzed.assets.get('items/images/chart.png')?.ownerResourceIds).toEqual(['item1', 'item2']);

		const closure = analyzed.closures.get('test1');
		expect(closure?.resourceIds).toEqual(['test1', 'item1', 'passage1', 'item2']);
		expect(closure?.filePaths).toContain('items/images/chart.png');
		expect(closure?.assetPaths).toContain('items/images/chart.png');

		const evidence = serializeContentPackageEvidence(analyzed);
		expect(JSON.stringify(evidence)).toBe(JSON.stringify(serializeContentPackageEvidence(analyzed)));
		expect(evidence.resources.map((resource) => resource.identifier)).toEqual([
			'item1',
			'item2',
			'passage1',
			'test1',
		]);
		expect(
			evidence.relationshipHints.some(
				(hint) =>
					hint.kind === 'manifest-dependency' &&
					hint.sourceResourceId === 'item1' &&
					hint.targetResourceId === 'passage1'
			)
		).toBe(true);
		expect(
			evidence.relationshipHints.some(
				(hint) =>
					hint.kind === 'assessment-item-ref' &&
					hint.sourceResourceId === 'test1' &&
					hint.targetResourceId === 'item2' &&
					hint.rawHref === '../items/item2.xml'
			)
		).toBe(true);
		expect(
			evidence.relationshipHints.some(
				(hint) =>
					hint.kind === 'shared-asset' &&
					hint.targetPath === 'items/images/chart.png' &&
					hint.sourceResourceIds?.join(',') === 'item1,item2'
			)
		).toBe(true);
	});

	test('treats an empty file listing as authoritative', async () => {
		const analyzed = await analyzeContentPackage({
			manifestXml,
			fileAccess: {
				readText() {
					return null;
				},
				listFiles() {
					return [];
				},
			},
		});

		expect(analyzed.diagnostics.some((diagnostic) => diagnostic.code === 'IMS_CP_MISSING_FILE')).toBe(true);
		expect(analyzed.diagnostics.some((diagnostic) => diagnostic.code === 'IMS_CP_MISSING_ASSET')).toBe(false);
	});

	test('rejects unsafe manifest href and file paths before reads and indexing', async () => {
		const readPaths: string[] = [];
		const analyzed = await analyzeContentPackage({
			manifestXml: `
        <manifest identifier="unsafe-manifest" xml:base="%252e%252e">
          <resources>
            <resource identifier="unsafe-item" type="imsqti_item_xmlv3p0" href="../../../secret.xml">
              <file href="%252e%252e/secret.css"/>
              <file href="items/item.xml"/>
            </resource>
          </resources>
        </manifest>`,
			fileAccess: {
				readText(path) {
					readPaths.push(path);
					return null;
				},
				listFiles() {
					return ['secret.xml', 'secret.css'];
				},
			},
		});

		const resource = analyzed.resources.get('unsafe-item');
		expect(resource?.resolvedHref).toBeUndefined();
		expect(resource?.resolvedFiles).toEqual([]);
		expect(readPaths).toEqual([]);
		expect(analyzed.assets.has('items/item.xml')).toBe(false);
		expect(analyzed.assets.has('secret.css')).toBe(false);
		expect(analyzed.diagnostics.map((diagnostic) => diagnostic.code)).toContain('IMS_CP_UNSAFE_MANIFEST_PATH');
		expect(analyzed.diagnostics.map((diagnostic) => diagnostic.reference)).toContain('%252e%252e');
	});

	test('preserves unknown QTI version as a package diagnostic', async () => {
		const analyzed = await analyzeContentPackage({
			manifestXml: `
        <manifest identifier="unknown">
          <resources>
            <resource identifier="resource1" type="webcontent" href="content.html">
              <file href="content.html"/>
            </resource>
          </resources>
        </manifest>`,
			fileAccess: {
				readText() {
					return null;
				},
			},
		});

		expect(analyzed.qtiVersion.version).toBe('unknown');
		expect(analyzed.qtiVersion.confidence).toBe('none');
		expect(analyzed.diagnostics.some((diagnostic) => diagnostic.code === 'QTI_VERSION_UNKNOWN')).toBe(true);
	});

	test('detects QTI 3.0 from readable package XML', async () => {
		const analyzed = await analyzeContentPackage({
			manifestXml: `
        <manifest identifier="qti3">
          <resources>
            <resource identifier="item1" type="imsqti_item_xmlv3p0" href="item.xml">
              <file href="item.xml"/>
            </resource>
          </resources>
        </manifest>`,
			fileAccess: {
				readText(path) {
					return path === 'item.xml'
						? `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="item1"/>`
						: null;
				},
			},
		});

		expect(analyzed.qtiVersion.version).toBe('3.0');
		expect(analyzed.qtiVersion.confidence).toBe('high');
		expect(analyzed.qtiVersion.signals.some((signal) => signal.source === 'qti_xml')).toBe(true);
	});

	test('reports conflicting manifest and item XML version signals', async () => {
		const analyzed = await analyzeContentPackage({
			manifestXml: `
        <manifest identifier="conflicting">
          <resources>
            <resource identifier="item1" type="imsqti_item_xmlv2p1" href="item.xml">
              <file href="item.xml"/>
            </resource>
          </resources>
        </manifest>`,
			fileAccess: {
				readText(path) {
					return path === 'item.xml'
						? `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="item1"/>`
						: null;
				},
			},
		});

		expect(analyzed.qtiVersion.version).toBe('conflicting');
		expect(analyzed.qtiVersion.confidence).toBe('conflicting');
		expect([...new Set(analyzed.qtiVersion.signals.map((signal) => signal.version))].sort()).toEqual([
			'2.1',
			'2.2',
		]);
		expect(analyzed.diagnostics.some((diagnostic) => diagnostic.code === 'QTI_VERSION_CONFLICT')).toBe(true);
	});

	test('resolves QTI 3 media and stylesheet refs with package path provenance', async () => {
		const analyzed = await analyzeContentPackage({
			manifestXml: `
        <manifest identifier="qti3-assets">
          <resources>
            <resource identifier="item1" type="imsqti_item_xmlv3p0" href="content/items/item.xml">
              <file href="content/items/item.xml"/>
              <file href="shared/graphics/diagram.png"/>
              <file href="content/styles/theme.css"/>
            </resource>
          </resources>
        </manifest>`,
			fileAccess: {
				readText(path) {
					if (path === 'content/items/item.xml') {
						return `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="item1">
              <qti-item-body>
                <img src="graphics/diagram.png"/>
                <qti-stylesheet href="../styles/theme.css"/>
              </qti-item-body>
            </qti-assessment-item>`;
					}
					if (path === 'content/styles/theme.css') return '.stem { color: red; }';
					return null;
				},
				listFiles() {
					return [
						'content/items/item.xml',
						'shared/graphics/diagram.png',
						'content/styles/theme.css',
					];
				},
			},
		});

		const references = analyzed.references.get('item1') ?? [];
		expect(analyzed.assets.has('shared/graphics/diagram.png')).toBe(true);
		expect(analyzed.assets.has('content/styles/theme.css')).toBe(true);
		expect(references.find((reference) => reference.rawHref === 'graphics/diagram.png')).toMatchObject({
			resolvedPath: 'shared/graphics/diagram.png',
			resolutionStrategy: 'unique-suffix',
			heuristic: true,
		});
		expect(references.find((reference) => reference.rawHref === '../styles/theme.css')).toMatchObject({
			kind: 'stylesheet',
			resolvedPath: 'content/styles/theme.css',
			resolutionStrategy: 'source-relative',
			heuristic: false,
		});
	});

	test('discovers QTI 3 catalog file href references as catalog assets', async () => {
		const analyzed = await analyzeContentPackage({
			manifestXml: `
        <manifest identifier="catalog-assets">
          <resources>
            <resource identifier="item1" type="imsqti_item_xmlv3p0" href="content/items/item.xml">
              <file href="content/items/item.xml"/>
              <file href="content/items/catalog/card.xml"/>
              <file href="content/items/catalog/text.xml"/>
            </resource>
          </resources>
        </manifest>`,
			fileAccess: {
				readText(path) {
					if (path === 'content/items/item.xml') {
						return `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="item1">
              <qti-catalog-info>
                <qti-file-href src="catalog/card.xml"/>
                <qti-file-href>catalog/text.xml</qti-file-href>
              </qti-catalog-info>
            </qti-assessment-item>`;
					}
					return null;
				},
				listFiles() {
					return ['content/items/item.xml', 'content/items/catalog/card.xml', 'content/items/catalog/text.xml'];
				},
			},
		});

		const references = analyzed.references.get('item1') ?? [];
		expect(references.find((reference) => reference.rawHref === 'catalog/card.xml')).toMatchObject({
			kind: 'catalog',
			resolvedPath: 'content/items/catalog/card.xml',
			sourceElement: 'qti-file-href',
			sourceAttribute: 'src',
		});
		expect(references.find((reference) => reference.rawHref === 'catalog/text.xml')).toMatchObject({
			kind: 'catalog',
			resolvedPath: 'content/items/catalog/text.xml',
			sourceElement: 'qti-file-href',
			sourceAttribute: 'text',
		});
		expect(analyzed.assets.get('content/items/catalog/card.xml')?.usage).toBe('catalog');
		expect(analyzed.assets.get('content/items/catalog/text.xml')?.usage).toBe('catalog');
	});

	test('treats QTI 3 stimulus refs as package resource edges', async () => {
		const analyzed = await analyzeContentPackage({
			manifestXml: `
        <manifest identifier="stimulus-edges">
          <resources>
            <resource identifier="item1" type="imsqti_item_xmlv3p0" href="items/item.xml">
              <file href="items/item.xml"/>
            </resource>
            <resource identifier="stimulus1" type="imsqti_stimulus_xmlv3p0" href="stimuli/passage.xml">
              <file href="stimuli/passage.xml"/>
              <file href="stimuli/passage.css"/>
            </resource>
          </resources>
        </manifest>`,
			fileAccess: {
				readText(path) {
					if (path === 'items/item.xml') {
						return `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="item1">
              <qti-item-body><qti-assessment-stimulus-ref identifier="passage_1" href="../stimuli/passage.xml"/></qti-item-body>
            </qti-assessment-item>`;
					}
					if (path === 'stimuli/passage.xml') {
						return `<qti-assessment-stimulus xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="passage_1">
              <qti-stylesheet href="passage.css"/>
              <qti-stimulus-body><p>Passage</p></qti-stimulus-body>
            </qti-assessment-stimulus>`;
					}
					return null;
				},
				listFiles() {
					return ['items/item.xml', 'stimuli/passage.xml'];
				},
			},
		});

		const stimulusRef = (analyzed.references.get('item1') ?? []).find((reference) => reference.kind === 'stimulus');
		expect(stimulusRef?.targetResourceId).toBe('stimulus1');
		expect(analyzed.assets.has('stimuli/passage.xml')).toBe(false);
		expect(analyzed.closures.get('item1')?.resourceIds).toEqual(['item1', 'stimulus1']);
		expect(analyzed.closures.get('item1')?.assetPaths).toContain('stimuli/passage.css');
		expect(analyzed.closures.get('item1')?.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
			'IMS_CP_MISSING_FILE'
		);
		expect(serializeContentPackageEvidence(analyzed).relationshipHints).toContainEqual(
			expect.objectContaining({
				kind: 'assessment-stimulus-ref',
				sourceResourceId: 'item1',
				targetResourceId: 'stimulus1',
			})
		);
	});

	test('keeps resolved source XML refs in closures even without manifest resources', async () => {
		const analyzed = await analyzeContentPackage({
			manifestXml: `
        <manifest identifier="loose-stimulus">
          <resources>
            <resource identifier="item1" type="imsqti_item_xmlv3p0" href="items/item.xml">
              <file href="items/item.xml"/>
            </resource>
          </resources>
        </manifest>`,
			fileAccess: {
				readText(path) {
					if (path === 'items/item.xml') {
						return `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="item1">
              <qti-item-body><qti-assessment-stimulus-ref identifier="passage_1" href="../stimuli/passage.xml"/></qti-item-body>
            </qti-assessment-item>`;
					}
					return null;
				},
				listFiles() {
					return ['items/item.xml', 'stimuli/passage.xml'];
				},
			},
		});

		const stimulusRef = (analyzed.references.get('item1') ?? []).find((reference) => reference.kind === 'stimulus');
		expect(stimulusRef?.targetResourceId).toBeUndefined();
		expect(stimulusRef?.resolvedPath).toBe('stimuli/passage.xml');
		expect(analyzed.closures.get('item1')?.filePaths).toContain('stimuli/passage.xml');
		expect(analyzed.diagnostics.map((diagnostic) => diagnostic.code)).not.toContain('IMS_CP_DANGLING_STIMULUS_REF');
	});

	test('discovers every runtime media attribute on an element', async () => {
		const analyzed = await analyzeContentPackage({
			manifestXml: `
        <manifest identifier="media-assets">
          <resources>
            <resource identifier="item1" type="imsqti_item_xmlv3p0" href="items/item.xml">
              <file href="items/item.xml"/>
              <file href="items/poster.png"/>
              <file href="items/movie.mp4"/>
              <file href="items/captions.vtt"/>
              <file href="items/thumb-1x.png"/>
              <file href="items/thumb-2x.png"/>
              <file href="items/audio.mp3"/>
            </resource>
          </resources>
        </manifest>`,
			fileAccess: {
				readText(path) {
					if (path === 'items/item.xml') {
						return `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="item1">
              <qti-item-body>
                <video src="movie.mp4" poster="poster.png"><track src="captions.vtt"/></video>
                <img srcset="thumb-1x.png 1x, thumb-2x.png 2x"/>
                <object type="audio/mpeg" data="audio.mp3"/>
              </qti-item-body>
            </qti-assessment-item>`;
					}
					return null;
				},
				listFiles() {
					return [
						'items/item.xml',
						'items/poster.png',
						'items/movie.mp4',
						'items/captions.vtt',
						'items/thumb-1x.png',
						'items/thumb-2x.png',
						'items/audio.mp3',
					];
				},
			},
		});

		const references = analyzed.references.get('item1') ?? [];
		for (const rawHref of ['movie.mp4', 'poster.png', 'captions.vtt', 'thumb-1x.png', 'thumb-2x.png', 'audio.mp3']) {
			expect(references.find((reference) => reference.rawHref === rawHref)?.resolvedPath).toBe(`items/${rawHref}`);
			expect(analyzed.assets.get(`items/${rawHref}`)).toBeDefined();
		}
		expect(references.find((reference) => reference.rawHref === 'poster.png')?.sourceAttribute).toBe('poster');
		expect(references.find((reference) => reference.rawHref === 'thumb-1x.png')?.sourceAttribute).toBe('srcset');
	});

	test('decodes XML entities before resolving package asset refs', async () => {
		const analyzed = await analyzeContentPackage({
			manifestXml: `
        <manifest identifier="entity-refs">
          <resources>
            <resource identifier="item1" type="imsqti_item_xmlv3p0" href="items/item.xml">
              <file href="items/item.xml"/>
              <file href="items/images/a&amp;b.svg"/>
            </resource>
          </resources>
        </manifest>`,
			fileAccess: {
				readText(path) {
					if (path === 'items/item.xml') {
						return `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="item1">
              <qti-item-body><img src="images/a&amp;b.svg"/></qti-item-body>
            </qti-assessment-item>`;
					}
					return null;
				},
				listFiles() {
					return ['items/item.xml', 'items/images/a&b.svg'];
				},
			},
		});

		const reference = (analyzed.references.get('item1') ?? []).find(
			(candidate) => candidate.rawHref === 'images/a&b.svg'
		);
		expect(reference?.resolvedPath).toBe('items/images/a&b.svg');
		expect(analyzed.assets.has('items/images/a&b.svg')).toBe(true);
		expect(analyzed.diagnostics.map((diagnostic) => diagnostic.code)).not.toContain('IMS_CP_MISSING_ASSET');
	});

	test('discovers refs after quoted greater-than attributes and data URL srcset candidates', async () => {
		const analyzed = await analyzeContentPackage({
			manifestXml: `
        <manifest identifier="quoted-attrs">
          <resources>
            <resource identifier="item1" type="imsqti_item_xmlv3p0" href="items/item.xml">
              <file href="items/item.xml"/>
              <file href="items/images/fallback.png"/>
              <file href="items/images/large.png"/>
            </resource>
          </resources>
        </manifest>`,
			fileAccess: {
				readText(path) {
					if (path === 'items/item.xml') {
						return `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="item1">
              <qti-item-body>
                <img alt="A > B" src="images/fallback.png"/>
                <img srcset="data:image/png;base64,AAAA 1x, images/large.png 2x"/>
              </qti-item-body>
            </qti-assessment-item>`;
					}
					return null;
				},
				listFiles() {
					return ['items/item.xml', 'items/images/fallback.png', 'items/images/large.png'];
				},
			},
		});

		const references = analyzed.references.get('item1') ?? [];
		expect(references.find((reference) => reference.rawHref === 'images/fallback.png')?.resolvedPath).toBe(
			'items/images/fallback.png'
		);
		expect(references.find((reference) => reference.rawHref === 'images/large.png')?.resolvedPath).toBe(
			'items/images/large.png'
		);
		expect(references.some((reference) => reference.rawHref.startsWith('data:image/png'))).toBe(false);
	});

	test('does not use package path heuristics when strict mode is configured', async () => {
		const analyzed = await analyzeContentPackage({
			manifestXml: `
        <manifest identifier="strict-assets">
          <resources>
            <resource identifier="item1" type="imsqti_item_xmlv3p0" href="content/items/item.xml">
              <file href="content/items/item.xml"/>
              <file href="shared/graphics/diagram.png"/>
            </resource>
          </resources>
        </manifest>`,
			heuristicsConfig: STRICT_QTI_CONFIG,
			fileAccess: {
				readText(path) {
					if (path === 'content/items/item.xml') {
						return `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="item1">
              <qti-item-body><img src="graphics/diagram.png"/></qti-item-body>
            </qti-assessment-item>`;
					}
					return null;
				},
				listFiles() {
					return ['content/items/item.xml', 'shared/graphics/diagram.png'];
				},
			},
		});

		const reference = (analyzed.references.get('item1') ?? []).find(
			(candidate) => candidate.rawHref === 'graphics/diagram.png'
		);
		expect(reference?.resolvedPath).toBe('content/items/graphics/diagram.png');
		expect(reference?.heuristic).toBeUndefined();
		expect(analyzed.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
			'IMS_CP_REFERENCE_HEURISTIC_DISABLED'
		);
		expect(analyzed.diagnostics.map((diagnostic) => diagnostic.code)).toContain('IMS_CP_MISSING_ASSET');
	});

	test('uses manifest evidence before resolving source XML refs by suffix', async () => {
		const analyzed = await analyzeContentPackage({
			manifestXml: `
        <manifest identifier="source-suffix">
          <resources>
            <resource identifier="test1" type="imsqti_test_xmlv3p0" href="content/tests/test.xml">
              <file href="content/tests/test.xml"/>
              <dependency identifierref="item2"/>
            </resource>
            <resource identifier="item2" type="imsqti_item_xmlv3p0" href="content/bank/items/item2.xml">
              <file href="content/bank/items/item2.xml"/>
            </resource>
          </resources>
        </manifest>`,
			fileAccess: {
				readText(path) {
					if (path === 'content/tests/test.xml') {
						return `<qti-assessment-test xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0">
              <qti-test-part>
                <qti-assessment-section>
                  <qti-assessment-item-ref identifier="item-ref-2" href="bank/items/item2.xml"/>
                </qti-assessment-section>
              </qti-test-part>
            </qti-assessment-test>`;
					}
					if (path === 'content/bank/items/item2.xml') {
						return `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="item2"/>`;
					}
					return null;
				},
				listFiles() {
					return ['content/tests/test.xml', 'content/bank/items/item2.xml'];
				},
			},
		});

		const itemRef = (analyzed.references.get('test1') ?? []).find(
			(reference) => reference.rawHref === 'bank/items/item2.xml'
		);
		expect(itemRef).toMatchObject({
			kind: 'assessment-item-ref',
			targetResourceId: 'item2',
			resolvedPath: 'content/bank/items/item2.xml',
			resolutionStrategy: 'unique-suffix',
			heuristic: true,
		});
		expect(analyzed.diagnostics.some((diagnostic) => diagnostic.code === 'IMS_CP_DANGLING_ITEM_REF')).toBe(false);
	});

	test('does not recover unsafe or ambiguous package asset refs', async () => {
		const analyzed = await analyzeContentPackage({
			manifestXml: `
        <manifest identifier="unsafe-ambiguous">
          <resources>
            <resource identifier="item1" type="imsqti_item_xmlv2p2" href="item.xml">
              <file href="item.xml"/>
            </resource>
          </resources>
        </manifest>`,
			fileAccess: {
				readText(path) {
					if (path === 'item.xml') {
						return `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="item1">
              <itemBody>
                <img src="../secret.png"/>
                <img src="diagram.png"/>
              </itemBody>
            </assessmentItem>`;
					}
					return null;
				},
				listFiles() {
					return ['item.xml', 'safe/secret.png', 'a/diagram.png', 'b/diagram.png'];
				},
			},
		});

		expect(analyzed.assets.has('safe/secret.png')).toBe(false);
		expect(analyzed.assets.has('a/diagram.png')).toBe(false);
		expect(analyzed.assets.has('b/diagram.png')).toBe(false);
		expect(analyzed.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
			'IMS_CP_REFERENCE_UNSAFE'
		);
		expect(analyzed.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
			'IMS_CP_REFERENCE_AMBIGUOUS'
		);
	});
});
