/**
 * PCI sandbox bridge protocol (host page ⇄ runner frame).
 *
 * The sandboxed engine runs a PCI module inside `<iframe sandbox="allow-scripts">`
 * loaded from a dedicated runner origin (`@pie-qti/pci-runner`). The frame's
 * document has an opaque origin, so every contract call crosses `postMessage`:
 * this module defines the versioned envelope and payload shapes both sides
 * speak. Like `src/iframe/protocol.ts`, it contains no DOM globals and can be
 * imported anywhere.
 *
 * Origin locking is mutual and rooted at each side's structural facts:
 *
 * - The host accepts a message only when `event.origin` equals the runner
 *   URL's origin **and** `event.source` is the frame's `contentWindow`.
 * - The runner accepts its first message only from its `window.parent`, locks
 *   to that message's `event.origin`, and sends everything to that origin.
 *
 * `runner-ready` is the one message posted without a locked origin (the runner
 * cannot know its parent before the first exchange). It carries no secrets —
 * it only announces the protocol version.
 */

export const PCI_SANDBOX_PROTOCOL = 'pie-qti-pci-sandbox' as const;
export const PCI_SANDBOX_PROTOCOL_VERSION = '0.1.0' as const;

export type PciSandboxProtocolVersion = typeof PCI_SANDBOX_PROTOCOL_VERSION;

export type PciSandboxHostToRunnerType =
	| 'hello'
	| 'init'
	| 'instantiate'
	| 'set-enabled'
	| 'teardown-instance'
	| 'dispose';

export type PciSandboxRunnerToHostType =
	| 'runner-ready'
	| 'module-loaded'
	| 'module-error'
	| 'instance-ready'
	| 'instance-error'
	| 'ready'
	| 'done'
	| 'response-change'
	| 'resize';

export type PciSandboxMessageType = PciSandboxHostToRunnerType | PciSandboxRunnerToHostType;

export interface PciSandboxEnvelope<
	TType extends PciSandboxMessageType = PciSandboxMessageType,
	TPayload = unknown,
> {
	protocol: typeof PCI_SANDBOX_PROTOCOL;
	version: PciSandboxProtocolVersion;
	type: TType;
	payload: TPayload;
}

/** runner → host, immediately when the runner page loads. */
export interface PciSandboxRunnerReadyPayload {
	runtime?: string;
}

/** host → runner, locking the runner to the page's origin. */
export interface PciSandboxHelloPayload {
	/** The origin the runner must send every subsequent message to. */
	parentOrigin: string;
}

/** One authored `qti-interaction-module` entry, resolved to absolute URLs. */
export interface PciSandboxModuleEntryPayload {
	id: string;
	primaryUrl: string;
	fallbackUrl?: string;
}

/** host → runner: load the resolution config and the entry module. */
export interface PciSandboxInitPayload {
	/** The `customInteractionTypeIdentifier` whose registration instantiates. */
	typeIdentifier: string;
	/** Authored module entries, paths resolved to absolute URLs. */
	modules: PciSandboxModuleEntryPayload[];
	/** The id of the entry module whose registration instantiates. */
	entryId: string;
	/** Absolute resolution-config URL, when the item authored one. */
	resolutionConfigUrl?: string;
	/** Package base URL; relative config paths and module assets resolve against it. */
	baseUrl: string;
	/** The interaction markup, already sanitized by the host. */
	markup: string;
	/** Milliseconds the runner waits for the module to register. */
	registrationTimeoutMs: number;
	/** How often the runner pushes response/state reads. */
	pollIntervalMs: number;
}

/** host → runner: instantiate the interaction. */
export interface PciSandboxInstantiatePayload {
	responseIdentifier: string;
	status: string;
	properties: Record<string, string>;
	templateVariables?: Record<string, unknown>;
	contextVariables?: Record<string, unknown>;
	/** The QTI variable JSON (or module state) this instantiation is seeded with. */
	state?: unknown;
}

/** host → runner. */
export interface PciSandboxSetEnabledPayload {
	enabled: boolean;
}

/** Response and state exactly as the module reports them (QTI variable JSON). */
export interface PciSandboxSnapshotPayload {
	response: unknown;
	state?: unknown;
}

/** runner → host: the module registered. */
export interface PciSandboxModuleLoadedPayload {
	typeIdentifier: string;
}

/** runner → host: module load or registration failed. */
export interface PciSandboxModuleErrorPayload {
	message: string;
}

/** runner → host: `getInstance` returned. */
export interface PciSandboxInstanceReadyPayload extends PciSandboxSnapshotPayload {}

/** runner → host: `getInstance` threw. */
export interface PciSandboxInstanceErrorPayload {
	message: string;
}

/** runner → host: the module called `onready`/`ondone`. */
export interface PciSandboxLifecyclePayload extends PciSandboxSnapshotPayload {
	/** The state argument the module passed, if any. */
	state?: unknown;
}

/** runner → host: poll or lifecycle observed a changed read. */
export interface PciSandboxResponseChangePayload extends PciSandboxSnapshotPayload {}

/** runner → host: the interaction's content resized. */
export interface PciSandboxResizePayload {
	height: number;
}

export type PciSandboxMessage =
	| PciSandboxEnvelope<'runner-ready', PciSandboxRunnerReadyPayload>
	| PciSandboxEnvelope<'hello', PciSandboxHelloPayload>
	| PciSandboxEnvelope<'init', PciSandboxInitPayload>
	| PciSandboxEnvelope<'instantiate', PciSandboxInstantiatePayload>
	| PciSandboxEnvelope<'set-enabled', PciSandboxSetEnabledPayload>
	| PciSandboxEnvelope<'teardown-instance', Record<string, never>>
	| PciSandboxEnvelope<'dispose', Record<string, never>>
	| PciSandboxEnvelope<'module-loaded', PciSandboxModuleLoadedPayload>
	| PciSandboxEnvelope<'module-error', PciSandboxModuleErrorPayload>
	| PciSandboxEnvelope<'instance-ready', PciSandboxInstanceReadyPayload>
	| PciSandboxEnvelope<'instance-error', PciSandboxInstanceErrorPayload>
	| PciSandboxEnvelope<'ready', PciSandboxLifecyclePayload>
	| PciSandboxEnvelope<'done', PciSandboxLifecyclePayload>
	| PciSandboxEnvelope<'response-change', PciSandboxResponseChangePayload>
	| PciSandboxEnvelope<'resize', PciSandboxResizePayload>;

export function createSandboxEnvelope<TType extends PciSandboxMessageType, TPayload>(
	type: TType,
	payload: TPayload
): PciSandboxEnvelope<TType, TPayload> {
	return {
		protocol: PCI_SANDBOX_PROTOCOL,
		version: PCI_SANDBOX_PROTOCOL_VERSION,
		type,
		payload,
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

/** Shallow envelope check; payload fields are validated where they are used. */
export function isPciSandboxEnvelope(value: unknown): value is PciSandboxEnvelope {
	if (!isRecord(value)) return false;
	if (value.protocol !== PCI_SANDBOX_PROTOCOL) return false;
	if (value.version !== PCI_SANDBOX_PROTOCOL_VERSION) return false;
	if (typeof value.type !== 'string') return false;
	if (!('payload' in value)) return false;
	return true;
}
