import { describe, expect, test } from 'bun:test';
import type { ResolvedItemDeliveryContext } from '@pie-qti/ims-cp-core';
import { buildEffectiveStimulusContent, injectStimulusContent } from '../../src/components/utils/stimulusRender.js';

describe('shared stimulus runtime rendering helpers', () => {
	test('prepends root-level resolved stimulus content before item body when no dock is present', () => {
		const html = '<p>Question</p>';

		const rendered = injectStimulusContent(html, {
			passage_1: '<section><p>Shared passage</p></section>',
		});

		expect(rendered.indexOf('Shared passage')).toBeLessThan(rendered.indexOf('Question'));
		expect(rendered).toContain('class="qti-stimulus-block"');
	});

	test('preserves existing docking attributes and merges the stimulus dock class once', () => {
		const html = `<div data-region="left" class="existing" data-stimulus-idref="passage_1"></div>`;

		const rendered = injectStimulusContent(html, {
			passage_1: '<p>Shared passage</p>',
		});

		expect(rendered).toContain('data-region="left"');
		expect(rendered).toContain('class="existing qti-stimulus-dock"');
		expect(rendered.match(/\bclass=/g)?.length).toBe(1);
		expect(rendered).toContain('<p>Shared passage</p>');
	});

	test('prepends undocked resolved stimuli using delivery-context insertion order', () => {
		const rendered = injectStimulusContent('<p>Item body</p>', {
			passage_1: '<p>First shared passage</p>',
			passage_2: '<p>Second shared passage</p>',
		});

		expect(rendered.indexOf('First shared passage')).toBeLessThan(rendered.indexOf('Second shared passage'));
		expect(rendered.indexOf('Second shared passage')).toBeLessThan(rendered.indexOf('Item body'));
		expect(rendered).toContain('data-stimulus-idref="passage_1"');
		expect(rendered).toContain('class="qti-stimulus-block"');
	});

	test('renders a stimulus only once when both compatibility markers target the same identifier', () => {
		const html = `<qti-assessment-stimulus-ref identifier="passage_1" href="../stimuli/passage.xml"/>
<p>Question stem.</p>
<div data-stimulus-idref="passage_1"></div>`;

		const rendered = injectStimulusContent(html, {
			passage_1: '<p>Shared passage</p>',
		});

		expect(rendered.match(/Shared passage/g)?.length).toBe(1);
		expect(rendered).not.toContain('qti-assessment-stimulus-ref');
		expect(rendered.indexOf('Question stem')).toBeLessThan(rendered.indexOf('Shared passage'));
	});

	test('explicit stimulus content overrides resolved delivery-context content after sanitization', () => {
		const deliveryContext: ResolvedItemDeliveryContext = {
			itemHref: 'items/item.xml',
			stimuli: {
				passage_1: {
					identifier: 'passage_1',
					href: '../stimuli/passage.xml',
					resolvedHref: 'stimuli/passage.xml',
					bodyHtml: '<p>Resolved passage</p>',
					stylesheets: [],
					validationMessages: [],
				},
			},
			stylesheets: [],
			catalogSources: [],
			validationMessages: [],
		};

		const content = buildEffectiveStimulusContent(
			deliveryContext,
			{ passage_1: '<script></script><p>Explicit passage</p>' },
			(html) => html.replace(/<script><\/script>/g, '')
		);

		expect(content.passage_1).toBe('<p>Explicit passage</p>');
	});

	test('leaves unresolved stimulus refs untouched for diagnostics', () => {
		const html = '<qti-assessment-stimulus-ref identifier="missing" href="../stimuli/missing.xml"/>';

		expect(injectStimulusContent(html, {})).toBe(html);
		expect(injectStimulusContent(html, { other: '<p>Other</p>' })).toContain('identifier="missing"');
	});
});
