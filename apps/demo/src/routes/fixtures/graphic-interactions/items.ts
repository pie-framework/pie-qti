/**
 * QTI 2.2 items for the graphic-interaction browser checks
 * (`tests/playwright/graphic-interactions.pw.ts`): what jsdom cannot show — real pointer hit
 * testing on SVG shapes, touch, focus order through the shadow root, and the overlay scaling
 * with its image on a small screen. Keyed by the `?item=` query parameter.
 */

/**
 * Multiple selection: maxChoices=2 bound to a multiple-cardinality response, scored by
 * map_response (the sun and the star are worth a point each, the tree costs one).
 */
const HOTSPOT_MULTIPLE = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="graphic-hotspot-multiple"
  title="Hotspot multiple selection" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="identifier">
    <correctResponse>
      <value>SUN</value>
      <value>STAR</value>
    </correctResponse>
    <mapping defaultValue="0" lowerBound="0" upperBound="2">
      <mapEntry mapKey="SUN" mappedValue="1"/>
      <mapEntry mapKey="STAR" mappedValue="1"/>
      <mapEntry mapKey="TREE" mappedValue="-1"/>
    </mapping>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
  <itemBody>
    <hotspotInteraction responseIdentifier="RESPONSE" maxChoices="2">
      <prompt>Select the two things in the sky.</prompt>
      <object type="image/svg+xml" width="400" height="200">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">
          <title>A sunny landscape with a tree and a star</title>
          <rect width="400" height="200" fill="#e0f2fe"/>
          <rect y="150" width="400" height="50" fill="#bbf7d0"/>
          <circle cx="70" cy="60" r="40" fill="#fde68a" stroke="#92400e" stroke-width="2"/>
          <rect x="160" y="80" width="80" height="110" fill="#86efac" stroke="#166534" stroke-width="2"/>
          <polygon points="330,20 360,90 300,90" fill="#fef9c3" stroke="#854d0e" stroke-width="2"/>
        </svg>
      </object>
      <hotspotChoice identifier="SUN" shape="circle" coords="70,60,40" hotspotLabel="Sun"/>
      <hotspotChoice identifier="TREE" shape="rect" coords="160,80,240,190" hotspotLabel="Tree"/>
      <hotspotChoice identifier="STAR" shape="poly" coords="330,20,360,90,300,90" hotspotLabel="Star"/>
    </hotspotInteraction>
  </itemBody>
  <responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/map_response"/>
</assessmentItem>`;

/**
 * The default shape (QTI 3.0 §8.29: "the entire area of the associated image") listed last,
 * where a naive overlay would paint it over — and take the clicks of — every other region.
 */
const HOTSPOT_DEFAULT_SHAPE = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="graphic-hotspot-default"
  title="Hotspot default shape" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>ELSEWHERE</value>
    </correctResponse>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
  <itemBody>
    <hotspotInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <prompt>Where would you build the bridge?</prompt>
      <object type="image/svg+xml" width="400" height="200">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">
          <title>A lake with an island</title>
          <rect width="400" height="200" fill="#f0fdf4"/>
          <rect x="40" y="40" width="120" height="100" fill="#bfdbfe" stroke="#1e3a8a" stroke-width="2"/>
          <circle cx="300" cy="100" r="40" fill="#d9f99d" stroke="#3f6212" stroke-width="2"/>
        </svg>
      </object>
      <hotspotChoice identifier="LAKE" shape="rect" coords="40,40,160,140" hotspotLabel="Lake"/>
      <hotspotChoice identifier="ISLAND" shape="circle" coords="300,100,40" hotspotLabel="Island"/>
      <hotspotChoice identifier="ELSEWHERE" shape="default" coords="" hotspotLabel="Somewhere else"/>
    </hotspotInteraction>
  </itemBody>
  <responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
</assessmentItem>`;

/** Graphic order: three areas the image must show, each with its place in the order. */
const GRAPHIC_ORDER_AREAS = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="graphic-order-areas"
  title="Graphic order areas" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="ordered" baseType="identifier">
    <correctResponse>
      <value>TOP</value>
      <value>MIDDLE</value>
      <value>BOTTOM</value>
    </correctResponse>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
  <itemBody>
    <graphicOrderInteraction responseIdentifier="RESPONSE">
      <prompt>Order the layers from top to bottom.</prompt>
      <object type="image/svg+xml" width="400" height="240">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240">
          <title>Three rock layers</title>
          <rect width="400" height="240" fill="#ffffff"/>
          <rect x="20" y="20" width="360" height="60" fill="#f3f4f6" stroke="#6b7280"/>
          <rect x="20" y="90" width="360" height="60" fill="#e5e7eb" stroke="#6b7280"/>
          <polygon points="20,160 380,160 200,230" fill="#d1d5db" stroke="#6b7280"/>
        </svg>
      </object>
      <hotspotChoice identifier="BOTTOM" shape="poly" coords="20,160,380,160,200,230" hotspotLabel="Granite"/>
      <hotspotChoice identifier="TOP" shape="rect" coords="20,20,380,80" hotspotLabel="Sandstone"/>
      <hotspotChoice identifier="MIDDLE" shape="rect" coords="20,90,380,150" hotspotLabel="Shale"/>
    </graphicOrderInteraction>
  </itemBody>
  <responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
</assessmentItem>`;

export const GRAPHIC_INTERACTION_FIXTURES: Readonly<Record<string, string>> = {
	'hotspot-multiple': HOTSPOT_MULTIPLE,
	'hotspot-default': HOTSPOT_DEFAULT_SHAPE,
	'graphic-order-areas': GRAPHIC_ORDER_AREAS,
};
