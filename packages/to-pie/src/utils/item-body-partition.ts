/**
 * Item body partition
 *
 * Splits an item body into the passages it references or holds and the content the interaction
 * transformers convert, once per item, ahead of every transformer. A passage leaves the body, so
 * no prompt carries it, and comes back as a reference or a passage model:
 *
 * 1. an `<object>` outside the interactions whose `data` resolves to a passage resource of the
 *    package becomes a reference by that resource's manifest identifier, and one the PIE export
 *    wrote becomes a reference by the PIE passage id its `data-pie-passage-id` names;
 * 2. an `assessmentStimulusRef` whose `href` resolves the same way, or that names a PIE passage id
 *    by `data-pie-passage-id`, becomes a reference too;
 * 3. an element an inline passage rule claims becomes a passage model.
 *
 * Any other `<object>` stays where it is, and is reported as an unresolved passage. A stimulus reference renders nothing, so it leaves the body either way, and
 * one that resolves to no passage resource is reported by href.
 *
 * rubricBlocks are settled here too. A block the candidate sees is item content and becomes a
 * plain `<div>`, so the prompt and a composite's markup keep it. Any other block is guidance for
 * someone else and leaves the body: the scorer rubric is carried from the source item as teacher
 * instructions, and every block is a rubric candidate in package analysis.
 */

import type { PieItem, PieModel } from '@pie-qti/transform-types';
import type { HTMLElement, Node } from 'node-html-parser';
import { cleanPassageHtml, type PassageModel } from './passage-extraction.js';
import type { PassageResourceIndex } from './passage-resources.js';
import { generateStablePassageId } from './passage-reusability.js';
import { piePlaceholderMarkup } from './pie-markup.js';
import { isQtiInteractionElement } from './qti-item-planner.js';

/** Claims an item-body element as an inline passage. */
export interface InlinePassageRule {
  id: string;
  matches(element: HTMLElement): boolean;
}

/** The `<stimulus>` element some publishers wrap an inline passage in. */
export const STIMULUS_ELEMENT_RULE: InlinePassageRule = {
  id: 'stimulus-element',
  matches: (element) => tagNameOf(element) === 'stimulus',
};

export interface QtiPassageReference {
  /** The manifest resource identifier of the passage. */
  identifier: string;
  /** The href as the item wrote it, or the passage's package path for a manifest dependency. */
  href: string;
  via: 'object' | 'assessmentStimulusRef' | 'manifest-dependency';
}

export interface ItemBodyPartition {
  /** In document order, one per passage. */
  passageReferences: QtiPassageReference[];
  inlinePassages: PassageModel[];
  /** The hrefs of stimulus references that name no passage resource. */
  unresolvedStimulusRefs: string[];
  /** Whether the item changed, so the transformers need its partitioned form. */
  changed: boolean;
}

export interface PartitionItemBodyOptions {
  passageResources: PassageResourceIndex;
  inlinePassageRules?: readonly InlinePassageRule[];
}

/** Partition the item in place. */
export function partitionItemBody(
  assessmentItem: HTMLElement,
  options: PartitionItemBodyOptions
): ItemBodyPartition {
  const partition: ItemBodyPartition = {
    passageReferences: [],
    inlinePassages: [],
    unresolvedStimulusRefs: [],
    changed: false,
  };
  const reference = (identifier: string, href: string, via: QtiPassageReference['via']) => {
    if (!partition.passageReferences.some((existing) => existing.identifier === identifier)) {
      partition.passageReferences.push({ identifier, href, via });
    }
  };
  const itemBody = assessmentItem.getElementsByTagName('itemBody')[0];

  for (const stimulusRef of assessmentItem.getElementsByTagName('assessmentStimulusRef')) {
    const href = stimulusRef.getAttribute('href')?.trim() ?? '';
    const identifier =
      (href ? options.passageResources.resolve(href) : undefined) ??
      (stimulusRef.getAttribute('data-pie-passage-id')?.trim() || undefined);
    if (identifier) {
      reference(identifier, href, 'assessmentStimulusRef');
    } else {
      partition.unresolvedStimulusRefs.push(href);
    }
    removeAndPrune(stimulusRef, itemBody);
    partition.changed = true;
  }
  if (!itemBody) {
    return partition;
  }

  for (const element of outsideInteractions(itemBody)) {
    const tagName = tagNameOf(element);
    if (tagName === 'object') {
      const href = element.getAttribute('data')?.trim() ?? '';
      const identifier =
        (href ? options.passageResources.resolve(href) : undefined) ??
        (element.getAttribute('data-pie-passage-id')?.trim() || undefined);
      if (identifier) {
        reference(identifier, href, 'object');
        removeAndPrune(element, itemBody);
        partition.changed = true;
      }
      continue;
    }
    if (tagName === 'rubricblock') {
      const views = (element.getAttribute('view') ?? '').trim().split(/\s+/);
      if (views.includes('candidate')) {
        const className = element.getAttribute('class');
        element.replaceWith(
          `<div${className ? ` class="${className}"` : ''}>${element.innerHTML}</div>`
        );
      } else {
        removeAndPrune(element, itemBody);
      }
      partition.changed = true;
      continue;
    }
    const rule = [STIMULUS_ELEMENT_RULE, ...(options.inlinePassageRules ?? [])].find((candidate) =>
      candidate.matches(element)
    );
    if (rule) {
      const text = cleanPassageHtml(element.innerHTML);
      if (text) {
        partition.inlinePassages.push(inlinePassageModel(text));
      }
      removeAndPrune(element, itemBody);
      partition.changed = true;
    }
  }

  return partition;
}

/**
 * Carry the partition onto the item converted from the partitioned body. The first referenced
 * passage becomes the item's passage, since a PIE item names one, and every reference is kept in
 * `metadata.qtiPassageReferences`. Inline passages lead the item's models, and its markup when the
 * item has any.
 */
export function withItemBodyPartition(pieItem: PieItem, partition: ItemBodyPartition): PieItem {
  const [passage] = partition.passageReferences;
  let next = pieItem;
  if (passage) {
    next = {
      ...next,
      passage: passage.identifier,
      metadata: { ...(next.metadata ?? {}), qtiPassageReferences: partition.passageReferences },
    };
  }
  if (partition.inlinePassages.length === 0) {
    return next;
  }
  const passageModels = partition.inlinePassages as unknown as PieModel[];
  const config = {
    ...next.config,
    elements: { ...next.config.elements, passage: `${PASSAGE_ELEMENT}@latest` },
    models: [...passageModels, ...next.config.models],
  };
  if (typeof config.markup === 'string' && config.markup.trim()) {
    const passageMarkup = passageModels.map(
      (model) => piePlaceholderMarkup(model, config.elements) ?? ''
    );
    config.markup = passageMarkup.join('') + config.markup;
  }
  return { ...next, config };
}

/**
 * The elements of the body outside its interactions, outermost first. An element is visited after
 * its ancestors, so one an earlier step removed is skipped with its subtree.
 */
function* outsideInteractions(itemBody: HTMLElement): Generator<HTMLElement> {
  const visit = function* (parent: HTMLElement): Generator<HTMLElement> {
    for (const child of [...parent.childNodes]) {
      const element = child as HTMLElement;
      if (!element.tagName || isQtiInteractionElement(element)) continue;
      yield element;
      if (element.parentNode === parent) yield* visit(element);
    }
  };
  yield* visit(itemBody);
}

/** Wrappers left holding nothing once a passage leaves them. */
const PRUNABLE_WRAPPERS = new Set(['div', 'p', 'span', 'section']);

function removeAndPrune(element: HTMLElement, stopAt: HTMLElement | undefined): void {
  let parent = element.parentNode as HTMLElement | null;
  element.remove();
  while (parent && parent !== stopAt && PRUNABLE_WRAPPERS.has(tagNameOf(parent))) {
    if (!isEmpty(parent)) return;
    const next = parent.parentNode as HTMLElement | null;
    parent.remove();
    parent = next;
  }
}

function isEmpty(element: HTMLElement): boolean {
  return element.childNodes.every(
    (child: Node) => child.nodeType === 3 && !child.textContent.replace(/[\s ]/g, '')
  );
}

const PASSAGE_ELEMENT = '@pie-element/passage';

function inlinePassageModel(text: string): PassageModel {
  return {
    id: generateStablePassageId({ content: text }),
    element: PASSAGE_ELEMENT,
    passages: [{ title: '', text }],
    titleEnabled: false,
    subtitleEnabled: false,
    authorEnabled: false,
    textEnabled: true,
    teacherInstructionsEnabled: false,
  };
}

function tagNameOf(element: HTMLElement): string {
  return (element.rawTagName ?? element.tagName ?? '').toLowerCase();
}
