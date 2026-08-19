/**
 * Composite-item conversion, ported from Composer's own characterization suite
 * (`package-transformer.test.ts`) to confirm the merged planner/registry/plugin
 * machinery reproduces Composer's tested behavior under pie-qti's node-html-parser (9.x
 * here vs Composer's 7.x) and pie-qti's own error hierarchy.
 *
 * Composer's originals assert rejection by awaiting a *thrown* `transformQtiPackageToPie`
 * promise, because Composer's package transformer only catches `QtiSourceProfileTransformError`
 * — every one of these composite-rejection paths throws a plain `Error` there, so a single bad
 * composite item aborts the whole package. Here the same rejections are threaded through
 * `QtiUnsupportedItemError`, so the assertions below check the failed item result instead: the
 * package call returns normally, and only the offending item is marked failed.
 */

import { describe, expect, test } from 'bun:test';
import { transformQtiPackageToPie } from '../src/package-transformer';

async function transformedSingleItem(itemXml: string) {
  const files = new Map([['items/item.xml', itemXml]]);
  const manifestXml = `
<manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1">
  <resources>
    <resource identifier="ITEM" type="imsqti_item_xmlv2p2" href="items/item.xml"><file href="items/item.xml"/></resource>
  </resources>
</manifest>`;
  return await transformQtiPackageToPie({
    packageId: 'composite',
    manifestXml,
    fileAccess: {
      async readText(packagePath: string) {
        return files.get(packagePath) ?? null;
      },
      async listFiles() {
        return [...files.keys()];
      },
    },
  });
}

function failedItem(result: Awaited<ReturnType<typeof transformedSingleItem>>) {
  return result.itemResults.find((item) => item.resourceId === 'ITEM');
}

describe('composite conversion', () => {
  test('converts a composite item with multiple supported built-in interactions', async () => {
    const result = await transformedSingleItem(`
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="composite" title="Composite">
  <responseDeclaration identifier="CHOICE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <responseDeclaration identifier="TEXT" cardinality="single" baseType="string">
    <correctResponse><value>42</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <p>Answer both parts.</p>
    <choiceInteraction responseIdentifier="CHOICE" maxChoices="1">
      <simpleChoice identifier="A">A</simpleChoice>
      <simpleChoice identifier="B">B</simpleChoice>
    </choiceInteraction>
    <p>Explain: <textEntryInteraction responseIdentifier="TEXT" expectedLength="4"/></p>
  </itemBody>
</assessmentItem>`);

    expect(failedItem(result)?.status).toBe('transformed');
    const item = (result.items[0] as any).content;
    expect(item.config.models.map((model: any) => model.element)).toEqual(
      expect.arrayContaining(['multiple-choice', 'explicit-constructed-response'])
    );
    expect(item.config.models).toHaveLength(2);
    expect(item.config.markup).toContain('<p>Answer both parts.</p>');
    expect(item.config.markup).toContain('<multiple-choice');
    expect(item.config.markup).toContain('<explicit-constructed-response');
    expect(item.config.markup.indexOf('<multiple-choice')).toBeLessThan(
      item.config.markup.indexOf('<explicit-constructed-response')
    );
    expect(item.config.markup).not.toContain('choiceInteraction');
    expect(item.config.markup).not.toContain('textEntryInteraction');
    const multipleChoice = item.config.models.find(
      (model: any) => model.element === 'multiple-choice'
    );
    const ecr = item.config.models.find(
      (model: any) => model.element === 'explicit-constructed-response'
    );
    expect(multipleChoice.prompt).toBe('');
    expect(ecr.markup).toBe('{{0}}');
    expect(Object.values(item.config.elements)).toEqual(
      expect.arrayContaining([
        '@pie-element/multiple-choice@latest',
        '@pie-element/explicit-constructed-response@latest',
      ])
    );
  });

  test('preserves reversed document order in composite item markup', async () => {
    const result = await transformedSingleItem(`
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="reverse-composite">
  <responseDeclaration identifier="ORDER_RESPONSE" cardinality="ordered" baseType="identifier">
    <correctResponse><value>ONE</value><value>TWO</value></correctResponse>
  </responseDeclaration>
  <responseDeclaration identifier="CHOICE_RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <p>Order first.</p>
    <orderInteraction responseIdentifier="ORDER_RESPONSE">
      <simpleChoice identifier="ONE">One</simpleChoice>
      <simpleChoice identifier="TWO">Two</simpleChoice>
    </orderInteraction>
    <p>Then choose.</p>
    <choiceInteraction responseIdentifier="CHOICE_RESPONSE" maxChoices="1">
      <simpleChoice identifier="A">A</simpleChoice>
      <simpleChoice identifier="B">B</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`);

    const item = (result.items[0] as any).content;

    expect(item.config.models.map((model: any) => model.element)).toEqual([
      'placement-ordering',
      'multiple-choice',
    ]);
    expect(item.config.markup.indexOf('<placement-ordering')).toBeLessThan(
      item.config.markup.indexOf('<multiple-choice')
    );
  });

  test('preserves repeated same-type block interactions as separate composite models', async () => {
    const result = await transformedSingleItem(`
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="repeated-order">
  <responseDeclaration identifier="FIRST_ORDER" cardinality="ordered" baseType="identifier">
    <correctResponse><value>A</value><value>B</value></correctResponse>
  </responseDeclaration>
  <responseDeclaration identifier="SECOND_ORDER" cardinality="ordered" baseType="identifier">
    <correctResponse><value>C</value><value>D</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <p>First order.</p>
    <orderInteraction responseIdentifier="FIRST_ORDER">
      <simpleChoice identifier="A">A</simpleChoice>
      <simpleChoice identifier="B">B</simpleChoice>
    </orderInteraction>
    <p>Second order.</p>
    <orderInteraction responseIdentifier="SECOND_ORDER">
      <simpleChoice identifier="C">C</simpleChoice>
      <simpleChoice identifier="D">D</simpleChoice>
    </orderInteraction>
  </itemBody>
</assessmentItem>`);

    const item = (result.items[0] as any).content;

    expect(item.config.models.map((model: any) => model.element)).toEqual([
      'placement-ordering',
      'placement-ordering',
    ]);
    expect(item.config.markup.match(/<placement-ordering/g)).toHaveLength(2);
  });

  test('preserves two independent choice interactions instead of coercing them to EBSR', async () => {
    const result = await transformedSingleItem(`
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="two-independent-choice">
  <responseDeclaration identifier="FIRST" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <responseDeclaration identifier="SECOND" cardinality="single" baseType="identifier">
    <correctResponse><value>C</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <p>First question.</p>
    <choiceInteraction responseIdentifier="FIRST">
      <simpleChoice identifier="A">A</simpleChoice>
      <simpleChoice identifier="B">B</simpleChoice>
    </choiceInteraction>
    <p>Second question.</p>
    <choiceInteraction responseIdentifier="SECOND">
      <simpleChoice identifier="C">C</simpleChoice>
      <simpleChoice identifier="D">D</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`);

    const item = (result.items[0] as any).content;

    expect(item.config.models.map((model: any) => model.element)).toEqual([
      'multiple-choice',
      'multiple-choice',
    ]);
    expect(item.config.markup.match(/<multiple-choice/g)).toHaveLength(2);
    expect(item.config.models[0].choices.map((choice: any) => choice.label)).toEqual(['A', 'B']);
    expect(item.config.models[1].choices.map((choice: any) => choice.label)).toEqual(['C', 'D']);
  });

  test('uses the primary interaction model for composite placeholders when parts emit passages', async () => {
    const result = await transformedSingleItem(`
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="composite-passage-placeholder">
  <responseDeclaration identifier="CHOICE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <responseDeclaration identifier="TEXT" cardinality="single" baseType="string">
    <correctResponse><value>42</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <stimulus><p>Shared passage.</p></stimulus>
    <choiceInteraction responseIdentifier="CHOICE">
      <simpleChoice identifier="A">A</simpleChoice>
      <simpleChoice identifier="B">B</simpleChoice>
    </choiceInteraction>
    <p>Explain: <textEntryInteraction responseIdentifier="TEXT"/></p>
  </itemBody>
</assessmentItem>`);

    const item = (result.items[0] as any).content;

    expect(item.config.models.map((model: any) => model.element)).toContain('passage');
    expect(item.config.markup).toContain('<multiple-choice');
    expect(item.config.markup.indexOf('<multiple-choice')).toBeLessThan(
      item.config.markup.indexOf('<explicit-constructed-response')
    );
  });

  test('rejects composites that include unsupported known QTI interactions as a per-item failure', async () => {
    const result = await transformedSingleItem(`
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="choice-upload">
  <responseDeclaration identifier="CHOICE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <choiceInteraction responseIdentifier="CHOICE">
      <simpleChoice identifier="A">A</simpleChoice>
    </choiceInteraction>
    <uploadInteraction responseIdentifier="UPLOAD"/>
  </itemBody>
</assessmentItem>`);

    expect(failedItem(result)?.status).toBe('failed');
    expect(failedItem(result)?.message).toContain(
      'Unsupported composite QTI item choice-upload: uploadInteraction'
    );
  });

  test('rejects composites that include unsupported custom interactions as a per-item failure', async () => {
    const result = await transformedSingleItem(`
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="choice-custom">
  <responseDeclaration identifier="CHOICE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <responseDeclaration identifier="TEXT" cardinality="single" baseType="string">
    <correctResponse><value>42</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <choiceInteraction responseIdentifier="CHOICE">
      <simpleChoice identifier="A">A</simpleChoice>
    </choiceInteraction>
    <p><textEntryInteraction responseIdentifier="TEXT"/></p>
    <customInteraction responseIdentifier="CUSTOM"/>
  </itemBody>
</assessmentItem>`);

    expect(failedItem(result)?.status).toBe('failed');
    expect(failedItem(result)?.message).toContain(
      'Unsupported customInteraction with standard interaction(s):'
    );
  });

  test('rejects composites that include unsupported custom operators as a per-item failure', async () => {
    const result = await transformedSingleItem(`
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="choice-custom-operator">
  <responseDeclaration identifier="CHOICE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <responseDeclaration identifier="TEXT" cardinality="single" baseType="string">
    <correctResponse><value>42</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <choiceInteraction responseIdentifier="CHOICE">
      <simpleChoice identifier="A">A</simpleChoice>
    </choiceInteraction>
    <p><textEntryInteraction responseIdentifier="TEXT"/></p>
  </itemBody>
  <responseProcessing>
    <responseCondition>
      <responseIf>
        <customOperator class="opaque"/>
      </responseIf>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`);

    expect(failedItem(result)?.status).toBe('failed');
    expect(failedItem(result)?.message).toContain(
      'Unsupported customOperator in item choice-custom-operator'
    );
  });

  test('preserves repeated matchInteraction units as separate composite models', async () => {
    const result = await transformedSingleItem(`
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="repeated-match">
  <responseDeclaration identifier="FIRST_MATCH" cardinality="directedPair" baseType="directedPair">
    <correctResponse><value>A X</value></correctResponse>
  </responseDeclaration>
  <responseDeclaration identifier="SECOND_MATCH" cardinality="directedPair" baseType="directedPair">
    <correctResponse><value>C Z</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <matchInteraction responseIdentifier="FIRST_MATCH">
      <simpleMatchSet><simpleAssociableChoice identifier="A" matchMax="1">A</simpleAssociableChoice></simpleMatchSet>
      <simpleMatchSet><simpleAssociableChoice identifier="X" matchMax="1">X</simpleAssociableChoice></simpleMatchSet>
    </matchInteraction>
    <matchInteraction responseIdentifier="SECOND_MATCH">
      <simpleMatchSet><simpleAssociableChoice identifier="C" matchMax="1">C</simpleAssociableChoice></simpleMatchSet>
      <simpleMatchSet><simpleAssociableChoice identifier="Z" matchMax="1">Z</simpleAssociableChoice></simpleMatchSet>
    </matchInteraction>
  </itemBody>
</assessmentItem>`);

    expect(failedItem(result)?.status).toBe('transformed');
    const item = (result.items[0] as any).content;
    expect(item.config.models.map((model: any) => model.element)).toEqual([
      'match-list',
      'match-list',
    ]);
  });

  test('converts mixed composites with matchInteraction', async () => {
    const result = await transformedSingleItem(`
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="choice-match">
  <responseDeclaration identifier="CHOICE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <responseDeclaration identifier="MATCH" cardinality="directedPair" baseType="directedPair">
    <correctResponse><value>P R</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <choiceInteraction responseIdentifier="CHOICE">
      <simpleChoice identifier="A">A</simpleChoice>
    </choiceInteraction>
    <matchInteraction responseIdentifier="MATCH">
      <simpleMatchSet><simpleAssociableChoice identifier="P" matchMax="1">P</simpleAssociableChoice></simpleMatchSet>
      <simpleMatchSet><simpleAssociableChoice identifier="R" matchMax="1">R</simpleAssociableChoice></simpleMatchSet>
    </matchInteraction>
  </itemBody>
</assessmentItem>`);

    expect(failedItem(result)?.status).toBe('transformed');
    const item = (result.items[0] as any).content;
    expect(item.config.models.map((model: any) => model.element)).toEqual([
      'multiple-choice',
      'match-list',
    ]);
  });

  test('converts mixed composites with hotspotInteraction', async () => {
    const result = await transformedSingleItem(`
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="choice-hotspot">
  <responseDeclaration identifier="CHOICE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <responseDeclaration identifier="HOTSPOT" cardinality="single" baseType="identifier">
    <correctResponse><value>H</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <choiceInteraction responseIdentifier="CHOICE">
      <simpleChoice identifier="A">A</simpleChoice>
    </choiceInteraction>
    <hotspotInteraction responseIdentifier="HOTSPOT" maxChoices="1">
      <object data="image.png" type="image/png" width="100" height="100"/>
      <hotspotChoice identifier="H" shape="rect" coords="0,0,10,10"/>
    </hotspotInteraction>
  </itemBody>
</assessmentItem>`);

    expect(failedItem(result)?.status).toBe('transformed');
    const item = (result.items[0] as any).content;
    expect(item.config.models.map((model: any) => model.element)).toEqual([
      'multiple-choice',
      'hotspot',
    ]);
  });

  test('rejects interactions nested inside feedbackBlock instead of planning them as normal content', async () => {
    const result = await transformedSingleItem(`
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="feedback-interaction">
  <responseDeclaration identifier="CHOICE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <outcomeDeclaration identifier="FEEDBACK" cardinality="single" baseType="identifier"/>
  <itemBody>
    <choiceInteraction responseIdentifier="CHOICE">
      <simpleChoice identifier="A">A</simpleChoice>
      <simpleChoice identifier="B">B</simpleChoice>
    </choiceInteraction>
    <feedbackBlock outcomeIdentifier="FEEDBACK" identifier="needs-more" showHide="show">
      <p>Try this follow-up.</p>
      <textEntryInteraction responseIdentifier="FOLLOW_UP"/>
    </feedbackBlock>
  </itemBody>
</assessmentItem>`);

    expect(failedItem(result)?.status).toBe('failed');
    expect(failedItem(result)?.message).toContain('Unsupported interaction inside feedbackBlock');
  });

  test('converts mixed composites with multi-blank inline groups, scoped to their own span', async () => {
    const result = await transformedSingleItem(`
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="multi-blank-composite">
  <responseDeclaration identifier="A" cardinality="single" baseType="string">
    <correctResponse><value>alpha</value></correctResponse>
  </responseDeclaration>
  <responseDeclaration identifier="B" cardinality="single" baseType="string">
    <correctResponse><value>beta</value></correctResponse>
  </responseDeclaration>
  <responseDeclaration identifier="CHOICE" cardinality="single" baseType="identifier">
    <correctResponse><value>C</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <p><textEntryInteraction responseIdentifier="A"/> then <textEntryInteraction responseIdentifier="B"/></p>
    <choiceInteraction responseIdentifier="CHOICE">
      <simpleChoice identifier="C">C</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`);

    expect(failedItem(result)?.status).toBe('transformed');
    const item = (result.items[0] as any).content;
    expect(item.config.models.map((model: any) => model.element)).toEqual([
      'explicit-constructed-response',
      'multiple-choice',
    ]);
    const ecr = item.config.models[0];
    expect(ecr.markup).toBe('<p>{{0}} then {{1}}</p>');
    // The sibling choiceInteraction's own content stays out of the ECR unit's
    // bounded markup — it doesn't reach past its own local span.
    expect(ecr.markup).not.toContain('C');
  });

  test('preserves repeated separate textEntryInteraction units, bounded to their own span', async () => {
    const result = await transformedSingleItem(`
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="repeated-separate-text-entry">
  <responseDeclaration identifier="A" cardinality="single" baseType="string">
    <correctResponse><value>alpha</value></correctResponse>
  </responseDeclaration>
  <responseDeclaration identifier="B" cardinality="single" baseType="string">
    <correctResponse><value>beta</value></correctResponse>
  </responseDeclaration>
  <responseDeclaration identifier="CHOICE" cardinality="single" baseType="identifier">
    <correctResponse><value>C</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <p>First blank: <textEntryInteraction responseIdentifier="A"/></p>
    <choiceInteraction responseIdentifier="CHOICE">
      <simpleChoice identifier="C">C</simpleChoice>
    </choiceInteraction>
    <p>Second blank: <textEntryInteraction responseIdentifier="B"/></p>
  </itemBody>
</assessmentItem>`);

    expect(failedItem(result)?.status).toBe('transformed');
    const item = (result.items[0] as any).content;
    expect(item.config.models.map((model: any) => model.element)).toEqual([
      'explicit-constructed-response',
      'multiple-choice',
      'explicit-constructed-response',
    ]);
    expect(item.config.markup.match(/<explicit-constructed-response/g)).toHaveLength(2);
  });

  test('reports a missing itemBody as a specific, per-item conversion blocker', async () => {
    const result = await transformedSingleItem(`
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="missing-body" title="Missing Body">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
</assessmentItem>`);

    expect(failedItem(result)?.status).toBe('failed');
    expect(failedItem(result)?.message).toContain('QTI item missing-body is missing itemBody');
  });

  test('reports an empty assessmentItem as a specific, per-item conversion blocker', async () => {
    const result = await transformedSingleItem(`
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="empty-item" title="Empty">
  <itemBody><p>Read this stem and answer.</p></itemBody>
</assessmentItem>`);

    expect(failedItem(result)?.status).toBe('failed');
    expect(failedItem(result)?.message).toContain('QTI item empty-item has no QTI interaction in itemBody');
  });
});
