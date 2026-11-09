/**
 * templateDeclaration@paramVariable (QTI 2.2; QTI 3.0 `param-variable`): a `<param>` inside an
 * `<object>` whose `value` names such a template variable is delivered with the variable's
 * current value in place of the variable's name, so a plugin-style object receives the computed
 * parameter instead of a literal. The substitution resolves with the session's variables at
 * render time, like printedVariable: it follows newTemplate, setTemplateVariables and restore.
 */

import { describe, expect, test } from 'bun:test';
import { convertQti2ToQti3 } from '@pie-qti/qti-common';
import { Player } from '../../src/core/Player.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

const PARAM_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem ${NS} identifier="param-variable" title="Param variable" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
  <templateDeclaration identifier="PLUGIN" cardinality="single" baseType="integer" paramVariable="true"/>
  <templateDeclaration identifier="PLAIN" cardinality="single" baseType="integer"/>
  <itemBody>
    <p>Pick one, then the widget below.</p>
    <object data="widget.swf" type="application/x-plugin" width="300" height="200">
      <param name="count" value="PLUGIN" valuetype="DATA"/>
      <param name="plain" value="PLAIN" valuetype="DATA"/>
      <param name="ghost" value="UNDECLARED" valuetype="DATA"/>
    </object>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <simpleChoice identifier="A">A</simpleChoice>
      <simpleChoice identifier="B">B</simpleChoice>
    </choiceInteraction>
  </itemBody>
  <templateProcessing>
    <setTemplateValue identifier="PLUGIN"><randomInteger min="5" max="5"/></setTemplateValue>
    <setTemplateValue identifier="PLAIN"><randomInteger min="9" max="9"/></setTemplateValue>
  </templateProcessing>
  <responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
</assessmentItem>`;

/** No template processing: the declared default (8) is the current value from the start. */
const DEFAULT_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem ${NS} identifier="param-variable-default" title="Param variable default" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
  <templateDeclaration identifier="WIDGET" cardinality="single" baseType="string" paramVariable="true">
    <defaultValue><value>widget-8.swf</value></defaultValue>
  </templateDeclaration>
  <itemBody>
    <object data="loader.swf" type="application/x-plugin">
      <param name="src" value="WIDGET" valuetype="DATA"/>
    </object>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <simpleChoice identifier="A">A</simpleChoice>
    </choiceInteraction>
  </itemBody>
  <responseProcessing>
    <setOutcomeValue identifier="SCORE"><baseValue baseType="float">1</baseValue></setOutcomeValue>
  </responseProcessing>
</assessmentItem>`;

/** A param whose value is a variable name but whose variable is NULL or a container stays literal. */
const NULL_AND_CONTAINER_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem ${NS} identifier="param-variable-guard" title="Param variable guards" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
  <templateDeclaration identifier="NULLVAR" cardinality="single" baseType="integer" paramVariable="true"/>
  <templateDeclaration identifier="SET" cardinality="ordered" baseType="integer" paramVariable="true">
    <defaultValue><value>1</value><value>2</value></defaultValue>
  </templateDeclaration>
  <itemBody>
    <object data="widget.swf" type="application/x-plugin">
      <param name="n" value="NULLVAR" valuetype="DATA"/>
      <param name="set" value="SET" valuetype="DATA"/>
    </object>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <simpleChoice identifier="A">A</simpleChoice>
    </choiceInteraction>
  </itemBody>
  <responseProcessing>
    <setOutcomeValue identifier="SCORE"><baseValue baseType="float">1</baseValue></setOutcomeValue>
  </responseProcessing>
</assessmentItem>`;

const QTI30 = convertQti2ToQti3(PARAM_ITEM);

/** Delivered `<param ...>` markup, with namespace declarations normalized away. */
function paramMarkup(html: string): string[] {
	return String(html)
		.replace(/\s+xmlns="[^"]*"/g, '')
		.match(/<param[^>]*>/g) ?? [];
}

function makePlayer(itemXml: string): Player {
	// The plugin-style `object` scenario only exists in delivery when the host allows object
	// embeds; the sanitizer drops (or replaces) the object and its params otherwise.
	return new Player({ itemXml, security: { allowObjectEmbeds: true } });
}

describe('templateDeclaration@paramVariable delivery', () => {
	test.each([
		['QTI 2.2', PARAM_ITEM],
		['QTI 3.0 (converted)', QTI30],
	])('%s: the param value names the variable, delivery carries its value', (_version, itemXml) => {
		const player = makePlayer(itemXml);
		expect(player.getSessionState()).toMatchObject({ PLUGIN: 5, PLAIN: 9 });

		const params = paramMarkup(player.getItemBodyHtml());
		expect(params.some((p) => p.includes('name="count"') && p.includes('value="5"'))).toBe(true);

		// A template without paramVariable and an undeclared name deliver literally.
		expect(params.some((p) => p.includes('name="plain"') && p.includes('value="PLAIN"'))).toBe(true);
		expect(params.some((p) => p.includes('name="ghost"') && p.includes('value="UNDECLARED"'))).toBe(true);
		expect(params.some((p) => p.includes('value="PLUGIN"'))).toBe(false);
		player.destroy();
	});

	test('the substituted value tracks setTemplateVariables without re-parsing', () => {
		const player = makePlayer(PARAM_ITEM);
		player.setTemplateVariables({ PLUGIN: 42 });
		expect(paramMarkup(player.getItemBodyHtml())).toContainEqual(
			expect.stringContaining('value="42"'),
		);
		player.destroy();
	});

	test('newTemplate re-expands the param with the new instance’s value', () => {
		const player = makePlayer(PARAM_ITEM);
		player.setTemplateVariables({ PLUGIN: 42 });
		const result = player.newTemplate();
		expect(result.sessionState.templateVariables.PLUGIN.value).toBe(5);
		expect(paramMarkup(player.getItemBodyHtml())).toContainEqual(
			expect.stringContaining('value="5"'),
		);
		player.destroy();
	});

	test('a restored session delivers the restored variable value', () => {
		const player = makePlayer(PARAM_ITEM);
		player.setTemplateVariables({ PLUGIN: 77 });
		const saved = player.saveItemSession();
		player.destroy();

		const restored = makePlayer(PARAM_ITEM);
		restored.restoreItemSession(saved);
		expect(paramMarkup(restored.getItemBodyHtml())).toContainEqual(
			expect.stringContaining('value="77"'),
		);
		restored.destroy();
	});

	test('the declared default substitutes when no template processing runs', () => {
		const player = makePlayer(DEFAULT_ITEM);
		const params = paramMarkup(player.getItemBodyHtml());
		expect(params).toContainEqual(expect.stringContaining('value="widget-8.swf"'));
		expect(params.some((p) => p.includes('value="WIDGET"'))).toBe(false);
		player.destroy();
	});

	test('NULL and container values stay literal', () => {
		const player = makePlayer(NULL_AND_CONTAINER_ITEM);
		const params = paramMarkup(player.getItemBodyHtml());
		expect(params).toContainEqual(expect.stringContaining('value="NULLVAR"'));
		expect(params).toContainEqual(expect.stringContaining('value="SET"'));
		player.destroy();
	});
});
