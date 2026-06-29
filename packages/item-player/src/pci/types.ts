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
	markup: string;
	/** Key/value pairs from <qti-pci-properties>/<qti-pci-property>. */
	config: Record<string, string>;
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
