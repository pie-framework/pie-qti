/**
 * Base Generator
 *
 * Abstract base class for PIE → QTI generators with common functionality
 */

import type { PieModel } from '@pie-qti/transform-types';
import type { GeneratorContext, GeneratorResult, PieToQtiGenerator } from './types.js';

/**
 * Abstract base class for generators
 */
export abstract class BaseGenerator implements PieToQtiGenerator {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly version: string;

  /**
   * Default implementation checks if model.element matches generator id
   */
  canHandle(model: PieModel): boolean {
    if (!model.element) {
      return false;
    }
    return model.element === this.id;
  }

  /**
   * Generate QTI XML from PIE model
   * Subclasses must implement this
   */
  abstract generate(context: GeneratorContext): Promise<GeneratorResult> | GeneratorResult;

  /**
   * Helper: Log a warning
   */
  protected warn(context: GeneratorContext, message: string): void {
    context.logger?.warn(`[${this.id}] ${message}`);
  }

  /**
   * Helper: Log info
   */
  protected info(context: GeneratorContext, message: string): void {
    context.logger?.info(`[${this.id}] ${message}`);
  }

  /**
   * Helper: Log debug
   */
  protected debug(context: GeneratorContext, message: string): void {
    context.logger?.debug(`[${this.id}] ${message}`);
  }

  /**
   * Helper: Create a result with warnings
   */
  protected createResult(qti: string, warnings: string[] = []): GeneratorResult {
    return {
      qti,
      metadata: warnings.length > 0 ? { warnings } : undefined,
    };
  }

  /**
   * Helper: Extract element name from full element identifier
   * e.g., '@pie-element/multiple-choice' -> 'multiple-choice'
   */
  protected getElementName(elementType: string): string {
    return elementType.includes('/')
      ? elementType.split('/').pop() || elementType
      : elementType;
  }
}
