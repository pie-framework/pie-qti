/**
 * Image Extraction Utilities
 *
 * QTI 2.1/2.2 allows both <img> and <object> tags for embedding images.
 * Real-world QTI from assessment vendors often uses <object type="image/*">.
 */

import type { HTMLElement } from 'node-html-parser';
import { createMissingImageError } from './qti-errors.js';

export interface ImageReference {
  /** Image source/data URL */
  src: string;

  /** Image width (if specified) */
  width?: number;

  /** Image height (if specified) */
  height?: number;

  /** Alt text (from <img> or <object> content) */
  alt?: string;

  /** MIME type (only from <object>) */
  mimeType?: string;
}

/**
 * Extract image reference from either <img> or <object> tag
 *
 * Supports:
 * - <img src="path.png" width="100" height="200" alt="Description"/>
 * - <object type="image/png" data="path.png" width="100" height="200">Description</object>
 */
export function extractImage(element: HTMLElement): ImageReference | null {
  // Try <img> first
  const img = element.querySelector('img');
  if (img) {
    const src = img.getAttribute('src');
    if (!src) return null;

    return {
      src,
      width: parseIntAttribute(img, 'width'),
      height: parseIntAttribute(img, 'height'),
      alt: img.getAttribute('alt') || undefined,
    };
  }

  // Fall back to <object type="image/*">
  const object = element.querySelector('object[type^="image/"]');
  if (object) {
    const data = object.getAttribute('data');
    if (!data) return null;

    return {
      src: data,
      width: parseIntAttribute(object, 'width'),
      height: parseIntAttribute(object, 'height'),
      alt: object.textContent.trim() || undefined,
      mimeType: object.getAttribute('type') || undefined,
    };
  }

  return null;
}

/**
 * Parse integer attribute, returning undefined if not present or invalid
 */
function parseIntAttribute(element: HTMLElement, attr: string): number | undefined {
  const value = element.getAttribute(attr);
  if (!value) return undefined;

  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Find image in interaction element
 * Throws descriptive error if no image found
 */
export function findRequiredImage(
  interaction: HTMLElement,
  interactionType: string
): ImageReference {
  const image = extractImage(interaction);

  if (!image) {
    throw createMissingImageError(interactionType, {});
  }

  return image;
}
