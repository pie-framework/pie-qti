/**
 * Reading QTI `selectPointInteraction`, including the Renaissance custom interactions that
 * ride on it.
 *
 * Renaissance QTI does not introduce a custom element for its graphical item types. It
 * carries them on a *standard* `selectPointInteraction` discriminated by `@class`, with
 * configuration in a child `<object>`'s `<param valuetype="DATA">` entries and the answer
 * key as JSON in `<correctResponse>/<value>`:
 *
 * ```xml
 * <selectPointInteraction responseIdentifier="RESPONSE" maxChoices="1" class="numberLine">
 *   <prompt><div>Place a point on the number line to show the location of 5.4.</div></prompt>
 *   <object data="n/a" type="n/a">
 *     <param name="minValue" valuetype="DATA" value="4" />
 * ```
 *
 * Those embedded JSON payloads use **PIE's own model vocabulary**: the number-line tool codes
 * (`PF`, `LFF`, … `REP`) are the same set `pie-elements-ng` -
 * `packages/elements-react/number-line/src/author/defaults.ts` lists as `availableTools`, the
 * graphing marks match that element's `completeMark`/`equalMarks` shapes (`{x,y}` for `point`,
 * `{from,to}` for `segment`/`ray`/`line`/`vector`, `{root,edge}` for `circle`/`parabola`/`sine`,
 * `{points}` for `polygon`), and the `chartType` values match charting's. That correspondence
 * is what makes conversion faithful rather than invented — it is an observation about these
 * payloads, not a claim about how the files were produced.
 *
 * Only the *plain* case has no PIE target: a bare `selectPointInteraction`, meaning "select a
 * point on an image", has no element in the library, so it still fails closed.
 *
 * Shapes are taken from the `Vendor Sample Items Custom QTI 2.2` package published as the
 * partner QTI intake reference (CONTOOL-2113).
 */

import type { HTMLElement } from 'node-html-parser';
import { parse } from 'node-html-parser';

export interface SelectPointVendorClass {
  /** `@class` value as authored, matched case-sensitively. */
  className: string;
  /** What the interaction asks the student to do, in plain language. */
  description: string;
  /** The PIE element this class converts into. */
  pieElement: string;
}

/**
 * The `@class` values Renaissance QTI uses on `selectPointInteraction`.
 *
 * Adding a class needs an entry here *and* a transformer wired into the registry's dispatch
 * table — this list is the recognition half, not the conversion half.
 */
export const SELECT_POINT_VENDOR_CLASSES: readonly SelectPointVendorClass[] = [
  {
    className: 'numberLine',
    description: 'number-line point, line, and ray placement',
    pieElement: '@pie-element/number-line',
  },
  {
    className: 'chart',
    description: 'data plotting (histogram, bar, dot plot, line plot)',
    pieElement: '@pie-element/charting',
  },
  {
    className: 'graph',
    description: 'coordinate-plane graphing (points, segments, rays, polygons, curves)',
    pieElement: '@pie-element/graphing',
  },
];

const VENDOR_CLASSES_BY_NAME = new Map(
  SELECT_POINT_VENDOR_CLASSES.map((entry) => [entry.className, entry])
);

export interface SelectPointDescription {
  /** The `@class` value the interaction declares, when it declares one. */
  className?: string;
  /** The recognized vendor class, when `className` is one this module knows. */
  vendorClass?: SelectPointVendorClass;
  /**
   * Distinct `<param name>` keys carried in the interaction's `<object>` config block, in
   * document order. Deduplicated because a repeating key is how these shapes express a list —
   * a `chart` with nine categories declares nine `category` params, and repeating the name
   * nine times in a diagnostic obscures the other keys rather than adding anything.
   */
  configParams: string[];
}

/**
 * Read the vendor discriminator and config keys off a `selectPointInteraction`.
 *
 * Pass `interaction` when the caller already has the specific element — in a composite item
 * the first `selectPointInteraction` in the XML need not be the unit being transformed.
 */
export function describeSelectPointInteraction(
  qtiXml: string,
  interaction?: HTMLElement
): SelectPointDescription {
  const element = interaction ?? findSelectPointInteraction(qtiXml);
  if (!element) {
    return { configParams: [] };
  }
  const className = element.getAttribute('class')?.trim();
  const configParams = [...new Set(readParamEntries(element).map(([name]) => name))];

  return {
    ...(className ? { className } : {}),
    ...(className && VENDOR_CLASSES_BY_NAME.has(className)
      ? { vendorClass: VENDOR_CLASSES_BY_NAME.get(className) }
      : {}),
    configParams,
  };
}

/** Config values from the interaction's `<object>` block, keyed by `<param name>`. */
export interface SelectPointParams {
  /** The first value declared for `name`, or `undefined`. */
  text(name: string): string | undefined;
  /** Every value declared for `name`, in document order — these shapes repeat keys as lists. */
  all(name: string): string[];
  /** `text(name)` parsed as a number, or `undefined` when absent or non-numeric. */
  number(name: string): number | undefined;
  /** `text(name)` as a boolean, `'true'` being the only true value. */
  flag(name: string): boolean | undefined;
  /** A comma-separated value split into trimmed, non-empty entries. */
  list(name: string): string[];
}

export function readSelectPointParams(interaction: HTMLElement): SelectPointParams {
  const entries = readParamEntries(interaction);
  const all = (name: string) =>
    entries.filter(([paramName]) => paramName === name).map(([, value]) => value);
  const text = (name: string) => all(name)[0];

  return {
    text,
    all,
    number(name) {
      const raw = text(name);
      if (raw === undefined || raw.trim() === '') {
        return undefined;
      }
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : undefined;
    },
    flag(name) {
      const raw = text(name);
      return raw === undefined ? undefined : raw.trim() === 'true';
    },
    list(name) {
      return (text(name) ?? '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
    },
  };
}

/**
 * A tick interval as these packages express it, alongside the `tickIntervalType` PIE uses.
 *
 * The three literal forms are documented in the source packages themselves — the sample XML
 * carries the comment `stepValue: integer (1), decimal (0.1), faction (1/10)` — and the
 * distinction is not recoverable from the number alone, since `1/10` and `0.1` are the same
 * value written differently. `pie-elements-ng` - `number-line/src/controller/utils.ts`
 * (`reloadTicksData`) re-derives and clamps these against the domain and width, so emitting
 * the authored intent is both sufficient and preferable to pre-normalizing here.
 */
export interface TickInterval {
  value: number;
  tickIntervalType: 'Integer' | 'Decimal' | 'Fraction';
}

const FRACTION_PATTERN = /^(-?\d+)\s*\/\s*(\d+)$/;

export function parseTickInterval(raw: string | undefined): TickInterval | undefined {
  const text = raw?.trim();
  if (!text) {
    return undefined;
  }
  const fraction = FRACTION_PATTERN.exec(text);
  if (fraction) {
    const numerator = Number(fraction[1]);
    const denominator = Number(fraction[2]);
    if (denominator === 0 || !Number.isFinite(numerator) || !Number.isFinite(denominator)) {
      return undefined;
    }
    return { value: numerator / denominator, tickIntervalType: 'Fraction' };
  }
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return {
    value: parsed,
    tickIntervalType: Number.isInteger(parsed) && !text.includes('.') ? 'Integer' : 'Decimal',
  };
}

/**
 * The `<correctResponse>` values for `responseIdentifier`, each parsed from JSON.
 *
 * A value that is not JSON is skipped rather than throwing: one malformed entry should cost
 * that entry, not the item. `declared` still counts it, so a caller can report the shortfall
 * instead of silently shipping a short answer key.
 */
export function readJsonCorrectResponses(
  assessmentItem: HTMLElement,
  responseIdentifier: string
): { values: unknown[]; declared: number } {
  const declaration = assessmentItem
    .getElementsByTagName('responseDeclaration')
    .find((candidate) => candidate.getAttribute('identifier') === responseIdentifier);
  const rawValues =
    declaration
      ?.getElementsByTagName('correctResponse')[0]
      ?.getElementsByTagName('value')
      .map((value) => value.text.trim())
      .filter(Boolean) ?? [];

  const values: unknown[] = [];
  for (const raw of rawValues) {
    const parsed = tryParseJson(raw);
    if (parsed !== undefined) {
      values.push(parsed);
    }
  }
  return { values, declared: rawValues.length };
}

/** Parse every value declared for a repeated JSON-valued param, skipping malformed entries. */
export function readJsonParams(params: SelectPointParams, name: string): unknown[] {
  const parsed: unknown[] = [];
  for (const raw of params.all(name)) {
    const value = tryParseJson(raw);
    if (value !== undefined) {
      parsed.push(value);
    }
  }
  return parsed;
}

/**
 * The `details` body for the unsupported-interaction error: what this item actually is, so a
 * reviewer is not sent looking for missing markup.
 */
export function selectPointUnsupportedDetails(description: SelectPointDescription): string {
  const lines: string[] = [plainLine(description)];
  if (description.configParams.length > 0) {
    lines.push(`Configuration observed: ${description.configParams.join(', ')}.`);
  }
  return lines.join('\n');
}

function plainLine(description: SelectPointDescription): string {
  const declared = description.className
    ? `Unrecognized class "${description.className}".`
    : 'No class discriminator, so this is plain QTI graphic point selection.';
  return `${declared} Composer has no PIE element for selecting a point on an image.`;
}

function tryParseJson(raw: string): unknown | undefined {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function readParamEntries(interaction: HTMLElement): [string, string][] {
  return interaction
    .getElementsByTagName('param')
    .map(
      (param) =>
        [param.getAttribute('name'), param.getAttribute('value') ?? ''] as [
          string | undefined,
          string,
        ]
    )
    .filter((entry): entry is [string, string] => Boolean(entry[0]));
}

function findSelectPointInteraction(qtiXml: string): HTMLElement | undefined {
  return parse(qtiXml).getElementsByTagName('selectPointInteraction')[0];
}
