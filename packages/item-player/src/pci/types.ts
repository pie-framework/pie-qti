/**
 * QTI 3.0 Portable Custom Interaction (PCI) types.
 * Based on IMS QTI 3.0 Portable Custom Interaction specification.
 */

/**
 * Callbacks the player provides to a PCI module so it can signal state changes.
 */
export interface PciBoundTo {
	/** Called when the PCI has finished initializing and is ready to accept responses. */
	onReady(): void;
	/** Called whenever the candidate's response changes. */
	onResponseChange(value: unknown): void;
}

/**
 * Contract that every PCI module must fulfill.
 * The module's default export (or named `getInstance` export) must implement this interface.
 */
export interface PciModule {
	/** Initialize the PCI inside the given DOM element. */
	initialize(dom: HTMLElement, config: Record<string, string>, boundTo: PciBoundTo): void;
	/** Return the current response value. */
	getResponse(): unknown;
	/** Restore a previously-captured response value. */
	setResponse(value: unknown): void;
	/** Disable candidate interaction (e.g. after submission or when role is not candidate). */
	disable(): void;
	/** Re-enable candidate interaction. */
	enable(): void;
	/** Tear down: remove event listeners, cancel timers, free resources. */
	destroy(): void;
}

/** Identifies which authored module path is currently being resolved. */
export type PciModulePathKind = 'primary' | 'fallback';

/**
 * Context supplied to a host-owned PCI module resolver.
 *
 * PCI code executes with the authority of the page that loads it. The player therefore
 * never imports an authored URL by itself; an embedding host must decide which URLs or
 * package resources are trusted and return the loaded module explicitly.
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
 * package, or return a pre-registered module. Its return value may be a PciModule,
 * an ES-module namespace with a default export, or a namespace exposing getInstance().
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

/**
 * Low-level options accepted by PciHost.
 *
 * `moduleResolver` remains optional here so an unconfigured host can report the
 * secure-default error at load time. Public player configuration requires it.
 */
export interface PciHostOptions {
	baseUrl?: string;
	moduleResolver?: PciModuleResolver;
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
	load(): Promise<void>;
	initialize(dom: HTMLElement): void;
	getResponse(): unknown;
	setResponse(value: unknown): void;
	disable(): void;
	enable(): void;
	destroy(): void;
}

/**
 * Extracted data from a <qti-portable-custom-interaction> element.
 */
export interface ExtractedPci {
	/** Canonical renderer type. Present on extractor output, optional for direct PciHost callers. */
	type?: 'portableCustomInteraction';
	/** responseIdentifier attribute value. */
	responseIdentifier: string;
	/** customInteractionTypeIdentifier attribute value (URN identifying the PCI type). */
	customInteractionTypeIdentifier: string;
	/** Primary JS module path (required). */
	primaryPath: string;
	/** Fallback JS module path (optional). */
	fallbackPath?: string;
	/** Inner HTML of the <qti-interaction-markup> element. */
	markup: string;
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
