import { describe, expect, test } from 'bun:test';
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
});
