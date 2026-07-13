import './setup';
import { describe, expect, test } from 'bun:test';
import type { BackendAdapter } from '@pie-qti/assessment-player';
import type { PciModuleResolver } from '@pie-qti/item-player';
import { QtiAssessmentPlayerElement } from '../src/elements/QtiAssessmentPlayerElement.js';

const backend: BackendAdapter = {
	async initSession(request) {
		return {
			sessionId: 'session-1',
			assessment: {
				identifier: request.assessmentId,
				title: 'Secure assessment',
				navigationMode: 'nonlinear',
				submissionMode: 'simultaneous',
				testParts: [],
			},
		};
	},
	async submitResponses() {
		return { success: true };
	},
	async saveState() {
		return { success: true, savedAt: Date.now() };
	},
	async finalizeAssessment() {
		return { success: true, totalScore: 0, maxScore: 0, itemScores: {}, finalizedAt: Date.now() };
	},
};

class TestAssessmentElement extends QtiAssessmentPlayerElement {
	teardownCount = 0;

	protected override _mountOrUpdate() {}
	protected override _teardownInstance() {
		this.teardownCount++;
		super._teardownInstance();
	}

	exposeProps() {
		return this.getProps() as {
			backend: BackendAdapter;
			initSession: { assessmentId: string; candidateId: string };
			config: {
				security?: { parsingLimits?: { enabled?: boolean } };
				pci?: { baseUrl?: string; moduleResolver: PciModuleResolver };
			};
		};
	}

	canExposeProps(): boolean {
		try {
			this.getProps();
			return true;
		} catch {
			return false;
		}
	}
}

const TEST_TAG = 'test-qti-assessment-player-security';
if (!customElements.get(TEST_TAG)) {
	customElements.define(TEST_TAG, TestAssessmentElement);
}

function createElement(): TestAssessmentElement {
	return document.createElement(TEST_TAG) as TestAssessmentElement;
}

function assessmentWithNestedSections(depth: number): string {
	let sections = '';
	for (let index = depth; index >= 1; index--) {
		sections = `<assessmentSection identifier="S${index}">${sections}</assessmentSection>`;
	}
	return `<assessmentTest identifier="depth-override" title="Depth override"><testPart identifier="part" navigationMode="nonlinear" submissionMode="simultaneous">${sections}</testPart></assessmentTest>`;
}

describe('assessment player security boundary', () => {
	test('does not silently create the answer-bearing reference backend for raw XML', () => {
		const element = createElement();
		const messages: string[] = [];
		element.addEventListener('load-error', (event) => {
			messages.push((event as CustomEvent<{ message: string }>).detail.message);
		});

		element.assessmentTestXml = '<assessmentTest identifier="test" title="Test" />';

		expect(messages).toHaveLength(1);
		expect(messages[0]).toContain('referenceMode = true');
		expect(element.backend).toBeUndefined();
		expect(element.referenceMode).toBe(false);
	});

	test('accepts an injected authoritative backend and explicit session request', () => {
		const element = createElement();
		element.backend = backend;
		element.initSession = { assessmentId: 'assessment-1', candidateId: 'candidate-1' };

		const props = element.exposeProps();
		expect(props.backend).toBe(backend);
		expect(props.initSession).toEqual({ assessmentId: 'assessment-1', candidateId: 'candidate-1' });
		expect(props.config.security?.parsingLimits?.enabled).toBe(true);
	});

	test('preserves an explicit parsing-limit opt-out', () => {
		const element = createElement();
		element.security = { parsingLimits: { enabled: false } };
		element.backend = backend;
		element.assessmentId = 'assessment-1';
		element.candidateId = 'candidate-1';

		expect(element.exposeProps().config.security?.parsingLimits?.enabled).toBe(false);
	});

	test('propagates JS-only PCI trust configuration without serializing the resolver', () => {
		const element = createElement();
		const moduleResolver: PciModuleResolver = () => ({ getInstance: () => ({}) });
		element.pci = { baseUrl: 'https://packages.example/items/', moduleResolver };
		element.backend = backend;
		element.initSession = { assessmentId: 'assessment-1', candidateId: 'candidate-1' };

		expect(element.pci?.moduleResolver).toBe(moduleResolver);
		expect(element.exposeProps().config.pci).toEqual({
			baseUrl: 'https://packages.example/items/',
			moduleResolver,
		});
	});

	test('resolves external section files through the same bounded assessment resource policy', async () => {
		const originalFetch = globalThis.fetch;
		const originalLocalStorage = (globalThis as typeof globalThis & { localStorage?: Storage }).localStorage;
		const calls: string[] = [];
		const stored = new Map<string, string>();
		(globalThis as typeof globalThis & { localStorage: Storage }).localStorage = {
			getItem: (key) => stored.get(key) ?? null,
			setItem: (key, value) => stored.set(key, value),
			removeItem: (key) => stored.delete(key),
			clear: () => stored.clear(),
			key: (index) => [...stored.keys()][index] ?? null,
			get length() {
				return stored.size;
			},
		};
		globalThis.fetch = (async (input: string | URL | Request) => {
			const url = String(input);
			calls.push(url);
			if (url.endsWith('/sections/math.xml')) {
				return new Response(`
<assessmentSection identifier="external" title="External">
  <assessmentItemRef identifier="item-1" href="../items/item-1.xml" />
</assessmentSection>`);
			}
			if (url.endsWith('/items/item-1.xml')) {
				return new Response(`
<assessmentItem identifier="item-1" title="Item">
  <itemBody><p>Item</p></itemBody>
</assessmentItem>`);
			}
			return new Response('missing', { status: 404 });
		}) as typeof globalThis.fetch;

		try {
			const element = createElement();
			element.referenceMode = true;
			element.itemBaseUrl = 'https://example.test/qti/';
			const loaded = new Promise<void>((resolve, reject) => {
				element.addEventListener('load-end', () => resolve(), { once: true });
				element.addEventListener(
					'load-error',
					(event) => reject(new Error((event as CustomEvent<{ message: string }>).detail.message)),
					{ once: true },
				);
			});
			element.assessmentTestXml = `
<assessmentTest identifier="test" title="Test">
  <testPart identifier="part" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSectionRef identifier="external-ref" href="sections/math.xml" />
  </testPart>
</assessmentTest>`;
			await loaded;

			const props = element.exposeProps();
			const initialized = await props.backend.initSession(props.initSession);
			expect(initialized.assessment.testParts[0].sections[0].identifier).toBe('external');
			expect(initialized.assessment.testParts[0].sections[0].assessmentItemRefs[0].itemXml).toContain(
				'identifier="item-1"',
			);
			expect(calls).toEqual([
				'https://example.test/qti/sections/math.xml',
				'https://example.test/qti/items/item-1.xml',
			]);
		} finally {
			globalThis.fetch = originalFetch;
			if (originalLocalStorage) {
				(globalThis as typeof globalThis & { localStorage: Storage }).localStorage = originalLocalStorage;
			} else {
				delete (globalThis as typeof globalThis & { localStorage?: Storage }).localStorage;
			}
		}
	});

	test('aborts a superseded assessment resource load without emitting a stale error', async () => {
		const originalFetch = globalThis.fetch;
		let firstSignal: AbortSignal | undefined;
		const errors: string[] = [];
		globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
			firstSignal ??= init?.signal instanceof AbortSignal ? init.signal : undefined;
			return await new Promise<Response>((_resolve, reject) => {
				init?.signal?.addEventListener(
					'abort',
					() => reject(new Error('request aborted')),
					{ once: true },
				);
			});
		}) as typeof globalThis.fetch;

		try {
			const element = createElement();
			element.referenceMode = true;
			element.itemBaseUrl = 'https://example.test/qti/';
			element.addEventListener('load-error', (event) => {
				errors.push((event as CustomEvent<{ message: string }>).detail.message);
			});
			element.assessmentTestXml = `
<assessmentTest identifier="old" title="Old">
  <testPart identifier="part" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSection identifier="section"><assessmentItemRef identifier="item" href="slow.xml" /></assessmentSection>
  </testPart>
</assessmentTest>`;

			for (let attempt = 0; attempt < 10 && !firstSignal; attempt++) await Promise.resolve();
			expect(firstSignal).toBeDefined();

			const loaded = new Promise<void>((resolve) => {
				element.addEventListener('load-end', () => resolve(), { once: true });
			});
			element.assessmentTestXml = `
<assessmentTest identifier="new" title="New">
  <testPart identifier="part" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSection identifier="section" />
  </testPart>
</assessmentTest>`;
			await loaded;

			expect(firstSignal?.aborted).toBe(true);
			expect(errors).toEqual([]);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test('revokes a mounted local assessment when reference mode is disabled', async () => {
		const element = createElement();
		element.referenceMode = true;
		const loaded = new Promise<void>((resolve) => {
			element.addEventListener('load-end', () => resolve(), { once: true });
		});
		element.assessmentTestXml = `
<assessmentTest identifier="local" title="Local">
  <testPart identifier="part" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSection identifier="section" />
  </testPart>
</assessmentTest>`;
		await loaded;
		expect(element.canExposeProps()).toBe(true);
		const before = element.teardownCount;

		element.referenceMode = false;

		expect(element.teardownCount).toBeGreaterThan(before);
		expect(element.canExposeProps()).toBe(false);
	});

	test('revokes the previous local assessment before a replacement load fails', async () => {
		const element = createElement();
		element.referenceMode = true;
		const loaded = new Promise<void>((resolve) => {
			element.addEventListener('load-end', () => resolve(), { once: true });
		});
		element.assessmentTestXml = `
<assessmentTest identifier="old" title="Old">
  <testPart identifier="part" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSection identifier="section" />
  </testPart>
</assessmentTest>`;
		await loaded;
		expect(element.canExposeProps()).toBe(true);
		const before = element.teardownCount;
		const failed = new Promise<void>((resolve) => {
			element.addEventListener('load-error', () => resolve(), { once: true });
		});

		element.security = { parsingLimits: { enabled: true, maxItemXmlBytes: 16 } };
		element.assessmentTestXml = '<assessmentTest identifier="replacement" />';
		await failed;

		expect(element.teardownCount).toBeGreaterThan(before);
		expect(element.canExposeProps()).toBe(false);
	});

	test('applies an explicit parsing depth limit before loading nested inline sections', async () => {
		const element = createElement();
		element.referenceMode = true;
		element.security = { parsingLimits: { enabled: true, maxHtmlDepth: 1 } };
		const failed = new Promise<string>((resolve) => {
			element.addEventListener(
				'load-error',
				(event) => resolve((event as CustomEvent<{ message: string }>).detail.message),
				{ once: true },
			);
		});

		element.assessmentTestXml = `
<assessmentTest identifier="depth" title="Depth">
  <testPart identifier="part" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSection identifier="outer">
      <assessmentSection identifier="inner" />
    </assessmentSection>
  </testPart>
</assessmentTest>`;

		expect(await failed).toContain('assessmentSection nesting exceeds maxSectionDepth (1)');
		expect(element.canExposeProps()).toBe(false);
	});

	test('honors an explicit section depth above the default through reference-backend parsing', async () => {
		const element = createElement();
		element.referenceMode = true;
		element.security = { parsingLimits: { enabled: true, maxHtmlDepth: 33 } };
		const loaded = new Promise<void>((resolve, reject) => {
			element.addEventListener('load-end', () => resolve(), { once: true });
			element.addEventListener(
				'load-error',
				(event) => reject(new Error((event as CustomEvent<{ message: string }>).detail.message)),
				{ once: true },
			);
		});

		element.assessmentTestXml = assessmentWithNestedSections(33);
		await loaded;

		expect(element.exposeProps().initSession.assessmentId).toBe('depth-override');
	});

	test('does not carry a local preview session into an injected backend', async () => {
		const element = createElement();
		element.referenceMode = true;
		const loaded = new Promise<void>((resolve) => {
			element.addEventListener('load-end', () => resolve(), { once: true });
		});
		element.assessmentTestXml = `
<assessmentTest identifier="untrusted-local-id" title="Local">
  <testPart identifier="part" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSection identifier="section" />
  </testPart>
</assessmentTest>`;
		await loaded;
		expect(element.exposeProps().initSession).toEqual({
			assessmentId: 'untrusted-local-id',
			candidateId: 'candidate',
		});

		element.backend = backend;

		expect(element.canExposeProps()).toBe(false);
		element.initSession = { assessmentId: 'authoritative-id', candidateId: 'candidate-1' };
		expect(element.exposeProps().initSession).toEqual({
			assessmentId: 'authoritative-id',
			candidateId: 'candidate-1',
		});
	});
});
