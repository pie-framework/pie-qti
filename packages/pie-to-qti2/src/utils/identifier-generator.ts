/**
 * Identifier Generator
 *
 * Utilities for generating valid QTI identifiers from PIE data
 */

/**
 * Generate a valid QTI identifier from a string
 * QTI identifiers must start with a letter or underscore and contain only letters, digits, hyphens, periods, and underscores
 */
export function generateIdentifier(input: string, prefix?: string): string {
  // Remove invalid characters and replace spaces with hyphens
  let identifier = input
    .replace(/[^a-zA-Z0-9_\-.]/g, '-')
    .replace(/^[^a-zA-Z_]/, '_'); // Ensure starts with letter or underscore

  // Add prefix if provided
  if (prefix) {
    identifier = `${prefix}-${identifier}`;
  }

  // Ensure it's not empty
  if (!identifier) {
    identifier = '_item';
  }

  return identifier;
}

/**
 * Generate a response identifier
 */
export function generateResponseIdentifier(index?: number): string {
  return index !== undefined ? `RESPONSE_${index}` : 'RESPONSE';
}

/**
 * Generate a choice identifier
 */
export function generateChoiceIdentifier(index: number): string {
  return `choice-${index}`;
}

/**
 * Generate an outcome identifier
 */
export function generateOutcomeIdentifier(name: string): string {
  return generateIdentifier(name, 'outcome');
}

/**
 * Sanitize a string to be used as part of an identifier
 */
export function sanitizeForIdentifier(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .replace(/^[^a-zA-Z_]/, '_');
}
