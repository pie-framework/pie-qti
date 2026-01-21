/**
 * Error Classification Tests
 */

import { describe, test, expect } from 'bun:test';
import { ErrorCategory } from '@pie-qti/transform-types';
import {
	createError,
	createValidationError,
	createConfigurationError,
	createInternalError,
	createExternalError,
	shouldRetry,
	shouldShowToUser,
	shouldNotifyOps,
	getSuggestedAction,
	wrapError,
	formatError,
	isValidationError,
	isConfigurationError,
	isInternalError,
	isExternalError,
} from '../src/utils/errors';

describe('createError', () => {
	test('should create error with all properties', () => {
		const error = createError({
			message: 'Test error',
			code: 'TEST_001',
			itemId: 'item-123',
			category: ErrorCategory.VALIDATION,
			recoverable: true,
			fatal: false,
			context: { key: 'value' },
		});

		expect(error.message).toBe('Test error');
		expect(error.code).toBe('TEST_001');
		expect(error.itemId).toBe('item-123');
		expect(error.category).toBe(ErrorCategory.VALIDATION);
		expect(error.recoverable).toBe(true);
		expect(error.fatal).toBe(false);
		expect(error.context).toEqual({ key: 'value' });
	});

	test('should set defaults based on category', () => {
		const validationError = createError({
			message: 'Validation',
			category: ErrorCategory.VALIDATION,
		});
		expect(validationError.recoverable).toBe(true);
		expect(validationError.fatal).toBe(false);

		const configError = createError({
			message: 'Config',
			category: ErrorCategory.CONFIGURATION,
		});
		expect(configError.recoverable).toBe(false);
		expect(configError.fatal).toBe(true);

		const internalError = createError({
			message: 'Internal',
			category: ErrorCategory.INTERNAL,
		});
		expect(internalError.recoverable).toBe(false);
		expect(internalError.fatal).toBe(true);

		const externalError = createError({
			message: 'External',
			category: ErrorCategory.EXTERNAL,
		});
		expect(externalError.recoverable).toBe(true);
		expect(externalError.fatal).toBe(false);
	});

	test('should allow overriding defaults', () => {
		const error = createError({
			message: 'External error',
			category: ErrorCategory.EXTERNAL,
			recoverable: false,
			fatal: true,
		});

		expect(error.recoverable).toBe(false);
		expect(error.fatal).toBe(true);
	});
});

describe('Helper functions', () => {
	test('createValidationError', () => {
		const error = createValidationError('Invalid XML');

		expect(error.category).toBe(ErrorCategory.VALIDATION);
		expect(error.message).toBe('Invalid XML');
		expect(error.recoverable).toBe(true);
		expect(error.fatal).toBe(false);
	});

	test('createValidationError with options', () => {
		const error = createValidationError('Invalid XML', {
			code: 'INVALID_XML',
			itemId: 'item-123',
		});

		expect(error.code).toBe('INVALID_XML');
		expect(error.itemId).toBe('item-123');
	});

	test('createConfigurationError', () => {
		const error = createConfigurationError('Missing API key');

		expect(error.category).toBe(ErrorCategory.CONFIGURATION);
		expect(error.message).toBe('Missing API key');
		expect(error.recoverable).toBe(false);
		expect(error.fatal).toBe(true);
	});

	test('createInternalError', () => {
		const error = createInternalError('Null pointer exception');

		expect(error.category).toBe(ErrorCategory.INTERNAL);
		expect(error.recoverable).toBe(false);
		expect(error.fatal).toBe(true);
	});

	test('createExternalError', () => {
		const error = createExternalError('S3 connection timeout');

		expect(error.category).toBe(ErrorCategory.EXTERNAL);
		expect(error.recoverable).toBe(true);
		expect(error.fatal).toBe(false);
	});
});

describe('shouldRetry', () => {
	test('should return true for recoverable external errors', () => {
		const error = createExternalError('Network timeout');
		expect(shouldRetry(error)).toBe(true);
	});

	test('should return false for non-external errors', () => {
		const validationError = createValidationError('Invalid input');
		expect(shouldRetry(validationError)).toBe(false);

		const configError = createConfigurationError('Missing config');
		expect(shouldRetry(configError)).toBe(false);

		const internalError = createInternalError('Bug');
		expect(shouldRetry(internalError)).toBe(false);
	});

	test('should return false for non-recoverable external errors', () => {
		const error = createExternalError('Permanent failure', {
			recoverable: false,
		});
		expect(shouldRetry(error)).toBe(false);
	});
});

describe('shouldShowToUser', () => {
	test('should return true for validation errors', () => {
		const error = createValidationError('Invalid XML format');
		expect(shouldShowToUser(error)).toBe(true);
	});

	test('should return false for other error types', () => {
		expect(shouldShowToUser(createConfigurationError('Config error'))).toBe(false);
		expect(shouldShowToUser(createInternalError('Internal error'))).toBe(false);
		expect(shouldShowToUser(createExternalError('External error'))).toBe(false);
	});
});

describe('shouldNotifyOps', () => {
	test('should return true for configuration errors', () => {
		const error = createConfigurationError('Invalid S3 bucket');
		expect(shouldNotifyOps(error)).toBe(true);
	});

	test('should return true for fatal internal errors', () => {
		const error = createInternalError('Critical bug', { fatal: true });
		expect(shouldNotifyOps(error)).toBe(true);
	});

	test('should return false for non-fatal internal errors', () => {
		const error = createInternalError('Minor issue', { fatal: false });
		expect(shouldNotifyOps(error)).toBe(false);
	});

	test('should return false for validation and external errors', () => {
		expect(shouldNotifyOps(createValidationError('User error'))).toBe(false);
		expect(shouldNotifyOps(createExternalError('Network error'))).toBe(false);
	});
});

describe('getSuggestedAction', () => {
	test('should return appropriate action for each category', () => {
		expect(getSuggestedAction(createValidationError('Invalid'))).toBe(
			'Fix the input and try again',
		);
		expect(getSuggestedAction(createConfigurationError('Config'))).toBe(
			'Check configuration and credentials',
		);
		expect(getSuggestedAction(createInternalError('Bug'))).toBe(
			'Contact support with error details',
		);
		expect(getSuggestedAction(createExternalError('Network'))).toBe(
			'Retry the operation after a delay',
		);
	});
});

describe('wrapError', () => {
	test('should wrap Error object', () => {
		const cause = new Error('Original error');
		const wrapped = wrapError(cause, ErrorCategory.EXTERNAL);

		expect(wrapped.message).toBe('Original error');
		expect(wrapped.category).toBe(ErrorCategory.EXTERNAL);
		expect(wrapped.cause).toBe(cause);
	});

	test('should wrap non-Error values', () => {
		const wrapped = wrapError('String error', ErrorCategory.INTERNAL);

		expect(wrapped.message).toBe('String error');
		expect(wrapped.category).toBe(ErrorCategory.INTERNAL);
		expect(wrapped.cause).toBeInstanceOf(Error);
	});

	test('should include context', () => {
		const cause = new Error('Test');
		const wrapped = wrapError(cause, ErrorCategory.VALIDATION, {
			file: 'test.xml',
			line: 42,
		});

		expect(wrapped.context).toEqual({ file: 'test.xml', line: 42 });
	});
});

describe('formatError', () => {
	test('should format error with all fields', () => {
		const error = createValidationError('Test message', {
			code: 'ERR_001',
			itemId: 'item-123',
		});

		const formatted = formatError(error);
		expect(formatted).toBe('[VALIDATION] [ERR_001] [item:item-123] Test message');
	});

	test('should format error with minimal fields', () => {
		const error = createError({
			message: 'Simple error',
			category: ErrorCategory.INTERNAL,
		});

		const formatted = formatError(error);
		expect(formatted).toBe('[INTERNAL] Simple error');
	});

	test('should format error with only code', () => {
		const error = createError({
			message: 'Error with code',
			code: 'TEST_123',
			category: ErrorCategory.EXTERNAL,
		});

		const formatted = formatError(error);
		expect(formatted).toBe('[EXTERNAL] [TEST_123] Error with code');
	});
});

describe('Type checking functions', () => {
	test('isValidationError', () => {
		expect(isValidationError(createValidationError('Test'))).toBe(true);
		expect(isValidationError(createConfigurationError('Test'))).toBe(false);
		expect(isValidationError(createInternalError('Test'))).toBe(false);
		expect(isValidationError(createExternalError('Test'))).toBe(false);
	});

	test('isConfigurationError', () => {
		expect(isConfigurationError(createValidationError('Test'))).toBe(false);
		expect(isConfigurationError(createConfigurationError('Test'))).toBe(true);
		expect(isConfigurationError(createInternalError('Test'))).toBe(false);
		expect(isConfigurationError(createExternalError('Test'))).toBe(false);
	});

	test('isInternalError', () => {
		expect(isInternalError(createValidationError('Test'))).toBe(false);
		expect(isInternalError(createConfigurationError('Test'))).toBe(false);
		expect(isInternalError(createInternalError('Test'))).toBe(true);
		expect(isInternalError(createExternalError('Test'))).toBe(false);
	});

	test('isExternalError', () => {
		expect(isExternalError(createValidationError('Test'))).toBe(false);
		expect(isExternalError(createConfigurationError('Test'))).toBe(false);
		expect(isExternalError(createInternalError('Test'))).toBe(false);
		expect(isExternalError(createExternalError('Test'))).toBe(true);
	});
});

describe('Error with cause', () => {
	test('should store underlying cause', () => {
		const cause = new Error('Root cause');
		const error = createInternalError('Wrapper error', { cause });

		expect(error.cause).toBe(cause);
		expect(error.cause?.message).toBe('Root cause');
	});

	test('should work with chained errors', () => {
		const root = new Error('Root cause');
		const middle = createExternalError('Middle error', { cause: root });
		const top = createInternalError('Top error', {
			cause: middle.cause,
			context: { wrappedError: middle },
		});

		expect(top.cause).toBe(root);
		expect(top.context?.wrappedError).toBe(middle);
	});
});

describe('Real-world scenarios', () => {
	test('validation error for invalid QTI', () => {
		const error = createValidationError('Missing required <itemBody> element', {
			code: 'QTI_INVALID_STRUCTURE',
			itemId: 'item-456',
			context: {
				file: 'assessment.xml',
				line: 42,
			},
		});

		expect(shouldShowToUser(error)).toBe(true);
		expect(shouldRetry(error)).toBe(false);
		expect(shouldNotifyOps(error)).toBe(false);
		expect(formatError(error)).toContain('VALIDATION');
	});

	test('configuration error for missing credentials', () => {
		const error = createConfigurationError('AWS credentials not configured', {
			code: 'CONFIG_MISSING_CREDENTIALS',
			context: {
				service: 'S3',
				region: 'us-east-1',
			},
		});

		expect(shouldShowToUser(error)).toBe(false);
		expect(shouldRetry(error)).toBe(false);
		expect(shouldNotifyOps(error)).toBe(true);
		expect(getSuggestedAction(error)).toBe('Check configuration and credentials');
	});

	test('external error for S3 timeout', () => {
		const networkError = new Error('ETIMEDOUT');
		const error = createExternalError('Failed to upload to S3', {
			code: 'S3_TIMEOUT',
			cause: networkError,
			context: {
				bucket: 'my-bucket',
				key: 'transformed/item-789.json',
			},
		});

		expect(shouldShowToUser(error)).toBe(false);
		expect(shouldRetry(error)).toBe(true);
		expect(shouldNotifyOps(error)).toBe(false);
		expect(getSuggestedAction(error)).toBe('Retry the operation after a delay');
	});

	test('internal error for unexpected state', () => {
		const error = createInternalError('Plugin returned null unexpectedly', {
			code: 'INTERNAL_NULL_RESULT',
			itemId: 'item-999',
			context: {
				pluginId: 'vendor-acme',
				operation: 'transform',
			},
		});

		expect(shouldShowToUser(error)).toBe(false);
		expect(shouldRetry(error)).toBe(false);
		expect(shouldNotifyOps(error)).toBe(true);
		expect(getSuggestedAction(error)).toBe('Contact support with error details');
	});
});
