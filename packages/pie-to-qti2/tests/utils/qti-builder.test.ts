/**
 * QTI Builder Tests
 */

import { describe, expect, test } from 'bun:test';
import { escapeXml, QtiBuilder, unescapeXml } from '../../src/utils/qti-builder.js';

describe('QtiBuilder', () => {
  describe('escapeXml', () => {
    test('escapes special XML characters', () => {
      expect(escapeXml('Hello & goodbye')).toBe('Hello &amp; goodbye');
      expect(escapeXml('<tag>')).toBe('&lt;tag&gt;');
      expect(escapeXml('"quoted"')).toBe('&quot;quoted&quot;');
      expect(escapeXml("'single'")).toBe('&apos;single&apos;');
    });

    test('handles multiple special characters', () => {
      expect(escapeXml('<tag attr="value" & more>')).toBe(
        '&lt;tag attr=&quot;value&quot; &amp; more&gt;'
      );
    });
  });

  describe('unescapeXml', () => {
    test('unescapes XML entities', () => {
      expect(unescapeXml('Hello &amp; goodbye')).toBe('Hello & goodbye');
      expect(unescapeXml('&lt;tag&gt;')).toBe('<tag>');
      expect(unescapeXml('&quot;quoted&quot;')).toBe('"quoted"');
      expect(unescapeXml('&apos;single&apos;')).toBe("'single'");
    });

    test('round-trips correctly', () => {
      const original = '<tag attr="value" & more>';
      const escaped = escapeXml(original);
      const unescaped = unescapeXml(escaped);
      expect(unescaped).toBe(original);
    });
  });

  describe('createSimpleChoice', () => {
    test('creates a simple choice element', () => {
      const choice = QtiBuilder.createSimpleChoice('choice-1', 'Option A');
      expect(choice).toContain('identifier="choice-1"');
      expect(choice).toContain('Option A');
      expect(choice).toContain('<simpleChoice');
      expect(choice).toContain('</simpleChoice>');
    });

    test('creates a fixed choice', () => {
      const choice = QtiBuilder.createSimpleChoice('choice-1', 'Option A', true);
      expect(choice).toContain('fixed="true"');
    });

    test('preserves HTML content', () => {
      const choice = QtiBuilder.createSimpleChoice('choice-1', '<b>Bold & italic</b>');
      expect(choice).toContain('<b>Bold & italic</b>');
    });
  });

  describe('createPrompt', () => {
    test('creates a prompt element', () => {
      const prompt = QtiBuilder.createPrompt('What is 2 + 2?');
      expect(prompt).toBe('<prompt>What is 2 + 2?</prompt>');
    });

    test('preserves HTML in prompt', () => {
      const prompt = QtiBuilder.createPrompt('<p>Question text</p>');
      expect(prompt).toBe('<prompt><p>Question text</p></prompt>');
    });
  });

  describe('createDiv', () => {
    test('creates a div without class', () => {
      const div = QtiBuilder.createDiv('Content here');
      expect(div).toBe('<div>Content here</div>');
    });

    test('creates a div with class', () => {
      const div = QtiBuilder.createDiv('Content here', 'my-class');
      expect(div).toBe('<div class="my-class">Content here</div>');
    });

    test('escapes class name', () => {
      const div = QtiBuilder.createDiv('Content', 'class"with"quotes');
      expect(div).toBe('<div class="class&quot;with&quot;quotes">Content</div>');
    });
  });

  describe('createAssessmentItem', () => {
    test('creates a basic assessment item', () => {
      const item = QtiBuilder.createAssessmentItem(
        'item-1',
        ['<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>'],
        '<choiceInteraction responseIdentifier="RESPONSE"/>'
      );

      expect(item).toContain('<?xml version="1.0"');
      expect(item).toContain('<assessmentItem');
      expect(item).toContain('identifier="item-1"');
      expect(item).toContain('xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"');
      expect(item).toContain('<responseDeclaration');
      expect(item).toContain('<itemBody>');
      expect(item).toContain('</assessmentItem>');
    });

    test('includes title and label', () => {
      const item = QtiBuilder.createAssessmentItem(
        'item-1',
        [],
        '',
        { title: 'Test Item', label: 'Q1' }
      );

      expect(item).toContain('title="Test Item"');
      expect(item).toContain('label="Q1"');
    });

    test('includes PIE element comment', () => {
      const item = QtiBuilder.createAssessmentItem(
        'item-1',
        [],
        '',
        { pieElement: '@pie-element/multiple-choice' }
      );

      expect(item).toContain('<!-- Generated from @pie-element/multiple-choice -->');
    });
  });

  describe('createCustomInteraction', () => {
    test('creates a custom interaction', () => {
      const model = { some: 'data' };
      const interaction = QtiBuilder.createCustomInteraction(
        'RESPONSE',
        'pie-calculator',
        model
      );

      expect(interaction).toContain('<customInteraction');
      expect(interaction).toContain('responseIdentifier="RESPONSE"');
      expect(interaction).toContain('type="pie-calculator"');
      expect(interaction).toContain('data-pie-model=');
      expect(interaction).toContain('&quot;some&quot;');
      expect(interaction).toContain('&quot;data&quot;');
    });
  });

  describe('createInteraction', () => {
    test('creates an interaction with attributes', () => {
      const interaction = QtiBuilder.createInteraction(
        'choiceInteraction',
        'RESPONSE',
        { shuffle: 'true', maxChoices: '1' },
        '<simpleChoice identifier="A">Option A</simpleChoice>'
      );

      expect(interaction).toContain('<choiceInteraction');
      expect(interaction).toContain('responseIdentifier="RESPONSE"');
      expect(interaction).toContain('shuffle="true"');
      expect(interaction).toContain('maxChoices="1"');
      expect(interaction).toContain('<simpleChoice');
      expect(interaction).toContain('</choiceInteraction>');
    });

    test('adds data-pie attributes', () => {
      const interaction = QtiBuilder.createInteraction(
        'choiceInteraction',
        'RESPONSE',
        { shuffle: 'true' },
        '',
        { feedback: { correct: 'Great!' } }
      );

      expect(interaction).toContain('data-pie-feedback=');
      expect(interaction).toContain('&quot;correct&quot;');
      expect(interaction).toContain('&quot;Great!&quot;');
    });

    test('filters out null and undefined attributes', () => {
      const interaction = QtiBuilder.createInteraction(
        'choiceInteraction',
        'RESPONSE',
        { shuffle: 'true', maxChoices: undefined as any, minChoices: null as any },
        ''
      );

      expect(interaction).toContain('shuffle="true"');
      expect(interaction).not.toContain('maxChoices');
      expect(interaction).not.toContain('minChoices');
    });
  });
});
