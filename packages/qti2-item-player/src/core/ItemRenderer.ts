/**
 * ItemRenderer - Framework-agnostic rendering engine for QTI items
 *
 * Replaces ItemBody.svelte with vanilla JavaScript. Creates and manages
 * web component instances for QTI interactions, handles response state,
 * and orchestrates the rendering pipeline.
 */

import type { InteractionData, QTIElement } from '../types/interactions.js';
import type { QTIChangeEvent } from '../web-components/QTIInteractionElement.js';
import type { ComponentRegistry } from './ComponentRegistry.js';
import type { Player } from './Player.js';
import { htmlToString, toTrustedHtml } from './trustedTypes.js';

/**
 * Configuration for ItemRenderer
 */
export interface ItemRendererConfig {
	/** Player instance containing the QTI item */
	player: Player;

	/** DOM container where the item will be rendered */
	container: HTMLElement;

	/** Current response values keyed by responseId */
	responses?: Record<string, any>;

	/** Whether the item is in read-only/disabled mode */
	disabled?: boolean;

	/** Optional function to apply math typesetting (e.g., KaTeX, MathJax) */
	typeset?: (element: HTMLElement) => void;

	/** Callback when a response changes */
	onResponseChange?: (responseId: string, value: any) => void;
}

/**
 * ItemRenderer class manages the rendering of QTI items using web components
 */
export class ItemRenderer {
	private player: Player;
	private container: HTMLElement;
	private componentRegistry: ComponentRegistry;
	private responses: Record<string, any>;
	private disabled: boolean;
	private typeset?: (element: HTMLElement) => void;
	private onResponseChange: (responseId: string, value: any) => void;

	// Tracking for cleanup
	private renderedElements: HTMLElement[] = [];
	private eventListeners: Array<{
		element: HTMLElement;
		type: string;
		handler: EventListener;
	}> = [];

	// State for AssociateInteraction (pairing selection)
	private selectedForPairing: string | null = null;

	constructor(config: ItemRendererConfig) {
		this.player = config.player;
		this.container = config.container;
		this.componentRegistry = this.player.getComponentRegistry();
		this.responses = config.responses || {};
		this.disabled = config.disabled || false;
		this.typeset = config.typeset;
		this.onResponseChange = config.onResponseChange || (() => {});

		// Initial render
		this.render();
	}

	/**
	 * Render the entire item with all interactions
	 */
	public render(): void {
		// Clean up previous render
		this.cleanup();

		// Create wrapper
		const wrapper = document.createElement('div');
		wrapper.className = 'qti-item-body';

		// Get and process interactions using the player's configured ExtractionRegistry
		const interactions: InteractionData[] = this.player.getInteractionData();

		// Filter block vs inline interactions
		const blockInteractions = interactions.filter(
			(i) =>
				i.type !== 'textEntryInteraction' && i.type !== 'inlineChoiceInteraction'
		);

		// Get item body HTML with interactions removed
		const itemBodyHtml = this.getProcessedItemBodyHtml();

		// Create prose container for body HTML
		const proseContainer = document.createElement('div');
		proseContainer.className = 'prose max-w-none mb-4';

		// Process inline interactions in HTML
		const processedHtml = this.processInlineInteractions(
			itemBodyHtml,
			interactions
		);
		proseContainer.innerHTML = toTrustedHtml(processedHtml, this.player.getTrustedTypesPolicyName()) as any;

		wrapper.appendChild(proseContainer);

		// Render block interactions as web components
		for (const interaction of blockInteractions) {
			try {
				const element = this.createInteractionElement(interaction);
				if (element) {
					wrapper.appendChild(element);
					this.renderedElements.push(element);
				}
			} catch (error) {
				console.error(
					`Failed to create component for ${interaction.type}:`,
					error
				);
			}
		}

		// Apply typesetting to the entire wrapper
		if (this.typeset) {
			try {
				this.typeset(wrapper);
			} catch (error) {
				console.error('Typesetting failed:', error);
			}
		}

		// Mount to container
		this.container.innerHTML = '';
		this.container.appendChild(wrapper);
	}

	/**
	 * Get item body HTML with block interactions removed
	 */
	private getProcessedItemBodyHtml(): string {
		let html = htmlToString(this.player.getItemBodyHtml());

		// Remove block interaction elements (they're rendered separately as web components)
		const interactionPatterns = [
			/<choiceInteraction[\s\S]*?<\/choiceInteraction>/gi,
			/<extendedTextInteraction[\s\S]*?<\/extendedTextInteraction>/gi,
			/<orderInteraction[\s\S]*?<\/orderInteraction>/gi,
			/<matchInteraction[\s\S]*?<\/matchInteraction>/gi,
			/<associateInteraction[\s\S]*?<\/associateInteraction>/gi,
			/<gapMatchInteraction[\s\S]*?<\/gapMatchInteraction>/gi,
			/<sliderInteraction[\s\S]*?<\/sliderInteraction>/gi,
			/<hotspotInteraction[\s\S]*?<\/hotspotInteraction>/gi,
			/<graphicGapMatchInteraction[\s\S]*?<\/graphicGapMatchInteraction>/gi,
			/<graphicOrderInteraction[\s\S]*?<\/graphicOrderInteraction>/gi,
			/<graphicAssociateInteraction[\s\S]*?<\/graphicAssociateInteraction>/gi,
			/<positionObjectInteraction[\s\S]*?<\/positionObjectInteraction>/gi,
			/<endAttemptInteraction[\s\S]*?<\/endAttemptInteraction>/gi,
			/<uploadInteraction[\s\S]*?<\/uploadInteraction>/gi,
			/<drawingInteraction[\s\S]*?<\/drawingInteraction>/gi,
			/<mediaInteraction[\s\S]*?<\/mediaInteraction>/gi,
			/<hottextInteraction[\s\S]*?<\/hottextInteraction>/gi,
			/<selectPointInteraction[\s\S]*?<\/selectPointInteraction>/gi,
			/<customInteraction[\s\S]*?<\/customInteraction>/gi,
		];

		for (const pattern of interactionPatterns) {
			html = html.replace(pattern, '');
		}

		return html;
	}

	/**
	 * Process inline interactions (textEntry, inlineChoice)
	 * Replaces QTI XML tags with web component placeholders
	 */
	private processInlineInteractions(
		html: string,
		interactions: InteractionData[]
	): string {
		// Replace textEntry with placeholder
		html = html.replace(
			/<textEntryInteraction[^>]*responseIdentifier="([^"]+)"[^>]*?(?:\/>|><\/textEntryInteraction>)/gi,
			(match, responseId) => {
				const interaction = interactions.find(
					(i) => i.responseId === responseId && i.type === 'textEntryInteraction'
				);
				if (interaction) {
					return `<span data-inline-interaction="${responseId}" data-type="textEntry"></span>`;
				}
				return match;
			}
		);

		// Replace inlineChoice with placeholder
		html = html.replace(
			/<inlineChoiceInteraction[^>]*responseIdentifier="([^"]+)"[^>]*>[\s\S]*?<\/inlineChoiceInteraction>/gi,
			(match, responseId) => {
				const interaction = interactions.find(
					(i) => i.responseId === responseId && i.type === 'inlineChoiceInteraction'
				);
				if (interaction) {
					return `<span data-inline-interaction="${responseId}" data-type="inlineChoice"></span>`;
				}
				return match;
			}
		);

		return html;
	}

	/**
	 * Create a web component element for an interaction
	 */
	private createInteractionElement(
		interaction: InteractionData
	): HTMLElement | null {
		try {
			// Get tag name from registry
			const tagName = this.componentRegistry.getTagName(interaction);

			// Create element
			const element = document.createElement(tagName) as any;

			// Set standard properties
			element.interaction = interaction;
			element.response = this.responses[interaction.responseId] ?? null;
			element.disabled = this.disabled;
			element.typeset = this.typeset;

			// Special handling for AssociateInteraction (pairing selection)
			if (interaction.type === 'associateInteraction') {
				element.selectedForPairing = this.selectedForPairing;

				// Listen for selection changes
				const selectionHandler = (event: Event) => {
					const customEvent = event as CustomEvent<{ selected: string | null }>;
					this.selectedForPairing = customEvent.detail.selected;
					element.selectedForPairing = this.selectedForPairing;
				};

				element.addEventListener('qti-selection-change', selectionHandler);
				this.eventListeners.push({
					element,
					type: 'qti-selection-change',
					handler: selectionHandler,
				});
			}

			// Listen for response changes
			const changeHandler = (event: Event) => {
				const qtiEvent = event as QTIChangeEvent;
				this.handleResponseChange(
					qtiEvent.detail.responseId,
					qtiEvent.detail.value
				);
			};

			element.addEventListener('qti-change', changeHandler);
			this.eventListeners.push({
				element,
				type: 'qti-change',
				handler: changeHandler,
			});

			return element;
		} catch (error) {
			console.error(`Failed to create element for ${interaction.type}:`, error);
			return null;
		}
	}

	/**
	 * Handle response change from an interaction
	 */
	private handleResponseChange(responseId: string, value: any): void {
		// Update internal state
		this.responses[responseId] = value;

		// Notify callback
		this.onResponseChange(responseId, value);

		// Update any other elements that depend on this response
		this.updateInteractionElement(responseId, value);
	}

	/**
	 * Update a specific interaction element's response value
	 */
	private updateInteractionElement(responseId: string, value: any): void {
		for (const element of this.renderedElements) {
			const interaction = (element as any).interaction;
			if (interaction && interaction.responseId === responseId) {
				(element as any).response = value;
			}
		}
	}

	/**
	 * Update all responses at once
	 */
	public setResponses(responses: Record<string, any>): void {
		this.responses = { ...responses };

		// Update all rendered elements
		for (const element of this.renderedElements) {
			const interaction = (element as any).interaction;
			if (interaction) {
				(element as any).response = this.responses[interaction.responseId] ?? null;
			}
		}
	}

	/**
	 * Set disabled state for all interactions
	 */
	public setDisabled(disabled: boolean): void {
		this.disabled = disabled;

		// Update all rendered elements
		for (const element of this.renderedElements) {
			(element as any).disabled = disabled;
		}
	}

	/**
	 * Get current responses
	 */
	public getResponses(): Record<string, any> {
		return { ...this.responses };
	}

	/**
	 * Clean up event listeners and elements
	 */
	private cleanup(): void {
		// Remove event listeners
		for (const { element, type, handler } of this.eventListeners) {
			element.removeEventListener(type, handler);
		}
		this.eventListeners = [];

		// Clear rendered elements
		this.renderedElements = [];

		// Reset pairing selection
		this.selectedForPairing = null;
	}

	/**
	 * Destroy the renderer and clean up all resources
	 */
	public destroy(): void {
		this.cleanup();
		this.container.innerHTML = '';
	}
}

/**
 * Create a new ItemRenderer instance
 */
export function createItemRenderer(config: ItemRendererConfig): ItemRenderer {
	return new ItemRenderer(config);
}
