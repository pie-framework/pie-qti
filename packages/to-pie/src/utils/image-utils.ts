/**
 * Image Utilities
 *
 * Bun-compatible utilities for reading image dimensions
 */

import { existsSync, readFileSync } from 'fs';
import sizeOf from 'image-size';
import { dirname, resolve } from 'path';

export interface ImageDimensions {
  width: number;
  height: number;
  type?: string;
}

/**
 * Get image dimensions from file path
 * Bun-compatible implementation using Uint8Array
 */
export function getImageDimensions(imagePath: string): ImageDimensions | undefined {
  if (!existsSync(imagePath)) {
    return undefined;
  }

  try {
    // Read file as buffer
    const buffer = readFileSync(imagePath);

    // Convert to Uint8Array for Bun compatibility
    // Bun's image-size requires Uint8Array, not Buffer
    const uint8Array = new Uint8Array(buffer);

    const dimensions = sizeOf(uint8Array);

    return {
      width: dimensions.width || 0,
      height: dimensions.height || 0,
      type: dimensions.type,
    };
  } catch (error) {
    console.error(`Error reading image dimensions for ${imagePath}:`, error);
    return undefined;
  }
}

/**
 * Get image dimensions from buffer
 * Bun-compatible implementation
 */
export function getImageDimensionsFromBuffer(buffer: Buffer): ImageDimensions | undefined {
  try {
    // Convert to Uint8Array for Bun compatibility
    const uint8Array = new Uint8Array(buffer);
    const dimensions = sizeOf(uint8Array);

    return {
      width: dimensions.width || 0,
      height: dimensions.height || 0,
      type: dimensions.type,
    };
  } catch (error) {
    console.error('Error reading image dimensions from buffer:', error);
    return undefined;
  }
}

/**
 * Resolve image path relative to QTI item file
 *
 * @param imageUrl - Image URL/path from QTI XML (e.g., "images/photo.jpg")
 * @param itemFilePath - Path to the QTI item XML file
 * @returns Resolved absolute path to image file
 */
export function resolveImagePath(imageUrl: string, itemFilePath: string): string {
  // Get directory containing the item file
  const itemDir = dirname(itemFilePath);

  // Extract just the filename from URL (handles both relative paths and filenames)
  const filename = imageUrl.substring(imageUrl.lastIndexOf('/') + 1);

  // Look for image in same directory as item
  let imagePath = resolve(itemDir, filename);
  if (existsSync(imagePath)) {
    return imagePath;
  }

  // Try with full relative path
  imagePath = resolve(itemDir, imageUrl);
  if (existsSync(imagePath)) {
    return imagePath;
  }

  // Try looking in images/ subdirectory
  imagePath = resolve(itemDir, 'images', filename);
  if (existsSync(imagePath)) {
    return imagePath;
  }

  // Return best guess even if not found (caller will handle)
  return resolve(itemDir, imageUrl);
}
