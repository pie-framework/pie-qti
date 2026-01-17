/**
 * Mock Format Detector for Testing
 */

import type { FormatDetector } from '@pie-qti/transform-types';

export class MockDetector implements FormatDetector {
	readonly id = 'mock-detector';
	readonly formatId = 'mock-format';
	readonly priority: number;

	constructor(options: { priority?: number } = {}) {
		this.priority = options.priority || 50;
	}

	detect(input: string | object): boolean {
		if (typeof input === 'string') {
			return input.includes('MOCK_FORMAT');
		}
		return false;
	}
}

export default MockDetector;
