/**
 * Server-side Logger
 *
 * Provides structured logging for server-side PIE QTI applications with context support.
 * Supports console-based logging (development), JSON logging (production), and testing utilities.
 *
 * Compatible with the universal Logger interface (implements debug, info?, warn, error? methods),
 * while providing enhanced server-specific features like structured context and different output formats.
 *
 * @example
 * ```typescript
 * import { createLogger } from '@pie-qti/logger/server';
 *
 * const logger = createLogger({ format: 'json' });
 * logger.info('Processing item', { vendor: 'ExampleCorp', itemId: 'item-123' });
 * ```
 *
 * Environment Variables:
 * - PIE_LOG_FORMAT: 'console' | 'json' (default: 'console')
 * - PIE_LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error' (default: 'info')
 */

/**
 * Log context for structured logging
 * Provides additional metadata for each log entry
 */
export interface LogContext {
	/** Item identifier */
	itemId?: string;
	/** Session identifier */
	sessionId?: string;
	/** User identifier */
	userId?: string;
	/** Vendor/authoring tool identifier */
	vendor?: string;
	/** Correlation ID for request tracing */
	correlationId?: string;
	/** Additional custom context */
	[key: string]: unknown;
}

/**
 * Log levels in order of severity
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

/**
 * Server logger interface
 * Compatible with structured logging and log aggregation tools
 */
export interface ServerLogger {
	debug(message: string, context?: LogContext): void;
	info(message: string, context?: LogContext): void;
	warn(message: string, context?: LogContext): void;
	error(message: string, context?: LogContext): void;
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
 * Best for development and debugging
 */
export class ConsoleLogger implements ServerLogger {
	private minLevel: LogLevel;

	constructor(minLevel: LogLevel = 'info') {
		this.minLevel = minLevel;
	}

	private shouldLog(level: LogLevel): boolean {
		return LOG_LEVEL_VALUES[level] >= LOG_LEVEL_VALUES[this.minLevel];
	}

	debug(message: string, context?: LogContext): void {
		if (!this.shouldLog('debug')) return;
		const prefix = formatContext(context ?? {});
		const formatted = prefix ? `[DEBUG] ${prefix} ${message}` : `[DEBUG] ${message}`;
		console.debug(formatted);
	}

	info(message: string, context?: LogContext): void {
		if (!this.shouldLog('info')) return;
		const prefix = formatContext(context ?? {});
		const formatted = prefix ? `[INFO] ${prefix} ${message}` : `[INFO] ${message}`;
		console.info(formatted);
	}

	warn(message: string, context?: LogContext): void {
		if (!this.shouldLog('warn')) return;
		const prefix = formatContext(context ?? {});
		const formatted = prefix ? `[WARN] ${prefix} ${message}` : `[WARN] ${message}`;
		console.warn(formatted);
	}

	error(message: string, context?: LogContext): void {
		if (!this.shouldLog('error')) return;
		const prefix = formatContext(context ?? {});
		const formatted = prefix ? `[ERROR] ${prefix} ${message}` : `[ERROR] ${message}`;
		console.error(formatted);
	}
}

/**
 * JSON logger for structured logging in production
 * Outputs logs as JSON for integration with log aggregation tools
 * (ELK Stack, Datadog, CloudWatch, etc.)
 *
 * Features:
 * - Single-line JSON output (no line breaks in messages)
 * - Configurable minimum log level
 * - Proper error serialization
 */
export class JsonLogger implements ServerLogger {
	private minLevel: LogLevel;

	constructor(minLevel: LogLevel = 'info') {
		this.minLevel = minLevel;
	}

	private shouldLog(level: LogLevel): boolean {
		return LOG_LEVEL_VALUES[level] >= LOG_LEVEL_VALUES[this.minLevel];
	}

	debug(message: string, context?: LogContext): void {
		if (this.shouldLog('debug')) {
			this.log('debug', message, context);
		}
	}

	info(message: string, context?: LogContext): void {
		if (this.shouldLog('info')) {
			this.log('info', message, context);
		}
	}

	warn(message: string, context?: LogContext): void {
		if (this.shouldLog('warn')) {
			this.log('warn', message, context);
		}
	}

	error(message: string, context?: LogContext): void {
		if (this.shouldLog('error')) {
			this.log('error', message, context);
		}
	}

	private log(
		level: LogLevel,
		message: string,
		context?: LogContext,
	): void {
		const ctx = context ?? {};

		// Strip line breaks from message to ensure single-line JSON output
		const cleanMessage = message.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();

		const logEntry = {
			timestamp: new Date().toISOString(),
			level,
			message: cleanMessage,
			...ctx,
		};

		// Output to appropriate console method for proper log level
		// JSON.stringify already produces single-line output
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
export class SilentLogger implements ServerLogger {
	debug(): void {}
	info(): void {}
	warn(): void {}
	error(): void {}
}

/**
 * Memory logger (stores messages in memory)
 * Useful for testing and capturing logs for assertions
 */
export class MemoryLogger implements ServerLogger {
	public messages: Array<{
		level: 'debug' | 'info' | 'warn' | 'error';
		message: string;
		context: LogContext;
		timestamp: Date;
	}> = [];

	debug(message: string, context?: LogContext): void {
		this.messages.push({ level: 'debug', message, context: context ?? {}, timestamp: new Date() });
	}

	info(message: string, context?: LogContext): void {
		this.messages.push({ level: 'info', message, context: context ?? {}, timestamp: new Date() });
	}

	warn(message: string, context?: LogContext): void {
		this.messages.push({ level: 'warn', message, context: context ?? {}, timestamp: new Date() });
	}

	error(message: string, context?: LogContext): void {
		this.messages.push({ level: 'error', message, context: context ?? {}, timestamp: new Date() });
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

/**
 * Get log level from environment variable
 */
function getLogLevelFromEnv(): LogLevel {
	const envLevel = process.env.PIE_LOG_LEVEL?.toLowerCase();
	if (
		envLevel === 'debug' ||
		envLevel === 'info' ||
		envLevel === 'warn' ||
		envLevel === 'error'
	) {
		return envLevel;
	}
	return 'info';
}

/**
 * Get log format from environment variable
 */
function getLogFormatFromEnv(): 'console' | 'json' {
	const envFormat = process.env.PIE_LOG_FORMAT?.toLowerCase();
	if (envFormat === 'json') {
		return 'json';
	}
	return 'console';
}

/**
 * Create default logger based on environment variables
 * - PIE_LOG_FORMAT: 'console' | 'json' (default: 'console')
 * - PIE_LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error' (default: 'info')
 */
function createDefaultLogger(): ServerLogger {
	const format = getLogFormatFromEnv();
	const level = getLogLevelFromEnv();

	if (format === 'json') {
		return new JsonLogger(level);
	}
	return new ConsoleLogger(level);
}

/**
 * Default logger instance
 * Automatically configured based on environment variables:
 * - PIE_LOG_FORMAT: 'console' (default) | 'json'
 * - PIE_LOG_LEVEL: 'info' (default) | 'debug' | 'warn' | 'error'
 *
 * Can be replaced with custom implementation via setLogger()
 */
export let logger: ServerLogger = createDefaultLogger();

/**
 * Set the default logger implementation
 * Use JsonLogger for production, ConsoleLogger for development, etc.
 *
 * @example
 * ```typescript
 * import { setLogger, JsonLogger } from '@pie-qti/logger/server';
 *
 * // In production
 * setLogger(new JsonLogger());
 *
 * // Or with a custom logger
 * setLogger(myCustomLogger);
 * ```
 */
export function setLogger(newLogger: ServerLogger): void {
	logger = newLogger;
}

/**
 * Create a logger with a specific prefix/namespace
 * Automatically adds context to all log calls
 *
 * @example
 * ```typescript
 * const logger = createLogger('ImageProcessor');
 * logger.info('Processing image...'); // [INFO] [ImageProcessor] Processing image...
 * ```
 */
export function createLogger(namespace: string, baseContext?: LogContext): ServerLogger {
	const contextWithNamespace = { ...baseContext, namespace };

	return {
		debug(message: string, context?: LogContext): void {
			const merged = { ...contextWithNamespace, ...context };
			logger.debug(`[${namespace}] ${message}`, merged);
		},
		info(message: string, context?: LogContext): void {
			const merged = { ...contextWithNamespace, ...context };
			logger.info(`[${namespace}] ${message}`, merged);
		},
		warn(message: string, context?: LogContext): void {
			const merged = { ...contextWithNamespace, ...context };
			logger.warn(`[${namespace}] ${message}`, merged);
		},
		error(message: string, context?: LogContext): void {
			const merged = { ...contextWithNamespace, ...context };
			logger.error(`[${namespace}] ${message}`, merged);
		},
	};
}
