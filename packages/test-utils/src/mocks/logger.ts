/**
 * Mock Loggers for Testing
 * Provides test-friendly logger implementations
 */

import type { ServerLogger, LogContext } from '@pie-qti/logger/server';

// The no-op logger is identical to the one @pie-qti/logger ships; re-export it
// rather than keeping a second copy.
export { SilentLogger } from '@pie-qti/logger/server';

/**
 * Logger that captures all log messages for testing
 * Useful for verifying that expected logs were produced
 */
export class CaptureLogger implements ServerLogger {
	private logs: Array<{
		level: 'info' | 'warn' | 'error' | 'debug';
		message: string;
		context: LogContext;
	}> = [];

	info(message: string, context?: LogContext): void {
		this.logs.push({ level: 'info', message, context: context ?? {} });
	}

	warn(message: string, context?: LogContext): void {
		this.logs.push({ level: 'warn', message, context: context ?? {} });
	}

	error(message: string, context?: LogContext): void {
		this.logs.push({ level: 'error', message, context: context ?? {} });
	}

	debug(message: string, context?: LogContext): void {
		this.logs.push({ level: 'debug', message, context: context ?? {} });
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
		return this.logs.filter((log) => log.context.itemId === itemId);
	}

	/**
	 * Get logs by context property
	 */
	getLogsByContext(key: keyof LogContext, value: unknown) {
		return this.logs.filter((log) => log.context[key] === value);
	}

	/**
	 * Check if a message was logged
	 */
	hasMessage(message: string): boolean {
		return this.logs.some((log) => log.message.includes(message));
	}

	/**
	 * Check if any log has specific context
	 */
	hasContext(key: keyof LogContext, value: unknown): boolean {
		return this.logs.some((log) => log.context[key] === value);
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

export { ConsoleLogger } from '@pie-qti/logger/server';
