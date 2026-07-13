import './setup';
import { describe, expect, test } from 'bun:test';

const PLAYER_TAGS = [
	'pie-qti-item-player',
	'pie-qti-assessment-player',
	'pie-qti-section-player-splitpane',
	'pie-qti-section-player-vertical',
] as const;

const DEFAULT_INTERACTION_TAGS = [
	'pie-qti-choice',
	'pie-qti-slider',
	'pie-qti-order',
	'pie-qti-match',
	'pie-qti-associate',
	'pie-qti-gap-match',
	'pie-qti-hotspot',
	'pie-qti-hottext',
	'pie-qti-media',
	'pie-qti-custom',
	'pie-qti-portable-custom',
	'pie-qti-end-attempt',
	'pie-qti-position-object',
	'pie-qti-graphic-gap-match',
	'pie-qti-graphic-order',
	'pie-qti-graphic-associate',
	'pie-qti-select-point',
	'pie-qti-extended-text',
	'pie-qti-upload',
	'pie-qti-drawing',
	'pie-qti-catalog-popup',
] as const;

describe('@pie-qti/player-elements/register', () => {
	test('defines the complete default runtime with one import', async () => {
		await import('../src/register.js');

		for (const tagName of [...PLAYER_TAGS, ...DEFAULT_INTERACTION_TAGS]) {
			expect(customElements.get(tagName), `${tagName} should be registered`).toBeDefined();
		}
	});
});
