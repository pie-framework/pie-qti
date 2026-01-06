/**
 * Manifest Generation Integration Tests
 *
 * Tests IMS Content Package manifest generation through the plugin
 */

import { describe, expect, test } from 'bun:test';
import type { PieItem, PiePassageStimulus, TransformContext } from '@pie-qti/transform-types';
import { PieToQti2Plugin } from '../../src/plugin.js';

describe('Manifest Integration', () => {
  const mockLogger = {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  };
  const context: TransformContext = { logger: mockLogger };

  test('should generate manifest when generatePackage=true and external passage present', async () => {
    const pieItem: PieItem = {
      id: 'item-with-passage',
      uuid: 'uuid-123',
      passage: 'passage-external-1', // External passage reference
      config: {
        id: 'uuid-123',
        models: [
          {
            id: 'mc-1',
            element: '@pie-element/multiple-choice',
            prompt: 'Based on the passage, what is the answer?',
            choiceMode: 'radio',
            choices: [
              { label: 'Choice A', value: 'a', correct: true },
              { label: 'Choice B', value: 'b', correct: false },
            ],
          },
        ],
        elements: {
          '@pie-element/multiple-choice': '1.0.0',
        },
      },
    };

    const passageStimulus: PiePassageStimulus = {
      id: 'passage-external-1',
      uuid: 'passage-uuid-1',
      content: '<p>This is the passage content.</p>',
      title: 'Test Passage',
    };

    const plugin = new PieToQti2Plugin({
      generatePackage: true,
      passageStrategy: 'external',
      passageResolver: async (passageId) => ({
        id: passageId,
        content: passageStimulus.content,
        title: passageStimulus.title,
      }),
    });

    const result = await plugin.transform({ content: pieItem }, context);

    // Should have manifest in output
    expect((result as any).manifest).toBeTruthy();
    expect(typeof (result as any).manifest).toBe('string');

    const manifestXml = (result as any).manifest;

    // Should have XML declaration
    expect(manifestXml).toContain('<?xml version="1.0" encoding="UTF-8"?>');

    // Should have manifest root with namespaces
    expect(manifestXml).toContain('<manifest');
    expect(manifestXml).toContain('xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"');

    // Should have package ID
    expect(manifestXml).toContain('identifier="pkg-item-with-passage"');

    // Should have resources section
    expect(manifestXml).toContain('<resources>');

    // Should have passage resource
    expect(manifestXml).toContain('identifier="passage-external-1"');
    expect(manifestXml).toContain('type="imsqti_item_xmlv2p2"');

    // Should have item resource
    expect(manifestXml).toContain('identifier="item-with-passage"');

    // Should have dependency declaration
    expect(manifestXml).toContain('<dependency identifierref="passage-external-1"/>');
  });

  test('should use baseId in manifest when present', async () => {
    const pieItem: PieItem = {
      id: 'internal-id-123',
      baseId: 'stable-public-id',
      uuid: 'uuid-123',
      passage: 'passage-stable',
      config: {
        id: 'uuid-123',
        models: [
          {
            id: 'mc-1',
            element: '@pie-element/multiple-choice',
            prompt: 'Question?',
            choiceMode: 'radio',
            choices: [{ label: 'A', value: 'a', correct: true }],
          },
        ],
        elements: {
          '@pie-element/multiple-choice': '1.0.0',
        },
      },
    };

    const plugin = new PieToQti2Plugin({
      generatePackage: true,
      passageStrategy: 'external',
      passageResolver: async (passageId) => ({
        id: passageId,
        baseId: 'passage-stable-base',
        content: '<p>Content</p>',
      }),
    });

    const result = await plugin.transform({ content: pieItem }, context);

    const manifestXml = (result as any).manifest;

    // Should use baseId for package and item
    expect(manifestXml).toContain('identifier="pkg-stable-public-id"');
    expect(manifestXml).toContain('identifier="stable-public-id"');
    expect(manifestXml).toContain('href="items/stable-public-id.xml"');
  });

  test('should NOT generate manifest when generatePackage=false', async () => {
    const pieItem: PieItem = {
      id: 'item-1',
      uuid: 'uuid-1',
      passage: 'passage-1',
      config: {
        id: 'uuid-1',
        models: [
          {
            id: 'mc-1',
            element: '@pie-element/multiple-choice',
            prompt: 'Q?',
            choiceMode: 'radio',
            choices: [{ label: 'A', value: 'a', correct: true }],
          },
        ],
        elements: {
          '@pie-element/multiple-choice': '1.0.0',
        },
      },
    };

    const plugin = new PieToQti2Plugin({
      generatePackage: false, // Explicitly disabled
      passageStrategy: 'external',
      passageResolver: async (passageId) => ({
        id: passageId,
        content: '<p>Content</p>',
      }),
    });

    const result = await plugin.transform({ content: pieItem }, context);

    // Should NOT have manifest
    expect((result as any).manifest).toBeUndefined();
  });

  test('should NOT generate manifest when no external passages', async () => {
    // Item with inline passage (in config.models) - no external passage
    const pieItem: PieItem = {
      id: 'item-inline',
      uuid: 'uuid-inline',
      config: {
        id: 'uuid-inline',
        models: [
          {
            id: 'passage-inline',
            element: '@pie-element/passage',
            passages: [
              {
                title: 'Inline Passage',
                text: '<p>Inline content</p>',
              },
            ],
          },
          {
            id: 'mc-1',
            element: '@pie-element/multiple-choice',
            prompt: 'Q?',
            choiceMode: 'radio',
            choices: [{ label: 'A', value: 'a', correct: true }],
          },
        ],
        elements: {
          '@pie-element/passage': '1.0.0',
          '@pie-element/multiple-choice': '1.0.0',
        },
      },
    };

    const plugin = new PieToQti2Plugin({
      generatePackage: true, // Enabled, but no external passages
    });

    const result = await plugin.transform({ content: pieItem }, context);

    // Should NOT have manifest (no external passages generated)
    expect((result as any).manifest).toBeUndefined();
  });

  test('should include passage files in output when external passages generated', async () => {
    const pieItem: PieItem = {
      id: 'item-files',
      uuid: 'uuid-files',
      passage: 'passage-ext',
      config: {
        id: 'uuid-files',
        models: [
          {
            id: 'mc-1',
            element: '@pie-element/multiple-choice',
            prompt: 'Q?',
            choiceMode: 'radio',
            choices: [{ label: 'A', value: 'a', correct: true }],
          },
        ],
        elements: {
          '@pie-element/multiple-choice': '1.0.0',
        },
      },
    };

    const plugin = new PieToQti2Plugin({
      generatePackage: true,
      passageStrategy: 'external',
      passageResolver: async (passageId) => ({
        id: passageId,
        content: '<p>Passage content</p>',
        title: 'Test',
      }),
    });

    const result = await plugin.transform({ content: pieItem }, context);

    // Should have passage files
    expect((result as any).passageFiles).toBeTruthy();
    expect(Array.isArray((result as any).passageFiles)).toBe(true);
    expect((result as any).passageFiles.length).toBe(1);

    const passageFile = (result as any).passageFiles[0];
    expect(passageFile.id).toBe('passage-ext');
    expect(passageFile.filePath).toBe('passages/passage-ext.xml');
    expect(passageFile.xml).toContain('<assessmentItem');
    expect(passageFile.xml).toContain('identifier="passage-ext"');
  });

  test('should include manifest with multiple passages', async () => {
    // Future enhancement: Multiple passages per item
    // For now, test with single passage but verify structure supports multiple
    const pieItem: PieItem = {
      id: 'item-multi',
      uuid: 'uuid-multi',
      passage: 'passage-1',
      config: {
        id: 'uuid-multi',
        models: [
          {
            id: 'mc-1',
            element: '@pie-element/multiple-choice',
            prompt: 'Q?',
            choiceMode: 'radio',
            choices: [{ label: 'A', value: 'a', correct: true }],
          },
        ],
        elements: {
          '@pie-element/multiple-choice': '1.0.0',
        },
      },
    };

    const plugin = new PieToQti2Plugin({
      generatePackage: true,
      passageStrategy: 'external',
      passageResolver: async (passageId) => ({
        id: passageId,
        content: '<p>Content</p>',
      }),
    });

    const result = await plugin.transform({ content: pieItem }, context);

    const manifestXml = (result as any).manifest;

    // Manifest should have proper structure for dependencies
    // Note: IMS CP places <dependency> directly in <resource>, not wrapped in <dependencies>
    expect(manifestXml).toContain('<dependency identifierref="passage-1"/>');
  });

  test('should handle item without passage gracefully', async () => {
    const pieItem: PieItem = {
      id: 'item-no-passage',
      uuid: 'uuid-np',
      config: {
        id: 'uuid-np',
        models: [
          {
            id: 'mc-1',
            element: '@pie-element/multiple-choice',
            prompt: 'What is 2+2?',
            choiceMode: 'radio',
            choices: [
              { label: '3', value: 'a', correct: false },
              { label: '4', value: 'b', correct: true },
            ],
          },
        ],
        elements: {
          '@pie-element/multiple-choice': '1.0.0',
        },
      },
    };

    const plugin = new PieToQti2Plugin({
      generatePackage: true, // Enabled but item has no passages
    });

    const result = await plugin.transform({ content: pieItem }, context);

    // Should complete without error
    expect(result.items.length).toBe(1);
    expect(result.format).toBe('qti22');

    // Should NOT have manifest (no passages)
    expect((result as any).manifest).toBeUndefined();

    // Should NOT have passage files
    expect((result as any).passageFiles).toBeUndefined();
  });

  test('should use correct file paths in manifest', async () => {
    const pieItem: PieItem = {
      id: 'item-paths',
      uuid: 'uuid-paths',
      passage: 'passage-test',
      config: {
        id: 'uuid-paths',
        models: [
          {
            id: 'mc-1',
            element: '@pie-element/multiple-choice',
            prompt: 'Q?',
            choiceMode: 'radio',
            choices: [{ label: 'A', value: 'a', correct: true }],
          },
        ],
        elements: {
          '@pie-element/multiple-choice': '1.0.0',
        },
      },
    };

    const plugin = new PieToQti2Plugin({
      generatePackage: true,
      passageStrategy: 'external',
      passageResolver: async (passageId) => ({
        id: passageId,
        content: '<p>Content</p>',
      }),
    });

    const result = await plugin.transform({ content: pieItem }, context);

    const manifestXml = (result as any).manifest;

    // Item should reference items/ directory
    expect(manifestXml).toContain('href="items/item-paths.xml"');

    // Passage should reference passages/ directory
    expect(manifestXml).toContain('href="passages/passage-test.xml"');

    // File declarations should match
    expect(manifestXml).toContain('<file href="items/item-paths.xml"/>');
    expect(manifestXml).toContain('<file href="passages/passage-test.xml"/>');
  });
});
