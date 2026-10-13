import { parse } from 'node-html-parser';
import { transformPassage } from './transformers/passage.js';
import {
  type AccessibilityCatalog,
  prepareQtiAccessibility,
} from './utils/accessibility-catalogs.js';
import { unwrapCdataSections } from './utils/cdata.js';
import { pieElementTagForModel, piePlaceholderMarkup } from './utils/pie-markup.js';
import { isQti3Document, normalizeQti3ToQti2 } from './utils/qti3-normalize.js';

/**
 * A converted passage's PIE config: complete, so a consumer renders it without knowing it
 * came from a stimulus document rather than from an item.
 */
export interface ConvertedQtiPassageConfig {
  id: string;
  markup: string;
  elements: Record<string, string>;
  models: Array<Record<string, unknown>>;
}

export interface ConvertedQtiPassage {
  title: string;
  config: ConvertedQtiPassageConfig;
  /**
   * The stimulus's accessibility catalogs. They sit on the passage, where a player registers a
   * passage's catalogs; a player reads catalogs on a passage's models for items only.
   */
  accessibilityCatalogs?: AccessibilityCatalog[];
}

const PIE_PASSAGE_ELEMENT = '@pie-element/passage';
const PIE_PASSAGE_TAG = 'passage';

export type ConvertQtiPassageResult =
  | { status: 'converted'; passage: ConvertedQtiPassage }
  | { status: 'failed'; code: string; message: string };

export interface ConvertQtiPassageDocumentInput {
  /** The stimulus document: QTI 2.x, QTI 3.0, or an HTML document the package lists as web content. */
  xml: string;
  /**
   * Identifier the config and its models are keyed by, such as the stimulus's manifest resource
   * identifier.
   */
  passageId: string;
  /** Package-relative path of the document; names a passage whose source declares no title. */
  sourcePath?: string;
}

/**
 * Convert one QTI stimulus document into a PIE passage config.
 *
 * This is the single conversion for passage content. Package analysis converts every passage
 * resource through it, and a host previewing one passage straight from an archive calls it
 * directly, so a passage renders the same from either.
 *
 * Failure is a return value, not a throw: a package whose stimulus document holds no passage
 * content should cost that one passage, and both callers want to report it and carry on.
 */
export function convertQtiPassageDocument(
  input: ConvertQtiPassageDocumentInput
): ConvertQtiPassageResult {
  const qtiXml = isQti3Document(input.xml) ? normalizeQti3ToQti2(input.xml) : input.xml;
  const accessibility = prepareQtiAccessibility(qtiXml);
  let pieItem: ReturnType<typeof transformPassage>;
  try {
    pieItem = transformPassage(accessibility.xml, input.passageId, {
      baseId: input.passageId,
      ...(input.sourcePath ? { defaultTitle: titleFromSourcePath(input.sourcePath) } : {}),
    });
  } catch (error) {
    const html = convertHtmlPassageDocument(input);
    if (html) {
      return { status: 'converted', passage: html };
    }
    return {
      status: 'failed',
      code: 'passage_content_not_found',
      message: error instanceof Error ? error.message : String(error),
    };
  }

  const elements = stringRecord(pieItem.config.elements);
  const models = (pieItem.config.models ?? []) as Array<Record<string, unknown>>;
  if (!elements || models.length === 0) {
    return {
      status: 'failed',
      code: 'passage_config_incomplete',
      message: `Passage ${input.passageId} converted to a PIE config with no renderable model.`,
    };
  }

  // Model ids come out of `transformPassage` as a fresh UUID per call, which would make every
  // re-analysis of an unchanged package produce a different config and read as a content change
  // to everything downstream that compares configs. Keyed off the passage instead, so the same
  // document converts to the same config. The element is named by its tag, as an item's is once
  // player-ready: a player rejects a model whose element `elements` does not declare.
  const identified = models.map((model, index) => ({
    ...model,
    id: `${input.passageId}:${index}`,
    element:
      typeof model.element === 'string'
        ? (pieElementTagForModel(model.element, elements) ?? model.element)
        : model.element,
  }));

  const markup = identified
    .map((model) => piePlaceholderMarkup(model, elements))
    .filter((element): element is string => Boolean(element))
    .join('');
  if (!markup) {
    return {
      status: 'failed',
      code: 'passage_config_incomplete',
      message: `Passage ${input.passageId} converted to models its config declares no element for.`,
    };
  }

  return {
    status: 'converted',
    passage: {
      title: passageTitle(pieItem, input),
      config: { id: input.passageId, markup, elements, models: identified },
      ...(accessibility.catalogs.length > 0
        ? { accessibilityCatalogs: accessibility.catalogs }
        : {}),
    },
  };
}

/**
 * A passage the package declares as web content rather than as a QTI stimulus.
 *
 * The common shape, not an edge case: an item points at a passage through
 * `<object data="reading.html">` and the manifest carries the target as
 * `type="webcontent"`, so there is no `assessmentStimulus` for the QTI extraction to find. The
 * document's body becomes the passage text.
 */
function convertHtmlPassageDocument(
  input: ConvertQtiPassageDocumentInput
): ConvertedQtiPassage | null {
  const document = parse(unwrapCdataSections(input.xml));
  const body = document.getElementsByTagName('body')[0];
  const text = (body ?? document).innerHTML.trim();
  if (!text || !(body ?? document).structuredText.trim()) {
    return null;
  }

  const title =
    document.getElementsByTagName('title')[0]?.structuredText.trim() ||
    (input.sourcePath ? titleFromSourcePath(input.sourcePath) : input.passageId);
  const modelId = `${input.passageId}:0`;
  const model = {
    id: modelId,
    element: PIE_PASSAGE_TAG,
    passages: [{ title, subtitle: '', author: '', text, teacherInstructions: '' }],
    titleEnabled: true,
    subtitleEnabled: false,
    authorEnabled: false,
    textEnabled: true,
    teacherInstructionsEnabled: false,
  };
  const elements = { [PIE_PASSAGE_TAG]: `${PIE_PASSAGE_ELEMENT}@latest` };

  return {
    title,
    config: {
      id: input.passageId,
      markup: piePlaceholderMarkup(model, elements) ?? '',
      elements,
      models: [model],
    },
  };
}

function passageTitle(
  pieItem: ReturnType<typeof transformPassage>,
  input: ConvertQtiPassageDocumentInput
): string {
  const model = pieItem.config.models?.[0] as Record<string, unknown> | undefined;
  const passages = Array.isArray(model?.passages) ? model.passages : [];
  const first = passages[0];
  const title =
    first && typeof first === 'object' && !Array.isArray(first)
      ? (first as Record<string, unknown>).title
      : null;
  if (typeof title === 'string' && title.trim()) {
    return title.trim();
  }
  return input.sourcePath ? titleFromSourcePath(input.sourcePath) : input.passageId;
}

function titleFromSourcePath(sourcePath: string): string {
  return (
    sourcePath
      .split('/')
      .pop()
      ?.replace(/\.[^.]+$/, '') || sourcePath
  );
}

function stringRecord(value: unknown): Record<string, string> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0 || entries.some(([, entry]) => typeof entry !== 'string')) {
    return null;
  }
  return Object.fromEntries(entries) as Record<string, string>;
}
