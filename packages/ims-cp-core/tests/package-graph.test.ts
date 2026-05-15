import { describe, expect, test } from 'bun:test';
import { analyzeContentPackage } from '../src/package-graph';

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
					if (path === 'items/item.xml') {
						return `<assessmentItem>
              <itemBody>
                <p><img src="images/chart.png"/></p>
                <stylesheet href="../styles/item.css" type="text/css"/>
              </itemBody>
            </assessmentItem>`;
					}
					return null;
				},
			},
		});

		expect(analyzed.packageId).toBe('pkg1');
		expect(analyzed.entrypoints.map((entrypoint) => entrypoint.resourceId)).toEqual([
			'test1',
			'item1',
			'passage1',
		]);
		expect(analyzed.diagnostics.some((diagnostic) => diagnostic.code === 'IMS_CP_DANGLING_DEPENDENCY')).toBe(true);
		expect(analyzed.assets.has('items/images/chart.png')).toBe(true);
		expect(analyzed.assets.has('styles/item.css')).toBe(true);

		const closure = analyzed.closures.get('test1');
		expect(closure?.resourceIds).toEqual(['test1', 'item1', 'passage1']);
		expect(closure?.filePaths).toContain('items/images/chart.png');
		expect(closure?.assetPaths).toContain('items/images/chart.png');
	});
});
