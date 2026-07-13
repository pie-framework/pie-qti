import { describe, expect, test } from 'bun:test';
import { sanitizeHtml } from '../../src/core/sanitizer.js';

describe('HTML sanitizer hardening', () => {
	test('removes CSS resource functions from inline styles while preserving safe presentation', () => {
		const unsafe = sanitizeHtml(
			'<div style="background-image: url(https://tracker.invalid/pixel)">Tracked</div>',
		);
		const safe = sanitizeHtml('<div style="color: #123456; text-align: center">Safe</div>');
		const positioned = sanitizeHtml('<div style="position: absolute; left: 10px">Placed</div>');

		expect(unsafe).toBe('<div>Tracked</div>');
		expect(safe).toContain('style="color: #123456; text-align: center"');
		expect(positioned).toContain('style="position: absolute; left: 10px"');
	});

	test('removes viewport-overlay positioning from inline styles', () => {
		const escaped = sanitizeHtml(
			'<div style="position: f\\69xed; inset: 0; z-index: 999999">Spoofed overlay</div>',
		);
		const variable = sanitizeHtml(
			'<div style="--overlay-position: fixed; position: var(--overlay-position); inset: 0">Variable overlay</div>',
		);
		const fallback = sanitizeHtml(
			'<div style="position: var(--missing, fixed); inset: 0">Fallback overlay</div>',
		);

		expect(escaped).toBe('<div>Spoofed overlay</div>');
		expect(variable).toBe('<div>Variable overlay</div>');
		expect(fallback).toBe('<div>Fallback overlay</div>');
	});

	test('unwraps arbitrary custom elements without discarding safe child content', () => {
		const html = sanitizeHtml(
			'<host-privileged-widget secret="value"><script>alert("xss")</script><img src="safe.png" onerror="alert(1)"><strong>Readable</strong></host-privileged-widget>' +
				'<qti-host-privileged-widget secret="qti-value"><em>QTI-prefix child</em></qti-host-privileged-widget>' +
				'<button is="host-privileged-button">Action</button><qti-gap identifier="G1"></qti-gap>',
		);

		expect(html).toContain('<strong>Readable</strong>');
		expect(html).not.toContain('<script');
		expect(html).not.toContain('onerror');
		expect(html).not.toContain('host-privileged-widget');
		expect(html).not.toContain('qti-host-privileged-widget');
		expect(html).not.toContain('secret=');
		expect(html).toContain('<em>QTI-prefix child</em>');
		expect(html).toContain('<button>Action</button>');
		expect(html).not.toContain(' is=');
		expect(html).toContain('<qti-gap identifier="G1"></qti-gap>');
	});

	test('removes link ping endpoints and legacy background loads', () => {
		const html = sanitizeHtml(
			'<a href="lesson.html" ping="https://tracker.invalid/p">Lesson</a>' +
				'<table background="javascript:alert(1)"><tr><td>Data</td></tr></table>',
		);

		expect(html).toContain('href="lesson.html"');
		expect(html).not.toContain('ping=');
		expect(html).not.toContain('background=');
	});

	test('blocks external SVG paint/filter URLs while preserving local fragments', () => {
		const html = sanitizeHtml([
			'<svg>',
			'<defs><linearGradient id="local-gradient"></linearGradient></defs>',
			'<rect id="external" filter="url(https://tracker.invalid/filter.svg#x)" fill="url(//tracker.invalid/paint.svg#x)"></rect>',
			'<rect id="local" filter="url(#local-filter)" fill="url(\'#local-gradient\')"></rect>',
			'</svg>',
		].join(''));

		expect(html).not.toContain('tracker.invalid');
		expect(html).toContain('filter="url(#local-filter)"');
		expect(html).toContain("fill=\"url('#local-gradient')\"");
	});

	test('removes SVG SMIL elements that can mutate sanitized URL attributes', () => {
		const html = sanitizeHtml([
			'<svg xmlns="http://www.w3.org/2000/svg">',
			'<animate xlink:href="#link" attributeName="href" values="javascript:alert(1)" dur="1s"></animate>',
			'<set xlink:href="#link" attributeName="href" to="javascript:alert(2)"></set>',
			'<a id="link" href="#safe"><text>Safe label</text></a>',
			'</svg>',
		].join(''));

		expect(html).not.toContain('<animate');
		expect(html).not.toContain('<set');
		expect(html).not.toContain('javascript:');
		expect(html).toContain('Safe label');
	});
});
