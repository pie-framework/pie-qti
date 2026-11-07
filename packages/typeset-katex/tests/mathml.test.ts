import { describe, expect, test } from 'bun:test';
import { parseHTML } from 'linkedom';
import { typesetMathInElement } from '../src/index.js';

function makeRoot(html: string): HTMLElement {
	const { document, HTMLElement, Node } = parseHTML(`<!doctype html><html><body><div id="root">${html}</div></body></html>`);
	Object.defineProperty(document, 'compatMode', { value: 'CSS1Compat', configurable: true });
	(globalThis as any).document = document;
	(globalThis as any).HTMLElement = HTMLElement;
	(globalThis as any).Node = Node;

	const root = document.getElementById('root');
	if (!root) {
		throw new Error('test root not found');
	}
	return root as unknown as HTMLElement;
}

function childNames(element: Element | null): string[] {
	return Array.from(element?.children ?? []).map((child) => child.localName);
}

describe('typesetMathInElement keeps authored MathML native', () => {
	test('leaves QTI 3.0 MathML in place with its alttext and structure', async () => {
		const root = makeRoot(`
			<math xmlns="http://www.w3.org/1998/Math/MathML" display="inline" alttext="e to the power zero">
				<mstyle>
					<mrow>
						<msup>
							<mrow><mi>e</mi></mrow>
							<mrow><mn>0</mn></mrow>
						</msup>
					</mrow>
				</mstyle>
			</math>
		`);

		await typesetMathInElement(root);

		const math = root.querySelector('math');
		expect(math).toBeTruthy();
		expect(math?.getAttribute('alttext')).toBe('e to the power zero');
		expect(math?.getAttribute('display')).toBe('inline');
		expect(root.querySelector('msup')).toBeTruthy();
		expect(root.querySelector('.katex')).toBeNull();
	});

	test('keeps elements a LaTeX conversion would lose, such as mtext and munderover', async () => {
		const root = makeRoot(`
			<math xmlns="http://www.w3.org/1998/Math/MathML">
				<munderover><mo>∑</mo><mrow><mi>i</mi><mo>=</mo><mn>1</mn></mrow><mi>n</mi></munderover>
				<mtext>apples</mtext>
				<mfrac><mn>1</mn><mn>2</mn></mfrac>
			</math>
		`);
		const before = root.innerHTML;

		await typesetMathInElement(root);

		expect(root.innerHTML).toBe(before);
		expect(root.querySelector('.katex')).toBeNull();
	});

	test('expands mfenced, which MathML Core does not render, into fenced mrow markup', async () => {
		const root = makeRoot(`
			<math xmlns="http://www.w3.org/1998/Math/MathML" alttext="14 times tan of 67">
				<mrow>
					<mn>14</mn>
					<mo>×</mo>
					<mrow><mi>tan</mi><mo>⁡</mo><mfenced class="arg"><mrow><mn>67</mn></mrow></mfenced></mrow>
				</mrow>
			</math>
		`);

		await typesetMathInElement(root);

		expect(root.querySelector('mfenced')).toBeNull();
		const fenced = root.querySelector('mrow.arg');
		expect(childNames(fenced)).toEqual(['mo', 'mrow', 'mo']);
		const fences = Array.from(fenced?.querySelectorAll(':scope > mo') ?? []);
		expect(fences.map((fence) => fence.textContent)).toEqual(['(', ')']);
		expect(fences.every((fence) => fence.getAttribute('fence') === 'true')).toBe(true);
		expect(fenced?.querySelector('mn')?.textContent).toBe('67');
		expect(root.querySelector('math')?.getAttribute('alttext')).toBe('14 times tan of 67');
	});

	test('expands mfenced separators and custom fences per MathML 3', async () => {
		const root = makeRoot(`
			<math xmlns="http://www.w3.org/1998/Math/MathML">
				<mfenced id="set" open="{" close="}" separators="; ,"><mi>a</mi><mi>b</mi><mi>c</mi><mi>d</mi></mfenced>
				<mfenced id="abs" open="" close="|"><mi>x</mi></mfenced>
			</math>
		`);

		await typesetMathInElement(root);

		const set = root.querySelector('#set');
		expect(childNames(set)).toEqual(['mo', 'mrow', 'mo']);
		expect(Array.from(set?.children[1]?.children ?? []).map((child) => child.textContent)).toEqual([
			'a',
			';',
			'b',
			',',
			'c',
			',',
			'd',
		]);
		expect(set?.firstElementChild?.textContent).toBe('{');
		expect(set?.lastElementChild?.textContent).toBe('}');

		const abs = root.querySelector('#abs');
		expect(childNames(abs)).toEqual(['mi', 'mo']);
		expect(abs?.lastElementChild?.textContent).toBe('|');
	});

	test('re-creates prefixed MathML (m:math) as native MathML, keeping alttext', async () => {
		const root = makeRoot(`
			<p>Solve <m:math xmlns:m="http://www.w3.org/1998/Math/MathML" alttext="x squared"><m:msup><m:mi>x</m:mi><m:mn>2</m:mn></m:msup></m:math>.</p>
		`);

		await typesetMathInElement(root);

		expect(Array.from(root.querySelectorAll('*')).some((element) => element.localName.includes(':'))).toBe(false);
		const math = root.querySelector('math');
		expect(math?.getAttribute('alttext')).toBe('x squared');
		expect(math?.hasAttribute('xmlns:m')).toBe(false);
		expect(childNames(math)).toEqual(['msup']);
		expect(childNames(root.querySelector('msup'))).toEqual(['mi', 'mn']);
		expect(root.querySelector('p')?.textContent?.replace(/\s+/g, '')).toBe('Solvex2.');
	});

	test('is idempotent across repeated typesetting passes', async () => {
		const root = makeRoot(`
			<m:math><m:mfenced><m:mi>a</m:mi><m:mi>b</m:mi></m:mfenced></m:math>
			<p>\\(x^2\\)</p>
		`);

		await typesetMathInElement(root);
		const once = root.innerHTML;
		await typesetMathInElement(root);

		expect(root.innerHTML).toBe(once);
		expect(root.querySelector('mfenced')).toBeNull();
		expect(root.querySelectorAll('.katex').length).toBe(1);
	});

	test('does not rewrite MathML inside editable regions', async () => {
		const root = makeRoot(`
			<div contenteditable="true"><math><mfenced><mi>a</mi></mfenced></math></div>
		`);

		await typesetMathInElement(root);

		expect(root.querySelector('mfenced')).toBeTruthy();
	});
});

describe('typesetMathInElement typesets LaTeX in text', () => {
	test('renders LaTeX delimiters in text with KaTeX', async () => {
		const root = makeRoot('<p>Area: \\(x^2\\) and \\[\\frac{1}{2}\\]</p>');

		await typesetMathInElement(root);

		expect(root.querySelectorAll('.katex').length).toBe(2);
	});

	test('never typesets LaTeX-looking text inside authored MathML', async () => {
		const root = makeRoot(`
			<math><mtext>\\(not latex\\)</mtext></math>
			<p>\\(y\\)</p>
		`);

		await typesetMathInElement(root);

		expect(root.querySelectorAll('.katex').length).toBe(1);
		expect(root.querySelector('mtext')?.textContent).toBe('\\(not latex\\)');
	});
});
