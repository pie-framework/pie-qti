/**
 * QTI 2.2 Advanced DELIVERY conformance items for visual verification in the demo app.
 * These correspond directly to the official 1EdTech conformance test packages.
 *
 * Q8:  Graphic Gap Match Interaction (D1 = GapImg, D2 = GapText) — uses UK airport map PNG
 * Q10: Hotspot Interaction (D1 = multiple cardinality, D2 = polygon shapes, D3 = single cardinality)
 * Q11: Hot-text Interaction (D1 = single cardinality, D2 = multiple cardinality)
 *
 * Images are embedded as data URIs (original PNGs from the conformance package).
 * The Q10-D2 item (plants.svg, 483 KB) uses a simplified inline SVG substitute.
 */

import type { SampleItem } from './sample-items.js';

const UKAIR_PNG = 'data:image/png;base64,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';
const UKAIRTAGS_PNG = 'data:image/png;base64,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';
const GLA_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAAJCAMAAADjNjc+AAADAFBMVEX/////9///9/f/7/f/7+//7+f/5+//5+f/3t7/1tb/ztb/zs7/xsb/vcb/vb3/tbX/rbX/ra3/paX/nJz/lJT/jIz3///39/f35+f33t731t731tb3ztb3zs73xs73xsb3vcb3vb33tb33tbX3ta33ra33pa33paX3nKX3nJz3lJz3lJT3jJT3jIz3hIz3hIT3e4T3e3v3c3v3c3P3a3P3a2v3a2P3Y2P3WmP3Ulr3SlL3Skrv9/fv7+/v5+fvpaXvnKXvnJzvlJTvjIzvhIzvhITve3vvc3vvc3Pva3Pva2vvY2PvWmPvWlrvUlrvUlLvSlLvSkrvQkrvQkLvOULvOTnvMTnvMTHvKTHvKSnvGBjn5+fnxsbna2vnWlrnUlrnUlLnSlLnSkrnQkrnQkLnOULnOTnnMTnnMTHnKTHnKSnnISnnGCHnEBjnEBDe5+fe3t7eCBDeAAjW1tbWra3WWlrOzs7Gxsa9vb29e3u9KSm1vb21tbW1e3utra2lpaWcnJychISUnJyUlJSUe3uMjIyEhIR7e3tzc3Nra2tjY2NaWlpSUlJKSkpKQkJCQkI5OTkxMTEpKSkhISEYGBgQEBAICAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD+xXK2AAAAGXRFWHRTb2Z0d2FyZQBHcmFwaGljQ29udmVydGVyNV1I7gAAADRJREFUeJxiYPgPBAwMIAxm/meAcqEiDDhFGBjQRP4Towshgt0uiCkMMNn//wEAAAD//wMAp4RcpOGMkPYAAAAASUVORK5CYII=';
const EDI_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAJCAMAAAA1k+1bAAADAFBMVEX/////9///9/f/7/f/7+//7+f/5+//5+f/3t7/1tb/ztb/zs7/xsb/vcb/vb3/tbX/rbX/ra3/paX/nJz/lJT/jIz3///39/f35+f33t731t731tb3ztb3zs73xs73xsb3vcb3vb33tb33tbX3ta33ra33pa33paX3nKX3nJz3lJz3lJT3jJT3jIz3hIz3hIT3e4T3e3v3c3v3c3P3a3P3a2v3a2P3Y2P3WmP3Ulr3SlL3Skrv9/fv7+/v5+fvpaXvnKXvnJzvlJTvjIzvhIzvhITve3vvc3vvc3Pva3Pva2vvY2PvWmPvWlrvUlrvUlLvSlLvSkrvQkrvQkLvOULvOTnvMTnvMTHvKTHvKSnvGBjn5+fnxsbna2vnWlrnUlrnUlLnSlLnSkrnQkrnQkLnOULnOTnnMTnnMTHnKTHnKSnnISnnGCHnEBjnEBDe5+fe3t7eCBDeAAjW1tbWra3WWlrOzs7Gxsa9vb29e3u9KSm1vb21tbW1e3utra2lpaWcnJychISUnJyUlJSUe3uMjIyEhIR7e3tzc3Nra2tjY2NaWlpSUlJKSkpKQkJCQkI5OTkxMTEpKSkhISEYGBgQEBAICAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD+xXK2AAAAGXRFWHRTb2Z0d2FyZQBHcmFwaGljQ29udmVydGVyNV1I7gAAACdJREFUeJxi+A8EDP/BJAOYxQCmoWxCXKgYcYqx6YVSAAAAAP//AwD/oFCwC5ZxMgAAAABJRU5ErkJggg==';
const MAN_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAJCAMAAADq3ZdEAAADAFBMVEX/////9///9/f/7/f/7+//7+f/5+//5+f/3t7/1tb/ztb/zs7/xsb/vcb/vb3/tbX/rbX/ra3/paX/nJz/lJT/jIz3///39/f35+f33t731t731tb3ztb3zs73xs73xsb3vcb3vb33tb33tbX3ta33ra33pa33paX3nKX3nJz3lJz3lJT3jJT3jIz3hIz3hIT3e4T3e3v3c3v3c3P3a3P3a2v3a2P3Y2P3WmP3Ulr3SlL3Skrv9/fv7+/v5+fvpaXvnKXvnJzvlJTvjIzvhIzvhITve3vvc3vvc3Pva3Pva2vvY2PvWmPvWlrvUlrvUlLvSlLvSkrvQkrvQkLvOULvOTnvMTnvMTHvKTHvKSnvGBjn5+fnxsbna2vnWlrnUlrnUlLnSlLnSkrnQkrnQkLnOULnOTnnMTnnMTHnKTHnKSnnISnnGCHnEBjnEBDe5+fe3t7eCBDeAAjW1tbWra3WWlrOzs7Gxsa9vb29e3u9KSm1vb21tbW1e3utra2lpaWcnJychISUnJyUlJSUe3uMjIyEhIR7e3tzc3Nra2tjY2NaWlpSUlJKSkpKQkJCQkI5OTkxMTEpKSkhISEYGBgQEBAICAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD+xXK2AAAAGXRFWHRTb2Z0d2FyZQBHcmFwaGljQ29udmVydGVyNV1I7gAAACxJREFUeJxi+A8EDFAMJhkYoByoKAMyC7soGsIhSpTy/6QbDcQAAAAA//8DAIQ5inZjju0OAAAAAElFTkSuQmCC';
const CBG_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAJCAMAAAAFH/x6AAADAFBMVEX/////9///9/f/7/f/7+//7+f/5+//5+f/3t7/1tb/ztb/zs7/xsb/vcb/vb3/tbX/rbX/ra3/paX/nJz/lJT/jIz3///39/f35+f33t731t731tb3ztb3zs73xs73xsb3vcb3vb33tb33tbX3ta33ra33pa33paX3nKX3nJz3lJz3lJT3jJT3jIz3hIz3hIT3e4T3e3v3c3v3c3P3a3P3a2v3a2P3Y2P3WmP3Ulr3SlL3Skrv9/fv7+/v5+fvpaXvnKXvnJzvlJTvjIzvhIzvhITve3vvc3vvc3Pva3Pva2vvY2PvWmPvWlrvUlrvUlLvSlLvSkrvQkrvQkLvOULvOTnvMTnvMTHvKTHvKSnvGBjn5+fnxsbna2vnWlrnUlrnUlLnSlLnSkrnQkrnQkLnOULnOTnnMTnnMTHnKTHnKSnnISnnGCHnEBjnEBDe5+fe3t7eCBDeAAjW1tbWra3WWlrOzs7Gxsa9vb29e3u9KSm1vb21tbW1e3utra2lpaWcnJychISUnJyUlJSUe3uMjIyEhIR7e3tzc3Nra2tjY2NaWlpSUlJKSkpKQkJCQkI5OTkxMTEpKSkhISEYGBgQEBAICAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD+xXK2AAAAGXRFWHRTb2Z0d2FyZQBHcmFwaGljQ29udmVydGVyNV1I7gAAAC1JREFUeJxiYPgPBAxgEkjBeWBMFsXAgKD+w8XJNAxBIbsTQjP8BwAAAP//AwCeQ2yUA4AvUwAAAABJRU5ErkJggg==';
const EBG_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAAJCAMAAAAIAYw9AAADAFBMVEX/////9///9/f/7/f/7+//7+f/5+//5+f/3t7/1tb/ztb/zs7/xsb/vcb/vb3/tbX/rbX/ra3/paX/nJz/lJT/jIz3///39/f35+f33t731t731tb3ztb3zs73xs73xsb3vcb3vb33tb33tbX3ta33ra33pa33paX3nKX3nJz3lJz3lJT3jJT3jIz3hIz3hIT3e4T3e3v3c3v3c3P3a3P3a2v3a2P3Y2P3WmP3Ulr3SlL3Skrv9/fv7+/v5+fvpaXvnKXvnJzvlJTvjIzvhIzvhITve3vvc3vvc3Pva3Pva2vvY2PvWmPvWlrvUlrvUlLvSlLvSkrvQkrvQkLvOULvOTnvMTnvMTHvKTHvKSnvGBjn5+fnxsbna2vnWlrnUlrnUlLnSlLnSkrnQkrnQkLnOULnOTnnMTnnMTHnKTHnKSnnISnnGCHnEBjnEBDe5+fe3t7eCBDeAAjW1tbWra3WWlrOzs7Gxsa9vb29e3u9KSm1vb21tbW1e3utra2lpaWcnJychISUnJyUlJSUe3uMjIyEhIR7e3tzc3Nra2tjY2NaWlpSUlJKSkpKQkJCQkI5OTkxMTEpKSkhISEYGBgQEBAICAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD+xXK2AAAAGXRFWHRTb2Z0d2FyZQBHcmFwaGljQ29udmVydGVyNV1I7gAAADFJREFUeJxi+A8EDP/BJAMDhIIywRiJIiAE0/4fbsh/4jTiEoKZBeYD2QAAAAD//wMAkdtingBKQHgAAAAASUVORK5CYII=';
const MCH_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAJCAMAAAAB6ixHAAADAFBMVEX/////9///9/f/7/f/7+//7+f/5+//5+f/3t7/1tb/ztb/zs7/xsb/vcb/vb3/tbX/rbX/ra3/paX/nJz/lJT/jIz3///39/f35+f33t731t731tb3ztb3zs73xs73xsb3vcb3vb33tb33tbX3ta33ra33pa33paX3nKX3nJz3lJz3lJT3jJT3jIz3hIz3hIT3e4T3e3v3c3v3c3P3a3P3a2v3a2P3Y2P3WmP3Ulr3SlL3Skrv9/fv7+/v5+fvpaXvnKXvnJzvlJTvjIzvhIzvhITve3vvc3vvc3Pva3Pva2vvY2PvWmPvWlrvUlrvUlLvSlLvSkrvQkrvQkLvOULvOTnvMTnvMTHvKTHvKSnvGBjn5+fnxsbna2vnWlrnUlrnUlLnSlLnSkrnQkrnQkLnOULnOTnnMTnnMTHnKTHnKSnnISnnGCHnEBjnEBDe5+fe3t7eCBDeAAjW1tbWra3WWlrOzs7Gxsa9vb29e3u9KSm1vb21tbW1e3utra2lpaWcnJychISUnJyUlJSUe3uMjIyEhIR7e3tzc3Nra2tjY2NaWlpSUlJKSkpKQkJCQkI5OTkxMTEpKSkhISEYGBgQEBAICAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD+xXK2AAAAGXRFWHRTb2Z0d2FyZQBHcmFwaGljQ29udmVydGVyNV1I7gAAAC1JREFUeJxi+A8EDCDM8B9KgjFcGM7HL4xAuIQZIDYQqZp4YRR3AwAAAP//AwAHsYCAeG3GhgAAAABJRU5ErkJggg==';

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
        <object data="${UKAIRTAGS_PNG}" type="image/png" width="206" height="280">UK airport map</object>
        <gapImg identifier="CBG" matchMax="1">
          <object data="${CBG_PNG}" type="image/png" width="25" height="11">CBG tag</object>
        </gapImg>
        <gapImg identifier="EBG" matchMax="1">
          <object data="${EBG_PNG}" type="image/png" width="25" height="11">EBG tag</object>
        </gapImg>
        <gapImg identifier="EDI" matchMax="1">
          <object data="${EDI_PNG}" type="image/png" width="25" height="11">EDI tag</object>
        </gapImg>
        <gapImg identifier="GLA" matchMax="1">
          <object data="${GLA_PNG}" type="image/png" width="25" height="11">GLA tag</object>
        </gapImg>
        <gapImg identifier="MAN" matchMax="1">
          <object data="${MAN_PNG}" type="image/png" width="25" height="11">MAN tag</object>
        </gapImg>
        <gapImg identifier="MCH" matchMax="1">
          <object data="${MCH_PNG}" type="image/png" width="25" height="11">MCH tag</object>
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
      <object type="image/png" data="${UKAIRTAGS_PNG}" width="206" height="280">UK airport map</object>
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
      <object data="${UKAIR_PNG}" height="280" width="206" type="image/png">UK Map</object>
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
      <object data="${UKAIR_PNG}" height="280" width="206" type="image/png">UK Map</object>
      <hotspotChoice coords="77,115,10" identifier="A" shape="circle"/>
      <hotspotChoice coords="118,184,10" identifier="B" shape="circle"/>
      <hotspotChoice coords="150,235,10" identifier="C" shape="circle"/>
      <hotspotChoice coords="96,114,10" identifier="D" shape="circle"/>
    </hotspotInteraction>
  </itemBody>
  <responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
</assessmentItem>`;

// Q10-D2: Polygon shapes hotspot — plant diagram (simplified inline SVG replaces 483 KB plants.svg)
// Correct answer: i4 (rhizome, underground portion)
//
// SVG uses the SAME 680×680 coordinate space as the original conformance item so that
// the hotspot polygons from the original XML align exactly with the visual elements:
//   i1 lily pad polygon centroid: ~(215, 164) — floating on water surface
//   i2 leaf triangle centroid:    ~(350, 121) — stem leaf above water
//   i3 bud circle:                 (379,  80) — flower bud at top
//   i4 rhizome triangle centroid: ~(297, 538) — horizontal stem in lake bed
//
// Water lily anatomy: rhizome buried in lake bed → stem rises through water → pads float
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
      <object type="image/svg+xml" width="680" height="680">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 680">
          <!-- Sky: y=0–200 -->
          <rect width="680" height="200" fill="#87CEEB"/>
          <!-- Water: y=200–580 -->
          <rect y="200" width="680" height="380" fill="#4A90E2" opacity="0.55"/>
          <!-- Lake bed / mud: y=580–680 -->
          <rect y="580" width="680" height="100" fill="#8B6914"/>

          <!-- Water surface shimmer -->
          <line x1="0" y1="200" x2="680" y2="200" stroke="#1a6bb5" stroke-width="3" opacity="0.6"/>

          <!-- Stem from rhizome (297,538) up to water surface then to lily pad -->
          <path d="M 297,538 Q 260,380 215,200 L 215,164" stroke="#4a7c3f" stroke-width="10" fill="none" stroke-linecap="round"/>

          <!-- Secondary stem to leaf (i2) and bud (i3) -->
          <path d="M 240,140 Q 300,130 350,121" stroke="#4a7c3f" stroke-width="7" fill="none"/>
          <path d="M 350,121 Q 365,100 379,80" stroke="#4a7c3f" stroke-width="6" fill="none"/>

          <!-- i1: Lily pad — large ellipse matching polygon centroid ~(215, 164) -->
          <ellipse cx="215" cy="164" rx="72" ry="28" fill="#5ab85a" stroke="#2d7a2d" stroke-width="3"/>
          <!-- Pad notch (characteristic V-cut) -->
          <path d="M 215,136 L 215,164" stroke="#2d7a2d" stroke-width="2"/>
          <text x="215" y="158" text-anchor="middle" font-size="18" font-weight="bold" fill="#fff">i1: Pad</text>

          <!-- i2: Leaf — small oval near triangle centroid ~(350, 121) -->
          <ellipse cx="350" cy="121" rx="28" ry="14" fill="#5ab85a" stroke="#2d7a2d" stroke-width="2" transform="rotate(-20,350,121)"/>
          <text x="365" y="110" font-size="16" font-weight="bold" fill="#1a4a1a">i2: Leaf</text>

          <!-- i3: Bud — circle at (379, 80) radius 14 in original -->
          <circle cx="379" cy="80" r="22" fill="#FFD700" stroke="#e6ac00" stroke-width="3"/>
          <!-- Petals suggestion -->
          <circle cx="379" cy="58" r="8" fill="#FF8C00" opacity="0.8"/>
          <circle cx="397" cy="68" r="8" fill="#FF8C00" opacity="0.8"/>
          <text x="410" y="75" font-size="16" font-weight="bold" fill="#7a4f00">i3: Bud</text>

          <!-- i4: Rhizome — horizontal stem in lake bed, centroid ~(297, 538) -->
          <rect x="194" y="518" width="166" height="40" rx="20" fill="#8B5E2A" stroke="#4a2e0a" stroke-width="3"/>
          <!-- Root hairs from rhizome -->
          <line x1="220" y1="558" x2="212" y2="610" stroke="#5c3b18" stroke-width="3"/>
          <line x1="250" y1="560" x2="245" y2="615" stroke="#5c3b18" stroke-width="3"/>
          <line x1="280" y1="560" x2="280" y2="618" stroke="#5c3b18" stroke-width="3"/>
          <line x1="310" y1="560" x2="315" y2="615" stroke="#5c3b18" stroke-width="3"/>
          <line x1="340" y1="558" x2="348" y2="610" stroke="#5c3b18" stroke-width="3"/>
          <text x="297" y="543" text-anchor="middle" font-size="18" font-weight="bold" fill="#fff">i4: Rhizome ✓</text>

          <!-- Zone labels -->
          <text x="20" y="30" font-size="14" fill="#1a3a6e">Sky</text>
          <text x="20" y="230" font-size="14" fill="#fff" opacity="0.9">Water</text>
          <text x="20" y="610" font-size="14" fill="#f5deb3">Lake bed</text>

          <!-- Title -->
          <text x="340" y="645" text-anchor="middle" font-size="20" font-weight="bold" fill="#f5deb3">Water Lily — Click the Rhizome</text>
          <text x="340" y="668" text-anchor="middle" font-size="13" fill="#c4a97a">(Simplified diagram; original: plants.svg)</text>
        </svg>
      </object>
      <!-- Original conformance hotspot coordinates — aligned to 680×680 SVG above -->
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
    description: 'Q11-D1: Select the single grammar error in the sentence (correct: "includes" → B).',
    xml: Q11_HOTTEXT_SINGLE.trim(),
  },
  {
    id: 'conf-q11-hottext-multiple',
    title: '[CONF] Q11 Hot-text - Multiple Cardinality',
    description: 'Q11-D2: Select both grammar errors ("whom bought" A, "includes" B). maxChoices=2.',
    xml: Q11_HOTTEXT_MULTIPLE.trim(),
  },
];
