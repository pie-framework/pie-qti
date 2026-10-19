/**
 * Mock Plugin fixture for plugin-loader tests.
 *
 * Lives on disk (unlike the shared mocks in @pie-qti/test-utils) because the
 * loader under test imports modules from a module URL. Implements the current
 * TransformPlugin contract.
 */

import type {
	TransformPlugin,
	TransformInput,
	TransformOutput,
	TransformContext,
} from '@pie-qti/transform-types';

export interface MockPluginOptions {
	name?: string;
	shouldFail?: boolean;
}

export class MockPlugin implements TransformPlugin {
	readonly id: string;
	readonly version = '1.0.0';
	readonly name: string;
	readonly sourceFormat = 'mock-source';
	readonly targetFormat = 'mock-target';
	private options: MockPluginOptions;

	constructor(options: MockPluginOptions = {}) {
		this.options = options;
		this.id = options.name || 'mock-plugin';
		this.name = this.id;
	}

	async canHandle(): Promise<boolean> {
		return true;
	}

	async transform(
		input: TransformInput,
		_context: TransformContext,
	): Promise<TransformOutput> {
		if (this.options.shouldFail) {
			throw new Error('Mock plugin failure');
		}

		return {
			items: [
				{
					id: 'mock-item',
					config: { id: 'mock-item', models: [], elements: {} },
					content: `Mock transformed: ${input.content}`,
				},
			],
			format: this.targetFormat,
			metadata: {
				sourceFormat: this.sourceFormat,
				targetFormat: this.targetFormat,
				pluginId: this.id,
				timestamp: new Date(),
				itemCount: 1,
				processingTime: 0,
			},
		};
	}

	getOptions(): MockPluginOptions {
		return this.options;
	}
}

export default MockPlugin;
