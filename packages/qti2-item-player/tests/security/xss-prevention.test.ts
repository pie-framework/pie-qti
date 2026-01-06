/**
 * Security Tests - XSS Prevention
 *
 * Tests that user-provided content cannot execute malicious scripts
 * Critical attack vectors in QTI players:
 * 1. Item body HTML/XML content
 * 2. Choice labels and prompts
 * 3. Feedback messages
 * 4. SVG and image content
 * 5. User-provided responses
 *
 * Note: These tests verify the Player does not introduce XSS vulnerabilities.
 * Rendering components must also escape output when displaying user content.
 */

import { describe, expect, test } from 'bun:test';
import { Player } from '../../src/core/Player.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

describe('XSS Prevention - Item Body Content', () => {
	test('should not contain executable script tags in itemBody HTML', () => {
		const qtiXml = `<?xml version="1.0"?>
		<assessmentItem ${NS} identifier="xss-test" title="XSS Test" adaptive="false" timeDependent="false">
			<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
				<correctResponse><value>A</value></correctResponse>
			</responseDeclaration>
			<itemBody>
				<p>Normal text</p>
				<script>alert('XSS')</script>
				<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
					<simpleChoice identifier="A">Choice A</simpleChoice>
				</choiceInteraction>
			</itemBody>
		</assessmentItem>`;

		const player = new Player({ itemXml: qtiXml });
		const html = player.getItemBodyHtml();

		// Script tags should be removed or escaped - NOT executable
		expect(html.toLowerCase()).not.toContain('<script>alert');
		// Even if present as text, should not execute
		if (html.toLowerCase().includes('script')) {
			// Must be escaped - check for escaped opening tag OR ensure no closing script tag
			expect(html.includes('&lt;script&gt;') || !html.includes('</script')).toBe(true);
		}
	});

	test('should prevent event handler injection in itemBody', () => {
		const qtiXml = `<?xml version="1.0"?>
		<assessmentItem ${NS} identifier="xss-test-2" title="XSS Test 2" adaptive="false" timeDependent="false">
			<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
				<correctResponse><value>A</value></correctResponse>
			</responseDeclaration>
			<itemBody>
				<p onclick="alert('XSS')">Click me</p>
				<img src="x" onerror="alert('XSS')" />
				<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
					<simpleChoice identifier="A">Choice A</simpleChoice>
				</choiceInteraction>
			</itemBody>
		</assessmentItem>`;

		const player = new Player({ itemXml: qtiXml });
		const html = player.getItemBodyHtml();

		// Event handlers should be removed - content should be safe
		// If onclick appears, it must be escaped/quoted, not executable
		const hasRawOnclick = html.match(/onclick\s*=\s*"[^"]*alert/i);
		const hasRawOnerror = html.match(/onerror\s*=\s*"[^"]*alert/i);

		expect(hasRawOnclick).toBeFalsy();
		expect(hasRawOnerror).toBeFalsy();
	});

	test('should prevent mixed-case event handlers (node-html-parser preserves casing)', () => {
		const qtiXml = `<?xml version="1.0"?>
		<assessmentItem ${NS} identifier="xss-mixedcase" title="XSS Mixed Case" adaptive="false" timeDependent="false">
			<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
				<correctResponse><value>A</value></correctResponse>
			</responseDeclaration>
			<itemBody>
				<p onClick="alert('XSS')" oNLoAd="alert('XSS')">Hello</p>
				<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
					<simpleChoice identifier="A">Choice A</simpleChoice>
				</choiceInteraction>
			</itemBody>
		</assessmentItem>`;

		const player = new Player({ itemXml: qtiXml });
		const html = player.getItemBodyHtml();

		expect(html.match(/onClick\s*=/i)).toBeFalsy();
		expect(html.match(/oNLoAd\s*=/i)).toBeFalsy();
	});

	test('should prevent javascript: protocol in links', () => {
		const qtiXml = `<?xml version="1.0"?>
		<assessmentItem ${NS} identifier="xss-test-3" title="XSS Test 3" adaptive="false" timeDependent="false">
			<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
				<correctResponse><value>A</value></correctResponse>
			</responseDeclaration>
			<itemBody>
				<a href="javascript:alert('XSS')">Click me</a>
				<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
					<simpleChoice identifier="A">Choice A</simpleChoice>
				</choiceInteraction>
			</itemBody>
		</assessmentItem>`;

		const player = new Player({ itemXml: qtiXml });
		const html = player.getItemBodyHtml();

		// javascript: protocol in href should be removed or sanitized
		const hasJavascriptProtocol = html.match(/href\s*=\s*["']javascript:/i);
		expect(hasJavascriptProtocol).toBeFalsy();
	});

	test('should prevent data: URI with HTML/scripts', () => {
		const qtiXml = `<?xml version="1.0"?>
		<assessmentItem ${NS} identifier="xss-test-4" title="XSS Test 4" adaptive="false" timeDependent="false">
			<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
				<correctResponse><value>A</value></correctResponse>
			</responseDeclaration>
			<itemBody>
				<img src="data:text/html,<script>alert('XSS')</script>" />
				<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
					<simpleChoice identifier="A">Choice A</simpleChoice>
				</choiceInteraction>
			</itemBody>
		</assessmentItem>`;

		const player = new Player({ itemXml: qtiXml });
		const html = player.getItemBodyHtml();

		// data: URIs with HTML content should be blocked
		const hasDataHtml = html.match(/data:text\/html.*script/i);
		expect(hasDataHtml).toBeFalsy();
	});
});

describe('XSS Prevention - Choice Content', () => {
	test('should sanitize script tags in choice labels', () => {
		const qtiXml = `<?xml version="1.0"?>
		<assessmentItem ${NS} identifier="choice-xss-1" title="Choice XSS" adaptive="false" timeDependent="false">
			<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
				<correctResponse><value>A</value></correctResponse>
			</responseDeclaration>
			<itemBody>
				<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
					<simpleChoice identifier="A"><script>alert('XSS')</script>Safe Choice</simpleChoice>
					<simpleChoice identifier="B">Normal Choice</simpleChoice>
				</choiceInteraction>
			</itemBody>
		</assessmentItem>`;

		const player = new Player({ itemXml: qtiXml });
		const interactions = player.getInteractions();

		expect(interactions.length).toBeGreaterThan(0);

		// Check interaction HTML for script tags (avoid JSON.stringify to prevent cyclic structure errors)
		const html = player.getItemBodyHtml();
		expect(html).not.toContain('<script>alert');
	});

	test('should prevent event handlers in choice labels', () => {
		const qtiXml = `<?xml version="1.0"?>
		<assessmentItem ${NS} identifier="choice-xss-2" title="Choice XSS 2" adaptive="false" timeDependent="false">
			<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
				<correctResponse><value>A</value></correctResponse>
			</responseDeclaration>
			<itemBody>
				<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
					<simpleChoice identifier="A"><span onmouseover="alert('XSS')">Hover me</span></simpleChoice>
					<simpleChoice identifier="B">Normal Choice</simpleChoice>
				</choiceInteraction>
			</itemBody>
		</assessmentItem>`;

		const player = new Player({ itemXml: qtiXml });
		const interactions = player.getInteractions();

		// Check interaction HTML for event handlers (avoid JSON.stringify to prevent cyclic structure errors)
		const html = player.getItemBodyHtml();
		const hasOnmouseover = html.match(/onmouseover.*alert/i);
		expect(hasOnmouseover).toBeFalsy();
	});

	test('should sanitize prompts with malicious content', () => {
		const qtiXml = `<?xml version="1.0"?>
		<assessmentItem ${NS} identifier="prompt-xss" title="Prompt XSS" adaptive="false" timeDependent="false">
			<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
				<correctResponse><value>A</value></correctResponse>
			</responseDeclaration>
			<itemBody>
				<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
					<prompt><img src=x onerror="alert('XSS')" />Select an answer:</prompt>
					<simpleChoice identifier="A">Choice A</simpleChoice>
				</choiceInteraction>
			</itemBody>
		</assessmentItem>`;

		const player = new Player({ itemXml: qtiXml });
		const interactions = player.getInteractions();

		if (interactions.length > 0) {
			const prompt = (interactions[0] as any).prompt || '';
			// Event handlers should be removed from prompt
			const hasOnerror = prompt.match(/onerror.*alert/i);
			expect(hasOnerror).toBeFalsy();
		}
	});
});

describe('XSS Prevention - Feedback Content', () => {
	test('should sanitize modal feedback content', () => {
		const qtiXml = `<?xml version="1.0"?>
		<assessmentItem ${NS} identifier="feedback-xss" title="Feedback XSS" adaptive="false" timeDependent="false">
			<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
				<correctResponse><value>A</value></correctResponse>
			</responseDeclaration>
			<outcomeDeclaration identifier="FEEDBACKBASIC" cardinality="single" baseType="identifier" />
			<itemBody>
				<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
					<simpleChoice identifier="A">Choice A</simpleChoice>
				</choiceInteraction>
			</itemBody>
			<modalFeedback outcomeIdentifier="FEEDBACKBASIC" identifier="correct" showHide="show">
				<p>Correct! <script>alert('XSS')</script></p>
			</modalFeedback>
			<responseProcessing>
				<responseCondition>
					<responseIf>
						<match>
							<variable identifier="RESPONSE"/>
							<correct identifier="RESPONSE"/>
						</match>
						<setOutcomeValue identifier="FEEDBACKBASIC">
							<baseValue baseType="identifier">correct</baseValue>
						</setOutcomeValue>
					</responseIf>
				</responseCondition>
			</responseProcessing>
		</assessmentItem>`;

		const player = new Player({ itemXml: qtiXml });
		player.setResponses({ RESPONSE: 'A' });
		const result = player.processResponses();

		const feedback = result.modalFeedback || [];
		const feedbackText = JSON.stringify(feedback);

		// Script tags in feedback should not be executable
		expect(feedbackText).not.toContain('<script>alert');
	});
});

describe('XSS Prevention - SVG and Image Content', () => {
	test('should sanitize SVG with embedded scripts', () => {
		const qtiXml = `<?xml version="1.0"?>
		<assessmentItem ${NS} identifier="svg-xss" title="SVG XSS" adaptive="false" timeDependent="false">
			<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
				<correctResponse><value>A</value></correctResponse>
			</responseDeclaration>
			<itemBody>
				<p>
					<svg><script>alert('XSS')</script></svg>
				</p>
				<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
					<simpleChoice identifier="A">Choice A</simpleChoice>
				</choiceInteraction>
			</itemBody>
		</assessmentItem>`;

		const player = new Player({ itemXml: qtiXml });
		const html = player.getItemBodyHtml();

		// SVG scripts should not be executable
		const hasSvgScript = html.match(/<svg[^>]*>.*<script[^>]*>.*alert/is);
		expect(hasSvgScript).toBeFalsy();
	});

	test('should prevent SVG event handlers', () => {
		const qtiXml = `<?xml version="1.0"?>
		<assessmentItem ${NS} identifier="svg-xss-2" title="SVG XSS 2" adaptive="false" timeDependent="false">
			<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
				<correctResponse><value>A</value></correctResponse>
			</responseDeclaration>
			<itemBody>
				<svg onload="alert('XSS')">
					<circle cx="50" cy="50" r="40" />
				</svg>
				<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
					<simpleChoice identifier="A">Choice A</simpleChoice>
				</choiceInteraction>
			</itemBody>
		</assessmentItem>`;

		const player = new Player({ itemXml: qtiXml });
		const html = player.getItemBodyHtml();

		// SVG onload handlers should be removed
		const hasOnload = html.match(/onload\s*=.*alert/i);
		expect(hasOnload).toBeFalsy();
	});

	test('should sanitize hotspot interaction with malicious content', () => {
		const qtiXml = `<?xml version="1.0"?>
		<assessmentItem ${NS} identifier="hotspot-xss" title="Hotspot XSS" adaptive="false" timeDependent="false">
			<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
				<correctResponse><value>A</value></correctResponse>
			</responseDeclaration>
			<itemBody>
				<hotspotInteraction responseIdentifier="RESPONSE" maxChoices="1">
					<object type="image/png" data="image.png" onclick="alert('XSS')">
						<param name="width" value="400" />
					</object>
					<hotspotChoice identifier="A" shape="circle" coords="100,100,50" />
				</hotspotInteraction>
			</itemBody>
		</assessmentItem>`;

		const player = new Player({ itemXml: qtiXml });
		const interactions = player.getInteractions();

		if (interactions.length > 0) {
			// Check interaction HTML for event handlers (avoid JSON.stringify to prevent cyclic structure errors)
			const html = player.getItemBodyHtml();
			const hasOnclick = html.match(/onclick.*alert/i);
			expect(hasOnclick).toBeFalsy();
		}
	});
});

describe('XSS Prevention - HTML Entity Encoding', () => {
	test('should properly handle HTML entities', () => {
		const qtiXml = `<?xml version="1.0"?>
		<assessmentItem ${NS} identifier="entity-test" title="Entity Test" adaptive="false" timeDependent="false">
			<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
				<correctResponse><value>A</value></correctResponse>
			</responseDeclaration>
			<itemBody>
				<p>&lt;script&gt;alert('XSS')&lt;/script&gt;</p>
				<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
					<simpleChoice identifier="A">Choice &lt;A&gt;</simpleChoice>
				</choiceInteraction>
			</itemBody>
		</assessmentItem>`;

		const player = new Player({ itemXml: qtiXml });
		const html = player.getItemBodyHtml();

		// Entities should not decode to executable script
		const hasExecutableScript = html.includes('<script>alert(');
		expect(hasExecutableScript).toBe(false);
	});
});

describe('XSS Prevention - URL Validation', () => {
	test('should validate and sanitize object data URLs', () => {
		const qtiXml = `<?xml version="1.0"?>
		<assessmentItem ${NS} identifier="url-xss" title="URL XSS" adaptive="false" timeDependent="false">
			<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
				<correctResponse><value>A</value></correctResponse>
			</responseDeclaration>
			<itemBody>
				<object data="javascript:alert('XSS')" type="text/html">
					<param name="foo" value="bar" />
				</object>
				<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
					<simpleChoice identifier="A">Choice A</simpleChoice>
				</choiceInteraction>
			</itemBody>
		</assessmentItem>`;

		const player = new Player({ itemXml: qtiXml });
		const html = player.getItemBodyHtml();

		// javascript: protocol should be removed/escaped
		const hasJavascriptData = html.match(/data\s*=\s*["']javascript:/i);
		expect(hasJavascriptData).toBeFalsy();
	});

	test('should validate iframe src attributes', () => {
		const qtiXml = `<?xml version="1.0"?>
		<assessmentItem ${NS} identifier="iframe-xss" title="iframe XSS" adaptive="false" timeDependent="false">
			<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
				<correctResponse><value>A</value></correctResponse>
			</responseDeclaration>
			<itemBody>
				<iframe src="javascript:alert('XSS')"></iframe>
				<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
					<simpleChoice identifier="A">Choice A</simpleChoice>
				</choiceInteraction>
			</itemBody>
		</assessmentItem>`;

		const player = new Player({ itemXml: qtiXml });
		const html = player.getItemBodyHtml();

		// iframes with javascript: should be removed or sanitized
		const hasJavascriptSrc = html.match(/src\s*=\s*["']javascript:/i);
		expect(hasJavascriptSrc).toBeFalsy();
	});

	test('should prevent iframe srcdoc (HTML document string)', () => {
		const qtiXml = `<?xml version="1.0"?>
		<assessmentItem ${NS} identifier="iframe-srcdoc-xss" title="iframe srcdoc XSS" adaptive="false" timeDependent="false">
			<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
				<correctResponse><value>A</value></correctResponse>
			</responseDeclaration>
			<itemBody>
				<iframe srcdoc="<img src=x onerror=alert('XSS')>"></iframe>
				<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
					<simpleChoice identifier="A">Choice A</simpleChoice>
				</choiceInteraction>
			</itemBody>
		</assessmentItem>`;

		const player = new Player({ itemXml: qtiXml });
		const html = player.getItemBodyHtml();
		expect(html.toLowerCase()).not.toContain('srcdoc=');
	});

	test('should sanitize svg xlink:href javascript: URLs', () => {
		const qtiXml = `<?xml version="1.0"?>
		<assessmentItem ${NS} identifier="svg-xlink-xss" title="SVG xlink XSS" adaptive="false" timeDependent="false">
			<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
				<correctResponse><value>A</value></correctResponse>
			</responseDeclaration>
			<itemBody>
				<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
					<a xlink:href="javascript:alert('XSS')"><text>click</text></a>
				</svg>
				<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
					<simpleChoice identifier="A">Choice A</simpleChoice>
				</choiceInteraction>
			</itemBody>
		</assessmentItem>`;

		const player = new Player({ itemXml: qtiXml });
		const html = player.getItemBodyHtml();
		expect(html.match(/xlink:href\s*=\s*["']javascript:/i)).toBeFalsy();
	});

	test('should block protocol-relative URLs in src attributes', () => {
		const qtiXml = `<?xml version="1.0"?>
		<assessmentItem ${NS} identifier="proto-relative" title="Proto Relative" adaptive="false" timeDependent="false">
			<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
				<correctResponse><value>A</value></correctResponse>
			</responseDeclaration>
			<itemBody>
				<img src="//evil.example/x.png" />
				<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
					<simpleChoice identifier="A">Choice A</simpleChoice>
				</choiceInteraction>
			</itemBody>
		</assessmentItem>`;

		const player = new Player({ itemXml: qtiXml });
		const html = player.getItemBodyHtml();
		expect(html).not.toContain('src="//evil.example');
	});
});

describe('XSS Prevention - User Response Storage', () => {
	test('should safely store user responses with malicious content', () => {
		const qtiXml = `<?xml version="1.0"?>
		<assessmentItem ${NS} identifier="response-storage" title="Response Storage" adaptive="false" timeDependent="false">
			<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string" />
			<itemBody>
				<textEntryInteraction responseIdentifier="RESPONSE" expectedLength="100" />
			</itemBody>
		</assessmentItem>`;

		const player = new Player({ itemXml: qtiXml });

		// User provides malicious content as response
		const maliciousResponse = '<img src=x onerror="alert(\'XSS\')">';
		player.setResponses({ RESPONSE: maliciousResponse });

		const state = player.getSessionState();
		const responseValue = state.RESPONSE;

		// Response should be stored (data layer doesn't sanitize)
		// But renderers must escape when displaying
		expect(responseValue).toBeDefined();
		expect(responseValue).toBe(maliciousResponse);
	});

	test('should handle script injection attempts in string responses', () => {
		const qtiXml = `<?xml version="1.0"?>
		<assessmentItem ${NS} identifier="string-response-xss" title="String Response XSS" adaptive="false" timeDependent="false">
			<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string" />
			<itemBody>
				<textEntryInteraction responseIdentifier="RESPONSE" expectedLength="50" />
			</itemBody>
		</assessmentItem>`;

		const player = new Player({ itemXml: qtiXml });

		const scriptAttempts = [
			'<script>alert("XSS")</script>',
			'"><script>alert(String.fromCharCode(88,83,83))</script>',
			'<img src=x onerror=alert(1)>',
			'javascript:alert(1)',
			'<svg/onload=alert(1)>',
			'\'><script>alert(document.cookie)</script>'
		];

		for (const attempt of scriptAttempts) {
			player.setResponses({ RESPONSE: attempt });
			const state = player.getSessionState();
			const stored = state.RESPONSE;

			// Data is stored as-is (no sanitization at storage layer)
			// Renderers must escape when displaying
			expect(stored).toBe(attempt);
		}
	});
});
