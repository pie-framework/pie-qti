import { describe, expect, test } from 'bun:test';
import type { QtiSourceProfile } from '@pie-qti/transform-types';
import { transformQtiPackageToPie } from '../src/package-transformer';

const manifestXml = `
<manifest identifier="pkg1">
  <resources>
    <resource identifier="item1" type="imsqti_item_xmlv2p2" href="items/item.xml">
      <file href="items/item.xml"/>
      <file href="items/chart.png"/>
    </resource>
  </resources>
</manifest>`;

const itemXml = `
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="item1" title="Item 1">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <p>Question?</p>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <simpleChoice identifier="A">A</simpleChoice>
      <simpleChoice identifier="B">B</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;

describe('transformQtiPackageToPie', () => {
	test('transforms package item resources with package trace and sidecars', async () => {
		const sourceProfile: QtiSourceProfile = {
			id: 'package-test-profile',
			detectPackage() {
				return {
					profileId: 'package-test-profile',
					scope: 'package',
					confidence: 0.8,
					evidence: [{ type: 'test', message: 'test package' }],
				};
			},
			detectItem() {
				return {
					profileId: 'package-test-profile',
					scope: 'item',
					confidence: 0.7,
					evidence: [{ type: 'test', message: 'test item' }],
				};
			},
			extractPackage() {
				return {
					standardCandidates: [
						{
							id: 'standard:pkg',
							rawValue: 'PKG.1',
							profileId: 'package-test-profile',
						},
					],
				};
			},
			itemHandlers: [
				{
					id: 'package-test-profile.no-output',
					canHandle() {
						return true;
					},
					async transform() {
						return null;
					},
				},
			],
		};

		const result = await transformQtiPackageToPie({
			manifestXml,
			sourceProfiles: [sourceProfile],
			fileAccess: {
				readText(path) {
					return path === 'items/item.xml' ? itemXml : null;
				},
			},
		});

		expect(result.items).toHaveLength(1);
		expect(result.sidecars.some((sidecar) => sidecar.id === 'asset:items/chart.png')).toBe(true);
		expect(result.sourceProfiles[0].profileId).toBe('package-test-profile');
		expect(result.sourceDiagnostics[0].code).toBe('QTI_PROFILE_HANDLER_NO_OUTPUT');
		expect(result.warnings.some((warning) => warning.code === 'QTI_PROFILE_HANDLER_NO_OUTPUT')).toBe(true);
		expect(result.conversionTrace.diagnostics?.[0].code).toBe('QTI_PROFILE_HANDLER_NO_OUTPUT');
		expect(result.standardCandidates[0].rawValue).toBe('PKG.1');
		expect(result.conversionTrace.events.some((event) => event.kind === 'package-analyzed')).toBe(true);
	});
});
