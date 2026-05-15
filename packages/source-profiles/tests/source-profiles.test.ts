import { describe, expect, test } from 'bun:test';
import { commonCartridgeCsmProfile, extractCsmStandardCandidates } from '../src/common-cartridge-csm';
import { gcaProfile } from '../src/gca';
import { defaultSourceProfiles } from '../src/index';
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

	test('detects GCA/UGA package and passage-style item evidence', () => {
		const packageMatch = gcaProfile.detectPackage?.({
			manifestXml: `
        <manifest identifier="UGA_GCA_ELA">
          <resources>
            <resource identifier="passage1" type="webcontent" href="passages/passage1.xml">
              <metadata>
                <csm:curriculumStandardsMetadataSet>
                  <csm:labelledGUID>
                    <csm:label>ELAGSE6RI1</csm:label>
                    <csm:GUID>ELAGSE6RI1</csm:GUID>
                  </csm:labelledGUID>
                </csm:curriculumStandardsMetadataSet>
              </metadata>
            </resource>
          </resources>
        </manifest>`,
			files: ['gca/passages/passage1.xml', 'gca/rubrics/rubric1.xml'],
		});
		const itemXml = `
      <assessmentPassage identifier="passage1">
        <partBody><p>Read the passage.</p></partBody>
      </assessmentPassage>`;
		const itemMatch = gcaProfile.detectItem?.({
			itemId: 'passage1',
			resourceId: 'passage1',
			sourcePath: 'gca/passages/passage1.xml',
			xml: itemXml,
		});
		const extracted = gcaProfile.extractItem?.({
			itemId: 'passage1',
			resourceId: 'passage1',
			sourcePath: 'gca/passages/passage1.xml',
			xml: itemXml,
		});

		expect(packageMatch?.profileId).toBe('partner.gca');
		expect(packageMatch?.evidence.map((item) => item.type)).toEqual(
			expect.arrayContaining(['source-identity', 'csm-standards', 'passage-signature', 'rubric-signature'])
		);
		expect(itemMatch?.evidence.map((item) => item.type)).toEqual(
			expect.arrayContaining(['assessment-passage', 'part-body', 'source-path'])
		);
		expect(extracted?.metadata?.gcaPassageCandidate).toBe(true);
		expect(extracted?.metadata?.gcaPassageSignals).toEqual(
			expect.arrayContaining(['assessment-passage', 'part-body', 'source-path'])
		);
		expect(defaultSourceProfiles).toContain(gcaProfile);
	});

	test('does not tag generic CSM passage packages as GCA', () => {
		const genericManifest = `
      <manifest identifier="GENERIC_ELA">
        <resources>
          <resource identifier="passage1" type="webcontent" href="passages/passage1.xml">
            <metadata>
              <csm:curriculumStandardsMetadataSet>
                <csm:labelledGUID>
                  <csm:label>ELA.6.RI.1</csm:label>
                  <csm:GUID>ELA.6.RI.1</csm:GUID>
                </csm:labelledGUID>
              </csm:curriculumStandardsMetadataSet>
            </metadata>
          </resource>
        </resources>
      </manifest>`;
		const itemXml = '<assessmentPassage identifier="passage1"><partBody><p>Read.</p></partBody></assessmentPassage>';

		expect(gcaProfile.detectPackage?.({ manifestXml: genericManifest, files: ['passages/passage1.xml'] })).toBeNull();
		expect(gcaProfile.detectItem?.({ itemId: 'passage1', sourcePath: 'passages/passage1.xml', xml: itemXml })).toBeNull();
		expect(gcaProfile.extractItem?.({ itemId: 'passage1', sourcePath: 'passages/passage1.xml', xml: itemXml })).toBeNull();
	});

	test('recognizes underscore-delimited GCA and UGA source markers', () => {
		const packageMatch = gcaProfile.detectPackage?.({
			manifestXml: `
        <manifest identifier="UGA_GCA_ELA">
          <resources>
            <resource identifier="passage1" type="webcontent" href="passages/passage1.xml">
              <metadata>
                <csm:curriculumStandardsMetadataSet>
                  <csm:GUID>ELAGSE6RI1</csm:GUID>
                </csm:curriculumStandardsMetadataSet>
              </metadata>
            </resource>
          </resources>
        </manifest>`,
			files: ['passages/passage1.xml'],
		});
		const itemMatch = gcaProfile.detectItem?.({
			itemId: 'UGA_GCA_ELA_1',
			sourcePath: 'passages/passage1.xml',
			xml: '<assessmentPassage identifier="passage1"><partBody><p>Read.</p></partBody></assessmentPassage>',
		});

		expect(packageMatch?.profileId).toBe('partner.gca');
		expect(itemMatch?.profileId).toBe('partner.gca');
	});
});
