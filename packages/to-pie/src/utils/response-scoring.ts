/**
 * QTI response mapping / scoring helpers
 *
 * QTI lets an item express correctness in two places. `correctResponse` is the
 * declared answer key. `mapping`/`mapEntry` is a scoring table, and an item
 * scored by the `map_response` template need not declare a `correctResponse` at
 * all — so a transformer that reads only `correctResponse` produces an item
 * that renders but cannot be scored and shows reviewers no key.
 *
 * Two rules keep the fallback safe, and both are load-bearing:
 *
 *  1. `correctResponse` always wins. The mapping is consulted only when
 *     `correctResponse` produced nothing, so a declared key is never
 *     overwritten.
 *  2. Only a *strictly positive* `mappedValue` marks a key correct. Real
 *     publisher content ships mappings whose every entry is `mappedValue="0"`
 *     while the real key sits in `correctResponse`; an unsigned reading of
 *     those marks every listed choice correct.
 */

import type { HTMLElement } from 'node-html-parser';

/** The identifier QTI conventionally uses for an item's maximum score outcome. */
const MAX_SCORE_OUTCOME = 'MAXSCORE';

/**
 * A responseDeclaration's `<mapping>`, reduced to what an answer key and an
 * item weight can be derived from.
 */
export interface QtiMapping {
  /**
   * `mapKey` values whose `mappedValue` is strictly positive, in document
   * order. Zero- and negative-scoring entries are excluded: they are
   * distractors, not answers.
   */
  positiveKeys: string[];
  /** Sum of the strictly positive `mappedValue`s. */
  positiveTotal: number;
  /**
   * `mapping/@upperBound`, but only when it is a usable weight. Absent when the
   * attribute is missing, non-numeric, or non-positive — real deliveries carry
   * `"Max:3"` and `"0"` in this attribute, so it cannot be handed to `Number()`
   * unguarded.
   */
  upperBound?: number;
}

/** Derived item-level scoring, replacing the caller-supplied `partialScoring` flag. */
export interface QtiItemScoring {
  /** True when any responseDeclaration declares a `<mapping>`, which implies graded credit. */
  partialScoring: boolean;
  /**
   * Item weight, or undefined when the source declares none. Resolved from
   * `mapping/@upperBound`, then the `MAXSCORE` outcome, then the summed
   * positive `mapEntry` values.
   */
  weight?: number;
}

/**
 * Parse an attribute that is supposed to be a positive number.
 *
 * Returns undefined rather than NaN or a nonsense weight. Observed real values
 * this has to reject: `"Max:3"` (not a number), `"0"` (not a usable weight),
 * `""`. `"2 "` — with a trailing space — must still parse as 2.
 */
export function parsePositiveNumber(raw: string | null | undefined): number | undefined {
  if (raw === null || raw === undefined) return undefined;

  const trimmed = raw.trim();
  if (trimmed === '') return undefined;

  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0) return undefined;

  return value;
}

/**
 * Find the responseDeclaration for a given responseIdentifier.
 */
export function findResponseDeclaration(
  root: HTMLElement,
  responseIdentifier: string
): HTMLElement | null {
  const declarations = root.getElementsByTagName('responseDeclaration');
  for (const declaration of Array.from(declarations)) {
    if (declaration.getAttribute('identifier') === responseIdentifier) {
      return declaration;
    }
  }
  return null;
}

/**
 * Read the declared answer key from `correctResponse/value`.
 *
 * Scoped to `correctResponse` on purpose: `defaultValue` also holds `value`
 * children and is a starting response, not a key.
 */
export function readCorrectResponseValues(responseDeclaration: HTMLElement): string[] {
  const correctResponse = responseDeclaration.getElementsByTagName('correctResponse')[0];
  if (!correctResponse) return [];

  return Array.from(correctResponse.getElementsByTagName('value'))
    .map(value => value.textContent?.trim() || '')
    .filter(text => text !== '');
}

/**
 * Read a responseDeclaration's `<mapping>`.
 *
 * Returns null when the declaration has no mapping at all, which is what
 * distinguishes "no partial credit declared" from "a mapping that scores
 * everything zero".
 */
export function readMapping(responseDeclaration: HTMLElement): QtiMapping | null {
  const mapping = responseDeclaration.getElementsByTagName('mapping')[0];
  if (!mapping) return null;

  const positiveKeys: string[] = [];
  let positiveTotal = 0;

  for (const mapEntry of Array.from(mapping.getElementsByTagName('mapEntry'))) {
    const mappedValue = Number((mapEntry.getAttribute('mappedValue') || '').trim());
    if (!Number.isFinite(mappedValue) || mappedValue <= 0) continue;

    const mapKey = mapEntry.getAttribute('mapKey');
    if (mapKey === null || mapKey === undefined) continue;

    // mapKey is significant whitespace-wise for directed pairs ("A B"), so only
    // trim the ends.
    positiveKeys.push(mapKey.trim());
    positiveTotal += mappedValue;
  }

  return {
    positiveKeys,
    positiveTotal,
    upperBound: parsePositiveNumber(mapping.getAttribute('upperBound')),
  };
}

/**
 * The positive-`mappedValue` `mapKey`s for a responseIdentifier, or an empty
 * array when there is no such declaration or no mapping.
 *
 * This is the primitive each transformer builds its own answer-key shape from:
 * a bare identifier for choice-like interactions, a `"source target"` directed
 * pair for match/gap-match, an accepted string for text entry.
 */
export function mappingAnswerKeys(root: HTMLElement, responseIdentifier: string): string[] {
  const responseDeclaration = findResponseDeclaration(root, responseIdentifier);
  if (!responseDeclaration) return [];

  return readMapping(responseDeclaration)?.positiveKeys ?? [];
}

/**
 * Read the `MAXSCORE` outcome declaration's value.
 *
 * Checks `defaultValue/value` first, then the `normalMaximum` attribute.
 */
export function readMaxScoreOutcome(itemElement: HTMLElement): number | undefined {
  const outcomes = itemElement.getElementsByTagName('outcomeDeclaration');

  for (const outcome of Array.from(outcomes)) {
    const identifier = outcome.getAttribute('identifier') || '';
    if (identifier.toUpperCase() !== MAX_SCORE_OUTCOME) continue;

    const defaultValue = outcome.getElementsByTagName('defaultValue')[0];
    const declared = defaultValue?.getElementsByTagName('value')[0]?.textContent;
    const fromDefault = parsePositiveNumber(declared);
    if (fromDefault !== undefined) return fromDefault;

    const fromAttribute = parsePositiveNumber(outcome.getAttribute('normalMaximum'));
    if (fromAttribute !== undefined) return fromAttribute;
  }

  return undefined;
}

/**
 * Derive item-level partial scoring and weight from the QTI source.
 *
 * Weight resolution order, following the rule set the loader that has seen the
 * most real publisher content converged on:
 *
 *  1. `mapping/@upperBound` — used only when *every* mapping-bearing
 *     declaration supplies a usable one, so a multi-part item is never scored
 *     from a partial sum.
 *  2. the `MAXSCORE` outcome declaration.
 *  3. the summed positive `mapEntry` values.
 */
export function deriveItemScoring(itemElement: HTMLElement): QtiItemScoring {
  const mappings: QtiMapping[] = [];

  for (const declaration of Array.from(itemElement.getElementsByTagName('responseDeclaration'))) {
    const mapping = readMapping(declaration);
    if (mapping) mappings.push(mapping);
  }

  if (mappings.length === 0) {
    return { partialScoring: false };
  }

  const upperBounds = mappings.map(mapping => mapping.upperBound);
  if (upperBounds.every((bound): bound is number => bound !== undefined)) {
    return {
      partialScoring: true,
      weight: upperBounds.reduce((total, bound) => total + bound, 0),
    };
  }

  const maxScore = readMaxScoreOutcome(itemElement);
  if (maxScore !== undefined) {
    return { partialScoring: true, weight: maxScore };
  }

  const positiveTotal = mappings.reduce((total, mapping) => total + mapping.positiveTotal, 0);
  return {
    partialScoring: true,
    ...(positiveTotal > 0 && { weight: positiveTotal }),
  };
}
