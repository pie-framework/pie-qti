/**
 * Mock Loggers for Testing
 * Provides test-friendly logger implementations
 */

import type { TransformLogger } from '@pie-qti/transform-types';

/**
 * Logger that captures all log messages for testing
 * Useful for verifying that expected logs were produced
 */
export class CaptureLogger implements TransformLogger {
	private logs: Array<{
		level: 'info' | 'warn' | 'error' | 'debug';
		message: string;
		itemId?: string;
		error?: Error;
	}> = [];

	info(message: string, itemId?: string): void {
		this.logs.push({ level: 'info', message, itemId });
	}

	warn(message: string, itemId?: string): void {
		this.logs.push({ level: 'warn', message, itemId });
	}

	error(message: string, error?: Error, itemId?: string): void {
		this.logs.push({ level: 'error', message, error, itemId });
	}

	debug(message: string, itemId?: string): void {
		this.logs.push({ level: 'debug', message, itemId });
	}

	// Test helper methods

	/**
	 * Get all captured logs
	 */
	getLogs() {
		return [...this.logs];
	}

	/**
	 * Get logs of a specific level
	 */
	getLogsByLevel(level: 'info' | 'warn' | 'error' | 'debug') {
		return this.logs.filter((log) => log.level === level);
	}

	/**
	 * Get logs for a specific item
	 */
	getLogsByItemId(itemId: string) {
		return this.logs.filter((log) => log.itemId === itemId);
	}

	/**
	 * Check if a message was logged
	 */
	hasMessage(message: string): boolean {
		return this.logs.some((log) => log.message.includes(message));
	}

	/**
	 * Get all error messages
	 */
	getErrors() {
		return this.logs.filter((log) => log.level === 'error');
	}

	/**
	 * Clear all captured logs
	 */
	clear(): void {
		this.logs = [];
	}

	/**
	 * Get log count
	 */
	getLogCount(): number {
		return this.logs.length;
	}
}

/**
 * Logger that outputs nothing
 * Useful for keeping test output clean
 */
export class SilentLogger implements TransformLogger {
	info(_message: string, _itemId?: string): void {
		// No-op
	}

	warn(_message: string, _itemId?: string): void {
		// No-op
	}

	error(_message: string, _error?: Error, _itemId?: string): void {
		// No-op
	}

	debug(_message: string, _itemId?: string): void {
		// No-op
	}
}

/**
 * Logger that outputs to console
 * Useful for debugging test failures
 */
export class ConsoleLogger implements TransformLogger {
	constructor(private prefix = '[TEST]') {}

	info(message: string, itemId?: string): void {
		const itemPrefix = itemId ? `[${itemId}]` : '';
		console.log(`${this.prefix}${itemPrefix} INFO:`, message);
	}

	warn(message: string, itemId?: string): void {
		const itemPrefix = itemId ? `[${itemId}]` : '';
		console.warn(`${this.prefix}${itemPrefix} WARN:`, message);
	}

	error(message: string, error?: Error, itemId?: string): void {
		const itemPrefix = itemId ? `[${itemId}]` : '';
		console.error(`${this.prefix}${itemPrefix} ERROR:`, message);
		if (error) {
			console.error(error);
		}
	}

	debug(message: string, itemId?: string): void {
		const itemPrefix = itemId ? `[${itemId}]` : '';
		console.debug(`${this.prefix}${itemPrefix} DEBUG:`, message);
	}
}
