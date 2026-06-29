import { describe, expect, test } from 'bun:test';
import type { QtiSourceProfile } from '@pie-qti/transform-types';
import { transformQtiPackageToPie } from '../src/package-transformer';

const manifestXml = `
<manifest identifier="pkg1">
  <resources>
    <resource identifier="test1" type="imsqti_test_xmlv2p2" href="tests/test.xml">
      <file href="tests/test.xml"/>
      <dependency identifierref="item1"/>
    </resource>
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
  <rubricBlock view="scorer" identifier="scoring-rubric">
    <p>Score using the generic rubric evidence.</p>
  </rubricBlock>
</assessmentItem>`;

const testXml = `
<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="test1" title="Test 1">
  <testPart identifier="part1">
    <assessmentSection identifier="section1" title="Section 1" visible="true">
      <assessmentItemRef identifier="item-ref-1" href="../items/item.xml"/>
      <rubricBlock view="testConstructor" identifier="test-rubric">
        <p>Package-level rubric evidence.</p>
      </rubricBlock>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

describe('transformQtiPackageToPie', () => {
	test('transforms package item resources with package trace and sidecars', async () => {
		const sourceProfile: QtiSourceProfile = {
			id: 'package-test-profile',
			version: '2026.05',
			fallbackPolicy: 'allow-generic',
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
					rubricCandidates: [
						{
							id: 'rubric:pkg',
							kind: 'unknown',
							profileId: 'package-test-profile',
							evidence: [{ type: 'test', message: 'package rubric evidence' }],
						},
					],
				};
			},
			extractItem(context) {
				return {
					rubricCandidates: [
						{
							id: `rubric-candidate:${context.itemId}`,
							kind: 'rationale',
							itemId: context.itemId,
							resourceId: context.resourceId,
							profileId: 'package-test-profile',
							content: 'Generic rubric-like evidence preserved for host review.',
						},
					],
					sidecars: [
						{
							id: `rubric:${context.itemId}`,
							kind: 'rubric',
							sourceResourceId: context.resourceId,
							referencedBy: [context.resourceId ?? context.itemId ?? 'unknown'],
							metadata: {
								sourceProfile: 'package-test-profile',
							},
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
					if (path === 'tests/test.xml') return testXml;
					return path === 'items/item.xml' ? itemXml : null;
				},
			},
		});
		const repeatedResult = await transformQtiPackageToPie({
			manifestXml,
			sourceProfiles: [sourceProfile],
			fileAccess: {
				readText(path) {
					if (path === 'tests/test.xml') return testXml;
					return path === 'items/item.xml' ? itemXml : null;
				},
			},
		});

		expect(result.items).toHaveLength(1);
		expect(result.itemResults).toHaveLength(1);
		expect(result.itemResults[0]).toMatchObject({
			resourceId: 'item1',
			sourcePath: 'items/item.xml',
			status: 'transformed',
			itemCount: 1,
			traceId: 'qti-to-pie-item1',
		});
		expect(result.qtiVersion.version).toBe('2.2');
		expect(result.qtiVersion.confidence).toBe('high');
		expect(result.conversionTrace.traceId).toBe(repeatedResult.conversionTrace.traceId);
		expect(result.conversionTrace.events.map((event) => event.id)).toEqual(
			repeatedResult.conversionTrace.events.map((event) => event.id)
		);
		expect(JSON.stringify(result.packageEvidence)).toBe(JSON.stringify(repeatedResult.packageEvidence));
		expect(result.packageEvidence.qtiVersion.version).toBe('2.2');
		expect(result.packageEvidence.assets.some((asset) => asset.resolvedPath === 'items/chart.png')).toBe(
			true
		);
		expect(result.sidecars.map((sidecar) => sidecar.id)).toEqual(
			repeatedResult.sidecars.map((sidecar) => sidecar.id)
		);
		expect(
			result.sidecars.some(
				(sidecar) =>
					sidecar.kind === 'manifest' &&
					sidecar.sourcePath === 'imsmanifest.xml' &&
					sidecar.id.startsWith('manifest:pkg1-imsmanifest-xml:')
			)
		).toBe(true);
		expect(
			result.sidecars.some(
				(sidecar) =>
					sidecar.kind === 'asset' &&
					sidecar.sourcePath === 'items/chart.png' &&
					sidecar.mimeType === 'image/png' &&
					sidecar.id.startsWith('image:items-chart-png:')
			)
		).toBe(true);
		expect(
			result.sidecars.some(
				(sidecar) =>
					sidecar.kind === 'source-qti' &&
					sidecar.sourcePath === 'items/item.xml' &&
					sidecar.id.startsWith('source-qti:items-item-xml:')
			)
		).toBe(true);
		expect(result.sidecars.some((sidecar) => sidecar.id === 'rubric:item1')).toBe(true);
		const sidecarEvents = result.conversionTrace.events.filter((event) => event.kind === 'sidecar-emitted');
		expect(sidecarEvents).toHaveLength(result.sidecars.length);
		expect(
			sidecarEvents.some(
				(event) =>
					event.data?.sidecarId === 'rubric:item1' &&
					event.data?.kind === 'rubric' &&
					Array.isArray(event.data?.referencedBy)
			)
		).toBe(true);
		expect(result.sourceProfiles.map((profile) => profile.scope)).toEqual(['item', 'package']);
		expect(result.sourceProfiles.every((profile) => profile.profileId === 'package-test-profile')).toBe(true);
		expect(result.sourceProfiles.every((profile) => profile.profileVersion === '2026.05')).toBe(true);
		expect(result.sourceProfiles.every((profile) => profile.fallbackPolicy === 'allow-generic')).toBe(true);
		expect(result.conversionTrace.profiles?.map((profile) => profile.scope)).toEqual(['item', 'package']);
		expect(result.sourceDiagnostics[0].code).toBe('QTI_PROFILE_HANDLER_NO_OUTPUT');
		expect(result.warnings.some((warning) => warning.code === 'QTI_PROFILE_HANDLER_NO_OUTPUT')).toBe(true);
		expect(result.conversionTrace.diagnostics?.[0].code).toBe('QTI_PROFILE_HANDLER_NO_OUTPUT');
		expect(result.standardCandidates[0].rawValue).toBe('PKG.1');
		expect(result.rubricCandidates.map((candidate) => candidate.id)).toEqual([
			expect.stringMatching(/^qti-rubric:item1:1:/),
			expect.stringMatching(/^qti-rubric:test1:1:/),
			'rubric:pkg',
			'rubric-candidate:item1',
		]);
		expect(result.conversionTrace.rubricCandidates?.map((candidate) => candidate.id)).toEqual([
			expect.stringMatching(/^qti-rubric:item1:1:/),
			expect.stringMatching(/^qti-rubric:test1:1:/),
			'rubric:pkg',
			'rubric-candidate:item1',
		]);
		expect(result.rubricCandidates[0].content).toContain('Score using the generic rubric evidence.');
		expect(result.rubricCandidates[0].metadata?.view).toBe('scorer');
		expect(result.rubricCandidates[1].content).toContain('Package-level rubric evidence.');
		expect(result.rubricCandidates[1].itemId).toBeUndefined();
		expect(result.rubricCandidates[1].resourceId).toBe('test1');
		expect(
			result.conversionTrace.events.some(
				(event) => event.kind === 'rubric-extracted' && event.data?.view === 'scorer'
			)
		).toBe(true);
		expect(
			result.conversionTrace.events.some(
				(event) => event.kind === 'rubric-extracted' && event.data?.view === 'testConstructor'
			)
		).toBe(true);
		expect(
			result.conversionTrace.events.some(
				(event) =>
					event.kind === 'package-analyzed' &&
					event.data?.qtiVersion === '2.2' &&
					event.data.relationshipHints === result.packageEvidence.relationshipHints.length
			)
		).toBe(true);
	});

	test('does not emit source QTI sidecars for unreadable item XML', async () => {
		const result = await transformQtiPackageToPie({
			manifestXml,
			fileAccess: {
				readText() {
					return null;
				},
			},
		});

		expect(result.items).toHaveLength(0);
		expect(result.itemResults).toHaveLength(1);
		expect(result.itemResults[0]).toMatchObject({
			resourceId: 'item1',
			sourcePath: 'items/item.xml',
			status: 'skipped',
			itemCount: 0,
		});
		expect(result.warnings.some((warning) => warning.code === 'IMS_CP_MISSING_FILE')).toBe(true);
		expect(result.sidecars.some((sidecar) => sidecar.kind === 'source-qti')).toBe(false);
	});

	test('rejects ambiguous plugin and source profile composition', async () => {
		await expect(
			transformQtiPackageToPie({
				manifestXml,
				sourceProfiles: [
					{
						id: 'test-profile',
					},
				],
				plugin: {
					transform: async () => ({
						items: [],
						format: 'pie',
						metadata: {
							sourceFormat: 'qti',
							targetFormat: 'pie',
							pluginId: 'test',
							timestamp: new Date(),
							itemCount: 0,
							processingTime: 0,
						},
					}),
				} as any,
				fileAccess: {
					readText(path) {
						return path === 'items/item.xml' ? itemXml : null;
					},
				},
			})
		).rejects.toThrow(/preconfigured plugin instance/);
	});

	test('keeps package diagnostics when a profile blocks item fallback', async () => {
		const result = await transformQtiPackageToPie({
			manifestXml,
			sourceProfiles: [
				{
					id: 'blocking-profile',
					detectItem() {
						return {
							profileId: 'blocking-profile',
							scope: 'item',
							confidence: 0.9,
							evidence: [{ type: 'test', message: 'test block' }],
						};
					},
					itemHandlers: [
						{
							id: 'blocking-profile.no-output',
							fallbackPolicy: 'block-generic',
							canHandle() {
								return true;
							},
							async transform() {
								return null;
							},
						},
					],
				},
			],
			fileAccess: {
				readText(path) {
					return path === 'items/item.xml' ? itemXml : null;
				},
			},
		});

		expect(result.items).toHaveLength(0);
		expect(result.itemResults).toHaveLength(1);
		expect(result.itemResults[0]).toMatchObject({
			resourceId: 'item1',
			sourcePath: 'items/item.xml',
			status: 'failed',
			itemCount: 0,
			traceId: 'qti-to-pie-item1',
		});
		expect(result.sourceDiagnostics.some((diagnostic) => diagnostic.severity === 'error')).toBe(true);
		expect(result.warnings.some((warning) => warning.code === 'QTI_PROFILE_HANDLER_BLOCKED_FALLBACK')).toBe(true);
		expect(result.conversionTrace.events.some((event) => event.kind === 'error')).toBe(true);
	});
});
