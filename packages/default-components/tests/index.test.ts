import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createComponentRegistry } from '@pie-qti/item-player';
import { getDefaultComponentTypes, registerDefaultComponents } from '../src/index';

const packageJson = JSON.parse(
	readFileSync(new URL('../package.json', import.meta.url), 'utf8')
) as {
	sideEffects?: unknown;
};

/** Every standard QTI block interaction the default components must render. */
const STANDARD_BLOCK_INTERACTION_TYPES = [
	'associateInteraction',
	'choiceInteraction',
	'customInteraction',
	'drawingInteraction',
	'endAttemptInteraction',
	'extendedTextInteraction',
	'gapMatchInteraction',
	'graphicAssociateInteraction',
	'graphicGapMatchInteraction',
	'graphicOrderInteraction',
	'hotspotInteraction',
	'hottextInteraction',
	'matchInteraction',
	'mediaInteraction',
	'orderInteraction',
	'portableCustomInteraction',
	'positionObjectInteraction',
	'selectPointInteraction',
	'sliderInteraction',
	'uploadInteraction',
] as const;

describe('default-components', () => {
	it('should export registerDefaultComponents', () => {
		expect(typeof registerDefaultComponents).toBe('function');
	});

	it('registers one default renderer for every standard block interaction', () => {
		const registry = createComponentRegistry();
		registerDefaultComponents(registry);
		const defaultComponentTypes = getDefaultComponentTypes();

		expect(defaultComponentTypes.sort()).toEqual(
			[...STANDARD_BLOCK_INTERACTION_TYPES].sort()
		);

		for (const type of STANDARD_BLOCK_INTERACTION_TYPES) {
			expect(registry.hasComponent(type), type).toBe(true);
			expect(registry.getTagNameForType(type), type).toMatch(/^pie-qti-/);
		}
	});

	it('marks compiled plugin and style entrypoints as side-effectful for package consumers', () => {
		expect(packageJson.sideEffects).toContain('./dist/plugins.js');
		expect(packageJson.sideEffects).toContain('./dist/shared/styles/*.css');
	});
});
