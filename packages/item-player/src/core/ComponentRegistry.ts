/**
 * Component Registry for Web Component-based Interaction Rendering
 *
 * Provides a pluggable system for registering web components to render
 * different QTI interaction types. Uses priority-based dispatch similar to the
 * ExtractionRegistry, but for framework-agnostic web components.
 */

import type { InteractionData } from '../types/interactions.js';

/**
 * Configuration for registering a web component renderer
 */
export interface ComponentConfig<TData extends InteractionData = InteractionData> {
	/** Unique name for this renderer (e.g., 'rating-choice', 'standard-choice') */
	name: string;

	/**
	 * Priority for renderer evaluation (higher = checked first)
	 * - 100: Very specific custom renderers
	 * - 50: Moderately specific custom renderers
	 * - 10: Generic custom renderers
	 * - 0: Default fallback renderers
	 */
	priority: number;

	/** Optional description for debugging/error messages */
	description?: string;

	/**
	 * Predicate to determine if this component can handle the interaction
	 * Evaluated in priority order (highest first)
	 * @returns true if this component should be used
	 */
	canHandle: (data: TData) => boolean;

	/**
	 * Web component tag name (must contain a hyphen per web component spec)
	 * e.g., 'qti-choice-interaction', 'custom-rating-choice'
	 */
	tagName: string;

	/**
	 * Optional web component class constructor
	 * If provided, the component will be automatically registered with customElements
	 */
	componentClass?: CustomElementConstructor;

	/**
	 * Whether to automatically register the component with customElements
	 * Default: true if componentClass is provided
	 */
	autoRegister?: boolean;
}

/**
 * Internal registered component with metadata
 */
interface RegisteredComponent<TData extends InteractionData = InteractionData> {
	config: ComponentConfig<TData>;
}

/**
 * Registry for web components that render QTI interactions
 */
export class ComponentRegistry {
	private components = new Map<string, RegisteredComponent[]>();
	private definedElements = new Set<string>();

	/**
	 * Register a web component for an interaction type with priority-based dispatch
	 *
	 * @param type - QTI interaction type (e.g., 'choiceInteraction', 'textEntryInteraction')
	 * @param config - Component configuration with priority and canHandle predicate
	 *
	 * @example
	 * // Custom rating choice component with high priority
	 * registry.register('choiceInteraction', {
	 *   name: 'rating-choice',
	 *   priority: 100,
	 *   description: 'Star rating interactions',
	 *   canHandle: (data) => data.interactionClasses?.includes('rating-interaction'),
	 *   tagName: 'custom-rating-choice',
	 *   componentClass: RatingChoiceInteraction,
	 *   autoRegister: true
	 * });
	 *
	 * // Default choice component
	 * registry.register('choiceInteraction', {
	 *   name: 'standard-choice',
	 *   priority: 0,
	 *   canHandle: () => true,
	 *   tagName: 'qti-choice-interaction'
	 * });
	 */
	register<TData extends InteractionData>(
		type: string,
		config: ComponentConfig<TData>
	): void {
		// Validate tag name
		if (!config.tagName.includes('-')) {
			throw new Error(
				`Invalid tag name '${config.tagName}'. ` +
					`Web component tag names must contain a hyphen.`
			);
		}

		// Auto-register custom element if requested
		if (config.componentClass && config.autoRegister !== false) {
			if (!this.definedElements.has(config.tagName)) {
				if (!customElements.get(config.tagName)) {
					customElements.define(config.tagName, config.componentClass);
				}
				this.definedElements.add(config.tagName);
			}
		}

		// Get or create component array for this type
		let components = this.components.get(type);
		if (!components) {
			components = [];
			this.components.set(type, components);
		}

		// Add component and sort by priority (highest first)
		components.push({ config } as RegisteredComponent);
		components.sort((a, b) => b.config.priority - a.config.priority);
	}

	/**
	 * Get a web component tag name for an interaction type
	 * Evaluates canHandle predicates in priority order
	 *
	 * @param data - Interaction data
	 * @returns Web component tag name (e.g., 'qti-choice-interaction')
	 * @throws Error if no component matches
	 */
	getTagName<TData extends InteractionData>(data: TData): string {
		const components = this.components.get(data.type);

		if (!components || components.length === 0) {
			throw new Error(
				`No component registered for '${data.type}' interaction. ` +
					`Available types: ${Array.from(this.components.keys()).join(', ')}`
			);
		}

		// Evaluate canHandle in priority order
		for (const { config } of components) {
			try {
				if (config.canHandle(data as any)) {
					return config.tagName;
				}
			} catch (error) {
				// Log but continue to next component
				console.warn(
					`canHandle() failed for '${config.name}' component:`,
					error
				);
			}
		}

		// No component matched
		const componentList = components
			.map((c) => {
				const desc = c.config.description ? ` (${c.config.description})` : '';
				return `${c.config.name}${desc}`;
			})
			.join(', ');

		throw new Error(
			`No component available for '${data.type}' interaction.\n` +
				`Registered components: ${componentList}.\n` +
				`None of these components matched the current interaction.`
		);
	}

	/**
	 * Get all registered interaction types
	 * @returns Array of registered interaction type names
	 */
	getRegisteredTypes(): string[] {
		return Array.from(this.components.keys());
	}

	/**
	 * Check if a component is registered for a type
	 */
	hasComponent(type: string): boolean {
		return this.components.has(type) && this.components.get(type)!.length > 0;
	}
}

/**
 * Create a new component registry
 */
export function createComponentRegistry(): ComponentRegistry {
	return new ComponentRegistry();
}

/**
 * Plugin interface for registering web components
 */
export interface ComponentPlugin {
	/** Plugin name (e.g., '@renaissance/rating-choice') */
	name: string;

	/** Plugin version (semver) */
	version: string;

	/** Plugin description */
	description: string;

	/**
	 * Register web components with the registry
	 * @param registry - ComponentRegistry instance
	 */
	register(registry: ComponentRegistry): void;
}
