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

describe('typesetMathInElement MathML conversion', () => {
	test('renders QTI 3.0 MathML wrapped in mstyle containers', async () => {
		const root = makeRoot(`
			<math xmlns="http://www.w3.org/1998/Math/MathML" display="inline">
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

		expect(root.querySelector('.katex')).toBeTruthy();
		expect(root.textContent).toContain('e');
		expect(root.textContent).toContain('0');
	});

	test('renders QTI 3.0 MathML fractions and fenced expressions inside mstyle', async () => {
		const root = makeRoot(`
			<math xmlns="http://www.w3.org/1998/Math/MathML">
				<mstyle>
					<mrow>
						<mfrac>
							<mrow><mo>|</mo><mo>−</mo><mn>21</mn><mo>|</mo></mrow>
							<mrow><mn>3</mn></mrow>
						</mfrac>
					</mrow>
				</mstyle>
			</math>
			<math xmlns="http://www.w3.org/1998/Math/MathML">
				<mrow>
					<mn>14</mn>
					<mo class="sign">×</mo>
					<mrow>
						<mi>tan</mi>
						<mo>⁡</mo>
						<mfenced><mrow><mn>67</mn></mrow></mfenced>
					</mrow>
				</mrow>
			</math>
		`);

		await typesetMathInElement(root);

		expect(root.querySelectorAll('.katex').length).toBeGreaterThanOrEqual(2);
		expect(root.textContent).toContain('21');
		expect(root.textContent).toContain('3');
		expect(root.textContent).toContain('tan');
		expect(root.textContent).toContain('67');
	});
});
