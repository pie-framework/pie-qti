import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';

function source(path: string): string {
	return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

const promptComponents = [
	'src/plugins/associate/AssociateInteraction.svelte',
	'src/plugins/choice/ChoiceInteraction.svelte',
	'src/plugins/end-attempt/EndAttemptInteraction.svelte',
	'src/plugins/gap-match/GapMatchInteraction.svelte',
	'src/plugins/graphic-associate/GraphicAssociateInteraction.svelte',
	'src/plugins/graphic-gap-match/GraphicGapMatchInteraction.svelte',
	'src/plugins/graphic-order/GraphicOrderInteraction.svelte',
	'src/plugins/hotspot/HotspotInteraction.svelte',
	'src/plugins/hottext/HottextInteraction.svelte',
	'src/plugins/match/MatchInteraction.svelte',
	'src/plugins/media/MediaInteraction.svelte',
	'src/plugins/order/OrderInteraction.svelte',
	'src/plugins/position-object/PositionObjectInteraction.svelte',
	'src/plugins/select-point/SelectPointInteraction.svelte',
	'src/plugins/slider/SliderInteraction.svelte',
] as const;

describe('rich QTI content markup', () => {
	it('provides a shared rich-content reset for nested QTI block markup', () => {
		const styles = source('src/shared/components/ShadowBaseStyles.svelte');

		expect(styles).toContain(':global(.qti-rich-content)');
		expect(styles).toContain(':global(.qti-rich-content > :first-child)');
		expect(styles).toContain(':global(.qti-rich-content > :last-child)');
		expect(styles).toContain(
			':global(.qti-rich-content :is(p, ul, ol, blockquote, pre, table):first-child)'
		);
		expect(styles).toContain(
			':global(.qti-rich-content :is(p, ul, ol, blockquote, pre, table):last-child)'
		);
	});

	it('does not render rich prompts inside paragraph elements', () => {
		for (const path of promptComponents) {
			const component = source(path);

			expect(component, path).not.toMatch(/<p\b[^>]*>\s*\{@html parsedInteraction\.prompt\}\s*<\/p>/);
			expect(component, path).toContain('qti-rich-content');
		}
	});

	it('uses rich-content containers for choice-like rendered labels', () => {
		expect(source('src/plugins/choice/ChoiceInteraction.svelte')).toContain(
			'class="qti-choice-text qti-rich-content label-text"'
		);
		expect(source('src/plugins/associate/AssociateInteraction.svelte')).toContain(
			'class="qti-associate-choice-text qti-rich-inline-content"'
		);
		expect(source('src/plugins/gap-match/GapMatchInteraction.svelte')).toContain(
			'class="qti-gm-text qti-rich-content'
		);
	});

	it('renders sortable labels as rich content while keeping accessible labels plain', () => {
		const component = source('src/shared/components/SortableList.svelte');

		expect(component).toContain('function itemLabel(item: Item): string');
		expect(component).toContain('aria-label="{label}. Position');
		expect(component).toContain('class="qti-sortable-text qti-rich-content flex-1"');
		expect(component).toContain('{@html item.text}');
		expect(component).not.toContain('aria-label="{item.text}. Position');
	});
});
