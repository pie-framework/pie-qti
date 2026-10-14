/**
 * Embedded QTI source: an item imported by to-pie is exported as its original QTI only while its
 * config still has the digest to-pie recorded, and only to a target of the same version family.
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

  test('a QTI 2.x source is generated afresh for a QTI 3.0 target, and a QTI 3.0 source is kept', async () => {
    const qti30 = new PieToQtiPlugin({ targetVersion: '3.0' });
    const output = await qti30.transform({ content: await imported() }, { logger });

    expect(output.format).toBe('qti30');
    expect(output.items[0].content).toContain('<qti-choice-interaction');
    expect(output.metadata.warnings).toContainEqual(
      expect.stringContaining('QTI 2.1 source is not re-emitted for a QTI 3.0 export')
    );

    const qti30Xml = output.items[0].content as string;
    const reimported = (await new QtiToPiePlugin().transform({ content: qti30Xml }, { logger })).items[0]
      .content as PieItem;
    const again = await qti30.transform({ content: reimported }, { logger });
    expect(again.items[0].content).toBe(qti30Xml);
    expect(again.format).toBe('qti30');

    const toQti22 = await pieToQti.transform({ content: reimported }, { logger });
    expect(toQti22.format).toBe('qti22');
    expect(toQti22.metadata.warnings).toContainEqual(
      expect.stringContaining('QTI 3.0 source is not re-emitted for a QTI 2.2 export')
    );
  });

  test('an embedded source without a digest is generated afresh', async () => {
    const item = await imported();
    delete item.metadata?.qtiSource?.metadata?.configDigest;

    const output = await pieToQti.transform({ content: item }, { logger });

    expect(output.items[0].content).not.toBe(qti21Xml);
    expect(output.metadata.warnings).toContainEqual(expect.stringContaining('has no digest'));
  });
});
