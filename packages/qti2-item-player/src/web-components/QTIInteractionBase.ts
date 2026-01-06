/**
 * Abstract base class for all QTI interaction web components
 *
 * Provides common functionality including:
 * - Reactive property system
 * - Shadow DOM management
 * - Event emission helpers
 * - Update scheduling
 * - Lifecycle management
 *
 * @example
 * ```typescript
 * export class QTIChoiceInteraction extends QTIInteractionBase<ChoiceInteractionData> {
 *   protected render(): void {
 *     this.shadowRoot.innerHTML = `...`;
 *     this.attachEventListeners();
 *   }
 *
 *   protected cleanup(): void {
 *     // Optional cleanup
 *   }
 * }
 * ```
 */

import type { HtmlContent } from '../types/index.js';
import type { InteractionData } from '../types/interactions.js';
import {
	QTIChangeEvent,
	QTIErrorEvent,
	type QTIInteractionElement,
	QTIReadyEvent,
} from './QTIInteractionElement.js';

export abstract class QTIInteractionBase<TData extends InteractionData = InteractionData>
	extends HTMLElement
	implements QTIInteractionElement
{
	private _interaction: TData | null = null;
	private _response: any = null;
	private _disabled = false;
	private _typeset?: (element: HTMLElement) => void;

	declare shadowRoot: ShadowRoot; // Override HTMLElement's shadowRoot type
	private updateScheduled = false;
	private isInitialized = false;

	constructor() {
		super();
		// attachShadow returns ShadowRoot, and we cast to ensure type compatibility
		(this as any).shadowRoot = this.attachShadow({ mode: 'open' });
	}

	// ========== Property Getters/Setters ==========

	/**
	 * The processed interaction data from QTI XML
	 * Required property - throws if accessed before being set
	 */
	get interaction(): TData {
		if (!this._interaction) {
			throw new Error(
				`${this.tagName}: interaction property must be set before use`
			);
		}
		return this._interaction;
	}

	set interaction(value: TData) {
		if (this._interaction !== value) {
			this._interaction = value;
			this.requestUpdate();
		}
	}

	/**
	 * Current response value (type depends on interaction type)
	 * May be null if no response has been provided yet
	 */
	get response(): any {
		return this._response;
	}

	set response(value: any) {
		if (this._response !== value) {
			this._response = value;
			this.requestUpdate();
		}
	}

	/**
	 * Whether the interaction is in read-only/disabled mode
	 */
	get disabled(): boolean {
		return this._disabled;
	}

	set disabled(value: boolean) {
		const newValue = Boolean(value);
		if (this._disabled !== newValue) {
			this._disabled = newValue;
			this.requestUpdate();
		}
	}

	/**
	 * Optional function to apply math typesetting (e.g., KaTeX, MathJax)
	 */
	get typeset(): ((element: HTMLElement) => void) | undefined {
		return this._typeset;
	}

	set typeset(value: ((element: HTMLElement) => void) | undefined) {
		if (this._typeset !== value) {
			this._typeset = value;
			this.requestUpdate();
		}
	}

	// ========== Lifecycle Hooks ==========

	/**
	 * Called when the element is connected to the DOM
	 */
	connectedCallback(): void {
		if (!this.isInitialized) {
			this.isInitialized = true;
			this.init();
		}
		this.requestUpdate();
	}

	/**
	 * Called when the element is disconnected from the DOM
	 */
	disconnectedCallback(): void {
		this.cleanup();
	}

	/**
	 * Called once when the element is first connected
	 * Override this to perform one-time initialization
	 */
	protected init(): void {
		// Override in subclasses if needed
	}

	// ========== Reactive Updates ==========

	/**
	 * Schedule a re-render on the next microtask
	 * Multiple calls within the same tick are batched
	 */
	protected requestUpdate(): void {
		if (!this.updateScheduled && this.isConnected) {
			this.updateScheduled = true;
			queueMicrotask(() => {
				this.updateScheduled = false;
				try {
					this.render();
					if (this.isInitialized) {
						this.emitReady();
					}
				} catch (error) {
					this.emitError(error as Error, 'render');
				}
			});
		}
	}

	// ========== Abstract Methods ==========

	/**
	 * Render the component's UI
	 * Called automatically when properties change
	 * Must be implemented by subclasses
	 */
	protected abstract render(): void;

	/**
	 * Clean up resources when component is removed from DOM
	 * Override this to remove event listeners, cancel timers, etc.
	 */
	protected abstract cleanup(): void;

	// ========== Event Helpers ==========

	/**
	 * Emit a qti-change event when the user response changes
	 * @param value - The new response value
	 */
	protected emitChange(value: any): void {
		if (!this._interaction) {
			console.warn(`${this.tagName}: Cannot emit change without interaction data`);
			return;
		}

		const event = new QTIChangeEvent({
			responseId: this._interaction.responseId,
			value,
			timestamp: Date.now(),
		});

		this.dispatchEvent(event);
	}

	/**
	 * Emit a qti-ready event when component is initialized
	 */
	private emitReady(): void {
		this.dispatchEvent(new QTIReadyEvent());
	}

	/**
	 * Emit a qti-error event when an error occurs
	 */
	protected emitError(error: Error, context: string): void {
		const event = new QTIErrorEvent({ error, context });
		this.dispatchEvent(event);
		console.error(`${this.tagName} error in ${context}:`, error);
	}

	// ========== Utility Methods ==========

	/**
	 * Apply math typesetting to the shadow root
	 * Call this after updating the DOM with math content
	 */
	protected applyTypesetting(): void {
		if (this._typeset && this.shadowRoot) {
			try {
				this._typeset(this.shadowRoot as any);
			} catch (error) {
				this.emitError(error as Error, 'typesetting');
			}
		}
	}

	/**
	 * Get base styles for all interaction components
	 * Override and call super.getStyles() to extend these styles
	 */
	protected getStyles(): string {
		return `
			:host {
				display: block;
				font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
					Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
				font-size: 16px;
				line-height: 1.5;
			}

			:host([disabled]) {
				opacity: 0.6;
				pointer-events: none;
			}

			* {
				box-sizing: border-box;
			}

			.qti-prompt {
				margin-bottom: 1rem;
				font-weight: 600;
			}

			.qti-error {
				color: #dc2626;
				padding: 0.75rem;
				background: #fee2e2;
				border-radius: 0.375rem;
				margin: 0.5rem 0;
			}
		`;
	}

	/**
	 * Safely set innerHTML with error handling
	 */
	protected safeSetInnerHTML(element: HTMLElement | ShadowRoot, html: HtmlContent): void {
		try {
			element.innerHTML = html as any;
		} catch (error) {
			this.emitError(error as Error, 'setInnerHTML');
			element.innerHTML = `<div class="qti-error">Failed to render content</div>`;
		}
	}

	/**
	 * Create an element with classes
	 */
	protected createElement<K extends keyof HTMLElementTagNameMap>(
		tagName: K,
		classes?: string[]
	): HTMLElementTagNameMap[K] {
		const element = document.createElement(tagName);
		if (classes && classes.length > 0) {
			element.className = classes.join(' ');
		}
		return element;
	}
}
