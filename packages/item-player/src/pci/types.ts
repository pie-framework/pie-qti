/**
 * QTI 3.0 Portable Custom Interaction (PCI) types.
 *
 * The module-facing contract is the one QTI 3.0 §6.1 specifies: a module calls
 * `qtiCustomInteractionContext.register(...)` with a `typeIdentifier` and a
 * `getInstance(dom, configuration, state)` factory; the instance signals readiness
 * through `configuration.onready(instance, state)` and completion through
 * `configuration.ondone(...)`, and exposes `getResponse()` (QTI variable JSON) and
 * optionally `getState()`. AMD is the documented default module resolution
 * (phase 2); a host resolver decides whether a module is evaluated at all.
 */

import type { HtmlContent } from '../types/index.js';
import type { BaseType, Cardinality } from '@pie-qti/qti-processing';

/** QTI 3.0 §6.1 interaction status, fixed at instantiation. */
export type PciInteractionStatus = 'interacting' | 'closed' | 'solution' | 'review';

/**
 * An instance a conformant `getInstance` factory returns. `getResponse()` answers in
 * QTI variable JSON (`{ base: ... }` / `{ list: ... }` / `{ record: ... }`); `getState()`
 * snapshots whatever the module needs to reconstruct itself, read back through the
 * `state` argument of the next `getInstance`.
 */
export interface QtiPciInstance {
	getResponse(): unknown;
	getState?(): unknown;
}

/**
 * The configuration object the host passes to `getInstance`. `onready` reports the
 * module ready (optionally with its initial state); `ondone` reports the interaction
 * finished for the attempt, with its final response and state.
 */
export interface QtiPciConfiguration {
	responseIdentifier: string;
	status: PciInteractionStatus;
	/** Key/value pairs from `qti-pci-properties`, keyed by their `identifier`. */
	properties: Record<string, string>;
	templateVariables?: Record<string, unknown>;
	contextVariables?: Record<string, unknown>;
	onready(instance: QtiPciInstance, state?: unknown): void;
	ondone(instance: QtiPciInstance, state?: unknown): void;
}

/**
 * What a conformant PCI module registers: the global
 * `qtiCustomInteractionContext.register(registration)` call.
 */
export interface QtiCustomInteractionRegistration {
	typeIdentifier: string;
	getInstance(
		dom: HTMLElement,
		configuration: QtiPciConfiguration,
		state?: unknown
	): QtiPciInstance | undefined;
}

/** The registry object the runtime installs as the page's `qtiCustomInteractionContext`. */
export interface PciCustomInteractionContext {
	register(registration: QtiCustomInteractionRegistration): void;
}

/** Identifies which authored module path is currently being resolved. */
export type PciModulePathKind = 'primary' | 'fallback';

/**
 * Context supplied to a host-owned PCI module resolver.
 *
 * PCI code executes with the authority of the page that loads it. The player therefore
 * never imports an authored URL by itself; an embedding host must decide which URLs or
 * package resources are trusted and return the loaded module explicitly. The module
 * registers itself as a side effect of evaluation, so the resolver's return value is
 * informational — registration is what counts.
 */
export interface PciModuleResolutionContext {
	/** Original path exactly as authored in the item. */
	authoredPath: string;
	/** Whether this is the primary module or the authored fallback. */
	kind: PciModulePathKind;
	/** Response variable bound to the interaction. */
	responseIdentifier: string;
	/** Portable interaction type identifier/URN. */
	customInteractionTypeIdentifier: string;
}

/**
 * Host-controlled PCI module resolution hook.
 *
 * The resolver may import an allow-listed URL, read a module from a verified content
 * package, or evaluate a pre-registered module. Whatever it returns, a conformant
 * module registers against `qtiCustomInteractionContext` as it evaluates.
 */
export type PciModuleResolver = (
	resolvedUrl: string,
	context: PciModuleResolutionContext
) => Promise<unknown> | unknown;

/**
 * Host-controlled PCI module policy — the sandboxed engine's variant of the
 * resolver. It decides *whether* an authored URL may be handed to the runner
 * frame at all and never evaluates anything in the page realm: the return value
 * is nothing, and throwing denies the module.
 */
export type PciModulePolicy = (
	resolvedUrl: string,
	context: PciModuleResolutionContext
) => void;

/**
 * Opt-in hardened execution for PCI modules (the sandboxed engine, plan
 * Option C). The module runs inside `<iframe sandbox="allow-scripts">` loaded
 * from a dedicated cookieless runner origin, so its document has an opaque
 * origin: it shares no storage, cookies, or DOM with the player, while its
 * base URL stays the runner URL so authored relative asset paths still
 * resolve. `@pie-qti/pci-runner` is the deployable runner bundle.
 */
export interface PciSandboxConfiguration {
	/**
	 * Absolute URL of the deployed runner page, for example
	 * `https://qti.pie-framework.org/pci-runner.html`. The runner origin must
	 * serve nothing else and set no cookies — there is nothing on it worth
	 * reaching, which is the security property.
	 */
	runnerUrl: string;
	/**
	 * Milliseconds to wait for the runner handshake and the module's in-frame
	 * load. Default 15000; a frame that never becomes ready fails through
	 * `PciHostController.onError`.
	 */
	handshakeTimeoutMs?: number;
	/**
	 * How often the runner re-reads the instance's `getResponse()`/`getState()`
	 * and pushes changes, in milliseconds. Default 250. `getResponse()` on the
	 * host stays synchronous, so a submit reads the cache this poll maintains:
	 * the response is at most one interval stale.
	 */
	pollIntervalMs?: number;
	/**
	 * Milliseconds the runner waits for the module to register after its code
	 * evaluates. Default 5000; same semantics as the page-realm registration
	 * timeout.
	 */
	registrationTimeoutMs?: number;
}

/**
 * A connection to one runner frame. The default implementation creates the
 * `<iframe sandbox="allow-scripts">` element and wires `window` messaging;
 * tests inject an in-memory pair instead.
 */
export interface PciFrameConnection {
	/** The origin every runner message must carry. */
	readonly frameOrigin: string;
	/** The identity an incoming event's `source` must be to count as the frame. */
	readonly source: unknown;
	/** Send a structured-cloneable message to the frame, locked to its origin. */
	post(message: unknown): void;
	/** Insert the frame into the interaction's mount node. */
	appendTo(target: HTMLElement): void;
	/** True while the frame's element is still in the document. */
	isAttached(): boolean;
	/** Messages from the frame, already filtered to its origin and source identity. */
	onMessage(handler: (data: unknown) => void): () => void;
	/** Remove the frame from the document and stop listening. */
	dispose(): void;
	/** Apply a runner-reported height, in CSS pixels. */
	setHeight(height: number): void;
}

/** Creates the frame connection for a runner page URL. */
export type PciFrameConnector = (frameUrl: string, title: string) => PciFrameConnection;

/** Secure-by-default PCI runtime configuration. */
export interface PciConfiguration {
	/** Directory URL used to resolve relative authored module paths. */
	baseUrl?: string;
	/**
	 * The host trust decision for executing a PCI module in the page realm.
	 * Required unless `sandbox` is configured; a sandboxed engine never
	 * evaluates module code in the page, so there is nothing for a resolver to
	 * import. When both are configured the resolver is unused.
	 */
	moduleResolver?: PciModuleResolver;
	/**
	 * Opt-in hardened execution in a sandboxed cross-origin frame. When set it
	 * takes precedence over `moduleResolver`: the runner frame executes the
	 * module with an opaque origin and the page never evaluates it.
	 */
	sandbox?: PciSandboxConfiguration;
	/**
	 * Optional allow-list applied to the module URLs handed to the sandbox
	 * runner. Never evaluates anything; combine with `createAllowlistPciModulePolicy`.
	 */
	modulePolicy?: PciModulePolicy;
}

/** The response declaration shape a PCI's values convert against. */
export interface PciResponseDeclarationInfo {
	baseType?: BaseType;
	cardinality: Cardinality;
}

/**
 * Low-level options accepted by PciHost.
 *
 * `moduleResolver` remains optional here so an unconfigured host can report the
 * secure-default error at load time. Public player configuration requires it.
 */
export interface PciHostOptions {
	baseUrl?: string;
	moduleResolver?: PciModuleResolver;
	/**
	 * Run the module in a sandboxed cross-origin runner frame instead of the
	 * page realm. Takes precedence over `moduleResolver`.
	 */
	sandbox?: PciSandboxConfiguration;
	/**
	 * Policy gate for the module URLs handed to a sandbox runner. Never
	 * evaluates anything in the page; throwing denies the module.
	 */
	modulePolicy?: PciModulePolicy;
	/** The bound response declaration, for QTI variable JSON conversion at the boundary. */
	responseDeclaration?: PciResponseDeclarationInfo;
	/**
	 * The interaction status `getInstance` receives, fixed at instantiation. A
	 * function is read at each instantiation, so a rebuild carries the current one.
	 */
	status?: PciInteractionStatus | (() => PciInteractionStatus);
	/**
	 * Milliseconds to wait for a module to register after its code evaluates.
	 * Default 5000; a module that never registers fails the load. The sandboxed
	 * engine forwards it to the runner frame.
	 */
	registrationTimeoutMs?: number;
	/** Registry observation override; tests inject one for isolation. */
	registry?: PciRegistryObservation;
	/** Frame connection override; tests inject one instead of a real iframe. */
	frameConnector?: PciFrameConnector;
	/** The page origin the runner locks to; defaults to `location.origin`. Tests inject one. */
	parentOrigin?: () => string;
}

/**
 * Registry observation: what the runtime uses to install the page's
 * `qtiCustomInteractionContext` and await a module's registration.
 */
export interface PciRegistryObservation {
	/** Resolves with the registration for `typeIdentifier`; never rejects. */
	whenRegistered(typeIdentifier: string): Promise<QtiCustomInteractionRegistration>;
	/** The typeIdentifiers registered so far, in registration order. */
	registeredTypes(): string[];
	/** Stop observing; pending `whenRegistered` promises stay pending. */
	dispose(): void;
}

/**
 * Public, structural contract exposed by a PCI host.
 *
 * Keep component boundaries typed against this interface rather than the concrete
 * PciHost class. That allows consumers to combine source and published package
 * entrypoints without TypeScript treating the class's private state as part of
 * the compatibility check.
 */
export interface PciHostController {
	onResponseChange(callback: (responseId: string, value: unknown) => void): () => void;
	/**
	 * Fired when an authoritative `restore()` lands on a mounted module. The
	 * renderer owns scaffold sanitization, so it resets the markup and calls
	 * `remount()`.
	 */
	onRemountRequest(callback: () => void): () => void;
	/**
	 * Asynchronous failures that surface after `load()` resolved: the sandboxed
	 * engine's frame handshake, in-frame module load, or instance errors. The
	 * page-realm engine reports its failures by rejecting `load()` as before.
	 */
	onError(callback: (error: Error) => void): () => void;
	load(): Promise<void>;
	initialize(dom: HTMLElement): void;
	/** Rebuild the module in place from the held response, after a scaffold reset. */
	remount(dom: HTMLElement): Promise<void>;
	/** The current response, in the player's runtime value shape. */
	getResponse(): unknown;
	/** The mounted module's state snapshot, when it exposes `getState()`. */
	getState(): unknown;
	/**
	 * Offer a response the player believes to be current. Declined, returning
	 * `false`, once a mounted module has reported a response of its own: a live
	 * interaction owns its response until something authoritative replaces it.
	 */
	offerResponse(value: unknown): boolean;
	/**
	 * Authoritatively replace the response, discarding in-progress candidate
	 * state and returning ownership to the player. Session restore, reset to
	 * declaration default, and explicit host overrides use this. A mounted module
	 * is rebuilt through `onRemountRequest` where a renderer is wired to it, and
	 * otherwise re-instantiated on the last mount node — the QTI 3.0 PCI contract
	 * injects state at `getInstance` and offers no setter.
	 */
	restore(value: unknown): void;
	disable(): void;
	enable(): void;
	destroy(): void;
}

/** One authored `qti-interaction-module` entry. */
export interface PciModuleEntry {
	/** The module id other modules' AMD dependencies refer to. */
	id: string;
	primaryPath: string;
	fallbackPath?: string;
}

/**
 * Extracted data from a <qti-portable-custom-interaction> element.
 */
export interface ExtractedPci {
	/** responseIdentifier attribute value. */
	responseIdentifier: string;
	/** customInteractionTypeIdentifier attribute value (URN identifying the PCI type). */
	customInteractionTypeIdentifier: string;
	/** Primary JS module path (required). The entry module's path. */
	primaryPath: string;
	/** Fallback JS module path (optional). The entry module's fallback. */
	fallbackPath?: string;
	/**
	 * All authored `qti-interaction-module` entries, in document order. A
	 * multi-module PCI loads them through the AMD loader, whose `define` wires
	 * the dependencies; the entry module is the one whose id matches the
	 * customInteractionTypeIdentifier's tail.
	 */
	modules: PciModuleEntry[];
	/**
	 * The `qti-interaction-modules@primary-configuration` reference: a module
	 * resolution config file (RequireJS `paths` shape) that names the modules'
	 * paths. When absent, the runtime tries the defined default locations under
	 * the package base URL.
	 */
	resolutionConfigPath?: string;
	/** Inner HTML of the <qti-interaction-markup> element. */
	markup: HtmlContent;
	/** Key/value pairs from <qti-pci-properties>/<qti-pci-property>. */
	config: Record<string, string>;
}

/**
 * Raised when PCI content is present but the embedding host has not opted into executing it.
 */
export class PciModuleResolverRequiredError extends Error {
	constructor(
		public readonly responseIdentifier: string,
		public readonly authoredPath: string
	) {
		super(
			`PCI module loading is disabled for response '${responseIdentifier}'. ` +
				`Provide a host-controlled moduleResolver before loading '${authoredPath}'.`
		);
		this.name = 'PciModuleResolverRequiredError';
	}
}

/**
 * Thrown when a PCI module fails to load from both primary and fallback paths.
 */
export class PciLoadError extends Error {
	constructor(
		public readonly primaryPath: string,
		public readonly fallbackPath: string | undefined,
		cause?: Error
	) {
		super(
			fallbackPath
				? `PCI module failed to load from '${primaryPath}' and fallback '${fallbackPath}'`
				: `PCI module failed to load from '${primaryPath}'`
		);
		this.name = 'PciLoadError';
		if (cause) Object.defineProperty(this, 'cause', { value: cause, writable: true, configurable: true });
	}
}
