/**
 * Generator Types
 *
 * Defines the pluggable generator architecture for PIE → QTI transformations
 */

import type { PieItem, PieModel } from '@pie-qti/transform-types';

/**
 * Context passed to generators
 */
export interface GeneratorContext {
  /** The complete PIE item being transformed */
  pieItem: PieItem;
  /** The specific model to generate QTI for */
  model: PieModel;
  /** Optional logger for debugging */
  logger?: {
    debug: (message: string) => void;
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
  };
  /** Optional additional context */
  [key: string]: any;
}

/**
 * Result from a generator
 */
export interface GeneratorResult {
  /** The generated QTI XML (without PIE extension embedding) */
  qti: string;
  /** Optional metadata about the generation */
  metadata?: {
    /** Warnings encountered during generation */
    warnings?: string[];
    /** PIE-specific features that couldn't be mapped to standard QTI */
    unmappedFeatures?: string[];
    /** Additional generator-specific metadata */
    [key: string]: any;
  };
}

/**
 * Base interface for all PIE → QTI generators
 */
export interface PieToQtiGenerator {
  /**
   * Unique identifier for this generator
   * Should match the PIE element type it handles (e.g., '@pie-element/multiple-choice')
   */
  readonly id: string;

  /**
   * Human-readable name for this generator
   */
  readonly name: string;

  /**
   * Version of this generator
   */
  readonly version: string;

  /**
   * Check if this generator can handle the given PIE model
   *
   * @param model - The PIE model to check
   * @returns true if this generator can handle the model
   */
  canHandle(model: PieModel): boolean;

  /**
   * Generate QTI XML from PIE model
   *
   * @param context - Generation context with PIE item and model
   * @returns Generated QTI XML and optional metadata
   */
  generate(context: GeneratorContext): Promise<GeneratorResult> | GeneratorResult;
}

/**
 * Factory function for creating generators
 */
export type GeneratorFactory = () => PieToQtiGenerator;

/**
 * Generator registration options
 */
export interface GeneratorRegistration {
  /** The generator instance or factory */
  generator: PieToQtiGenerator | GeneratorFactory;
  /** Priority for this generator (higher = preferred when multiple match) */
  priority?: number;
  /** Whether to override an existing generator for the same element type */
  override?: boolean;
}
