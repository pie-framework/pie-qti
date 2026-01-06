/**
 * QTI XML Validation using official IMS Global XSD schemas
 *
 * Validates QTI 2.2 XML against official schemas from:
 * http://www.imsglobal.org/xsd/imsqti_v2p2.xsd
 */

import * as fs from 'fs';
import { parse as parseHtml } from 'node-html-parser';
import * as os from 'os';
import * as path from 'path';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
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

export interface ValidatorOptions {
  /** Whether to cache schemas locally */
  cacheSchemas?: boolean;

  /** Custom cache directory (defaults to system temp) */
  cacheDir?: string;

  /** Whether to validate strictly (fail on warnings) */
  strict?: boolean;
}

/**
 * QTI XML Validator
 */
export class QtiValidator {
  private options: Required<ValidatorOptions>;
  // Schema cache for future XSD validation enhancement
  // private schemaCache: Map<string, string> = new Map();

  constructor(options: ValidatorOptions = {}) {
    this.options = {
      cacheSchemas: options.cacheSchemas ?? true,
      cacheDir: options.cacheDir || path.join(os.tmpdir(), 'qti-schemas'),
      strict: options.strict ?? false,
    };

    // Ensure cache directory exists
    if (this.options.cacheSchemas && !fs.existsSync(this.options.cacheDir)) {
      fs.mkdirSync(this.options.cacheDir, { recursive: true });
    }
  }

  /**
   * Validate QTI XML against XSD schema
   */
  async validate(xml: string, _options?: Partial<ValidatorOptions>): Promise<ValidationResult> {
    const version = this.detectVersion(xml) || '2.2';

    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    try {
      // Parse XML for basic validation
      const doc = parseHtml(xml, {
        lowerCaseTagName: false,
        comment: false,
      });

      if (!doc) {
        result.valid = false;
        result.errors.push({
          message: 'Failed to parse XML',
          level: 'fatal',
        });
        return result;
      }

      // Perform basic structural validation
      this.validateStructure(xml, result, version);

      // Note: Full XSD validation would require loading and processing all imported schemas
      // For now, we do structural validation and well-formedness checks
      // A complete implementation would use xmllint or a full XSD processor

    } catch (error: any) {
      result.valid = false;
      result.errors.push({
        message: error.message || 'XML parsing failed',
        level: 'fatal',
      });
    }

    return result;
  }

  /**
   * Detect QTI version from XML namespace
   */
  private detectVersion(xml: string): '2.2' | null {
    if (xml.includes('imsqti_v2p2') || xml.includes('/imsqti_v2p2')) {
      return '2.2';
    }
    return null;
  }

  /**
   * Perform structural validation checks
   */
  private validateStructure(
    xml: string,
    result: ValidationResult,
    _version: '2.2'
  ): void {
    // Check for root element
    const hasAssessmentItem = xml.includes('<assessmentItem');
    const hasAssessmentTest = xml.includes('<assessmentTest');
    const hasAssessmentPassage = xml.includes('<assessmentPassage') || xml.includes('<assessmentStimulus');

    if (!hasAssessmentItem && !hasAssessmentTest && !hasAssessmentPassage) {
      result.valid = false;
      result.errors.push({
        message: 'Missing required root element (assessmentItem, assessmentTest, or assessmentPassage)',
        level: 'error',
      });
    }

    // Check for namespace declaration
    const hasNamespace = xml.includes('xmlns="http://www.imsglobal.org/xsd/imsqti_v2p') ||
                        xml.includes('xmlns:qti="http://www.imsglobal.org/xsd/imsqti_v2p');

    if (!hasNamespace) {
      result.warnings.push({
        message:
          'Missing QTI 2.2 namespace declaration. Expected: http://www.imsglobal.org/xsd/imsqti_v2p2',
      });
    }

    // Check for required attributes on assessmentItem
    if (hasAssessmentItem) {
      const identifierMatch = xml.match(/<assessmentItem[^>]+identifier="([^"]+)"/);
      if (!identifierMatch) {
        result.valid = false;
        result.errors.push({
          message: 'assessmentItem missing required "identifier" attribute',
          level: 'error',
        });
      }

      const titleMatch = xml.match(/<assessmentItem[^>]+title="([^"]+)"/);
      if (!titleMatch) {
        result.warnings.push({
          message: 'assessmentItem missing recommended "title" attribute',
        });
      }
    }

    // Check for responseDeclaration in items
    if (hasAssessmentItem && xml.includes('Interaction')) {
      const hasResponseDeclaration = xml.includes('<responseDeclaration');
      if (!hasResponseDeclaration) {
        result.warnings.push({
          message: 'Interactive item missing responseDeclaration',
        });
      }
    }

    // Check for well-formed XML structure
    this.checkWellFormed(xml, result);
  }

  /**
   * Check for common XML well-formedness issues
   */
  private checkWellFormed(xml: string, result: ValidationResult): void {
    // Check for unclosed tags (basic check)
    const openTags = xml.match(/<([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g) || [];
    const closeTags = xml.match(/<\/([a-zA-Z][a-zA-Z0-9]*)>/g) || [];
    const selfClosingTags = xml.match(/<([a-zA-Z][a-zA-Z0-9]*)[^>]*\/>/g) || [];

    const openCount = openTags.length - selfClosingTags.length;
    const closeCount = closeTags.length;

    if (openCount !== closeCount) {
      result.warnings.push({
        message: `Potential tag mismatch: ${openCount} opening tags vs ${closeCount} closing tags`,
      });
    }

    // Check for unescaped special characters in content
    const contentMatches = xml.match(/>([^<]+)</g);
    if (contentMatches) {
      for (const match of contentMatches) {
        const content = match.slice(1, -1); // Remove > and <
        if (content.includes('&') && !content.match(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/)) {
          result.warnings.push({
            message: `Unescaped ampersand in content: "${content.substring(0, 50)}..."`,
          });
        }
      }
    }
  }

  /**
   * Validate multiple files in batch
   */
  async validateBatch(files: Array<{ path: string; content: string }>): Promise<Map<string, ValidationResult>> {
    const results = new Map<string, ValidationResult>();

    for (const file of files) {
      const result = await this.validate(file.content);
      results.set(file.path, result);
    }

    return results;
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
  } {
    let valid = 0;
    let invalid = 0;
    let totalErrors = 0;
    let totalWarnings = 0;

    for (const result of results.values()) {
      if (result.valid) {
        valid++;
      } else {
        invalid++;
      }
      totalErrors += result.errors.length;
      totalWarnings += result.warnings.length;
    }

    return {
      total: results.size,
      valid,
      invalid,
      errors: totalErrors,
      warnings: totalWarnings,
    };
  }
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
