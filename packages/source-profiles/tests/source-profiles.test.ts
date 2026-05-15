import { describe, expect, test } from 'bun:test';
import { commonCartridgeCsmProfile, extractCsmStandardCandidates } from '../src/common-cartridge-csm';
import { savvasMyPerspectivesProfile } from '../src/savvas-myperspectives';

const manifestXml = `
<manifest identifier="MYP25_G06_UT_U1">
  <resources>
    <resource identifier="exam" type="imsqti_test_xmlv2p1" href="assesmentExamView.xml"/>
    <resource identifier="QUAD_1" type="imsqti_item_xmlv2p1" href="QUAD_1.xml">
      <metadata>
        <csm:curriculumStandardsMetadataSet>
          <csm:labelledGUID>
            <csm:label>ELA_G06_RI_022</csm:label>
            <csm:GUID>LiteracyDigital_Skills\\LiteracyDigital\\ELA_G06_RI_022</csm:GUID>
          </csm:labelledGUID>
        </csm:curriculumStandardsMetadataSet>
      </metadata>
    </resource>
  </resources>
</manifest>`;

describe('source profiles', () => {
	test('extracts Common Cartridge CSM standards as candidates', () => {
		const candidates = extractCsmStandardCandidates({ manifestXml });

		expect(candidates).toHaveLength(1);
		expect(candidates[0].rawValue).toBe('LiteracyDigital_Skills\\LiteracyDigital\\ELA_G06_RI_022');
		expect(candidates[0].label).toBe('ELA_G06_RI_022');
		expect(candidates[0].matchHint).toBe('vendor-mapping');
		expect(commonCartridgeCsmProfile.detectPackage?.({ manifestXml })?.confidence).toBeGreaterThan(0.8);
	});

	test('detects Savvas myPerspectives package and highlighter items', () => {
		const packageMatch = savvasMyPerspectivesProfile.detectPackage?.({
			manifestXml,
			files: ['assesmentExamView.xml', 'QUAD_1.xml'],
		});
		const itemMatch = savvasMyPerspectivesProfile.detectItem?.({
			itemId: 'QUAD_1',
			qtiVersion: '2.1',
			xml: '<assessmentItem><itemBody><customInteraction responseIdentifier="RESPONSE" class="tei-texthighlighter"/></itemBody></assessmentItem>',
		});
		const extracted = savvasMyPerspectivesProfile.extractItem?.({
			itemId: 'QUAD_1',
			xml: '<assessmentItem><itemBody><customInteraction responseIdentifier="RESPONSE" class="tei-texthighlighter"/></itemBody></assessmentItem>',
		});

		expect(packageMatch?.profileId).toBe('savvas.myperspectives.examview.qti21');
		expect(packageMatch?.evidence.map((item) => item.type)).toContain('examview-assessment-file');
		expect(itemMatch?.evidence[0].type).toBe('tei-texthighlighter');
		expect(extracted?.warnings?.[0].code).toBe('SAVVAS_TEI_TEXTHIGHLIGHTER_REVIEW_REQUIRED');
	});
});
