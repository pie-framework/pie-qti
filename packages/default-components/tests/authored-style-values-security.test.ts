import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

function componentSource(name: string): string {
	return readFileSync(new URL(`../src/plugins/${name}`, import.meta.url), 'utf8');
}

describe('authored style value sinks', () => {
	test('normalizes both gap-match palette widths before style interpolation', () => {
		for (const path of [
			'gap-match/GapMatchInteraction.svelte',
			'graphic-gap-match/GraphicGapMatchInteraction.svelte',
		]) {
			const source = componentSource(path);

			expect(source, path).toContain('normalizeCssPixelLength(');
			expect(source, path).toContain('style={choicesContainerWidth ?');
			expect(source, path).not.toContain('parsedInteraction.choicesContainerWidth}`');
		}
	});

	test('normalizes representative image dimensions before CSS sinks', () => {
		const graphicOrder = componentSource('graphic-order/GraphicOrderInteraction.svelte');
		const graphicAssociate = componentSource(
			'graphic-associate/GraphicAssociateInteraction.svelte',
		);
		const selectPoint = componentSource('select-point/SelectPointInteraction.svelte');
		const graphicGapMatch = componentSource(
			'graphic-gap-match/GraphicGapMatchInteraction.svelte',
		);
		const positionObject = componentSource(
			'position-object/PositionObjectInteraction.svelte',
		);

		for (const source of [
			graphicOrder,
			graphicAssociate,
			selectPoint,
			graphicGapMatch,
			positionObject,
		]) {
			expect(source).toContain('normalizePixelDimension(');
		}

		expect(graphicOrder).not.toContain('style="width: {parsedInteraction.imageData.width}px');
		expect(graphicAssociate).not.toContain(
			'style="width: {parsedInteraction.imageData?.width}px',
		);
		expect(selectPoint).not.toContain('style="width: {parsedInteraction.imageData.width}px');
		expect(graphicGapMatch).not.toContain('width: {parsedInteraction.imageData?.width}px');
		expect(positionObject).not.toContain(
			'aspect-ratio: {parsedInteraction.imageData?.width',
		);
	});
});
