/**
 * Error Utilities
 * Helpers for creating and handling categorized transform errors
 */

import type { TransformError } from '@pie-qti/transform-types';
import { ErrorCategory } from '@pie-qti/transform-types';

/**
 * Options for creating a transform error
 */
export interface CreateErrorOptions {
	message: string;
	code?: string;
	itemId?: string;
	category: ErrorCategory;
	recoverable?: boolean;
	cause?: Error;
	context?: Record<string, unknown>;
}

/**
 * Create a categorized transform error
 */
export function createError(options: CreateErrorOptions): TransformError {
	return {
		message: options.message,
		code: options.code,
		itemId: options.itemId,
		category: options.category,
		recoverable: options.recoverable ?? isRecoverableByDefault(options.category),
		cause: options.cause,
		context: options.context,
	};
}

/**
 * Create a validation error (user input issue)
 */
export function createValidationError(
	message: string,
	options?: Partial<Omit<CreateErrorOptions, 'message' | 'category'>>,
): TransformError {
	return createError({
		message,
		category: ErrorCategory.VALIDATION,
		recoverable: true,
		...options,
	});
}

/**
 * Create a configuration error (setup issue)
 */
export function createConfigurationError(
	message: string,
	options?: Partial<Omit<CreateErrorOptions, 'message' | 'category'>>,
): TransformError {
	return createError({
		message,
		category: ErrorCategory.CONFIGURATION,
		recoverable: false,
		...options,
	});
}

/**
 * Create an internal error (bug or unexpected state)
 */
export function createInternalError(
	message: string,
	options?: Partial<Omit<CreateErrorOptions, 'message' | 'category'>>,
): TransformError {
	return createError({
		message,
		category: ErrorCategory.INTERNAL,
		recoverable: false,
		...options,
	});
}

/**
 * Create an external error (service/network failure)
 */
export function createExternalError(
	message: string,
	options?: Partial<Omit<CreateErrorOptions, 'message' | 'category'>>,
): TransformError {
	return createError({
		message,
		category: ErrorCategory.EXTERNAL,
		recoverable: true,
		...options,
	});
}

/**
 * Check if error is recoverable by default based on category
 */
function isRecoverableByDefault(category: ErrorCategory): boolean {
	switch (category) {
		case ErrorCategory.VALIDATION:
		case ErrorCategory.EXTERNAL:
			return true;
		case ErrorCategory.CONFIGURATION:
		case ErrorCategory.INTERNAL:
			return false;
	}
}

/**
 * Check if error should be retried
 */
export function shouldRetry(error: TransformError): boolean {
	return error.recoverable && error.category === ErrorCategory.EXTERNAL;
}

/**
 * Check if error should be shown to user
 */
export function shouldShowToUser(error: TransformError): boolean {
	return error.category === ErrorCategory.VALIDATION;
}

/**
 * Check if error requires ops team notification
 */
export function shouldNotifyOps(error: TransformError): boolean {
	return (
		error.category === ErrorCategory.CONFIGURATION ||
		error.category === ErrorCategory.INTERNAL
	);
}

/**
 * Get suggested action for error
 */
export function getSuggestedAction(error: TransformError): string {
	switch (error.category) {
		case ErrorCategory.VALIDATION:
			return 'Fix the input and try again';
		case ErrorCategory.CONFIGURATION:
			return 'Check configuration and credentials';
		case ErrorCategory.INTERNAL:
			return 'Contact support with error details';
		case ErrorCategory.EXTERNAL:
			return 'Retry the operation after a delay';
	}
}

/**
 * Wrap a caught error as a TransformError
 */
export function wrapError(
	caught: unknown,
	category: ErrorCategory,
	context?: Record<string, unknown>,
): TransformError {
	const cause = caught instanceof Error ? caught : new Error(String(caught));

	return createError({
		message: cause.message,
		category,
		cause,
		context,
	});
}

/**
 * Format error for logging
 */
export function formatError(error: TransformError): string {
	const parts = [
		`[${error.category.toUpperCase()}]`,
		error.code ? `[${error.code}]` : '',
		error.itemId ? `[item:${error.itemId}]` : '',
		error.message,
	];

	return parts.filter(Boolean).join(' ');
}

/**
 * Check if error is validation error
 */
export function isValidationError(error: TransformError): boolean {
	return error.category === ErrorCategory.VALIDATION;
}

/**
 * Check if error is configuration error
 */
export function isConfigurationError(error: TransformError): boolean {
	return error.category === ErrorCategory.CONFIGURATION;
}

/**
 * Check if error is internal error
 */
export function isInternalError(error: TransformError): boolean {
	return error.category === ErrorCategory.INTERNAL;
}

/**
 * Check if error is external error
 */
export function isExternalError(error: TransformError): boolean {
	return error.category === ErrorCategory.EXTERNAL;
}
