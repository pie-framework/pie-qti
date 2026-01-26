/**
 * Sample Likert Scale QTI Items
 *
 * These items demonstrate the ACME Likert Scale Plugin with various scale types.
 */

export const LIKERT_5_POINT_AGREEMENT = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                identifier="likert-5pt-agreement"
                title="5-Point Agreement Scale">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>agree</value>
    </correctResponse>
  </responseDeclaration>

  <itemBody>
    <h2>Learning Confidence Assessment</h2>
    <p>Please indicate your level of agreement with the following statement:</p>
    <blockquote style="font-style: italic; margin: 1rem 0; padding: 1rem; background: #f5f5f5; border-left: 4px solid #0066cc;">
      "I feel confident in my understanding of QTI 2.2 assessment items."
    </blockquote>

    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <prompt>Rate your agreement:</prompt>
      <likertChoice identifier="strongly_disagree">Strongly Disagree</likertChoice>
      <likertChoice identifier="disagree">Disagree</likertChoice>
      <likertChoice identifier="neutral">Neutral</likertChoice>
      <likertChoice identifier="agree">Agree</likertChoice>
      <likertChoice identifier="strongly_agree">Strongly Agree</likertChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;

export const LIKERT_5_POINT_FREQUENCY = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                identifier="likert-5pt-frequency"
                title="5-Point Frequency Scale">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>

  <itemBody>
    <h2>Study Habits Survey</h2>
    <p>Think about your typical week of studying. How often do you:</p>
    <blockquote style="font-style: italic; margin: 1rem 0; padding: 1rem; background: #f5f5f5; border-left: 4px solid #00aa66;">
      Review your notes within 24 hours of class?
    </blockquote>

    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <prompt>Select the frequency that best describes you:</prompt>
      <likertChoice identifier="never">Never</likertChoice>
      <likertChoice identifier="rarely">Rarely</likertChoice>
      <likertChoice identifier="sometimes">Sometimes</likertChoice>
      <likertChoice identifier="often">Often</likertChoice>
      <likertChoice identifier="always">Always</likertChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;

export const LIKERT_4_POINT_SATISFACTION = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                identifier="likert-4pt-satisfaction"
                title="4-Point Satisfaction Scale">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>

  <itemBody>
    <h2>Course Feedback</h2>
    <p>We value your feedback! Please rate your satisfaction with:</p>
    <blockquote style="font-style: italic; margin: 1rem 0; padding: 1rem; background: #f5f5f5; border-left: 4px solid #ff8800;">
      The quality of interactive assessments in this course
    </blockquote>

    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <prompt>How satisfied are you?</prompt>
      <likertChoice identifier="very_dissatisfied">Very Dissatisfied</likertChoice>
      <likertChoice identifier="dissatisfied">Dissatisfied</likertChoice>
      <likertChoice identifier="satisfied">Satisfied</likertChoice>
      <likertChoice identifier="very_satisfied">Very Satisfied</likertChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;

export const LIKERT_4_POINT_QUALITY = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                identifier="likert-4pt-quality"
                title="4-Point Quality Scale">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>excellent</value>
    </correctResponse>
  </responseDeclaration>

  <itemBody>
    <h2>Content Quality Rating</h2>
    <p>Rate the quality of the following:</p>
    <blockquote style="font-style: italic; margin: 1rem 0; padding: 1rem; background: #f5f5f5; border-left: 4px solid #9933cc;">
      The clarity and completeness of the plugin documentation
    </blockquote>

    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <prompt>Quality rating:</prompt>
      <likertChoice identifier="poor">Poor</likertChoice>
      <likertChoice identifier="fair">Fair</likertChoice>
      <likertChoice identifier="good">Good</likertChoice>
      <likertChoice identifier="excellent">Excellent</likertChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;

export const LIKERT_7_POINT_AGREEMENT = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                identifier="likert-7pt-agreement"
                title="7-Point Agreement Scale">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>

  <itemBody>
    <h2>Detailed Opinion Survey</h2>
    <p>Please provide a nuanced response to:</p>
    <blockquote style="font-style: italic; margin: 1rem 0; padding: 1rem; background: #f5f5f5; border-left: 4px solid #cc3366;">
      "The plugin system provides a clean and extensible architecture for custom QTI elements."
    </blockquote>

    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <prompt>Your level of agreement (7-point scale):</prompt>
      <likertChoice identifier="strongly_disagree">Strongly Disagree</likertChoice>
      <likertChoice identifier="disagree">Disagree</likertChoice>
      <likertChoice identifier="somewhat_disagree">Somewhat Disagree</likertChoice>
      <likertChoice identifier="neutral">Neutral</likertChoice>
      <likertChoice identifier="somewhat_agree">Somewhat Agree</likertChoice>
      <likertChoice identifier="agree">Agree</likertChoice>
      <likertChoice identifier="strongly_agree">Strongly Agree</likertChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;

export const LIKERT_5_POINT_DEFAULT_LABELS = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                identifier="likert-5pt-default"
                title="5-Point Scale with Auto-Generated Labels">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>

  <itemBody>
    <h2>Default Labels Demo</h2>
    <p>This item uses <strong>empty likertChoice elements</strong> to demonstrate automatic label generation:</p>
    <blockquote style="font-style: italic; margin: 1rem 0; padding: 1rem; background: #fff3cd; border-left: 4px solid #ffcc00;">
      "The automatic label generation feature is helpful for rapid prototyping."
    </blockquote>
    <p style="font-size: 0.9rem; color: #666;">
      <em>Note: The plugin automatically generates "Strongly Disagree" → "Strongly Agree" labels for empty 5-point scales.</em>
    </p>

    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <prompt>Your opinion:</prompt>
      <likertChoice identifier="1"></likertChoice>
      <likertChoice identifier="2"></likertChoice>
      <likertChoice identifier="3"></likertChoice>
      <likertChoice identifier="4"></likertChoice>
      <likertChoice identifier="5"></likertChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;

export const LIKERT_3_POINT_SIMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                identifier="likert-3pt-simple"
                title="3-Point Simple Scale">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>

  <itemBody>
    <h2>Quick Poll</h2>
    <p>Simple yes/no/neutral question:</p>
    <blockquote style="font-style: italic; margin: 1rem 0; padding: 1rem; background: #f5f5f5; border-left: 4px solid #00aaff;">
      "Do you find the ACME Likert Plugin useful?"
    </blockquote>

    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <prompt>Your answer:</prompt>
      <likertChoice identifier="no">No</likertChoice>
      <likertChoice identifier="maybe">Maybe / Neutral</likertChoice>
      <likertChoice identifier="yes">Yes</likertChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;

export const ALL_LIKERT_ITEMS = [
  { xml: LIKERT_5_POINT_AGREEMENT, name: '5-Point Agreement', description: 'Standard agreement scale with custom labels' },
  { xml: LIKERT_5_POINT_FREQUENCY, name: '5-Point Frequency', description: 'How often - frequency scale detection' },
  { xml: LIKERT_4_POINT_SATISFACTION, name: '4-Point Satisfaction', description: 'Satisfaction scale with 4 points' },
  { xml: LIKERT_4_POINT_QUALITY, name: '4-Point Quality', description: 'Quality rating from Poor to Excellent' },
  { xml: LIKERT_7_POINT_AGREEMENT, name: '7-Point Agreement', description: 'Nuanced 7-point agreement scale' },
  { xml: LIKERT_5_POINT_DEFAULT_LABELS, name: '5-Point Auto-Labels', description: 'Demonstrates automatic label generation' },
  { xml: LIKERT_3_POINT_SIMPLE, name: '3-Point Simple', description: 'Minimal 3-point scale' },
];
