/**
 * Mock Plugin for Testing
 */

import type {
	TransformPlugin,
	TransformInput,
	TransformResult,
	TransformOptions,
} from '@pie-qti/transform-types';

export interface MockPluginOptions {
	name?: string;
	shouldFail?: boolean;
}

export class MockPlugin implements TransformPlugin {
	readonly id: string;
	readonly sourceFormat = 'mock-source';
	readonly targetFormat = 'mock-target';
	private options: MockPluginOptions;

	constructor(options: MockPluginOptions = {}) {
		this.options = options;
		this.id = options.name || 'mock-plugin';
	}

	async transform(
		input: TransformInput,
		options?: TransformOptions,
	): Promise<TransformResult> {
		if (this.options.shouldFail) {
			throw new Error('Mock plugin failure');
		}

		return {
			content: `Mock transformed: ${input.content}`,
			metadata: {
				...input.metadata,
				transformedBy: this.id,
			},
		};
	}

	getOptions(): MockPluginOptions {
		return this.options;
	}
}

export default MockPlugin;
