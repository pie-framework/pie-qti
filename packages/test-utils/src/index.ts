/**
 * @pie-qti/test-utils
 *
 * Shared test utilities for PIE-QTI packages
 */

// Mock implementations
export { MockStorageBackend } from './mocks/storage.js';
export { MockTransformPlugin, createMockPlugin } from './mocks/plugin.js';
export { SilentLogger } from '@pie-qti/logger/server';

// Test helpers
export {
	createQtiWrapper,
	createResponseDeclaration,
	createChoiceInteraction,
} from './helpers/qti.js';

export {
	expectValidPieModel,
	expectSuccessfulTransform,
} from './helpers/assertions.js';
