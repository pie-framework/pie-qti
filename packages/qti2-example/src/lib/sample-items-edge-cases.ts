/**
 * Edge Case QTI 2.2 Items for UI Genericity Testing
 *
 * These items test extreme scenarios to ensure UI components work across
 * a wide range of content, not just typical test examples.
 *
 * Categories tested:
 * - Extreme volume (many options/items)
 * - Extreme content (very long/short text, unicode, math-heavy)
 * - Extreme dimensions (large/small images, aspect ratios)
 * - Constraint extremes (boundary conditions, complex cardinality)
 * - Mixed media (text + images + math combined)
 *
 * Created: 2026-01-09
 * Part of: UI Genericity Evaluation Plan
 */

// =============================================================================
// CHOICE INTERACTION - Edge Cases
// =============================================================================

export const CHOICE_MANY_OPTIONS = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="choice-many-options"
  title="Choice with 15 Options"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>ChoiceL</value>
    </correctResponse>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0.0</value></defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue><value>1.0</value></defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>Which of the following elements has the atomic number 29?</p>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
      <prompt>Select the correct element:</prompt>
      <simpleChoice identifier="ChoiceA">Hydrogen (H)</simpleChoice>
      <simpleChoice identifier="ChoiceB">Helium (He)</simpleChoice>
      <simpleChoice identifier="ChoiceC">Lithium (Li)</simpleChoice>
      <simpleChoice identifier="ChoiceD">Carbon (C)</simpleChoice>
      <simpleChoice identifier="ChoiceE">Nitrogen (N)</simpleChoice>
      <simpleChoice identifier="ChoiceF">Oxygen (O)</simpleChoice>
      <simpleChoice identifier="ChoiceG">Fluorine (F)</simpleChoice>
      <simpleChoice identifier="ChoiceH">Neon (Ne)</simpleChoice>
      <simpleChoice identifier="ChoiceI">Sodium (Na)</simpleChoice>
      <simpleChoice identifier="ChoiceJ">Magnesium (Mg)</simpleChoice>
      <simpleChoice identifier="ChoiceK">Aluminum (Al)</simpleChoice>
      <simpleChoice identifier="ChoiceL">Copper (Cu)</simpleChoice>
      <simpleChoice identifier="ChoiceM">Zinc (Zn)</simpleChoice>
      <simpleChoice identifier="ChoiceN">Iron (Fe)</simpleChoice>
      <simpleChoice identifier="ChoiceO">Gold (Au)</simpleChoice>
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

export const CHOICE_VERY_LONG_TEXT = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="choice-very-long-text"
  title="Choice with Very Long Option Text"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>ChoiceB</value>
    </correctResponse>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0.0</value></defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue><value>1.0</value></defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>Which of the following best describes the concept of photosynthesis in plants?</p>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
      <prompt>Select the most complete and accurate description:</prompt>
      <simpleChoice identifier="ChoiceA">Photosynthesis is the process by which plants convert sunlight into energy for their own use.</simpleChoice>
      <simpleChoice identifier="ChoiceB">Photosynthesis is the biochemical process by which green plants, algae, and certain bacteria convert light energy, typically from the sun, into chemical energy stored in glucose molecules, using carbon dioxide from the atmosphere and water from the soil, while releasing oxygen as a byproduct through a series of light-dependent and light-independent reactions occurring primarily in the chloroplasts.</simpleChoice>
      <simpleChoice identifier="ChoiceC">Photosynthesis happens when plants take in sunlight and create oxygen that we breathe.</simpleChoice>
      <simpleChoice identifier="ChoiceD">Photosynthesis is when chlorophyll in leaves absorbs light and produces sugar and oxygen.</simpleChoice>
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

export const CHOICE_VERY_SHORT_TEXT = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="choice-very-short-text"
  title="Choice with Single Letter Options"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>ChoiceC</value>
    </correctResponse>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0.0</value></defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue><value>1.0</value></defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>Which letter comes after B in the English alphabet?</p>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
      <prompt>Select the correct letter:</prompt>
      <simpleChoice identifier="ChoiceA">A</simpleChoice>
      <simpleChoice identifier="ChoiceB">B</simpleChoice>
      <simpleChoice identifier="ChoiceC">C</simpleChoice>
      <simpleChoice identifier="ChoiceD">D</simpleChoice>
      <simpleChoice identifier="ChoiceE">E</simpleChoice>
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

export const CHOICE_UNICODE_EMOJI = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="choice-unicode-emoji"
  title="Choice with Unicode and Emoji"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>ChoiceB</value>
    </correctResponse>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0.0</value></defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue><value>1.0</value></defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>Which emoji best represents the concept of "celebration"? 🎉</p>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
      <prompt>Choisissez la meilleure réponse (Choose the best answer):</prompt>
      <simpleChoice identifier="ChoiceA">😢 Tristesse (Sadness)</simpleChoice>
      <simpleChoice identifier="ChoiceB">🎊 Célébration (Celebration)</simpleChoice>
      <simpleChoice identifier="ChoiceC">😴 Sommeil (Sleep)</simpleChoice>
      <simpleChoice identifier="ChoiceD">🌧️ Pluie (Rain)</simpleChoice>
      <simpleChoice identifier="ChoiceE">📚 Étude (Study)</simpleChoice>
      <simpleChoice identifier="ChoiceF">🚀 Espace (Space)</simpleChoice>
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

export const CHOICE_MULTIPLE_SELECT_MANY = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="choice-multiple-select-many"
  title="Multiple Choice - Select All Prime Numbers"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="identifier">
    <correctResponse>
      <value>ChoiceB</value>
      <value>ChoiceC</value>
      <value>ChoiceE</value>
      <value>ChoiceG</value>
      <value>ChoiceK</value>
    </correctResponse>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0.0</value></defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue><value>1.0</value></defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>Select ALL the prime numbers from the list below:</p>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="0">
      <prompt>Select all that apply:</prompt>
      <simpleChoice identifier="ChoiceA">1</simpleChoice>
      <simpleChoice identifier="ChoiceB">2</simpleChoice>
      <simpleChoice identifier="ChoiceC">3</simpleChoice>
      <simpleChoice identifier="ChoiceD">4</simpleChoice>
      <simpleChoice identifier="ChoiceE">5</simpleChoice>
      <simpleChoice identifier="ChoiceF">6</simpleChoice>
      <simpleChoice identifier="ChoiceG">7</simpleChoice>
      <simpleChoice identifier="ChoiceH">8</simpleChoice>
      <simpleChoice identifier="ChoiceI">9</simpleChoice>
      <simpleChoice identifier="ChoiceJ">10</simpleChoice>
      <simpleChoice identifier="ChoiceK">11</simpleChoice>
      <simpleChoice identifier="ChoiceL">12</simpleChoice>
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

// =============================================================================
// ORDER INTERACTION - Edge Cases
// =============================================================================

export const ORDER_LONG_LIST = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="order-long-list"
  title="Order 15 Items - Presidents"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="ordered" baseType="identifier">
    <correctResponse>
      <value>Washington</value>
      <value>Jefferson</value>
      <value>Madison</value>
      <value>Monroe</value>
      <value>Jackson</value>
      <value>Lincoln</value>
      <value>Grant</value>
      <value>Cleveland</value>
      <value>Roosevelt_T</value>
      <value>Wilson</value>
      <value>Roosevelt_F</value>
      <value>Truman</value>
      <value>Eisenhower</value>
      <value>Kennedy</value>
      <value>Johnson</value>
    </correctResponse>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0.0</value></defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue><value>1.0</value></defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>Arrange these 15 U.S. Presidents in chronological order from earliest to most recent:</p>
    <orderInteraction responseIdentifier="RESPONSE" shuffle="true">
      <prompt>Drag to reorder from earliest (top) to most recent (bottom):</prompt>
      <simpleChoice identifier="Washington">George Washington (1789-1797)</simpleChoice>
      <simpleChoice identifier="Jefferson">Thomas Jefferson (1801-1809)</simpleChoice>
      <simpleChoice identifier="Madison">James Madison (1809-1817)</simpleChoice>
      <simpleChoice identifier="Monroe">James Monroe (1817-1825)</simpleChoice>
      <simpleChoice identifier="Jackson">Andrew Jackson (1829-1837)</simpleChoice>
      <simpleChoice identifier="Lincoln">Abraham Lincoln (1861-1865)</simpleChoice>
      <simpleChoice identifier="Grant">Ulysses S. Grant (1869-1877)</simpleChoice>
      <simpleChoice identifier="Cleveland">Grover Cleveland (1885-1889, 1893-1897)</simpleChoice>
      <simpleChoice identifier="Roosevelt_T">Theodore Roosevelt (1901-1909)</simpleChoice>
      <simpleChoice identifier="Wilson">Woodrow Wilson (1913-1921)</simpleChoice>
      <simpleChoice identifier="Roosevelt_F">Franklin D. Roosevelt (1933-1945)</simpleChoice>
      <simpleChoice identifier="Truman">Harry S. Truman (1945-1953)</simpleChoice>
      <simpleChoice identifier="Eisenhower">Dwight D. Eisenhower (1953-1961)</simpleChoice>
      <simpleChoice identifier="Kennedy">John F. Kennedy (1961-1963)</simpleChoice>
      <simpleChoice identifier="Johnson">Lyndon B. Johnson (1963-1969)</simpleChoice>
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

export const ORDER_VERY_SHORT_TEXT = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="order-very-short"
  title="Order Single Letters"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="ordered" baseType="identifier">
    <correctResponse>
      <value>A</value>
      <value>B</value>
      <value>C</value>
      <value>D</value>
      <value>E</value>
      <value>F</value>
      <value>G</value>
      <value>H</value>
    </correctResponse>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0.0</value></defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue><value>1.0</value></defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>Arrange these letters in alphabetical order:</p>
    <orderInteraction responseIdentifier="RESPONSE" shuffle="true">
      <prompt>Drag to reorder:</prompt>
      <simpleChoice identifier="A">A</simpleChoice>
      <simpleChoice identifier="B">B</simpleChoice>
      <simpleChoice identifier="C">C</simpleChoice>
      <simpleChoice identifier="D">D</simpleChoice>
      <simpleChoice identifier="E">E</simpleChoice>
      <simpleChoice identifier="F">F</simpleChoice>
      <simpleChoice identifier="G">G</simpleChoice>
      <simpleChoice identifier="H">H</simpleChoice>
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

export const ORDER_UNICODE = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="order-unicode"
  title="Order Items with Unicode and Emoji"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="ordered" baseType="identifier">
    <correctResponse>
      <value>morning</value>
      <value>noon</value>
      <value>afternoon</value>
      <value>evening</value>
      <value>night</value>
    </correctResponse>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0.0</value></defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue><value>1.0</value></defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>Arrange these times of day in order from earliest to latest:</p>
    <orderInteraction responseIdentifier="RESPONSE" shuffle="true">
      <prompt>Drag to reorder:</prompt>
      <simpleChoice identifier="morning">🌅 Morning (Le matin)</simpleChoice>
      <simpleChoice identifier="noon">☀️ Noon (Midi)</simpleChoice>
      <simpleChoice identifier="afternoon">🌤️ Afternoon (L'après-midi)</simpleChoice>
      <simpleChoice identifier="evening">🌆 Evening (Le soir)</simpleChoice>
      <simpleChoice identifier="night">🌙 Night (La nuit)</simpleChoice>
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

// =============================================================================
// SLIDER INTERACTION - Edge Cases
// =============================================================================

export const SLIDER_NEGATIVE_RANGE = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="slider-negative-range"
  title="Slider with Negative Range"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="integer">
    <correctResponse>
      <value>-15</value>
    </correctResponse>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0.0</value></defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue><value>1.0</value></defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>Water freezes at 0°C. At what temperature (in Celsius) would you expect liquid water to remain liquid on a cold winter day in Antarctica?</p>
    <sliderInteraction responseIdentifier="RESPONSE" lowerBound="-50" upperBound="10" step="1">
      <prompt>Select a temperature (°C):</prompt>
    </sliderInteraction>
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

export const SLIDER_DECIMAL_STEPS = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="slider-decimal-steps"
  title="Slider with Decimal Steps"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="float">
    <correctResponse>
      <value>3.14</value>
    </correctResponse>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0.0</value></defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue><value>1.0</value></defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>What is the approximate value of π (pi) to two decimal places?</p>
    <sliderInteraction responseIdentifier="RESPONSE" lowerBound="0" upperBound="10" step="0.01">
      <prompt>Select the value:</prompt>
    </sliderInteraction>
  </itemBody>

  <responseProcessing>
    <responseCondition>
      <responseIf>
        <and>
          <gte>
            <variable identifier="RESPONSE"/>
            <baseValue baseType="float">3.13</baseValue>
          </gte>
          <lte>
            <variable identifier="RESPONSE"/>
            <baseValue baseType="float">3.15</baseValue>
          </lte>
        </and>
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

export const SLIDER_LARGE_RANGE = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="slider-large-range"
  title="Slider with Large Range"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="integer">
    <correctResponse>
      <value>384400</value>
    </correctResponse>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0.0</value></defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue><value>1.0</value></defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>What is the approximate distance from Earth to the Moon in kilometers?</p>
    <sliderInteraction responseIdentifier="RESPONSE" lowerBound="0" upperBound="500000" step="1000">
      <prompt>Select the distance (km):</prompt>
    </sliderInteraction>
  </itemBody>

  <responseProcessing>
    <responseCondition>
      <responseIf>
        <and>
          <gte>
            <variable identifier="RESPONSE"/>
            <baseValue baseType="integer">380000</baseValue>
          </gte>
          <lte>
            <variable identifier="RESPONSE"/>
            <baseValue baseType="integer">390000</baseValue>
          </lte>
        </and>
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

export const SLIDER_REVERSE_RANGE = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="slider-reverse-range"
  title="Slider with Reverse Range"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="integer">
    <correctResponse>
      <value>8</value>
    </correctResponse>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0.0</value></defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue><value>1.0</value></defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>On a pain scale where 10 is "worst pain imaginable" and 0 is "no pain", rate a mild headache:</p>
    <sliderInteraction responseIdentifier="RESPONSE" lowerBound="0" upperBound="10" step="1" reverse="true">
      <prompt>Select pain level (right = worst, left = none):</prompt>
    </sliderInteraction>
  </itemBody>

  <responseProcessing>
    <responseCondition>
      <responseIf>
        <and>
          <gte>
            <variable identifier="RESPONSE"/>
            <baseValue baseType="integer">6</baseValue>
          </gte>
          <lte>
            <variable identifier="RESPONSE"/>
            <baseValue baseType="integer">10</baseValue>
          </lte>
        </and>
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

// =============================================================================
// MATCH INTERACTION - Edge Cases
// =============================================================================

export const MATCH_ASYMMETRIC_LARGE = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="match-asymmetric-large"
  title="Match Interaction - Asymmetric Sets (3 sources, 10 targets)"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
    <correctResponse>
      <value>H2O Water</value>
      <value>CO2 CarbonDioxide</value>
      <value>O2 Oxygen</value>
    </correctResponse>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0.0</value></defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue><value>1.0</value></defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>Match each chemical formula to its common name:</p>
    <matchInteraction responseIdentifier="RESPONSE" shuffle="false" maxAssociations="3">
      <prompt>Drag from the left (formulas) to the right (names):</prompt>
      <simpleMatchSet>
        <simpleAssociableChoice identifier="H2O" matchMax="1">H₂O</simpleAssociableChoice>
        <simpleAssociableChoice identifier="CO2" matchMax="1">CO₂</simpleAssociableChoice>
        <simpleAssociableChoice identifier="O2" matchMax="1">O₂</simpleAssociableChoice>
      </simpleMatchSet>
      <simpleMatchSet>
        <simpleAssociableChoice identifier="Water" matchMax="1">Water</simpleAssociableChoice>
        <simpleAssociableChoice identifier="CarbonDioxide" matchMax="1">Carbon Dioxide</simpleAssociableChoice>
        <simpleAssociableChoice identifier="Oxygen" matchMax="1">Oxygen</simpleAssociableChoice>
        <simpleAssociableChoice identifier="Hydrogen" matchMax="1">Hydrogen</simpleAssociableChoice>
        <simpleAssociableChoice identifier="Nitrogen" matchMax="1">Nitrogen</simpleAssociableChoice>
        <simpleAssociableChoice identifier="Methane" matchMax="1">Methane</simpleAssociableChoice>
        <simpleAssociableChoice identifier="Ammonia" matchMax="1">Ammonia</simpleAssociableChoice>
        <simpleAssociableChoice identifier="SaltWater" matchMax="1">Salt Water</simpleAssociableChoice>
        <simpleAssociableChoice identifier="Ozone" matchMax="1">Ozone</simpleAssociableChoice>
        <simpleAssociableChoice identifier="HydrogenPeroxide" matchMax="1">Hydrogen Peroxide</simpleAssociableChoice>
      </simpleMatchSet>
    </matchInteraction>
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

export const MATCH_MANY_TO_MANY = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="match-many-to-many"
  title="Match Interaction - Many-to-Many (matchMax > 1)"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
    <correctResponse>
      <value>Mammal Dog</value>
      <value>Mammal Cat</value>
      <value>Mammal Whale</value>
      <value>Bird Eagle</value>
      <value>Bird Penguin</value>
      <value>Reptile Snake</value>
      <value>Reptile Lizard</value>
    </correctResponse>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0.0</value></defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue><value>1.0</value></defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>Match each animal to its correct classification. Each classification can have multiple animals:</p>
    <matchInteraction responseIdentifier="RESPONSE" shuffle="false" maxAssociations="10">
      <prompt>Drag animals to their classification:</prompt>
      <simpleMatchSet>
        <simpleAssociableChoice identifier="Mammal" matchMax="5">Mammals</simpleAssociableChoice>
        <simpleAssociableChoice identifier="Bird" matchMax="5">Birds</simpleAssociableChoice>
        <simpleAssociableChoice identifier="Reptile" matchMax="5">Reptiles</simpleAssociableChoice>
      </simpleMatchSet>
      <simpleMatchSet>
        <simpleAssociableChoice identifier="Dog" matchMax="1">Dog</simpleAssociableChoice>
        <simpleAssociableChoice identifier="Cat" matchMax="1">Cat</simpleAssociableChoice>
        <simpleAssociableChoice identifier="Eagle" matchMax="1">Eagle</simpleAssociableChoice>
        <simpleAssociableChoice identifier="Snake" matchMax="1">Snake</simpleAssociableChoice>
        <simpleAssociableChoice identifier="Whale" matchMax="1">Whale</simpleAssociableChoice>
        <simpleAssociableChoice identifier="Penguin" matchMax="1">Penguin</simpleAssociableChoice>
        <simpleAssociableChoice identifier="Lizard" matchMax="1">Lizard</simpleAssociableChoice>
      </simpleMatchSet>
    </matchInteraction>
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

export const MATCH_LARGE_SETS = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="match-large-sets"
  title="Match Interaction - Large Sets (10×10)"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
    <correctResponse>
      <value>France Paris</value>
      <value>Germany Berlin</value>
      <value>Italy Rome</value>
      <value>Spain Madrid</value>
      <value>UK London</value>
      <value>Japan Tokyo</value>
      <value>China Beijing</value>
      <value>India Delhi</value>
      <value>Russia Moscow</value>
      <value>Brazil Brasilia</value>
    </correctResponse>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0.0</value></defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue><value>1.0</value></defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>Match each country to its capital city:</p>
    <matchInteraction responseIdentifier="RESPONSE" shuffle="false" maxAssociations="10">
      <prompt>Drag countries to their capitals:</prompt>
      <simpleMatchSet>
        <simpleAssociableChoice identifier="France" matchMax="1">France</simpleAssociableChoice>
        <simpleAssociableChoice identifier="Germany" matchMax="1">Germany</simpleAssociableChoice>
        <simpleAssociableChoice identifier="Italy" matchMax="1">Italy</simpleAssociableChoice>
        <simpleAssociableChoice identifier="Spain" matchMax="1">Spain</simpleAssociableChoice>
        <simpleAssociableChoice identifier="UK" matchMax="1">United Kingdom</simpleAssociableChoice>
        <simpleAssociableChoice identifier="Japan" matchMax="1">Japan</simpleAssociableChoice>
        <simpleAssociableChoice identifier="China" matchMax="1">China</simpleAssociableChoice>
        <simpleAssociableChoice identifier="India" matchMax="1">India</simpleAssociableChoice>
        <simpleAssociableChoice identifier="Russia" matchMax="1">Russia</simpleAssociableChoice>
        <simpleAssociableChoice identifier="Brazil" matchMax="1">Brazil</simpleAssociableChoice>
      </simpleMatchSet>
      <simpleMatchSet>
        <simpleAssociableChoice identifier="Paris" matchMax="1">Paris</simpleAssociableChoice>
        <simpleAssociableChoice identifier="Berlin" matchMax="1">Berlin</simpleAssociableChoice>
        <simpleAssociableChoice identifier="Rome" matchMax="1">Rome</simpleAssociableChoice>
        <simpleAssociableChoice identifier="Madrid" matchMax="1">Madrid</simpleAssociableChoice>
        <simpleAssociableChoice identifier="London" matchMax="1">London</simpleAssociableChoice>
        <simpleAssociableChoice identifier="Tokyo" matchMax="1">Tokyo</simpleAssociableChoice>
        <simpleAssociableChoice identifier="Beijing" matchMax="1">Beijing</simpleAssociableChoice>
        <simpleAssociableChoice identifier="Delhi" matchMax="1">New Delhi</simpleAssociableChoice>
        <simpleAssociableChoice identifier="Moscow" matchMax="1">Moscow</simpleAssociableChoice>
        <simpleAssociableChoice identifier="Brasilia" matchMax="1">Brasília</simpleAssociableChoice>
      </simpleMatchSet>
    </matchInteraction>
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

// =============================================================================
// ASSOCIATE INTERACTION - Edge Cases
// =============================================================================

export const ASSOCIATE_LARGE_GROUP = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="associate-large-group"
  title="Associate Interaction - Large Group (10 items)"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="pair">
    <correctResponse>
      <value>A B</value>
      <value>A C</value>
      <value>B C</value>
      <value>D E</value>
      <value>D F</value>
      <value>E F</value>
      <value>G H</value>
      <value>I J</value>
    </correctResponse>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0.0</value></defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue><value>1.0</value></defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>Create pairs of synonyms by connecting related words:</p>
    <associateInteraction responseIdentifier="RESPONSE" shuffle="false" maxAssociations="10" minAssociations="1">
      <prompt>Click two words to create a pair of synonyms:</prompt>
      <simpleAssociableChoice identifier="A" matchMax="2">Happy</simpleAssociableChoice>
      <simpleAssociableChoice identifier="B" matchMax="2">Joyful</simpleAssociableChoice>
      <simpleAssociableChoice identifier="C" matchMax="2">Cheerful</simpleAssociableChoice>
      <simpleAssociableChoice identifier="D" matchMax="2">Sad</simpleAssociableChoice>
      <simpleAssociableChoice identifier="E" matchMax="2">Unhappy</simpleAssociableChoice>
      <simpleAssociableChoice identifier="F" matchMax="2">Melancholy</simpleAssociableChoice>
      <simpleAssociableChoice identifier="G" matchMax="2">Fast</simpleAssociableChoice>
      <simpleAssociableChoice identifier="H" matchMax="2">Quick</simpleAssociableChoice>
      <simpleAssociableChoice identifier="I" matchMax="2">Large</simpleAssociableChoice>
      <simpleAssociableChoice identifier="J" matchMax="2">Big</simpleAssociableChoice>
    </associateInteraction>
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

export const ASSOCIATE_COMPLEX_CARDINALITY = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="associate-complex-cardinality"
  title="Associate Interaction - Complex Cardinality (min=2, max=4)"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="pair">
    <correctResponse>
      <value>Red Apple</value>
      <value>Red Strawberry</value>
      <value>Red Tomato</value>
      <value>Yellow Banana</value>
      <value>Yellow Lemon</value>
    </correctResponse>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0.0</value></defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue><value>1.0</value></defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>Group fruits and vegetables by their typical color. Each color can have 2-4 items:</p>
    <associateInteraction responseIdentifier="RESPONSE" shuffle="false" maxAssociations="10" minAssociations="2">
      <prompt>Click pairs to group by color:</prompt>
      <simpleAssociableChoice identifier="Red" matchMin="2" matchMax="4">Red</simpleAssociableChoice>
      <simpleAssociableChoice identifier="Yellow" matchMin="2" matchMax="4">Yellow</simpleAssociableChoice>
      <simpleAssociableChoice identifier="Apple" matchMax="1">Apple</simpleAssociableChoice>
      <simpleAssociableChoice identifier="Banana" matchMax="1">Banana</simpleAssociableChoice>
      <simpleAssociableChoice identifier="Strawberry" matchMax="1">Strawberry</simpleAssociableChoice>
      <simpleAssociableChoice identifier="Lemon" matchMax="1">Lemon</simpleAssociableChoice>
      <simpleAssociableChoice identifier="Tomato" matchMax="1">Tomato</simpleAssociableChoice>
    </associateInteraction>
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

// =============================================================================
// GAP MATCH INTERACTION - Edge Cases
// =============================================================================

export const GAP_MATCH_MANY_GAPS = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="gap-match-many-gaps"
  title="Gap Match - 12 Gaps (Volume Test)"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
    <correctResponse>
      <value>noun gap1</value>
      <value>verb gap2</value>
      <value>adjective gap3</value>
      <value>noun gap4</value>
      <value>verb gap5</value>
      <value>adjective gap6</value>
      <value>noun gap7</value>
      <value>verb gap8</value>
      <value>adjective gap9</value>
      <value>noun gap10</value>
      <value>verb gap11</value>
      <value>adjective gap12</value>
    </correctResponse>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0.0</value></defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue><value>1.0</value></defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>Fill in the blanks with the correct part of speech. Drag words to complete the sentence:</p>
    <gapMatchInteraction responseIdentifier="RESPONSE" shuffle="false">
      <gapText identifier="noun" matchMax="0">NOUN</gapText>
      <gapText identifier="verb" matchMax="0">VERB</gapText>
      <gapText identifier="adjective" matchMax="0">ADJECTIVE</gapText>

      <blockquote>
        <p>The <gap identifier="gap1"/> <gap identifier="gap2"/> over the <gap identifier="gap3"/> moon.
        A <gap identifier="gap4"/> <gap identifier="gap5"/> <gap identifier="gap6"/> stars.
        Every <gap identifier="gap7"/> <gap identifier="gap8"/> <gap identifier="gap9"/> dreams.
        The <gap identifier="gap10"/> <gap identifier="gap11"/> <gap identifier="gap12"/> hope.</p>
      </blockquote>
    </gapMatchInteraction>
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

export const GAP_MATCH_REUSABLE_GAPS = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="gap-match-reusable"
  title="Gap Match - Reusable Gaps (matchMax=0)"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
    <correctResponse>
      <value>hydrogen gap1</value>
      <value>oxygen gap2</value>
      <value>hydrogen gap3</value>
      <value>hydrogen gap4</value>
      <value>oxygen gap5</value>
      <value>hydrogen gap6</value>
    </correctResponse>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0.0</value></defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue><value>1.0</value></defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>Complete the descriptions of water molecules using H (hydrogen) and O (oxygen). Each element can be used multiple times. Drag elements to complete the formulas:</p>
    <gapMatchInteraction responseIdentifier="RESPONSE" shuffle="false">
      <gapText identifier="hydrogen" matchMax="0">H</gapText>
      <gapText identifier="oxygen" matchMax="0">O</gapText>

      <blockquote>
        <p>Water (H₂O): <gap identifier="gap1"/> <gap identifier="gap2"/> <gap identifier="gap3"/></p>
        <p>Hydrogen peroxide (H₂O₂): <gap identifier="gap4"/> <gap identifier="gap5"/> <gap identifier="gap6"/> O</p>
      </blockquote>
    </gapMatchInteraction>
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

// =============================================================================
// EXTENDED TEXT INTERACTION - Edge Cases
// =============================================================================

export const EXTENDED_TEXT_VERY_LONG = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="extended-text-very-long"
  title="Extended Text - Very Long Expected Length"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string">
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0.0</value></defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue><value>1.0</value></defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>Write a comprehensive essay (minimum 3000 words) analyzing the causes and effects of climate change, including scientific evidence, economic impacts, and potential solutions. Your essay should include an introduction, multiple body paragraphs with evidence, and a conclusion.</p>
    <extendedTextInteraction responseIdentifier="RESPONSE" expectedLength="5000" expectedLines="100">
      <prompt>Write your essay here:</prompt>
    </extendedTextInteraction>
  </itemBody>

  <responseProcessing>
    <responseCondition>
      <responseIf>
        <not>
          <isNull>
            <variable identifier="RESPONSE"/>
          </isNull>
        </not>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">1.0</baseValue>
        </setOutcomeValue>
      </responseIf>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

// =============================================================================
// CHOICE INTERACTION - Additional Edge Case
// =============================================================================

export const CHOICE_MATH_HEAVY = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  xmlns:m="http://www.w3.org/1998/Math/MathML"
  identifier="choice-math-heavy"
  title="Choice - Math Heavy (Multiple Equations)"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>ChoiceC</value>
    </correctResponse>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0.0</value></defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue><value>1.0</value></defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>Which equation correctly represents the quadratic formula?</p>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
      <prompt>Select the correct formula:</prompt>
      <simpleChoice identifier="ChoiceA">
        <m:math display="inline">
          <m:mrow>
            <m:mi>x</m:mi>
            <m:mo>=</m:mo>
            <m:mfrac>
              <m:mrow>
                <m:mo>-</m:mo>
                <m:mi>b</m:mi>
                <m:mo>+</m:mo>
                <m:msqrt>
                  <m:mrow>
                    <m:msup><m:mi>b</m:mi><m:mn>2</m:mn></m:msup>
                    <m:mo>-</m:mo>
                    <m:mn>4</m:mn>
                    <m:mi>a</m:mi>
                    <m:mi>c</m:mi>
                  </m:mrow>
                </m:msqrt>
              </m:mrow>
              <m:mrow>
                <m:mn>2</m:mn>
                <m:mi>a</m:mi>
              </m:mrow>
            </m:mfrac>
          </m:mrow>
        </m:math>
      </simpleChoice>
      <simpleChoice identifier="ChoiceB">
        <m:math display="inline">
          <m:mrow>
            <m:mi>x</m:mi>
            <m:mo>=</m:mo>
            <m:mfrac>
              <m:mrow>
                <m:mi>b</m:mi>
                <m:mo>±</m:mo>
                <m:msqrt>
                  <m:mrow>
                    <m:msup><m:mi>b</m:mi><m:mn>2</m:mn></m:msup>
                    <m:mo>+</m:mo>
                    <m:mn>4</m:mn>
                    <m:mi>a</m:mi>
                    <m:mi>c</m:mi>
                  </m:mrow>
                </m:msqrt>
              </m:mrow>
              <m:mrow>
                <m:mn>2</m:mn>
                <m:mi>a</m:mi>
              </m:mrow>
            </m:mfrac>
          </m:mrow>
        </m:math>
      </simpleChoice>
      <simpleChoice identifier="ChoiceC">
        <m:math display="inline">
          <m:mrow>
            <m:mi>x</m:mi>
            <m:mo>=</m:mo>
            <m:mfrac>
              <m:mrow>
                <m:mo>-</m:mo>
                <m:mi>b</m:mi>
                <m:mo>±</m:mo>
                <m:msqrt>
                  <m:mrow>
                    <m:msup><m:mi>b</m:mi><m:mn>2</m:mn></m:msup>
                    <m:mo>-</m:mo>
                    <m:mn>4</m:mn>
                    <m:mi>a</m:mi>
                    <m:mi>c</m:mi>
                  </m:mrow>
                </m:msqrt>
              </m:mrow>
              <m:mrow>
                <m:mn>2</m:mn>
                <m:mi>a</m:mi>
              </m:mrow>
            </m:mfrac>
          </m:mrow>
        </m:math>
      </simpleChoice>
      <simpleChoice identifier="ChoiceD">
        <m:math display="inline">
          <m:mrow>
            <m:mi>x</m:mi>
            <m:mo>=</m:mo>
            <m:mfrac>
              <m:mrow>
                <m:mo>-</m:mo>
                <m:mi>b</m:mi>
                <m:mo>±</m:mo>
                <m:msqrt>
                  <m:mrow>
                    <m:msup><m:mi>b</m:mi><m:mn>2</m:mn></m:msup>
                    <m:mo>-</m:mo>
                    <m:mn>4</m:mn>
                    <m:mi>a</m:mi>
                    <m:mi>c</m:mi>
                  </m:mrow>
                </m:msqrt>
              </m:mrow>
              <m:mi>a</m:mi>
            </m:mfrac>
          </m:mrow>
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

// =============================================================================
// ORDER INTERACTION - Additional Edge Cases
// =============================================================================

export const ORDER_VERY_LONG_TEXT = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="order-very-long-text"
  title="Order - Very Long Text Per Item"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="ordered" baseType="identifier">
    <correctResponse>
      <value>First</value>
      <value>Second</value>
      <value>Third</value>
      <value>Fourth</value>
      <value>Fifth</value>
    </correctResponse>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0.0</value></defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue><value>1.0</value></defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>Order these historical events chronologically from earliest to most recent:</p>
    <orderInteraction responseIdentifier="RESPONSE" shuffle="true">
      <prompt>Drag to reorder:</prompt>
      <simpleChoice identifier="First">The signing of the Magna Carta in 1215, which established the principle that everyone, including the king, was subject to the law and laid the foundation for constitutional governance in England.</simpleChoice>
      <simpleChoice identifier="Second">The invention of the printing press by Johannes Gutenberg around 1440, which revolutionized the production of books and the dissemination of knowledge throughout Europe and beyond.</simpleChoice>
      <simpleChoice identifier="Third">The American Declaration of Independence in 1776, which proclaimed the thirteen American colonies as independent states and established fundamental principles of individual liberty and self-governance.</simpleChoice>
      <simpleChoice identifier="Fourth">The French Revolution beginning in 1789, which overthrew the monarchy, established republican government, and spread revolutionary ideals of liberty, equality, and fraternity throughout Europe.</simpleChoice>
      <simpleChoice identifier="Fifth">The first successful powered flight by the Wright Brothers in 1903 at Kitty Hawk, North Carolina, which marked the beginning of the aviation age and transformed human transportation forever.</simpleChoice>
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

// =============================================================================
// Sample Items Export Array
// =============================================================================

export interface SampleItem {
  id: string;
  title: string;
  description: string;
  xml: string;
  edgeCase?: boolean;
  testCategory?: string;
}

export const EDGE_CASE_ITEMS: SampleItem[] = [
  // Choice Interaction Edge Cases
  {
    id: 'choice-many-options',
    title: 'Choice - 15 Options (Volume Test)',
    description: 'Tests UI with many choices - validates scrolling, selection visibility',
    xml: CHOICE_MANY_OPTIONS,
    edgeCase: true,
    testCategory: 'extreme-volume',
  },
  {
    id: 'choice-very-long-text',
    title: 'Choice - Very Long Option Text (Content Test)',
    description: 'Tests UI with 100+ character option text - validates wrapping, readability',
    xml: CHOICE_VERY_LONG_TEXT,
    edgeCase: true,
    testCategory: 'extreme-content',
  },
  {
    id: 'choice-very-short-text',
    title: 'Choice - Single Letter Options (Content Test)',
    description: 'Tests UI with minimal text - validates hit targets, spacing',
    xml: CHOICE_VERY_SHORT_TEXT,
    edgeCase: true,
    testCategory: 'extreme-content',
  },
  {
    id: 'choice-unicode-emoji',
    title: 'Choice - Unicode and Emoji (Content Test)',
    description: 'Tests UI with international characters and emoji - validates rendering',
    xml: CHOICE_UNICODE_EMOJI,
    edgeCase: true,
    testCategory: 'extreme-content',
  },
  {
    id: 'choice-multiple-select-many',
    title: 'Choice - Multiple Select with 12 Options (Constraint Test)',
    description: 'Tests multi-select with many options - validates checkbox interactions',
    xml: CHOICE_MULTIPLE_SELECT_MANY,
    edgeCase: true,
    testCategory: 'constraint-extremes',
  },

  // Order Interaction Edge Cases
  {
    id: 'order-long-list',
    title: 'Order - 15 Items (Volume Test)',
    description: 'Tests ordering UI with many items - validates drag-drop performance, scrolling',
    xml: ORDER_LONG_LIST,
    edgeCase: true,
    testCategory: 'extreme-volume',
  },
  {
    id: 'order-very-short',
    title: 'Order - Single Letters (Content Test)',
    description: 'Tests ordering UI with minimal text - validates drag handles, hit targets',
    xml: ORDER_VERY_SHORT_TEXT,
    edgeCase: true,
    testCategory: 'extreme-content',
  },
  {
    id: 'order-unicode',
    title: 'Order - Unicode and Emoji (Content Test)',
    description: 'Tests ordering UI with international characters - validates rendering',
    xml: ORDER_UNICODE,
    edgeCase: true,
    testCategory: 'extreme-content',
  },

  // Slider Interaction Edge Cases
  {
    id: 'slider-negative-range',
    title: 'Slider - Negative Range (Constraint Test)',
    description: 'Tests slider with negative values - validates label display, value tracking',
    xml: SLIDER_NEGATIVE_RANGE,
    edgeCase: true,
    testCategory: 'constraint-extremes',
  },
  {
    id: 'slider-decimal-steps',
    title: 'Slider - Decimal Steps (Precision Test)',
    description: 'Tests slider with 0.01 step increments - validates precision, display',
    xml: SLIDER_DECIMAL_STEPS,
    edgeCase: true,
    testCategory: 'constraint-extremes',
  },
  {
    id: 'slider-large-range',
    title: 'Slider - Large Range (Scale Test)',
    description: 'Tests slider with 0-500,000 range - validates usability, precision',
    xml: SLIDER_LARGE_RANGE,
    edgeCase: true,
    testCategory: 'constraint-extremes',
  },
  {
    id: 'slider-reverse-range',
    title: 'Slider - Reverse Range (Layout Test)',
    description: 'Tests slider with reverse attribute - validates RTL-like behavior',
    xml: SLIDER_REVERSE_RANGE,
    edgeCase: true,
    testCategory: 'constraint-extremes',
  },

  // Match Interaction Edge Cases
  {
    id: 'match-asymmetric-large',
    title: 'Match - Asymmetric Sets (Volume Test)',
    description: 'Tests match UI with 3 sources and 10 targets - validates scrolling, layout',
    xml: MATCH_ASYMMETRIC_LARGE,
    edgeCase: true,
    testCategory: 'extreme-volume',
  },
  {
    id: 'match-many-to-many',
    title: 'Match - Many-to-Many (Constraint Test)',
    description: 'Tests match with matchMax>1 - validates multiple associations per item',
    xml: MATCH_MANY_TO_MANY,
    edgeCase: true,
    testCategory: 'constraint-extremes',
  },
  {
    id: 'match-large-sets',
    title: 'Match - Large Sets (Volume Test)',
    description: 'Tests match with 10×10 sets - validates scrolling, performance',
    xml: MATCH_LARGE_SETS,
    edgeCase: true,
    testCategory: 'extreme-volume',
  },

  // Associate Interaction Edge Cases
  {
    id: 'associate-large-group',
    title: 'Associate - Large Group (Volume Test)',
    description: 'Tests associate with 10 items - validates pair creation, visual clarity',
    xml: ASSOCIATE_LARGE_GROUP,
    edgeCase: true,
    testCategory: 'extreme-volume',
  },
  {
    id: 'associate-complex-cardinality',
    title: 'Associate - Complex Cardinality (Constraint Test)',
    description: 'Tests associate with min=2, max=4 constraints - validates cardinality enforcement',
    xml: ASSOCIATE_COMPLEX_CARDINALITY,
    edgeCase: true,
    testCategory: 'constraint-extremes',
  },

  // Gap Match Interaction Edge Cases
  {
    id: 'gap-match-many-gaps',
    title: 'GapMatch - 12 Gaps (Volume Test)',
    description: 'Tests gap match with many gaps - validates inline layout, drag-drop',
    xml: GAP_MATCH_MANY_GAPS,
    edgeCase: true,
    testCategory: 'extreme-volume',
  },
  {
    id: 'gap-match-reusable',
    title: 'GapMatch - Reusable Gaps (Constraint Test)',
    description: 'Tests gap match with matchMax=0 (reusable) - validates multi-use drag items',
    xml: GAP_MATCH_REUSABLE_GAPS,
    edgeCase: true,
    testCategory: 'constraint-extremes',
  },

  // Extended Text Interaction Edge Cases
  {
    id: 'extended-text-very-long',
    title: 'ExtendedText - Very Long Expected Length (Content Test)',
    description: 'Tests extended text with 5000 char expected length - validates textarea sizing, scrolling',
    xml: EXTENDED_TEXT_VERY_LONG,
    edgeCase: true,
    testCategory: 'extreme-content',
  },

  // Choice Interaction - Additional
  {
    id: 'choice-math-heavy',
    title: 'Choice - Math Heavy with MathML (Content Test)',
    description: 'Tests choice with complex MathML equations - validates math rendering in options',
    xml: CHOICE_MATH_HEAVY,
    edgeCase: true,
    testCategory: 'extreme-content',
  },

  // Order Interaction - Additional
  {
    id: 'order-very-long-text',
    title: 'Order - Very Long Text Per Item (Content Test)',
    description: 'Tests order with 100+ char per item - validates text wrapping, drag handles',
    xml: ORDER_VERY_LONG_TEXT,
    edgeCase: true,
    testCategory: 'extreme-content',
  },
];
