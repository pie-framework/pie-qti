/**
 * QTI 2.2 to PIE Plugin Tests
 */

import { describe, expect, test } from 'bun:test';
import { SilentLogger, TransformEngine } from '@pie-qti/transform-core';
import { Qti22ToPiePlugin } from '../src/plugin';

const sampleQtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                identifier="choice-001"
                title="Sample Multiple Choice"
                adaptive="false"
                timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>choiceA</value>
    </correctResponse>
  </responseDeclaration>
  <itemBody>
    <p>What is 2 + 2?</p>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1" shuffle="false">
      <simpleChoice identifier="choiceA">4</simpleChoice>
      <simpleChoice identifier="choiceB">3</simpleChoice>
      <simpleChoice identifier="choiceC">5</simpleChoice>
      <simpleChoice identifier="choiceD">22</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;

describe('Qti22ToPiePlugin', () => {
  test('should identify as correct plugin', () => {
    const plugin = new Qti22ToPiePlugin();

    expect(plugin.id).toBe('qti22-to-pie');
    expect(plugin.sourceFormat).toBe('qti22');
    expect(plugin.targetFormat).toBe('pie');
  });

  test('should detect QTI 2.2 content', async () => {
    const plugin = new Qti22ToPiePlugin();

    const canHandle = await plugin.canHandle({
      content: sampleQtiXml,
    });

    expect(canHandle).toBe(true);
  });

  test('should reject non-QTI content', async () => {
    const plugin = new Qti22ToPiePlugin();

    const canHandle = await plugin.canHandle({
      content: '{ "id": "test", "type": "pie" }',
    });

    expect(canHandle).toBe(false);
  });

  test('should transform QTI to PIE', async () => {
    const plugin = new Qti22ToPiePlugin();

    const output = await plugin.transform(
      { content: sampleQtiXml },
      { logger: new SilentLogger() }
    );

    expect(output.items.length).toBe(1);
    expect(output.format).toBe('pie');
    expect(output.items[0].content.id).toBe('choice-001');
    expect(output.items[0].content.metadata?.searchMetaData.title).toBe('Sample Multiple Choice');
  });

  test('should work with TransformEngine', async () => {
    const engine = new TransformEngine();
    const plugin = new Qti22ToPiePlugin();

    engine.use(plugin);

    const output = await engine.transform(sampleQtiXml, {
      sourceFormat: 'qti22',
      targetFormat: 'pie',
      logger: new SilentLogger(),
    });

    expect(output.items.length).toBe(1);
    expect(output.items[0].content.id).toBe('choice-001');
    expect(output.metadata.pluginId).toBe('qti22-to-pie');
  });
});
