/**
 * Validation utilities for PIE items and QTI content
 */

import { type ElementType, loadSchema } from '@pie-framework/element-schemas';
import type { ValidationResult as BaseValidationResult, PieItem } from '@pie-framework/transform-types';
import Ajv from 'ajv';

/**
 * Detailed validation error with path information
 */
export interface ValidationError {
  path: string;
  message: string;
  value?: any;
}

/**
 * Extended validation result with detailed error information
 */
export interface DetailedValidationResult extends BaseValidationResult {
  detailedErrors?: ValidationError[];
}

/**
 * PIE Item Validator
 * Validates PIE items against JSON schemas
 */
export class PieItemValidator {
  private ajv: Ajv;
  private schemas: Map<string, object>;

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false // PIE schemas may not be strict
    });
    this.schemas = new Map();
  }

  /**
   * Register a PIE element schema
   * @param elementType - Element type (e.g., '@pie-element/multiple-choice')
   * @param schema - JSON Schema object
   */
  registerSchema(elementType: string, schema: object): void {
    this.schemas.set(elementType, schema);
    this.ajv.addSchema(schema, elementType);
  }

  /**
   * Load a schema from the schemas package
   * @param elementType - Element type (e.g., '@pie-element/multiple-choice')
   */
  async loadSchemaForElement(elementType: string): Promise<void> {
    try {
      // Extract element name from full element type
      // e.g., '@pie-element/multiple-choice' -> 'multiple-choice'
      const elementName = elementType.replace('@pie-element/', '') as ElementType;
      const schema = await loadSchema(elementName);
      this.registerSchema(elementType, schema);
    } catch (error) {
      throw new Error(`Failed to load schema for ${elementType}: ${(error as Error).message}`);
    }
  }

  /**
   * Load a schema from a file path (for custom schemas)
   * @param elementType - Element type
   * @param schemaPath - Path to pie-schema.json
   */
  async loadSchemaFromFile(elementType: string, schemaPath: string): Promise<void> {
    try {
      const fs = await import('node:fs/promises');
      const schemaContent = await fs.readFile(schemaPath, 'utf-8');
      const schema = JSON.parse(schemaContent);
      this.registerSchema(elementType, schema);
    } catch (error) {
      throw new Error(`Failed to load schema from ${schemaPath}: ${(error as Error).message}`);
    }
  }

  /**
   * Validate a PIE item
   * @param item - PIE item to validate
   * @returns Validation result
   */
  validate(item: PieItem): DetailedValidationResult {
    const errors: ValidationError[] = [];

    // Validate basic structure
    if (!item.id) {
      errors.push({ path: 'id', message: 'Item ID is required' });
    }
    if (!item.uuid) {
      errors.push({ path: 'uuid', message: 'Item UUID is required' });
    }
    if (!item.config) {
      errors.push({ path: 'config', message: 'Item config is required' });
      return {
        valid: false,
        errors: errors.map(e => `${e.path}: ${e.message}`),
        detailedErrors: errors
      };
    }

    // Validate models against their schemas
    if (item.config.models) {
      for (let i = 0; i < item.config.models.length; i++) {
        const model = item.config.models[i];
        if (!model.element) {
          errors.push({
            path: `config.models[${i}].element`,
            message: 'Model element type is required'
          });
          continue;
        }

        // Check if we have a schema for this element type
        const schema = this.schemas.get(model.element);
        if (schema) {
          const validate = this.ajv.compile(schema);
          const valid = validate(model);

          if (!valid && validate.errors) {
            for (const error of validate.errors) {
              errors.push({
                path: `config.models[${i}]${error.instancePath}`,
                message: error.message || 'Validation error',
                value: error.data,
              });
            }
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors.map(e => `${e.path}: ${e.message}`) : undefined,
      detailedErrors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Validate multiple items
   */
  validateMany(items: PieItem[]): DetailedValidationResult[] {
    return items.map(item => this.validate(item));
  }
}

/**
 * Basic structural validation for PIE items
 * Used when schemas are not available
 */
export function validatePieItemStructure(item: any): DetailedValidationResult {
  const errors: ValidationError[] = [];

  if (typeof item !== 'object' || item === null) {
    errors.push({ path: '', message: 'Item must be an object' });
    return {
      valid: false,
      errors: ['Item must be an object'],
      detailedErrors: errors
    };
  }

  // Check required fields
  const requiredFields = ['id', 'uuid', 'config'];
  for (const field of requiredFields) {
    if (!(field in item)) {
      errors.push({ path: field, message: `${field} is required` });
    }
  }

  // Check config structure
  if (item.config) {
    if (!Array.isArray(item.config.models)) {
      errors.push({ path: 'config.models', message: 'config.models must be an array' });
    }
    if (typeof item.config.elements !== 'object') {
      errors.push({ path: 'config.elements', message: 'config.elements must be an object' });
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors.map(e => `${e.path}: ${e.message}`) : undefined,
    detailedErrors: errors.length > 0 ? errors : undefined,
  };
}
