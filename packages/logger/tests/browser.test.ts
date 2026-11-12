/**
 * Browser entry contract tests: level filtering, prefix formatting (bracketed
 * exactly once), child composition (`[Parent:Child]`), and level inheritance.
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { Logger, createLogger, logger as defaultLogger } from '../src/browser';
import type { Logger as UniversalLogger } from '../src/types';

describe('browser Logger level filtering', () => {
	let consoleDebugSpy: ReturnType<typeof mock>;
	let consoleInfoSpy: ReturnType<typeof mock>;
	let consoleWarnSpy: ReturnType<typeof mock>;
	let consoleErrorSpy: ReturnType<typeof mock>;

	beforeEach(() => {
		consoleDebugSpy = mock(() => {});
		consoleInfoSpy = mock(() => {});
		consoleWarnSpy = mock(() => {});
		consoleErrorSpy = mock(() => {});

		console.debug = consoleDebugSpy as typeof console.debug;
		console.info = consoleInfoSpy as typeof console.info;
		console.warn = consoleWarnSpy as typeof console.warn;
		console.error = consoleErrorSpy as typeof console.error;
	});

	test('an explicit minLevel filters lower levels and routes the rest to the right console method', () => {
		const logger = new Logger({ minLevel: 'info' });

		logger.debug('chatter');
		logger.info('flow', { id: 1 });
		logger.warn('careful');
		logger.error('broken');

		expect(consoleDebugSpy).not.toHaveBeenCalled();
		expect(consoleInfoSpy).toHaveBeenCalled();
		expect(consoleWarnSpy).toHaveBeenCalled();
		expect(consoleErrorSpy).toHaveBeenCalled();
		// Extra arguments travel with the message (a prefix-less logger emits
		// the message bare).
		expect(consoleInfoSpy.mock.calls[0]?.[0]).toBe('flow');
		expect(consoleInfoSpy.mock.calls[0]?.[1]).toEqual({ id: 1 });
	});

	test("an 'error' logger suppresses everything below error", () => {
		const logger = new Logger({ minLevel: 'error' });

		logger.debug('a');
		logger.info('b');
		logger.warn('c');
		logger.error('d');

		expect(consoleDebugSpy).not.toHaveBeenCalled();
		expect(consoleInfoSpy).not.toHaveBeenCalled();
		expect(consoleWarnSpy).not.toHaveBeenCalled();
		expect(consoleErrorSpy).toHaveBeenCalled();
	});

	test('the default logger and createLogger produce implementations of the universal Logger', () => {
		// The universal interface now requires all four levels: a Logger
		// instance must satisfy it in full.
		const universal: UniversalLogger = new Logger();
		expect(typeof universal.debug).toBe('function');
		expect(typeof universal.info).toBe('function');
		expect(typeof universal.warn).toBe('function');
		expect(typeof universal.error).toBe('function');

		// The default instances are usable without throwing whatever the
		// environment's dev-mode detection decided.
		expect(() => {
			defaultLogger.debug('a');
			defaultLogger.info('b');
			defaultLogger.warn('c');
			defaultLogger.error('d');
			createLogger('X').info('e');
		}).not.toThrow();
	});
});

describe('browser Logger prefixes and children', () => {
	let consoleInfoSpy: ReturnType<typeof mock>;

	beforeEach(() => {
		consoleInfoSpy = mock(() => {});
		console.info = consoleInfoSpy as typeof console.info;
	});

	test("createLogger prefixes messages as '[Prefix] message'", () => {
		const logger = createLogger('ImageResolver', { minLevel: 'debug' });

		logger.debug('Processing image...');
		expect(consoleInfoSpy).not.toHaveBeenCalled();
		expect(console.debug).not.toBe(consoleInfoSpy);

		logger.info('visible');
		const [formatted, ...rest] = consoleInfoSpy.mock.calls[0] ?? [];
		expect(formatted).toBe('[ImageResolver] visible');
		expect(rest).toHaveLength(0);
	});

	test("child composes prefixes bracketed once: '[Parent:Child] message' as documented", () => {
		const parent = createLogger('Parent');
		const child = parent.child('Child');

		child.info('test');
		expect(consoleInfoSpy.mock.calls[0]?.[0]).toBe('[Parent:Child] test');

		// Deep chains keep composing raw names, not nested brackets.
		child.child('Grand').info('deep');
		expect(consoleInfoSpy.mock.calls[1]?.[0]).toBe('[Parent:Child:Grand] deep');
	});

	test('a child inherits the parent log level', () => {
		const parent = new Logger({ minLevel: 'warn' });
		const child = parent.child('Child');

		child.info('hidden');
		expect(consoleInfoSpy).not.toHaveBeenCalled();

		console.warn = mock(() => {}) as typeof console.warn;
		child.warn('shown');
		expect(console.warn).toHaveBeenCalled();
	});

	test('a child of a prefix-less logger has just its own prefix', () => {
		const child = new Logger().child('Only');

		child.info('t');
		expect(consoleInfoSpy.mock.calls[0]?.[0]).toBe('[Only] t');
	});
});
