/**
 * Logger Tests
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { ConsoleLogger, JsonLogger, MemoryLogger, SilentLogger } from '@pie-qti/logger/server';
import type { LogContext } from '@pie-qti/logger/server';

describe('ConsoleLogger', () => {
	let logger: ConsoleLogger;
	let consoleDebugSpy: ReturnType<typeof mock>;
	let consoleInfoSpy: ReturnType<typeof mock>;
	let consoleWarnSpy: ReturnType<typeof mock>;
	let consoleErrorSpy: ReturnType<typeof mock>;

	beforeEach(() => {
		// Use 'debug' level to test all log levels
		logger = new ConsoleLogger('debug');
		consoleDebugSpy = mock(() => {});
		consoleInfoSpy = mock(() => {});
		consoleWarnSpy = mock(() => {});
		consoleErrorSpy = mock(() => {});

		console.debug = consoleDebugSpy;
		console.info = consoleInfoSpy;
		console.warn = consoleWarnSpy;
		console.error = consoleErrorSpy;
	});

	test('should log debug message without context', () => {
		logger.debug('Test message');
		expect(consoleDebugSpy).toHaveBeenCalledWith('[DEBUG] Test message');
	});

	test('should log with full structured context', () => {
		const context: LogContext = {
			itemId: 'item-123',
			sessionId: 'session-456',
			userId: 'user-789',
			vendor: 'acme',
			correlationId: 'corr-abc',
		};

		logger.info('Test message', context);

		expect(consoleInfoSpy).toHaveBeenCalledWith(
			'[INFO] [item:item-123 session:session-456 user:user-789 vendor:acme corr:corr-abc] Test message',
		);
	});

	test('should log error with partial context', () => {
		const context: LogContext = {
			sessionId: 'session-123',
			vendor: 'acme',
		};

		logger.error('Error occurred', context);

		expect(consoleErrorSpy).toHaveBeenCalledWith(
			'[ERROR] [session:session-123 vendor:acme] Error occurred',
		);
	});

	test('should handle custom context properties', () => {
		const context: LogContext = {
			itemId: 'item-1',
			customProp: 'custom-value',
		};

		logger.info('Test', context);

		// Custom properties are stored but not displayed in console format
		expect(consoleInfoSpy).toHaveBeenCalledWith('[INFO] [item:item-1] Test');
	});
});

describe('JsonLogger', () => {
	let logger: JsonLogger;
	let consoleInfoSpy: ReturnType<typeof mock>;
	let consoleWarnSpy: ReturnType<typeof mock>;

	beforeEach(() => {
		// Use 'debug' level to test all log levels
		logger = new JsonLogger('debug');
		consoleInfoSpy = mock(() => {});
		consoleWarnSpy = mock(() => {});

		console.info = consoleInfoSpy;
		console.warn = consoleWarnSpy;
	});

	test('should output JSON with message and context', () => {
		const context: LogContext = {
			itemId: 'item-123',
			sessionId: 'session-456',
			vendor: 'acme',
		};

		logger.info('Test message', context);

		expect(consoleInfoSpy).toHaveBeenCalled();
		const jsonOutput = consoleInfoSpy.mock.calls[0][0];
		const parsed = JSON.parse(jsonOutput);

		expect(parsed.level).toBe('info');
		expect(parsed.message).toBe('Test message');
		expect(parsed.itemId).toBe('item-123');
		expect(parsed.sessionId).toBe('session-456');
		expect(parsed.vendor).toBe('acme');
		expect(parsed.timestamp).toBeDefined();
	});

	test('should include custom context properties in JSON', () => {
		const context: LogContext = {
			itemId: 'item-1',
			customProp: 'custom-value',
			nestedObject: { key: 'value' },
		};

		logger.warn('Warning', context);

		const jsonOutput = consoleWarnSpy.mock.calls[0][0];
		const parsed = JSON.parse(jsonOutput);

		expect(parsed.customProp).toBe('custom-value');
		expect(parsed.nestedObject).toEqual({ key: 'value' });
	});
});

describe('MemoryLogger', () => {
	let logger: MemoryLogger;

	beforeEach(() => {
		logger = new MemoryLogger();
	});

	test('should store messages with context', () => {
		const context: LogContext = {
			itemId: 'item-123',
			sessionId: 'session-456',
		};

		logger.info('Test message', context);

		expect(logger.messages).toHaveLength(1);
		expect(logger.messages[0].level).toBe('info');
		expect(logger.messages[0].message).toBe('Test message');
		expect(logger.messages[0].context.itemId).toBe('item-123');
		expect(logger.messages[0].context.sessionId).toBe('session-456');
	});

	test('should filter messages by level', () => {
		logger.info('Info 1');
		logger.warn('Warning 1');
		logger.info('Info 2');
		logger.error('Error 1');

		const infoMessages = logger.getMessages('info');
		expect(infoMessages).toHaveLength(2);
		expect(infoMessages[0].message).toBe('Info 1');
		expect(infoMessages[1].message).toBe('Info 2');
	});

	test('should get messages by context property', () => {
		logger.info('Message 1', { sessionId: 'session-a' });
		logger.info('Message 2', { sessionId: 'session-b' });
		logger.info('Message 3', { sessionId: 'session-a' });

		const sessionAMessages = logger.getMessagesByContext('sessionId', 'session-a');
		expect(sessionAMessages).toHaveLength(2);
		expect(sessionAMessages[0].message).toBe('Message 1');
		expect(sessionAMessages[1].message).toBe('Message 3');
	});

	test('should check if context exists', () => {
		logger.info('Test', { vendor: 'acme' });

		expect(logger.hasContext('vendor', 'acme')).toBe(true);
		expect(logger.hasContext('vendor', 'other')).toBe(false);
		expect(logger.hasContext('userId', 'user-123')).toBe(false);
	});

	test('should clear all messages', () => {
		logger.info('Message 1');
		logger.warn('Message 2');
		logger.error('Message 3');

		expect(logger.messages).toHaveLength(3);

		logger.clear();

		expect(logger.messages).toHaveLength(0);
	});

	test('should store itemId from context', () => {
		logger.info('Test', { itemId: 'item-from-context', sessionId: 'session-123' });

		expect(logger.messages[0].context.itemId).toBe('item-from-context');
		expect(logger.messages[0].context.sessionId).toBe('session-123');
	});
});

describe('SilentLogger', () => {
	test('should not throw errors when logging', () => {
		const logger = new SilentLogger();

		expect(() => {
			logger.debug('Test');
			logger.info('Test');
			logger.warn('Test');
			logger.error('Test');
		}).not.toThrow();
	});

	test('should support context parameter', () => {
		const logger = new SilentLogger();
		const context: LogContext = { itemId: 'item-1' };

		expect(() => {
			logger.info('Message');
			logger.info('Message', context);
		}).not.toThrow();
	});
});
