import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(
	new URL('../src/plugins/hotspot/HotspotInteraction.svelte', import.meta.url),
	'utf8'
);

describe('HotspotInteraction overlay viewBox', () => {
	it('does not guess a viewBox when the image dimensions are unknown', () => {
		// hotspotChoice coords are in the source image's pixel space, so a guessed
		// viewBox does not degrade gracefully — it silently misplaces every region,
		// which reads as a content error rather than the missing metadata it is.
		expect(source).not.toContain("|| '800'");
		expect(source).not.toContain("|| '600'");
		expect(source).not.toContain('0 0 800 600');
	});

	it('derives the viewBox from the validated intrinsic dimensions', () => {
		expect(source).toContain('viewBox="0 0 {imageWidth} {imageHeight}"');
	});

	it('gates the overlay on known dimensions and reports why when they are missing', () => {
		expect(source).toContain('const hasImageDimensions =');
		expect(source).toContain('{#if hasImageDimensions}');
		expect(source).toContain('{#if !hasImageDimensions}');
		expect(source).toContain('interactions.hotspot.unknownImageDimensions');
		expect(source).toContain('role="alert"');
	});
});
