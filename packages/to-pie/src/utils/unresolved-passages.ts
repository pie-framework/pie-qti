/**
 * Unresolved passage warnings
 *
 * A passage the conversion cannot resolve to a passage resource of the package is reported as
 * `QTI_PASSAGE_UNRESOLVED`: an `<object>` left in a transformer's markup, where it does not
 * render, or a stimulus reference the item body partition took out of the item.
 */

import type { PieItem, TransformOutput, TransformWarning } from '@pie-qti/transform-types';
import { parse } from 'node-html-parser';
import { parseObjectReference } from './passage-reusability.js';

export const PASSAGE_UNRESOLVED = 'QTI_PASSAGE_UNRESOLVED';

export interface PassageUnresolvedWarning extends TransformWarning {
  code: typeof PASSAGE_UNRESOLVED;
  path: string;
}

export function unresolvedPassageWarnings(
  item: PieItem,
  itemId: string
): PassageUnresolvedWarning[] {
  const warnings: PassageUnresolvedWarning[] = [];
  const visit = (value: unknown): void => {
    if (typeof value === 'string') {
      if (!value.includes('<object')) return;
      for (const object of parse(value).querySelectorAll('object')) {
        const path = parseObjectReference(object)?.filePath;
        // A composite carries the body in its markup and in a part's prompt, so once per path.
        if (path && !warnings.some((warning) => warning.path === path)) {
          warnings.push({
            itemId,
            code: PASSAGE_UNRESOLVED,
            path,
            message: `Passage ${path} is left as an <object> in the item markup and does not render.`,
          });
        }
      }
    } else if (Array.isArray(value)) {
      for (const entry of value) visit(entry);
    } else if (typeof value === 'object' && value !== null) {
      for (const child of Object.values(value)) visit(child);
    }
  };
  visit(item.config?.models);
  visit(item.config?.markup);

  return warnings;
}

export function withUnresolvedPassageWarnings(
  output: TransformOutput,
  itemId: string
): TransformOutput {
  const warnings = output.items.flatMap((item) =>
    typeof item.content === 'object' && item.content !== null && 'config' in item.content
      ? unresolvedPassageWarnings(item.content as PieItem, itemId)
      : []
  );
  return warnings.length > 0
    ? { ...output, warnings: [...(output.warnings ?? []), ...warnings] }
    : output;
}

export function unresolvedStimulusRefWarnings(
  hrefs: readonly string[],
  itemId: string
): PassageUnresolvedWarning[] {
  return hrefs.map((path) => ({
    itemId,
    code: PASSAGE_UNRESOLVED,
    path,
    message: path
      ? `Passage ${path} is not a passage resource of the package: the item's stimulus reference was not carried.`
      : 'A stimulus reference without an href was not carried.',
  }));
}
