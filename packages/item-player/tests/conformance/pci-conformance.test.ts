import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { getItemSessionBinding } from '../../src/core/ItemSession.js';
import { createAssessmentItemDefinition } from '../../src/core/AssessmentItemDefinition.js';
import { installPciRegistry, PCI_REGISTRY_GLOBAL } from '../../src/pci/registry.js';
import { PciHost } from '../../src/pci/PciHost.js';
import { PciLoadError } from '../../src/pci/types.js';
import type { ExtractedPci, PciModuleResolver } from '../../src/pci/types.js';

/**
 * PCI conformance evidence (G-08 phase 3), in-repo.
 *
 * The fixtures under `pci/fixtures/` are clean-room content authored from the
 * QTI 3.0 PCI specification: a two-module AMD declaration whose entry module
 * registers against `qtiCustomInteractionContext` as its code evaluates. The
 * suite drives the full delivery path the way a host that allow-lists package
 * files would — extraction from the item XML, AMD dependency wiring across real
 * module files loaded from disk, `getInstance` instantiation with seeded state,
 * QTI variable JSON responses, `onready`/`ondone`, and fallback resolution.
 *
 * Browser-level evidence stays with the private conformance runner, which
 * consumes published packages only; see docs/plans/pci-runtime-and-sandbox-2026-08.md.
 */

const FIXTURE_ROOT = new URL('./pci/', import.meta.url);

/** A host resolver that allow-lists exactly one fixture package's own files. */
function fixtureResolver(fixture: string): PciModuleResolver {
	return (_resolvedUrl: string, context) => {
		const moduleUrl = new URL(context.authoredPath, new URL(`${fixture}/`, FIXTURE_ROOT));
		return import(moduleUrl.href);
	};
}

interface StubElement {
	value: string;
	listeners: Record<string, (event?: unknown) => void>;
	addEventListener(type: string, listener: (event?: unknown) => void): void;
	dispatchInput(value: string): void;
}

/** A minimal mount node: enough DOM for the fixture module to build its input. */
function makeDom(): { dom: HTMLElement; input: StubElement } {
	const input: StubElement = {
		value: '',
		listeners: {},
		addEventListener(type, listener) {
			input.listeners[type] = listener;
		},
		dispatchInput(value: string) {
			input.value = value;
			input.listeners.input?.();
		},
	};
	const dom = {
		ownerDocument: { createElement: () => input },
		appendChild: () => {},
	} as never as HTMLElement;
	return { dom, input };
}

// Install the page registry first so this suite observes every registration,
// including the ones made through hosts the player constructs.
const observation = installPciRegistry(globalThis);

function openFixtureSession(fixture: 'pci-amd-echo' | 'pci-amd-echo-fallback') {
	const itemXml = readFileSync(new URL(`${fixture}/item.xml`, FIXTURE_ROOT), 'utf8');
	return createAssessmentItemDefinition({
		itemXml,
		pci: {
			baseUrl: new URL(`${fixture}/`, FIXTURE_ROOT).href,
			moduleResolver: fixtureResolver(fixture),
		},
	}).openSession();
}

function pciInteractionOf(session: ReturnType<typeof openFixtureSession>): ExtractedPci {
	const interactionNode = session.present().flow.find((node) => node.kind === 'interaction');
	if (!interactionNode || interactionNode.mount.placement !== 'block') {
		throw new Error('Expected a block PCI mount');
	}
	return interactionNode.mount.interaction as unknown as ExtractedPci;
}

const ECHO_TYPE = 'urn:example:pci:echo-conformance';

describe('PCI conformance: the registry contract over real module files', () => {
	test('a spec-authored module registers and reports QTI variable JSON through ondone', async () => {
		const session = openFixtureSession('pci-amd-echo');
		const host = getItemSessionBinding(session).createPciHost(pciInteractionOf(session));
		const { dom, input } = makeDom();

		await host.load();
		host.initialize(dom);

		expect(observation.registeredTypes()).toContain(ECHO_TYPE);

		// The candidate types: the module answers through QTI variable JSON, and
		// the session hears the final report at ondone, not the interim pulls.
		input.dispatchInput('echo me');
		expect(host.getResponse()).toBe('ECHO ME');
		expect(session.state().responses.RESPONSE).toBeNull();

		input.dispatchInput('done');
		expect(session.state().responses.RESPONSE).toBe('DONE');

		session.dispose();
	});

	test('a held response reaches getInstance as QTI variable JSON state', async () => {
		const session = openFixtureSession('pci-amd-echo');
		const host = getItemSessionBinding(session).createPciHost(pciInteractionOf(session));
		session.dispatch({ action: 'setResponses', responses: { RESPONSE: 'seeded' } });
		const { dom, input } = makeDom();

		await host.load();
		host.initialize(dom);

		// The module seeded its input from the state it received: the held
		// response crossed the boundary as { base: { string: 'seeded' } }.
		expect(input.value).toBe('seeded');

		session.dispose();
	});

	test('getState() answers the module snapshot and restore re-instantiates with it', async () => {
		const session = openFixtureSession('pci-amd-echo');
		const host = getItemSessionBinding(session).createPciHost(pciInteractionOf(session));
		const { dom, input } = makeDom();

		await host.load();
		host.initialize(dom);
		input.dispatchInput('abcd');

		expect(host.getState()).toEqual({ inputLength: 4 });

		let remountRequests = 0;
		host.onRemountRequest(() => remountRequests++);
		const rebuilt = makeDom();
		host.restore('fresh');
		expect(remountRequests).toBe(1);
		await host.remount(rebuilt.dom);
		// The module's own state, captured at onready, is what the next
		// getInstance received; a stateful module reconstructs from it.
		expect(host.getState()).toEqual({ inputLength: 0 });

		session.dispose();
	});

	test('configuration carries the authored properties; ondone state is answerable', async () => {
		const session = openFixtureSession('pci-amd-echo');
		const host = getItemSessionBinding(session).createPciHost(pciInteractionOf(session));
		const { dom, input } = makeDom();

		await host.load();
		host.initialize(dom);

		// The fixture's ondone reports the authored qti-pci-property it received,
		// so the module's own state proves the configuration reached getInstance.
		input.dispatchInput('done');
		expect(host.getState()).toEqual({ finished: true, greeting: 'hello' });

		session.dispatch({ action: 'endAttempt' });
		expect(session.state().lifecycleStatus).toBe('closed');

		session.dispose();
	});

	test('a deliberately wrong primary path falls back to the authored fallback module', async () => {
		const session = openFixtureSession('pci-amd-echo-fallback');
		const host = getItemSessionBinding(session).createPciHost(pciInteractionOf(session));
		const { dom, input } = makeDom();

		await host.load();
		host.initialize(dom);

		expect(observation.registeredTypes()).toContain(ECHO_TYPE);
		input.dispatchInput('fb');
		expect(host.getResponse()).toBe('FB');

		session.dispose();
	});

	test('a module registering a different type than authored fails the load closed', async () => {
		const session = openFixtureSession('pci-amd-echo');
		const authored = pciInteractionOf(session);
		const mismatched = { ...authored, customInteractionTypeIdentifier: 'urn:example:pci:never-registered' };
		const host = new PciHost(mismatched, {
			baseUrl: new URL('pci-amd-echo/', FIXTURE_ROOT).href,
			moduleResolver: fixtureResolver('pci-amd-echo'),
			registry: observation,
			registrationTimeoutMs: 100,
		});

		// The module registers 'echo-conformance'; the host awaits
		// 'never-registered' — a content/module mismatch fails, it does not guess.
		await expect(host.load()).rejects.toBeInstanceOf(PciLoadError);
		expect(observation.registeredTypes()).not.toContain('urn:example:pci:never-registered');

		session.dispose();
	});
});
