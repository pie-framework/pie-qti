import { describe, expect, it } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { INTERACTION_DESCRIPTION_ID, interactionAria } from '../src/shared/utils/interactionAria';

const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
const sharedCss = read('shared/styles/qti-shared-vocabulary.css');

describe('shared vocabulary stylesheet', () => {
	it.each([
		'.qti-display-table-cell',
		'.qti-width-1-12',
		'.qti-width-11-12',
		'.qti-width-full',
		'.qti-fullwidth',
		'.qti-height-px',
		'.qti-height-5-6',
		'.qti-height-auto',
		'.qti-text-indent-32',
		'.qti-flex-direction-column',
		'.qti-flex-grow-1',
		'.qti-float-left',
		'.qti-float-clear-both',
		'.qti-float-clearfix::after',
		'.qti-writing-mode-vertical-rl',
		'.qti-text-orientation-mixed',
		'.qti-text-orientation-sideways',
		'.qti-text-combine-upright-all',
		'.qti-list-style-type-none',
		'.qti-list-style-type-cjk-ideographic',
		'.qti-list-style-type-urdu',
	])('styles %s', (selector) => {
		expect(sharedCss).toContain(selector);
	});
});

describe('choice interaction vocabulary', () => {
	const source = read('plugins/choice/ChoiceInteraction.svelte');

	it.each(['decimal', 'lower-alpha', 'upper-alpha', 'cjk-ideographic'])('generates qti-labels-%s labels', (style) => {
		expect(source).toContain(`.qti-choice-interaction.qti-labels-${style} .qti-choice-text::before`);
		expect(source).toContain(`counter(qti-choice, ${style}) var(--qti-label-suffix)`);
	});

	it.each([
		['none', "''"],
		['period', "'.'"],
		['parenthesis', "')'"],
	])('sets the qti-labels-suffix-%s suffix', (suffix, value) => {
		expect(source).toContain(`.qti-choice-interaction.qti-labels-suffix-${suffix} { --qti-label-suffix: ${value}; }`);
	});

	it('lays out vertical writing orientation', () => {
		expect(source).toContain('.qti-choice-interaction.qti-writing-orientation-vertical-rl { writing-mode: vertical-rl; }');
		expect(source).toContain('.qti-choice-interaction.qti-writing-orientation-vertical-lr { writing-mode: vertical-lr; }');
		expect(source).toContain('.qti-choice-interaction.qti-orientation-vertical');
	});
});

describe('order interaction vocabulary', () => {
	const source = read('plugins/order/OrderInteraction.svelte');
	const list = read('shared/components/SortableList.svelte');

	it('maps qti-labels-* and qti-labels-suffix-* onto the position badges', () => {
		for (const token of ['qti-labels-none', 'qti-labels-lower-alpha', 'qti-labels-upper-alpha']) {
			expect(source).toContain(`classes.includes('${token}')`);
		}
		expect(source).toContain("classes.includes('qti-labels-suffix-period') ? '.'");
		expect(source).toContain("classes.includes('qti-labels-suffix-parenthesis') ? ')'");
		expect(list).toContain("{#if indexLabels !== 'none'}");
	});

	it('takes qti-orientation-* over the orientation attribute', () => {
		expect(source).toContain("classes.includes('qti-orientation-horizontal')");
		expect(source).toContain("!classes.includes('qti-orientation-vertical')");
	});
});

describe('qti-choices-* placement', () => {
	it('places the gap-match word palette', () => {
		const source = read('plugins/gap-match/GapMatchInteraction.svelte');
		expect(source).toContain('.qti-gap-match-interaction.qti-choices-bottom .qti-gm-layout { flex-direction: column-reverse; }');
		expect(source).toContain('.qti-gap-match-interaction.qti-choices-left .qti-gm-layout { flex-direction: row; }');
		expect(source).toContain('.qti-gap-match-interaction.qti-choices-right .qti-gm-layout { flex-direction: row-reverse; }');
	});

	it('places the graphic gap-match labels', () => {
		const source = read('plugins/graphic-gap-match/GraphicGapMatchInteraction.svelte');
		expect(source).toContain('.qti-graphic-gap-match-interaction.qti-choices-bottom .qti-ggm-region { flex-direction: column-reverse; }');
		expect(source).toContain('.qti-graphic-gap-match-interaction.qti-choices-left .qti-ggm-region { flex-direction: row; }');
		expect(source).toContain('.qti-graphic-gap-match-interaction.qti-choices-right .qti-ggm-region { flex-direction: row-reverse; }');
	});

	it('places the match source column', () => {
		const source = read('plugins/match/MatchInteraction.svelte');
		expect(source).toContain('.qti-match-interaction:is(.qti-choices-top, .qti-choices-bottom) :global(.qti-match-grid)');
		expect(source).toContain(
			".qti-match-interaction:is(.qti-choices-bottom, .qti-choices-right) :global(.qti-match-grid > [part='source-column'])",
		);
	});
});

describe('qti-unselected-hidden', () => {
	it('hides unselected hotspots until focused', () => {
		const source = read('plugins/hotspot/HotspotInteraction.svelte');
		expect(source).toContain('.qti-unselected-hidden .qti-hotspot-shape:not([data-selected]):not(:focus-visible)');
		expect(source.match(/data-selected=\{isSelected \? '' : undefined\}/g)?.length).toBe(4);
	});

	it('hides unselected hottext until focused', () => {
		const source = read('plugins/hottext/HottextInteraction.svelte');
		expect(source).toContain(
			'.qti-unselected-hidden :global(.hottext-content :is(hottext, qti-hottext):not(.selected):not(:focus-visible))',
		);
	});

	it('hides empty graphic gap-match zones until focused', () => {
		const source = read('plugins/graphic-gap-match/GraphicGapMatchInteraction.svelte');
		expect(source).toContain('.qti-graphic-gap-match-interaction.qti-unselected-hidden .qti-ggm-hotspot:not([data-filled]):not(:focus-visible)');
	});

	it('styles qti-selections-light and qti-selections-dark hotspots', () => {
		const source = read('plugins/hotspot/HotspotInteraction.svelte');
		expect(source).toContain('.qti-selections-light .qti-hotspot-shape');
		expect(source).toContain('.qti-selections-dark .qti-hotspot-shape');
	});
});

describe('interaction accessible names', () => {
	it('labels a group from the authored accessibility', () => {
		expect(interactionAria({ accessibility: { label: 'Planets', description: 'Pick two.' } })).toEqual({
			role: 'group',
			'aria-label': 'Planets',
			'aria-describedby': INTERACTION_DESCRIPTION_ID,
		});
		expect(interactionAria({ accessibility: { description: 'Pick two.' } })).toEqual({
			role: 'group',
			'aria-describedby': INTERACTION_DESCRIPTION_ID,
		});
	});

	it('adds nothing without authored accessibility', () => {
		expect(interactionAria({})).toEqual({});
		expect(interactionAria(undefined)).toEqual({});
	});

	it('every interaction root spreads the attributes and renders the description', () => {
		const plugins = readdirSync(new URL('../src/plugins', import.meta.url), { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.flatMap((entry) =>
				readdirSync(new URL(`../src/plugins/${entry.name}`, import.meta.url))
					.filter((file) => file.endsWith('Interaction.svelte'))
					.map((file) => `plugins/${entry.name}/${file}`),
			);
		expect(plugins.length).toBe(20);
		for (const plugin of plugins) {
			const source = read(plugin);
			expect(source, plugin).toContain('<InteractionDescription interaction={parsedInteraction} />');
			expect(source, plugin).toMatch(/interactionAria\(parsedInteraction\)/);
		}
	});
});
