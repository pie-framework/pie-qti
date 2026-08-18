/**
 * Image Utilities
 *
 * Bun-compatible utilities for reading image dimensions
 */

import { existsSync, readFileSync } from 'fs';
import sizeOf, { disableTypes } from 'image-size';
import { dirname, resolve } from 'path';

/**
 * Parsers disabled in image-size because they hang on crafted input.
 *
 * to-pie measures images that come out of ingested QTI content packages, so the
 * bytes are attacker-controlled. Three of image-size's parsers loop forever on a
 * zero-valued length field, blocking the event loop for the whole conversion:
 *
 * - GHSA-w3rx-r6r6-pgpr - ICNS: a zero entry length never advances imageOffset.
 * - GHSA-5p2g-fcmc-qvqq - JXL/HEIF: a zero-size box never advances the offset in
 *   extractPartialStreams(), which recomputes it from box.size.
 *
 * Neither has an upstream fix as of image-size 2.0.2. disableTypes() rejects the
 * type during detection, before calculate() runs; the validate() functions these
 * still go through are loop-free. 'jxl-stream' is listed because JXL.calculate()
 * delegates to it. Drop an entry once its advisory is patched.
 *
 * disableTypes() mutates image-size's own module state, so it is applied on first
 * measurement rather than at import: importing to-pie must not silently change
 * what an unrelated image-size caller in the same process can measure.
 */
type ImageParserType = Parameters<typeof disableTypes>[0][number];

const DISABLED_IMAGE_TYPES: ImageParserType[] = ['heif', 'icns', 'jxl', 'jxl-stream'];

let hangingParsersDisabled = false;

function disableHangingParsers(): void {
  if (hangingParsersDisabled) return;
  disableTypes(DISABLED_IMAGE_TYPES);
  hangingParsersDisabled = true;
}

/**
 * True when image-size refused the buffer because the format is disabled above or
 * simply unrecognised. Not a fault worth reporting: callers treat an unmeasured
 * image as "no dimensions" and carry on.
 */
function isUnmeasurableType(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    (error.message.startsWith('disabled file type:') ||
      error.message.startsWith('unsupported file type:'))
  );
}

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

  disableHangingParsers();

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
    if (!isUnmeasurableType(error)) {
      console.error(`Error reading image dimensions for ${imagePath}:`, error);
    }
    return undefined;
  }
}

/**
 * Get image dimensions from buffer
 * Bun-compatible implementation
 */
export function getImageDimensionsFromBuffer(buffer: Buffer): ImageDimensions | undefined {
  disableHangingParsers();

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
    if (!isUnmeasurableType(error)) {
      console.error('Error reading image dimensions from buffer:', error);
    }
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
