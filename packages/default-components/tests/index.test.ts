import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createComponentRegistry, DEFAULT_COMPONENT_TAGS_BY_TYPE } from '@pie-qti/item-player';
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

/** The custom-element tags hosts and stylesheets address; registering must never change them. */
const DEFAULT_TAG_NAMES: Record<string, string> = {
	associateInteraction: 'pie-qti-associate',
	choiceInteraction: 'pie-qti-choice',
	customInteraction: 'pie-qti-custom',
	drawingInteraction: 'pie-qti-drawing',
	endAttemptInteraction: 'pie-qti-end-attempt',
	extendedTextInteraction: 'pie-qti-extended-text',
	gapMatchInteraction: 'pie-qti-gap-match',
	graphicAssociateInteraction: 'pie-qti-graphic-associate',
	graphicGapMatchInteraction: 'pie-qti-graphic-gap-match',
	graphicOrderInteraction: 'pie-qti-graphic-order',
	hotspotInteraction: 'pie-qti-hotspot',
	hottextInteraction: 'pie-qti-hottext',
	matchInteraction: 'pie-qti-match',
	mediaInteraction: 'pie-qti-media',
	orderInteraction: 'pie-qti-order',
	portableCustomInteraction: 'pie-qti-portable-custom',
	positionObjectInteraction: 'pie-qti-position-object',
	selectPointInteraction: 'pie-qti-select-point',
	sliderInteraction: 'pie-qti-slider',
	uploadInteraction: 'pie-qti-upload',
	catalogPopup: 'pie-qti-catalog-popup',
};

/** Every `register` call `registerDefaultComponents` makes, in order. */
function recordRegistrations(): Array<{ type: string; tagName: string }> {
	const calls: Array<{ type: string; tagName: string }> = [];
	registerDefaultComponents({ register: (type, { tagName }) => calls.push({ type, tagName }) });
	return calls;
}

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

	it("derives its interaction types from item-player's default tags, without catalogPopup", () => {
		expect(getDefaultComponentTypes()).toEqual(
			Object.keys(DEFAULT_COMPONENT_TAGS_BY_TYPE).filter((type) => type !== 'catalogPopup')
		);
		expect(getDefaultComponentTypes()).toHaveLength(STANDARD_BLOCK_INTERACTION_TYPES.length);
	});

	it('registers each interaction once and catalogPopup exactly once', () => {
		const types = recordRegistrations().map(({ type }) => type);

		expect(types.filter((type) => type === 'catalogPopup')).toHaveLength(1);
		expect(new Set(types).size).toBe(types.length);
		expect(types.sort()).toEqual([...STANDARD_BLOCK_INTERACTION_TYPES, 'catalogPopup'].sort());
	});

	it('keeps every tag name', () => {
		const tags = Object.fromEntries(recordRegistrations().map(({ type, tagName }) => [type, tagName]));

		expect(tags).toEqual(DEFAULT_TAG_NAMES);
		const registry = createComponentRegistry();
		registerDefaultComponents(registry);
		for (const [type, tagName] of Object.entries(DEFAULT_TAG_NAMES)) {
			expect(registry.getTagNameForType(type), type).toBe(tagName);
		}
	});

	it('marks compiled plugin and style entrypoints as side-effectful for package consumers', () => {
		expect(packageJson.sideEffects).toContain('./dist/plugins.js');
		expect(packageJson.sideEffects).toContain('./dist/shared/styles/*.css');
	});
});
