/**
 * Extractor conformance tests — QTI 3.0 Basic Level (Shared Vocabulary)
 *
 * Verifies that interaction-level CSS classes (qti-labels-*, qti-height-lines-N,
 * qti-input-width-N) and data-patternmask-message are correctly extracted from
 * official 1EdTech QTI 3.0 Basic conformance packages.
 *
 * Criteria covered:
 *   Q2-L1-D201–D217  — qti-labels-* / qti-orientation-* on choice interaction
 *   Q5-L1-D101–D104  — qti-height-lines-N on extended text interaction
 *   Q20-L1-D102–D118 — qti-input-width-N on text entry interaction
 *   Q20-L1-D111      — data-patternmask-message on text entry interaction
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { describe, it, expect } from 'bun:test';
import { Player } from '../../core/Player.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFORMANCE_30 = join(__dirname, '../../../../../../qti-conformance/qti3.0/Basic');

function loadXml(packageDir: string, filename: string): string {
	return readFileSync(join(CONFORMANCE_30, packageDir, filename), 'utf-8');
}

// ─────────────────────────────────────────────────────────────────────────────
// Q2 — Choice Interaction (Shared Vocabulary classes)
// ─────────────────────────────────────────────────────────────────────────────

describe('Q2 – Choice Interaction shared vocabulary classes (QTI 3.0 Basic official XML)', () => {
	it('single-cardinality-sv-1: no interaction classes (baseline item)', () => {
		const xml = loadXml('Q2 - Choice Interaction/single-cardinality', 'single-cardinality-sv-1.xml');
		const player = new Player({ itemXml: xml });
		const interactions = player.getInteractionData();
		expect(interactions).toHaveLength(1);
		const interaction = interactions[0] as any;
		expect(interaction.type).toBe('qti-choice-interaction');
		// No interactionClasses on a baseline item
		expect(interaction.interactionClasses ?? []).toHaveLength(0);
	});

	it('single-cardinality-sv-2a: extracts qti-labels-none from qti-choice-interaction', () => {
		const xml = loadXml('Q2 - Choice Interaction/single-cardinality', 'single-cardinality-sv-2a.xml');
		const player = new Player({ itemXml: xml });
		const interactions = player.getInteractionData();
		expect(interactions).toHaveLength(1);
		const interaction = interactions[0] as any;
		expect(interaction.type).toBe('qti-choice-interaction');
		expect(interaction.interactionClasses).toBeDefined();
		expect(interaction.interactionClasses).toContain('qti-labels-none');
	});

	it('multiple-cardinality-sv-1: extracts choices correctly (baseline, max-choices=0 means unlimited)', () => {
		const xml = loadXml('Q2 - Choice Interaction/multiple-cardinality', 'multiple-cardinality-sv-1.xml');
		const player = new Player({ itemXml: xml });
		const interactions = player.getInteractionData();
		expect(interactions).toHaveLength(1);
		const interaction = interactions[0] as any;
		expect(interaction.type).toBe('qti-choice-interaction');
		// max-choices="0" means unlimited selections per QTI spec
		expect(interaction.maxChoices).toBe(0);
		expect(interaction.choices.length).toBeGreaterThan(1);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// Q5 — Extended Text Interaction (qti-height-lines-N)
// ─────────────────────────────────────────────────────────────────────────────

describe('Q5 – Extended Text Interaction shared vocabulary classes (QTI 3.0 Basic official XML)', () => {
	it('base-type-string: no interaction classes (baseline item)', () => {
		const xml = loadXml('Q5 - Extended Text Entry Interaction/baseType-string', 'base-type-string.xml');
		const player = new Player({ itemXml: xml });
		const interactions = player.getInteractionData();
		expect(interactions).toHaveLength(1);
		const interaction = interactions[0] as any;
		expect(interaction.type).toBe('qti-extended-text-interaction');
		expect(interaction.interactionClasses ?? []).toHaveLength(0);
	});

	it('extended-text-sv-2a: extracts qti-height-lines-3', () => {
		const xml = loadXml('Q5 - Extended Text Entry Interaction/baseType-string', 'extended-text-sv-2a.xml');
		const player = new Player({ itemXml: xml });
		const interactions = player.getInteractionData();
		expect(interactions).toHaveLength(1);
		const interaction = interactions[0] as any;
		expect(interaction.type).toBe('qti-extended-text-interaction');
		expect(interaction.interactionClasses).toBeDefined();
		expect(interaction.interactionClasses).toContain('qti-height-lines-3');
	});

	it('extended-text-sv-2b: extracts qti-height-lines-6', () => {
		const xml = loadXml('Q5 - Extended Text Entry Interaction/baseType-string', 'extended-text-sv-2b.xml');
		const player = new Player({ itemXml: xml });
		const interactions = player.getInteractionData();
		expect(interactions).toHaveLength(1);
		const interaction = interactions[0] as any;
		expect(interaction.interactionClasses).toContain('qti-height-lines-6');
	});

	it('extended-text-sv-2c: extracts qti-height-lines-15', () => {
		const xml = loadXml('Q5 - Extended Text Entry Interaction/baseType-string', 'extended-text-sv-2c.xml');
		const player = new Player({ itemXml: xml });
		const interactions = player.getInteractionData();
		expect(interactions).toHaveLength(1);
		const interaction = interactions[0] as any;
		expect(interaction.interactionClasses).toContain('qti-height-lines-15');
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// Q20 — Text Entry Interaction (qti-input-width-N + data-patternmask-message)
// ─────────────────────────────────────────────────────────────────────────────

describe('Q20 – Text Entry Interaction shared vocabulary classes (QTI 3.0 Basic official XML)', () => {
	it('base-type-string: no interaction classes (baseline item)', () => {
		const xml = loadXml('Q20 - Text Entry Interaction/baseType-string', 'base-type-string.xml');
		const player = new Player({ itemXml: xml });
		const interactions = player.getInteractionData();
		expect(interactions).toHaveLength(1);
		const interaction = interactions[0] as any;
		expect(interaction.type).toBe('qti-text-entry-interaction');
		expect(interaction.interactionClasses ?? []).toHaveLength(0);
	});

	it('text-entry-sv-2a: extracts qti-input-width-1', () => {
		const xml = loadXml('Q20 - Text Entry Interaction/baseType-string', 'text-entry-sv-2a.xml');
		const player = new Player({ itemXml: xml });
		const interactions = player.getInteractionData();
		expect(interactions).toHaveLength(1);
		const interaction = interactions[0] as any;
		expect(interaction.type).toBe('qti-text-entry-interaction');
		expect(interaction.interactionClasses).toBeDefined();
		expect(interaction.interactionClasses).toContain('qti-input-width-1');
	});

	it('text-entry-sv-2b: extracts qti-input-width-2', () => {
		const xml = loadXml('Q20 - Text Entry Interaction/baseType-string', 'text-entry-sv-2b.xml');
		const player = new Player({ itemXml: xml });
		const interactions = player.getInteractionData();
		expect(interactions).toHaveLength(1);
		const interaction = interactions[0] as any;
		expect(interaction.interactionClasses).toContain('qti-input-width-2');
	});

	it('text-entry-sv-3: extracts qti-input-width-6 and data-patternmask-message', () => {
		const xml = loadXml('Q20 - Text Entry Interaction/baseType-string', 'text-entry-sv-3.xml');
		const player = new Player({ itemXml: xml });
		const interactions = player.getInteractionData();
		expect(interactions).toHaveLength(1);
		const interaction = interactions[0] as any;
		expect(interaction.type).toBe('qti-text-entry-interaction');
		expect(interaction.interactionClasses).toContain('qti-input-width-6');
		expect(interaction.patternMaskMessage).toBe('Maximum of 6 digits or decimal points permitted');
	});
});
