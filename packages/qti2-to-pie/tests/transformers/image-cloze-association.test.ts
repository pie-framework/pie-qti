/**
 * Image Cloze Association Transformer Tests
 */

import { describe, expect, test } from 'bun:test';
import { transformImageClozeAssociation } from '../../src/transformers/image-cloze-association.js';
import { createQtiWrapper } from '../test-utils.js';

describe('transformImageClozeAssociation', () => {
  test('should transform basic QTI graphicGapMatchInteraction to PIE image-cloze-association', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <correctResponse>
            <value>IMG1 ZONE1</value>
            <value>IMG2 ZONE2</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <p>Drag the correct images to the zones:</p>
          <graphicGapMatchInteraction responseIdentifier="RESPONSE">
            <img src="background.png" width="400" height="300"/>
            <gapImg identifier="IMG1"><img src="image1.png"/></gapImg>
            <gapImg identifier="IMG2"><img src="image2.png"/></gapImg>
            <associableHotspot identifier="ZONE1" coords="50,50,150,100" matchMax="1"/>
            <associableHotspot identifier="ZONE2" coords="200,100,300,150" matchMax="1"/>
          </graphicGapMatchInteraction>
        </itemBody>    `, 'ica-PLACEHOLDER', 'ICA Test');

    const result = transformImageClozeAssociation(qtiXml, 'ica-001');

    expect(result.id).toBe('ica-001');
    expect(result.uuid).toBeDefined();
    expect(result.config.models).toHaveLength(1);

    const model = result.config.models[0];
    expect(model.element).toBe('@pie-element/image-cloze-association');
    expect(model.prompt).toContain('Drag the correct images');
    expect(model.image.src).toBe('background.png');
    expect(model.image.width).toBe(400);
    expect(model.image.height).toBe(300);

    // Check response containers (converted to percentages)
    expect(model.responseContainers).toHaveLength(2);
    expect(model.responseContainers[0]).toEqual({
      x: 12.5, // 50/400 * 100
      y: 16.67, // 50/300 * 100
      width: '25%', // (150-50)/400 * 100
      height: '16.67%', // (100-50)/300 * 100
    });
    expect(model.responseContainers[1]).toEqual({
      x: 50, // 200/400 * 100
      y: 33.33, // 100/300 * 100
      width: '25%', // (300-200)/400 * 100
      height: '16.67%', // (150-100)/300 * 100
    });

    // Check possible responses
    expect(model.possibleResponses).toHaveLength(2);
    expect(model.possibleResponses[0]).toBe('<img src="image1.png">');
    expect(model.possibleResponses[1]).toBe('<img src="image2.png">');

    // Check validation
    expect(model.validation.scoringType).toBe('exactMatch');
    expect(model.validation.validResponse.score).toBe(1);
    expect(model.validation.validResponse.value).toHaveLength(2);
    expect(model.validation.validResponse.value[0].images).toEqual(['<img src="image1.png">']);
    expect(model.validation.validResponse.value[1].images).toEqual(['<img src="image2.png">']);

    expect(result.metadata?.searchMetaData?.itemType).toBe('ICA');
  });

  test('should handle multiple correct images per zone', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <correctResponse>
            <value>IMG1 ZONE1</value>
            <value>IMG2 ZONE1</value>
            <value>IMG3 ZONE2</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <graphicGapMatchInteraction responseIdentifier="RESPONSE">
            <img src="diagram.png" width="500" height="400"/>
            <gapImg identifier="IMG1">Apple</gapImg>
            <gapImg identifier="IMG2">Orange</gapImg>
            <gapImg identifier="IMG3">Carrot</gapImg>
            <associableHotspot identifier="ZONE1" coords="0,0,200,200" matchMax="2"/>
            <associableHotspot identifier="ZONE2" coords="300,0,500,200" matchMax="1"/>
          </graphicGapMatchInteraction>
        </itemBody>    `, 'ica-PLACEHOLDER', 'ICA Test');

    const result = transformImageClozeAssociation(qtiXml, 'ica-002');
    const model = result.config.models[0];

    // ZONE1 should have 2 correct images, ZONE2 should have 1
    expect(model.validation.validResponse.value[0].images).toEqual(['Apple', 'Orange']);
    expect(model.validation.validResponse.value[1].images).toEqual(['Carrot']);
  });

  test('should handle prompt inside interaction', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <correctResponse>
            <value>IMG1 ZONE1</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <graphicGapMatchInteraction responseIdentifier="RESPONSE">
            <prompt>Match the items by dragging them to the zones.</prompt>
            <img src="image.png" width="300" height="200"/>
            <gapImg identifier="IMG1">Item 1</gapImg>
            <associableHotspot identifier="ZONE1" coords="0,0,100,100" matchMax="1"/>
          </graphicGapMatchInteraction>
        </itemBody>    `, 'ica-PLACEHOLDER', 'ICA Test');

    const result = transformImageClozeAssociation(qtiXml, 'ica-003');
    const model = result.config.models[0];

    expect(model.prompt).toBe('Match the items by dragging them to the zones.');
  });

  test('should handle prompt before interaction', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <correctResponse>
            <value>IMG1 ZONE1</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <p>Look at the diagram below.</p>
          <p>Drag each label to its correct location.</p>
          <graphicGapMatchInteraction responseIdentifier="RESPONSE">
            <img src="diagram.png" width="400" height="300"/>
            <gapImg identifier="IMG1">Label A</gapImg>
            <associableHotspot identifier="ZONE1" coords="0,0,100,100" matchMax="1"/>
          </graphicGapMatchInteraction>
        </itemBody>    `, 'ica-PLACEHOLDER', 'ICA Test');

    const result = transformImageClozeAssociation(qtiXml, 'ica-004');
    const model = result.config.models[0];

    expect(model.prompt).toContain('Look at the diagram');
    expect(model.prompt).toContain('Drag each label');
  });

  test('should handle zones with no correct answers', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <correctResponse>
            <value>IMG1 ZONE1</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <graphicGapMatchInteraction responseIdentifier="RESPONSE">
            <img src="image.png" width="400" height="300"/>
            <gapImg identifier="IMG1">Correct Item</gapImg>
            <gapImg identifier="IMG2">Distractor</gapImg>
            <associableHotspot identifier="ZONE1" coords="0,0,200,150" matchMax="1"/>
            <associableHotspot identifier="ZONE2" coords="200,150,400,300" matchMax="1"/>
          </graphicGapMatchInteraction>
        </itemBody>    `, 'ica-PLACEHOLDER', 'ICA Test');

    const result = transformImageClozeAssociation(qtiXml, 'ica-005');
    const model = result.config.models[0];

    // ZONE1 has correct answer, ZONE2 has no correct answer (empty array)
    expect(model.validation.validResponse.value[0].images).toEqual(['Correct Item']);
    expect(model.validation.validResponse.value[1].images).toEqual([]);
  });

  test('should handle complex text content in gapImg', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <correctResponse>
            <value>IMG1 ZONE1</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <graphicGapMatchInteraction responseIdentifier="RESPONSE">
            <img src="image.png" width="300" height="200"/>
            <gapImg identifier="IMG1"><strong>Bold Text</strong> with <em>emphasis</em></gapImg>
            <associableHotspot identifier="ZONE1" coords="0,0,100,100" matchMax="1"/>
          </graphicGapMatchInteraction>
        </itemBody>    `, 'ica-PLACEHOLDER', 'ICA Test');

    const result = transformImageClozeAssociation(qtiXml, 'ica-006');
    const model = result.config.models[0];

    expect(model.possibleResponses[0]).toBe('<strong>Bold Text</strong> with <em>emphasis</em>');
    expect(model.validation.validResponse.value[0].images[0]).toBe('<strong>Bold Text</strong> with <em>emphasis</em>');
  });

  test('should support options', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <correctResponse>
            <value>IMG1 ZONE1</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <graphicGapMatchInteraction responseIdentifier="RESPONSE">
            <img src="image.png" width="300" height="200"/>
            <gapImg identifier="IMG1">Item</gapImg>
            <associableHotspot identifier="ZONE1" coords="0,0,100,100" matchMax="1"/>
          </graphicGapMatchInteraction>
        </itemBody>    `, 'ica-PLACEHOLDER', 'ICA Test');

    const result = transformImageClozeAssociation(qtiXml, 'ica-007', {
      partialScoring: true,
      duplicateResponses: true,
      maxResponsePerZone: 3,
      shuffleOptions: false,
      answerChoiceTransparency: true,
      responseAreaFill: 'rgba(0, 255, 0, 0.2)',
    });

    const model = result.config.models[0];
    expect(model.partialScoring).toBe(true);
    expect(model.duplicateResponses).toBe(true);
    expect(model.maxResponsePerZone).toBe(3);
    expect(model.shuffleOptions).toBe(false);
    expect(model.answerChoiceTransparency).toBe(true);
    expect(model.responseAreaFill).toBe('rgba(0, 255, 0, 0.2)');
  });

  test('should convert coordinates to percentages correctly', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <correctResponse>
            <value>IMG1 ZONE1</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <graphicGapMatchInteraction responseIdentifier="RESPONSE">
            <img src="image.png" width="1000" height="800"/>
            <gapImg identifier="IMG1">Test</gapImg>
            <associableHotspot identifier="ZONE1" coords="250,200,750,600" matchMax="1"/>
          </graphicGapMatchInteraction>
        </itemBody>    `, 'ica-PLACEHOLDER', 'ICA Test');

    const result = transformImageClozeAssociation(qtiXml, 'ica-008');
    const model = result.config.models[0];

    const container = model.responseContainers[0];
    expect(container.x).toBe(25); // 250/1000 * 100
    expect(container.y).toBe(25); // 200/800 * 100
    expect(container.width).toBe('50%'); // (750-250)/1000 * 100
    expect(container.height).toBe('50%'); // (600-200)/800 * 100
  });

  test('should throw error if no itemBody found', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <correctResponse>
            <value>IMG1 ZONE1</value>
          </correctResponse>
        </responseDeclaration>    `, 'ica-PLACEHOLDER', 'ICA Test');

    expect(() => transformImageClozeAssociation(qtiXml, 'ica-009')).toThrow(/Missing required element: itemBody/);
  });

  test('should throw error if no graphicGapMatchInteraction found', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <correctResponse>
            <value>IMG1 ZONE1</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <p>No interaction here</p>
        </itemBody>    `, 'ica-PLACEHOLDER', 'ICA Test');

    expect(() => transformImageClozeAssociation(qtiXml, 'ica-010')).toThrow(/Missing required interaction: graphicGapMatchInteraction/);
  });

  test('should throw error if no image found', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <correctResponse>
            <value>IMG1 ZONE1</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <graphicGapMatchInteraction responseIdentifier="RESPONSE">
            <gapImg identifier="IMG1">Item</gapImg>
            <associableHotspot identifier="ZONE1" coords="0,0,100,100" matchMax="1"/>
          </graphicGapMatchInteraction>
        </itemBody>    `, 'ica-PLACEHOLDER', 'ICA Test');

    expect(() => transformImageClozeAssociation(qtiXml, 'ica-011')).toThrow(/Missing required image in graphicGapMatchInteraction/);
  });

  test('should throw error if dimensions cannot be determined', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <correctResponse>
            <value>IMG1 ZONE1</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <graphicGapMatchInteraction responseIdentifier="RESPONSE">
            <img src="image.png"/>
            <gapImg identifier="IMG1">Item</gapImg>
            <associableHotspot identifier="ZONE1" coords="0,0,100,100" matchMax="1"/>
          </graphicGapMatchInteraction>
        </itemBody>    `, 'ica-PLACEHOLDER', 'ICA Test');

    expect(() => transformImageClozeAssociation(qtiXml, 'ica-012')).toThrow(/Cannot determine image dimensions/);
  });

  test('should handle multiple gapImg elements with various content types', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
          <correctResponse>
            <value>IMG1 ZONE1</value>
            <value>IMG2 ZONE2</value>
            <value>IMG3 ZONE3</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <graphicGapMatchInteraction responseIdentifier="RESPONSE">
            <img src="image.png" width="600" height="400"/>
            <gapImg identifier="IMG1"><img src="icon1.png"/></gapImg>
            <gapImg identifier="IMG2">Plain text</gapImg>
            <gapImg identifier="IMG3"><span class="label">Styled text</span></gapImg>
            <gapImg identifier="IMG4">Distractor</gapImg>
            <associableHotspot identifier="ZONE1" coords="0,0,200,133" matchMax="1"/>
            <associableHotspot identifier="ZONE2" coords="200,0,400,133" matchMax="1"/>
            <associableHotspot identifier="ZONE3" coords="400,0,600,133" matchMax="1"/>
          </graphicGapMatchInteraction>
        </itemBody>    `, 'ica-PLACEHOLDER', 'ICA Test');

    const result = transformImageClozeAssociation(qtiXml, 'ica-013');
    const model = result.config.models[0];

    expect(model.possibleResponses).toHaveLength(4);
    expect(model.possibleResponses[0]).toBe('<img src="icon1.png">');
    expect(model.possibleResponses[1]).toBe('Plain text');
    expect(model.possibleResponses[2]).toBe('<span class="label">Styled text</span>');
    expect(model.possibleResponses[3]).toBe('Distractor');

    expect(model.validation.validResponse.value[0].images).toEqual(['<img src="icon1.png">']);
    expect(model.validation.validResponse.value[1].images).toEqual(['Plain text']);
    expect(model.validation.validResponse.value[2].images).toEqual(['<span class="label">Styled text</span>']);
  });
});
