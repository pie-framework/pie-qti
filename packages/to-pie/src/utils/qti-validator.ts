/**
 * QTI XML validation.
 *
 * Three tiers, in the order they run, because each one is only meaningful if the
 * previous one passed:
 *
 * 1. **Well-formedness** (`fast-xml-parser`) — fatal and short-circuiting. This is the
 *    one failure Composer can *introduce*: a QTI-stage transform that emits broken XML
 *    must not reach the conversion. Every later check reads the document as a parsed or
 *    schema-matched tree, so running them over malformed XML reports misleading detail
 *    about a document that cannot be parsed at all.
 * 2. **Structural rules** — QTI-specific checks that give a far better message than the
 *    schema's equivalent. Only the ones nothing downstream can recover from are *errors*:
 *    a missing root element is, a missing `identifier` is **not** (the conversion derives
 *    one, so it is a warning — see `validateStructure`).
 * 3. **XSD schema validation** against the vendored official IMS schemas
 *    (`schemas/qti/`, see that directory's README) via `xmllint-wasm`. This closes the
 *    gap the header used to disclaim: `imsqti_v2p1.xsd` / `imsqti_v2p2.xsd` really are
 *    consulted now, offline, with the full 48-file import closure preloaded.
 *
 * **XSD findings are warnings by default, and that is a measured decision, not
 * timidity.** Run over the third-party corpus (17,175 packages), a strict pass rejects
 * roughly a quarter of QTI 2.1 items that convert correctly today — overwhelmingly
 * vendor extension attributes and elements (`pointsPossible`, `extendedResponseParts`)
 * and the omitted-but-required `timeDependent`. Making those blocking would stop real
 * imports to enforce a conformance standard partner content has never met, so they are
 * reported as warnings carrying full schema diagnostics and the *stage verdict* stays
 * driven by well-formedness and structure. Callers that want a strict gate pass
 * `xsdSeverity: 'error'`. ADR 004 § "Validity gates" records the measurement.
 *
 * **Cost note, which shapes the API.** The compile dominates, and it is per *compile*,
 * not per document: validating 1 item and validating 200 cost the same. The two roots
 * are very different, though, so quoting one number would be misleading:
 *
 * | Root | Compile | Why |
 * | --- | --- | --- |
 * | `imsqti_v2p1` | **~0.58s** | pulls MathML 2 only |
 * | `imsqti_v2p2` | **~3.07s** | pulls MathML 3 *and* HTML5, SSML and APIP |
 *
 * QTI 2.1 is the overwhelmingly common case in real partner content, so the typical cost
 * is the cheap one; QTI 3.0 pays the 2.2 price because normalization rewrites it into the
 * 2.2 namespace. Either way `validateBatch` compiles once and validates the whole batch,
 * and it is the entry point for anything package-sized — a per-item loop over
 * `validate()` would multiply the compile cost by the item count.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLValidator } from 'fast-xml-parser';
import { memoryPages, validateXML } from 'xmllint-wasm';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  /**
   * Whether XSD validation actually ran and judged this document. `false` means the
   * result carries no schema-conformance claim — the caller asked for no XSD pass, or
   * the version could not be resolved to a vendored schema. Distinguishing "checked and
   * clean" from "not checked" is what the three-valued stage verdict is built on; see
   * `CONTEXT.md` § Stage Verdict.
   */
  schemaValidated: boolean;
}

export interface ValidationError {
  line?: number;
  column?: number;
  message: string;
  level: 'error' | 'fatal';
}

export interface ValidationWarning {
  line?: number;
  column?: number;
  message: string;
}

/**
 * The local name of the document's root element, or `null` when it holds no element.
 *
 * Root-anchored on purpose. Asking "does the string `<assessmentTest` appear anywhere"
 * conflates *being* a test with merely *mentioning* one, and the two are not the same
 * document: an item whose prompt or rubric quotes test markup would answer yes. Comments
 * are stripped first for the same reason — `<!-- <assessmentTest> -->` is prose, not a
 * root. XML declarations, doctypes, processing instructions and CDATA all open with `<?`
 * or `<!` and are skipped by the lookahead; CDATA cannot legally precede the root element,
 * so stripping comments is enough to reach it. The namespace-prefix tolerance mirrors
 * `extractItemId`, because real packages ship both prefixed and default-namespaced roots.
 */
export function qtiDocumentRootName(xml: string): string | null {
  const withoutComments = xml.replace(/<!--[\s\S]*?-->/g, '');
  return /<(?![?!])\s*(?:[\w.-]+:)?([\w.-]+)/.exec(withoutComments)?.[1] ?? null;
}

/**
 * Whether the document *is* a QTI test definition, covering the QTI 2.x `assessmentTest`
 * and the QTI 3.0 `qti-assessment-test` spelling.
 *
 * Used to keep test documents out of the item conversion lane. A package that declares a
 * test resource under an item resource type used to convert silently: the payload reached
 * the `builtin.assessment-test` handler, came back as a `PieAssessment`, and was reported
 * as a transformed *item* with no warning — so a test structure would have been written
 * into `item_versions.config` as a junk item. ADR 004 is explicit that a construct with no
 * standard item equivalent is invalid input rather than something to smuggle to PIE.
 */
export function isAssessmentTestDocument(xml: string): boolean {
  const root = qtiDocumentRootName(xml);
  return root === 'assessmentTest' || root === 'qti-assessment-test';
}

/** The QTI versions with a vendored schema root. */
export type QtiSchemaVersion = '2.1' | '2.2';

export interface ValidatorOptions {
  /**
   * Whether to run XSD validation. Defaults to `true`. Turning it off leaves tiers 1-2
   * (well-formedness + structural rules) and reports `schemaValidated: false`.
   */
  xsd?: boolean;

  /**
   * How XSD findings are reported. `'warning'` (default) keeps a non-conformant but
   * convertible package moving; `'error'` makes schema conformance blocking. See the
   * header for why the default is not `'error'`.
   */
  xsdSeverity?: 'warning' | 'error';

  /** Override the vendored schema directory. Intended for tests. */
  schemaDir?: string;

  /** Whether to validate strictly (fail on warnings). */
  strict?: boolean;
}

const SCHEMA_ROOT_BY_VERSION: Record<QtiSchemaVersion, string> = {
  '2.1': 'imsqti_v2p1.xsd',
  '2.2': 'imsqti_v2p2.xsd',
};

/**
 * `schemas/` sits at the package root and `dist/` mirrors `src/`, so this resolves
 * identically whether the module is loaded from source (bun, tests) or from the build.
 */
const DEFAULT_SCHEMA_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'schemas',
  'qti'
);

interface SchemaFile {
  fileName: string;
  contents: string;
}

/**
 * The vendored closure is ~3.6 MiB across 48 files and never changes at runtime, so it
 * is read once per process and reused across every call.
 */
const schemaFilesByDir = new Map<string, SchemaFile[]>();

function loadSchemaFiles(schemaDir: string): SchemaFile[] {
  const cached = schemaFilesByDir.get(schemaDir);
  if (cached) {
    return cached;
  }
  const files = fs
    .readdirSync(schemaDir)
    .filter((file) => file.endsWith('.xsd'))
    .map((file) => ({
      fileName: file,
      contents: fs.readFileSync(path.join(schemaDir, file), 'utf8'),
    }));
  schemaFilesByDir.set(schemaDir, files);
  return files;
}

/**
 * Compiling the QTI closure needs materially more than xmllint-wasm's 32 MiB default
 * ceiling; MathML 3 alone is a large chunk of the graph.
 */
const INITIAL_MEMORY_PAGES = 256 * memoryPages.MiB;
const MAX_MEMORY_PAGES = 2 * memoryPages.GiB;

/** One document handed to the schema processor, plus the caller's key for it. */
interface BatchDocument {
  key: string;
  xml: string;
  version: QtiSchemaVersion;
}

/**
 * QTI XML Validator
 */
export class QtiValidator {
  private options: Required<Omit<ValidatorOptions, 'schemaDir'>> & { schemaDir: string };

  constructor(options: ValidatorOptions = {}) {
    this.options = {
      xsd: options.xsd ?? true,
      xsdSeverity: options.xsdSeverity ?? 'warning',
      schemaDir: options.schemaDir ?? DEFAULT_SCHEMA_DIR,
      strict: options.strict ?? false,
    };
  }

  /**
   * Validate a single QTI document. Prefer `validateBatch` for more than one document:
   * the schema compile dominates and batching pays it once.
   */
  async validate(xml: string, options?: Partial<ValidatorOptions>): Promise<ValidationResult> {
    const results = await this.validateDocuments([{ key: 'document', xml }], options);
    const result = results.get('document');
    if (!result) {
      throw new Error('validateDocuments did not return a result for the document');
    }
    return result;
  }

  /**
   * Validate many documents with a single schema compile.
   *
   * Documents are grouped by detected QTI version, since each version needs its own
   * schema root; the cost is therefore one compile per *distinct version present*, not
   * one per document.
   */
  async validateBatch(
    files: Array<{ path: string; content: string }>
  ): Promise<Map<string, ValidationResult>> {
    return await this.validateDocuments(
      files.map((file) => ({ key: file.path, xml: file.content }))
    );
  }

  private async validateDocuments(
    documents: Array<{ key: string; xml: string }>,
    overrides?: Partial<ValidatorOptions>
  ): Promise<Map<string, ValidationResult>> {
    const options = { ...this.options, ...overrides };
    const results = new Map<string, ValidationResult>();
    const schemaCandidates: BatchDocument[] = [];

    for (const document of documents) {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
        schemaValidated: false,
      };
      results.set(document.key, result);

      // Tier 1: a real parse. Fatal, and it short-circuits the rest.
      const wellFormed = XMLValidator.validate(document.xml, { allowBooleanAttributes: true });
      if (wellFormed !== true) {
        result.valid = false;
        result.errors.push({
          message: `XML is not well-formed: ${wellFormed.err.msg}`,
          level: 'fatal',
          ...(typeof wellFormed.err.line === 'number' ? { line: wellFormed.err.line } : {}),
          ...(typeof wellFormed.err.col === 'number' ? { column: wellFormed.err.col } : {}),
        });
        continue;
      }

      // Tier 2: structural rules.
      this.validateStructure(document.xml, result);

      // Tier 3 is only reachable for a version we hold a schema for.
      const version = detectQtiSchemaVersion(document.xml);
      if (options.xsd && version) {
        schemaCandidates.push({ key: document.key, xml: document.xml, version });
      }
    }

    if (schemaCandidates.length > 0) {
      await this.applySchemaValidation(schemaCandidates, results, options);
    }

    if (options.strict) {
      for (const result of results.values()) {
        if (result.warnings.length > 0) {
          result.valid = false;
        }
      }
    }

    return results;
  }

  private async applySchemaValidation(
    candidates: BatchDocument[],
    results: Map<string, ValidationResult>,
    options: { schemaDir: string; xsdSeverity: 'warning' | 'error' }
  ): Promise<void> {
    let schemaFiles: SchemaFile[];
    try {
      schemaFiles = loadSchemaFiles(options.schemaDir);
    } catch (error) {
      // An unreadable schema directory is a deployment fault. Report it on every
      // affected document as "not judged" rather than letting it surface as invalid
      // content or take the whole validation call down.
      const message = error instanceof Error ? error.message : String(error);
      for (const candidate of candidates) {
        results.get(candidate.key)?.warnings.push({
          message: `QTI schema validation could not run: ${message}`,
        });
      }
      return;
    }

    const byVersion = new Map<QtiSchemaVersion, BatchDocument[]>();
    for (const candidate of candidates) {
      const group = byVersion.get(candidate.version) ?? [];
      group.push(candidate);
      byVersion.set(candidate.version, group);
    }

    for (const [version, group] of byVersion) {
      const rootName = SCHEMA_ROOT_BY_VERSION[version];
      const root = schemaFiles.find((file) => file.fileName === rootName);
      if (!root) {
        // A missing vendored root is a deployment fault, not a content fault: say so on
        // every affected document rather than implying the content was judged.
        for (const candidate of group) {
          const result = results.get(candidate.key);
          if (result) {
            result.warnings.push({
              message: `QTI ${version} schema '${rootName}' is not present in ${options.schemaDir}; schema validation was skipped`,
            });
          }
        }
        continue;
      }

      // Synthetic, index-based names: xmllint attributes findings by file name, and
      // caller-supplied paths may contain characters it would misread as arguments.
      const nameByIndex = group.map((_, index) => `qti-${index}.xml`);
      let validation: Awaited<ReturnType<typeof validateXML>>;
      try {
        validation = await validateXML({
          xml: group.map((candidate, index) => ({
            fileName: nameByIndex[index] as string,
            contents: candidate.xml,
          })),
          schema: [root],
          preload: schemaFiles,
          initialMemoryPages: INITIAL_MEMORY_PAGES,
          maxMemoryPages: MAX_MEMORY_PAGES,
        });
      } catch (error) {
        // The processor itself failed (schema failed to compile, out of memory). That is
        // our fault, not the document's, so it must not read as invalid content.
        const message = error instanceof Error ? error.message : String(error);
        for (const candidate of group) {
          results.get(candidate.key)?.warnings.push({
            message: `QTI ${version} schema validation could not run: ${message.split('\n')[0] ?? message}`,
          });
        }
        continue;
      }

      const indexByName = new Map(nameByIndex.map((name, index) => [name, index]));
      for (const candidate of group) {
        const result = results.get(candidate.key);
        if (result) {
          result.schemaValidated = true;
        }
      }

      for (const failure of validation.errors) {
        // Warnings about our own vendored closure are not findings about the content.
        if (/Schemas parser warning/i.test(failure.rawMessage)) {
          continue;
        }
        // xmllint prints a per-document summary line in addition to the real findings.
        if (/\bfails to validate\s*$/i.test(failure.rawMessage.trim())) {
          continue;
        }
        const fileName = failure.loc?.fileName;
        const index = fileName === undefined ? undefined : indexByName.get(fileName);
        if (index === undefined) {
          continue;
        }
        const candidate = group[index];
        if (!candidate) {
          continue;
        }
        const result = results.get(candidate.key);
        if (!result) {
          continue;
        }
        const line = failure.loc?.lineNumber;
        const message = `QTI ${version} schema: ${failure.message}`;
        if (options.xsdSeverity === 'error') {
          result.valid = false;
          result.errors.push({
            message,
            level: 'error',
            ...(typeof line === 'number' ? { line } : {}),
          });
        } else {
          result.warnings.push({
            message,
            ...(typeof line === 'number' ? { line } : {}),
          });
        }
      }
    }
  }

  /**
   * Perform structural validation checks.
   *
   * These overlap the schema deliberately. They stay *errors* while schema findings are
   * warnings, so the checks that were blocking before XSD landed keep blocking, and they
   * name the problem in QTI terms rather than as a content-model mismatch.
   */
  private validateStructure(xml: string, result: ValidationResult): void {
    const hasAssessmentItem = xml.includes('<assessmentItem');
    const hasAssessmentTest = xml.includes('<assessmentTest');
    const hasAssessmentPassage =
      xml.includes('<assessmentPassage') || xml.includes('<assessmentStimulus');

    if (!hasAssessmentItem && !hasAssessmentTest && !hasAssessmentPassage) {
      result.valid = false;
      result.errors.push({
        message:
          'Missing required root element (assessmentItem, assessmentTest, or assessmentPassage)',
        level: 'error',
      });
    }

    const hasNamespace =
      xml.includes('xmlns="http://www.imsglobal.org/xsd/imsqti_v2p') ||
      xml.includes('xmlns:qti="http://www.imsglobal.org/xsd/imsqti_v2p');

    if (!hasNamespace) {
      result.warnings.push({
        message:
          'Missing QTI 2.x namespace declaration. Expected: http://www.imsglobal.org/xsd/imsqti_v2p1 or http://www.imsglobal.org/xsd/imsqti_v2p2',
      });
    }

    if (hasAssessmentItem) {
      // An absent *or empty* identifier. The old pattern required `[^"]+`, so it treated
      // `identifier=""` as "no match" and reported it identically — which is right, since
      // both are equally unusable as an identity.
      const identifierMatch = xml.match(/<assessmentItem[^>]+identifier="([^"]*)"/);
      if (!identifierMatch?.[1]?.trim()) {
        // **A warning, not an error, and that is deliberate.** The conversion derives an id
        // when the item declares none — manifest resource id first, deterministic content
        // hash otherwise — so this is recoverable and does not warrant the one verdict no
        // reviewer acknowledgement can clear. It is common in real content: every item in
        // sampled Baltimore County packages ships `identifier=""`, and blocking them meant
        // an `invalid` stage verdict for packages that convert correctly.
        //
        // This was only safe to downgrade *after* the derivation was fixed. Previously an
        // unanchored regex in the converter matched the first `identifier=` anywhere in the
        // document, so those items all took a `responseDeclaration`'s id and 150 distinct
        // items shared the identity `RESPONSE` — letting them through then would have
        // merged them on import rather than merely mislabelling them.
        result.warnings.push({
          message:
            'assessmentItem has no usable "identifier" attribute; the conversion will derive ' +
            'one from the manifest resource id or item content',
        });
      }

      const titleMatch = xml.match(/<assessmentItem[^>]+title="([^"]+)"/);
      if (!titleMatch) {
        result.warnings.push({
          message: 'assessmentItem missing recommended "title" attribute',
        });
      }
    }

    if (hasAssessmentItem && xml.includes('Interaction')) {
      const hasResponseDeclaration = xml.includes('<responseDeclaration');
      if (!hasResponseDeclaration) {
        result.warnings.push({
          message: 'Interactive item missing responseDeclaration',
        });
      }
    }

    // Well-formedness (tag balance, unescaped entities, attribute quoting) is handled by
    // the parser in `validateDocuments` before this runs. The regex `checkWellFormed`
    // that used to sit here is deliberately gone rather than kept alongside: it counted
    // tags with a regex that miscounts namespaced and hyphenated names, and its
    // ampersand check tested only the first entity in a run, so a bare `&` after a valid
    // one passed. Both produced warnings only, so neither ever blocked anything.
  }

  /**
   * Get validation summary statistics
   */
  static getValidationSummary(results: Map<string, ValidationResult>): {
    total: number;
    valid: number;
    invalid: number;
    errors: number;
    warnings: number;
    schemaValidated: number;
  } {
    let valid = 0;
    let invalid = 0;
    let totalErrors = 0;
    let totalWarnings = 0;
    let schemaValidated = 0;

    for (const result of results.values()) {
      if (result.valid) {
        valid++;
      } else {
        invalid++;
      }
      totalErrors += result.errors.length;
      totalWarnings += result.warnings.length;
      if (result.schemaValidated) {
        schemaValidated++;
      }
    }

    return {
      total: results.size,
      valid,
      invalid,
      errors: totalErrors,
      warnings: totalWarnings,
      schemaValidated,
    };
  }
}

/**
 * Resolve the QTI namespace a document declares to a vendored schema root.
 *
 * Namespace-driven rather than guessing: a document that declares neither QTI 2.x
 * namespace returns `null`, and the caller reports "not judged" instead of validating it
 * against a schema it never claimed to follow. QTI 3.0 lands here as `null` — it is
 * judged after lexical normalization into QTI-2 shape, which is the seam's job, not the
 * validator's (ADR 004 § "Validity gates").
 */
export function detectQtiSchemaVersion(xml: string): QtiSchemaVersion | null {
  if (xml.includes('imsqti_v2p2')) {
    return '2.2';
  }
  if (xml.includes('imsqti_v2p1')) {
    return '2.1';
  }
  return null;
}

/**
 * Convenience function to validate QTI XML
 */
export async function validateQti(
  xml: string,
  options?: ValidatorOptions
): Promise<ValidationResult> {
  const validator = new QtiValidator(options);
  return validator.validate(xml);
}

/**
 * Convenience function to validate a package's worth of QTI XML with one schema compile.
 */
export async function validateQtiBatch(
  files: Array<{ path: string; content: string }>,
  options?: ValidatorOptions
): Promise<Map<string, ValidationResult>> {
  const validator = new QtiValidator(options);
  return validator.validateBatch(files);
}
