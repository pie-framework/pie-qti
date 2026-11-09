/**
 * Autosave and resume in the assessment core: the debounced save through
 * `BackendAdapter.saveState` (capability gating, busy deferral, flush, failure
 * handling, terminal safety), the resume path over a stored snapshot (answers,
 * flags, timer preference, saved time), and Start over's blank-draft restart.
 * Also the response-path performance guard: a keystroke must stay O(item) — one
 * deep copy for the changed item — never O(assessment).
 */

import './setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { AssessmentPlayer, type BackendAssessmentPlayerConfig } from '../src/core/AssessmentPlayer.js';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';
import { toSectionComposition } from '../src/integration/toSectionComposition.js';
import type {
	InitSessionRequest,
	InitSessionResponse,
	SaveAssessmentStateRequest,
	SaveAssessmentStateResponse,
} from '../src/integration/api-contract.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

const choiceItem = (identifier: string) =>
	`<assessmentItem ${NS} identifier="${identifier}" title="${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"><correctResponse><value>A</value></correctResponse></responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"><defaultValue><value>0</value></defaultValue></outcomeDeclaration>
  <itemBody><p>Question ${identifier}</p><choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice><simpleChoice identifier="B">B</simpleChoice></choiceInteraction></itemBody>
</assessmentItem>`;

const testXml = (count: number) =>
	`<assessmentTest ${NS} identifier="autosave" title="Autosave test">
  <timeLimits maxTime="600"/>
  <testPart identifier="part" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSection identifier="s1" title="Section" visible="true">
      ${Array.from({ length: count }, (_, i) => `<assessmentItemRef identifier="i${i + 1}" href="i${i + 1}.xml"/>`).join('\n')}
    </assessmentSection>
  </testPart>
</assessmentTest>`;

const items = (count: number) =>
	Object.fromEntries(
		Array.from({ length: count }, (_, i) => [`i${i + 1}.xml`, choiceItem(`i${i + 1}`)]),
	);

const players: AssessmentPlayer[] = [];
afterEach(() => {
	for (const player of players.splice(0)) player.destroy();
	localStorage.clear();
});

async function until(check: () => boolean, timeout = 8000): Promise<void> {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		if (check()) return;
		await new Promise((resolve) => setTimeout(resolve, 15));
	}
	throw new Error('condition not met within timeout');
}

interface Harness {
	player: AssessmentPlayer;
	saves: SaveAssessmentStateRequest[];
}

async function deliver(
	options: {
		itemCount?: number;
		config?: Partial<BackendAssessmentPlayerConfig>;
		saveFailsFirst?: number;
	} = {},
): Promise<Harness> {
	const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(testXml(options.itemCount ?? 4), {
		itemXmlMap: items(options.itemCount ?? 4),
	});
	const backend = new ReferenceBackendAdapter();
	backend.registerAssessment(parsed.identifier, parsed);
	const saves: SaveAssessmentStateRequest[] = [];
	let failuresLeft = options.saveFailsFirst ?? 0;
	const referenceSave = backend.saveState.bind(backend);
	backend.saveState = async (request: SaveAssessmentStateRequest): Promise<SaveAssessmentStateResponse> => {
		saves.push(request);
		if (failuresLeft > 0) {
			failuresLeft -= 1;
			return { success: false, savedAt: Date.now() };
		}
		return referenceSave(request);
	};
	const player = await AssessmentPlayer.create({
		backend,
		initSession: { assessmentId: parsed.identifier, candidateId: 'candidate' },
		autosaveIntervalMs: 40,
		...options.config,
	});
	players.push(player);
	await until(() => player.getNavigationState().currentIndex >= 0);
	return { player, saves };
}

describe('autosave basics', () => {
	test('is on by default with the reference backend and saves a response draft after the debounce', async () => {
		const { player, saves } = await deliver();

		expect(player.isAutosaveEnabled()).toBe(true);
		// The initial navigation already persisted a draft; let it land.
		await until(() => player.getAutosaveState().status === 'saved');
		const savesBefore = saves.length;
		expect(savesBefore).toBeGreaterThan(0);

		player.updateResponse('RESPONSE', 'A');
		expect(player.getAutosaveState().status).toBe('pending');
		await until(() => player.getAutosaveState().status === 'saved');
		expect(saves.length).toBeGreaterThan(savesBefore);
		const last = saves[saves.length - 1]!;
		expect(last.state.itemResponses.i1).toMatchObject({ RESPONSE: 'A' });
		expect(last.state.timing.savedAt).toBeGreaterThan(0);
		expect(player.getAutosaveState().lastSavedAt).toBeGreaterThan(0);
	});

	test('navigation and flags also restart the debounce; flush persists immediately', async () => {
		const { player, saves } = await deliver();

		await player.next();
		await until(() => saves.length > 0);
		const afterNavigation = saves.length;
		player.setItemFlag(true);
		// No debounce wait: the flush covers it at once.
		await player.flushAutosave();
		expect(saves.length).toBe(afterNavigation + 1);
		expect(saves[saves.length - 1]!.state.itemFlags).toMatchObject({ i2: true });
		expect(player.getAutosaveState().status).toBe('saved');
	});

	test('a due save during a navigation transition defers until the transition settles', async () => {
		// Individual mode: next() submits the current item through the backend, which is
		// where the transition lock is held.
		const xml = testXml(3).replace('submissionMode="simultaneous"', 'submissionMode="individual"');
		const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(xml, { itemXmlMap: items(3) });
		const backend = new ReferenceBackendAdapter();
		backend.registerAssessment(parsed.identifier, parsed);
		const saves: SaveAssessmentStateRequest[] = [];
		let gate = null as (() => void) | null;
		const referenceSubmit = backend.submitResponses.bind(backend);
		const referenceSave = backend.saveState.bind(backend);
		backend.submitResponses = async (request) => {
			await new Promise<void>((resolve) => {
				gate = resolve;
			});
			return referenceSubmit(request);
		};
		backend.saveState = async (request) => {
			saves.push(request);
			return referenceSave(request);
		};
		const player = await AssessmentPlayer.create({
			backend,
			initSession: { assessmentId: parsed.identifier, candidateId: 'candidate' },
			autosaveIntervalMs: 60,
		});
		players.push(player);
		await until(() => player.getNavigationState().currentIndex >= 0);
		await player.flushAutosave();

		// A slow individual-mode submission keeps the transition lock. The submission
		// ends the current attempt (a closed session rejects response updates), so the
		// mid-flight autosave activity is a flag change whose save falls due while the
		// lock is held.
		const pending = player.next();
		await until(() => gate !== null);
		const beforeFlight = saves.length;
		player.setItemFlag(true);
		await new Promise((resolve) => setTimeout(resolve, 250));
		// The save fell due mid-flight and was deferred, not raced.
		expect(saves.length).toBe(beforeFlight);
		const duringFlight = saves.length;
		gate?.();
		await pending;
		await until(() => saves.length > duringFlight, 3000);
		expect(player.getAutosaveState().status).toBe('saved');
	});

	test('a failed save reports "failed", keeps delivery alive, and the next change retries', async () => {
		const { player, saves } = await deliver({ saveFailsFirst: 1 });
		await until(() => player.getAutosaveState().status === 'failed');
		// One save was attempted and refused.
		expect(saves.length).toBe(1);

		// The next candidate change retries the draft and succeeds.
		await player.next();
		player.updateResponse('RESPONSE', 'B');
		await until(() => player.getAutosaveState().status === 'saved');
		expect(saves.length).toBe(2);
		expect(player.getNavigationState().isLoading).toBe(false);
	});

	test('the end-of-test snapshot is saved before finalize even while an older save is in flight', async () => {
		const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(testXml(2), { itemXmlMap: items(2) });
		const backend = new ReferenceBackendAdapter();
		backend.registerAssessment(parsed.identifier, parsed);
		const events: string[] = [];
		let gateNext = false;
		let release: (() => void) | null = null;
		const referenceSave = backend.saveState.bind(backend);
		backend.saveState = async (request) => {
			events.push(`save:${JSON.stringify(request.state.itemResponses.i1?.RESPONSE ?? null)}`);
			if (gateNext) {
				gateNext = false;
				await new Promise<void>((resolve) => {
					release = resolve;
				});
			}
			return referenceSave(request);
		};
		const referenceFinalize = backend.finalizeAssessment.bind(backend);
		backend.finalizeAssessment = async (request) => {
			events.push('finalize');
			return referenceFinalize(request);
		};
		const player = await AssessmentPlayer.create({
			backend,
			initSession: { assessmentId: parsed.identifier, candidateId: 'candidate' },
			autosaveIntervalMs: 40,
		});
		players.push(player);
		await until(() => player.getNavigationState().currentIndex >= 0);
		player.updateResponse('RESPONSE', 'A');
		await player.flushAutosave();

		// A slow save captures response A; the candidate then answers B and submits.
		gateNext = true;
		const slow = player.flushAutosave();
		await until(() => release !== null);
		player.updateResponse('RESPONSE', 'B');
		const submitting = player.submit();
		await new Promise((resolve) => setTimeout(resolve, 30));
		release!();
		await slow;
		await submitting;

		const finalizeAt = events.indexOf('finalize');
		expect(finalizeAt).toBeGreaterThan(0);
		const lastSaveBeforeFinalize = events.slice(0, finalizeAt).filter((event) => event.startsWith('save:')).at(-1);
		// The final draft — with B, not the stale in-flight A — reached the backend first.
		expect(lastSaveBeforeFinalize).toBe('save:"B"');
	});

	test('nothing is saved after finalization', async () => {
		const { player, saves } = await deliver();
		await player.flushAutosave();
		await player.submit();
		const afterSubmit = saves.length;

		// Post-finalize activity (a closed item rejects updates; flags do not) must not
		// trigger any further save.
		player.setItemFlag(true);
		await new Promise((resolve) => setTimeout(resolve, 200));
		await player.flushAutosave();
		expect(saves.length).toBe(afterSubmit);
		expect(player.getAutosaveState().status).not.toBe('saved');
	});
});

describe('capability gating', () => {
	test('canSaveState: false turns autosave off entirely', async () => {
		const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(testXml(2), { itemXmlMap: items(2) });
		const backend = new ReferenceBackendAdapter();
		backend.registerAssessment(parsed.identifier, parsed);
		(backend as { canSaveState: boolean }).canSaveState = false;
		const saves: SaveAssessmentStateRequest[] = [];
		const referenceSave = backend.saveState.bind(backend);
		backend.saveState = async (request) => {
			saves.push(request);
			return referenceSave(request);
		};
		const player = await AssessmentPlayer.create({
			backend,
			initSession: { assessmentId: parsed.identifier, candidateId: 'candidate' },
		});
		players.push(player);
		await until(() => player.getNavigationState().currentIndex >= 0);

		expect(player.isAutosaveEnabled()).toBe(false);
		player.updateResponse('RESPONSE', 'A');
		await player.flushAutosave();
		expect(saves).toEqual([]);
		expect(player.getAutosaveState().status).toBe('idle');
	});

	test('config.autosave: false overrides the capability (hosts that save themselves)', async () => {
		const { player, saves } = await deliver({ config: { autosave: false } });

		expect(player.isAutosaveEnabled()).toBe(false);
		player.updateResponse('RESPONSE', 'A');
		await player.flushAutosave();
		expect(saves).toEqual([]);
	});
});

describe('resume', () => {
	test('a stored draft resumes with answers, flags, the timer preference and the save time', async () => {
		const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(testXml(3), { itemXmlMap: items(3) });
		const backend = new ReferenceBackendAdapter();
		backend.registerAssessment(parsed.identifier, parsed);
		const first = await AssessmentPlayer.create({
			backend,
			initSession: { assessmentId: parsed.identifier, candidateId: 'candidate' },
			autosaveIntervalMs: 20,
		});
		players.push(first);
		await until(() => first.getNavigationState().currentIndex >= 0);
		first.updateResponse('RESPONSE', 'A');
		first.setItemFlag(true);
		first.setTimerHidden(true);
		await first.next();
		await first.flushAutosave();

		const sessionId = (
			backend as unknown as { latestSessionId: (a: string, c: string) => string | null }
		).latestSessionId(parsed.identifier, 'candidate');
		expect(sessionId).toBeTruthy();

		// A fresh player over the same backend resumes the stored draft.
		const resumed = await AssessmentPlayer.create({
			backend,
			initSession: {
				assessmentId: parsed.identifier,
				candidateId: 'candidate',
				resumeSessionId: sessionId ?? undefined,
			},
		});
		players.push(resumed);
		await until(() => resumed.getNavigationState().currentIndex >= 0);

		expect(resumed.hasRestoredProgress()).toBe(true);
		expect(resumed.getRestoredSavedAt()).toBeGreaterThan(0);
		expect(resumed.getStartInfo().savedAt).toBe(resumed.getRestoredSavedAt());
		expect(resumed.getStartInfo().resuming).toBe(true);
		expect(resumed.isTimerHidden()).toBe(true);
		// Delivery is at the saved item; the previous item's answer and flag are intact.
		expect(resumed.getNavigationState().currentIndex).toBe(1);
		expect(resumed.getResponsesForItem('i1')).toMatchObject({ RESPONSE: 'A' });
		expect(resumed.isItemFlagged('i1')).toBe(true);
	});

	test('a session without stored progress offers no resume', async () => {
		const { player } = await deliver();
		expect(player.hasRestoredProgress()).toBe(false);
		expect(player.getRestoredSavedAt()).toBeUndefined();
	});
});

describe('start over', () => {
	test('clears the draft (answers, flags, visits, timer) and restarts at the first item', async () => {
		const { player, saves } = await deliver({ itemCount: 3 });

		player.updateResponse('RESPONSE', 'A');
		player.setItemFlag(true);
		player.setTimerHidden(true);
		await player.next();
		await player.flushAutosave();
		expect(player.getNavigationState().currentIndex).toBe(1);
		const savesBefore = saves.length;

		await player.startOver();

		expect(player.getNavigationState().currentIndex).toBe(0);
		// A fresh session initializes the declared response variables to NULL.
		expect(Object.values(player.getResponses()).every((value) => value == null)).toBe(true);
		expect(player.isItemFlagged('i1')).toBe(false);
		expect(player.getFlaggedItemIdentifiers()).toEqual([]);
		expect(player.isTimerHidden()).toBe(false);
		// Everything except the fresh current item is unvisited again.
		expect(player.getReviewItems().filter((item) => !item.isCurrent).every((item) => !item.visited)).toBe(true);
		expect(player.hasRestoredProgress()).toBe(false);
		// The blank draft was persisted so a refresh cannot resurrect the answers.
		await until(() => saves.length > savesBefore);
		const blank = saves[saves.length - 1]!;
		expect(Object.keys(blank.state.itemResponses).length).toBe(0);
		// Delivery works normally afterwards.
		player.updateResponse('RESPONSE', 'B');
		await until(() => player.getAutosaveState().status === 'saved');
	});
	test('rejects while paused, behind a begin gate, and once finalized', async () => {
		const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(testXml(2), { itemXmlMap: items(2) });
		const backend = new ReferenceBackendAdapter();
		backend.registerAssessment(parsed.identifier, parsed);
		const player = await AssessmentPlayer.create({
			backend,
			initSession: { assessmentId: parsed.identifier, candidateId: 'candidate' },
			beginGate: true,
		});
		players.push(player);

		expect(player.hasStarted()).toBe(false);
		await expect(player.startOver()).rejects.toThrow();

		player.start();
		await until(() => player.getNavigationState().currentIndex >= 0);
		player.pause('proctor');
		await expect(player.startOver()).rejects.toThrow('paused');
		player.resume();

		await player.submit();
		await expect(player.startOver()).rejects.toThrow();
	});
});

describe('response-path performance guard', () => {
	test('a keystroke deep-copies only the changed item, never the whole section', async () => {
		const { player } = await deliver({ itemCount: 6 });
		const session = player.getCurrentItemSession();
		expect(session).not.toBeNull();

		let clones = 0;
		const original = globalThis.structuredClone;
		(globalThis as unknown as { structuredClone: typeof structuredClone }).structuredClone = function countingClone(
			value: unknown,
		) {
			clones += 1;
			return original(value);
		};
		try {
			player.updateResponse('RESPONSE', 'A');
			player.updateResponse('RESPONSE', 'B');
			player.updateResponse('RESPONSE', 'C');
		} finally {
			(globalThis as unknown as { structuredClone: typeof structuredClone }).structuredClone = original;
		}
		// Exactly one clone per keystroke: the changed item's snapshot. Rebuilding every
		// item's responses (the O(assessment) path) would clone 6+ per keystroke.
		expect(clones).toBe(3);
	});

	test('building the section composition deep-copies no item responses', async () => {
		const { player } = await deliver({ itemCount: 6 });

		let clones = 0;
		const original = globalThis.structuredClone;
		(globalThis as unknown as { structuredClone: typeof structuredClone }).structuredClone = function countingClone(
			value: unknown,
		) {
			clones += 1;
			return original(value);
		};
		try {
			const composition = toSectionComposition(player, {});
			// The composition still carries the section's responses for persistence and
			// snapshot hosts — shared references, not per-item deep copies.
			expect(Object.keys(composition.snapshot.responses)).toHaveLength(6);
		} finally {
			(globalThis as unknown as { structuredClone: typeof structuredClone }).structuredClone = original;
		}
		// Fixture items carry no deliveryContext, so nothing needs a deep copy at all.
		expect(clones).toBe(0);
	});

	test('an autosave snapshot clones only the snapshot itself', async () => {
		const { player } = await deliver({ itemCount: 6 });
		player.updateResponse('RESPONSE', 'A');
		await player.flushAutosave();
		expect(player.getAutosaveState().status).toBe('saved');
	});
});
