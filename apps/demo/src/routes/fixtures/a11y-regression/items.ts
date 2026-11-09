/**
 * Items for the accessibility-regression fixture (`/fixtures/a11y-regression?item=…`),
 * exercised by `tests/playwright/a11y-regression.pw.ts`.
 *
 * These items cover the WCAG failures axe cannot see: identifier leakage into accessible
 * names, authored image alternatives reaching the rendered DOM, content-derived names for
 * image-only and MathML choices, state-dependent contrast, keyboard focus visibility on
 * custom-drawn controls, and modal dialog semantics.
 *
 * Every identifier is deliberately "leaky" — it gives the answer away (e.g.
 * `RESPONSE_CORRECT_PARIS`) — so any identifier reaching an accessible name fails the test.
 */

/**
 * One item, every major non-graphic interaction plus the hotspot and graphic-order
 * regions, all with answer-revealing identifiers. Covers choice, inline text entry,
 * inline choice, gap match, order, match, associate, hotspot and graphic order name
 * computation in a single page load.
 */
const LEAKY_NAMES = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="a11y-leaky-names-item" title="Leaky identifier regression" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="CHOICE_CORRECT_MARS_IS_PLANET" cardinality="single" baseType="identifier"/>
  <responseDeclaration identifier="TEXT_ENTRY_CAPITAL_IS_PARIS" cardinality="single" baseType="string"/>
  <responseDeclaration identifier="INLINE_CHOICE_CONTINENT_IS_EUROPE" cardinality="single" baseType="identifier"/>
  <responseDeclaration identifier="GAP_MATCH_SEINE_IN_PARIS" cardinality="multiple" baseType="directedPair"/>
  <responseDeclaration identifier="ORDER_FIRST_STEP_IS_MEASURE_CORRECT" cardinality="ordered" baseType="identifier"/>
  <responseDeclaration identifier="MATCH_PAIR_EIFFEL_TOWER_PARIS_CORRECT" cardinality="multiple" baseType="directedPair"/>
  <responseDeclaration identifier="ASSOCIATE_FIRST_PAIR_SEINE_PARIS_CORRECT" cardinality="multiple" baseType="pair"/>
  <responseDeclaration identifier="HOTSPOT_LEAKY_CIRCLE_IS_STOP_SIGN_CORRECT" cardinality="single" baseType="identifier"/>
  <responseDeclaration identifier="GRAPHIC_ORDER_TOP_LAYER_FIRST_IS_CORRECT" cardinality="ordered" baseType="identifier"/>
  <itemBody>
    <p class="intro">Answer every question below.</p>

    <choiceInteraction responseIdentifier="CHOICE_CORRECT_MARS_IS_PLANET" maxChoices="1" class="qti-choices-stacked">
      <prompt>Which of these is a planet?</prompt>
      <simpleChoice identifier="CHOICE_A_MARS_IS_THE_PLANET_CORRECT">Mars</simpleChoice>
      <simpleChoice identifier="CHOICE_B_VENUS_IS_A_STAR">Venus</simpleChoice>
      <simpleChoice identifier="CHOICE_C_THE_MOON_NOT_PLANET">The Moon</simpleChoice>
    </choiceInteraction>

    <p class="blanks">The capital of France is <textEntryInteraction responseIdentifier="TEXT_ENTRY_CAPITAL_IS_PARIS" expectedLength="10"/>, and France lies in <inlineChoiceInteraction responseIdentifier="INLINE_CHOICE_CONTINENT_IS_EUROPE"><inlineChoice identifier="INLINE_CHOICE_EUROPE_CORRECT_ANSWER">Europe</inlineChoice><inlineChoice identifier="INLINE_CHOICE_ASIA_WRONG">Asia</inlineChoice></inlineChoiceInteraction>.</p>

    <gapMatchInteraction responseIdentifier="GAP_MATCH_SEINE_IN_PARIS" class="qti-choices-stacked" maxAssociations="2">
      <prompt>Complete the sentences about rivers.</prompt>
      <gapText identifier="GAP_TEXT_SEINE_FLOWS_THROUGH_PARIS" matchMax="1">the Seine</gapText>
      <gapText identifier="GAP_TEXT_TAMIIS_NOT_A_RIVER" matchMax="1">the Tamis</gapText>
      <p>The river through Paris is <gap identifier="GAP_RIVER_PARIS_IS_THE_SEINE"/>.</p>
      <p>The river through Madrid is <gap identifier="GAP_RIVER_MADRID_MANZANARES_CORRECT"/>.</p>
    </gapMatchInteraction>

    <orderInteraction responseIdentifier="ORDER_FIRST_STEP_IS_MEASURE_CORRECT" shuffle="false">
      <prompt>Order the steps of measuring from first to last.</prompt>
      <simpleChoice identifier="ORDER_STEP1_MEASURE_FIRST_CORRECT">Measure</simpleChoice>
      <simpleChoice identifier="ORDER_STEP2_CUT_SECOND">Cut</simpleChoice>
      <simpleChoice identifier="ORDER_STEP3_SEW_THIRD">Sew</simpleChoice>
    </orderInteraction>

    <matchInteraction responseIdentifier="MATCH_PAIR_EIFFEL_TOWER_PARIS_CORRECT" shuffle="false">
      <prompt>Match each landmark to its city.</prompt>
      <simpleMatchSet>
        <simpleAssociableChoice identifier="MATCH_LANDMARK_EIFFEL_TOWER_GOES_PARIS" matchMax="1">Eiffel Tower</simpleAssociableChoice>
        <simpleAssociableChoice identifier="MATCH_LANDMARK_SAGRADA_FAMILIA_BARCELONA" matchMax="1">Sagrada Familia</simpleAssociableChoice>
      </simpleMatchSet>
      <simpleMatchSet>
        <simpleAssociableChoice identifier="MATCH_CITY_PARIS_IS_EIFFEL_HOME" matchMax="2">Paris</simpleAssociableChoice>
        <simpleAssociableChoice identifier="MATCH_CITY_BARCELONA_SAGRADA_HOME" matchMax="2">Barcelona</simpleAssociableChoice>
      </simpleMatchSet>
    </matchInteraction>

    <associateInteraction responseIdentifier="ASSOCIATE_FIRST_PAIR_SEINE_PARIS_CORRECT" maxAssociations="2">
      <prompt>Associate each river with its city.</prompt>
      <simpleAssociableChoice identifier="ASSOCIATE_SEINE_BELONGS_PARIS_CORRECT" matchMax="1">the Seine</simpleAssociableChoice>
      <simpleAssociableChoice identifier="ASSOCIATE_MANZANARES_BELONGS_MADRID" matchMax="1">the Manzanares</simpleAssociableChoice>
      <simpleAssociableChoice identifier="ASSOCIATE_DISTRACTER_NEVER_USED">the Volga</simpleAssociableChoice>
    </associateInteraction>

    <hotspotInteraction responseIdentifier="HOTSPOT_LEAKY_CIRCLE_IS_STOP_SIGN_CORRECT" maxChoices="1">
      <prompt>Select the octagon (a stop sign is an octagon).</prompt>
      <object type="image/svg+xml" width="420" height="140">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 140">
          <rect width="420" height="140" fill="#ffffff"/>
          <circle cx="70" cy="70" r="44" fill="#e5e7eb" stroke="#9ca3af" stroke-width="2"/>
          <text x="70" y="130" text-anchor="middle" font-family="system-ui" font-size="12" fill="#111827">Circle</text>
          <rect x="168" y="26" width="88" height="88" fill="#e5e7eb" stroke="#9ca3af" stroke-width="2"/>
          <text x="212" y="130" text-anchor="middle" font-family="system-ui" font-size="12" fill="#111827">Square</text>
          <polygon points="352,24 396,46 396,94 352,116 308,94 308,46" fill="#e5e7eb" stroke="#9ca3af" stroke-width="2"/>
          <text x="352" y="132" text-anchor="middle" font-family="system-ui" font-size="12" fill="#111827">Octagon</text>
        </svg>
      </object>
      <hotspotChoice identifier="HOTSPOT_A_CIRCLE_NOT_STOP" shape="circle" coords="70,70,44" hotspotLabel="Circle">Circle</hotspotChoice>
      <hotspotChoice identifier="HOTSPOT_B_SQUARE_NOT_STOP" shape="rect" coords="168,26,256,114" hotspotLabel="Square">Square</hotspotChoice>
      <hotspotChoice identifier="HOTSPOT_C_OCTAGON_STOP_SIGN_CORRECT" shape="poly" coords="352,24,396,46,396,94,352,116,308,94,308,46" hotspotLabel="Octagon">Octagon</hotspotChoice>
    </hotspotInteraction>

    <graphicOrderInteraction responseIdentifier="GRAPHIC_ORDER_TOP_LAYER_FIRST_IS_CORRECT">
      <prompt>Order the rock layers from top to bottom.</prompt>
      <object type="image/svg+xml" width="360" height="160">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 160">
          <title>Three rock layers</title>
          <rect width="360" height="160" fill="#ffffff"/>
          <rect x="0" y="0" width="360" height="50" fill="#f3f4f6" stroke="#9ca3af"/>
          <rect x="0" y="53" width="360" height="50" fill="#e5e7eb" stroke="#9ca3af"/>
          <rect x="0" y="106" width="360" height="50" fill="#d1d5db" stroke="#9ca3af"/>
        </svg>
      </object>
      <hotspotChoice identifier="GRAPHIC_ORDER_SANDSTONE_IS_FIRST_CORRECT" shape="rect" coords="0,0,360,50" hotspotLabel="Sandstone">Sandstone</hotspotChoice>
      <hotspotChoice identifier="GRAPHIC_ORDER_SHALE_IS_SECOND_CORRECT" shape="rect" coords="0,53,360,103" hotspotLabel="Shale">Shale</hotspotChoice>
      <hotspotChoice identifier="GRAPHIC_ORDER_GRANITE_IS_LAST_CORRECT" shape="rect" coords="0,106,360,156" hotspotLabel="Granite">Granite</hotspotChoice>
    </graphicOrderInteraction>
  </itemBody>
</assessmentItem>`;

/**
 * Every graphic interaction with an authored text alternative on its response image,
 * so the test can assert the authored alternative reaches the rendered image (and the
 * gapImg tiles' alternatives reach their rendered imgs).
 */
const IMAGE_ALTERNATIVES = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="a11y-image-alternatives-item" title="Graphic image alternatives" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="HOTSPOT_IMG_ALT_AUTHORED_TEXT" cardinality="single" baseType="identifier"/>
  <responseDeclaration identifier="SELECT_POINT_IMG_ALT_POINT" cardinality="single" baseType="point"/>
  <responseDeclaration identifier="GRAPHIC_ORDER_IMG_ALT" cardinality="ordered" baseType="identifier"/>
  <responseDeclaration identifier="GRAPHIC_ASSOCIATE_IMG_ALT" cardinality="multiple" baseType="pair"/>
  <responseDeclaration identifier="GRAPHIC_GAP_MATCH_IMG_ALT" cardinality="multiple" baseType="directedPair"/>
  <responseDeclaration identifier="POSITION_OBJECT_IMG_ALT" cardinality="multiple" baseType="point"/>
  <responseDeclaration identifier="DRAWING_IMG_ALT_FILE" cardinality="single" baseType="file"/>
  <itemBody>
    <hotspotInteraction responseIdentifier="HOTSPOT_IMG_ALT_AUTHORED_TEXT" maxChoices="1">
      <prompt>Hotspot: select the circle.</prompt>
      <object type="image/svg+xml" width="360" height="120">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 120">
          <title>Hotspot response panel with three shapes</title>
          <desc>A white panel containing a circle, a square and an octagon</desc>
          <rect width="360" height="120" fill="#ffffff"/>
          <circle cx="60" cy="60" r="40" fill="#e5e7eb" stroke="#9ca3af" stroke-width="2"/>
          <rect x="140" y="20" width="80" height="80" fill="#e5e7eb" stroke="#9ca3af" stroke-width="2"/>
          <polygon points="300,20 340,40 340,80 300,100 260,80 260,40" fill="#e5e7eb" stroke="#9ca3af" stroke-width="2"/>
        </svg>
      </object>
      <hotspotChoice identifier="IMG_ALT_HS_CIRCLE" shape="circle" coords="60,60,40" hotspotLabel="Circle">Circle</hotspotChoice>
      <hotspotChoice identifier="IMG_ALT_HS_SQUARE" shape="rect" coords="140,20,220,100" hotspotLabel="Square">Square</hotspotChoice>
      <hotspotChoice identifier="IMG_ALT_HS_OCTAGON" shape="poly" coords="300,20,340,40,340,80,300,100,260,80,260,40" hotspotLabel="Octagon">Octagon</hotspotChoice>
    </hotspotInteraction>

    <selectPointInteraction responseIdentifier="SELECT_POINT_IMG_ALT_POINT" maxChoices="1">
      <prompt>Select point: mark the middle of the line.</prompt>
      <object type="image/svg+xml" width="360" height="80">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 80">
          <title>Number line from zero to ten</title>
          <desc>A horizontal line with tick marks labeled zero through ten</desc>
          <rect width="360" height="80" fill="#ffffff"/>
          <line x1="20" y1="40" x2="340" y2="40" stroke="#111827" stroke-width="2"/>
          <circle cx="20" cy="40" r="3" fill="#111827"/>
          <circle cx="340" cy="40" r="3" fill="#111827"/>
        </svg>
      </object>
    </selectPointInteraction>

    <graphicOrderInteraction responseIdentifier="GRAPHIC_ORDER_IMG_ALT">
      <prompt>Graphic order: order the bands from top to bottom.</prompt>
      <object type="image/svg+xml" width="360" height="160">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 160">
          <title>Graphic order strata panel</title>
          <desc>A panel with three horizontal bands to be ordered</desc>
          <rect width="360" height="160" fill="#ffffff"/>
          <rect x="0" y="0" width="360" height="50" fill="#f3f4f6" stroke="#9ca3af"/>
          <rect x="0" y="53" width="360" height="50" fill="#e5e7eb" stroke="#9ca3af"/>
          <rect x="0" y="106" width="360" height="50" fill="#d1d5db" stroke="#9ca3af"/>
        </svg>
      </object>
      <hotspotChoice identifier="IMG_ALT_GO_TOP_BAND" shape="rect" coords="0,0,360,50" hotspotLabel="Top band">Top band</hotspotChoice>
      <hotspotChoice identifier="IMG_ALT_GO_MIDDLE_BAND" shape="rect" coords="0,53,360,103" hotspotLabel="Middle band">Middle band</hotspotChoice>
      <hotspotChoice identifier="IMG_ALT_GO_BOTTOM_BAND" shape="rect" coords="0,106,360,160" hotspotLabel="Bottom band">Bottom band</hotspotChoice>
    </graphicOrderInteraction>

    <graphicAssociateInteraction responseIdentifier="GRAPHIC_ASSOCIATE_IMG_ALT" maxAssociations="2">
      <prompt>Graphic associate: connect the two matching panels.</prompt>
      <object type="image/svg+xml" width="360" height="160">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 160">
          <title>Graphic associate pairing panel</title>
          <desc>A panel with two selectable zones, left and right</desc>
          <rect width="360" height="160" fill="#ffffff"/>
          <rect x="10" y="10" width="160" height="140" fill="#f9fafb" stroke="#9ca3af"/>
          <rect x="190" y="10" width="160" height="140" fill="#f9fafb" stroke="#9ca3af"/>
        </svg>
      </object>
      <associableHotspot identifier="IMG_ALT_GA_LEFT_ZONE" shape="rect" coords="10,10,170,150" matchMax="1" hotspotLabel="Left zone">Left zone</associableHotspot>
      <associableHotspot identifier="IMG_ALT_GA_RIGHT_ZONE" shape="rect" coords="190,10,350,150" matchMax="1" hotspotLabel="Right zone">Right zone</associableHotspot>
    </graphicAssociateInteraction>

    <graphicGapMatchInteraction responseIdentifier="GRAPHIC_GAP_MATCH_IMG_ALT" maxAssociations="2">
      <prompt>Graphic gap match: drop each label on its zone.</prompt>
      <object type="image/svg+xml" width="360" height="160">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 160">
          <title>Graphic gap match drop zones</title>
          <desc>A panel with two drop zones, north and south</desc>
          <rect width="360" height="160" fill="#ffffff"/>
          <rect x="10" y="10" width="340" height="60" fill="#f9fafb" stroke="#9ca3af"/>
          <rect x="10" y="90" width="340" height="60" fill="#f9fafb" stroke="#9ca3af"/>
        </svg>
      </object>
      <gapText identifier="IMG_ALT_GGM_LABEL_NORTH_TEXT" matchMax="1">North label</gapText>
      <gapImg identifier="IMG_ALT_GGM_TILE_STAR_GAUGE" matchMax="1">
        <object type="image/svg+xml" width="24" height="24">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <title>Compass star tile</title>
            <polygon points="12,2 15,10 24,10 17,15 20,23 12,18 4,23 7,15 0,10 9,10" fill="gold" stroke="orange"/>
          </svg>
        </object>
      </gapImg>
      <associableHotspot identifier="IMG_ALT_GGM_NORTH_ZONE" shape="rect" coords="10,10,350,70" matchMax="1" hotspotLabel="North zone">North zone</associableHotspot>
      <associableHotspot identifier="IMG_ALT_GGM_SOUTH_ZONE" shape="rect" coords="10,90,350,150" matchMax="1" hotspotLabel="South zone">South zone</associableHotspot>
    </graphicGapMatchInteraction>

    <positionObjectStage>
      <object type="image/svg+xml" width="360" height="160">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 160">
          <title>Position object placement board</title>
          <desc>A board with a marked target zone on the right</desc>
          <rect width="360" height="160" fill="#ffffff"/>
          <rect x="240" y="30" width="90" height="90" fill="#f9fafb" stroke="#9ca3af"/>
        </svg>
      </object>
      <positionObjectInteraction responseIdentifier="POSITION_OBJECT_IMG_ALT" maxChoices="1">
        <prompt>Position object: drag the marker onto the target zone.</prompt>
        <object type="image/svg+xml" width="24" height="24">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <title>Placement marker</title>
            <polygon points="12,2 15,10 24,10 17,15 20,23 12,18 4,23 7,15 0,10 9,10" fill="gold" stroke="orange"/>
          </svg>
        </object>
      </positionObjectInteraction>
    </positionObjectStage>

    <drawingInteraction responseIdentifier="DRAWING_IMG_ALT_FILE" data-stroke-color="#2563eb" data-line-width="5">
      <object type="image/svg+xml" width="360" height="160">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 160">
          <title>Drawing canvas</title>
          <desc>An empty white canvas for drawing</desc>
          <rect width="360" height="160" fill="#ffffff"/>
        </svg>
      </object>
    </drawingInteraction>
  </itemBody>
</assessmentItem>`;

/**
 * Image alternatives in their two most common authored encodings, side by side:
 *  - an author-marked decorative image, `<img alt="">` (the QTI 3.0 element is also
 *    accepted in 2.2 content), must render with an empty alt and stay out of the
 *    accessibility tree;
 *  - a QTI 2.x external image, `<object data="…">fallback text</object>`, whose fallback
 *    text is the authored alternative and must become the rendered image's alt.
 */
const DECORATIVE_IMAGE = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="a11y-decorative-image-item" title="Decorative image" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="DECOR_HS_PICK_CIRCLE" cardinality="single" baseType="identifier"/>
  <responseDeclaration identifier="OBJECT_HS_PICK_LAYER" cardinality="single" baseType="identifier"/>
  <itemBody>
    <p>The patterned background is purely decorative.</p>
    <hotspotInteraction responseIdentifier="DECOR_HS_PICK_CIRCLE" maxChoices="1">
      <prompt>Select the circle.</prompt>
      <img src="/sample-geolayers.png" alt="" width="600" height="350"/>
      <hotspotChoice identifier="DECOR_HS_A_CIRCLE" shape="circle" coords="120,120,40" hotspotLabel="Circle">Circle</hotspotChoice>
      <hotspotChoice identifier="DECOR_HS_B_SQUARE" shape="rect" coords="260,200,340,280" hotspotLabel="Square">Square</hotspotChoice>
    </hotspotInteraction>
    <hotspotInteraction responseIdentifier="OBJECT_HS_PICK_LAYER" maxChoices="1">
      <prompt>Select the youngest layer.</prompt>
      <object type="image/png" data="/sample-geolayers.png" width="600" height="350">Cross-section of four sedimentary rock layers</object>
      <hotspotChoice identifier="OBJECT_HS_TOP_LAYER" shape="rect" coords="0,0,600,80" hotspotLabel="Top layer">Top layer</hotspotChoice>
      <hotspotChoice identifier="OBJECT_HS_BOTTOM_LAYER" shape="rect" coords="0,270,600,350" hotspotLabel="Bottom layer">Bottom layer</hotspotChoice>
    </hotspotInteraction>
  </itemBody>
</assessmentItem>`;

/**
 * Rich-content choices: an image-only choice and a MathML-only choice in order, match and
 * associate must produce content-derived accessible names, never the generic "Item".
 */
const RICH_CHOICES = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" xmlns:m="http://www.w3.org/1998/Math/MathML" identifier="a11y-rich-choices-item" title="Rich content choices" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="ORDER_RICH_IMG_STAR_FIRST" cardinality="ordered" baseType="identifier"/>
  <responseDeclaration identifier="MATCH_RICH_FRACTIONS" cardinality="multiple" baseType="directedPair"/>
  <responseDeclaration identifier="ASSOCIATE_RICH_STARS" cardinality="multiple" baseType="pair"/>
  <itemBody>
    <orderInteraction responseIdentifier="ORDER_RICH_IMG_STAR_FIRST" shuffle="false">
      <prompt>Order from smallest to largest expression.</prompt>
      <simpleChoice identifier="ORDER_RICH_CHOICE_IMG_ONLY_STAR"><img src="/star-marker.svg" alt="Red star marker" width="24" height="24"/></simpleChoice>
      <simpleChoice identifier="ORDER_RICH_CHOICE_MATH_ONLY"><m:math><m:mi>x</m:mi><m:mo>+</m:mo><m:mn>1</m:mn></m:math></simpleChoice>
      <simpleChoice identifier="ORDER_RICH_CHOICE_MATH_FRACTION"><m:math><m:mfrac><m:mn>3</m:mn><m:mn>4</m:mn></m:mfrac></m:math></simpleChoice>
    </orderInteraction>

    <matchInteraction responseIdentifier="MATCH_RICH_FRACTIONS" shuffle="false">
      <prompt>Match each fraction to its word.</prompt>
      <simpleMatchSet>
        <simpleAssociableChoice identifier="MATCH_RICH_MATH_ONE_HALF" matchMax="1"><m:math><m:mfrac><m:mn>1</m:mn><m:mn>2</m:mn></m:mfrac></m:math></simpleAssociableChoice>
        <simpleAssociableChoice identifier="MATCH_RICH_MATH_ONE_QUARTER" matchMax="1"><m:math><m:mfrac><m:mn>1</m:mn><m:mn>4</m:mn></m:mfrac></m:math></simpleAssociableChoice>
      </simpleMatchSet>
      <simpleMatchSet>
        <simpleAssociableChoice identifier="MATCH_RICH_WORD_ONE_HALF" matchMax="2">One half</simpleAssociableChoice>
        <simpleAssociableChoice identifier="MATCH_RICH_WORD_ONE_QUARTER" matchMax="2">One quarter</simpleAssociableChoice>
      </simpleMatchSet>
    </matchInteraction>

    <associateInteraction responseIdentifier="ASSOCIATE_RICH_STARS" maxAssociations="2">
      <prompt>Associate the matching markers.</prompt>
      <simpleAssociableChoice identifier="ASSOCIATE_RICH_IMG_GOLD_STAR" matchMax="1"><img src="/star-marker.svg" alt="Gold star" width="24" height="24"/></simpleAssociableChoice>
      <simpleAssociableChoice identifier="ASSOCIATE_RICH_IMG_RED_STAR" matchMax="1"><img src="/star-marker.svg" alt="Red star" width="24" height="24"/></simpleAssociableChoice>
    </associateInteraction>
  </itemBody>
</assessmentItem>`;

/**
 * State-dependent contrast triggers: a selection-limit message (choice), a validation
 * error (pattern-masked text entry) and the ever-present empty blanks/gaps whose
 * boundaries are non-text UI needing 3:1.
 */
const VALIDATION_CONTRAST = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="a11y-validation-contrast-item" title="State-dependent contrast" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="CONTRAST_CHOICE_LIMIT_ONE" cardinality="single" baseType="identifier"/>
  <responseDeclaration identifier="CONTRAST_TEXT_ENTRY_PATTERN" cardinality="single" baseType="string"/>
  <responseDeclaration identifier="CONTRAST_GAP_MATCH" cardinality="multiple" baseType="directedPair"/>
  <itemBody>
    <choiceInteraction responseIdentifier="CONTRAST_CHOICE_LIMIT_ONE" maxChoices="1" class="qti-choices-stacked" data-max-selections-message="Only one color can be picked.">
      <prompt>Pick one color (choosing more is refused with a message).</prompt>
      <simpleChoice identifier="CONTRAST_COLOR_RED">Red</simpleChoice>
      <simpleChoice identifier="CONTRAST_COLOR_BLUE">Blue</simpleChoice>
    </choiceInteraction>

    <p class="dated">Date of the visit: <textEntryInteraction responseIdentifier="CONTRAST_TEXT_ENTRY_PATTERN" expectedLength="10" patternMask="[0-9]{2}/[0-9]{2}/[0-9]{4}" placeholderText="dd/mm/yyyy"/></p>

    <gapMatchInteraction responseIdentifier="CONTRAST_GAP_MATCH">
      <prompt>Place each word into its blank.</prompt>
      <gapText identifier="CONTRAST_GAP_WORD_ROCK" matchMax="1">rock</gapText>
      <p>The cliff is made of <gap identifier="CONTRAST_GAP_CLIFF_MATERIAL"/>.</p>
    </gapMatchInteraction>
  </itemBody>
</assessmentItem>`;

/** An item whose submission opens authored modal feedback (correct and incorrect paths). */
const MODAL_FEEDBACK = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="a11y-modal-feedback-item" title="Modal feedback semantics" adaptive="true" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"><defaultValue><value>0</value></defaultValue></outcomeDeclaration>
  <outcomeDeclaration identifier="FEEDBACK" cardinality="single" baseType="identifier"/>
  <itemBody>
    <p class="question">Which planet is known as the red planet?</p>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <simpleChoice identifier="A">Mars</simpleChoice>
      <simpleChoice identifier="B">Venus</simpleChoice>
    </choiceInteraction>
  </itemBody>
  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match><variable identifier="RESPONSE"/><correct identifier="RESPONSE"/></match>
        <setOutcomeValue identifier="SCORE"><baseValue baseType="float">1</baseValue></setOutcomeValue>
        <setOutcomeValue identifier="FEEDBACK"><baseValue baseType="identifier">correct</baseValue></setOutcomeValue>
        <setOutcomeValue identifier="completionStatus"><baseValue baseType="identifier">completed</baseValue></setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="FEEDBACK"><baseValue baseType="identifier">incorrect</baseValue></setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
  <modalFeedback outcomeIdentifier="FEEDBACK" identifier="incorrect" showHide="show" title="Not yet"><p>Look at the colour of the planet and try again.</p></modalFeedback>
  <modalFeedback outcomeIdentifier="FEEDBACK" identifier="correct" showHide="show" title="Correct"><p>Mars is the red planet.</p></modalFeedback>
</assessmentItem>`;

/** A rich-text (XHTML) extended response: the toolbar carries the math-input dialog. */
const MATH_EDITOR = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="a11y-math-editor-item" title="Math editor dialog" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string"/>
  <itemBody>
    <p>Show your working, using the math button for formulas.</p>
    <extendedTextInteraction responseIdentifier="RESPONSE" format="xhtml" expectedLines="4"/>
  </itemBody>
</assessmentItem>`;

export const A11Y_REGRESSION_FIXTURES: Readonly<Record<string, string>> = {
	'leaky-names': LEAKY_NAMES,
	'image-alternatives': IMAGE_ALTERNATIVES,
	'decorative-image': DECORATIVE_IMAGE,
	'rich-choices': RICH_CHOICES,
	'validation-contrast': VALIDATION_CONTRAST,
	'modal-feedback': MODAL_FEEDBACK,
	'math-editor': MATH_EDITOR,
};
