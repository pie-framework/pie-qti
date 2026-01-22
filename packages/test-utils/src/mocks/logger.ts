/**
 * Mock Loggers for Testing
 * Provides test-friendly logger implementations
 */

import type { TransformLogger, LogContext } from '@pie-qti/transform-types';

/**
 * Logger that captures all log messages for testing
 * Useful for verifying that expected logs were produced
 */
export class CaptureLogger implements TransformLogger {
	private logs: Array<{
		level: 'info' | 'warn' | 'error' | 'debug';
		message: string;
		context: LogContext;
	}> = [];

	info(message: string, itemId?: string, context?: LogContext): void {
		this.logs.push({ level: 'info', message, context: this.mergeContext(itemId, context) });
	}

	warn(message: string, itemId?: string, context?: LogContext): void {
		this.logs.push({ level: 'warn', message, context: this.mergeContext(itemId, context) });
	}

	error(message: string, itemId?: string, context?: LogContext): void {
		this.logs.push({ level: 'error', message, context: this.mergeContext(itemId, context) });
	}

	debug(message: string, itemId?: string, context?: LogContext): void {
		this.logs.push({ level: 'debug', message, context: this.mergeContext(itemId, context) });
	}

	private mergeContext(itemId?: string, context?: LogContext): LogContext {
		if (!itemId && !context) return {};
		return {
			...context,
			itemId: itemId || context?.itemId,
		};
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

/**
 * Logger that outputs nothing
 * Useful for keeping test output clean
 */
export class SilentLogger implements TransformLogger {
	info(_message: string, _itemId?: string, _context?: LogContext): void {
		// No-op
	}

	warn(_message: string, _itemId?: string, _context?: LogContext): void {
		// No-op
	}

	error(_message: string, _itemId?: string, _context?: LogContext): void {
		// No-op
	}

	debug(_message: string, _itemId?: string, _context?: LogContext): void {
		// No-op
	}
}

/**
 * Logger that outputs to console
 * Useful for debugging test failures
 */
export class ConsoleLogger implements TransformLogger {
	constructor(private prefix = '[TEST]') {}

	info(message: string, itemId?: string, context?: LogContext): void {
		const ctx = this.mergeContext(itemId, context);
		const contextStr = this.formatContext(ctx);
		console.log(`${this.prefix}${contextStr} INFO:`, message);
	}

	warn(message: string, itemId?: string, context?: LogContext): void {
		const ctx = this.mergeContext(itemId, context);
		const contextStr = this.formatContext(ctx);
		console.warn(`${this.prefix}${contextStr} WARN:`, message);
	}

	error(message: string, itemId?: string, context?: LogContext): void {
		const ctx = this.mergeContext(itemId, context);
		const contextStr = this.formatContext(ctx);
		console.error(`${this.prefix}${contextStr} ERROR:`, message);
	}

	debug(message: string, itemId?: string, context?: LogContext): void {
		const ctx = this.mergeContext(itemId, context);
		const contextStr = this.formatContext(ctx);
		console.debug(`${this.prefix}${contextStr} DEBUG:`, message);
	}

	private mergeContext(itemId?: string, context?: LogContext): LogContext {
		if (!itemId && !context) return {};
		return {
			...context,
			itemId: itemId || context?.itemId,
		};
	}

	private formatContext(context: LogContext): string {
		if (!context || Object.keys(context).length === 0) return '';

		const parts: string[] = [];
		if (context.itemId) parts.push(`item:${context.itemId}`);
		if (context.sessionId) parts.push(`session:${context.sessionId}`);
		if (context.userId) parts.push(`user:${context.userId}`);
		if (context.vendor) parts.push(`vendor:${context.vendor}`);

		return parts.length > 0 ? `[${parts.join(' ')}]` : '';
	}
}
