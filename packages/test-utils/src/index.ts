/**
 * @pie-qti/test-utils
 *
 * Shared test utilities for PIE-QTI packages
 */

// Mock implementations
export { MockStorageBackend } from './mocks/storage.js';
export {
	MockTransformPlugin,
	createMockPlugin,
	createRejectingPlugin,
	createFailingPlugin,
} from './mocks/plugin.js';
export type { MockPluginOptions } from './mocks/plugin.js';
export {
	CaptureLogger,
	SilentLogger,
	ConsoleLogger,
} from './mocks/logger.js';

// Test helpers
export { createTestEngine } from './helpers/engine.js';
export type { TestEngineOptions } from './helpers/engine.js';

export {
	loadFixture,
	loadSharedFixture,
	loadFixtureBuffer,
	loadSharedFixtureBuffer,
} from './helpers/fixtures.js';

export {
	parseQtiItem,
	createQtiWrapper,
	createResponseDeclaration,
	createOutcomeDeclaration,
	createChoiceInteraction,
	parseElement,
} from './helpers/qti.js';

export {
	expectValidPieModel,
	expectSuccessfulTransform,
	expectLosslessRoundTrip,
	expectValidChoiceInteraction,
	expectTransformError,
	expectMetadata,
	expectArrayContains,
} from './helpers/assertions.js';
