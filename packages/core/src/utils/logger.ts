/**
 * Logger Utilities
 */

import type { TransformLogger, LogContext } from '@pie-qti/transform-types';

/**
 * Merge itemId parameter into context for backward compatibility
 */
function mergeContext(itemId?: string, context?: LogContext): LogContext {
	if (!itemId && !context) return {};

	return {
		...context,
		// itemId parameter takes precedence over context.itemId for backward compatibility
		itemId: itemId || context?.itemId,
	};
}

/**
 * Format context as a string prefix
 */
function formatContext(context: LogContext): string {
	const parts: string[] = [];

	if (context.itemId) parts.push(`item:${context.itemId}`);
	if (context.sessionId) parts.push(`session:${context.sessionId}`);
	if (context.userId) parts.push(`user:${context.userId}`);
	if (context.vendor) parts.push(`vendor:${context.vendor}`);
	if (context.correlationId) parts.push(`corr:${context.correlationId}`);

	return parts.length > 0 ? `[${parts.join(' ')}]` : '';
}

/**
 * Simple console logger with structured context support
 */
export class ConsoleLogger implements TransformLogger {
	debug(message: string, itemId?: string, context?: LogContext): void {
		const ctx = mergeContext(itemId, context);
		const prefix = formatContext(ctx);
		const formatted = prefix ? `[DEBUG] ${prefix} ${message}` : `[DEBUG] ${message}`;
		console.debug(formatted);
	}

	info(message: string, itemId?: string, context?: LogContext): void {
		const ctx = mergeContext(itemId, context);
		const prefix = formatContext(ctx);
		const formatted = prefix ? `[INFO] ${prefix} ${message}` : `[INFO] ${message}`;
		console.info(formatted);
	}

	warn(message: string, itemId?: string, context?: LogContext): void {
		const ctx = mergeContext(itemId, context);
		const prefix = formatContext(ctx);
		const formatted = prefix ? `[WARN] ${prefix} ${message}` : `[WARN] ${message}`;
		console.warn(formatted);
	}

	error(message: string, itemId?: string, context?: LogContext): void {
		const ctx = mergeContext(itemId, context);
		const prefix = formatContext(ctx);
		const formatted = prefix ? `[ERROR] ${prefix} ${message}` : `[ERROR] ${message}`;
		console.error(formatted);
	}
}

/**
 * JSON logger for structured logging in production
 * Outputs logs as JSON for integration with log aggregation tools
 */
export class JsonLogger implements TransformLogger {
	debug(message: string, itemId?: string, context?: LogContext): void {
		this.log('debug', message, itemId, context);
	}

	info(message: string, itemId?: string, context?: LogContext): void {
		this.log('info', message, itemId, context);
	}

	warn(message: string, itemId?: string, context?: LogContext): void {
		this.log('warn', message, itemId, context);
	}

	error(message: string, itemId?: string, context?: LogContext): void {
		this.log('error', message, itemId, context);
	}

	private log(
		level: 'debug' | 'info' | 'warn' | 'error',
		message: string,
		itemId?: string,
		context?: LogContext,
	): void {
		const ctx = mergeContext(itemId, context);

		const logEntry = {
			timestamp: new Date().toISOString(),
			level,
			message,
			...ctx,
		};

		// Output to appropriate console method for proper log level
		const output = JSON.stringify(logEntry);
		switch (level) {
			case 'debug':
				console.debug(output);
				break;
			case 'info':
				console.info(output);
				break;
			case 'warn':
				console.warn(output);
				break;
			case 'error':
				console.error(output);
				break;
		}
	}
}

/**
 * Silent logger (no output)
 * Useful for testing or when logging is explicitly disabled
 */
export class SilentLogger implements TransformLogger {
	debug(): void {}
	info(): void {}
	warn(): void {}
	error(): void {}
}

/**
 * Memory logger (stores messages in memory)
 * Useful for testing and capturing logs for assertions
 */
export class MemoryLogger implements TransformLogger {
	public messages: Array<{
		level: 'debug' | 'info' | 'warn' | 'error';
		message: string;
		context: LogContext;
		timestamp: Date;
	}> = [];

	debug(message: string, itemId?: string, context?: LogContext): void {
		const ctx = mergeContext(itemId, context);
		this.messages.push({ level: 'debug', message, context: ctx, timestamp: new Date() });
	}

	info(message: string, itemId?: string, context?: LogContext): void {
		const ctx = mergeContext(itemId, context);
		this.messages.push({ level: 'info', message, context: ctx, timestamp: new Date() });
	}

	warn(message: string, itemId?: string, context?: LogContext): void {
		const ctx = mergeContext(itemId, context);
		this.messages.push({ level: 'warn', message, context: ctx, timestamp: new Date() });
	}

	error(message: string, itemId?: string, context?: LogContext): void {
		const ctx = mergeContext(itemId, context);
		this.messages.push({ level: 'error', message, context: ctx, timestamp: new Date() });
	}

	clear(): void {
		this.messages = [];
	}

	getMessages(level?: 'debug' | 'info' | 'warn' | 'error'): typeof this.messages {
		if (level) {
			return this.messages.filter((msg) => msg.level === level);
		}
		return this.messages;
	}

	/**
	 * Get messages by context property
	 */
	getMessagesByContext(key: keyof LogContext, value: unknown): typeof this.messages {
		return this.messages.filter((msg) => msg.context[key] === value);
	}

	/**
	 * Check if any message contains specific context
	 */
	hasContext(key: keyof LogContext, value: unknown): boolean {
		return this.messages.some((msg) => msg.context[key] === value);
	}
}
