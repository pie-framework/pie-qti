import { describe, expect, test } from 'bun:test';
import { Player } from '../../src/core/Player.js';

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="test">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <simpleChoice identifier="A">Choice A</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;

describe('Player without an i18n provider', () => {
	test('renders English, not message keys', () => {
		const i18n = new Player({ itemXml: xml }).getI18nProvider();
		expect(i18n.getLocale()).toBe('en-US');
		expect(i18n.t('common.submit')).toBe('Submit');
		expect(i18n.getDirection()).toBe('ltr');
	});
});
