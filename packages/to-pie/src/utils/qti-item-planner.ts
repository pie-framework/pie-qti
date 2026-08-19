import type { PieModel } from '@pie-qti/transform-types';
import type { HTMLElement } from 'node-html-parser';

export const QTI_ITEM_INTERACTION_TYPES = [
  'choiceInteraction',
  'extendedTextInteraction',
  'orderInteraction',
  'matchInteraction',
  'textEntryInteraction',
  'selectPointInteraction',
  'hottextInteraction',
  'inlineChoiceInteraction',
  'gapMatchInteraction',
  'hotspotInteraction',
  'graphicGapMatchInteraction',
  'associateInteraction',
  'sliderInteraction',
] as const;

export type QtiItemInteractionType = (typeof QTI_ITEM_INTERACTION_TYPES)[number];

export type QtiInteractionUnitKind = 'block' | 'inline' | 'paired';

export interface PlannedQtiInteractionUnit {
  kind: QtiInteractionUnitKind;
  interactionType: QtiItemInteractionType | 'ebsr';
  interactions: HTMLElement[];
}

export interface QtiItemBodyPlan {
  interactions: HTMLElement[];
  units: PlannedQtiInteractionUnit[];
}

export interface PieElementConversion {
  model: PieModel;
  elementName: string;
  elementPackage: string;
  markupPlaceholder?: string;
  diagnostics?: string[];
}

export interface PieItemCompositionPlan {
  models: PieModel[];
  elements: Record<string, string>;
  markup: string;
  diagnostics: string[];
}

const INTERACTION_TYPES = new Set<string>(QTI_ITEM_INTERACTION_TYPES);
const INLINE_INTERACTION_TYPES = new Set<string>([
  'textEntryInteraction',
  'inlineChoiceInteraction',
]);

export function planQtiItemBody(itemBody: HTMLElement): QtiItemBodyPlan {
  const interactions = collectInteractionNodes(itemBody);
  return {
    interactions,
    units: groupInteractionUnits(interactions),
  };
}

function collectInteractionNodes(root: HTMLElement): HTMLElement[] {
  const interactions: HTMLElement[] = [];
  const visit = (element: HTMLElement) => {
    for (const child of element.childNodes) {
      const childElement = child as HTMLElement;
      const tagName = elementTagName(childElement);
      if (!tagName) {
        continue;
      }
      if (INTERACTION_TYPES.has(tagName)) {
        interactions.push(childElement);
        continue;
      }
      visit(childElement);
    }
  };
  visit(root);
  return interactions;
}

function groupInteractionUnits(interactions: HTMLElement[]): PlannedQtiInteractionUnit[] {
  const units: PlannedQtiInteractionUnit[] = [];
  for (let index = 0; index < interactions.length; index += 1) {
    const interaction = interactions[index];
    if (!interaction) {
      continue;
    }
    const interactionType = elementTagName(interaction) as QtiItemInteractionType | null;
    if (!interactionType) {
      continue;
    }

    if (INLINE_INTERACTION_TYPES.has(interactionType)) {
      const group = [interaction];
      let nextIndex = index + 1;
      while (
        nextIndex < interactions.length &&
        elementTagName(interactions[nextIndex]!) === interactionType
      ) {
        group.push(interactions[nextIndex]!);
        nextIndex += 1;
      }
      units.push({ kind: 'inline', interactionType, interactions: group });
      index = nextIndex - 1;
      continue;
    }

    units.push({ kind: 'block', interactionType, interactions: [interaction] });
  }
  return units;
}

export function elementTagName(element: HTMLElement): string | null {
  const tagName = element.rawTagName ?? element.tagName ?? null;
  if (!tagName) {
    return null;
  }
  return (
    QTI_ITEM_INTERACTION_TYPES.find(
      (interactionType) => interactionType.toLowerCase() === tagName.toLowerCase()
    ) ?? tagName
  );
}

export function isQtiInteractionElement(element: HTMLElement): boolean {
  const tagName = elementTagName(element);
  return tagName ? INTERACTION_TYPES.has(tagName) : false;
}
