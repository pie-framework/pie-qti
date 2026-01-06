/**
 * QTI hotspotInteraction to PIE hotspot transformer
 *
 * Transforms QTI hotspotInteraction elements into PIE hotspot items.
 * Handles image-based interactions where students click on regions.
 */

import type { PieItem } from '@pie-framework/transform-types';
import type { HTMLElement } from 'node-html-parser';
import { parse } from 'node-html-parser';
import { v4 as uuid } from 'uuid';
import { findRequiredImage } from '../utils/image-extraction.js';
import { getImageDimensions, resolveImagePath } from '../utils/image-utils.js';
import { createMissingDimensionsError, createMissingElementError, createMissingInteractionError } from '../utils/qti-errors.js';

export interface HotspotOptions {
  /** Whether to enable partial scoring by default */
  partialScoring?: boolean;
  /** Whether to allow multiple correct hotspots */
  multipleCorrect?: boolean;
  /** Hotspot fill color */
  hotspotColor?: string;
  /** Outline color for hotspots */
  outlineColor?: string;
  /** Path to the QTI item file (needed for resolving image paths) */
  itemFilePath?: string;
  /** Stable/public identifier for round-trip compatibility */
  baseId?: string;
}

interface Rectangle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  correct: boolean;
}

interface Polygon {
  id: string;
  points: Array<{ x: number; y: number }>;
  correct: boolean;
}

interface Dimensions {
  width: number;
  height: number;
}

/**
 * Transform QTI hotspotInteraction to PIE hotspot
 */
export function transformHotspot(
  qtiXml: string,
  itemId: string,
  options?: HotspotOptions
): PieItem {
  const document = parse(qtiXml);
  const itemBody = document.getElementsByTagName('itemBody')[0];

  if (!itemBody) {
    throw createMissingElementError('itemBody', {
      itemId,
      details: 'The <itemBody> element is required to contain the question content and interaction.',
    });
  }

  const hotspotInteraction = itemBody.getElementsByTagName('hotspotInteraction')[0];

  if (!hotspotInteraction) {
    throw createMissingInteractionError('hotspotInteraction', {
      itemId,
      details: 'For image hotspot questions, use <hotspotInteraction> with <img> and <hotspotChoice> elements.',
    });
  }

  // Extract prompt
  const prompt = extractPrompt(itemBody, hotspotInteraction);

  // Extract correct answers
  const correctAnswers = extractCorrectAnswers(document);

  // Determine if multiple correct
  const maxChoices = parseInt(hotspotInteraction.getAttribute('maxChoices') || '1', 10);
  const multipleCorrect = options?.multipleCorrect ?? (maxChoices > 1 || correctAnswers.length > 1);

  // Extract image and dimensions
  const { imageUrl, dimensions } = extractImage(hotspotInteraction, options);

  if (!dimensions) {
    throw createMissingDimensionsError(imageUrl, { itemId });
  }

  // Extract hotspot shapes
  const { rectangles, polygons } = extractHotspots(hotspotInteraction, dimensions, correctAnswers);

  const modelId = uuid();

  const pieItem: PieItem = {
    id: itemId,
    ...(options?.baseId && { baseId: options.baseId }),
    uuid: modelId,
    config: {
      id: modelId,
      models: [
        {
          id: modelId,
          element: '@pie-element/hotspot',
          prompt: prompt || '',
          imageUrl,
          multipleCorrect,
          partialScoring: options?.partialScoring ?? false,
          hotspotColor: options?.hotspotColor || 'rgba(137, 183, 244, 0.65)',
          outlineColor: options?.outlineColor || 'blue',
          dimensions: {
            height: dimensions.height,
            width: dimensions.width,
          },
          shapes: {
            rectangles,
            polygons,
          },
        },
      ],
      elements: {
        hotspot: '@pie-element/hotspot@latest',
      },
    },
    metadata: {
      searchMetaData: {
        title: itemId,
        itemType: 'HS',
        source: 'qti22',
      },
    },
  };

  return pieItem;
}

/**
 * Extract prompt from itemBody or interaction
 */
function extractPrompt(itemBody: HTMLElement, interaction: HTMLElement): string | null {
  // Look for prompt inside interaction first
  const promptElement = interaction.getElementsByTagName('prompt')[0];
  if (promptElement) {
    return promptElement.innerHTML.trim();
  }

  // Look for content before interaction in itemBody
  let promptHtml = '';
  for (const child of itemBody.childNodes) {
    if (child === interaction) break;

    if (child.nodeType === 3) {
      // Text node
      const text = child.textContent?.trim();
      if (text) promptHtml += text;
    } else if ((child as HTMLElement).tagName) {
      const element = child as HTMLElement;
      if (element.tagName === 'hotspotInteraction') break;
      promptHtml += element.outerHTML;
    }
  }

  return promptHtml.trim() || null;
}

/**
 * Extract correct answers from responseDeclaration
 */
function extractCorrectAnswers(document: HTMLElement): string[] {
  const correctAnswers: string[] = [];
  const correctResponseElements = document.getElementsByTagName('correctResponse');

  if (correctResponseElements.length > 0) {
    const values = correctResponseElements[0].getElementsByTagName('value');
    for (const value of Array.from(values)) {
      const text = value.textContent?.trim();
      if (text) correctAnswers.push(text);
    }
  }

  return correctAnswers;
}

/**
 * Extract image URL and dimensions
 * Supports both <img> and <object> tags
 */
function extractImage(
  interaction: HTMLElement,
  options?: HotspotOptions
): { imageUrl: string; dimensions: Dimensions | null } {
  // Remove prompt to avoid confusing it with image content
  const prompts = interaction.getElementsByTagName('prompt');
  for (const prompt of Array.from(prompts)) {
    prompt.remove();
  }

  // Use shared utility to find image (supports both <img> and <object>)
  const imageRef = findRequiredImage(interaction, 'hotspotInteraction');
  const imageUrl = imageRef.src;

  // Try to get dimensions from element attributes first
  if (imageRef.width && imageRef.height) {
    return {
      imageUrl,
      dimensions: {
        width: imageRef.width,
        height: imageRef.height,
      },
    };
  }

  // Try to read from filesystem if itemFilePath provided
  if (options?.itemFilePath) {
    try {
      const imagePath = resolveImagePath(imageUrl, options.itemFilePath);
      const dims = getImageDimensions(imagePath);
      if (dims) {
        return {
          imageUrl,
          dimensions: {
            width: dims.width,
            height: dims.height,
          },
        };
      }
    } catch (error) {
      console.warn(`Could not read image dimensions from ${imageUrl}:`, error);
    }
  }

  // No dimensions available
  return { imageUrl, dimensions: null };
}

/**
 * Extract hotspot shapes (rectangles and polygons)
 */
function extractHotspots(
  interaction: HTMLElement,
  dimensions: Dimensions,
  correctAnswers: string[]
): { rectangles: Rectangle[]; polygons: Polygon[] } {
  const rectangles: Rectangle[] = [];
  const polygons: Polygon[] = [];

  const hotspotChoices = interaction.getElementsByTagName('hotspotChoice');

  for (const hotspot of Array.from(hotspotChoices)) {
    const shape = hotspot.getAttribute('shape');
    const identifier = hotspot.getAttribute('identifier') || '';

    switch (shape) {
      case 'rect':
        rectangles.push(extractRectangle(hotspot, identifier, dimensions, correctAnswers));
        break;
      case 'poly':
        polygons.push(extractPolygon(hotspot, identifier, dimensions, correctAnswers));
        break;
      case 'circle':
        // Convert circle to polygon (approximate with 16 points)
        polygons.push(circleToPolygon(hotspot, identifier, dimensions, correctAnswers));
        break;
    }
  }

  return { rectangles, polygons };
}

/**
 * Extract rectangle hotspot
 */
function extractRectangle(
  hotspot: HTMLElement,
  identifier: string,
  dimensions: Dimensions,
  correctAnswers: string[]
): Rectangle {
  const coords = (hotspot.getAttribute('coords') || '').split(',').map(c => parseFloat(c.trim()));

  // QTI format: x1,y1,x2,y2 (top-left, bottom-right)
  const x1 = coords[0] || 0;
  const y1 = coords[1] || 0;
  const x2 = coords[2] || 0;
  const y2 = coords[3] || 0;

  // Clamp to image bounds
  const x = Math.max(0, Math.min(x1, dimensions.width));
  const y = Math.max(0, Math.min(y1, dimensions.height));
  const width = Math.max(0, Math.min(x2 - x1, dimensions.width - x));
  const height = Math.max(0, Math.min(y2 - y1, dimensions.height - y));

  return {
    id: identifier,
    x: Math.round(x * 100) / 100,
    y: Math.round(y * 100) / 100,
    width: Math.round(width * 100) / 100,
    height: Math.round(height * 100) / 100,
    correct: correctAnswers.includes(identifier),
  };
}

/**
 * Extract polygon hotspot
 */
function extractPolygon(
  hotspot: HTMLElement,
  identifier: string,
  dimensions: Dimensions,
  correctAnswers: string[]
): Polygon {
  const coords = (hotspot.getAttribute('coords') || '').split(',').map(c => parseFloat(c.trim()));
  const points: Array<{ x: number; y: number }> = [];

  // QTI format: x1,y1,x2,y2,x3,y3,... (coordinate pairs)
  for (let i = 0; i < coords.length; i += 2) {
    const x = coords[i] || 0;
    const y = coords[i + 1] || 0;

    // Skip if duplicate of first point (closing the polygon)
    if (points.length > 0 && x === points[0].x && y === points[0].y) {
      continue;
    }

    // Clamp to image bounds
    const clampedX = Math.max(0, Math.min(x, dimensions.width));
    const clampedY = Math.max(0, Math.min(y, dimensions.height));

    points.push({
      x: Math.round(clampedX * 100) / 100,
      y: Math.round(clampedY * 100) / 100,
    });
  }

  return {
    id: identifier,
    points,
    correct: correctAnswers.includes(identifier),
  };
}

/**
 * Convert circle to polygon (approximate with points)
 */
function circleToPolygon(
  hotspot: HTMLElement,
  identifier: string,
  dimensions: Dimensions,
  correctAnswers: string[]
): Polygon {
  const coords = (hotspot.getAttribute('coords') || '').split(',').map(c => parseFloat(c.trim()));

  // QTI circle format: centerX,centerY,radius
  const centerX = coords[0] || 0;
  const centerY = coords[1] || 0;
  const radius = coords[2] || 0;

  const points: Array<{ x: number; y: number }> = [];
  const numPoints = 16; // Approximate circle with 16-sided polygon

  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);

    // Clamp to image bounds
    const clampedX = Math.max(0, Math.min(x, dimensions.width));
    const clampedY = Math.max(0, Math.min(y, dimensions.height));

    points.push({
      x: Math.round(clampedX * 100) / 100,
      y: Math.round(clampedY * 100) / 100,
    });
  }

  return {
    id: identifier,
    points,
    correct: correctAnswers.includes(identifier),
  };
}
