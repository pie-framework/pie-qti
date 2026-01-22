/**
 * Test Engine Factory
 * Helpers for creating pre-configured TransformEngine instances for testing
 */

import type {
	TransformPlugin,
	StorageBackend,
	TransformLogger,
	WorkflowOrchestrator,
} from '@pie-qti/transform-types';
import { TransformEngine } from '@pie-qti/transform-core';
import { SilentLogger } from '../mocks/logger.js';

export interface TestEngineOptions {
	/**
	 * Plugins to register
	 */
	plugins?: TransformPlugin[];

	/**
	 * Storage backend to use
	 */
	storage?: StorageBackend;

	/**
	 * Logger instance (defaults to SilentLogger)
	 */
	logger?: TransformLogger;

	/**
	 * Workflow orchestrator
	 */
	orchestrator?: WorkflowOrchestrator;
}

/**
 * Create a TransformEngine configured for testing
 *
 * @example
 * ```typescript
 * const engine = createTestEngine({
 *   plugins: [new MyPlugin()],
 *   storage: new MockStorageBackend(),
 * });
 * ```
 */
export function createTestEngine(options: TestEngineOptions = {}): TransformEngine {
	const engine = new TransformEngine(options.orchestrator, options.storage);

	// Register plugins
	for (const plugin of options.plugins || []) {
		engine.use(plugin);
	}

	return engine;
}
