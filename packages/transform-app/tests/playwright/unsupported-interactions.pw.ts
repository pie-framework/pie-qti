import { expect, test } from '@playwright/test';
import AdmZip from 'adm-zip';
import { XMLBuilder } from 'fast-xml-parser';

/**
 * E2E tests for unsupported interaction detection and validation
 */

/**
 * Create a QTI package with specified interactions
 */
async function createQtiPackage(items: { id: string; interaction: string; xml: string }[]): Promise<Buffer> {
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
    ${items.map(item => `
    <resource identifier="${item.id}" type="imsqti_item_xmlv2p2" href="${item.id}.xml">
      <file href="${item.id}.xml"/>
    </resource>
    `).join('')}
  </resources>
</manifest>`;

	zip.addFile('imsmanifest.xml', Buffer.from(manifest, 'utf-8'));

	// Add item files
	items.forEach(item => {
		zip.addFile(`${item.id}.xml`, Buffer.from(item.xml, 'utf-8'));
	});

	return zip.toBuffer();
}

test.describe('Unsupported Interaction Detection', () => {
	test('detects slider interaction and prevents transformation', async ({ page, request }) => {
		// Create package with slider interaction
		const sliderItemXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                identifier="slider-001"
                title="Temperature Selection"
                adaptive="false"
                timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="integer">
    <correctResponse>
      <value>75</value>
    </correctResponse>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0</value>
    </defaultValue>
  </outcomeDeclaration>
  <itemBody>
    <p>What is a comfortable room temperature in Fahrenheit?</p>
    <sliderInteraction responseIdentifier="RESPONSE" lowerBound="60" upperBound="90" step="1">
      <prompt>Select a temperature:</prompt>
    </sliderInteraction>
  </itemBody>
  <responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
</assessmentItem>`;

		const packageBuffer = await createQtiPackage([
			{ id: 'slider-001', interaction: 'sliderInteraction', xml: sliderItemXml }
		]);

		// Upload package
		const formData = new FormData();
		const blob = new Blob([new Uint8Array(packageBuffer)], { type: 'application/zip' });
		formData.append('file', blob, 'test-slider.zip');

		const uploadRes = await request.post('/api/upload', {
			multipart: {
				file: {
					name: 'test-slider.zip',
					mimeType: 'application/zip',
					buffer: packageBuffer
				}
			}
		});

		expect(uploadRes.ok()).toBeTruthy();
		const uploadJson = await uploadRes.json();
		const sessionId = uploadJson.sessionId;

		// Navigate to session page
		await page.goto(`/session/${sessionId}`);

		// Analyze package
		await page.getByRole('button', { name: /Analyze Package/i }).click();

		// Wait for analysis to complete
		await expect(page.getByText(/Analysis complete/i)).toBeVisible({ timeout: 60_000 });

		// Check for unsupported interaction warning
		await expect(page.getByText(/UNSUPPORTED INTERACTIONS/i)).toBeVisible();
		await expect(page.getByText(/sliderInteraction/i)).toBeVisible();
		await expect(page.getByText(/cannot convert to PIE/i)).toBeVisible();

		// Verify red alert is shown
		await expect(page.locator('.alert-error')).toBeVisible();
		await expect(page.getByText(/Cannot Convert to PIE/i)).toBeVisible();

		// Verify Transform to PIE button is disabled
		const transformButton = page.getByTestId('transform-to-pie');
		await expect(transformButton).toBeDisabled();

		// Verify tooltip explains why
		await expect(transformButton).toHaveAttribute('title', /unsupported interaction types/i);
	});

	test('detects multiple unsupported interaction types', async ({ page, request }) => {
		// Create package with multiple unsupported interactions
		const sliderXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="slider-001" title="Slider">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="integer">
    <correctResponse><value>50</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <sliderInteraction responseIdentifier="RESPONSE" lowerBound="0" upperBound="100" step="1"/>
  </itemBody>
</assessmentItem>`;

		const uploadXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="upload-001" title="File Upload">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="file"/>
  <itemBody>
    <uploadInteraction responseIdentifier="RESPONSE"/>
  </itemBody>
</assessmentItem>`;

		const mediaXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="media-001" title="Media">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="integer"/>
  <itemBody>
    <mediaInteraction responseIdentifier="RESPONSE" autostart="false" minPlays="1">
      <object data="video.mp4" type="video/mp4"/>
    </mediaInteraction>
  </itemBody>
</assessmentItem>`;

		const packageBuffer = await createQtiPackage([
			{ id: 'slider-001', interaction: 'sliderInteraction', xml: sliderXml },
			{ id: 'upload-001', interaction: 'uploadInteraction', xml: uploadXml },
			{ id: 'media-001', interaction: 'mediaInteraction', xml: mediaXml }
		]);

		// Upload and analyze
		const uploadRes = await request.post('/api/upload', {
			multipart: {
				file: {
					name: 'test-multiple-unsupported.zip',
					mimeType: 'application/zip',
					buffer: packageBuffer
				}
			}
		});

		const uploadJson = await uploadRes.json();
		const sessionId = uploadJson.sessionId;

		await page.goto(`/session/${sessionId}`);
		await page.getByRole('button', { name: /Analyze Package/i }).click();
		await expect(page.getByText(/Analysis complete/i)).toBeVisible({ timeout: 60_000 });

		// Check for all three unsupported types
		await expect(page.getByText(/UNSUPPORTED INTERACTIONS/i)).toBeVisible();
		await expect(page.getByText(/sliderInteraction/i)).toBeVisible();
		await expect(page.getByText(/uploadInteraction/i)).toBeVisible();
		await expect(page.getByText(/mediaInteraction/i)).toBeVisible();

		// Count should show for each type
		await expect(page.getByText(/1 item.*sliderInteraction/i)).toBeVisible();
		await expect(page.getByText(/1 item.*uploadInteraction/i)).toBeVisible();
		await expect(page.getByText(/1 item.*mediaInteraction/i)).toBeVisible();

		// Transform button still disabled
		await expect(page.getByTestId('transform-to-pie')).toBeDisabled();
	});

	test('allows transformation when no unsupported interactions', async ({ page, request }) => {
		// Create package with only supported interactions
		const choiceXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="choice-001" title="Multiple Choice">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <p>What is 2+2?</p>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <simpleChoice identifier="A">4</simpleChoice>
      <simpleChoice identifier="B">5</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;

		const packageBuffer = await createQtiPackage([
			{ id: 'choice-001', interaction: 'choiceInteraction', xml: choiceXml }
		]);

		const uploadRes = await request.post('/api/upload', {
			multipart: {
				file: {
					name: 'test-supported.zip',
					mimeType: 'application/zip',
					buffer: packageBuffer
				}
			}
		});

		const uploadJson = await uploadRes.json();
		const sessionId = uploadJson.sessionId;

		await page.goto(`/session/${sessionId}`);
		await page.getByRole('button', { name: /Analyze Package/i }).click();
		await expect(page.getByText(/Analysis complete/i)).toBeVisible({ timeout: 60_000 });

		// Should NOT show unsupported interactions warning
		await expect(page.getByText(/UNSUPPORTED INTERACTIONS/i)).not.toBeVisible();
		await expect(page.locator('.alert-error')).not.toBeVisible();

		// Transform button should be enabled
		await expect(page.getByTestId('transform-to-pie')).toBeEnabled();
	});

	test('shows experimental warning for associateInteraction', async ({ page, request }) => {
		const associateXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="associate-001" title="Associate">
  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="pair">
    <correctResponse>
      <value>A B</value>
    </correctResponse>
  </responseDeclaration>
  <itemBody>
    <associateInteraction responseIdentifier="RESPONSE" maxAssociations="1">
      <simpleAssociableChoice identifier="A" matchMax="1">Choice A</simpleAssociableChoice>
      <simpleAssociableChoice identifier="B" matchMax="1">Choice B</simpleAssociableChoice>
    </associateInteraction>
  </itemBody>
</assessmentItem>`;

		const packageBuffer = await createQtiPackage([
			{ id: 'associate-001', interaction: 'associateInteraction', xml: associateXml }
		]);

		const uploadRes = await request.post('/api/upload', {
			multipart: {
				file: {
					name: 'test-associate.zip',
					mimeType: 'application/zip',
					buffer: packageBuffer
				}
			}
		});

		const uploadJson = await uploadRes.json();
		const sessionId = uploadJson.sessionId;

		await page.goto(`/session/${sessionId}`);
		await page.getByRole('button', { name: /Analyze Package/i }).click();
		await expect(page.getByText(/Analysis complete/i)).toBeVisible({ timeout: 60_000 });

		// Should show experimental warning, not unsupported error
		await expect(page.getByText(/EXPERIMENTAL CONVERSIONS/i)).toBeVisible();
		await expect(page.getByText(/associateInteraction/i)).toBeVisible();
		await expect(page.getByText(/fidelity loss/i)).toBeVisible();

		// Transform button should still be enabled (experimental, not blocked)
		await expect(page.getByTestId('transform-to-pie')).toBeEnabled();
	});
});
