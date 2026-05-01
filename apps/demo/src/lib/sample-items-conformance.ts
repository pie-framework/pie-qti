/**
 * QTI 2.2 Advanced DELIVERY conformance items for visual verification in the demo app.
 * These correspond directly to the official 1EdTech conformance test packages.
 *
 * Q8:  Graphic Gap Match Interaction (D1 = GapImg, D2 = GapText) — uses UK airport map PNG
 * Q10: Hotspot Interaction (D1 = multiple cardinality, D2 = polygon shapes, D3 = single cardinality)
 * Q11: Hot-text Interaction (D1 = single cardinality, D2 = multiple cardinality)
 *
 * Images are served from /static/ (copied from the official 1EdTech conformance package).
 * File names use a -q8 / -q10 suffix to avoid collisions with other demo assets.
 */

import type { SampleItem } from './sample-items.js';

// Q8-D1: GapImg — UK airport tag labels dragged onto map
const Q8_GGM_GAP_IMG = `
<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p2 http://www.imsglobal.org/xsd/qti/qtiv2p2/imsqti_v2p2p1.xsd"
  identifier="graphic-gap-match-item1" title="Q8 GGM Images - Airport Tags"
  adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
    <correctResponse>
      <value>GLA A</value>
      <value>EDI B</value>
      <value>MAN C</value>
    </correctResponse>
    <mapping defaultValue="-1" lowerBound="0">
      <mapEntry mapKey="GLA A" mappedValue="1"/>
      <mapEntry mapKey="EDI B" mappedValue="1"/>
      <mapEntry mapKey="MAN C" mappedValue="1"/>
    </mapping>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <itemBody>
    <div>
      <p>The International Air Transport Association assigns three-letter codes to identify airports worldwide. For example, London Heathrow has code LHR.</p>
    </div>
    <div>
      <graphicGapMatchInteraction responseIdentifier="RESPONSE">
        <prompt>
          <p>Some of the labels on the following diagram are missing: can you identify the correct three-letter codes for the unlabelled airports?</p>
        </prompt>
        <object data="/ukairtags-q8.png" type="image/png" width="206" height="280">UK airport map</object>
        <gapImg identifier="CBG" matchMax="1">
          <object data="/cbg-q8.png" type="image/png" width="25" height="11">CBG tag</object>
        </gapImg>
        <gapImg identifier="EBG" matchMax="1">
          <object data="/ebg-q8.png" type="image/png" width="25" height="11">EBG tag</object>
        </gapImg>
        <gapImg identifier="EDI" matchMax="1">
          <object data="/edi-q8.png" type="image/png" width="25" height="11">EDI tag</object>
        </gapImg>
        <gapImg identifier="GLA" matchMax="1">
          <object data="/gla-q8.png" type="image/png" width="25" height="11">GLA tag</object>
        </gapImg>
        <gapImg identifier="MAN" matchMax="1">
          <object data="/man-q8.png" type="image/png" width="25" height="11">MAN tag</object>
        </gapImg>
        <gapImg identifier="MCH" matchMax="1">
          <object data="/mch-q8.png" type="image/png" width="25" height="11">MCH tag</object>
        </gapImg>
        <associableHotspot identifier="A" matchMax="1" shape="rect" coords="6,100,43,125"/>
        <associableHotspot identifier="B" matchMax="1" shape="rect" coords="118,95,162,120"/>
        <associableHotspot identifier="C" matchMax="1" shape="rect" coords="57,158,99,183"/>
      </graphicGapMatchInteraction>
    </div>
  </itemBody>
  <responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/map_response"/>
</assessmentItem>`;

// Q8-D2: GapText — same map, text labels instead of images
const Q8_GGM_GAP_TEXT = `
<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p2 http://www.imsglobal.org/xsd/qti/qtiv2p2/imsqti_v2p2p2.xsd"
  identifier="graphic-gap-match-item2" title="Q8 GGM Text - Airport Tags"
  adaptive="false" timeDependent="false">
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
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <itemBody>
    <p>The International Air Transport Association assigns three-letter codes to identify airports worldwide. For example, London Heathrow has code LHR.</p>
    <graphicGapMatchInteraction responseIdentifier="RESPONSE">
      <prompt>
        <p>Some of the labels on the following diagram are missing: can you identify the correct three-letter codes for the unlabelled airports?</p>
      </prompt>
      <object type="image/png" data="/ukairtags-q8.png" width="206" height="280">UK airport map</object>
      <gapText identifier="CBG" matchMax="1"><span>CBG</span></gapText>
      <gapText identifier="EBG" matchMax="1"><span>EBG</span></gapText>
      <gapText identifier="GLA" matchMax="1"><span>GLA</span></gapText>
      <gapText identifier="MAN" matchMax="1"><span>MAN</span></gapText>
      <gapText identifier="MCH" matchMax="1"><span>MCH</span></gapText>
      <associableHotspot identifier="A" matchMax="1" shape="rect" coords="6,100,43,125"/>
      <associableHotspot identifier="B" matchMax="1" shape="rect" coords="118,95,162,120"/>
      <associableHotspot identifier="C" matchMax="1" shape="rect" coords="57,158,99,183"/>
    </graphicGapMatchInteraction>
  </itemBody>
  <responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/map_response"/>
</assessmentItem>`;

// Q10-D3: Single cardinality hotspot — UK map, choose London (C)
const Q10_HOTSPOT_SINGLE = `
<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p2 http://www.imsglobal.org/xsd/qti/qtiv2p2/imsqti_v2p2.xsd"
  identifier="hotspot-example-1" title="Q10 Hotspot - Single Cardinality"
  adaptive="false" timeDependent="false">
  <responseDeclaration baseType="identifier" cardinality="single" identifier="RESPONSE">
    <correctResponse>
      <value>C</value>
    </correctResponse>
  </responseDeclaration>
  <outcomeDeclaration baseType="float" cardinality="single" identifier="SCORE">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <itemBody>
    <p>
      The picture below illustrates four of the most popular destinations for air travelers arriving
      in the United Kingdom: London, Manchester, Edinburgh and Glasgow.
      Please <strong>choose London</strong>.
    </p>
    <hotspotInteraction maxChoices="1" responseIdentifier="RESPONSE">
      <object data="/ukair-q10.png" height="280" width="206" type="image/png">UK Map</object>
      <hotspotChoice coords="77,115,10" identifier="A" shape="circle"/>
      <hotspotChoice coords="118,184,10" identifier="B" shape="circle"/>
      <hotspotChoice coords="150,235,10" identifier="C" shape="circle"/>
      <hotspotChoice coords="96,114,10" identifier="D" shape="circle"/>
    </hotspotInteraction>
  </itemBody>
  <responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
</assessmentItem>`;

// Q10-D1: Multiple cardinality hotspot — UK map, choose all cities North of London (A, B, D)
const Q10_HOTSPOT_MULTIPLE = `
<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p2 http://www.imsglobal.org/xsd/qti/qtiv2p2/imsqti_v2p2.xsd"
  identifier="hotspot-example-2" title="Q10 Hotspot - Multiple Cardinality"
  adaptive="false" timeDependent="false">
  <responseDeclaration baseType="identifier" cardinality="multiple" identifier="RESPONSE">
    <correctResponse>
      <value>A</value>
      <value>B</value>
      <value>D</value>
    </correctResponse>
  </responseDeclaration>
  <outcomeDeclaration baseType="float" cardinality="single" identifier="SCORE">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <itemBody>
    <p>
      The picture below illustrates four of the most popular destinations for air travelers arriving
      in the United Kingdom: London, Manchester, Edinburgh and Glasgow.
      Please <strong>choose all cities North of London</strong>.
    </p>
    <hotspotInteraction maxChoices="0" responseIdentifier="RESPONSE">
      <object data="/ukair-q10.png" height="280" width="206" type="image/png">UK Map</object>
      <hotspotChoice coords="77,115,10" identifier="A" shape="circle"/>
      <hotspotChoice coords="118,184,10" identifier="B" shape="circle"/>
      <hotspotChoice coords="150,235,10" identifier="C" shape="circle"/>
      <hotspotChoice coords="96,114,10" identifier="D" shape="circle"/>
    </hotspotInteraction>
  </itemBody>
  <responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
</assessmentItem>`;

// Q10-D2: Polygon shapes hotspot — official 1EdTech plants.svg served from /static/
// Correct answer: i4 (rhizome, underground portion)
const Q10_HOTSPOT_SHAPES = `
<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p2 http://www.imsglobal.org/xsd/qti/qtiv2p2/imsqti_v2p2p2.xsd"
  identifier="hotspot-example-3" title="Q10 Hotspot - Polygon Shapes"
  adaptive="false" timeDependent="false">
  <responseDeclaration baseType="identifier" cardinality="single" identifier="RESPONSE">
    <correctResponse>
      <value>i4</value>
    </correctResponse>
  </responseDeclaration>
  <outcomeDeclaration baseType="float" cardinality="single" identifier="SCORE">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <itemBody>
    <p>In the following image, which part of the plant is the rhizome?</p>
    <p>Select a highlighted part of the image to indicate your answer.</p>
    <hotspotInteraction maxChoices="1" minChoices="1" responseIdentifier="RESPONSE">
      <object data="/plants-q10.svg" type="image/svg+xml" width="680" height="680">
        A diagram of a flowering water lily showing parts above the water, parts below the water, and parts under the ground.
      </object>
      <hotspotChoice coords="243,129,221,130,204,133,186,140,172,146,159,155,149,165,146,175,147,183,151,189,159,194,173,198,187,199,203,199,222,196,241,189,261,179,274,169,284,155,281,142,272,136,260,131,243,129" identifier="i1" shape="poly"/>
      <hotspotChoice coords="330,118,357,108,364,138,330,118" identifier="i2" shape="poly"/>
      <hotspotChoice coords="379,80,14" identifier="i3" shape="circle"/>
      <hotspotChoice coords="337,493,194,591,360,531,337,493" identifier="i4" shape="poly"/>
    </hotspotInteraction>
  </itemBody>
  <responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
</assessmentItem>`;

// Q11-D1: Hot-text single cardinality — select the grammar error (correct: B "includes")
const Q11_HOTTEXT_SINGLE = `
<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p2 http://www.imsglobal.org/xsd/qti/qtiv2p2/imsqti_v2p2.xsd"
  identifier="hot-text-example-1" title="Q11 Hot-text - Single Cardinality"
  adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>B</value>
    </correctResponse>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <itemBody>
    <p>
      Select the error in the following passage of text (or <em>No Error</em> if there is none).
    </p>
    <hottextInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <p>
        Sponsors of the Olympic Games
        <hottext identifier="A">who bought</hottext>
        advertising time on United States television
        <hottext identifier="B">includes</hottext>
        <hottext identifier="C">at least</hottext>
        a dozen international firms
        <hottext identifier="D">whose</hottext>
        names are familiar to American consumers.
        <hottext identifier="E">No error.</hottext>
      </p>
    </hottextInteraction>
  </itemBody>
  <responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
</assessmentItem>`;

// Q11-D2: Hot-text multiple cardinality — select both grammar errors (A "whom bought", B "includes")
const Q11_HOTTEXT_MULTIPLE = `
<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p2 http://www.imsglobal.org/xsd/qti/qtiv2p2/imsqti_v2p2.xsd"
  identifier="hot-text-example-2" title="Q11 Hot-text - Multiple Cardinality"
  adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="identifier">
    <correctResponse>
      <value>A</value>
      <value>B</value>
    </correctResponse>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <itemBody>
    <p>
      Select the errors in the following passage of text (or <em>No Error</em> if there are none).
    </p>
    <hottextInteraction responseIdentifier="RESPONSE" maxChoices="2">
      <p>
        Sponsors of the Olympic Games
        <hottext identifier="A">whom bought</hottext>
        advertising time on United States television
        <hottext identifier="B">includes</hottext>
        <hottext identifier="C">at least</hottext>
        a dozen international firms
        <hottext identifier="D">whose</hottext>
        names are familiar to American consumers.
        <hottext identifier="E">No error.</hottext>
      </p>
    </hottextInteraction>
  </itemBody>
  <responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
</assessmentItem>`;

export const CONFORMANCE_QTI22_ADVANCED_ITEMS: SampleItem[] = [
  {
    id: 'conf-q8-gap-img',
    title: '[CONF] Q8 Graphic Gap Match - GapImg (Airport Tags)',
    description: 'Q8-D1: Drag image labels onto UK airport map. Correct: GLA→A, EDI→B, MAN→C. lowerBound=0.',
    xml: Q8_GGM_GAP_IMG.trim(),
  },
  {
    id: 'conf-q8-gap-text',
    title: '[CONF] Q8 Graphic Gap Match - GapText (Airport Tags)',
    description: 'Q8-D2: Drag text labels onto UK airport map. Correct: GLA→A, EDI→B, MAN→C. lowerBound=0.',
    xml: Q8_GGM_GAP_TEXT.trim(),
  },
  {
    id: 'conf-q10-hotspot-single',
    title: '[CONF] Q10 Hotspot - Single Cardinality (UK Cities)',
    description: 'Q10-D3: Click to choose London (C) from four UK cities on a map. maxChoices=1.',
    xml: Q10_HOTSPOT_SINGLE.trim(),
  },
  {
    id: 'conf-q10-hotspot-multiple',
    title: '[CONF] Q10 Hotspot - Multiple Cardinality (UK Cities)',
    description: 'Q10-D1: Click all cities North of London (A, B, D). maxChoices=0 (unlimited).',
    xml: Q10_HOTSPOT_MULTIPLE.trim(),
  },
  {
    id: 'conf-q10-hotspot-shapes',
    title: '[CONF] Q10 Hotspot - Polygon Shapes (Plant Rhizome)',
    description: 'Q10-D2: Click the rhizome (i4) on a plant diagram. Tests polygon hotspot shapes.',
    xml: Q10_HOTSPOT_SHAPES.trim(),
  },
  {
    id: 'conf-q11-hottext-single',
    title: '[CONF] Q11 Hot-text - Single Cardinality',
    description: 'Q11-D1: Select one grammar error in the passage ("includes"). maxChoices=1.',
    xml: Q11_HOTTEXT_SINGLE.trim(),
  },
  {
    id: 'conf-q11-hottext-multiple',
    title: '[CONF] Q11 Hot-text - Multiple Cardinality',
    description: 'Q11-D2: Select two grammar errors in the passage ("whom bought", "includes"). maxChoices=2.',
    xml: Q11_HOTTEXT_MULTIPLE.trim(),
  },
];
