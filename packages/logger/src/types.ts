/**
 * Universal logger interface for PIE QTI packages
 *
 * This interface is compatible with:
 * - Browser console object
 * - @pie-qti/browser-utils logger
 * - @pie-qti/server-utils logger
 * - Custom logger implementations
 *
 * Use this interface for dependency injection in environment-agnostic code
 * that runs in both browser and Node.js contexts.
 */
export interface Logger {
	/**
	 * Log debug-level messages
	 * Typically used for detailed diagnostic information
	 */
	debug(message: string, ...args: any[]): void;

	/**
	 * Log informational messages
	 * Typically used for general information about application flow
	 */
	info?(message: string, ...args: any[]): void;

	/**
	 * Log warning messages
	 * Typically used for potentially harmful situations
	 */
	warn(message: string, ...args: any[]): void;

	/**
	 * Log error messages
	 * Typically used for error events that might still allow the application to continue
	 */
	error?(message: string, ...args: any[]): void;
}

/**
 * No-op logger that discards all log messages
 * Useful for testing or when logging is disabled
 */
export const noopLogger: Logger = {
	debug: () => {},
	info: () => {},
	warn: () => {},
	error: () => {},
};

/**
 * Console logger that delegates to the global console object
 * Compatible with both browser and Node.js environments
 */
export const consoleLogger: Logger = {
	debug: console.debug.bind(console),
	info: console.info.bind(console),
	warn: console.warn.bind(console),
	error: console.error.bind(console),
};
