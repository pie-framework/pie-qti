/**
 * QTI Transformation Error Utilities
 *
 * Provides standardized, descriptive error messages for QTI transformation failures.
 * All error messages include context, location information, and actionable suggestions.
 */

export interface QtiErrorContext {
  /** QTI item identifier */
  itemId?: string;
  /** Interaction type (e.g., 'choiceInteraction', 'hotspotInteraction') */
  interactionType?: string;
  /** Element type that was missing or invalid */
  elementType?: string;
  /** Additional context information */
  details?: string;
}

/**
 * Creates a descriptive error for missing required elements
 */
export function createMissingElementError(
  elementName: string,
  context: QtiErrorContext
): Error {
  let message = `Missing required element: ${elementName}`;

  if (context.itemId) {
    message += ` in item '${context.itemId}'`;
  }

  message += `\n\nExpected to find: <${elementName}> element in the QTI XML`;

  if (context.details) {
    message += `\n${context.details}`;
  }

  message += `\n\nPlease verify that:`;
  message += `\n  • The QTI XML is well-formed`;
  message += `\n  • The <${elementName}> element exists in the correct location`;
  message += `\n  • Element names match QTI 2.1/2.2 specification (case-sensitive)`;

  return new Error(message);
}

/**
 * Creates a descriptive error for missing interaction elements
 */
export function createMissingInteractionError(
  interactionType: string,
  context: QtiErrorContext
): Error {
  let message = `Missing required interaction: ${interactionType}`;

  if (context.itemId) {
    message += ` in item '${context.itemId}'`;
  }

  message += `\n\nExpected to find: <${interactionType}> element inside <itemBody>`;

  message += `\n\nPlease verify that:`;
  message += `\n  • The <${interactionType}> element exists within <itemBody>`;
  message += `\n  • Element name matches QTI 2.1/2.2 specification exactly (case-sensitive)`;
  message += `\n  • You're using the correct transformer for this interaction type`;

  if (context.details) {
    message += `\n\nAdditional info: ${context.details}`;
  }

  return new Error(message);
}

/**
 * Creates a descriptive error for missing images
 */
export function createMissingImageError(
  interactionType: string,
  context: QtiErrorContext
): Error {
  let message = `Missing required image in ${interactionType}`;

  if (context.itemId) {
    message += ` for item '${context.itemId}'`;
  }

  message += `\n\nExpected to find: <img> or <object type="image/*"> element`;

  message += `\n\nSupported image formats:`;
  message += `\n  • <img src="path.png" width="400" height="300" alt="Description"/>`;
  message += `\n  • <object type="image/png" data="path.png" width="400" height="300">Description</object>`;

  message += `\n\nPlease verify that:`;
  message += `\n  • An image element exists within the ${interactionType}`;
  message += `\n  • Image has 'src' (for <img>) or 'data' (for <object>) attribute`;
  message += `\n  • Image dimensions (width/height) are specified`;

  return new Error(message);
}

/**
 * Creates a descriptive error for missing image dimensions
 */
export function createMissingDimensionsError(
  imageUrl: string,
  context: QtiErrorContext
): Error {
  let message = `Cannot determine image dimensions for '${imageUrl}'`;

  if (context.itemId) {
    message += ` in item '${context.itemId}'`;
  }

  message += `\n\nImage hotspots require exact dimensions to calculate coordinates.`;

  message += `\n\nSolutions:`;
  message += `\n  1. Add width/height attributes to the image element:`;
  message += `\n     <img src="${imageUrl}" width="400" height="300"/>`;
  message += `\n  2. Provide itemFilePath option to transformer:`;
  message += `\n     transformHotspot(qti, itemId, { itemFilePath: '/path/to/item.xml' })`;
  message += `\n     (This allows reading dimensions from the actual image file)`;

  return new Error(message);
}

/**
 * Creates a descriptive error for insufficient interaction elements
 */
export function createInsufficientElementsError(
  elementType: string,
  required: number,
  found: number,
  context: QtiErrorContext
): Error {
  let message = `Insufficient ${elementType} elements`;

  if (context.itemId) {
    message += ` in item '${context.itemId}'`;
  }

  message += `\n\nRequired: ${required} ${elementType} element${required !== 1 ? 's' : ''}`;
  message += `\nFound: ${found}`;

  if (context.details) {
    message += `\n\n${context.details}`;
  }

  message += `\n\nPlease verify that:`;
  message += `\n  • The QTI item contains exactly ${required} <${elementType}> element${required !== 1 ? 's' : ''}`;
  message += `\n  • Element names are spelled correctly (case-sensitive)`;

  return new Error(message);
}

/**
 * Creates a descriptive error for empty or invalid content
 */
export function createInvalidContentError(
  what: string,
  why: string,
  context: QtiErrorContext
): Error {
  let message = `Invalid ${what}`;

  if (context.itemId) {
    message += ` in item '${context.itemId}'`;
  }

  message += `\n\nProblem: ${why}`;

  if (context.details) {
    message += `\n${context.details}`;
  }

  return new Error(message);
}
