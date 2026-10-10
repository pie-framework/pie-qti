/**
 * Item composition
 *
 * A PIE item with several interaction models becomes one QTI item. Each model is generated as a
 * complete item by its own generator, then the items are merged: bodies in model order, response
 * declarations renamed per part (`RESPONSE` → `RESPONSE1`, `RESPONSE_A` → `RESPONSE1_A`), and every
 * identifier the body declares prefixed with `P<n>_`, because QTI requires a choice identifier to be
 * unique within the item. Each part's response processing scores into its own `SCORE_<n>`, and
 * `SCORE` is their sum. A part without response processing is scored externally and adds only to
 * `MAXSCORE`.
 */

import { type HTMLElement, type Node, NodeType, parse } from 'node-html-parser';
import { buildOutcomeDeclaration } from './response-declaration-builder.js';
import { QtiBuilder } from './qti-builder.js';

const RP_TEMPLATES = 'http://www.imsglobal.org/question/qti_v2p2/rptemplates/';
const IDENTIFIER_VALUE_TYPES = new Set(['identifier', 'pair', 'directedPair']);

export interface ComposedItem {
  qti: string;
  warnings: string[];
}

interface ItemParts {
  title?: string;
  responseDeclarations: HTMLElement[];
  maxScore: number;
  itemBody: HTMLElement;
  responseProcessing?: HTMLElement;
}

function elementChildren(node: Node): HTMLElement[] {
  return node.childNodes.filter((child): child is HTMLElement => child.nodeType === NodeType.ELEMENT_NODE);
}

function descendants(node: HTMLElement): HTMLElement[] {
  return elementChildren(node).flatMap((child) => [child, ...descendants(child)]);
}

function named(node: HTMLElement, tag: string): HTMLElement[] {
  return elementChildren(node).filter((child) => child.rawTagName === tag);
}

function readParts(qti: string): ItemParts {
  const root = parse(qti, { lowerCaseTagName: false, comment: false, blockTextElements: { script: true, style: true } });
  const item = elementChildren(root).find((child) => child.rawTagName === 'assessmentItem');
  const itemBody = item && named(item, 'itemBody')[0];
  if (!item || !itemBody) {
    throw new Error('Generated QTI has no assessmentItem with an itemBody');
  }
  const maxScoreValue = named(item, 'outcomeDeclaration')
    .find((outcome) => outcome.getAttribute('identifier') === 'MAXSCORE')
    ?.querySelector('value')?.text;
  return {
    title: item.getAttribute('title'),
    responseDeclarations: named(item, 'responseDeclaration'),
    maxScore: Number(maxScoreValue ?? 0) || 0,
    itemBody,
    responseProcessing: named(item, 'responseProcessing')[0],
  };
}

function renameTokens(text: string, renames: Map<string, string>): string {
  return text
    .trim()
    .split(/\s+/)
    .map((token) => renames.get(token) ?? token)
    .join(' ');
}

/**
 * Explicit rules equivalent to a standard template, scoring into `score`.
 */
function templateRules(template: string, responseId: string, score: string): string {
  if (template === `${RP_TEMPLATES}match_correct`) {
    return `<responseCondition><responseIf><match><variable identifier="${responseId}"/><correct identifier="${responseId}"/></match><setOutcomeValue identifier="${score}"><baseValue baseType="float">1</baseValue></setOutcomeValue></responseIf></responseCondition>`;
  }
  if (template === `${RP_TEMPLATES}map_response`) {
    return `<responseCondition><responseIf><not><isNull><variable identifier="${responseId}"/></isNull></not><setOutcomeValue identifier="${score}"><mapResponse identifier="${responseId}"/></setOutcomeValue></responseIf></responseCondition>`;
  }
  throw new Error(`Cannot compose response processing template ${template}`);
}

export function composeItems(
  identifier: string,
  generated: string[],
  options: { title?: string; pieElement?: string }
): ComposedItem {
  const responseDeclarations: string[] = [];
  const bodies: string[] = [];
  const rules: string[] = [];
  const partScores: string[] = [];
  const warnings: string[] = [];
  let maxScore = 0;
  let title: string | undefined;

  generated.forEach((qti, index) => {
    const part = index + 1;
    const { title: partTitle, responseDeclarations: declarations, maxScore: partMax, itemBody, responseProcessing } =
      readParts(qti);
    title ??= partTitle;
    maxScore += partMax;

    const renames = new Map<string, string>();
    for (const declaration of declarations) {
      const id = declaration.getAttribute('identifier') ?? '';
      renames.set(id, id.startsWith('RESPONSE') ? `RESPONSE${part}${id.slice('RESPONSE'.length)}` : `P${part}_${id}`);
    }
    for (const element of descendants(itemBody)) {
      const id = element.getAttribute('identifier');
      if (id && !renames.has(id)) {
        renames.set(id, `P${part}_${id}`);
      }
    }

    for (const element of descendants(itemBody)) {
      for (const attribute of ['identifier', 'responseIdentifier']) {
        const value = element.getAttribute(attribute);
        if (value && renames.has(value)) {
          element.setAttribute(attribute, renames.get(value) as string);
        }
      }
    }

    for (const declaration of declarations) {
      declaration.setAttribute('identifier', renames.get(declaration.getAttribute('identifier') ?? '') as string);
      if (IDENTIFIER_VALUE_TYPES.has(declaration.getAttribute('baseType') ?? '')) {
        for (const element of descendants(declaration)) {
          if (element.rawTagName === 'value') {
            element.set_content(renameTokens(element.text, renames));
          } else if (element.rawTagName === 'mapEntry') {
            element.setAttribute('mapKey', renameTokens(element.getAttribute('mapKey') ?? '', renames));
          }
        }
      }
      responseDeclarations.push(declaration.toString());
    }

    bodies.push(itemBody.innerHTML.trim());

    if (!responseProcessing) {
      warnings.push(`Interaction ${part} has no response processing; it is scored outside QTI and counts only toward MAXSCORE`);
      return;
    }
    const score = `SCORE_${part}`;
    partScores.push(score);
    const template = responseProcessing.getAttribute('template');
    if (template) {
      const responseId = renames.get('RESPONSE');
      if (!responseId) {
        throw new Error(`Interaction ${part} uses template ${template} without a RESPONSE declaration`);
      }
      rules.push(templateRules(template, responseId, score));
      return;
    }
    for (const element of descendants(responseProcessing)) {
      const id = element.getAttribute('identifier');
      if (id === 'SCORE') {
        element.setAttribute('identifier', score);
      } else if (id && renames.has(id)) {
        element.setAttribute('identifier', renames.get(id) as string);
      }
      if (element.rawTagName === 'baseValue' && IDENTIFIER_VALUE_TYPES.has(element.getAttribute('baseType') ?? '')) {
        element.set_content(renameTokens(element.text, renames));
      }
    }
    rules.push(elementChildren(responseProcessing).map((rule) => rule.toString()).join(''));
  });

  const outcomeDeclarations = [
    buildOutcomeDeclaration('SCORE', 'single', 'float', 0),
    buildOutcomeDeclaration('MAXSCORE', 'single', 'float', maxScore),
    ...partScores.map((score) => buildOutcomeDeclaration(score, 'single', 'float', 0)),
  ];
  const total =
    partScores.length > 0
      ? `<setOutcomeValue identifier="SCORE"><sum>${partScores.map((score) => `<variable identifier="${score}"/>`).join('')}</sum></setOutcomeValue>`
      : '';
  const responseProcessing =
    rules.length > 0 ? `<responseProcessing>\n    ${[...rules, total].join('\n    ')}\n  </responseProcessing>` : undefined;

  const qti = QtiBuilder.createAssessmentItem(identifier, responseDeclarations, bodies.join('\n    '), {
    title: options.title ?? title,
    pieElement: options.pieElement,
    outcomeDeclarations,
    ...(responseProcessing && { responseProcessing }),
  });
  return { qti, warnings };
}
