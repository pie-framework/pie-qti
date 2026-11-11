import './setup';
import { describe, expect, test } from 'bun:test';
import type { BackendAdapter } from '@pie-qti/assessment-player';
import { QtiAssessmentPlayerElement } from '../src/elements/QtiAssessmentPlayerElement.js';

class RaceTestElement extends QtiAssessmentPlayerElement {
	mountCount = 0;

	protected override _mountOrUpdate() {
		this.mountCount++;
	}

	exposeProps() {
		return this.getProps() as {
			backend: BackendAdapter;
			initSession: { assessmentId: string; candidateId: string };
		};
	}
}

const TEST_TAG = 'test-qti-assessment-player-load-race';
if (!customElements.get(TEST_TAG)) {
	customElements.define(TEST_TAG, RaceTestElement);
}

function createElement(): RaceTestElement {
	return document.createElement(TEST_TAG) as RaceTestElement;
}

/** Spins microtasks until `condition` holds, failing the test if it never does. */
async function waitFor(condition: () => boolean, what: string): Promise<void> {
	for (let attempt = 0; attempt < 2000 && !condition(); attempt++) await Promise.resolve();
	expect(condition(), what).toBe(true);
}

/**
 * Gives released async chains room to run: several macrotask turns, each
 * preceded by a burst of microtasks, so every immediate-promise step of a
 * reference-backend parse settles before the assertions run.
 */
async function settleAsyncChains(): Promise<void> {
	for (let round = 0; round < 10; round++) {
		for (let attempt = 0; attempt < 100; attempt++) await Promise.resolve();
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

describe('overlapping local-backend loads', () => {
	// The reference backend persists sessions through localStorage; the bun test
	// environment provides none, so the initSession assertions below stub one.
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

	test('a load superseded during reference-backend parsing cannot register, emit or mount', async () => {
		const element = createElement();
		element.referenceMode = true;
		element.itemBaseUrl = 'https://example.test/qti/';

		const loadEnds: string[] = [];
		const loadErrors: string[] = [];
		element.addEventListener('load-end', () => loadEnds.push('end'));
		element.addEventListener('load-error', (event) => {
			loadErrors.push((event as CustomEvent<{ message: string }>).detail.message);
		});

		// Load #1's assessment test references an external section file. The local
		// discovery pass resolves nothing (no inline itemRefs), so the element's
		// first await settles and load #1 enters `ReferenceBackendAdapter
		// .parseAssessmentTestXml` — the second await — which resolves the section
		// through the resource resolver. The fake fetch defers that one request.
		let releaseSlowSection!: () => void;
		const slowSectionReleased = new Promise<void>((resolve) => {
			releaseSlowSection = resolve;
		});
		const originalFetch = globalThis.fetch;
		let slowFetchCalled = false;
		globalThis.fetch = (async (input: string | URL | Request) => {
			const url = String(input);
			if (url.endsWith('/sections/slow.xml')) {
				slowFetchCalled = true;
				await slowSectionReleased;
				return new Response(`
<assessmentSection identifier="old-section" title="Old section">
  <assessmentItemRef identifier="old-item" href="../items/old-item.xml" />
</assessmentSection>`);
			}
			if (url.endsWith('/old-item.xml')) {
				return new Response(`
<assessmentItem identifier="old-item" title="Old item">
  <itemBody><p>Old</p></itemBody>
</assessmentItem>`);
			}
			return new Response('missing', { status: 404 });
		}) as typeof globalThis.fetch;

		try {
			element.assessmentTestXml = `
<assessmentTest identifier="old" title="Old">
  <testPart identifier="part" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSectionRef identifier="old-section-ref" href="sections/slow.xml" />
  </testPart>
</assessmentTest>`;

			// Load #1 is now parked inside the reference backend's parse (the await the
			// element did not recheck after).
			await waitFor(() => slowFetchCalled, 'the stale load reached the reference-backend parse');

			// Load #2 supersedes load #1 while its parse is still pending.
			const secondLoad = new Promise<void>((resolve) => {
				element.addEventListener('load-end', () => resolve(), { once: true });
			});
			element.assessmentTestXml = `
<assessmentTest identifier="new" title="New">
  <testPart identifier="part" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSection identifier="new-section" />
  </testPart>
</assessmentTest>`;
			await secondLoad;

			expect(loadEnds).toHaveLength(1);

			// Let load #1's parse finish. It resolves successfully (the in-flight
			// request was never cancelled) — the element must still reject the stale
			// result instead of committing it.
			releaseSlowSection();
			await settleAsyncChains();

			expect(loadErrors).toEqual([]);
			expect(loadEnds, 'only the newer load may dispatch load-end').toHaveLength(1);
			expect(element.mountCount, 'only the newer load may mount').toBe(1);

			const props = element.exposeProps();
			expect(props.initSession.assessmentId).toBe('new');
			const initialized = await props.backend.initSession(props.initSession);
			expect(initialized.assessment.identifier).toBe('new');
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
