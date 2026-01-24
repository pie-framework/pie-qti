/**
 * Browser logger utility
 *
 * Provides consistent logging across all PIE QTI browser applications
 * with automatic dev/prod mode detection and level filtering.
 *
 * Implements the universal Logger interface for compatibility with environment-agnostic code.
 *
 * @example
 * ```typescript
 * import { createLogger } from '@pie-qti/logger/browser';
 *
 * const logger = createLogger('MyComponent');
 * logger.debug('Detailed debug info'); // Only in dev
 * logger.info('General info');
 * logger.warn('Warning message');
 * logger.error('Error occurred');
 * ```
 */

import type { Logger as ILogger } from './types.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Logger configuration
 */
export interface LoggerConfig {
	/** Minimum log level to output (default: 'info' in prod, 'debug' in dev) */
	minLevel?: LogLevel;
	/** Optional prefix for all log messages */
	prefix?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

/**
 * Detect if running in development mode
 * Checks multiple common patterns used in build tools
 */
function isDevMode(): boolean {
	// Vite
	if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
		return true;
	}

	// Node.js-style NODE_ENV
	if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
		return true;
	}

	// Default to false (production) if we can't determine
	return false;
}

/**
 * Browser logger with level filtering and automatic dev/prod detection
 *
 * Implements the universal Logger interface from @pie-qti/ims-cp-core
 */
export class Logger implements ILogger {
	private minLevel: number;
	private prefix: string;

	constructor(config: LoggerConfig = {}) {
		// Default to 'info' in production, 'debug' in development
		const defaultLevel = isDevMode() ? 'debug' : 'info';
		this.minLevel = LOG_LEVELS[config.minLevel ?? defaultLevel];
		this.prefix = config.prefix ? `[${config.prefix}]` : '';
	}

	private shouldLog(level: LogLevel): boolean {
		return LOG_LEVELS[level] >= this.minLevel;
	}

	private formatMessage(message: string): string {
		return this.prefix ? `${this.prefix} ${message}` : message;
	}

	debug(message: string, ...args: any[]): void {
		if (this.shouldLog('debug')) {
			console.debug(this.formatMessage(message), ...args);
		}
	}

	info(message: string, ...args: any[]): void {
		if (this.shouldLog('info')) {
			console.info(this.formatMessage(message), ...args);
		}
	}

	warn(message: string, ...args: any[]): void {
		if (this.shouldLog('warn')) {
			console.warn(this.formatMessage(message), ...args);
		}
	}

	error(message: string, ...args: any[]): void {
		if (this.shouldLog('error')) {
			console.error(this.formatMessage(message), ...args);
		}
	}

	/**
	 * Create a child logger with an additional prefix
	 *
	 * @example
	 * ```typescript
	 * const parent = createLogger('Parent');
	 * const child = parent.child('Child');
	 * child.info('test'); // Logs: [Parent:Child] test
	 * ```
	 */
	child(prefix: string): Logger {
		const childPrefix = this.prefix ? `${this.prefix}:${prefix}` : prefix;
		return new Logger({ minLevel: this.getLevelName(), prefix: childPrefix });
	}

	private getLevelName(): LogLevel {
		for (const [name, value] of Object.entries(LOG_LEVELS)) {
			if (value === this.minLevel) {
				return name as LogLevel;
			}
		}
		return 'info';
	}
}

/**
 * Default logger instance
 */
export const logger = new Logger();

/**
 * Create a logger with a specific prefix
 *
 * @param prefix Prefix to prepend to all log messages
 * @param config Optional additional configuration
 * @returns Logger instance
 *
 * @example
 * ```typescript
 * const logger = createLogger('ImageResolver');
 * logger.debug('Processing image...'); // [ImageResolver] Processing image...
 * ```
 */
export function createLogger(prefix: string, config?: LoggerConfig): Logger {
	return new Logger({ ...config, prefix });
}
