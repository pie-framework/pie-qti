/**
 * Hotspot Transformer Tests
 */

import { describe, expect, test } from 'bun:test';

import { transformHotspot } from '../../src/transformers/hotspot.js';
import { createQtiWrapper, createResponseDeclaration } from '../test-utils.js';

describe('transformHotspot', () => {
  test('should transform basic QTI hotspotInteraction with rectangle to PIE hotspot', () => {
    const qtiXml = createQtiWrapper(`
      ${createResponseDeclaration('RESPONSE', 'single', ['hotspot1'])}
      <itemBody>
        <p>Click on the correct region:</p>
        <hotspotInteraction responseIdentifier="RESPONSE">
          <img src="diagram.png" width="400" height="300"/>
          <hotspotChoice shape="rect" coords="50,50,150,150" identifier="hotspot1"/>
          <hotspotChoice shape="rect" coords="200,100,300,200" identifier="hotspot2"/>
        </hotspotInteraction>
      </itemBody>
    `);

    const result = transformHotspot(qtiXml, 'hs-001');

    expect(result.id).toBe('hs-001');
    expect(result.uuid).toBeDefined();
    expect(result.config.models).toHaveLength(1);

    const model = result.config.models[0];
    expect(model.element).toBe('@pie-element/hotspot');
    expect(model.prompt).toContain('Click on the correct region');
    expect(model.imageUrl).toBe('diagram.png');
    expect(model.multipleCorrect).toBe(false);
    expect(model.dimensions).toEqual({ width: 400, height: 300 });

    // Check rectangles
    expect(model.shapes.rectangles).toHaveLength(2);
    expect(model.shapes.rectangles[0]).toEqual({
      id: 'hotspot1',
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      correct: true,
    });
    expect(model.shapes.rectangles[1]).toEqual({
      id: 'hotspot2',
      x: 200,
      y: 100,
      width: 100,
      height: 100,
      correct: false,
    });

    expect(result.metadata?.searchMetaData?.itemType).toBe('HS');
  });

  test('should handle polygon hotspots', () => {
    const qtiXml = createQtiWrapper(`
      ${createResponseDeclaration('RESPONSE', 'single', ['poly1'])}
      <itemBody>
        <hotspotInteraction responseIdentifier="RESPONSE">
          <img src="map.png" width="500" height="400"/>
          <hotspotChoice shape="poly" coords="100,50,200,50,150,150" identifier="poly1"/>
          <hotspotChoice shape="poly" coords="250,100,350,100,300,200" identifier="poly2"/>
        </hotspotInteraction>
      </itemBody>
    `);

    const result = transformHotspot(qtiXml, 'hs-002');
    const model = result.config.models[0];

    expect(model.shapes.polygons).toHaveLength(2);
    expect(model.shapes.polygons[0]).toEqual({
      id: 'poly1',
      points: [
        { x: 100, y: 50 },
        { x: 200, y: 50 },
        { x: 150, y: 150 },
      ],
      correct: true,
    });
    expect(model.shapes.polygons[1].correct).toBe(false);
  });

  test('should handle multiple correct hotspots (maxChoices)', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="identifier">
          <correctResponse>
            <value>A</value>
            <value>B</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <hotspotInteraction responseIdentifier="RESPONSE" maxChoices="2">
            <img src="image.png" width="600" height="400"/>
            <hotspotChoice shape="rect" coords="0,0,100,100" identifier="A"/>
            <hotspotChoice shape="rect" coords="200,0,300,100" identifier="B"/>
            <hotspotChoice shape="rect" coords="400,0,500,100" identifier="C"/>
          </hotspotInteraction>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformHotspot(qtiXml, 'hs-003');
    const model = result.config.models[0];

    expect(model.multipleCorrect).toBe(true);
    expect(model.shapes.rectangles[0].correct).toBe(true);
    expect(model.shapes.rectangles[1].correct).toBe(true);
    expect(model.shapes.rectangles[2].correct).toBe(false);
  });

  test('should handle circle hotspots (converted to polygons)', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
          <correctResponse>
            <value>circle1</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <hotspotInteraction responseIdentifier="RESPONSE">
            <img src="target.png" width="400" height="400"/>
            <hotspotChoice shape="circle" coords="200,200,50" identifier="circle1"/>
          </hotspotInteraction>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformHotspot(qtiXml, 'hs-004');
    const model = result.config.models[0];

    // Circle should be converted to polygon with 16 points
    expect(model.shapes.polygons).toHaveLength(1);
    expect(model.shapes.polygons[0].id).toBe('circle1');
    expect(model.shapes.polygons[0].points.length).toBe(16);
    expect(model.shapes.polygons[0].correct).toBe(true);

    // Check that points approximate a circle
    const points = model.shapes.polygons[0].points;
    expect(points[0].x).toBeCloseTo(250, 0); // Right point (200+50)
    expect(points[4].x).toBeCloseTo(200, 0); // Bottom point
  });

  test('should handle prompt inside interaction', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
          <correctResponse>
            <value>A</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <hotspotInteraction responseIdentifier="RESPONSE">
            <prompt>Select the correct area on the image.</prompt>
            <img src="image.png" width="300" height="200"/>
            <hotspotChoice shape="rect" coords="0,0,100,100" identifier="A"/>
          </hotspotInteraction>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformHotspot(qtiXml, 'hs-005');
    const model = result.config.models[0];

    expect(model.prompt).toBe('Select the correct area on the image.');
  });

  test('should handle prompt before interaction', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
          <correctResponse>
            <value>A</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <p>Study the diagram carefully.</p>
          <p>Click on the highlighted region.</p>
          <hotspotInteraction responseIdentifier="RESPONSE">
            <img src="image.png" width="300" height="200"/>
            <hotspotChoice shape="rect" coords="0,0,100,100" identifier="A"/>
          </hotspotInteraction>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformHotspot(qtiXml, 'hs-006');
    const model = result.config.models[0];

    expect(model.prompt).toContain('Study the diagram');
    expect(model.prompt).toContain('highlighted region');
  });

  test('should clamp coordinates to image bounds', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
          <correctResponse>
            <value>A</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <hotspotInteraction responseIdentifier="RESPONSE">
            <img src="image.png" width="100" height="100"/>
            <hotspotChoice shape="rect" coords="-10,-10,150,150" identifier="A"/>
            <hotspotChoice shape="poly" coords="-5,50,50,-5,105,50,50,105" identifier="B"/>
          </hotspotInteraction>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformHotspot(qtiXml, 'hs-007');
    const model = result.config.models[0];

    // Rectangle should be clamped
    const rect = model.shapes.rectangles[0];
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(100);
    expect(rect.y + rect.height).toBeLessThanOrEqual(100);

    // Polygon points should be clamped
    const poly = model.shapes.polygons[0];
    for (const point of poly.points) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(100);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(100);
    }
  });

  test('should support options', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
          <correctResponse>
            <value>A</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <hotspotInteraction responseIdentifier="RESPONSE">
            <img src="image.png" width="300" height="200"/>
            <hotspotChoice shape="rect" coords="0,0,100,100" identifier="A"/>
          </hotspotInteraction>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformHotspot(qtiXml, 'hs-008', {
      partialScoring: true,
      multipleCorrect: true,
      hotspotColor: 'rgba(255, 0, 0, 0.5)',
      outlineColor: 'red',
    });

    const model = result.config.models[0];
    expect(model.partialScoring).toBe(true);
    expect(model.multipleCorrect).toBe(true);
    expect(model.hotspotColor).toBe('rgba(255, 0, 0, 0.5)');
    expect(model.outlineColor).toBe('red');
  });

  test('should throw error if no itemBody found', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
          <correctResponse>
            <value>A</value>
          </correctResponse>
        </responseDeclaration>
      </assessmentItem>
    `;

    expect(() => transformHotspot(qtiXml, 'hs-009')).toThrow(/Missing required element: itemBody/);
  });

  test('should throw error if no hotspotInteraction found', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
          <correctResponse>
            <value>A</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <p>No interaction here</p>
        </itemBody>
      </assessmentItem>
    `;

    expect(() => transformHotspot(qtiXml, 'hs-010')).toThrow(/Missing required interaction: hotspotInteraction/);
  });

  test('should throw error if no image found', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
          <correctResponse>
            <value>A</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <hotspotInteraction responseIdentifier="RESPONSE">
            <hotspotChoice shape="rect" coords="0,0,100,100" identifier="A"/>
          </hotspotInteraction>
        </itemBody>
      </assessmentItem>
    `;

    expect(() => transformHotspot(qtiXml, 'hs-011')).toThrow(/Missing required image in hotspotInteraction/);
  });

  test('should throw error if dimensions cannot be determined', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
          <correctResponse>
            <value>A</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <hotspotInteraction responseIdentifier="RESPONSE">
            <img src="image.png"/>
            <hotspotChoice shape="rect" coords="0,0,100,100" identifier="A"/>
          </hotspotInteraction>
        </itemBody>
      </assessmentItem>
    `;

    expect(() => transformHotspot(qtiXml, 'hs-012')).toThrow(/Cannot determine image dimensions/);
  });

  test('should handle mixed shape types', () => {
    const qtiXml = `
      <assessmentItem>
        <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="identifier">
          <correctResponse>
            <value>rect1</value>
            <value>poly1</value>
            <value>circle1</value>
          </correctResponse>
        </responseDeclaration>
        <itemBody>
          <hotspotInteraction responseIdentifier="RESPONSE" maxChoices="3">
            <img src="complex.png" width="600" height="400"/>
            <hotspotChoice shape="rect" coords="0,0,100,100" identifier="rect1"/>
            <hotspotChoice shape="poly" coords="200,0,300,0,250,100" identifier="poly1"/>
            <hotspotChoice shape="circle" coords="450,200,50" identifier="circle1"/>
            <hotspotChoice shape="rect" coords="100,300,200,400" identifier="rect2"/>
          </hotspotInteraction>
        </itemBody>
      </assessmentItem>
    `;

    const result = transformHotspot(qtiXml, 'hs-013');
    const model = result.config.models[0];

    expect(model.shapes.rectangles).toHaveLength(2);
    expect(model.shapes.polygons).toHaveLength(2); // poly + circle converted to poly
    expect(model.shapes.rectangles[0].correct).toBe(true);
    expect(model.shapes.rectangles[1].correct).toBe(false);
    expect(model.shapes.polygons[0].correct).toBe(true);
    expect(model.shapes.polygons[1].correct).toBe(true);
  });
});
