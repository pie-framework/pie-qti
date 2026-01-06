/**
 * Generator Registry
 *
 * Central registry for managing PIE → QTI generators
 */

import type { PieModel } from '@pie-qti/transform-types';
import type {
  GeneratorFactory,
  GeneratorRegistration,
  PieToQtiGenerator,
} from './types.js';

interface RegisteredGenerator {
  generator: PieToQtiGenerator;
  priority: number;
}

/**
 * Registry for PIE → QTI generators
 */
export class GeneratorRegistry {
  private generators: Map<string, RegisteredGenerator> = new Map();
  private wildcardGenerators: RegisteredGenerator[] = [];

  /**
   * Register a generator
   *
   * @param registration - Generator registration options
   * @returns this for chaining
   */
  register(registration: GeneratorRegistration): this {
    const generator =
      typeof registration.generator === 'function'
        ? registration.generator()
        : registration.generator;

    const priority = registration.priority ?? 0;
    const override = registration.override ?? false;

    // Check for existing registration
    if (this.generators.has(generator.id) && !override) {
      throw new Error(
        `Generator for '${generator.id}' already registered. Use override: true to replace.`
      );
    }

    this.generators.set(generator.id, { generator, priority });
    return this;
  }

  /**
   * Register a wildcard generator that can handle any element type
   * Useful for fallback/custom interaction generators
   *
   * @param generator - The generator or factory
   * @param priority - Priority (lower = last resort)
   * @returns this for chaining
   */
  registerWildcard(
    generator: PieToQtiGenerator | GeneratorFactory,
    priority: number = -1000
  ): this {
    const gen =
      typeof generator === 'function' ? generator() : generator;
    this.wildcardGenerators.push({ generator: gen, priority });
    // Sort by priority (highest first)
    this.wildcardGenerators.sort((a, b) => b.priority - a.priority);
    return this;
  }

  /**
   * Unregister a generator
   *
   * @param elementType - The element type to unregister
   * @returns true if a generator was removed
   */
  unregister(elementType: string): boolean {
    return this.generators.delete(elementType);
  }

  /**
   * Find the best generator for a given PIE model
   *
   * @param model - The PIE model to find a generator for
   * @returns The best matching generator, or null if none found
   */
  findGenerator(model: PieModel): PieToQtiGenerator | null {
    // First, try to find by explicit element type
    if (model.element) {
      const registered = this.generators.get(model.element);
      if (registered && registered.generator.canHandle(model)) {
        return registered.generator;
      }
    }

    // Second, try all registered generators (sorted by priority)
    const sortedGenerators = Array.from(this.generators.values())
      .sort((a, b) => b.priority - a.priority);

    for (const { generator } of sortedGenerators) {
      if (generator.canHandle(model)) {
        return generator;
      }
    }

    // Finally, try wildcard generators
    for (const { generator } of this.wildcardGenerators) {
      if (generator.canHandle(model)) {
        return generator;
      }
    }

    return null;
  }

  /**
   * Get a generator by element type
   *
   * @param elementType - The element type
   * @returns The generator, or null if not found
   */
  getGenerator(elementType: string): PieToQtiGenerator | null {
    return this.generators.get(elementType)?.generator ?? null;
  }

  /**
   * Check if a generator is registered for an element type
   *
   * @param elementType - The element type
   * @returns true if a generator is registered
   */
  hasGenerator(elementType: string): boolean {
    return this.generators.has(elementType);
  }

  /**
   * Get all registered element types
   *
   * @returns Array of element types
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.generators.keys());
  }

  /**
   * Clear all registered generators
   */
  clear(): void {
    this.generators.clear();
    this.wildcardGenerators = [];
  }

  /**
   * Create a clone of this registry
   *
   * @returns A new registry with the same generators
   */
  clone(): GeneratorRegistry {
    const clone = new GeneratorRegistry();

    // Copy regular generators
    for (const [key, value] of this.generators.entries()) {
      clone.generators.set(key, { ...value });
    }

    // Copy wildcard generators
    clone.wildcardGenerators = [...this.wildcardGenerators];

    return clone;
  }
}

/**
 * Default global generator registry
 */
export const defaultRegistry = new GeneratorRegistry();
