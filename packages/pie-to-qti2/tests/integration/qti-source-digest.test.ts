/**
 * Embedded QTI source: an item imported by to-pie is exported as its original QTI only while its
 * config still has the digest to-pie recorded.
 */

import { describe, expect, test } from 'bun:test';
import { QtiToPiePlugin } from '@pie-qti/to-pie';
import type { PieItem } from '@pie-qti/transform-types';
import { PieToQtiPlugin } from '../../src/plugin.js';

const qti21Xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1" identifier="choice-21" title="QTI 2.1 Choice" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
      <prompt>Pick A.</prompt>
      <simpleChoice identifier="A">A</simpleChoice>
      <simpleChoice identifier="B">B</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;

describe('Embedded QTI source', () => {
  const logger = { debug() {}, info() {}, warn() {}, error() {} };
  const pieToQti = new PieToQtiPlugin();

  async function imported(): Promise<PieItem> {
    const output = await new QtiToPiePlugin().transform({ content: qti21Xml }, { logger });
    return output.items[0].content as PieItem;
  }

  test('an unchanged config exports the original QTI with its version', async () => {
    const output = await pieToQti.transform({ content: await imported() }, { logger });

    expect(output.items[0].content).toBe(qti21Xml);
    expect(output.format).toBe('qti21');
    expect(output.items[0].format).toBe('qti21');
  });

  test('a config edited after import is generated afresh', async () => {
    const item = await imported();
    item.config.models[0].prompt = 'Pick B.';

    const output = await pieToQti.transform({ content: item }, { logger });

    expect(output.items[0].content).not.toBe(qti21Xml);
    expect(output.items[0].content).toContain('Pick B.');
    expect(output.format).toBe('qti22');
    expect(output.metadata.warnings).toContainEqual(expect.stringContaining('changed after import'));
  });

  test('an embedded source without a digest is generated afresh', async () => {
    const item = await imported();
    delete item.metadata?.qtiSource?.metadata?.configDigest;

    const output = await pieToQti.transform({ content: item }, { logger });

    expect(output.items[0].content).not.toBe(qti21Xml);
    expect(output.metadata.warnings).toContainEqual(expect.stringContaining('has no digest'));
  });
});
