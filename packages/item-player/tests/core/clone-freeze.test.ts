import { describe, expect, test } from 'bun:test';
import { createAssessmentItemDefinition } from '../../src/core/AssessmentItemDefinition.js';
import { cloneValue, deepFreezeInPlace, frozenSnapshot } from '../../src/utils/cloneFreeze.js';

describe('cloneValue', () => {
	test('deep-copies plain objects and arrays into independent unfrozen data', () => {
		const source = { a: [1, { b: 'x' }], c: { d: null } };
		const copy = cloneValue(source);
		expect(copy).toEqual(source);
		expect(copy).not.toBe(source);
		expect((copy as typeof source).a).not.toBe(source.a);
		expect(Object.isFrozen(copy)).toBe(false);
	});

	test('copies typed arrays and buffers and never freezes them', () => {
		const pixels = new Uint8ClampedArray([0, 0, 0, 255]);
		const copy = cloneValue({ imageData: { data: pixels, width: 1, height: 1 } }) as {
			imageData: { data: Uint8ClampedArray };
		};
		expect(copy.imageData.data).toBeInstanceOf(Uint8ClampedArray);
		expect(copy.imageData.data).not.toBe(pixels);
		expect([...copy.imageData.data]).toEqual([0, 0, 0, 255]);
		// A frozen copy would be unusable, and freezing the original in place would throw.
		expect(Object.isFrozen(copy.imageData.data)).toBe(false);
		expect(() => deepFreezeInPlace({ data: pixels })).not.toThrow();
		expect(Object.isFrozen(pixels)).toBe(false);
	});

	test('keeps TrustedHTML, Blob and other non-plain values by identity', () => {
		class FakeTrustedHtml {
			constructor(readonly value: string) {}
			toString() {
				return this.value;
			}
		}
		const trusted = new FakeTrustedHtml('<p>hi</p>');
		const blob = new Blob(['drawing'], { type: 'image/png' });
		const copy = cloneValue({ html: trusted, attachment: blob }) as {
			html: FakeTrustedHtml;
			attachment: Blob;
		};
		expect(copy.html).toBe(trusted);
		expect(copy.attachment).toBe(blob);
	});
});

describe('frozenSnapshot', () => {
	test('freezes every plain level but not typed-array leaves', () => {
		const snapshot = frozenSnapshot({
			responses: { DRAW: { imageData: { data: new Uint8ClampedArray([9, 9]) } } },
		}) as { responses: { DRAW: { imageData: { data: Uint8ClampedArray } } } };
		expect(Object.isFrozen(snapshot)).toBe(true);
		expect(Object.isFrozen(snapshot.responses)).toBe(true);
		expect(Object.isFrozen(snapshot.responses.DRAW)).toBe(true);
		expect(Object.isFrozen(snapshot.responses.DRAW.imageData)).toBe(true);
		expect(Object.isFrozen(snapshot.responses.DRAW.imageData.data)).toBe(false);
		expect([...snapshot.responses.DRAW.imageData.data]).toEqual([9, 9]);
	});
});

describe('deepFreezeInPlace', () => {
	test('freezes the given graph in place, leaving host leaves alone', () => {
		class FakeTrustedHtml {
			constructor(readonly value: string) {}
			toString() {
				return this.value;
			}
		}
		const trusted = new FakeTrustedHtml('<b>x</b>');
		const plan = { flow: [{ kind: 'html', html: trusted }], disabled: false };
		const returned = deepFreezeInPlace(plan);
		expect(returned).toBe(plan);
		expect(Object.isFrozen(plan)).toBe(true);
		expect(Object.isFrozen(plan.flow)).toBe(true);
		expect(Object.isFrozen(plan.flow[0])).toBe(true);
		expect(Object.isFrozen(trusted)).toBe(false);
	});
});

/**
 * A Trusted Types policy turns delivered body HTML into TrustedHTML values. The
 * presentation plan freezes itself, and neither the freeze nor the session's
 * response snapshots may clone (structuredClone throws DataCloneError on
 * TrustedHTML) or destroy those values.
 */
describe('presentations under Trusted Types', () => {
	test('a Trusted Types presentation keeps its TrustedHTML body and stays presentable', () => {
		class FakeTrustedHtml {
			constructor(readonly value: string) {}
			toString() {
				return this.value;
			}
		}
		const originalTrustedTypes = Object.getOwnPropertyDescriptor(globalThis, 'trustedTypes');
		Object.defineProperty(globalThis, 'trustedTypes', {
			configurable: true,
			value: {
				createPolicy: () => ({ createHTML: (html: string) => new FakeTrustedHtml(html) }),
			},
		});
		try {
			const itemXml = `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
				identifier="tt-item" title="TT">
				<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
				<itemBody><p>Hello <printVariable identifier="RESPONSE"/></p></itemBody>
			</assessmentItem>`;
			const definition = createAssessmentItemDefinition({
				itemXml,
				security: { trustedTypesPolicyName: 'clone-freeze-tt' },
			});
			const session = definition.openSession();

			const plan = session.present();
			const htmlNode = plan.flow.find((node) => node.kind === 'html');
			expect(htmlNode).toBeDefined();
			if (htmlNode?.kind !== 'html') throw new Error('unreachable');
			expect(htmlNode.html).toBeInstanceOf(FakeTrustedHtml);
			expect(String(htmlNode.html)).toContain('Hello');
			// The plan is frozen, but the TrustedHTML leaf is not (and was not cloned).
			expect(Object.isFrozen(plan)).toBe(true);
			expect(Object.isFrozen(htmlNode.html)).toBe(false);

			// Re-presenting and state snapshots must not throw a DataCloneError.
			expect(() => session.present()).not.toThrow();
			expect(() => session.state()).not.toThrow();
			session.dispose();
		} finally {
			if (originalTrustedTypes) {
				Object.defineProperty(globalThis, 'trustedTypes', originalTrustedTypes);
			} else {
				delete (globalThis as { trustedTypes?: unknown }).trustedTypes;
			}
		}
	});
});

/**
 * A drawing response carries its canvas pixels (`imageData.data`, a
 * Uint8ClampedArray). `state()`, serialize and restore each snapshot the
 * session; the pixels must survive all three unfrozen so a custom operator can
 * score the drawing afterwards.
 */
describe('customOperator scoring on drawing imageData', () => {
	const DRAWING_ITEM = `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
		identifier="drawing-scored" title="Drawing">
		<responseDeclaration identifier="DRAW" cardinality="single" baseType="file"/>
		<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="integer"/>
		<itemBody>
			<drawingInteraction responseIdentifier="DRAW"><prompt>Draw</prompt></drawingInteraction>
		</itemBody>
		<responseProcessing>
			<setOutcomeValue identifier="SCORE">
				<customOperator class="acme:pixelSum"><variable identifier="DRAW"/></customOperator>
			</setOutcomeValue>
		</responseProcessing>
	</assessmentItem>`;

	const pixelSum = (values: unknown[]) => {
		// biome-ignore lint/suspicious/noExplicitAny: test operator reading the file value
		const file = (values[0] as any)?.kind === 'value' ? (values[0] as any).value : null;
		const data = file?.imageData?.data;
		if (!(data instanceof Uint8ClampedArray)) {
			return { kind: 'value' as const, baseType: 'integer' as const, cardinality: 'single' as const, value: -1 };
		}
		let sum = 0;
		for (const byte of data) sum += byte;
		return { kind: 'value' as const, baseType: 'integer' as const, cardinality: 'single' as const, value: sum };
	};

	const fileResponse = () => ({
		fileName: 'drawing.png',
		mimeType: 'image/png',
		data: 'base64data',
		imageData: { data: new Uint8ClampedArray([10, 20, 30, 255]), width: 1, height: 1 },
	});

	test('scores imageData after state(), serialize and restore', () => {
		const definition = createAssessmentItemDefinition({
			itemXml: DRAWING_ITEM,
			customOperators: { 'acme:pixelSum': pixelSum },
		});
		const session = definition.openSession();
		session.dispatch({ action: 'setResponse', responseIdentifier: 'DRAW', value: fileResponse() });

		// state() snapshots the view: the pixels come back as their own unfrozen copy.
		const state = session.state();
		const statePixels = (state.responses.DRAW as { imageData: { data: Uint8ClampedArray } }).imageData.data;
		expect(statePixels).toBeInstanceOf(Uint8ClampedArray);
		expect(Object.isFrozen(statePixels)).toBe(false);
		expect([...statePixels]).toEqual([10, 20, 30, 255]);

		const score = () =>
			session.dispatch({ action: 'endAttempt', countAttempt: false, validateResponses: false })
				.result?.scoring?.outcomeValues?.SCORE;
		expect(score()).toBe(10 + 20 + 30 + 255);

		const restored = definition.openSession({ restore: session.serialize() });
		session.dispose();
		// biome-ignore lint/suspicious/noExplicitAny: reading the restored file value
		const restoredPixels = (restored.state().responses.DRAW as any).imageData.data;
		expect(restoredPixels).toBeInstanceOf(Uint8ClampedArray);
		expect(Object.isFrozen(restoredPixels)).toBe(false);
		expect(
			restored.dispatch({ action: 'endAttempt', countAttempt: false, validateResponses: false })
				.result?.scoring?.outcomeValues?.SCORE,
		).toBe(10 + 20 + 30 + 255);
		restored.dispose();
	});
});
