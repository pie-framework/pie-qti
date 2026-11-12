/**
 * The shared stage-image state every graphic interaction binds its ImageStage
 * to: the pixel space (authored width/height, else a raster image's natural
 * size once loaded), the refusal to draw in an unknown space, the once-only
 * author warning, and the frame/scale derivations around the image.
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { createStageImage } from '../../src/shared/utils/stageImage.svelte';

afterEach(() => {
	vi.restoreAllMocks();
});

describe('createStageImage (the ImageStage handshake the graphic interactions share)', () => {
	test('hasImageDimensions: both pixel dimensions known, else not', () => {
		const stage = createStageImage({ needsDimensions: () => true, missingDimensionsWarning: 'w' });
		expect(stage.hasImageDimensions).toBe(false);

		stage.imageWidth = 800;
		expect(stage.hasImageDimensions).toBe(false);

		stage.imageHeight = 600;
		expect(stage.hasImageDimensions).toBe(true);
	});

	test('missingDimensions: the interaction needs the space, has none, and none is still coming', () => {
		const stage = createStageImage({ needsDimensions: () => true, missingDimensionsWarning: 'w' });
		expect(stage.missingDimensions).toBe(true);

		// A raster image without authored dimensions is still loading: the natural
		// size may still arrive, so the space is not (yet) missing.
		stage.awaitingNaturalSize = true;
		expect(stage.missingDimensions).toBe(false);
		stage.awaitingNaturalSize = false;
		expect(stage.missingDimensions).toBe(true);

		// The caller's gate: an interaction with no image needing a space (or the
		// hotspot's mandatory-image gate, from the other side) is not "missing".
		const unneeded = createStageImage({ needsDimensions: () => false, missingDimensionsWarning: 'w' });
		expect(unneeded.missingDimensions).toBe(false);
	});

	test('renderScale: rendered CSS px per authored image px, 1 while either is unknown', () => {
		const stage = createStageImage({ needsDimensions: () => true, missingDimensionsWarning: 'w' });
		expect(stage.renderScale).toBe(1);

		stage.imageWidth = 800;
		expect(stage.renderScale).toBe(1);

		stage.renderedWidth = 400;
		expect(stage.renderScale).toBe(0.5);

		// Nothing measured yet (or nothing rendered): no collapsed scale.
		stage.renderedWidth = 0;
		expect(stage.renderScale).toBe(1);
	});

	test('frameStyle: the frame caps at the image size plus its border, empty while unknown', () => {
		const stage = createStageImage({ needsDimensions: () => true, missingDimensionsWarning: 'w' });
		expect(stage.frameStyle).toBe('');

		stage.imageWidth = 800;
		expect(stage.frameStyle).toBe('max-width: calc(800px + 4px);');
	});

	test('warnOnceMissingDimensions warns once, not on every re-run', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const stage = createStageImage({ needsDimensions: () => true, missingDimensionsWarning: 'the space never arrived' });

		stage.warnOnceMissingDimensions();
		stage.warnOnceMissingDimensions();
		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn).toHaveBeenCalledWith('the space never arrived');

		// Once dimensions arrived, no warning either way.
		stage.imageWidth = 800;
		stage.imageHeight = 600;
		stage.warnOnceMissingDimensions();
		expect(warn).toHaveBeenCalledTimes(1);
	});
});
