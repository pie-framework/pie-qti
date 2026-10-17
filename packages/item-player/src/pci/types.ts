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

/** Secure-by-default PCI runtime configuration. */
export interface PciConfiguration {
	/** Directory URL used to resolve relative authored module paths. */
	baseUrl?: string;
	/** Required host trust decision for loading/executing a PCI module. */
	moduleResolver: PciModuleResolver;
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
	/** The bound response declaration, for QTI variable JSON conversion at the boundary. */
	responseDeclaration?: PciResponseDeclarationInfo;
	/**
	 * The interaction status `getInstance` receives, fixed at instantiation. A
	 * function is read at each instantiation, so a rebuild carries the current one.
	 */
	status?: PciInteractionStatus | (() => PciInteractionStatus);
	/**
	 * Milliseconds to wait for a module to register after its code evaluates.
	 * Default 5000; a module that never registers fails the load.
	 */
	registrationTimeoutMs?: number;
	/** Registry observation override; tests inject one for isolation. */
	registry?: PciRegistryObservation;
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

/**
 * Extracted data from a <qti-portable-custom-interaction> element.
 */
export interface ExtractedPci {
	/** responseIdentifier attribute value. */
	responseIdentifier: string;
	/** customInteractionTypeIdentifier attribute value (URN identifying the PCI type). */
	customInteractionTypeIdentifier: string;
	/** Primary JS module path (required). */
	primaryPath: string;
	/** Fallback JS module path (optional). */
	fallbackPath?: string;
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
