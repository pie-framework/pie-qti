/**
 * Passage Transformer Tests
 */

import { describe, expect, test } from 'bun:test';
import { transformPassage } from '../../src/transformers/passage.js';
import { createQtiWrapper } from '../test-utils.js';

describe('transformPassage', () => {
  test('should transform assessmentPassage to PIE passage', () => {
    const qtiXml = `
      <assessmentPassage title="The Solar System">
        <partBody>
          <h2>Introduction to the Solar System</h2>
          <p>The solar system consists of the Sun and everything that orbits around it.</p>
          <p>This includes eight planets, their moons, and countless smaller objects.</p>
        </partBody>
      </assessmentPassage>
    `;

    const result = transformPassage(qtiXml, 'passage-001');

    expect(result.id).toBe('passage-001');
    expect(result.uuid).toBeDefined();
    expect(result.config.models).toHaveLength(1);

    const model = result.config.models[0];
    expect(model.element).toBe('@pie-element/passage');
    expect(model.passages).toHaveLength(1);

    const passage = model.passages[0];
    expect(passage.title).toBe('The Solar System');
    expect(passage.text).toContain('Introduction to the Solar System');
    expect(passage.text).toContain('eight planets');

    expect(model.titleEnabled).toBe(true);
    expect(model.subtitleEnabled).toBe(false);
    expect(model.authorEnabled).toBe(false);
    expect(model.textEnabled).toBe(true);
    expect(model.teacherInstructionsEnabled).toBe(false);

    expect(result.metadata?.searchMetaData?.itemType).toBe('PASSAGE');
  });

  test('should transform assessmentStimulus (QTI 2.2 correct format) to PIE passage', () => {
    const qtiXml = `
      <assessmentStimulus xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                          title="Historical Context"
                          identifier="stimulus-001">
        <stimulusBody>
          <p>The American Revolution began in 1775...</p>
          <p>It was a pivotal moment in history.</p>
        </stimulusBody>
      </assessmentStimulus>
    `;

    const result = transformPassage(qtiXml, 'passage-002');
    const model = result.config.models[0];
    const passage = model.passages[0];

    expect(passage.title).toBe('Historical Context');
    expect(passage.text).toContain('American Revolution');
    expect(passage.text).toContain('pivotal moment');
  });

  test('should transform assessmentStimulus with itemBody (non-conformant content support)', () => {
    const qtiXml = `
      <assessmentStimulus title="Historical Context">
        <itemBody>
          <p>The American Revolution began in 1775...</p>
          <p>It was a pivotal moment in history.</p>
        </itemBody>
      </assessmentStimulus>
    `;

    const result = transformPassage(qtiXml, 'passage-002b');
    const model = result.config.models[0];
    const passage = model.passages[0];

    expect(passage.title).toBe('Historical Context');
    expect(passage.text).toContain('American Revolution');
    expect(passage.text).toContain('pivotal moment');
  });

  test('should handle passage without title attribute', () => {
    const qtiXml = `
      <assessmentPassage>
        <partBody>
          <p>Some passage content without a title.</p>
        </partBody>
      </assessmentPassage>
    `;

    const result = transformPassage(qtiXml, 'passage-003');
    const passage = result.config.models[0].passages[0];

    expect(passage.title).toBe('Passage');
    expect(passage.text).toContain('passage content');
  });

  test('should handle stimulus element within assessmentItem', () => {
    const qtiXml = createQtiWrapper(`
<itemBody>
          <stimulus>
            <p>Read the following passage carefully before answering.</p>
            <p>The passage discusses important concepts.</p>
          </stimulus>
        </itemBody>    `, 'pass-PLACEHOLDER', 'Passage Test');

    const result = transformPassage(qtiXml, 'passage-004');
    const passage = result.config.models[0].passages[0];

    expect(passage.title).toBe('Stimulus');
    expect(passage.text).toContain('Read the following passage');
    expect(passage.text).toContain('important concepts');
  });

  test('should handle CDATA content in passage text', () => {
    const qtiXml = `
      <assessmentPassage title="Test">
        <partBody>
          <p>This is regular content.</p>
        </partBody>
      </assessmentPassage>
    `;

    const result = transformPassage(qtiXml, 'passage-005');
    const passage = result.config.models[0].passages[0];

    expect(passage.text).toContain('This is regular content');
  });

  test('should handle HTML formatting in passage', () => {
    const qtiXml = `
      <assessmentPassage title="Formatted Text">
        <partBody>
          <h3>Section Title</h3>
          <p><strong>Bold text</strong> and <em>italic text</em>.</p>
          <ul>
            <li>List item 1</li>
            <li>List item 2</li>
          </ul>
        </partBody>
      </assessmentPassage>
    `;

    const result = transformPassage(qtiXml, 'passage-006');
    const passage = result.config.models[0].passages[0];

    expect(passage.text).toContain('<h3>Section Title</h3>');
    expect(passage.text).toContain('<strong>Bold text</strong>');
    expect(passage.text).toContain('<em>italic text</em>');
    expect(passage.text).toContain('<ul>');
    expect(passage.text).toContain('<li>List item 1</li>');
  });

  test('should handle multiple partBody elements', () => {
    const qtiXml = `
      <assessmentPassage title="Multi-Part Passage">
        <partBody>
          <p>Part one of the passage.</p>
        </partBody>
        <partBody>
          <p>Part two of the passage.</p>
        </partBody>
        <partBody>
          <p>Part three of the passage.</p>
        </partBody>
      </assessmentPassage>
    `;

    const result = transformPassage(qtiXml, 'passage-007');
    const passage = result.config.models[0].passages[0];

    expect(passage.text).toContain('Part one');
    expect(passage.text).toContain('Part two');
    expect(passage.text).toContain('Part three');
  });

  test('should support options', () => {
    const qtiXml = `
      <assessmentPassage title="Test Passage">
        <partBody>
          <p>Test content.</p>
        </partBody>
      </assessmentPassage>
    `;

    const result = transformPassage(qtiXml, 'passage-008', {
      titleEnabled: false,
      subtitleEnabled: true,
      authorEnabled: true,
      textEnabled: false,
      teacherInstructionsEnabled: true,
    });

    const model = result.config.models[0];
    expect(model.titleEnabled).toBe(false);
    expect(model.subtitleEnabled).toBe(true);
    expect(model.authorEnabled).toBe(true);
    expect(model.textEnabled).toBe(false);
    expect(model.teacherInstructionsEnabled).toBe(true);
  });

  test('should throw error if no passage content found', () => {
    const qtiXml = createQtiWrapper(`
<responseDeclaration identifier="RESPONSE"/>
        <itemBody>
          <p>Very short</p>
          <choiceInteraction responseIdentifier="RESPONSE">
            <simpleChoice identifier="A">Choice A</simpleChoice>
          </choiceInteraction>
        </itemBody>    `, 'pass-PLACEHOLDER', 'Passage Test');

    expect(() => transformPassage(qtiXml, 'passage-009')).toThrow(/No passage content found/);
  });

  test('should handle assessmentStimulus without itemBody', () => {
    const qtiXml = `
      <assessmentStimulus title="Direct Content">
        <p>This is stimulus content directly in the element.</p>
        <p>No itemBody wrapper.</p>
      </assessmentStimulus>
    `;

    const result = transformPassage(qtiXml, 'passage-010');
    const passage = result.config.models[0].passages[0];

    expect(passage.text).toContain('directly in the element');
    expect(passage.text).toContain('No itemBody wrapper');
  });

  test('should handle assessmentPassage without partBody', () => {
    const qtiXml = `
      <assessmentPassage title="Direct Content Passage">
        <p>Content directly in assessmentPassage.</p>
        <p>Second paragraph.</p>
      </assessmentPassage>
    `;

    const result = transformPassage(qtiXml, 'passage-011');
    const passage = result.config.models[0].passages[0];

    expect(passage.text).toContain('directly in assessmentPassage');
    expect(passage.text).toContain('Second paragraph');
  });

  test('should handle long passage with multiple paragraphs', () => {
    const qtiXml = `
      <assessmentPassage title="Long Reading Passage">
        <partBody>
          <h2>The Water Cycle</h2>
          <p>Water is constantly moving through the environment in a process called the water cycle.</p>
          <p>The cycle begins with evaporation, where water from oceans, lakes, and rivers turns into water vapor.</p>
          <p>This vapor rises into the atmosphere and cools, forming clouds through condensation.</p>
          <p>Eventually, the water returns to Earth as precipitation in the form of rain, snow, or hail.</p>
          <p>The cycle then repeats endlessly, maintaining Earth's water balance.</p>
        </partBody>
      </assessmentPassage>
    `;

    const result = transformPassage(qtiXml, 'passage-012');
    const passage = result.config.models[0].passages[0];

    expect(passage.title).toBe('Long Reading Passage');
    expect(passage.text).toContain('water cycle');
    expect(passage.text).toContain('evaporation');
    expect(passage.text).toContain('condensation');
    expect(passage.text).toContain('precipitation');
    expect(passage.text.length).toBeGreaterThan(200);
  });

  test('should detect substantial itemBody content as passage', () => {
    const qtiXml = `
      <assessmentItem title="Item with Substantial Content">
        <itemBody>
          <p>This is a long passage of text that provides context for the assessment.</p>
          <p>It contains multiple paragraphs and substantial information.</p>
          <p>Students should read this carefully before proceeding.</p>
          <p>The passage discusses various important concepts and ideas.</p>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformPassage(qtiXml, 'passage-013');
    const passage = result.config.models[0].passages[0];

    expect(passage.title).toBe('Item with Substantial Content');
    expect(passage.text).toContain('long passage of text');
    expect(passage.text).toContain('various important concepts');
  });
});
