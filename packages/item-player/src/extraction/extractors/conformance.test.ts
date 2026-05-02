/**
 * Extractor conformance tests — QTI 2.2 Advanced Level
 *
 * Each test loads an item XML directly from the official 1EdTech conformance
 * package at ../../../../../../qti-conformance and verifies that extraction
 * succeeds and produces correct data structures.
 *
 * These tests exercise the same extraction code path used in production and
 * provide a stronger conformance signal than hand-crafted fixture XML.
 *
 * Note: getInteractionData() returns InteractionData[] where extracted fields
 * are spread at the top level (no nested .data property).
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { describe, it, expect } from 'bun:test';
import { Player } from '../../core/Player.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFORMANCE = join(__dirname, '../../../../../../qti-conformance/qti2.2/Advanced Level');

function loadXml(packageDir: string, filename: string): string {
	return readFileSync(join(CONFORMANCE, packageDir, filename), 'utf-8');
}

// ─────────────────────────────────────────────────────────────────────────────
// Q6 – Gap Match Interaction
// ─────────────────────────────────────────────────────────────────────────────

describe('Q6 – Gap Match Interaction (official conformance XML)', () => {
	it('extracts gap-match-example-1 (Richard III quotes)', () => {
		const xml = loadXml('Q6 - Gap Match Interaction', 'gap-match-example-1.xml');
		const player = new Player({ itemXml: xml });
		const interactions = player.getInteractionData();

		expect(interactions).toHaveLength(1);
		const interaction = interactions[0] as any;
		expect(interaction.type).toBe('gapMatchInteraction');
		expect(interaction.gapTexts.length).toBeGreaterThan(0);
		expect(interaction.gaps.length).toBeGreaterThan(0);
	});

	it('extracts gap-match-example-2 (MathML choices)', () => {
		const xml = loadXml('Q6 - Gap Match Interaction', 'gap-match-example-2.xml');
		const player = new Player({ itemXml: xml });
		const interactions = player.getInteractionData();

		expect(interactions).toHaveLength(1);
		const interaction = interactions[0] as any;
		expect(interaction.type).toBe('gapMatchInteraction');
		expect(interaction.gapTexts.length).toBeGreaterThan(0);
		expect(interaction.gaps.length).toBeGreaterThan(0);
	});

	it('extracts gap-match-example-3 (table with unlimited matchMax)', () => {
		const xml = loadXml('Q6 - Gap Match Interaction', 'gap-match-example-3.xml');
		const player = new Player({ itemXml: xml });
		const interactions = player.getInteractionData();

		expect(interactions).toHaveLength(1);
		const interaction = interactions[0] as any;
		expect(interaction.type).toBe('gapMatchInteraction');
		expect(interaction.gaps.length).toBeGreaterThan(0);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// Q8 – Graphic Gap Match Interaction
// ─────────────────────────────────────────────────────────────────────────────

describe('Q8 – Graphic Gap Match Interaction (official conformance XML)', () => {
	it('extracts graphic-gap-match-interaction-1 (gapImg — airport tags)', () => {
		const xml = loadXml(
			'Q8 - Graphic Gap Match Interaction',
			'graphic-gap-match-interaction-1.xml'
		);
		const player = new Player({ itemXml: xml });
		const interactions = player.getInteractionData();

		expect(interactions).toHaveLength(1);
		const interaction = interactions[0] as any;
		expect(interaction.type).toBe('graphicGapMatchInteraction');

		expect(interaction.imageData).not.toBeNull();
		expect(interaction.imageData.type).toBe('image');
		expect(interaction.imageData.src).toBe('images/ukairtags.png');
		expect(interaction.imageData.width).toBe(206);
		expect(interaction.imageData.height).toBe(280);

		expect(interaction.gapImages).toHaveLength(6); // CBG, EBG, EDI, GLA, MAN, MCH
		expect(interaction.hotspots).toHaveLength(3); // A, B, C

		const hotspotA = interaction.hotspots.find((h: any) => h.identifier === 'A');
		expect(hotspotA).toBeDefined();
		expect(hotspotA.shape).toBe('rect');
		expect(hotspotA.coords).toBe('6,100,43,125');
	});

	it('extracts graphic-gap-match-interaction-2 (gapText — airport tags)', () => {
		const xml = loadXml(
			'Q8 - Graphic Gap Match Interaction',
			'graphic-gap-match-interaction-2.xml'
		);
		const player = new Player({ itemXml: xml });
		const interactions = player.getInteractionData();

		expect(interactions).toHaveLength(1);
		const interaction = interactions[0] as any;
		expect(interaction.type).toBe('graphicGapMatchInteraction');

		expect(interaction.imageData).not.toBeNull();
		expect(interaction.imageData.type).toBe('image');
		expect(interaction.imageData.src).toBe('images/ukairtags.png');

		expect(interaction.gapTexts.length).toBeGreaterThan(0);
		expect(interaction.hotspots).toHaveLength(3); // A, B, C
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// Q10 – Hotspot Interaction
// ─────────────────────────────────────────────────────────────────────────────

describe('Q10 – Hotspot Interaction (official conformance XML)', () => {
	it('extracts hotspot-interaction-single (circle choices, single cardinality)', () => {
		const xml = loadXml('Q10 - Hotspot', 'hotspot-interaction-single.xml');
		const player = new Player({ itemXml: xml });
		const interactions = player.getInteractionData();

		expect(interactions).toHaveLength(1);
		const interaction = interactions[0] as any;
		expect(interaction.type).toBe('hotspotInteraction');

		expect(interaction.imageData).not.toBeNull();
		expect(interaction.imageData.type).toBe('image');
		expect(interaction.imageData.src).toBe('images/ukair.png');
		expect(interaction.maxChoices).toBe(1);
		expect(interaction.hotspotChoices).toHaveLength(4); // A, B, C, D

		for (const h of interaction.hotspotChoices) {
			expect(h.shape).toBe('circle');
		}
	});

	it('extracts hotspot-interaction-multiple (maxChoices=0 = unlimited)', () => {
		const xml = loadXml('Q10 - Hotspot', 'hotspot-interaction-multiple.xml');
		const player = new Player({ itemXml: xml });
		const interactions = player.getInteractionData();

		expect(interactions).toHaveLength(1);
		const interaction = interactions[0] as any;
		expect(interaction.maxChoices).toBe(0);
		expect(interaction.hotspotChoices).toHaveLength(4);
	});

	it('extracts hotspot-interaction-shapes (polygon shapes, external SVG via img)', () => {
		const xml = loadXml('Q10 - Hotspot', 'hotspot-interaction-shapes.xml');
		const player = new Player({ itemXml: xml });
		const interactions = player.getInteractionData();

		expect(interactions).toHaveLength(1);
		const interaction = interactions[0] as any;

		// <object data="images/plants.svg" type="image/svg+xml"> with alt text (not inline SVG markup)
		// → must be resolved as type:'image' since there is no <svg> markup in the object content
		expect(interaction.imageData).not.toBeNull();
		expect(interaction.imageData.type).toBe('image');
		expect(interaction.imageData.src).toBe('images/plants.svg');

		expect(interaction.hotspotChoices).toHaveLength(4); // i1(poly), i2(poly), i3(circle), i4(poly)
		expect(interaction.maxChoices).toBe(1);
		expect(interaction.minChoices).toBe(1);

		const i4 = interaction.hotspotChoices.find((h: any) => h.identifier === 'i4');
		expect(i4).toBeDefined();
		expect(i4.shape).toBe('poly');
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// Q11 – Hot-text Interaction
// ─────────────────────────────────────────────────────────────────────────────

describe('Q11 – Hot-text Interaction (official conformance XML)', () => {
	it('extracts hot-text-interaction-1 (single cardinality, maxChoices=1)', () => {
		const xml = loadXml('Q11 - Hot-text Interaction', 'hot-text-interaction-1.xml');
		const player = new Player({ itemXml: xml });
		const interactions = player.getInteractionData();

		expect(interactions).toHaveLength(1);
		const interaction = interactions[0] as any;
		expect(interaction.type).toBe('hottextInteraction');
		expect(interaction.maxChoices).toBe(1);
		expect(interaction.hottextChoices.length).toBeGreaterThanOrEqual(5); // A-E
	});

	it('extracts hot-text-interaction-2 (multiple cardinality, maxChoices=2)', () => {
		const xml = loadXml('Q11 - Hot-text Interaction', 'hot-text-interaction-2.xml');
		const player = new Player({ itemXml: xml });
		const interactions = player.getInteractionData();

		expect(interactions).toHaveLength(1);
		const interaction = interactions[0] as any;
		expect(interaction.maxChoices).toBe(2);
		expect(interaction.hottextChoices.length).toBeGreaterThanOrEqual(5);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// Q12 – Inline Choice Interaction
// ─────────────────────────────────────────────────────────────────────────────

describe('Q12 – Inline Choice Interaction (official conformance XML)', () => {
	it('extracts inline-choice.xml (simple single cardinality)', () => {
		const xml = loadXml('Q12 - Inline Choice Interaction', 'inline-choice.xml');
		const player = new Player({ itemXml: xml });
		const interactions = player.getInteractionData();

		expect(interactions).toHaveLength(1);
		const interaction = interactions[0] as any;
		expect(interaction.type).toBe('inlineChoiceInteraction');
		expect(interaction.choices.length).toBeGreaterThan(0);
	});

	it('extracts inline-choice-mathml.xml (MathML in choices)', () => {
		const xml = loadXml('Q12 - Inline Choice Interaction', 'inline-choice-mathml.xml');
		const player = new Player({ itemXml: xml });
		const interactions = player.getInteractionData();

		expect(interactions).toHaveLength(1);
		const interaction = interactions[0] as any;
		expect(interaction.type).toBe('inlineChoiceInteraction');
		expect(interaction.choices.length).toBeGreaterThan(0);
	});

	it('extracts inline-choice-composite.xml (multiple interactions in one item)', () => {
		const xml = loadXml('Q12 - Inline Choice Interaction', 'inline-choice-composite.xml');
		const player = new Player({ itemXml: xml });
		const interactions = player.getInteractionData();

		// Composite item: multiple inlineChoiceInteractions
		expect(interactions.length).toBeGreaterThan(1);
		for (const interaction of interactions) {
			expect(interaction.type).toBe('inlineChoiceInteraction');
		}
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// Q13 – Match Interaction
// ─────────────────────────────────────────────────────────────────────────────

describe('Q13 – Match Interaction (official conformance XML)', () => {
	it('extracts match-example-1 (Shakespeare character-to-play)', () => {
		const xml = loadXml('Q13 - Match Interaction', 'match-example-1.xml');
		const player = new Player({ itemXml: xml });
		const interactions = player.getInteractionData();

		expect(interactions).toHaveLength(1);
		const interaction = interactions[0] as any;
		expect(interaction.type).toBe('matchInteraction');
		// matchExtractor returns sourceSet and targetSet (two simpleMatchSets)
		expect(interaction.sourceSet.length).toBeGreaterThan(0);
		expect(interaction.targetSet.length).toBeGreaterThan(0);
	});

	it('extracts match-example-2 (maxAssociations=3)', () => {
		const xml = loadXml('Q13 - Match Interaction', 'match-example-2.xml');
		const player = new Player({ itemXml: xml });
		const interactions = player.getInteractionData();

		expect(interactions).toHaveLength(1);
		const interaction = interactions[0] as any;
		expect(interaction.maxAssociations).toBe(3);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// I17 – Composite Item (full responseProcessing, 3 interactions)
// ─────────────────────────────────────────────────────────────────────────────

describe('I17 – Composite Item (official conformance XML)', () => {
	it('extracts all 3 interactions from shakespeare_biography.xml', () => {
		const xml = loadXml('I17 - Composite Item', 'shakespeare_biography.xml');
		const player = new Player({ itemXml: xml });
		const interactions = player.getInteractionData();

		// 2× inlineChoiceInteraction + 1× textEntryInteraction
		expect(interactions).toHaveLength(3);

		const types = interactions.map((i) => i.type).sort();
		expect(types.filter((t) => t === 'inlineChoiceInteraction')).toHaveLength(2);
		expect(types.filter((t) => t === 'textEntryInteraction')).toHaveLength(1);
	});
});
