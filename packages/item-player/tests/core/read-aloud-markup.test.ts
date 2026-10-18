/**
 * Read-aloud markup in delivery: a QTI 2.2 item and its QTI 3.0 twin render SSML docked under
 * catalog idrefs and unwrapped from the visible body, and suppression in the attribute the PIE
 * read-aloud tools read.
 */

import { describe, expect, test } from 'bun:test';
import { convertQti2ToQti3 } from '@pie-qti/qti-common';
import { Player } from '../../src/core/Player.js';

const QTI22 = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" xmlns:ssml="http://www.w3.org/2010/10/synthesis"
  identifier="read-aloud" title="Read aloud" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <itemBody>
    <p class="formula">Water is <ssml:sub alias="water">H2O</ssml:sub>.</p>
    <p class="slow" data-ssml="&lt;speak&gt;&lt;prosody rate=&quot;slow&quot;&gt;Read slowly&lt;/prosody&gt;&lt;/speak&gt;">Read slowly</p>
    <p class="answer" data-qti-suppress-tts="computer-read-aloud">photosynthesis</p>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <simpleChoice identifier="A">A</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;

const QTI30 = convertQti2ToQti3(QTI22);

/** Markup without namespace declarations, which differ by QTI version. */
const markup = (html: unknown) => String(html).replace(/\s+xmlns="[^"]*"/g, '');

describe('read-aloud markup in delivery', () => {
	test.each([
		['QTI 2.2', QTI22],
		['QTI 3.0', QTI30],
	])('%s docks SSML and restates suppression in the rendered body', (_version, xml) => {
		const body = markup(new Player({ itemXml: xml }).getItemBodyHtml());
		expect(body).toMatch(/<p class="formula" data-catalog-idref="ssml-2">Water is H2O\.<\/p>/);
		expect(body).toMatch(/<p class="slow"[^>]* data-catalog-idref="ssml-1">Read slowly<\/p>/);
		expect(body).toMatch(/<p class="answer"[^>]* data-tts-suppress="computer-read-aloud">photosynthesis<\/p>/);
		expect(body).not.toMatch(/ssml:|<sub\b/);
	});
});
