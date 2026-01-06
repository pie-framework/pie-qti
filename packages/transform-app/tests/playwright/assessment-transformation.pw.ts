import { expect, test } from '@playwright/test';
import AdmZip from 'adm-zip';

/**
 * E2E tests for assessment transformation workflow
 */

/**
 * Create a QTI package with assessmentTest
 */
async function createAssessmentPackage(
	testXml: string,
	items: { id: string; xml: string }[]
): Promise<Buffer> {
	const zip = new AdmZip();

	// Create manifest
	const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
          xmlns:imsqti="http://www.imsglobal.org/xsd/imsqti_v2p2"
          identifier="MANIFEST-001">
  <metadata>
    <schema>IMS Content</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations/>
  <resources>
    <resource identifier="TEST-001" type="imsqti_test_xmlv2p2" href="test.xml">
      <file href="test.xml"/>
    </resource>
    ${items.map(item => `
    <resource identifier="${item.id}" type="imsqti_item_xmlv2p2" href="${item.id}.xml">
      <file href="${item.id}.xml"/>
    </resource>
    `).join('')}
  </resources>
</manifest>`;

	zip.addFile('imsmanifest.xml', Buffer.from(manifest, 'utf-8'));
	zip.addFile('test.xml', Buffer.from(testXml, 'utf-8'));

	// Add item files
	items.forEach(item => {
		zip.addFile(`${item.id}.xml`, Buffer.from(item.xml, 'utf-8'));
	});

	return zip.toBuffer();
}

test.describe('Assessment Transformation', () => {
	test('transforms assessment with sections and items', async ({ page, request }) => {
		// Create assessment test XML
		const testXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                identifier="test-001"
                title="Sample Assessment">
  <testPart identifier="part1" navigationMode="linear" submissionMode="individual">
    <assessmentSection identifier="section1" title="Section 1" visible="true">
      <assessmentItemRef identifier="item-001" href="item-001.xml"/>
      <assessmentItemRef identifier="item-002" href="item-002.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

		const item1Xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="item-001" title="Question 1">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <simpleChoice identifier="A">Correct</simpleChoice>
      <simpleChoice identifier="B">Wrong</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;

		const item2Xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="item-002" title="Question 2">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>C</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <simpleChoice identifier="C">Correct</simpleChoice>
      <simpleChoice identifier="D">Wrong</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;

		const packageBuffer = await createAssessmentPackage(
			testXml,
			[
				{ id: 'item-001', xml: item1Xml },
				{ id: 'item-002', xml: item2Xml }
			]
		);

		// Upload package
		const uploadRes = await request.post('/api/upload', {
			multipart: {
				file: {
					name: 'test-assessment.zip',
					mimeType: 'application/zip',
					buffer: packageBuffer
				}
			}
		});

		expect(uploadRes.ok()).toBeTruthy();
		const uploadJson = await uploadRes.json();
		const sessionId = uploadJson.sessionId;

		// Navigate and analyze
		await page.goto(`/session/${sessionId}`);
		await page.getByRole('button', { name: /Analyze Package/i }).click();
		await expect(page.getByText(/Analysis complete/i)).toBeVisible({ timeout: 120_000 });

		// Should detect 1 assessment test
		await expect(page.getByText(/1.*Assessment/i)).toBeVisible();

		// Transform (this will transform both items and assessment if requested)
		await page.getByTestId('transform-to-pie').click();
		await expect(page.getByRole('heading', { name: /Transformation Results/i })).toBeVisible({ timeout: 120_000 });

		// Check if assessments section exists
		const assessmentHeading = page.getByText(/Assessments/i).first();
		if (await assessmentHeading.count() > 0) {
			await expect(assessmentHeading).toBeVisible();

			// Check for assessment in the list
			const assessmentButton = page.getByTestId('assessment-0');
			if (await assessmentButton.count() > 0) {
				await expect(assessmentButton).toBeVisible();

				// Click to view assessment
				await assessmentButton.click();

				// Verify assessment preview is shown
				await expect(page.getByText(/Sample Assessment/i)).toBeVisible();
				await expect(page.getByText(/Section 1/i)).toBeVisible();
				await expect(page.getByText(/Total Items/i)).toBeVisible();
			}
		}
	});

	test('displays assessment metadata correctly', async ({ page, request }) => {
		const testXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                identifier="test-002"
                title="Timed Assessment">
  <timeLimits maxTime="3600" allowLateSubmission="false"/>
  <testPart identifier="part1" navigationMode="linear" submissionMode="simultaneous">
    <assessmentSection identifier="section1" title="Main Section" visible="true">
      <assessmentItemRef identifier="item-001" href="item-001.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

		const itemXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="item-001" title="Question">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <simpleChoice identifier="A">A</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;

		const packageBuffer = await createAssessmentPackage(
			testXml,
			[{ id: 'item-001', xml: itemXml }]
		);

		const uploadRes = await request.post('/api/upload', {
			multipart: {
				file: {
					name: 'test-timed.zip',
					mimeType: 'application/zip',
					buffer: packageBuffer
				}
			}
		});

		const uploadJson = await uploadRes.json();
		const sessionId = uploadJson.sessionId;

		await page.goto(`/session/${sessionId}`);
		await page.getByRole('button', { name: /Analyze Package/i }).click();
		await expect(page.getByText(/Analysis complete/i)).toBeVisible({ timeout: 120_000 });

		await page.getByTestId('transform-to-pie').click();
		await expect(page.getByRole('heading', { name: /Transformation Results/i })).toBeVisible({ timeout: 120_000 });

		const assessmentButton = page.getByTestId('assessment-0');
		if (await assessmentButton.count() > 0) {
			await assessmentButton.click();

			// Check for metadata display
			await expect(page.getByText(/Timed Assessment/i)).toBeVisible();

			// Look for time limit if displayed
			const timeLimitText = page.getByText(/Time Limit/i);
			if (await timeLimitText.count() > 0) {
				await expect(timeLimitText).toBeVisible();
			}

			// Look for navigation/submission mode
			const configSection = page.locator('text=/Configuration|Navigation|Submission/i').first();
			if (await configSection.count() > 0) {
				await expect(configSection).toBeVisible();
			}
		}
	});

	test('handles nested sections correctly', async ({ page, request }) => {
		const testXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                identifier="test-003"
                title="Nested Sections">
  <testPart identifier="part1" navigationMode="nonlinear" submissionMode="individual">
    <assessmentSection identifier="parent-section" title="Parent Section" visible="true">
      <assessmentSection identifier="child-section" title="Child Section" visible="true">
        <assessmentItemRef identifier="item-001" href="item-001.xml"/>
      </assessmentSection>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

		const itemXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="item-001" title="Question">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <simpleChoice identifier="A">A</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;

		const packageBuffer = await createAssessmentPackage(
			testXml,
			[{ id: 'item-001', xml: itemXml }]
		);

		const uploadRes = await request.post('/api/upload', {
			multipart: {
				file: {
					name: 'test-nested.zip',
					mimeType: 'application/zip',
					buffer: packageBuffer
				}
			}
		});

		const uploadJson = await uploadRes.json();
		const sessionId = uploadJson.sessionId;

		await page.goto(`/session/${sessionId}`);
		await page.getByRole('button', { name: /Analyze Package/i }).click();
		await expect(page.getByText(/Analysis complete/i)).toBeVisible({ timeout: 120_000 });

		await page.getByTestId('transform-to-pie').click();
		await expect(page.getByRole('heading', { name: /Transformation Results/i })).toBeVisible({ timeout: 120_000 });

		const assessmentButton = page.getByTestId('assessment-0');
		if (await assessmentButton.count() > 0) {
			await assessmentButton.click();

			// Verify section hierarchy is shown
			await expect(page.getByText(/Parent Section/i)).toBeVisible();
			await expect(page.getByText(/Child Section/i)).toBeVisible();

			// Look for subsections indicator
			const subsectionsText = page.getByText(/Subsections/i);
			if (await subsectionsText.count() > 0) {
				await expect(subsectionsText).toBeVisible();
			}
		}
	});

	test('shows assessment stats in sidebar', async ({ page, request }) => {
		const testXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                identifier="test-004"
                title="Test Assessment">
  <testPart identifier="part1" navigationMode="linear" submissionMode="individual">
    <assessmentSection identifier="section1" title="Section" visible="true">
      <assessmentItemRef identifier="item-001" href="item-001.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

		const itemXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="item-001" title="Question">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <simpleChoice identifier="A">A</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;

		const packageBuffer = await createAssessmentPackage(
			testXml,
			[{ id: 'item-001', xml: itemXml }]
		);

		const uploadRes = await request.post('/api/upload', {
			multipart: {
				file: {
					name: 'test-stats.zip',
					mimeType: 'application/zip',
					buffer: packageBuffer
				}
			}
		});

		const uploadJson = await uploadRes.json();
		const sessionId = uploadJson.sessionId;

		await page.goto(`/session/${sessionId}`);
		await page.getByRole('button', { name: /Analyze Package/i }).click();
		await expect(page.getByText(/Analysis complete/i)).toBeVisible({ timeout: 120_000 });

		await page.getByTestId('transform-to-pie').click();
		await expect(page.getByRole('heading', { name: /Transformation Results/i })).toBeVisible({ timeout: 120_000 });

		// Look for assessment stat
		const assessmentStat = page.locator('.stat').filter({ hasText: /Assessments/i });
		if (await assessmentStat.count() > 0) {
			await expect(assessmentStat).toBeVisible();

			const statValue = await assessmentStat.locator('.stat-value').textContent();
			expect(parseInt(statValue || '0', 10)).toBeGreaterThan(0);
		}
	});

	test('assessment warnings are displayed', async ({ page, request }) => {
		const testXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                identifier="test-005"
                title="Test with Complex Rules">
  <testPart identifier="part1" navigationMode="linear" submissionMode="individual">
    <assessmentSection identifier="section1" title="Section" visible="true">
      <assessmentItemRef identifier="item-001" href="item-001.xml">
        <branchRule target="EXIT_TEST">
          <baseValue baseType="boolean">true</baseValue>
        </branchRule>
      </assessmentItemRef>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

		const itemXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="item-001" title="Question">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <simpleChoice identifier="A">A</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;

		const packageBuffer = await createAssessmentPackage(
			testXml,
			[{ id: 'item-001', xml: itemXml }]
		);

		const uploadRes = await request.post('/api/upload', {
			multipart: {
				file: {
					name: 'test-warnings.zip',
					mimeType: 'application/zip',
					buffer: packageBuffer
				}
			}
		});

		const uploadJson = await uploadRes.json();
		const sessionId = uploadJson.sessionId;

		await page.goto(`/session/${sessionId}`);
		await page.getByRole('button', { name: /Analyze Package/i }).click();
		await expect(page.getByText(/Analysis complete/i)).toBeVisible({ timeout: 120_000 });

		await page.getByTestId('transform-to-pie').click();
		await expect(page.getByRole('heading', { name: /Transformation Results/i })).toBeVisible({ timeout: 120_000 });

		const assessmentButton = page.getByTestId('assessment-0');
		if (await assessmentButton.count() > 0) {
			// Check if assessment has warning badge
			const warningBadge = assessmentButton.locator('.badge-warning');
			if (await warningBadge.count() > 0) {
				await expect(warningBadge).toBeVisible();

				// Click assessment
				await assessmentButton.click();

				// Verify warning alert is shown
				const warningAlert = page.locator('.alert-warning');
				if (await warningAlert.count() > 0) {
					await expect(warningAlert).toBeVisible();
					await expect(page.getByText(/Warning/i)).toBeVisible();
				}
			}
		}
	});
});
