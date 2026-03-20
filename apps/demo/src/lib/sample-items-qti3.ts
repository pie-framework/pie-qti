/**
 * Sample QTI 3.0 items for testing the player
 *
 * These items are QTI 3.0 versions of common QTI 2.x patterns, demonstrating:
 * - QTI 3.0 element naming (kebab-case with qti- prefix)
 * - QTI 3.0 attribute naming (kebab-case for multi-word attributes)
 * - Backward compatibility validation
 *
 * Structure mirrors sample-items.ts for easy comparison.
 */

export interface Qti3SampleItem {
	id: string;
	title: string;
	category: 'core' | 'visual' | 'advanced';
	xml: string;
	description?: string;
}

// ============================================================================
// CORE INTERACTIONS - Essential interaction types
// ============================================================================

export const QTI3_SIMPLE_CHOICE = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item
  xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
  identifier="qti3-simple-choice"
  title="Simple Multiple Choice (QTI 3.0)"
  adaptive="false"
  time-dependent="false">

  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response>
      <qti-value>ChoiceA</qti-value>
    </qti-correct-response>
  </qti-response-declaration>

  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
    <qti-default-value>
      <qti-value>0.0</qti-value>
    </qti-default-value>
  </qti-outcome-declaration>

  <qti-outcome-declaration identifier="MAXSCORE" cardinality="single" base-type="float">
    <qti-default-value>
      <qti-value>1.0</qti-value>
    </qti-default-value>
  </qti-outcome-declaration>

  <qti-item-body>
    <p>If Maya has 12 cookies and gives 5 to her friend, how many cookies does she have left?</p>
    <qti-choice-interaction response-identifier="RESPONSE" shuffle="false" max-choices="1">
      <qti-prompt>Select the correct answer:</qti-prompt>
      <qti-simple-choice identifier="ChoiceA">7</qti-simple-choice>
      <qti-simple-choice identifier="ChoiceB">17</qti-simple-choice>
      <qti-simple-choice identifier="ChoiceC">5</qti-simple-choice>
      <qti-simple-choice identifier="ChoiceD">8</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>

  <qti-response-processing>
    <qti-response-condition>
      <qti-response-if>
        <qti-match>
          <qti-variable identifier="RESPONSE"/>
          <qti-correct identifier="RESPONSE"/>
        </qti-match>
        <qti-set-outcome-value identifier="SCORE">
          <qti-base-value base-type="float">1.0</qti-base-value>
        </qti-set-outcome-value>
      </qti-response-if>
      <qti-response-else>
        <qti-set-outcome-value identifier="SCORE">
          <qti-base-value base-type="float">0.0</qti-base-value>
        </qti-set-outcome-value>
      </qti-response-else>
    </qti-response-condition>
  </qti-response-processing>
</qti-assessment-item>`;

export const QTI3_MULTIPLE_CHOICE = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item
  xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
  identifier="qti3-multiple-choice"
  title="Multiple Selection (QTI 3.0)"
  adaptive="false"
  time-dependent="false">

  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="identifier">
    <qti-correct-response>
      <qti-value>oxygen</qti-value>
      <qti-value>nitrogen</qti-value>
    </qti-correct-response>
  </qti-response-declaration>

  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
    <qti-default-value>
      <qti-value>0.0</qti-value>
    </qti-default-value>
  </qti-outcome-declaration>

  <qti-outcome-declaration identifier="MAXSCORE" cardinality="single" base-type="float">
    <qti-default-value>
      <qti-value>1.0</qti-value>
    </qti-default-value>
  </qti-outcome-declaration>

  <qti-item-body>
    <p>Which of the following gases make up the majority of Earth's atmosphere?</p>
    <qti-choice-interaction response-identifier="RESPONSE" shuffle="false" max-choices="0">
      <qti-prompt>Select all that apply:</qti-prompt>
      <qti-simple-choice identifier="oxygen">Oxygen</qti-simple-choice>
      <qti-simple-choice identifier="nitrogen">Nitrogen</qti-simple-choice>
      <qti-simple-choice identifier="carbon-dioxide">Carbon Dioxide</qti-simple-choice>
      <qti-simple-choice identifier="helium">Helium</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>

  <qti-response-processing>
    <qti-response-condition>
      <qti-response-if>
        <qti-match>
          <qti-variable identifier="RESPONSE"/>
          <qti-correct identifier="RESPONSE"/>
        </qti-match>
        <qti-set-outcome-value identifier="SCORE">
          <qti-base-value base-type="float">1.0</qti-base-value>
        </qti-set-outcome-value>
      </qti-response-if>
      <qti-response-else>
        <qti-set-outcome-value identifier="SCORE">
          <qti-base-value base-type="float">0.0</qti-base-value>
        </qti-set-outcome-value>
      </qti-response-else>
    </qti-response-condition>
  </qti-response-processing>
</qti-assessment-item>`;

export const QTI3_TEXT_ENTRY = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item
  xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
  identifier="qti3-text-entry"
  title="Text Entry (QTI 3.0)"
  adaptive="false"
  time-dependent="false">

  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string">
    <qti-correct-response>
      <qti-value>Paris</qti-value>
    </qti-correct-response>
  </qti-response-declaration>

  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
    <qti-default-value>
      <qti-value>0.0</qti-value>
    </qti-default-value>
  </qti-outcome-declaration>

  <qti-outcome-declaration identifier="MAXSCORE" cardinality="single" base-type="float">
    <qti-default-value>
      <qti-value>1.0</qti-value>
    </qti-default-value>
  </qti-outcome-declaration>

  <qti-item-body>
    <p>What is the capital of France? <qti-text-entry-interaction response-identifier="RESPONSE" expected-length="15"/></p>
  </qti-item-body>

  <qti-response-processing>
    <qti-response-condition>
      <qti-response-if>
        <qti-match>
          <qti-variable identifier="RESPONSE"/>
          <qti-correct identifier="RESPONSE"/>
        </qti-match>
        <qti-set-outcome-value identifier="SCORE">
          <qti-base-value base-type="float">1.0</qti-base-value>
        </qti-set-outcome-value>
      </qti-response-if>
      <qti-response-else>
        <qti-set-outcome-value identifier="SCORE">
          <qti-base-value base-type="float">0.0</qti-base-value>
        </qti-set-outcome-value>
      </qti-response-else>
    </qti-response-condition>
  </qti-response-processing>
</qti-assessment-item>`;

export const QTI3_EXTENDED_TEXT = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item
  xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
  identifier="qti3-extended-text"
  title="Extended Text (QTI 3.0)"
  adaptive="false"
  time-dependent="false">

  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>

  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
    <qti-default-value>
      <qti-value>0.0</qti-value>
    </qti-default-value>
  </qti-outcome-declaration>

  <qti-item-body>
    <p>Describe the water cycle in your own words. Include at least three stages of the cycle.</p>
    <qti-extended-text-interaction
      response-identifier="RESPONSE"
      expected-lines="5"
      expected-length="500"
      placeholder-text="Type your answer here..."/>
  </qti-item-body>

  <qti-response-processing>
    <qti-response-condition>
      <qti-response-if>
        <qti-not>
          <qti-is-null>
            <qti-variable identifier="RESPONSE"/>
          </qti-is-null>
        </qti-not>
        <qti-set-outcome-value identifier="SCORE">
          <qti-base-value base-type="float">1.0</qti-base-value>
        </qti-set-outcome-value>
      </qti-response-if>
    </qti-response-condition>
  </qti-response-processing>
</qti-assessment-item>`;

export const QTI3_MATCH = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item
  xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
  identifier="qti3-match"
  title="Match Interaction (QTI 3.0)"
  adaptive="false"
  time-dependent="false">

  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair">
    <qti-correct-response>
      <qti-value>france paris</qti-value>
      <qti-value>germany berlin</qti-value>
      <qti-value>spain madrid</qti-value>
    </qti-correct-response>
  </qti-response-declaration>

  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
    <qti-default-value>
      <qti-value>0.0</qti-value>
    </qti-default-value>
  </qti-outcome-declaration>

  <qti-outcome-declaration identifier="MAXSCORE" cardinality="single" base-type="float">
    <qti-default-value>
      <qti-value>3.0</qti-value>
    </qti-default-value>
  </qti-outcome-declaration>

  <qti-item-body>
    <p>Match each country with its capital city:</p>
    <qti-match-interaction response-identifier="RESPONSE" shuffle="false" max-associations="3">
      <qti-prompt>Drag each capital to its country:</qti-prompt>
      <qti-simple-match-set>
        <qti-simple-associable-choice identifier="france" match-max="1">France</qti-simple-associable-choice>
        <qti-simple-associable-choice identifier="germany" match-max="1">Germany</qti-simple-associable-choice>
        <qti-simple-associable-choice identifier="spain" match-max="1">Spain</qti-simple-associable-choice>
      </qti-simple-match-set>
      <qti-simple-match-set>
        <qti-simple-associable-choice identifier="paris" match-max="1">Paris</qti-simple-associable-choice>
        <qti-simple-associable-choice identifier="berlin" match-max="1">Berlin</qti-simple-associable-choice>
        <qti-simple-associable-choice identifier="madrid" match-max="1">Madrid</qti-simple-associable-choice>
      </qti-simple-match-set>
    </qti-match-interaction>
  </qti-item-body>

  <qti-response-processing>
    <qti-response-condition>
      <qti-response-if>
        <qti-match>
          <qti-variable identifier="RESPONSE"/>
          <qti-correct identifier="RESPONSE"/>
        </qti-match>
        <qti-set-outcome-value identifier="SCORE">
          <qti-base-value base-type="float">3.0</qti-base-value>
        </qti-set-outcome-value>
      </qti-response-if>
      <qti-response-else>
        <qti-set-outcome-value identifier="SCORE">
          <qti-base-value base-type="float">0.0</qti-base-value>
        </qti-set-outcome-value>
      </qti-response-else>
    </qti-response-condition>
  </qti-response-processing>
</qti-assessment-item>`;

// ============================================================================
// SAMPLE ITEMS ARRAY
// ============================================================================

export const QTI3_SAMPLE_ITEMS: Qti3SampleItem[] = [
	{
		id: 'qti3-choice-simple',
		title: 'Simple Choice (QTI 3.0)',
		category: 'core',
		description: 'Basic single-selection multiple choice with QTI 3.0 syntax',
		xml: QTI3_SIMPLE_CHOICE,
	},
	{
		id: 'qti3-choice-multiple',
		title: 'Multiple Selection (QTI 3.0)',
		category: 'core',
		description: 'Multiple selection with QTI 3.0 syntax',
		xml: QTI3_MULTIPLE_CHOICE,
	},
	{
		id: 'qti3-text-entry',
		title: 'Text Entry (QTI 3.0)',
		category: 'core',
		description: 'Fill-in-the-blank text entry with QTI 3.0 syntax',
		xml: QTI3_TEXT_ENTRY,
	},
	{
		id: 'qti3-extended-text',
		title: 'Extended Text (QTI 3.0)',
		category: 'core',
		description: 'Essay response with QTI 3.0 syntax',
		xml: QTI3_EXTENDED_TEXT,
	},
	{
		id: 'qti3-match',
		title: 'Match Interaction (QTI 3.0)',
		category: 'core',
		description: 'Match countries with capitals using QTI 3.0 syntax',
		xml: QTI3_MATCH,
	},
];

/**
 * Get QTI 3.0 sample by ID
 */
export function getQti3Sample(id: string): Qti3SampleItem | undefined {
	return QTI3_SAMPLE_ITEMS.find((item) => item.id === id);
}

/**
 * Get QTI 3.0 samples by category
 */
export function getQti3SamplesByCategory(category: string): Qti3SampleItem[] {
	return QTI3_SAMPLE_ITEMS.filter((item) => item.category === category);
}

/**
 * Get all QTI 3.0 categories
 */
export function getQti3Categories(): Array<{ key: string; label: string }> {
	return [
		{ key: 'core', label: 'Core Interactions' },
		{ key: 'visual', label: 'Visual Interactions' },
		{ key: 'advanced', label: 'Advanced Features (QTI 3.0)' },
	];
}
