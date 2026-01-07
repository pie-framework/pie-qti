/**
 * @pie-qti/element-schemas
 *
 * PIE element JSON schemas for validation
 */

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Available PIE element schemas
 */
export const AVAILABLE_SCHEMAS = [
  'multiple-choice',
  'extended-text-entry',
  'placement-ordering',
  'match',
  'explicit-constructed-response',
  'select-text',
  'inline-dropdown',
  'drag-in-the-blank',
  'ebsr',
  'hotspot',
  'image-cloze-association',
  'match-list',
  'passage',
] as const;

export type ElementType = typeof AVAILABLE_SCHEMAS[number];

/**
 * Schema cache
 */
const schemaCache = new Map<string, object>();

/**
 * Load a PIE element schema
 * @param elementType - Element type (e.g., 'multiple-choice')
 * @returns JSON schema object
 */
export async function loadSchema(elementType: ElementType): Promise<object> {
  // Check cache first
  if (schemaCache.has(elementType)) {
    return schemaCache.get(elementType)!;
  }

  const schemaPath = resolve(__dirname, `schemas/${elementType}.json`);

  try {
    const content = await readFile(schemaPath, 'utf-8');
    const schema = JSON.parse(content);
    schemaCache.set(elementType, schema);
    return schema;
  } catch (error) {
    throw new Error(
      `Failed to load schema for ${elementType}: ${(error as Error).message}`
    );
  }
}

/**
 * Load all available schemas
 * @returns Map of element type to schema
 */
export async function loadAllSchemas(): Promise<Map<string, object>> {
  const schemas = new Map<string, object>();

  for (const elementType of AVAILABLE_SCHEMAS) {
    const schema = await loadSchema(elementType);
    schemas.set(`@pie-element/${elementType}`, schema);
  }

  return schemas;
}

/**
 * Get schema synchronously (must be loaded first)
 * @param elementType - Element type
 * @returns Cached schema or undefined
 */
export function getSchema(elementType: ElementType): object | undefined {
  return schemaCache.get(elementType);
}

/**
 * Check if a schema is available
 * @param elementType - Element type to check
 */
export function hasSchema(elementType: string): elementType is ElementType {
  return AVAILABLE_SCHEMAS.includes(elementType as ElementType);
}
