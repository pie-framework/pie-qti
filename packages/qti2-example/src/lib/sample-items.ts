/**
 * Sample QTI 2.2 items for testing the player
 *
 * These items demonstrate the full range of QTI 2.2 interaction types and features.
 * They are designed to be realistic, pedagogically sound examples that developers
 * can learn from and adapt for their own assessments.
 */

export const SIMPLE_CHOICE = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="simple-choice"
  title="Simple Multiple Choice"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>ChoiceA</value>
    </correctResponse>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>1.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>If Maya has 12 cookies and gives 5 to her friend, how many cookies does she have left?</p>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
      <prompt>Select the correct answer:</prompt>
      <simpleChoice identifier="ChoiceA">7</simpleChoice>
      <simpleChoice identifier="ChoiceB">17</simpleChoice>
      <simpleChoice identifier="ChoiceC">5</simpleChoice>
      <simpleChoice identifier="ChoiceD">8</simpleChoice>
    </choiceInteraction>
  </itemBody>

  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match>
          <variable identifier="RESPONSE"/>
          <correct identifier="RESPONSE"/>
        </match>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">1.0</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

export const PARTIAL_CREDIT = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="partial-credit"
  title="Partial Credit Question"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>ChoiceA</value>
    </correctResponse>
    <mapping defaultValue="0">
      <mapEntry mapKey="ChoiceA" mappedValue="3"/>
      <mapEntry mapKey="ChoiceB" mappedValue="2"/>
      <mapEntry mapKey="ChoiceC" mappedValue="1"/>
      <mapEntry mapKey="ChoiceD" mappedValue="0"/>
    </mapping>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>3.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>Which of the following is the BEST description of photosynthesis?</p>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
      <prompt>Select your answer:</prompt>
      <simpleChoice identifier="ChoiceA">The process by which plants convert light energy into chemical energy</simpleChoice>
      <simpleChoice identifier="ChoiceB">The process by which plants make food</simpleChoice>
      <simpleChoice identifier="ChoiceC">The process involving plants and sunlight</simpleChoice>
      <simpleChoice identifier="ChoiceD">The process where plants grow</simpleChoice>
    </choiceInteraction>
  </itemBody>

  <responseProcessing>
    <responseCondition>
      <responseIf>
        <isNull>
          <variable identifier="RESPONSE"/>
        </isNull>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <mapResponse identifier="RESPONSE"/>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

export const CAPITAL_CITIES = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="capital-cities"
  title="Capital Cities"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>paris</value>
    </correctResponse>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>1.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>What is the capital of France?</p>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="true" maxChoices="1">
      <prompt>Choose the correct city:</prompt>
      <simpleChoice identifier="paris">Paris</simpleChoice>
      <simpleChoice identifier="london">London</simpleChoice>
      <simpleChoice identifier="berlin">Berlin</simpleChoice>
      <simpleChoice identifier="madrid">Madrid</simpleChoice>
    </choiceInteraction>
  </itemBody>

  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match>
          <variable identifier="RESPONSE"/>
          <correct identifier="RESPONSE"/>
        </match>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">1.0</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

export interface SampleItem {
  id: string;
  title: string;
  description: string;
  xml: string;
}

export const TEXT_ENTRY = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="text-entry"
  title="Text Entry Question"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string">
    <correctResponse>
      <value>photosynthesis</value>
    </correctResponse>
    <mapping defaultValue="0" caseSensitive="false">
      <mapEntry mapKey="photosynthesis" mappedValue="2" caseSensitive="false"/>
      <mapEntry mapKey="photo-synthesis" mappedValue="1" caseSensitive="false"/>
    </mapping>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>2.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>Fill in the blank: The process by which plants convert light energy into chemical energy is called <textEntryInteraction responseIdentifier="RESPONSE" expectedLength="15"/>.</p>
  </itemBody>

  <responseProcessing>
    <responseCondition>
      <responseIf>
        <isNull>
          <variable identifier="RESPONSE"/>
        </isNull>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <mapResponse identifier="RESPONSE"/>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

export const EXTENDED_TEXT = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="extended-text"
  title="Extended Text Response"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string"/>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>4.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <rubricBlock view="scorer tutor author">
    <h3>Scoring Rubric</h3>
    <table>
      <thead>
        <tr>
          <th>Points</th>
          <th>Criteria</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>4 points</strong></td>
          <td>
            <ul>
              <li>Identifies mitochondria as the site of cellular respiration</li>
              <li>Explains ATP (energy) production</li>
              <li>Mentions the conversion of nutrients into usable energy</li>
              <li>Uses scientifically accurate terminology</li>
            </ul>
          </td>
        </tr>
        <tr>
          <td><strong>3 points</strong></td>
          <td>
            <ul>
              <li>Identifies mitochondria's role in energy production</li>
              <li>Mentions ATP or cellular respiration</li>
              <li>Minor inaccuracies or missing details</li>
            </ul>
          </td>
        </tr>
        <tr>
          <td><strong>2 points</strong></td>
          <td>
            <ul>
              <li>Correctly identifies mitochondria as related to energy</li>
              <li>Vague or incomplete explanation</li>
              <li>May use informal language ("powerhouse of the cell")</li>
            </ul>
          </td>
        </tr>
        <tr>
          <td><strong>1 point</strong></td>
          <td>
            <ul>
              <li>Demonstrates minimal understanding</li>
              <li>Incorrect or irrelevant information with some correct elements</li>
            </ul>
          </td>
        </tr>
        <tr>
          <td><strong>0 points</strong></td>
          <td>
            <ul>
              <li>No response or completely incorrect response</li>
            </ul>
          </td>
        </tr>
      </tbody>
    </table>
  </rubricBlock>

  <rubricBlock view="candidate">
    <p><em>Your response will be scored by your instructor based on scientific accuracy and completeness. Be sure to explain the specific function of mitochondria in cellular processes.</em></p>
  </rubricBlock>

  <itemBody>
    <p>Explain the role of mitochondria in cellular function.</p>
    <extendedTextInteraction responseIdentifier="RESPONSE" expectedLines="3" expectedLength="200"/>
  </itemBody>

  <responseProcessing>
    <responseCondition>
      <responseIf>
        <isNull>
          <variable identifier="RESPONSE"/>
        </isNull>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <!-- This item requires human scoring based on the rubric -->
        <!-- Score remains 0.0 until manually scored -->
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

export const INLINE_CHOICE = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="inline-choice"
  title="Inline Choice Question"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>vertebrate</value>
    </correctResponse>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>1.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>A dog is a <inlineChoiceInteraction responseIdentifier="RESPONSE" shuffle="false"><inlineChoice identifier="vertebrate">vertebrate</inlineChoice><inlineChoice identifier="invertebrate">invertebrate</inlineChoice><inlineChoice identifier="plant">plant</inlineChoice></inlineChoiceInteraction> animal.</p>
  </itemBody>

  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match>
          <variable identifier="RESPONSE"/>
          <correct identifier="RESPONSE"/>
        </match>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">1.0</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

export const ORDER_INTERACTION = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="order-interaction"
  title="Order Interaction"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="ordered" baseType="identifier">
    <correctResponse>
      <value>ChoiceA</value>
      <value>ChoiceB</value>
      <value>ChoiceC</value>
      <value>ChoiceD</value>
    </correctResponse>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>2.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>Arrange the following steps of the scientific method in the correct order:</p>
    <orderInteraction responseIdentifier="RESPONSE" shuffle="true">
      <prompt>Drag the items to arrange them in order</prompt>
      <simpleChoice identifier="ChoiceA">Ask a question</simpleChoice>
      <simpleChoice identifier="ChoiceB">Conduct research</simpleChoice>
      <simpleChoice identifier="ChoiceC">Form a hypothesis</simpleChoice>
      <simpleChoice identifier="ChoiceD">Test the hypothesis</simpleChoice>
    </orderInteraction>
  </itemBody>

  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match>
          <variable identifier="RESPONSE"/>
          <correct identifier="RESPONSE"/>
        </match>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">2.0</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

export const MATCH_INTERACTION = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="match-interaction"
  title="Match Interaction"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="pair">
    <correctResponse>
      <value>capital1 country1</value>
      <value>capital2 country2</value>
      <value>capital3 country3</value>
    </correctResponse>
    <mapping defaultValue="0">
      <mapEntry mapKey="capital1 country1" mappedValue="1"/>
      <mapEntry mapKey="capital2 country2" mappedValue="1"/>
      <mapEntry mapKey="capital3 country3" mappedValue="1"/>
    </mapping>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>3.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>Match the capitals with their countries:</p>
    <matchInteraction responseIdentifier="RESPONSE" shuffle="false" maxAssociations="3">
      <prompt>Select the matching pairs</prompt>
      <simpleMatchSet>
        <simpleAssociableChoice identifier="capital1" matchMax="1">Paris</simpleAssociableChoice>
        <simpleAssociableChoice identifier="capital2" matchMax="1">London</simpleAssociableChoice>
        <simpleAssociableChoice identifier="capital3" matchMax="1">Berlin</simpleAssociableChoice>
      </simpleMatchSet>
      <simpleMatchSet>
        <simpleAssociableChoice identifier="country1" matchMax="1">France</simpleAssociableChoice>
        <simpleAssociableChoice identifier="country2" matchMax="1">England</simpleAssociableChoice>
        <simpleAssociableChoice identifier="country3" matchMax="1">Germany</simpleAssociableChoice>
      </simpleMatchSet>
    </matchInteraction>
  </itemBody>

  <responseProcessing>
    <responseCondition>
      <responseIf>
        <isNull>
          <variable identifier="RESPONSE"/>
        </isNull>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <mapResponse identifier="RESPONSE"/>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

export const ASSOCIATE_INTERACTION = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="associate-interaction"
  title="Associate Interaction"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="pair">
    <correctResponse>
      <value>A B</value>
      <value>C D</value>
      <value>E F</value>
    </correctResponse>
    <mapping defaultValue="0">
      <mapEntry mapKey="A B" mappedValue="1"/>
      <mapEntry mapKey="C D" mappedValue="1"/>
      <mapEntry mapKey="E F" mappedValue="1"/>
    </mapping>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>3.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>Create associations between related programming concepts:</p>
    <associateInteraction responseIdentifier="RESPONSE" shuffle="false" maxAssociations="3">
      <prompt>Match related concepts by clicking pairs</prompt>
      <simpleAssociableChoice identifier="A" matchMax="1">Variable</simpleAssociableChoice>
      <simpleAssociableChoice identifier="B" matchMax="1">Stores data</simpleAssociableChoice>
      <simpleAssociableChoice identifier="C" matchMax="1">Function</simpleAssociableChoice>
      <simpleAssociableChoice identifier="D" matchMax="1">Reusable code</simpleAssociableChoice>
      <simpleAssociableChoice identifier="E" matchMax="1">Loop</simpleAssociableChoice>
      <simpleAssociableChoice identifier="F" matchMax="1">Repeats code</simpleAssociableChoice>
    </associateInteraction>
  </itemBody>

  <responseProcessing>
    <responseCondition>
      <responseIf>
        <isNull>
          <variable identifier="RESPONSE"/>
        </isNull>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <mapResponse identifier="RESPONSE"/>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

export const GAP_MATCH_INTERACTION = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="gap-match"
  title="Gap Match Interaction"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
    <correctResponse>
      <value>W1 G1</value>
      <value>W2 G2</value>
      <value>W3 G3</value>
    </correctResponse>
    <mapping defaultValue="0">
      <mapEntry mapKey="W1 G1" mappedValue="1"/>
      <mapEntry mapKey="W2 G2" mappedValue="1"/>
      <mapEntry mapKey="W3 G3" mappedValue="1"/>
    </mapping>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>3.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>Drag the words to fill in the blanks:</p>
    <gapMatchInteraction responseIdentifier="RESPONSE" shuffle="false">
      <gapText identifier="W1" matchMax="1">photosynthesis</gapText>
      <gapText identifier="W2" matchMax="1">energy</gapText>
      <gapText identifier="W3" matchMax="1">oxygen</gapText>
      <blockquote>
        <p>Plants use <gap identifier="G1"/> to convert light <gap identifier="G2"/> into chemical energy, releasing <gap identifier="G3"/> as a byproduct.</p>
      </blockquote>
    </gapMatchInteraction>
  </itemBody>

  <responseProcessing>
    <responseCondition>
      <responseIf>
        <isNull>
          <variable identifier="RESPONSE"/>
        </isNull>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <mapResponse identifier="RESPONSE"/>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

export const SLIDER_INTERACTION = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="slider-interaction"
  title="Slider Interaction"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="integer">
    <correctResponse>
      <value>75</value>
    </correctResponse>
    <mapping defaultValue="0">
      <mapEntry mapKey="75" mappedValue="3"/>
      <mapEntry mapKey="74" mappedValue="2.5"/>
      <mapEntry mapKey="76" mappedValue="2.5"/>
      <mapEntry mapKey="73" mappedValue="2"/>
      <mapEntry mapKey="77" mappedValue="2"/>
    </mapping>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>3.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>Approximately what percentage of Earth's surface is covered by water?</p>
    <sliderInteraction responseIdentifier="RESPONSE" lowerBound="0" upperBound="100" step="1">
      <prompt>Use the slider to select a percentage</prompt>
    </sliderInteraction>
  </itemBody>

  <responseProcessing>
    <responseCondition>
      <responseIf>
        <isNull>
          <variable identifier="RESPONSE"/>
        </isNull>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <mapResponse identifier="RESPONSE"/>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

export const HOTSPOT_INTERACTION = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="hotspot-interaction"
  title="Hotspot Interaction - Solar System"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>EARTH</value>
    </correctResponse>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>1.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p><strong>Astronomy Question:</strong> Which planet in our solar system is known as the "Blue Planet" because of its abundant water?</p>
    <hotspotInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <prompt>Click on the planet that has liquid water covering most of its surface</prompt>
      <object type="image/svg+xml" width="800" height="400">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400">
          <!-- Space background -->
          <defs>
            <radialGradient id="sunGradient">
              <stop offset="0%" style="stop-color:#FDB813;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#F15A24;stop-opacity:0.8" />
            </radialGradient>
            <radialGradient id="mercuryGrad">
              <stop offset="30%" style="stop-color:#B7B8B9;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#8B8C8D;stop-opacity:1" />
            </radialGradient>
            <radialGradient id="venusGrad">
              <stop offset="30%" style="stop-color:#E8CDA2;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#C49A6C;stop-opacity:1" />
            </radialGradient>
            <radialGradient id="earthGrad">
              <stop offset="0%" style="stop-color:#87CEEB;stop-opacity:1" />
              <stop offset="50%" style="stop-color:#4A90E2;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#2E5C8A;stop-opacity:1" />
            </radialGradient>
            <radialGradient id="marsGrad">
              <stop offset="30%" style="stop-color:#E27B58;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#C1440E;stop-opacity:1" />
            </radialGradient>
          </defs>

          <!-- Space background -->
          <rect width="800" height="400" fill="#0a0e27"/>

          <!-- Stars -->
          <circle cx="50" cy="50" r="1" fill="white" opacity="0.8"/>
          <circle cx="120" cy="30" r="1" fill="white" opacity="0.6"/>
          <circle cx="200" cy="80" r="1.5" fill="white" opacity="0.9"/>
          <circle cx="350" cy="40" r="1" fill="white" opacity="0.7"/>
          <circle cx="450" cy="70" r="1" fill="white" opacity="0.6"/>
          <circle cx="550" cy="50" r="1.5" fill="white" opacity="0.8"/>
          <circle cx="650" cy="90" r="1" fill="white" opacity="0.7"/>
          <circle cx="720" cy="60" r="1" fill="white" opacity="0.9"/>
          <circle cx="100" cy="350" r="1" fill="white" opacity="0.8"/>
          <circle cx="300" cy="370" r="1.5" fill="white" opacity="0.7"/>
          <circle cx="500" cy="340" r="1" fill="white" opacity="0.9"/>
          <circle cx="700" cy="360" r="1" fill="white" opacity="0.6"/>

          <!-- Sun (partial, on left edge) -->
          <circle cx="30" cy="200" r="45" fill="url(#sunGradient)" opacity="0.9"/>
          <circle cx="30" cy="200" r="50" fill="none" stroke="#FDB813" stroke-width="1" opacity="0.3"/>

          <!-- Mercury -->
          <circle cx="150" cy="200" r="18" fill="url(#mercuryGrad)"/>
          <text x="150" y="245" font-size="14" fill="white" text-anchor="middle" font-family="Arial, sans-serif">Mercury</text>

          <!-- Venus -->
          <circle cx="280" cy="200" r="28" fill="url(#venusGrad)"/>
          <text x="280" y="245" font-size="14" fill="white" text-anchor="middle" font-family="Arial, sans-serif">Venus</text>

          <!-- Earth (with continents) -->
          <circle cx="430" cy="200" r="30" fill="url(#earthGrad)"/>
          <!-- Simplified continents -->
          <path d="M 425,185 Q 435,180 445,185 L 450,195 Q 445,200 435,198 Z" fill="#2d5016" opacity="0.7"/>
          <path d="M 410,200 Q 415,195 425,200 L 425,210 Q 420,212 410,208 Z" fill="#2d5016" opacity="0.7"/>
          <ellipse cx="435" cy="210" rx="8" ry="5" fill="#2d5016" opacity="0.7"/>
          <!-- White clouds -->
          <ellipse cx="445" cy="195" rx="6" ry="3" fill="white" opacity="0.5"/>
          <ellipse cx="415" cy="205" rx="5" ry="2.5" fill="white" opacity="0.5"/>
          <text x="430" y="245" font-size="14" fill="white" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold">Earth</text>

          <!-- Mars -->
          <circle cx="580" cy="200" r="24" fill="url(#marsGrad)"/>
          <!-- Mars features (polar ice cap) -->
          <circle cx="575" cy="185" r="5" fill="white" opacity="0.6"/>
          <text x="580" y="245" font-size="14" fill="white" text-anchor="middle" font-family="Arial, sans-serif">Mars</text>

          <!-- Orbit lines (subtle) -->
          <circle cx="30" cy="200" r="120" fill="none" stroke="white" stroke-width="0.5" opacity="0.2"/>
          <circle cx="30" cy="200" r="250" fill="none" stroke="white" stroke-width="0.5" opacity="0.2"/>
          <circle cx="30" cy="200" r="400" fill="none" stroke="white" stroke-width="0.5" opacity="0.2"/>
          <circle cx="30" cy="200" r="550" fill="none" stroke="white" stroke-width="0.5" opacity="0.2"/>
        </svg>
      </object>
      <hotspotChoice identifier="MERCURY" shape="circle" coords="150,200,25"/>
      <hotspotChoice identifier="VENUS" shape="circle" coords="280,200,35"/>
      <hotspotChoice identifier="EARTH" shape="circle" coords="430,200,35"/>
      <hotspotChoice identifier="MARS" shape="circle" coords="580,200,30"/>
    </hotspotInteraction>
  </itemBody>

  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match>
          <variable identifier="RESPONSE"/>
          <correct identifier="RESPONSE"/>
        </match>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">1.0</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

export const HOTSPOT_PARTIAL_CREDIT = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="hotspot-partial-credit"
  title="Hotspot with Partial Credit - Solar System"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>EARTH</value>
    </correctResponse>
    <mapping defaultValue="0">
      <mapEntry mapKey="EARTH" mappedValue="1.0"/>
      <mapEntry mapKey="VENUS" mappedValue="0.7"/>
      <mapEntry mapKey="MARS" mappedValue="0.7"/>
      <mapEntry mapKey="MERCURY" mappedValue="0.5"/>
    </mapping>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>1.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p><strong>Astronomy Question:</strong> Which planet in our solar system currently has liquid water on its surface?</p>
    <hotspotInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <prompt>Click on the planet with surface oceans (partial credit given for other terrestrial planets)</prompt>
      <object type="image/svg+xml" width="800" height="400">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400">
          <!-- Space background -->
          <defs>
            <radialGradient id="sunGradient">
              <stop offset="0%" style="stop-color:#FDB813;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#F15A24;stop-opacity:0.8" />
            </radialGradient>
            <radialGradient id="mercuryGrad">
              <stop offset="30%" style="stop-color:#B7B8B9;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#8B8C8D;stop-opacity:1" />
            </radialGradient>
            <radialGradient id="venusGrad">
              <stop offset="30%" style="stop-color:#E8CDA2;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#C49A6C;stop-opacity:1" />
            </radialGradient>
            <radialGradient id="earthGrad">
              <stop offset="0%" style="stop-color:#87CEEB;stop-opacity:1" />
              <stop offset="50%" style="stop-color:#4A90E2;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#2E5C8A;stop-opacity:1" />
            </radialGradient>
            <radialGradient id="marsGrad">
              <stop offset="30%" style="stop-color:#E27B58;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#C1440E;stop-opacity:1" />
            </radialGradient>
          </defs>

          <!-- Space background -->
          <rect width="800" height="400" fill="#0a0e27"/>

          <!-- Stars -->
          <circle cx="50" cy="50" r="1" fill="white" opacity="0.8"/>
          <circle cx="120" cy="30" r="1" fill="white" opacity="0.6"/>
          <circle cx="200" cy="80" r="1.5" fill="white" opacity="0.9"/>
          <circle cx="350" cy="40" r="1" fill="white" opacity="0.7"/>
          <circle cx="450" cy="70" r="1" fill="white" opacity="0.6"/>
          <circle cx="550" cy="50" r="1.5" fill="white" opacity="0.8"/>
          <circle cx="650" cy="90" r="1" fill="white" opacity="0.7"/>
          <circle cx="720" cy="60" r="1" fill="white" opacity="0.9"/>
          <circle cx="100" cy="350" r="1" fill="white" opacity="0.8"/>
          <circle cx="300" cy="370" r="1.5" fill="white" opacity="0.7"/>
          <circle cx="500" cy="340" r="1" fill="white" opacity="0.9"/>
          <circle cx="700" cy="360" r="1" fill="white" opacity="0.6"/>

          <!-- Sun (partial, on left edge) -->
          <circle cx="30" cy="200" r="45" fill="url(#sunGradient)" opacity="0.9"/>
          <circle cx="30" cy="200" r="50" fill="none" stroke="#FDB813" stroke-width="1" opacity="0.3"/>

          <!-- Mercury -->
          <circle cx="150" cy="200" r="18" fill="url(#mercuryGrad)"/>
          <text x="150" y="245" font-size="14" fill="white" text-anchor="middle" font-family="Arial, sans-serif">Mercury</text>

          <!-- Venus -->
          <circle cx="280" cy="200" r="28" fill="url(#venusGrad)"/>
          <text x="280" y="245" font-size="14" fill="white" text-anchor="middle" font-family="Arial, sans-serif">Venus</text>

          <!-- Earth (with continents) -->
          <circle cx="430" cy="200" r="30" fill="url(#earthGrad)"/>
          <!-- Simplified continents -->
          <path d="M 425,185 Q 435,180 445,185 L 450,195 Q 445,200 435,198 Z" fill="#2d5016" opacity="0.7"/>
          <path d="M 410,200 Q 415,195 425,200 L 425,210 Q 420,212 410,208 Z" fill="#2d5016" opacity="0.7"/>
          <ellipse cx="435" cy="210" rx="8" ry="5" fill="#2d5016" opacity="0.7"/>
          <!-- White clouds -->
          <ellipse cx="445" cy="195" rx="6" ry="3" fill="white" opacity="0.5"/>
          <ellipse cx="415" cy="205" rx="5" ry="2.5" fill="white" opacity="0.5"/>
          <text x="430" y="245" font-size="14" fill="white" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold">Earth</text>

          <!-- Mars -->
          <circle cx="580" cy="200" r="24" fill="url(#marsGrad)"/>
          <!-- Mars features (polar ice cap) -->
          <circle cx="575" cy="185" r="5" fill="white" opacity="0.6"/>
          <text x="580" y="245" font-size="14" fill="white" text-anchor="middle" font-family="Arial, sans-serif">Mars</text>

          <!-- Orbit lines (subtle) -->
          <circle cx="30" cy="200" r="120" fill="none" stroke="white" stroke-width="0.5" opacity="0.2"/>
          <circle cx="30" cy="200" r="250" fill="none" stroke="white" stroke-width="0.5" opacity="0.2"/>
          <circle cx="30" cy="200" r="400" fill="none" stroke="white" stroke-width="0.5" opacity="0.2"/>
          <circle cx="30" cy="200" r="550" fill="none" stroke="white" stroke-width="0.5" opacity="0.2"/>
        </svg>
      </object>
      <hotspotChoice identifier="MERCURY" shape="circle" coords="150,200,25"/>
      <hotspotChoice identifier="VENUS" shape="circle" coords="280,200,35"/>
      <hotspotChoice identifier="EARTH" shape="circle" coords="430,200,35"/>
      <hotspotChoice identifier="MARS" shape="circle" coords="580,200,30"/>
    </hotspotInteraction>
  </itemBody>

  <responseProcessing>
    <responseCondition>
      <responseIf>
        <isNull>
          <variable identifier="RESPONSE"/>
        </isNull>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <mapResponse identifier="RESPONSE"/>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

export const TEMPLATE_VARIABLE_DEMO = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="template-variable-demo"
  title="QTI Scripting Demo - Template + Response Processing"
  adaptive="false"
  timeDependent="false">

  <templateDeclaration identifier="A" cardinality="single" baseType="integer">
    <defaultValue><value>0</value></defaultValue>
  </templateDeclaration>

  <templateDeclaration identifier="B" cardinality="single" baseType="integer">
    <defaultValue><value>0</value></defaultValue>
  </templateDeclaration>

  <templateDeclaration identifier="ANSWER" cardinality="single" baseType="integer">
    <defaultValue><value>0</value></defaultValue>
  </templateDeclaration>

  <templateProcessing>
    <setTemplateValue identifier="A">
      <randomInteger>
        <baseValue baseType="integer">1</baseValue>
        <baseValue baseType="integer">20</baseValue>
      </randomInteger>
    </setTemplateValue>
    <setTemplateValue identifier="B">
      <randomInteger>
        <baseValue baseType="integer">1</baseValue>
        <baseValue baseType="integer">20</baseValue>
      </randomInteger>
    </setTemplateValue>
    <setTemplateValue identifier="ANSWER">
      <sum>
        <variable identifier="A"/>
        <variable identifier="B"/>
      </sum>
    </setTemplateValue>
  </templateProcessing>

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="integer"/>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0</value>
    </defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>1</value>
    </defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <div class="qti-item">
      <p><strong>Template + Response Processing</strong></p>
      <p>What is <printedVariable identifier="A"/> + <printedVariable identifier="B"/>?</p>
      <textEntryInteraction responseIdentifier="RESPONSE" expectedLength="5"/>
      <p class="hint">This item uses <code>templateProcessing</code> to generate A and B per session and derives ANSWER. Scoring is done via custom <code>responseProcessing</code> that compares RESPONSE to ANSWER.</p>
    </div>
  </itemBody>

  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match>
          <variable identifier="RESPONSE"/>
          <variable identifier="ANSWER"/>
        </match>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">1</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0</baseValue>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

export const GRAPHIC_GAP_MATCH_INTERACTION = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p2 http://www.imsglobal.org/xsd/qti/qtiv2p2/imsqti_v2p2.xsd"
  identifier="graphicGapfill"
  title="Airport Tags"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
    <correctResponse>
      <value>GLA A</value>
      <value>EDI B</value>
      <value>MAN C</value>
    </correctResponse>
    <mapping lowerBound="0" defaultValue="-1">
      <mapEntry mapKey="GLA A" mappedValue="1"/>
      <mapEntry mapKey="EDI B" mappedValue="1"/>
      <mapEntry mapKey="MAN C" mappedValue="1"/>
    </mapping>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>

  <itemBody>
    <p>The International Air Transport Association assigns three-letter codes to identify airports worldwide. For example, London Heathrow has code LHR.</p>
    <graphicGapMatchInteraction responseIdentifier="RESPONSE">
      <prompt>Some of the labels on the following diagram are missing: can you identify the correct three-letter codes for the unlabelled airports?</prompt>
      <object type="image/svg+xml" width="206" height="280">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 206 280">
          <!-- Simple UK map outline -->
          <rect x="0" y="0" width="206" height="280" fill="#e8f4f8"/>

          <!-- Simplified UK outline -->
          <path d="M 80,40 L 90,30 L 100,25 L 110,30 L 120,40 L 125,60 L 130,80 L 135,100 L 130,120 L 120,135 L 110,145 L 100,150 L 90,155 L 85,165 L 80,180 L 75,200 L 70,220 L 65,240 L 70,255 L 80,265 L 90,270 L 100,268 L 110,260 L 115,245 L 120,225 L 125,205 L 130,185 L 140,170 L 150,160 L 160,155 L 165,145 L 168,130 L 170,110 L 168,90 L 165,75 L 160,60 L 150,45 L 140,35 L 130,28 L 120,25 L 110,25 Z"
                fill="#d4e8d4" stroke="#2e7d32" stroke-width="2"/>

          <!-- City markers -->
          <circle cx="77" cy="115" r="5" fill="#1976d2" stroke="#0d47a1" stroke-width="1.5"/>
          <circle cx="118" cy="184" r="5" fill="#1976d2" stroke="#0d47a1" stroke-width="1.5"/>
          <circle cx="150" cy="235" r="5" fill="#1976d2" stroke="#0d47a1" stroke-width="1.5"/>
          <circle cx="96" cy="114" r="5" fill="#1976d2" stroke="#0d47a1" stroke-width="1.5"/>

          <!-- Labels for some cities -->
          <text x="72" y="140" font-size="11" font-weight="bold" fill="#333">?</text>
          <text x="113" y="210" font-size="11" font-weight="bold" fill="#333">?</text>
          <text x="145" y="260" font-size="11" font-weight="bold" fill="#333">?</text>

          <!-- Title -->
          <text x="103" y="15" font-size="12" font-weight="bold" fill="#1976d2" text-anchor="middle">UK Airports</text>
        </svg>
      </object>

      <gapText identifier="CBG" matchMax="1">CBG</gapText>
      <gapText identifier="EBG" matchMax="1">EBG</gapText>
      <gapText identifier="EDI" matchMax="1">EDI</gapText>
      <gapText identifier="GLA" matchMax="1">GLA</gapText>
      <gapText identifier="MAN" matchMax="1">MAN</gapText>
      <gapText identifier="MCH" matchMax="1">MCH</gapText>

      <associableHotspot identifier="A" matchMax="1" shape="rect" coords="12,108,39,121"/>
      <associableHotspot identifier="B" matchMax="1" shape="rect" coords="128,103,155,126"/>
      <associableHotspot identifier="C" matchMax="1" shape="rect" coords="66,165,93,178"/>
    </graphicGapMatchInteraction>
  </itemBody>

  <responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/map_response"/>
</assessmentItem>`;

export const GRAPHIC_GAP_MATCH_SOLAR_SYSTEM = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p2 http://www.imsglobal.org/xsd/qti/qtiv2p2/imsqti_v2p2.xsd"
  identifier="graphic-gap-match-solar-system"
  title="Solar System - Label the Planets"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
    <correctResponse>
      <value>MERCURY A</value>
      <value>VENUS B</value>
      <value>EARTH C</value>
      <value>MARS D</value>
    </correctResponse>
    <mapping lowerBound="0" defaultValue="0">
      <mapEntry mapKey="MERCURY A" mappedValue="1"/>
      <mapEntry mapKey="VENUS B" mappedValue="1"/>
      <mapEntry mapKey="EARTH C" mappedValue="1"/>
      <mapEntry mapKey="MARS D" mappedValue="1"/>
    </mapping>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>4.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>The inner planets of our solar system are the four rocky planets closest to the Sun: Mercury, Venus, Earth, and Mars.</p>
    <graphicGapMatchInteraction responseIdentifier="RESPONSE">
      <prompt>Label the four inner planets in our solar system</prompt>
      <object type="image/svg+xml" width="800" height="400">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400">
          <!-- Space background -->
          <defs>
            <radialGradient id="sunGradient">
              <stop offset="0%" style="stop-color:#FDB813;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#F15A24;stop-opacity:0.8" />
            </radialGradient>
            <radialGradient id="mercuryGrad">
              <stop offset="30%" style="stop-color:#B7B8B9;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#8B8C8D;stop-opacity:1" />
            </radialGradient>
            <radialGradient id="venusGrad">
              <stop offset="30%" style="stop-color:#E8CDA2;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#C49A6C;stop-opacity:1" />
            </radialGradient>
            <radialGradient id="earthGrad">
              <stop offset="0%" style="stop-color:#87CEEB;stop-opacity:1" />
              <stop offset="50%" style="stop-color:#4A90E2;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#2E5C8A;stop-opacity:1" />
            </radialGradient>
            <radialGradient id="marsGrad">
              <stop offset="30%" style="stop-color:#E27B58;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#C1440E;stop-opacity:1" />
            </radialGradient>
          </defs>

          <!-- Space background -->
          <rect width="800" height="400" fill="#0a0e27"/>

          <!-- Stars -->
          <circle cx="50" cy="50" r="1" fill="white" opacity="0.8"/>
          <circle cx="120" cy="30" r="1" fill="white" opacity="0.6"/>
          <circle cx="200" cy="80" r="1.5" fill="white" opacity="0.9"/>
          <circle cx="350" cy="40" r="1" fill="white" opacity="0.7"/>
          <circle cx="450" cy="70" r="1" fill="white" opacity="0.6"/>
          <circle cx="550" cy="50" r="1.5" fill="white" opacity="0.8"/>
          <circle cx="650" cy="90" r="1" fill="white" opacity="0.7"/>
          <circle cx="720" cy="60" r="1" fill="white" opacity="0.9"/>
          <circle cx="100" cy="350" r="1" fill="white" opacity="0.8"/>
          <circle cx="300" cy="370" r="1.5" fill="white" opacity="0.7"/>
          <circle cx="500" cy="340" r="1" fill="white" opacity="0.9"/>
          <circle cx="700" cy="360" r="1" fill="white" opacity="0.6"/>

          <!-- Sun (partial, on left edge) -->
          <circle cx="30" cy="200" r="45" fill="url(#sunGradient)" opacity="0.9"/>
          <circle cx="30" cy="200" r="50" fill="none" stroke="#FDB813" stroke-width="1" opacity="0.3"/>
          <text x="30" y="270" font-size="12" fill="#FDB813" text-anchor="middle" font-family="Arial, sans-serif">Sun</text>

          <!-- Mercury -->
          <circle cx="150" cy="200" r="18" fill="url(#mercuryGrad)"/>
          <text x="150" y="245" font-size="14" fill="white" text-anchor="middle" font-family="Arial, sans-serif">?</text>

          <!-- Venus -->
          <circle cx="280" cy="200" r="28" fill="url(#venusGrad)"/>
          <text x="280" y="245" font-size="14" fill="white" text-anchor="middle" font-family="Arial, sans-serif">?</text>

          <!-- Earth (with continents) -->
          <circle cx="430" cy="200" r="30" fill="url(#earthGrad)"/>
          <path d="M 425,185 Q 435,180 445,185 L 450,195 Q 445,200 435,198 Z" fill="#2d5016" opacity="0.7"/>
          <path d="M 410,200 Q 415,195 425,200 L 425,210 Q 420,212 410,208 Z" fill="#2d5016" opacity="0.7"/>
          <ellipse cx="435" cy="210" rx="8" ry="5" fill="#2d5016" opacity="0.7"/>
          <ellipse cx="445" cy="195" rx="6" ry="3" fill="white" opacity="0.5"/>
          <ellipse cx="415" cy="205" rx="5" ry="2.5" fill="white" opacity="0.5"/>
          <text x="430" y="245" font-size="14" fill="white" text-anchor="middle" font-family="Arial, sans-serif">?</text>

          <!-- Mars -->
          <circle cx="580" cy="200" r="24" fill="url(#marsGrad)"/>
          <circle cx="575" cy="185" r="5" fill="white" opacity="0.6"/>
          <text x="580" y="245" font-size="14" fill="white" text-anchor="middle" font-family="Arial, sans-serif">?</text>

          <!-- Orbit lines (subtle) -->
          <circle cx="30" cy="200" r="120" fill="none" stroke="white" stroke-width="0.5" opacity="0.2"/>
          <circle cx="30" cy="200" r="250" fill="none" stroke="white" stroke-width="0.5" opacity="0.2"/>
          <circle cx="30" cy="200" r="400" fill="none" stroke="white" stroke-width="0.5" opacity="0.2"/>
          <circle cx="30" cy="200" r="550" fill="none" stroke="white" stroke-width="0.5" opacity="0.2"/>

          <!-- Title -->
          <text x="400" y="30" font-size="20" font-weight="bold" fill="white" text-anchor="middle">Inner Planets of the Solar System</text>
        </svg>
      </object>

      <gapText identifier="MERCURY" matchMax="1">Mercury</gapText>
      <gapText identifier="VENUS" matchMax="1">Venus</gapText>
      <gapText identifier="EARTH" matchMax="1">Earth</gapText>
      <gapText identifier="MARS" matchMax="1">Mars</gapText>

      <associableHotspot identifier="A" matchMax="1" shape="circle" coords="150,320,30"/>
      <associableHotspot identifier="B" matchMax="1" shape="circle" coords="280,320,30"/>
      <associableHotspot identifier="C" matchMax="1" shape="circle" coords="430,320,30"/>
      <associableHotspot identifier="D" matchMax="1" shape="circle" coords="580,320,30"/>
    </graphicGapMatchInteraction>
  </itemBody>

  <responseProcessing>
    <responseCondition>
      <responseIf>
        <isNull>
          <variable identifier="RESPONSE"/>
        </isNull>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <mapResponse identifier="RESPONSE"/>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

export const GRAPHIC_GAP_MATCH_DIGESTIVE_SYSTEM = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p2 http://www.imsglobal.org/xsd/qti/qtiv2p2/imsqti_v2p2.xsd"
  identifier="graphic-gap-match-digestive"
  title="Human Digestive System"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
    <correctResponse>
      <value>MOUTH A</value>
      <value>ESOPHAGUS B</value>
      <value>STOMACH C</value>
      <value>LIVER D</value>
      <value>SMALL_INTESTINE E</value>
      <value>LARGE_INTESTINE F</value>
    </correctResponse>
    <mapping lowerBound="0" defaultValue="0">
      <mapEntry mapKey="MOUTH A" mappedValue="1"/>
      <mapEntry mapKey="ESOPHAGUS B" mappedValue="1"/>
      <mapEntry mapKey="STOMACH C" mappedValue="1"/>
      <mapEntry mapKey="LIVER D" mappedValue="1"/>
      <mapEntry mapKey="SMALL_INTESTINE E" mappedValue="1"/>
      <mapEntry mapKey="LARGE_INTESTINE F" mappedValue="1"/>
    </mapping>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>

  <itemBody>
    <p>The digestive system breaks down food into nutrients that the body can absorb and use for energy, growth, and cell repair.</p>
    <graphicGapMatchInteraction responseIdentifier="RESPONSE">
      <prompt>Label the major organs of the human digestive system</prompt>
      <object type="image/svg+xml" width="400" height="600">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600">
          <!-- Body outline -->
          <ellipse cx="200" cy="300" rx="120" ry="280" fill="#f5e6d3" stroke="#8b7355" stroke-width="2"/>

          <!-- Head -->
          <circle cx="200" cy="50" r="40" fill="#f5d5b8" stroke="#8b7355" stroke-width="2"/>

          <!-- Mouth (A) -->
          <circle cx="200" cy="60" r="8" fill="#d4686b" stroke="#a03c3f" stroke-width="2"/>

          <!-- Esophagus (B) -->
          <rect x="195" y="70" width="10" height="100" fill="#e89ba6" stroke="#c46975" stroke-width="2"/>

          <!-- Stomach (C) -->
          <path d="M 160,170 Q 150,190 160,210 L 190,220 Q 200,215 210,220 L 240,210 Q 250,190 240,170 Z"
                fill="#e89ba6" stroke="#c46975" stroke-width="2"/>

          <!-- Liver (D) -->
          <path d="M 220,180 L 280,190 Q 290,200 285,215 L 250,225 Q 240,220 230,220 Z"
                fill="#8b4513" stroke="#5d2e0f" stroke-width="2"/>

          <!-- Small Intestine (E) -->
          <path d="M 190,230 Q 180,250 190,270 Q 200,280 210,270 Q 220,250 210,230 M 190,270 Q 185,290 195,310 Q 205,320 215,310 Q 225,290 215,270 M 195,310 Q 190,330 200,350 Q 210,360 220,350 Q 230,330 220,310"
                fill="#f4a6b8" stroke="#d67589" stroke-width="2" fill-opacity="0.9"/>

          <!-- Large Intestine (F) -->
          <path d="M 140,240 L 140,360 Q 140,380 160,380 L 240,380 Q 260,380 260,360 L 260,240 Q 260,230 250,230 L 240,230 M 240,370 L 160,370 L 160,250"
                fill="#d4a6b8" stroke="#b67589" stroke-width="2" fill="none"/>

          <!-- Labels with question marks -->
          <text x="210" y="65" font-size="16" font-weight="bold" fill="#333">?</text>
          <text x="210" y="120" font-size="16" font-weight="bold" fill="#333">?</text>
          <text x="210" y="195" font-size="16" font-weight="bold" fill="#333">?</text>
          <text x="290" y="205" font-size="16" font-weight="bold" fill="#333">?</text>
          <text x="165" y="295" font-size="16" font-weight="bold" fill="#333">?</text>
          <text x="120" y="300" font-size="16" font-weight="bold" fill="#333">?</text>

          <!-- Title -->
          <text x="200" y="20" font-size="18" font-weight="bold" fill="#2c3e50" text-anchor="middle">Human Digestive System</text>
        </svg>
      </object>

      <gapText identifier="MOUTH" matchMax="1">Mouth</gapText>
      <gapText identifier="ESOPHAGUS" matchMax="1">Esophagus</gapText>
      <gapText identifier="STOMACH" matchMax="1">Stomach</gapText>
      <gapText identifier="LIVER" matchMax="1">Liver</gapText>
      <gapText identifier="SMALL_INTESTINE" matchMax="1">Small Intestine</gapText>
      <gapText identifier="LARGE_INTESTINE" matchMax="1">Large Intestine</gapText>

      <associableHotspot identifier="A" matchMax="1" shape="circle" coords="200,60,15"/>
      <associableHotspot identifier="B" matchMax="1" shape="rect" coords="190,100,220,130"/>
      <associableHotspot identifier="C" matchMax="1" shape="rect" coords="170,180,230,215"/>
      <associableHotspot identifier="D" matchMax="1" shape="rect" coords="240,185,285,220"/>
      <associableHotspot identifier="E" matchMax="1" shape="rect" coords="175,250,225,350"/>
      <associableHotspot identifier="F" matchMax="1" shape="rect" coords="130,240,150,360"/>
    </graphicGapMatchInteraction>
  </itemBody>

  <responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/map_response"/>
</assessmentItem>`;

export const GRAPHIC_GAP_MATCH_SKELETON = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p2 http://www.imsglobal.org/xsd/qti/qtiv2p2/imsqti_v2p2.xsd"
  identifier="graphic-gap-match-skeleton"
  title="Human Skeleton"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
    <correctResponse>
      <value>SKULL A</value>
      <value>CLAVICLE B</value>
      <value>HUMERUS C</value>
      <value>RADIUS D</value>
      <value>FEMUR E</value>
      <value>TIBIA F</value>
    </correctResponse>
    <mapping lowerBound="0" defaultValue="0">
      <mapEntry mapKey="SKULL A" mappedValue="1"/>
      <mapEntry mapKey="CLAVICLE B" mappedValue="1"/>
      <mapEntry mapKey="HUMERUS C" mappedValue="1"/>
      <mapEntry mapKey="RADIUS D" mappedValue="1"/>
      <mapEntry mapKey="FEMUR E" mappedValue="1"/>
      <mapEntry mapKey="TIBIA F" mappedValue="1"/>
    </mapping>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>

  <itemBody>
    <p>The human skeleton provides structure, protects organs, and enables movement. An adult human has 206 bones.</p>
    <graphicGapMatchInteraction responseIdentifier="RESPONSE">
      <prompt>Label the major bones of the human skeleton</prompt>
      <object type="image/svg+xml" width="300" height="600">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 600">
          <!-- Background -->
          <rect width="300" height="600" fill="#f8f9fa"/>

          <!-- Skull (A) -->
          <circle cx="150" cy="50" r="30" fill="#e8e8e8" stroke="#666" stroke-width="2"/>
          <circle cx="140" cy="45" r="5" fill="#333"/>
          <circle cx="160" cy="45" r="5" fill="#333"/>

          <!-- Spine -->
          <rect x="145" y="80" width="10" height="200" fill="#d0d0d0" stroke="#666" stroke-width="1.5"/>

          <!-- Clavicle (B) - Collarbone -->
          <line x1="120" y1="95" x2="150" y2="90" stroke="#d0d0d0" stroke-width="8" stroke-linecap="round"/>
          <line x1="180" y1="95" x2="150" y2="90" stroke="#d0d0d0" stroke-width="8" stroke-linecap="round"/>

          <!-- Ribs -->
          <ellipse cx="150" cy="140" rx="55" ry="50" fill="none" stroke="#d0d0d0" stroke-width="6" opacity="0.7"/>

          <!-- Humerus (C) - Upper arm -->
          <line x1="120" y1="100" x2="105" y2="180" stroke="#d0d0d0" stroke-width="10" stroke-linecap="round"/>
          <line x1="180" y1="100" x2="195" y2="180" stroke="#d0d0d0" stroke-width="10" stroke-linecap="round"/>

          <!-- Radius/Ulna (D) - Forearm -->
          <line x1="105" y1="185" x2="95" y2="260" stroke="#d0d0d0" stroke-width="7" stroke-linecap="round"/>
          <line x1="195" y1="185" x2="205" y2="260" stroke="#d0d0d0" stroke-width="7" stroke-linecap="round"/>

          <!-- Pelvis -->
          <ellipse cx="150" cy="285" rx="50" ry="25" fill="#d0d0d0" stroke="#666" stroke-width="2"/>

          <!-- Femur (E) - Thigh bone -->
          <line x1="130" y1="305" x2="120" y2="430" stroke="#d0d0d0" stroke-width="12" stroke-linecap="round"/>
          <line x1="170" y1="305" x2="180" y2="430" stroke="#d0d0d0" stroke-width="12" stroke-linecap="round"/>

          <!-- Patella (Knee cap) -->
          <circle cx="120" cy="435" r="8" fill="#d0d0d0" stroke="#666" stroke-width="1.5"/>
          <circle cx="180" cy="435" r="8" fill="#d0d0d0" stroke="#666" stroke-width="1.5"/>

          <!-- Tibia/Fibula (F) - Lower leg -->
          <line x1="120" y1="445" x2="115" y2="560" stroke="#d0d0d0" stroke-width="10" stroke-linecap="round"/>
          <line x1="180" y1="445" x2="185" y2="560" stroke="#d0d0d0" stroke-width="10" stroke-linecap="round"/>

          <!-- Question marks -->
          <text x="155" y="35" font-size="16" font-weight="bold" fill="#c00">?</text>
          <text x="155" y="100" font-size="14" font-weight="bold" fill="#c00">?</text>
          <text x="75" y="140" font-size="14" font-weight="bold" fill="#c00">?</text>
          <text x="75" y="225" font-size="14" font-weight="bold" fill="#c00">?</text>
          <text x="75" y="370" font-size="14" font-weight="bold" fill="#c00">?</text>
          <text x="75" y="505" font-size="14" font-weight="bold" fill="#c00">?</text>

          <!-- Title -->
          <text x="150" y="590" font-size="16" font-weight="bold" fill="#2c3e50" text-anchor="middle">Human Skeleton (Anterior View)</text>
        </svg>
      </object>

      <gapText identifier="SKULL" matchMax="1">Skull</gapText>
      <gapText identifier="CLAVICLE" matchMax="1">Clavicle</gapText>
      <gapText identifier="HUMERUS" matchMax="1">Humerus</gapText>
      <gapText identifier="RADIUS" matchMax="1">Radius</gapText>
      <gapText identifier="FEMUR" matchMax="1">Femur</gapText>
      <gapText identifier="TIBIA" matchMax="1">Tibia</gapText>

      <associableHotspot identifier="A" matchMax="1" shape="circle" coords="150,50,35"/>
      <associableHotspot identifier="B" matchMax="1" shape="rect" coords="130,90,170,100"/>
      <associableHotspot identifier="C" matchMax="1" shape="rect" coords="95,130,115,170"/>
      <associableHotspot identifier="D" matchMax="1" shape="rect" coords="85,215,105,250"/>
      <associableHotspot identifier="E" matchMax="1" shape="rect" coords="110,350,135,420"/>
      <associableHotspot identifier="F" matchMax="1" shape="rect" coords="105,490,125,555"/>
    </graphicGapMatchInteraction>
  </itemBody>

  <responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/map_response"/>
</assessmentItem>`;

export const GRAPHIC_GAP_MATCH_PLANT_CELL = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p2 http://www.imsglobal.org/xsd/qti/qtiv2p2/imsqti_v2p2.xsd"
  identifier="graphic-gap-match-plant-cell"
  title="Plant Cell Structure"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
    <correctResponse>
      <value>CELL_WALL A</value>
      <value>NUCLEUS B</value>
      <value>CHLOROPLAST C</value>
      <value>MITOCHONDRIA D</value>
      <value>VACUOLE E</value>
    </correctResponse>
    <mapping lowerBound="0" defaultValue="0">
      <mapEntry mapKey="CELL_WALL A" mappedValue="1"/>
      <mapEntry mapKey="NUCLEUS B" mappedValue="1"/>
      <mapEntry mapKey="CHLOROPLAST C" mappedValue="1"/>
      <mapEntry mapKey="MITOCHONDRIA D" mappedValue="1"/>
      <mapEntry mapKey="VACUOLE E" mappedValue="1"/>
    </mapping>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>

  <itemBody>
    <p>Plant cells have several specialized structures that distinguish them from animal cells, including a cell wall, chloroplasts, and a large central vacuole.</p>
    <graphicGapMatchInteraction responseIdentifier="RESPONSE">
      <prompt>Label the major structures of a plant cell</prompt>
      <object type="image/svg+xml" width="500" height="400">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 400">
          <!-- Background -->
          <rect width="500" height="400" fill="#f0f8ff"/>

          <!-- Cell Wall (A) - outer boundary -->
          <rect x="50" y="50" width="400" height="300" fill="none" stroke="#2e7d32" stroke-width="6" rx="10"/>

          <!-- Cell Membrane - inner boundary -->
          <rect x="60" y="60" width="380" height="280" fill="#e8f5e9" stroke="#4caf50" stroke-width="3" rx="8"/>

          <!-- Vacuole (E) - large central space -->
          <ellipse cx="250" cy="200" rx="130" ry="100" fill="#b3e5fc" stroke="#0288d1" stroke-width="3"/>

          <!-- Nucleus (B) -->
          <circle cx="150" cy="150" r="45" fill="#ffccbc" stroke="#d84315" stroke-width="3"/>
          <circle cx="150" cy="150" r="15" fill="#ff5722" stroke="#d84315" stroke-width="2"/>

          <!-- Chloroplasts (C) - multiple green ovals -->
          <ellipse cx="350" cy="120" rx="35" ry="20" fill="#81c784" stroke="#2e7d32" stroke-width="2"/>
          <ellipse cx="380" cy="180" rx="30" ry="18" fill="#81c784" stroke="#2e7d32" stroke-width="2"/>
          <ellipse cx="360" cy="250" rx="32" ry="19" fill="#81c784" stroke="#2e7d32" stroke-width="2"/>

          <!-- Mitochondria (D) - small oval -->
          <ellipse cx="140" cy="270" rx="25" ry="15" fill="#ffab91" stroke="#d84315" stroke-width="2"/>
          <path d="M 120,270 Q 140,265 160,270" fill="none" stroke="#d84315" stroke-width="1"/>

          <!-- Golgi Apparatus -->
          <g transform="translate(320, 280)">
            <ellipse cx="0" cy="0" rx="30" ry="8" fill="#fff59d" stroke="#f57f17" stroke-width="2"/>
            <ellipse cx="0" cy="-5" rx="28" ry="8" fill="#fff59d" stroke="#f57f17" stroke-width="2"/>
            <ellipse cx="0" cy="-10" rx="26" ry="8" fill="#fff59d" stroke="#f57f17" stroke-width="2"/>
          </g>

          <!-- Endoplasmic Reticulum -->
          <path d="M 200,100 Q 220,95 240,100 Q 260,105 280,100" fill="none" stroke="#9575cd" stroke-width="3"/>
          <path d="M 200,110 Q 220,105 240,110 Q 260,115 280,110" fill="none" stroke="#9575cd" stroke-width="3"/>

          <!-- Question marks and pointers -->
          <text x="30" y="200" font-size="18" font-weight="bold" fill="#c00">?</text>
          <text x="150" y="90" font-size="18" font-weight="bold" fill="#c00">?</text>
          <text x="410" y="120" font-size="18" font-weight="bold" fill="#c00">?</text>
          <text x="180" y="280" font-size="18" font-weight="bold" fill="#c00">?</text>
          <text x="300" y="180" font-size="18" font-weight="bold" fill="#c00">?</text>

          <!-- Title -->
          <text x="250" y="30" font-size="20" font-weight="bold" fill="#2c3e50" text-anchor="middle">Plant Cell Structure</text>
        </svg>
      </object>

      <gapText identifier="CELL_WALL" matchMax="1">Cell Wall</gapText>
      <gapText identifier="NUCLEUS" matchMax="1">Nucleus</gapText>
      <gapText identifier="CHLOROPLAST" matchMax="1">Chloroplast</gapText>
      <gapText identifier="MITOCHONDRIA" matchMax="1">Mitochondria</gapText>
      <gapText identifier="VACUOLE" matchMax="1">Vacuole</gapText>

      <associableHotspot identifier="A" matchMax="1" shape="rect" coords="20,180,50,220"/>
      <associableHotspot identifier="B" matchMax="1" shape="circle" coords="150,150,50"/>
      <associableHotspot identifier="C" matchMax="1" shape="rect" coords="390,110,440,130"/>
      <associableHotspot identifier="D" matchMax="1" shape="rect" coords="165,265,195,285"/>
      <associableHotspot identifier="E" matchMax="1" shape="ellipse" coords="250,200,130,100"/>
    </graphicGapMatchInteraction>
  </itemBody>

  <responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/map_response"/>
</assessmentItem>`;

export const GRAPHIC_GAP_MATCH_WATER_CYCLE = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p2 http://www.imsglobal.org/xsd/qti/qtiv2p2/imsqti_v2p2.xsd"
  identifier="graphic-gap-match-water-cycle"
  title="Water Cycle"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
    <correctResponse>
      <value>EVAPORATION A</value>
      <value>CONDENSATION B</value>
      <value>PRECIPITATION C</value>
      <value>COLLECTION D</value>
      <value>TRANSPIRATION E</value>
    </correctResponse>
    <mapping lowerBound="0" defaultValue="0">
      <mapEntry mapKey="EVAPORATION A" mappedValue="1"/>
      <mapEntry mapKey="CONDENSATION B" mappedValue="1"/>
      <mapEntry mapKey="PRECIPITATION C" mappedValue="1"/>
      <mapEntry mapKey="COLLECTION D" mappedValue="1"/>
      <mapEntry mapKey="TRANSPIRATION E" mappedValue="1"/>
    </mapping>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>

  <itemBody>
    <p>The water cycle describes how water evaporates from the surface of the earth, rises into the atmosphere, cools and condenses into clouds, and falls back to the surface as precipitation.</p>
    <graphicGapMatchInteraction responseIdentifier="RESPONSE">
      <prompt>Label the stages of the water cycle</prompt>
      <object type="image/svg+xml" width="600" height="400">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400">
          <!-- Sky gradient -->
          <defs>
            <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:#87CEEB;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#E0F6FF;stop-opacity:1" />
            </linearGradient>
          </defs>

          <rect width="600" height="300" fill="url(#skyGrad)"/>

          <!-- Sun -->
          <circle cx="500" cy="50" r="40" fill="#FDB813" opacity="0.9"/>
          <circle cx="500" cy="50" r="45" fill="none" stroke="#FDB813" stroke-width="2" opacity="0.5"/>

          <!-- Clouds -->
          <g transform="translate(250, 80)">
            <ellipse cx="0" cy="0" rx="30" ry="20" fill="#fff" stroke="#ccc" stroke-width="2"/>
            <ellipse cx="25" cy="-5" rx="25" ry="18" fill="#fff" stroke="#ccc" stroke-width="2"/>
            <ellipse cx="50" cy="0" rx="30" ry="20" fill="#fff" stroke="#ccc" stroke-width="2"/>
          </g>

          <!-- Rain -->
          <line x1="270" y1="105" x2="265" y2="150" stroke="#4A90E2" stroke-width="2"/>
          <line x1="285" y1="105" x2="280" y2="150" stroke="#4A90E2" stroke-width="2"/>
          <line x1="300" y1="105" x2="295" y2="150" stroke="#4A90E2" stroke-width="2"/>

          <!-- Mountain -->
          <path d="M 350,250 L 420,150 L 490,250 Z" fill="#8B7355" stroke="#6B5335" stroke-width="2"/>

          <!-- Trees -->
          <rect x="100" y="240" width="15" height="40" fill="#8B4513"/>
          <polygon points="107.5,220 90,240 125,240" fill="#228B22"/>

          <rect x="150" y="245" width="12" height="35" fill="#8B4513"/>
          <polygon points="156,228 142,245 170,245" fill="#228B22"/>

          <!-- Ground -->
          <rect y="280" width="600" height="20" fill="#8B7355"/>

          <!-- Ocean/Lake -->
          <ellipse cx="100" cy="340" rx="90" ry="50" fill="#4A90E2" stroke="#2E5C8A" stroke-width="2"/>

          <!-- Underground water -->
          <rect y="300" width="600" height="100" fill="#D2B48C"/>
          <path d="M 50,340 Q 100,330 150,340 Q 200,350 250,340" fill="none" stroke="#4A90E2" stroke-width="3" stroke-dasharray="5,5"/>

          <!-- Arrows showing water movement -->
          <!-- Evaporation arrow (A) -->
          <path d="M 100,310 L 100,200" stroke="#FF6B6B" stroke-width="3" marker-end="url(#arrowRed)" stroke-dasharray="5,5"/>

          <!-- Condensation arrow (B) -->
          <circle cx="230" cy="100" r="25" fill="none" stroke="#4169E1" stroke-width="3" stroke-dasharray="5,5"/>

          <!-- Transpiration arrow (E) -->
          <path d="M 107,220 L 107,160" stroke="#32CD32" stroke-width="3" marker-end="url(#arrowGreen)" stroke-dasharray="5,5"/>

          <!-- Arrow markers -->
          <defs>
            <marker id="arrowRed" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto">
              <polygon points="0,0 10,5 0,10" fill="#FF6B6B"/>
            </marker>
            <marker id="arrowGreen" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto">
              <polygon points="0,0 10,5 0,10" fill="#32CD32"/>
            </marker>
          </defs>

          <!-- Question marks -->
          <text x="110" y="260" font-size="18" font-weight="bold" fill="#c00">?</text>
          <text x="265" y="100" font-size="18" font-weight="bold" fill="#c00">?</text>
          <text x="290" y="130" font-size="18" font-weight="bold" fill="#c00">?</text>
          <text x="90" y="360" font-size="18" font-weight="bold" fill="#c00">?</text>
          <text x="115" y="190" font-size="18" font-weight="bold" fill="#c00">?</text>

          <!-- Title -->
          <text x="300" y="25" font-size="22" font-weight="bold" fill="#2c3e50" text-anchor="middle">The Water Cycle</text>
        </svg>
      </object>

      <gapText identifier="EVAPORATION" matchMax="1">Evaporation</gapText>
      <gapText identifier="CONDENSATION" matchMax="1">Condensation</gapText>
      <gapText identifier="PRECIPITATION" matchMax="1">Precipitation</gapText>
      <gapText identifier="COLLECTION" matchMax="1">Collection</gapText>
      <gapText identifier="TRANSPIRATION" matchMax="1">Transpiration</gapText>

      <associableHotspot identifier="A" matchMax="1" shape="rect" coords="95,240,125,270"/>
      <associableHotspot identifier="B" matchMax="1" shape="circle" coords="230,100,30"/>
      <associableHotspot identifier="C" matchMax="1" shape="rect" coords="275,115,305,145"/>
      <associableHotspot identifier="D" matchMax="1" shape="ellipse" coords="100,340,90,50"/>
      <associableHotspot identifier="E" matchMax="1" shape="rect" coords="100,175,130,205"/>
    </graphicGapMatchInteraction>
  </itemBody>

  <responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/map_response"/>
</assessmentItem>`;

export const GRAPHIC_GAP_MATCH_EARTH_LAYERS = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p2 http://www.imsglobal.org/xsd/qti/qtiv2p2/imsqti_v2p2.xsd"
  identifier="graphic-gap-match-earth-layers"
  title="Earth's Layers"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
    <correctResponse>
      <value>INNER_CORE A</value>
      <value>OUTER_CORE B</value>
      <value>MANTLE C</value>
      <value>CRUST D</value>
    </correctResponse>
    <mapping lowerBound="0" defaultValue="0">
      <mapEntry mapKey="INNER_CORE A" mappedValue="1"/>
      <mapEntry mapKey="OUTER_CORE B" mappedValue="1"/>
      <mapEntry mapKey="MANTLE C" mappedValue="1"/>
      <mapEntry mapKey="CRUST D" mappedValue="1"/>
    </mapping>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>

  <itemBody>
    <p>Earth is composed of four main layers: the inner core, outer core, mantle, and crust. Each layer has distinct physical and chemical properties.</p>
    <graphicGapMatchInteraction responseIdentifier="RESPONSE">
      <prompt>Label the layers of the Earth</prompt>
      <object type="image/svg+xml" width="500" height="500">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500">
          <!-- Background -->
          <rect width="500" height="500" fill="#000814"/>

          <!-- Cross-section showing half of Earth -->
          <defs>
            <clipPath id="halfCircle">
              <rect x="250" y="0" width="250" height="500"/>
            </clipPath>
          </defs>

          <!-- Full Earth outline (for left side) -->
          <circle cx="250" cy="250" r="220" fill="#4A90E2" stroke="#2E5C8A" stroke-width="2"/>

          <!-- Right side cross-section -->
          <g clip-path="url(#halfCircle)">
            <!-- Inner Core (A) - solid iron -->
            <circle cx="250" cy="250" r="50" fill="#FFD700" stroke="#FFA500" stroke-width="2"/>

            <!-- Outer Core (B) - liquid iron -->
            <circle cx="250" cy="250" r="110" fill="#FF8C00" stroke="#FF6347" stroke-width="2"/>

            <!-- Mantle (C) - semi-solid rock -->
            <circle cx="250" cy="250" r="200" fill="#DC143C" stroke="#B22222" stroke-width="2"/>

            <!-- Crust (D) - thin solid outer layer -->
            <circle cx="250" cy="250" r="220" fill="#8B4513" stroke="#654321" stroke-width="2"/>
          </g>

          <!-- Dividing line -->
          <line x1="250" y1="30" x2="250" y2="470" stroke="#fff" stroke-width="2"/>

          <!-- Layer labels with lines pointing to each layer -->
          <line x1="320" y1="250" x2="380" y2="250" stroke="#fff" stroke-width="2"/>
          <line x1="355" y1="250" x2="420" y2="200" stroke="#fff" stroke-width="2"/>
          <line x1="300" y1="190" x2="420" y2="150" stroke="#fff" stroke-width="2"/>
          <line x1="260" y1="70" x2="420" y2="100" stroke="#fff" stroke-width="2"/>

          <!-- Question marks -->
          <text x="430" y="255" font-size="18" font-weight="bold" fill="#FFD700">?</text>
          <text x="430" y="205" font-size="18" font-weight="bold" fill="#FF8C00">?</text>
          <text x="430" y="155" font-size="18" font-weight="bold" fill="#DC143C">?</text>
          <text x="430" y="105" font-size="18" font-weight="bold" fill="#8B4513">?</text>

          <!-- Scale indicator -->
          <text x="250" y="485" font-size="12" fill="#fff" text-anchor="middle">Not to scale</text>

          <!-- Title -->
          <text x="250" y="25" font-size="22" font-weight="bold" fill="#fff" text-anchor="middle">Earth's Layers (Cross-Section)</text>

          <!-- Left side label -->
          <text x="125" y="255" font-size="14" fill="#fff" text-anchor="middle">Earth's Surface</text>
        </svg>
      </object>

      <gapText identifier="INNER_CORE" matchMax="1">Inner Core</gapText>
      <gapText identifier="OUTER_CORE" matchMax="1">Outer Core</gapText>
      <gapText identifier="MANTLE" matchMax="1">Mantle</gapText>
      <gapText identifier="CRUST" matchMax="1">Crust</gapText>

      <associableHotspot identifier="A" matchMax="1" shape="rect" coords="425,240,475,260"/>
      <associableHotspot identifier="B" matchMax="1" shape="rect" coords="425,190,475,210"/>
      <associableHotspot identifier="C" matchMax="1" shape="rect" coords="425,140,475,160"/>
      <associableHotspot identifier="D" matchMax="1" shape="rect" coords="425,90,475,110"/>
    </graphicGapMatchInteraction>
  </itemBody>

  <responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/map_response"/>
</assessmentItem>`;

export const CHOICE_WITH_INLINE_STIMULUS = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                identifier="choice-with-stimulus"
                title="Reading Comprehension Question"
                adaptive="false"
                timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>ChoiceB</value>
    </correctResponse>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>1.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <stimulus>
      <div class="stimulus-container" style="background: #f8f9fa; padding: 1rem; border-left: 4px solid #0066cc; margin-bottom: 1rem;">
        <h3 style="margin-top: 0; color: #0066cc;">Read the following passage:</h3>
        <p><strong>The Industrial Revolution</strong></p>
        <p>The Industrial Revolution marked a major turning point in history. During the late 18th and early 19th centuries, new manufacturing processes transformed largely rural, agrarian societies in Europe and America into industrial and urban ones.</p>
        <p>Goods that had once been painstakingly crafted by hand started to be produced in mass quantities by machines in factories. The boom in productivity and economic growth had profound effects on the structure of society, creating new social classes and changing the nature of work.</p>
        <p>Key innovations included the steam engine, spinning jenny, and power loom. These technological advances led to the growth of cities, changes in labor practices, and the emergence of new economic systems.</p>
      </div>
    </stimulus>
    <p><strong>Question:</strong> According to the passage, what was the main effect of the Industrial Revolution?</p>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
      <prompt>Select the best answer:</prompt>
      <simpleChoice identifier="ChoiceA">It decreased economic productivity in rural areas</simpleChoice>
      <simpleChoice identifier="ChoiceB">It transformed rural societies into industrial and urban ones</simpleChoice>
      <simpleChoice identifier="ChoiceC">It reduced the use of machines in manufacturing</simpleChoice>
      <simpleChoice identifier="ChoiceD">It had no significant effect on society</simpleChoice>
    </choiceInteraction>
  </itemBody>

  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match>
          <variable identifier="RESPONSE"/>
          <correct identifier="RESPONSE"/>
        </match>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">1.0</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

export const UPLOAD_INTERACTION = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="upload-interaction"
  title="Upload Interaction"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="UPLOAD" cardinality="single" baseType="file"/>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p><strong>Upload:</strong> Please upload a text file.</p>
    <uploadInteraction responseIdentifier="UPLOAD">
      <prompt>Choose a .txt file</prompt>
      <fileType>text/plain</fileType>
      <fileType>.txt</fileType>
    </uploadInteraction>
  </itemBody>

  <!-- No scoring for upload -->
</assessmentItem>`;

export const DRAWING_INTERACTION = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="drawing-interaction"
  title="Drawing Interaction"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="DRAW" cardinality="single" baseType="file"/>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p><strong>Drawing:</strong> Draw a line on the canvas.</p>
    <drawingInteraction responseIdentifier="DRAW">
      <prompt>Annotate the diagram</prompt>
      <object type="image/svg+xml" width="500" height="300">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 300">
          <rect x="10" y="10" width="480" height="280" fill="#ffffff" stroke="#111827" stroke-width="2"/>
          <text x="250" y="40" text-anchor="middle" font-size="18" fill="#111827">Draw anywhere inside the box</text>
        </svg>
      </object>
    </drawingInteraction>
  </itemBody>

  <!-- No scoring for drawing -->
</assessmentItem>`;

export const MEDIA_INTERACTION_AUDIO = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="media-audio"
  title="Media Interaction - Audio"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="MEDIA_RESPONSE" cardinality="single" baseType="integer"/>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>1.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p><strong>Listening Comprehension:</strong> Listen to the audio clip carefully. You must play it at least twice.</p>
    <mediaInteraction responseIdentifier="MEDIA_RESPONSE" minPlays="2" maxPlays="5">
      <prompt>Listen to the pronunciation</prompt>
      <audio>
        <source src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" type="audio/mpeg"/>
      </audio>
    </mediaInteraction>
    <p>Question: How many times did you listen to the audio?</p>
  </itemBody>

  <!-- Scoring based on meeting minimum play requirement -->
  <responseProcessing>
    <responseCondition>
      <responseIf>
        <gte>
          <variable identifier="MEDIA_RESPONSE"/>
          <baseValue baseType="integer">2</baseValue>
        </gte>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">1.0</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

export const HOTTEXT_INTERACTION_SINGLE = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="hottext-single"
  title="Hottext Interaction - Single Selection"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>H2</value>
    </correctResponse>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>1.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p><strong>Grammar:</strong> Select the word that is a verb in the following sentence.</p>
    <hottextInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <prompt>Click on the verb:</prompt>
      <p>The <hottext identifier="H1">cat</hottext> <hottext identifier="H2">jumps</hottext> over the <hottext identifier="H3">fence</hottext>.</p>
    </hottextInteraction>
  </itemBody>

  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match>
          <variable identifier="RESPONSE"/>
          <correct identifier="RESPONSE"/>
        </match>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">1.0</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

export const HOTTEXT_INTERACTION_MULTIPLE = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="hottext-multiple"
  title="Hottext Interaction - Multiple Selection"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="identifier">
    <correctResponse>
      <value>H2</value>
      <value>H4</value>
    </correctResponse>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>1.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p><strong>Reading Comprehension:</strong> Select all statements that are facts (not opinions).</p>
    <hottextInteraction responseIdentifier="RESPONSE" maxChoices="3">
      <prompt>Select the factual statements:</prompt>
      <p><hottext identifier="H1">Summer is the best season</hottext></p>
      <p><hottext identifier="H2">Water boils at 100°C at sea level</hottext></p>
      <p><hottext identifier="H3">Classical music is more sophisticated than pop</hottext></p>
      <p><hottext identifier="H4">The Earth orbits the Sun</hottext></p>
    </hottextInteraction>
  </itemBody>

  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match>
          <variable identifier="RESPONSE"/>
          <correct identifier="RESPONSE"/>
        </match>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">1.0</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

export const SELECT_POINT_INTERACTION = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="select-point"
  title="Select Point Interaction"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="point"/>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>1.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p><strong>Geometry:</strong> Click on the center point of the blue circle.</p>
    <selectPointInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <prompt>Click to mark the center:</prompt>
      <object type="image/svg+xml" width="500" height="400">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 400">
          <!-- Background -->
          <rect width="500" height="400" fill="#f5f5f5"/>

          <!-- Grid lines for reference -->
          <defs>
            <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e0e0e0" stroke-width="1"/>
            </pattern>
          </defs>
          <rect width="500" height="400" fill="url(#grid)"/>

          <!-- Shapes -->
          <!-- Red Square -->
          <rect x="80" y="80" width="100" height="100" fill="#ef5350" stroke="#c62828" stroke-width="3" opacity="0.8"/>
          <text x="130" y="140" text-anchor="middle" font-size="16" fill="#fff" font-weight="bold">Square</text>

          <!-- Blue Circle (target) -->
          <circle cx="350" cy="200" r="70" fill="#42a5f5" stroke="#1565c0" stroke-width="3" opacity="0.8"/>
          <text x="350" y="205" text-anchor="middle" font-size="16" fill="#fff" font-weight="bold">Circle</text>

          <!-- Crosshair at center (hint) -->
          <line x1="340" y1="200" x2="360" y2="200" stroke="#fff" stroke-width="2" opacity="0.4"/>
          <line x1="350" y1="190" x2="350" y2="210" stroke="#fff" stroke-width="2" opacity="0.4"/>

          <!-- Green Triangle -->
          <path d="M 130,280 L 180,360 L 80,360 Z" fill="#66bb6a" stroke="#2e7d32" stroke-width="3" opacity="0.8"/>
          <text x="130" y="340" text-anchor="middle" font-size="16" fill="#fff" font-weight="bold">Triangle</text>

          <!-- Labels with coordinates -->
          <text x="250" y="30" text-anchor="middle" font-size="14" fill="#424242" font-weight="600">
            Click on the center of the blue circle
          </text>
          <text x="250" y="380" text-anchor="middle" font-size="12" fill="#666" font-style="italic">
            (The center is at approximately 350, 200)
          </text>
        </svg>
      </object>
    </selectPointInteraction>
  </itemBody>

  <responseProcessing>
    <responseCondition>
      <responseIf>
        <inside shape="circle" coords="350,200,20">
          <variable identifier="RESPONSE"/>
        </inside>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">1.0</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

export const MEDIA_INTERACTION_VIDEO = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="media-video"
  title="Media Interaction - Video"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="VIDEO_RESPONSE" cardinality="single" baseType="integer"/>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>1.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p><strong>Video Analysis:</strong> Watch the video. You can watch it up to 3 times.</p>
    <mediaInteraction responseIdentifier="VIDEO_RESPONSE" autostart="false" maxPlays="3" minPlays="1">
      <prompt>Watch the demonstration carefully</prompt>
      <video width="640" height="360">
        <source src="https://www.w3schools.com/html/mov_bbb.mp4" type="video/mp4"/>
      </video>
    </mediaInteraction>
    <p>The play count is automatically tracked and recorded.</p>
  </itemBody>

  <!-- Scoring based on watching at least once -->
  <responseProcessing>
    <responseCondition>
      <responseIf>
        <gte>
          <variable identifier="VIDEO_RESPONSE"/>
          <baseValue baseType="integer">1</baseValue>
        </gte>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">1.0</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

export const CUSTOM_INTERACTION = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="custom-interaction"
  title="Custom Interaction (Fallback)"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="CUST" cardinality="single" baseType="string"/>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p><strong>Custom:</strong> This is a vendor-specific interaction.</p>
    <customInteraction responseIdentifier="CUST" class="vendor-custom" data-vendor="acme">
      <prompt>Do the custom thing</prompt>
      <div>Vendor payload goes here</div>
    </customInteraction>
  </itemBody>
</assessmentItem>`;

export const MATH_INLINE = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  xmlns:m="http://www.w3.org/1998/Math/MathML"
  identifier="math-inline"
  title="Quadratic Formula - Inline Math"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>ChoiceB</value>
    </correctResponse>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>1.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>Solve for <m:math><m:mi>x</m:mi></m:math> in the equation <m:math><m:mrow><m:msup><m:mi>x</m:mi><m:mn>2</m:mn></m:msup><m:mo>+</m:mo><m:mn>5</m:mn><m:mi>x</m:mi><m:mo>+</m:mo><m:mn>6</m:mn><m:mo>=</m:mo><m:mn>0</m:mn></m:mrow></m:math>.</p>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
      <prompt>Select the correct solution set:</prompt>
      <simpleChoice identifier="ChoiceA"><m:math><m:mrow><m:mi>x</m:mi><m:mo>=</m:mo><m:mn>2</m:mn></m:mrow></m:math> or <m:math><m:mrow><m:mi>x</m:mi><m:mo>=</m:mo><m:mn>3</m:mn></m:mrow></m:math></simpleChoice>
      <simpleChoice identifier="ChoiceB"><m:math><m:mrow><m:mi>x</m:mi><m:mo>=</m:mo><m:mo>-</m:mo><m:mn>2</m:mn></m:mrow></m:math> or <m:math><m:mrow><m:mi>x</m:mi><m:mo>=</m:mo><m:mo>-</m:mo><m:mn>3</m:mn></m:mrow></m:math></simpleChoice>
      <simpleChoice identifier="ChoiceC"><m:math><m:mrow><m:mi>x</m:mi><m:mo>=</m:mo><m:mn>1</m:mn></m:mrow></m:math> or <m:math><m:mrow><m:mi>x</m:mi><m:mo>=</m:mo><m:mn>6</m:mn></m:mrow></m:math></simpleChoice>
      <simpleChoice identifier="ChoiceD"><m:math><m:mrow><m:mi>x</m:mi><m:mo>=</m:mo><m:mo>-</m:mo><m:mn>1</m:mn></m:mrow></m:math> or <m:math><m:mrow><m:mi>x</m:mi><m:mo>=</m:mo><m:mo>-</m:mo><m:mn>6</m:mn></m:mrow></m:math></simpleChoice>
    </choiceInteraction>
  </itemBody>

  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match>
          <variable identifier="RESPONSE"/>
          <correct identifier="RESPONSE"/>
        </match>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">1.0</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

export const MATH_EXTENDED_RESPONSE = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  xmlns:m="http://www.w3.org/1998/Math/MathML"
  identifier="math-extended"
  title="Pythagorean Theorem - Show Your Work"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string"/>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>4.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <rubricBlock view="scorer tutor author">
    <h3>Scoring Rubric</h3>
    <table>
      <thead>
        <tr>
          <th>Points</th>
          <th>Criteria</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>4 points</strong></td>
          <td>
            <ul>
              <li>Correctly identifies the Pythagorean theorem formula</li>
              <li>Shows all work with proper substitution</li>
              <li>Arrives at correct answer (c = 13)</li>
              <li>Uses proper mathematical notation</li>
            </ul>
          </td>
        </tr>
        <tr>
          <td><strong>3 points</strong></td>
          <td>
            <ul>
              <li>Correct formula and method</li>
              <li>Minor calculation error</li>
              <li>Shows most work</li>
            </ul>
          </td>
        </tr>
        <tr>
          <td><strong>2 points</strong></td>
          <td>
            <ul>
              <li>Correct formula but significant calculation errors</li>
              <li>Partial work shown</li>
            </ul>
          </td>
        </tr>
        <tr>
          <td><strong>1 point</strong></td>
          <td>
            <ul>
              <li>Demonstrates some understanding</li>
              <li>Major errors in approach or calculation</li>
            </ul>
          </td>
        </tr>
        <tr>
          <td><strong>0 points</strong></td>
          <td>
            <ul>
              <li>No response or completely incorrect</li>
            </ul>
          </td>
        </tr>
      </tbody>
    </table>
  </rubricBlock>

  <rubricBlock view="candidate">
    <p><em>Show all your work. Use the math editor toolbar to insert mathematical expressions and formulas.</em></p>
  </rubricBlock>

  <itemBody>
    <p>A right triangle has legs of length <m:math><m:mrow><m:mi>a</m:mi><m:mo>=</m:mo><m:mn>5</m:mn></m:mrow></m:math> and <m:math><m:mrow><m:mi>b</m:mi><m:mo>=</m:mo><m:mn>12</m:mn></m:mrow></m:math>.</p>
    <p>Using the Pythagorean theorem <m:math><m:mrow><m:msup><m:mi>a</m:mi><m:mn>2</m:mn></m:msup><m:mo>+</m:mo><m:msup><m:mi>b</m:mi><m:mn>2</m:mn></m:msup><m:mo>=</m:mo><m:msup><m:mi>c</m:mi><m:mn>2</m:mn></m:msup></m:mrow></m:math>, find the length of the hypotenuse <m:math><m:mi>c</m:mi></m:math>.</p>
    <p><strong>Show all your work and explain your reasoning.</strong></p>
    <extendedTextInteraction responseIdentifier="RESPONSE" expectedLines="6" expectedLength="500"/>
  </itemBody>

  <responseProcessing>
    <responseCondition>
      <responseIf>
        <isNull>
          <variable identifier="RESPONSE"/>
        </isNull>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <!-- This item requires human scoring based on the rubric -->
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

export const ADAPTIVE_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="adaptive-capitals"
  title="Adaptive Question: European Capitals"
  adaptive="true"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>ChoiceC</value>
    </correctResponse>
  </responseDeclaration>

  <responseDeclaration identifier="HINT" cardinality="single" baseType="boolean"/>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>1.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="completionStatus" cardinality="single" baseType="identifier">
    <defaultValue>
      <value>not_attempted</value>
    </defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="numAttempts" cardinality="single" baseType="integer">
    <defaultValue>
      <value>0</value>
    </defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="FEEDBACK" cardinality="single" baseType="identifier"/>

  <itemBody>
    <p>What is the capital of France?</p>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
      <prompt>Select the correct answer:</prompt>
      <simpleChoice identifier="ChoiceA">Berlin</simpleChoice>
      <simpleChoice identifier="ChoiceB">London</simpleChoice>
      <simpleChoice identifier="ChoiceC">Paris</simpleChoice>
      <simpleChoice identifier="ChoiceD">Madrid</simpleChoice>
    </choiceInteraction>

    <endAttemptInteraction responseIdentifier="HINT" title="Request Hint" countAttempt="false">
      <prompt>Need a hint? Click below (does not count as an attempt)</prompt>
    </endAttemptInteraction>
  </itemBody>

  <responseProcessing>
    <responseCondition>
      <!-- Handle hint request -->
      <responseIf>
        <match>
          <variable identifier="HINT"/>
          <baseValue baseType="boolean">true</baseValue>
        </match>
        <setOutcomeValue identifier="FEEDBACK">
          <baseValue baseType="identifier">hint</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElseIf>
        <!-- Correct answer -->
        <match>
          <variable identifier="RESPONSE"/>
          <correct identifier="RESPONSE"/>
        </match>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">1.0</baseValue>
        </setOutcomeValue>
        <setOutcomeValue identifier="completionStatus">
          <baseValue baseType="identifier">completed</baseValue>
        </setOutcomeValue>
        <setOutcomeValue identifier="FEEDBACK">
          <baseValue baseType="identifier">correct</baseValue>
        </setOutcomeValue>
      </responseElseIf>
      <responseElseIf>
        <!-- First attempt incorrect -->
        <lt>
          <variable identifier="numAttempts"/>
          <baseValue baseType="integer">2</baseValue>
        </lt>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
        <setOutcomeValue identifier="FEEDBACK">
          <baseValue baseType="identifier">tryagain</baseValue>
        </setOutcomeValue>
      </responseElseIf>
      <responseElse>
        <!-- Second attempt incorrect - end item -->
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
        <setOutcomeValue identifier="completionStatus">
          <baseValue baseType="identifier">completed</baseValue>
        </setOutcomeValue>
        <setOutcomeValue identifier="FEEDBACK">
          <baseValue baseType="identifier">answer</baseValue>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>

  <modalFeedback outcomeIdentifier="FEEDBACK" identifier="hint" showHide="show">
    <p><strong>Hint:</strong> This city is known for the Eiffel Tower.</p>
  </modalFeedback>

  <modalFeedback outcomeIdentifier="FEEDBACK" identifier="correct" showHide="show">
    <p><strong>Correct!</strong> Paris is indeed the capital of France.</p>
  </modalFeedback>

  <modalFeedback outcomeIdentifier="FEEDBACK" identifier="tryagain" showHide="show">
    <p><strong>Not quite.</strong> Try again or request a hint!</p>
  </modalFeedback>

  <modalFeedback outcomeIdentifier="FEEDBACK" identifier="answer" showHide="show">
    <p><strong>The correct answer is Paris.</strong> France's capital is known for its art, culture, and iconic landmarks like the Eiffel Tower and Louvre Museum.</p>
  </modalFeedback>
</assessmentItem>`;

export const MATH_FRACTIONS = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  xmlns:m="http://www.w3.org/1998/Math/MathML"
  identifier="math-fractions"
  title="Adding Fractions"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>ChoiceC</value>
    </correctResponse>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>1.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>Calculate the following sum and simplify your answer:</p>
    <div style="text-align: center; margin: 1.5rem 0;">
      <m:math display="block">
        <m:mrow>
          <m:mfrac>
            <m:mn>2</m:mn>
            <m:mn>3</m:mn>
          </m:mfrac>
          <m:mo>+</m:mo>
          <m:mfrac>
            <m:mn>3</m:mn>
            <m:mn>4</m:mn>
          </m:mfrac>
          <m:mo>=</m:mo>
          <m:mo>?</m:mo>
        </m:mrow>
      </m:math>
    </div>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
      <prompt>Select the correct answer:</prompt>
      <simpleChoice identifier="ChoiceA">
        <m:math>
          <m:mfrac>
            <m:mn>5</m:mn>
            <m:mn>7</m:mn>
          </m:mfrac>
        </m:math>
      </simpleChoice>
      <simpleChoice identifier="ChoiceB">
        <m:math>
          <m:mfrac>
            <m:mn>5</m:mn>
            <m:mn>12</m:mn>
          </m:mfrac>
        </m:math>
      </simpleChoice>
      <simpleChoice identifier="ChoiceC">
        <m:math>
          <m:mfrac>
            <m:mn>17</m:mn>
            <m:mn>12</m:mn>
          </m:mfrac>
        </m:math>
        (or
        <m:math>
          <m:mrow>
            <m:mn>1</m:mn>
            <m:mfrac>
              <m:mn>5</m:mn>
              <m:mn>12</m:mn>
            </m:mfrac>
          </m:mrow>
        </m:math>)
      </simpleChoice>
      <simpleChoice identifier="ChoiceD">
        <m:math>
          <m:mfrac>
            <m:mn>6</m:mn>
            <m:mn>12</m:mn>
          </m:mfrac>
        </m:math>
      </simpleChoice>
    </choiceInteraction>
  </itemBody>

  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match>
          <variable identifier="RESPONSE"/>
          <correct identifier="RESPONSE"/>
        </match>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">1.0</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

export const GRAPHIC_ORDER_INTERACTION = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="graphic-order"
  title="Graphic Order Interaction">
  <responseDeclaration identifier="RESPONSE" cardinality="ordered" baseType="identifier">
    <correctResponse>
      <value>BEDROCK</value>
      <value>SEDIMENTARY</value>
      <value>TOPSOIL</value>
    </correctResponse>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0</value>
    </defaultValue>
  </outcomeDeclaration>
  <itemBody>
    <p><strong>Geology:</strong> Arrange the geological layers in order from bottom to top.</p>
    <graphicOrderInteraction responseIdentifier="RESPONSE">
      <prompt>Drag to reorder the layers correctly:</prompt>
      <object type="image/png" data="/sample-geolayers.png" width="600" height="350">
        Geological layers cross-section diagram
      </object>
      <hotspotChoice identifier="TOPSOIL" shape="rect" coords="0,0,100,50">Top Soil</hotspotChoice>
      <hotspotChoice identifier="SEDIMENTARY" shape="rect" coords="0,0,100,50">Sedimentary Rock</hotspotChoice>
      <hotspotChoice identifier="BEDROCK" shape="rect" coords="0,0,100,50">Bedrock</hotspotChoice>
    </graphicOrderInteraction>
  </itemBody>
  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match>
          <variable identifier="RESPONSE"/>
          <correct identifier="RESPONSE"/>
        </match>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">1.0</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

// NOTE: positionObjectInteraction has severe QTI 2.2 spec limitations:
// - Response format (baseType="point") only stores coordinates, not object identifiers
// - Cannot track which specific object was placed where
// - Only suitable for placing multiple copies of the SAME object (like airport icons)
// - For labeled object placement, use graphicGapMatchInteraction instead
// This example demonstrates the interaction but has limited practical utility.
export const POSITION_OBJECT_INTERACTION = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="position-object"
  title="Geography - State Capitals"
  adaptive="false"
  timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="point">
    <correctResponse>
      <value>105 132</value>
    </correctResponse>
    <!-- Use areaMapping for tolerance: accept any point within 25px radius of Austin -->
    <areaMapping defaultValue="0">
      <areaMapEntry shape="circle" coords="105,132,25" mappedValue="1.0"/>
    </areaMapping>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0</value>
    </defaultValue>
  </outcomeDeclaration>
  <itemBody>
    <div class="qti-item">
      <p>Place the star marker on the capital of Texas (Austin).</p>
      <positionObjectInteraction responseIdentifier="RESPONSE" maxChoices="1">
        <prompt>Drag the star to the correct location:</prompt>
        <object type="image/png" data="/usa-map-capitals.png" width="300" height="196">
          USA Outline Map
        </object>
        <positionObjectStage identifier="AUSTIN" matchMax="1">
          <object type="image/svg+xml" width="24" height="24">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="gold" stroke="orange" stroke-width="1">
              <polygon points="12,2 15,10 24,10 17,15 20,23 12,18 4,23 7,15 0,10 9,10"/>
            </svg>
          </object>Austin</positionObjectStage>
      </positionObjectInteraction>
    </div>
  </itemBody>
  <responseProcessing>
    <!-- Use mapResponsePoint with areaMapping to score based on proximity to target -->
    <setOutcomeValue identifier="SCORE">
      <mapResponsePoint identifier="RESPONSE"/>
    </setOutcomeValue>
  </responseProcessing>
</assessmentItem>`;

export const END_ATTEMPT_INTERACTION = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="end-attempt"
  title="End Attempt Interaction">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="boolean">
    <defaultValue>
      <value>false</value>
    </defaultValue>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0</value>
    </defaultValue>
  </outcomeDeclaration>
  <itemBody>
    <div class="qti-item">
      <h2>Assessment Instructions</h2>
      <p>This assessment contains 15 questions covering topics in biology, chemistry, and physics.</p>
      <p>You may work through the questions at your own pace. When you are finished or wish to stop working, click the button below to end your attempt.</p>
      <p><strong>Important:</strong> Once you end your attempt, you will not be able to make any further changes to your responses.</p>

      <endAttemptInteraction responseIdentifier="RESPONSE" title="End Assessment">
        <prompt>Click the button below when you are ready to end your attempt and submit your responses.</prompt>
      </endAttemptInteraction>

      <div class="mt-6 p-4 bg-base-200 rounded-lg">
        <h3 class="font-bold mb-2">Before ending your attempt:</h3>
        <ul class="list-disc list-inside space-y-1">
          <li>Review all your responses</li>
          <li>Check that you have answered all required questions</li>
          <li>Ensure you have saved all your work</li>
        </ul>
      </div>
    </div>
  </itemBody>
  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match>
          <variable identifier="RESPONSE"/>
          <baseValue baseType="boolean">true</baseValue>
        </match>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">1.0</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

export const GRAPHIC_ASSOCIATE_INTERACTION = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="graphic-associate"
  title="Graphic Associate Interaction">
  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="pair">
    <correctResponse>
      <value>LIVER BLOOD</value>
      <value>LUNGS OXYGEN</value>
      <value>HEART PUMP</value>
    </correctResponse>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0</value>
    </defaultValue>
  </outcomeDeclaration>
  <itemBody>
    <p><strong>Biology:</strong> Connect each organ to its primary function by clicking pairs of hotspots.</p>
    <graphicAssociateInteraction responseIdentifier="RESPONSE" maxAssociations="3" minAssociations="1">
      <prompt>Click an organ, then click its function to create an association:</prompt>
      <object type="image/svg+xml" width="500" height="300">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 300">
          <rect width="500" height="300" fill="#f5f5f5"/>
          <text x="250" y="150" text-anchor="middle" font-size="20" fill="#666">Human Body Diagram</text>
          <text x="100" y="50" text-anchor="middle" font-size="14" fill="#333">ORGANS</text>
          <text x="400" y="50" text-anchor="middle" font-size="14" fill="#333">FUNCTIONS</text>
        </svg>
      </object>
      <associableHotspot identifier="HEART" shape="rect" coords="50,80,150,120" matchMax="1">Heart</associableHotspot>
      <associableHotspot identifier="LUNGS" shape="rect" coords="50,140,150,180" matchMax="1">Lungs</associableHotspot>
      <associableHotspot identifier="LIVER" shape="rect" coords="50,200,150,240" matchMax="1">Liver</associableHotspot>
      <associableHotspot identifier="PUMP" shape="rect" coords="350,80,450,120" matchMax="1">Pump Blood</associableHotspot>
      <associableHotspot identifier="OXYGEN" shape="rect" coords="350,140,450,180" matchMax="1">Gas Exchange</associableHotspot>
      <associableHotspot identifier="BLOOD" shape="rect" coords="350,200,450,240" matchMax="1">Filter Blood</associableHotspot>
    </graphicAssociateInteraction>
  </itemBody>
  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match>
          <variable identifier="RESPONSE"/>
          <correct identifier="RESPONSE"/>
        </match>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">1.0</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

export const SAMPLE_ITEMS: SampleItem[] = [
  {
    id: 'simple-choice',
    title: 'Simple Multiple Choice',
    description: 'Basic subtraction word problem with plausible distractors',
    xml: SIMPLE_CHOICE,
  },
  {
    id: 'partial-credit',
    title: 'Partial Credit',
    description: 'Multiple choice with partial credit using mapResponse',
    xml: PARTIAL_CREDIT,
  },
  {
    id: 'capital-cities',
    title: 'Capital Cities',
    description: 'Geography question with shuffled choices',
    xml: CAPITAL_CITIES,
  },
  {
    id: 'text-entry',
    title: 'Text Entry',
    description: 'Fill-in-the-blank question with case-insensitive matching',
    xml: TEXT_ENTRY,
  },
  {
    id: 'extended-text',
    title: 'Extended Text',
    description: 'Multi-line text response question',
    xml: EXTENDED_TEXT,
  },
  {
    id: 'inline-choice',
    title: 'Inline Choice',
    description: 'Dropdown menu embedded in text',
    xml: INLINE_CHOICE,
  },
  {
    id: 'order-interaction',
    title: 'Order Interaction',
    description: 'Arrange items in correct sequence',
    xml: ORDER_INTERACTION,
  },
  {
    id: 'match-interaction',
    title: 'Match Interaction',
    description: 'Match items from two columns',
    xml: MATCH_INTERACTION,
  },
  {
    id: 'associate-interaction',
    title: 'Associate Interaction',
    description: 'Create associations between items',
    xml: ASSOCIATE_INTERACTION,
  },
  {
    id: 'gap-match',
    title: 'Gap Match',
    description: 'Drag words into gaps in text',
    xml: GAP_MATCH_INTERACTION,
  },
  {
    id: 'graphic-gap-match-solar-system',
    title: 'Graphic Gap Match - Solar System',
    description: 'Label the four inner planets of our solar system',
    xml: GRAPHIC_GAP_MATCH_SOLAR_SYSTEM,
  },
  {
    id: 'slider',
    title: 'Slider Interaction',
    description: 'Select a value on a numerical slider',
    xml: SLIDER_INTERACTION,
  },
  {
    id: 'hotspot',
    title: 'Hotspot Interaction - Solar System',
    description: 'Click on the Blue Planet in this astronomy question',
    xml: HOTSPOT_INTERACTION,
  },
  {
    id: 'hotspot-partial-credit',
    title: 'Hotspot with Partial Credit - Solar System',
    description: 'Identify planet with liquid water (partial credit for terrestrial planets)',
    xml: HOTSPOT_PARTIAL_CREDIT,
  },
  {
    id: 'template-variable-demo',
    title: 'QTI Scripting (Template + Response Processing)',
    description: 'templateProcessing generates values; responseProcessing scores against them',
    xml: TEMPLATE_VARIABLE_DEMO,
  },
  {
    id: 'upload-interaction',
    title: 'Upload Interaction',
    description: 'Upload a file as the response (baseType=file)',
    xml: UPLOAD_INTERACTION,
  },
  {
    id: 'drawing-interaction',
    title: 'Drawing Interaction',
    description: 'Draw on a canvas (baseType=file, PNG dataUrl)',
    xml: DRAWING_INTERACTION,
  },
  {
    id: 'media-audio',
    title: 'Media Interaction - Audio',
    description: 'Audio player with play count tracking and minPlays requirement',
    xml: MEDIA_INTERACTION_AUDIO,
  },
  {
    id: 'media-video',
    title: 'Media Interaction - Video',
    description: 'Video player with play count tracking and maxPlays limit',
    xml: MEDIA_INTERACTION_VIDEO,
  },
  {
    id: 'hottext-single',
    title: 'Hottext Interaction - Single Selection',
    description: 'Click to select a single word within text (grammar question)',
    xml: HOTTEXT_INTERACTION_SINGLE,
  },
  {
    id: 'hottext-multiple',
    title: 'Hottext Interaction - Multiple Selection',
    description: 'Click to select multiple text segments (reading comprehension)',
    xml: HOTTEXT_INTERACTION_MULTIPLE,
  },
  {
    id: 'select-point',
    title: 'Select Point Interaction',
    description: 'Click on the image to select a point location (geography question)',
    xml: SELECT_POINT_INTERACTION,
  },
  {
    id: 'graphic-order',
    title: 'Graphic Order Interaction',
    description: 'Drag to reorder items on an image (geological layers)',
    xml: GRAPHIC_ORDER_INTERACTION,
  },
  {
    id: 'graphic-associate',
    title: 'Graphic Associate Interaction',
    description: 'Click pairs of hotspots to create associations (organ matching)',
    xml: GRAPHIC_ASSOCIATE_INTERACTION,
  },
  {
    id: 'position-object',
    title: 'Position Object Interaction',
    description: 'Drag and position furniture objects on a room layout',
    xml: POSITION_OBJECT_INTERACTION,
  },
  {
    id: 'end-attempt',
    title: 'End Attempt Interaction',
    description: 'Button to end the assessment attempt',
    xml: END_ATTEMPT_INTERACTION,
  },
  {
    id: 'custom-interaction',
    title: 'Custom Interaction (Fallback)',
    description: 'Shows a fallback UI for customInteraction and allows a manual response',
    xml: CUSTOM_INTERACTION,
  },
  {
    id: 'choice-with-stimulus',
    title: 'Reading Comprehension (with inline stimulus)',
    description: 'Question with reading passage embedded inline',
    xml: CHOICE_WITH_INLINE_STIMULUS,
  },
  {
    id: 'math-inline',
    title: 'Math - Quadratic Equation (Inline Math)',
    description: 'Multiple choice with MathML inline math rendering',
    xml: MATH_INLINE,
  },
  {
    id: 'math-extended',
    title: 'Math - Pythagorean Theorem (Show Work)',
    description: 'Extended response with MathML and rich text editor for showing mathematical work',
    xml: MATH_EXTENDED_RESPONSE,
  },
  {
    id: 'math-fractions',
    title: 'Math - Adding Fractions (Block Math)',
    description: 'Fraction arithmetic with MathML block display',
    xml: MATH_FRACTIONS,
  },
  {
    id: 'adaptive-capitals',
    title: 'Adaptive Item - European Capitals',
    description: 'Multi-attempt adaptive question with progressive feedback and hints',
    xml: ADAPTIVE_ITEM,
  },
];
