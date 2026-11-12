/**
 * Items for the item-rendering fixture (`/fixtures/item-rendering?item=…`), exercised by
 * `tests/playwright/item-rendering-order.pw.ts`.
 */

/**
 * Interactions authored between, inside and around content: Part A text, a choice, Part B text,
 * an extended text, text after it, a paragraph of inline blanks next to a separate paragraph,
 * a layout column and a table cell. `CAPITAL_PARIS` is an identifier that would give the answer
 * away if it ever reached an accessible name.
 */
const PARTS = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="item-rendering-parts" title="Authored order" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="PART_A" cardinality="single" baseType="identifier"/>
  <responseDeclaration identifier="PART_B" cardinality="single" baseType="string"/>
  <responseDeclaration identifier="CAPITAL_PARIS" cardinality="single" baseType="string"/>
  <responseDeclaration identifier="BRIDGES" cardinality="single" baseType="integer"/>
  <responseDeclaration identifier="CONTINENT" cardinality="single" baseType="identifier"/>
  <responseDeclaration identifier="DATE" cardinality="single" baseType="string"/>
  <responseDeclaration identifier="LAYOUT" cardinality="single" baseType="string"/>
  <responseDeclaration identifier="CELL" cardinality="single" baseType="identifier"/>
  <itemBody>
    <p class="part-a">Part A: read the statement.</p>
    <choiceInteraction responseIdentifier="PART_A" maxChoices="1">
      <prompt>Which of these is a planet?</prompt>
      <simpleChoice identifier="A">Mars</simpleChoice>
      <simpleChoice identifier="B">The Moon</simpleChoice>
    </choiceInteraction>
    <p class="part-b">Part B: explain your answer.</p>
    <extendedTextInteraction responseIdentifier="PART_B" expectedLines="2"/>
    <p class="after-b">Text after Part B.</p>
    <p class="blanks">The capital of France is <textEntryInteraction responseIdentifier="CAPITAL_PARIS" expectedLength="10"/>, it has <textEntryInteraction responseIdentifier="BRIDGES" expectedLength="4" patternMask="^[0-9]+$"/> bridges and lies in <inlineChoiceInteraction responseIdentifier="CONTINENT"><inlineChoice identifier="eu">Europe</inlineChoice><inlineChoice identifier="as">Asia</inlineChoice></inlineChoiceInteraction>.</p>
    <p class="separate">A separate paragraph.</p>
    <p class="dated">Date of the visit: <textEntryInteraction responseIdentifier="DATE" expectedLength="10" patternMask="[0-9]{2}/[0-9]{2}/[0-9]{4}" placeholderText="dd/mm/yyyy"/></p>
    <div class="qti-layout-row">
      <div class="qti-layout-col6"><p class="left-column">Left column text.</p></div>
      <div class="qti-layout-col6 right-column"><extendedTextInteraction responseIdentifier="LAYOUT" expectedLines="2"/></div>
    </div>
    <table><tbody><tr><td>Is Paris in France?</td><td class="answer-cell"><choiceInteraction responseIdentifier="CELL" maxChoices="1"><simpleChoice identifier="C">Yes</simpleChoice><simpleChoice identifier="D">No</simpleChoice></choiceInteraction></td></tr></tbody></table>
    <p class="the-end">The end.</p>
  </itemBody>
</assessmentItem>`;

/**
 * An adaptive item with a hint button (`countAttempt="false"`), hint feedback authored between
 * the choice and the button, and modal feedback after each counted attempt.
 */
const ADAPTIVE = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="item-rendering-adaptive" title="Hints and feedback" adaptive="true" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <responseDeclaration identifier="HINT" cardinality="single" baseType="boolean"/>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"><defaultValue><value>0</value></defaultValue></outcomeDeclaration>
  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float"><defaultValue><value>1</value></defaultValue></outcomeDeclaration>
  <outcomeDeclaration identifier="FEEDBACK" cardinality="single" baseType="identifier"/>
  <itemBody>
    <p class="question">Which planet is known as the red planet?</p>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <simpleChoice identifier="A">Mars</simpleChoice>
      <simpleChoice identifier="B">Venus</simpleChoice>
    </choiceInteraction>
    <feedbackBlock outcomeIdentifier="FEEDBACK" identifier="hint" showHide="show"><p class="hint-text">Hint: it is named after the Roman god of war.</p></feedbackBlock>
    <p class="hint-row"><endAttemptInteraction responseIdentifier="HINT" title="Show a hint" countAttempt="false"/></p>
    <p class="closing">Choose an answer, then submit.</p>
  </itemBody>
  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match><variable identifier="HINT"/><baseValue baseType="boolean">true</baseValue></match>
        <setOutcomeValue identifier="FEEDBACK"><baseValue baseType="identifier">hint</baseValue></setOutcomeValue>
      </responseIf>
      <responseElseIf>
        <match><variable identifier="RESPONSE"/><correct identifier="RESPONSE"/></match>
        <setOutcomeValue identifier="SCORE"><baseValue baseType="float">1</baseValue></setOutcomeValue>
        <setOutcomeValue identifier="FEEDBACK"><baseValue baseType="identifier">correct</baseValue></setOutcomeValue>
        <setOutcomeValue identifier="completionStatus"><baseValue baseType="identifier">completed</baseValue></setOutcomeValue>
      </responseElseIf>
      <responseElse>
        <setOutcomeValue identifier="FEEDBACK"><baseValue baseType="identifier">incorrect</baseValue></setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
  <modalFeedback outcomeIdentifier="FEEDBACK" identifier="incorrect" showHide="show" title="Not yet"><p>Look at the colour of the planet and try again.</p></modalFeedback>
  <modalFeedback outcomeIdentifier="FEEDBACK" identifier="correct" showHide="show" title="Correct"><p>Mars is the red planet.</p></modalFeedback>
</assessmentItem>`;

/** Not well-formed: the player shows its error banner. */
const BROKEN = '<assessmentItem><itemBody><p>Unclosed';

export const ITEM_RENDERING_FIXTURES: Readonly<Record<string, string>> = {
	parts: PARTS,
	adaptive: ADAPTIVE,
	broken: BROKEN,
};
