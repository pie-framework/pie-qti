import { describe, expect, it } from 'bun:test';

describe('default-components', () => {
	it('should export registerDefaultComponents', () => {
		const { registerDefaultComponents } = require('../src/index');
		expect(typeof registerDefaultComponents).toBe('function');
	});
});
