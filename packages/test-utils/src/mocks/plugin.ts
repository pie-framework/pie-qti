/**
 * Mock Transform Plugin for Testing
 * Provides configurable mock implementation of TransformPlugin
 */

import type {
	TransformPlugin,
	TransformInput,
	TransformOutput,
	TransformFormat,
	TransformMetadata,
} from '@pie-qti/transform-types';

export interface MockPluginOptions {
	/**
	 * Custom canHandle implementation
	 */
	canHandle?: (input: TransformInput) => Promise<boolean>;

	/**
	 * Custom transform implementation
	 */
	transform?: (input: TransformInput) => Promise<TransformOutput>;

	/**
	 * Plugin priority (higher = selected first)
	 */
	priority?: number;

	/**
	 * Plugin version
	 */
	version?: string;

	/**
	 * Plugin name (defaults to `Mock ${id}`)
	 */
	name?: string;

	/**
	 * Whether canHandle should return true by default
	 */
	defaultCanHandle?: boolean;

	/**
	 * Mock items to return from transform
	 */
	mockItems?: any[];

	/**
	 * Additional metadata to include in transform output
	 */
	mockMetadata?: Record<string, any>;
}

/**
 * Mock transform plugin for testing
 * Provides configurable behavior for testing plugin registry, engine, etc.
 */
export class MockTransformPlugin implements TransformPlugin {
	readonly id: string;
	readonly version: string;
	readonly name: string;
	readonly sourceFormat: TransformFormat;
	readonly targetFormat: TransformFormat;
	readonly priority?: number;

	private options: MockPluginOptions;
	private transformCallCount = 0;
	private canHandleCallCount = 0;
	private lastInput?: TransformInput;

	constructor(
		id: string,
		sourceFormat: TransformFormat,
		targetFormat: TransformFormat,
		options: MockPluginOptions = {},
	) {
		this.id = id;
		this.sourceFormat = sourceFormat;
		this.targetFormat = targetFormat;
		this.version = options.version ?? '1.0.0';
		this.name = options.name ?? `Mock ${id}`;
		this.priority = options.priority;
		this.options = options;
	}

	async canHandle(input: TransformInput): Promise<boolean> {
		this.canHandleCallCount++;

		if (this.options.canHandle) {
			return this.options.canHandle(input);
		}

		return this.options.defaultCanHandle ?? true;
	}

	async transform(input: TransformInput): Promise<TransformOutput> {
		this.transformCallCount++;
		this.lastInput = input;

		if (this.options.transform) {
			return this.options.transform(input);
		}

		// Default mock transform output
		const metadata: TransformMetadata = {
			sourceFormat: this.sourceFormat,
			targetFormat: this.targetFormat,
			pluginId: this.id,
			timestamp: new Date(),
			itemCount: this.options.mockItems?.length ?? 0,
			processingTime: 0,
			...this.options.mockMetadata,
		};

		return {
			items: this.options.mockItems ?? [],
			format: this.targetFormat,
			metadata,
		};
	}

	// Test helper methods

	/**
	 * Get the number of times transform was called
	 */
	getTransformCallCount(): number {
		return this.transformCallCount;
	}

	/**
	 * Get the number of times canHandle was called
	 */
	getCanHandleCallCount(): number {
		return this.canHandleCallCount;
	}

	/**
	 * Get the last input passed to transform
	 */
	getLastInput(): TransformInput | undefined {
		return this.lastInput;
	}

	/**
	 * Reset call counters
	 */
	resetCounters(): void {
		this.transformCallCount = 0;
		this.canHandleCallCount = 0;
		this.lastInput = undefined;
	}
}

/**
 * Create a simple mock plugin with minimal configuration
 * Helper function for common test cases
 */
export function createMockPlugin(
	id: string,
	sourceFormat: TransformFormat,
	targetFormat: TransformFormat,
	priority?: number,
): MockTransformPlugin {
	return new MockTransformPlugin(id, sourceFormat, targetFormat, { priority });
}

/**
 * Create a mock plugin that always rejects canHandle
 */
export function createRejectingPlugin(
	id: string,
	sourceFormat: TransformFormat,
	targetFormat: TransformFormat,
): MockTransformPlugin {
	return new MockTransformPlugin(id, sourceFormat, targetFormat, {
		canHandle: async () => false,
	});
}

/**
 * Create a mock plugin that throws an error during transform
 */
export function createFailingPlugin(
	id: string,
	sourceFormat: TransformFormat,
	targetFormat: TransformFormat,
	errorMessage = 'Mock transform failed',
): MockTransformPlugin {
	return new MockTransformPlugin(id, sourceFormat, targetFormat, {
		transform: async () => {
			throw new Error(errorMessage);
		},
	});
}
