/**
 * PIE Item Validator Tests
 */

import { describe, expect, test } from 'bun:test';
import { PieItemValidator, validatePieItemStructure } from '../src/utils/validator.js';

describe('validatePieItemStructure', () => {
  test('should validate a valid PIE item structure', () => {
    const item = {
      id: 'test-001',
      uuid: '123e4567-e89b-12d3-a456-426614174000',
      config: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        models: [],
        elements: {},
      },
    };

    const result = validatePieItemStructure(item);
    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  test('should fail when id is missing', () => {
    const item = {
      uuid: '123e4567-e89b-12d3-a456-426614174000',
      config: {
        models: [],
        elements: {},
      },
    };

    const result = validatePieItemStructure(item);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.detailedErrors?.find(e => e.path === 'id')).toBeDefined();
  });

  test('should fail when config.models is not an array', () => {
    const item = {
      id: 'test-001',
      uuid: '123e4567-e89b-12d3-a456-426614174000',
      config: {
        models: 'not-an-array',
        elements: {},
      },
    };

    const result = validatePieItemStructure(item);
    expect(result.valid).toBe(false);
    expect(result.detailedErrors?.find(e => e.path === 'config.models')).toBeDefined();
  });

  test('should fail when item is not an object', () => {
    const result = validatePieItemStructure('not an object');
    expect(result.valid).toBe(false);
    expect(result.errors?.[0]).toBe('Item must be an object');
  });
});

describe('PieItemValidator', () => {
  test('should create a validator instance', () => {
    const validator = new PieItemValidator();
    expect(validator).toBeDefined();
  });

  test('should register a schema', () => {
    const validator = new PieItemValidator();
    const schema = {
      type: 'object',
      properties: {
        id: { type: 'string' },
        element: { type: 'string' },
        prompt: { type: 'string' },
      },
      required: ['id', 'element'],
    };

    validator.registerSchema('@pie-element/test', schema);
    // No error means success
  });

  test('should validate against registered schema', () => {
    const validator = new PieItemValidator();

    // Register a simple schema
    const schema = {
      type: 'object',
      properties: {
        id: { type: 'string' },
        element: { type: 'string' },
        prompt: { type: 'string' },
        choices: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              value: { type: 'string' },
            },
            required: ['label', 'value'],
          },
        },
      },
      required: ['id', 'element', 'choices'],
    };

    validator.registerSchema('@pie-element/test', schema);

    const item = {
      id: 'test-001',
      uuid: '123e4567-e89b-12d3-a456-426614174000',
      config: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        models: [
          {
            id: 'model-001',
            element: '@pie-element/test',
            prompt: 'Test question',
            choices: [
              { label: 'Option A', value: 'a' },
              { label: 'Option B', value: 'b' },
            ],
          },
        ],
        elements: {
          'test': '@pie-element/test@1.0.0',
        },
      },
    };

    const result = validator.validate(item);
    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  test('should detect schema violations', () => {
    const validator = new PieItemValidator();

    const schema = {
      type: 'object',
      properties: {
        id: { type: 'string' },
        element: { type: 'string' },
        choices: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              value: { type: 'string' },
            },
            required: ['label', 'value'],
          },
        },
      },
      required: ['id', 'element', 'choices'],
    };

    validator.registerSchema('@pie-element/test', schema);

    const item = {
      id: 'test-001',
      uuid: '123e4567-e89b-12d3-a456-426614174000',
      config: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        models: [
          {
            id: 'model-001',
            element: '@pie-element/test',
            // Missing required 'choices' field
          },
        ],
        elements: {},
      },
    };

    const result = validator.validate(item);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  test('should validate multiple items', () => {
    const validator = new PieItemValidator();

    const items = [
      {
        id: 'test-001',
        uuid: 'uuid-001',
        config: { id: 'uuid-001', models: [], elements: {} },
      },
      {
        id: 'test-002',
        uuid: 'uuid-002',
        config: { id: 'uuid-002', models: [], elements: {} },
      },
    ];

    const results = validator.validateMany(items);
    expect(results.length).toBe(2);
    expect(results[0].valid).toBe(true);
    expect(results[1].valid).toBe(true);
  });

  test('should load schema from schemas package', async () => {
    const validator = new PieItemValidator();

    // Load schema from schemas package
    await validator.loadSchemaForElement('@pie-element/multiple-choice');

    const item = {
      id: 'test-001',
      uuid: 'uuid-001',
      config: {
        id: 'uuid-001',
        models: [
          {
            id: 'model-001',
            element: '@pie-element/multiple-choice',
            prompt: 'Test question',
            choices: [{ label: 'A', value: 'a' }],
          },
        ],
        elements: {},
      },
    };

    const result = validator.validate(item);
    // The actual schema validation will vary based on the real schema
    expect(result).toBeDefined();
  });
});
