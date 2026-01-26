/**
 * QTI graphicGapMatchInteraction to PIE image-cloze-association transformer
 *
 * Transforms QTI graphicGapMatchInteraction elements into PIE image-cloze-association items.
 * Handles drag-and-drop interactions where images are dragged onto specific zones on a background image.
 */

import type { PieItem } from '@pie-qti/transform-types';
import type { HTMLElement } from 'node-html-parser';
import { parse } from 'node-html-parser';
import { v4 as uuid } from 'uuid';
import { findRequiredImage } from '../utils/image-extraction.js';
import { getImageDimensions, resolveImagePath } from '../utils/image-utils.js';
import { createMissingDimensionsError, createMissingElementError, createMissingInteractionError } from '../utils/qti-errors.js';

export interface ImageClozeAssociationOptions {
  /** Whether to enable partial scoring by default */
  partialScoring?: boolean;
  /** Whether to allow duplicate responses */
  duplicateResponses?: boolean;
  /** Maximum responses per zone (0 = unlimited) */
  maxResponsePerZone?: number;
  /** Whether to shuffle options */
  shuffleOptions?: boolean;
  /** Answer choice transparency */
  answerChoiceTransparency?: boolean;
  /** Response area fill color */
  responseAreaFill?: string;
  /** Path to the QTI item file (needed for resolving image paths) */
  itemFilePath?: string;
  /** Stable/public identifier for round-trip compatibility */
  baseId?: string;
}

interface ResponseContainer {
  x: number;
  y: number;
  width: string;
  height: string;
  id: string;
}

interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Transform QTI graphicGapMatchInteraction to PIE image-cloze-association
 */
export function transformImageClozeAssociation(
  qtiXml: string,
  itemId: string,
  options?: ImageClozeAssociationOptions
): PieItem {
  const document = parse(qtiXml);
  const itemBody = document.getElementsByTagName('itemBody')[0];

  if (!itemBody) {
    throw createMissingElementError('itemBody', {
      itemId,
      details: 'The <itemBody> element is required to contain the question content and interaction.',
    });
  }

  const interaction = itemBody.getElementsByTagName('graphicGapMatchInteraction')[0];

  if (!interaction) {
    throw createMissingInteractionError('graphicGapMatchInteraction', {
      itemId,
      details: 'For image-based drag-and-drop questions, use <graphicGapMatchInteraction> with <gapImg> and <associableHotspot> elements.',
    });
  }

  // Extract prompt
  const prompt = extractPrompt(itemBody, interaction);

  // Get response identifier
  const responseIdentifier = interaction.getAttribute('responseIdentifier') || 'RESPONSE';

  // Extract correct answers (as directed pairs: "gapImgId hotspotId")
  const correctAnswerMap = extractCorrectAnswers(document, responseIdentifier);

  // Extract image and dimensions
  const { imageUrl, dimensions } = extractImage(interaction, options);

  if (!dimensions) {
    throw createMissingDimensionsError(imageUrl, { itemId });
  }

  // Extract gap images (draggable items)
  const gapImageMap = extractGapImages(interaction);
  const possibleResponses = Array.from(gapImageMap.values());

  // Extract associable hotspots (drop zones) as response containers
  const responseContainers = extractResponseContainers(interaction, dimensions);

  // Build validation structure
  const validation = buildValidation(responseContainers, gapImageMap, correctAnswerMap);

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
          element: '@pie-element/image-cloze-association',
          prompt: prompt || '',
          image: {
            src: imageUrl,
            width: dimensions.width,
            height: dimensions.height,
          },
          responseContainers: responseContainers.map(rc => ({
            x: rc.x,
            y: rc.y,
            width: rc.width,
            height: rc.height,
          })),
          possibleResponses,
          validation,
          duplicateResponses: options?.duplicateResponses ?? false,
          partialScoring: options?.partialScoring ?? false,
          maxResponsePerZone: options?.maxResponsePerZone ?? 0,
          shuffleOptions: options?.shuffleOptions ?? true,
          answerChoiceTransparency: options?.answerChoiceTransparency ?? false,
          responseAreaFill: options?.responseAreaFill ?? 'rgba(255, 255, 255, 0.1)',
        },
      ],
      elements: {
        'image-cloze-association': '@pie-element/image-cloze-association@latest',
      },
    },
    metadata: {
      searchMetaData: {
        title: itemId,
        itemType: 'ICA',
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
      if (element.tagName === 'graphicGapMatchInteraction') break;
      promptHtml += element.outerHTML;
    }
  }

  return promptHtml.trim() || null;
}

/**
 * Extract correct answers from responseDeclaration
 * Returns a map of hotspot ID -> array of gap image IDs
 */
function extractCorrectAnswers(document: HTMLElement, responseIdentifier: string): Map<string, string[]> {
  const correctAnswerMap = new Map<string, string[]>();
  const responseDeclarations = document.getElementsByTagName('responseDeclaration');

  for (const rd of Array.from(responseDeclarations)) {
    if (rd.getAttribute('identifier') === responseIdentifier) {
      const values = rd.getElementsByTagName('value');

      // QTI format: "gapImgId hotspotId" (directed pair)
      for (const value of Array.from(values)) {
        const text = value.textContent?.trim();
        if (!text) continue;

        const parts = text.split(/\s+/);
        if (parts.length >= 2) {
          const gapImgId = parts[0];
          const hotspotId = parts[1];

          const existing = correctAnswerMap.get(hotspotId);
          if (existing) {
            existing.push(gapImgId);
          } else {
            correctAnswerMap.set(hotspotId, [gapImgId]);
          }
        }
      }
    }
  }

  return correctAnswerMap;
}

/**
 * Extract image URL and dimensions
 * Supports both <img> and <object> tags
 */
function extractImage(
  interaction: HTMLElement,
  options?: ImageClozeAssociationOptions
): { imageUrl: string; dimensions: ImageDimensions | null } {
  // Remove prompt to avoid confusing it with image content
  const prompts = interaction.getElementsByTagName('prompt');
  for (const prompt of Array.from(prompts)) {
    prompt.remove();
  }

  // Use shared utility to find image (supports both <img> and <object>)
  const imageRef = findRequiredImage(interaction, 'graphicGapMatchInteraction');
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
 * Extract gap images (draggable items)
 * Returns a map of gapImg ID -> HTML content
 */
function extractGapImages(interaction: HTMLElement): Map<string, string> {
  const gapImageMap = new Map<string, string>();
  const gapImgs = interaction.getElementsByTagName('gapImg');

  for (const gapImg of Array.from(gapImgs)) {
    const id = gapImg.getAttribute('identifier');
    if (id) {
      const content = gapImg.innerHTML.trim();
      gapImageMap.set(id, content);
    }
  }

  return gapImageMap;
}

/**
 * Extract response containers (drop zones) from associableHotspot elements
 * Coordinates are converted to percentages for responsive positioning
 */
function extractResponseContainers(
  interaction: HTMLElement,
  dimensions: ImageDimensions
): ResponseContainer[] {
  const containers: ResponseContainer[] = [];
  const hotspots = interaction.getElementsByTagName('associableHotspot');

  for (const hotspot of Array.from(hotspots)) {
    const id = hotspot.getAttribute('identifier');
    const coords = (hotspot.getAttribute('coords') || '').split(',').map(c => parseFloat(c.trim()));

    if (!id || coords.length < 4) continue;

    // QTI format: x1,y1,x2,y2 (top-left, bottom-right)
    const x1 = coords[0];
    const y1 = coords[1];
    const x2 = coords[2];
    const y2 = coords[3];

    // Convert to percentages
    const xPercent = round((x1 / dimensions.width) * 100, 2);
    const yPercent = round((y1 / dimensions.height) * 100, 2);
    const widthPercent = round(((x2 - x1) / dimensions.width) * 100, 2);
    const heightPercent = round(((y2 - y1) / dimensions.height) * 100, 2);

    containers.push({
      id,
      x: xPercent,
      y: yPercent,
      width: `${widthPercent}%`,
      height: `${heightPercent}%`,
    });
  }

  return containers;
}

/**
 * Build validation structure mapping each response container to its correct gap images
 */
function buildValidation(
  responseContainers: ResponseContainer[],
  gapImageMap: Map<string, string>,
  correctAnswerMap: Map<string, string[]>
): { scoringType: string; validResponse: { score: number; value: Array<{ images: string[] }> } } {
  const value: Array<{ images: string[] }> = [];

  // For each response container in order, build its correct answers
  for (const container of responseContainers) {
    const gapImgIds = correctAnswerMap.get(container.id) || [];
    const images: string[] = [];

    for (const gapImgId of gapImgIds) {
      const gapImgContent = gapImageMap.get(gapImgId);
      if (gapImgContent) {
        images.push(gapImgContent);
      }
    }

    value.push({ images });
  }

  return {
    scoringType: 'exactMatch',
    validResponse: {
      score: 1,
      value,
    },
  };
}

/**
 * Round to specified decimal places
 */
function round(value: number, decimals: number): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}
