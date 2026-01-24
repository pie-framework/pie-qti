/**
 * Logger Utilities
 *
 * @deprecated Import from @pie-qti/logger/server instead
 * This module re-exports from @pie-qti/logger for backward compatibility
 */

import {
	ConsoleLogger as ServerConsoleLogger,
	JsonLogger as ServerJsonLogger,
	SilentLogger as ServerSilentLogger,
	MemoryLogger as ServerMemoryLogger,
} from '@pie-qti/logger/server';

// Re-export logger classes (types are now exported from @pie-qti/transform-types)
export const ConsoleLogger = ServerConsoleLogger;
export const JsonLogger = ServerJsonLogger;
export const SilentLogger = ServerSilentLogger;
export const MemoryLogger = ServerMemoryLogger;
