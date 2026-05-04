/**
 * Extractor conformance tests — QTI 3.0 Advanced Level.
 *
 * Verifies deterministic parsing/preservation for official Advanced packages
 * where browser-only visual verification is still required separately.
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'bun:test';
import { Player } from '../../core/Player.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFORMANCE_30_ADVANCED = join(__dirname, '../../../../../../qti-conformance/qti3.0/Advanced');

function loadXml(packageDir: string, filename: string): string {
	return readFileSync(join(CONFORMANCE_30_ADVANCED, packageDir, filename), 'utf-8');
}

describe('QTI 3.0 Advanced Shared Vocabulary extraction', () => {
	it('Q5 advanced: extracts counter and height classes from extended text', () => {
		const xml = loadXml('Q5 - Extended Text Entry Interaction/baseType-string', 'extended-text-sv-3.xml');
		const player = new Player({ itemXml: xml });
		const interactions = player.getInteractionData() as any[];
		const interaction = interactions.find((i) => i.responseId === 'RESPONSE7');

		expect(interaction.type).toBe('extendedTextInteraction');
		expect(interaction.interactionClasses).toContain('qti-counter-down');
		expect(interaction.interactionClasses).toContain('qti-height-lines-3');
	});

	it('Q6 advanced: extracts choice positioning and selection message metadata', () => {
		const xml = loadXml('Q6 - Gap Match Interaction', 'gap-match-sv-3.xml');
		const player = new Player({ itemXml: xml });
		const interactions = player.getInteractionData() as any[];

		expect(interactions).toHaveLength(2);
		expect(interactions[0].maxSelectionsMessage).toBeTruthy();
		expect(interactions[0].minSelectionsMessage).toBeTruthy();
	});

	it('Q13 advanced: extracts tabular match shared vocabulary classes', () => {
		const xml = loadXml('Q13 - Match Interaction', 'match-example-sv-2.xml');
		const player = new Player({ itemXml: xml });
		const interaction = (player.getInteractionData() as any[]).find((i) => i.responseId === 'RESPONSE2');

		expect(interaction.type).toBe('matchInteraction');
		expect(interaction.interactionClasses).toContain('qti-match-tabular');
		expect(interaction.interactionClasses).toContain('qti-header-hidden');
	});
});

describe('QTI 3.0 Advanced content preservation', () => {
	it('I20: preserves full Shared Vocabulary classes in item body HTML', () => {
		const xml = loadXml('I20 Shared Vocabulary CSS', 'qti-shared-vocabulary-1.xml');
		const player = new Player({ itemXml: xml });
		const html = player.getItemBodyHtml();

		expect(html).toContain('qti-underline');
		expect(html).toContain('qti-italic');
		expect(html).toContain('qti-align-center');
		expect(html).toContain('qti-fullwidth');
	});

	it('A13/A15: preserves caption tracks and glossary catalog references', () => {
		const xml = loadXml('A13captions_A15glossary', 'qti-glossary-captions.xml');
		const player = new Player({ itemXml: xml });
		const html = player.getItemBodyHtml();

		expect(html).toContain('<video');
		expect(html).toContain('<track');
		expect(html).toContain('kind="captions"');
		expect(html).toContain('data-catalog-idref="glosscat"');
		expect(player.getCatalogEntry('glosscat', 'glossary-on-screen')).toContain('abbreviation');
	});
});

describe('QTI 3.0 Advanced shared stimulus references', () => {
	it('I4: keeps qti-assessment-stimulus-ref available for package-level stimulus loading', () => {
		const xml = loadXml('I4 Shared Stimulus', 'Items/Item-2/unbelievable_night_item2.xml');

		expect(xml).toContain('<qti-assessment-stimulus-ref');
		expect(xml).toContain('identifier="Stimulus1"');
		expect(xml).toContain('href="../../Passages/UnbelievableNight/unbelievableNight.xml"');
		expect(xml).toContain('data-stimulus-idref="Stimulus1"');
	});
});
