/**
 * Format Detector Registry
 * Priority-based registry for pluggable format detection
 */

import type { TransformFormat } from '@pie-qti/transform-types';

/**
 * Format detector interface
 * Detects if input matches a specific format
 */
export interface FormatDetector {
	/** Unique identifier for this detector */
	readonly id: string;

	/** Format ID this detector identifies */
	readonly formatId: TransformFormat;

	/**
	 * Priority for detection order
	 * Higher priority detectors are checked first
	 */
	readonly priority: number;

	/**
	 * Detect if input matches this format
	 * @param input Input content (string or object)
	 * @returns true if format matches, false otherwise
	 */
	detect(input: string | object): boolean | Promise<boolean>;
}

/**
 * Registry for format detectors
 * Maintains priority-ordered list of format detectors
 */
export class FormatDetectorRegistry {
	private detectors: FormatDetector[] = [];

	/**
	 * Register a format detector
	 * Detectors are automatically sorted by priority
	 */
	register(detector: FormatDetector): void {
		this.detectors.push(detector);
		// Sort by priority (highest first)
		this.detectors.sort((a, b) => b.priority - a.priority);
	}

	/**
	 * Detect format of input
	 * Tries each detector in priority order until one matches
	 * @param input Input content to detect
	 * @returns Format ID if detected, null if no match
	 */
	async detectFormat(input: string | object): Promise<TransformFormat | null> {
		for (const detector of this.detectors) {
			try {
				const matches = await detector.detect(input);
				if (matches) {
					return detector.formatId;
				}
			} catch (error) {
				// Detector error - skip to next detector
				console.warn(`Format detector ${detector.id} failed:`, error);
			}
		}
		return null;
	}

	/**
	 * Get all registered detectors
	 * @returns Array of registered detectors (sorted by priority)
	 */
	getDetectors(): ReadonlyArray<FormatDetector> {
		return this.detectors;
	}

	/**
	 * Clear all registered detectors
	 */
	clear(): void {
		this.detectors = [];
	}
}
