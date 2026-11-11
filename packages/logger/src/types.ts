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
	info(message: string, ...args: any[]): void;

	/**
	 * Log warning messages
	 * Typically used for potentially harmful situations
	 */
	warn(message: string, ...args: any[]): void;

	/**
	 * Log error messages
	 * Typically used for error events that might still allow the application to continue
	 */
	error(message: string, ...args: any[]): void;
}
