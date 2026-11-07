import { describe, expect, it } from 'bun:test';
import { parseHTML } from 'linkedom';
import {
	applyPnpToSurface,
	clearPnpSurface,
	isWithinPnpSurface,
	PNP_SURFACE_ATTRIBUTE,
} from '../../src/pnp/applyPnp.js';

function page(markup: string): Document {
	return parseHTML(`<!doctype html><html><body>${markup}</body></html>`).document as unknown as Document;
}

describe('PNP surfaces', () => {
	it('marks the surface and applies the display needs to it', () => {
		const document = page('<div id="surface"></div>');
		const surface = document.getElementById('surface') as HTMLElement;

		applyPnpToSurface(surface, { display: { colorScheme: 'yellowblue', singleColumn: true } });

		expect(surface.hasAttribute(PNP_SURFACE_ATTRIBUTE)).toBe(true);
		expect(surface.getAttribute('data-qti-colorscheme')).toBe('yellowblue');
		expect(surface.getAttribute('data-qti-layout')).toBe('single-column');
	});

	it('stays a surface with an empty profile, so items inside still leave display to it', () => {
		const document = page('<div id="surface"><div class="qti-item-body"></div></div>');
		const surface = document.getElementById('surface') as HTMLElement;

		applyPnpToSurface(surface, undefined);

		expect(surface.hasAttribute(PNP_SURFACE_ATTRIBUTE)).toBe(true);
		expect(surface.hasAttribute('data-qti-colorscheme')).toBe(false);
		expect(isWithinPnpSurface(document.querySelector('.qti-item-body') as Element)).toBe(true);
	});

	it('clearing a surface removes its marker and display attributes', () => {
		const document = page('<div id="surface"></div>');
		const surface = document.getElementById('surface') as HTMLElement;
		applyPnpToSurface(surface, { display: { colorScheme: 'blackwhite' } });

		clearPnpSurface(surface);

		expect(surface.hasAttribute(PNP_SURFACE_ATTRIBUTE)).toBe(false);
		expect(surface.hasAttribute('data-qti-colorscheme')).toBe(false);
	});

	it('finds a surface among the ancestors, never the element itself', () => {
		const document = page(
			`<div ${PNP_SURFACE_ATTRIBUTE}><section><div id="item-body"></div></section></div><div id="outside"></div>`,
		);

		expect(isWithinPnpSurface(document.getElementById('item-body') as Element)).toBe(true);
		expect(isWithinPnpSurface(document.getElementById('outside') as Element)).toBe(false);
		expect(isWithinPnpSurface(document.querySelector(`[${PNP_SURFACE_ATTRIBUTE}]`) as Element)).toBe(false);
	});

	it('looks through shadow roots for the surface', () => {
		const document = page(`<div ${PNP_SURFACE_ATTRIBUTE}><span id="host"></span></div>`);
		const host = document.getElementById('host') as HTMLElement;
		const shadow = host.attachShadow({ mode: 'open' });
		const inner = document.createElement('div');
		shadow.appendChild(inner);

		expect(isWithinPnpSurface(inner)).toBe(true);
	});
});
