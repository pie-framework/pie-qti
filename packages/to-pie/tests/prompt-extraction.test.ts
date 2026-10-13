import { describe, expect, test } from 'bun:test';
import { parse } from 'node-html-parser';
import { transformEbsr } from '../src';
import { extractPromptForInteraction } from '../src/utils/prompt-extraction';

function promptOf(itemBodyXml: string): string {
  const itemBody = parse(itemBodyXml).getElementsByTagName('itemBody')[0]!;
  const interaction = itemBody.getElementsByTagName('choiceInteraction')[0]!;
  return extractPromptForInteraction(itemBody, interaction);
}

describe('extractPromptForInteraction', () => {
  test('keeps prompt content that shares a wrapper with the target interaction', () => {
    const document = parse(`
      <itemBody>
        <div class="iat-wrapper">
          <div class="iat-html-container">
            <p>A circle is shown.</p>
            <p>What is another circle?</p>
          </div>
          <div class="iat-interaction-container">
            <choiceInteraction responseIdentifier="RESPONSE">
              <simpleChoice identifier="B"><div><p>Circle B</p></div></simpleChoice>
              <simpleChoice identifier="A"><div><p>Square A</p></div></simpleChoice>
            </choiceInteraction>
          </div>
        </div>
      </itemBody>
    `);
    const itemBody = document.getElementsByTagName('itemBody')[0]!;
    const interaction = itemBody.getElementsByTagName('choiceInteraction')[0]!;

    const prompt = extractPromptForInteraction(itemBody, interaction);

    expect(prompt).toContain('A circle is shown.');
    expect(prompt).toContain('What is another circle?');
    expect(prompt).not.toContain('choiceInteraction');
    expect(prompt).not.toContain('Circle B');
  });

  test('carries a bound read-aloud region into the prompt with its audio', () => {
    // Cambium's IAT stem wrapper after `qti.hvr-audio.bind-tts-region` resolved its
    // `data-iat-hvr` region: the audio has to reach the PIE prompt, because it is how a
    // K-2 item presents its stem.
    const document = parse(`
      <itemBody>
        <div class="iat-html-container">
          <div data-iat-hvr="hvr-region-UVHMKXNZ" class="hvr-script-audio">
            <audio controls="controls"><source src="https://media.example.com/assets/abc123" type="audio/mp4"/></audio>
            <p>Pick the front cover.</p>
          </div>
        </div>
        <div class="iat-interaction-container">
          <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
            <simpleChoice identifier="A"><div><p>Front</p></div></simpleChoice>
          </choiceInteraction>
        </div>
      </itemBody>
    `);
    const itemBody = document.getElementsByTagName('itemBody')[0]!;
    const interaction = itemBody.getElementsByTagName('choiceInteraction')[0]!;

    const prompt = extractPromptForInteraction(itemBody, interaction);

    expect(prompt).toContain('https://media.example.com/assets/abc123');
    expect(prompt).toContain('Pick the front cover.');
    expect(prompt).not.toContain('Front<');
  });

  test("reads only the interaction's direct prompt element", () => {
    const document = parse(`
      <itemBody>
        <choiceInteraction responseIdentifier="RESPONSE">
          <prompt>Choose the right answer.</prompt>
          <simpleChoice identifier="A">
            <span><prompt>not a QTI prompt</prompt>Nested label</span>
          </simpleChoice>
        </choiceInteraction>
      </itemBody>
    `);
    const itemBody = document.getElementsByTagName('itemBody')[0]!;
    const interaction = itemBody.getElementsByTagName('choiceInteraction')[0]!;

    expect(extractPromptForInteraction(itemBody, interaction)).toBe('Choose the right answer.');
  });

  test('keeps item-body content before the interaction alongside its prompt', () => {
    const prompt = promptOf(`
      <itemBody>
        <p>A farmer plants 12 rows of corn.</p>
        <div><img src="field.png" alt="Field"/></div>
        <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
          <prompt>How many plants are there?</prompt>
          <simpleChoice identifier="A">48</simpleChoice>
        </choiceInteraction>
      </itemBody>
    `);

    expect(prompt).toBe(
      '<p>A farmer plants 12 rows of corn.</p><div><img src="field.png" alt="Field"></div>' +
        '<div>How many plants are there?</div>'
    );
  });

  test('keeps paragraphs before the interaction separate', () => {
    const prompt = promptOf(`
      <itemBody>
        <p>First sentence.</p>
        <p>Second <b>sentence</b>.</p>
        <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
          <simpleChoice identifier="A">A</simpleChoice>
        </choiceInteraction>
      </itemBody>
    `);

    expect(prompt).toBe('<p>First sentence.</p><p>Second <b>sentence</b>.</p>');
  });

  test('stores a single-paragraph stem inline', () => {
    const prompt = promptOf(`
      <itemBody>
        <p>Which is <em>largest</em>?</p>
        <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
          <simpleChoice identifier="A">A</simpleChoice>
        </choiceInteraction>
      </itemBody>
    `);

    expect(prompt).toBe('Which is <em>largest</em>?');
  });

  test('ignores lead-in markup with nothing to render', () => {
    const prompt = promptOf(`
      <itemBody>
        <p></p>
        <choiceInteraction responseIdentifier="RESPONSE" maxChoices="0">
          <prompt><p>Select all that apply.</p></prompt>
          <simpleChoice identifier="A">A</simpleChoice>
        </choiceInteraction>
      </itemBody>
    `);

    expect(prompt).toBe('<p>Select all that apply.</p>');
  });

  test('gives EBSR Part B the content between the two interactions', () => {
    const item = transformEbsr(
      `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="ebsr-1">
  <responseDeclaration identifier="RESPONSE_A" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <responseDeclaration identifier="RESPONSE_B" cardinality="single" baseType="identifier">
    <correctResponse><value>X</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <p>Read the passage.</p>
    <choiceInteraction responseIdentifier="RESPONSE_A">
      <prompt>What is the main idea?</prompt>
      <simpleChoice identifier="A">Choice A</simpleChoice>
    </choiceInteraction>
    <p>Use your answer to Part A.</p>
    <choiceInteraction responseIdentifier="RESPONSE_B">
      <prompt>Which evidence supports it?</prompt>
      <simpleChoice identifier="X">Evidence X</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`,
      'ebsr-1'
    );
    const model = item.config.models[0] as unknown as {
      partA: { prompt: string };
      partB: { prompt: string };
    };

    expect(model.partA.prompt).toBe('<p>Read the passage.</p><div>What is the main idea?</div>');
    expect(model.partB.prompt).toBe(
      '<p>Use your answer to Part A.</p><div>Which evidence supports it?</div>'
    );
  });
});
