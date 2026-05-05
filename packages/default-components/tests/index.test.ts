import { describe, expect, it } from 'bun:test';
import { createComponentRegistry } from '@pie-qti/item-player';
import {
	getStandardBlockInteractionModules,
	getStandardInlineInteractionModules,
} from '../../item-player/src/interactions/modules.js';
import { getDefaultComponentTypes, registerDefaultComponents } from '../src/index';

describe('default-components', () => {
	it('should export registerDefaultComponents', () => {
		expect(typeof registerDefaultComponents).toBe('function');
	});

	it('registers one default renderer for every standard block interaction', () => {
		const registry = createComponentRegistry();
		registerDefaultComponents(registry);
		const defaultComponentTypes = getDefaultComponentTypes();

		expect(defaultComponentTypes.sort()).toEqual(
			getStandardBlockInteractionModules().map((module) => module.type).sort()
		);

		for (const module of getStandardBlockInteractionModules()) {
			expect(registry.hasComponent(module.type)).toBe(true);
			expect(registry.getTagNameForType(module.type)).toMatch(/^pie-qti-/);
		}

		for (const module of getStandardInlineInteractionModules()) {
			expect(registry.hasComponent(module.type)).toBe(false);
		}
	});
});
