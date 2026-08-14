/**
 * Component Registry for Web Component-based Interaction Rendering
 *
 * Provides a pluggable system for registering web components to render
 * different QTI interaction types. Uses priority-based dispatch similar to the
 * ExtractionRegistry, but for framework-agnostic web components.
 */

import type { BaseInteractionData } from '../interactions/index.js';

/**
 * Configuration for registering a web component renderer
 */
export interface ComponentConfig<
	TData extends BaseInteractionData = BaseInteractionData,
> {
	/** Unique name for this renderer (e.g., 'rating-choice', 'standard-choice') */
	name: string;

	/**
	 * Priority for renderer evaluation (higher = checked first)
	 * - 100: Very specific custom renderers
	 * - 50: Moderately specific custom renderers
	 * - 10: Generic custom renderers
	 * - 0: Default fallback renderers
	 * Default: 0
	 */
	priority?: number;

	/** Optional description for debugging/error messages */
	description?: string;

	/**
	 * Predicate to determine if this component can handle the interaction
	 * Evaluated in priority order (highest first)
	 * @returns true if this component should be used
	 * Default: always true
	 */
	canHandle?: (data: TData) => boolean;

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
interface RegisteredComponent<
	TData extends BaseInteractionData = BaseInteractionData,
> {
	config: ComponentConfig<TData> & {
		priority: number;
		canHandle: (data: TData) => boolean;
	};
}

const DEFAULT_COMPONENT_TAGS_BY_TYPE = {
	choiceInteraction: { name: 'default-choice', tagName: 'pie-qti-choice' },
	sliderInteraction: { name: 'default-slider', tagName: 'pie-qti-slider' },
	orderInteraction: { name: 'default-order', tagName: 'pie-qti-order' },
	matchInteraction: { name: 'default-match', tagName: 'pie-qti-match' },
	associateInteraction: { name: 'default-associate', tagName: 'pie-qti-associate' },
	gapMatchInteraction: { name: 'default-gap-match', tagName: 'pie-qti-gap-match' },
	hotspotInteraction: { name: 'default-hotspot', tagName: 'pie-qti-hotspot' },
	hottextInteraction: { name: 'default-hottext', tagName: 'pie-qti-hottext' },
	mediaInteraction: { name: 'default-media', tagName: 'pie-qti-media' },
	customInteraction: { name: 'default-custom', tagName: 'pie-qti-custom' },
	portableCustomInteraction: { name: 'default-portable-custom', tagName: 'pie-qti-portable-custom' },
	endAttemptInteraction: { name: 'default-end-attempt', tagName: 'pie-qti-end-attempt' },
	positionObjectInteraction: { name: 'default-position-object', tagName: 'pie-qti-position-object' },
	graphicGapMatchInteraction: { name: 'default-graphic-gap-match', tagName: 'pie-qti-graphic-gap-match' },
	graphicOrderInteraction: { name: 'default-graphic-order', tagName: 'pie-qti-graphic-order' },
	graphicAssociateInteraction: { name: 'default-graphic-associate', tagName: 'pie-qti-graphic-associate' },
	selectPointInteraction: { name: 'default-select-point', tagName: 'pie-qti-select-point' },
	extendedTextInteraction: { name: 'default-extended-text', tagName: 'pie-qti-extended-text' },
	uploadInteraction: { name: 'default-upload', tagName: 'pie-qti-upload' },
	drawingInteraction: { name: 'default-drawing', tagName: 'pie-qti-drawing' },
	catalogPopup: { name: 'default-catalog-popup', tagName: 'pie-qti-catalog-popup' },
} satisfies Record<string, { name: string; tagName: string }>;

/**
 * Registry for web components that render QTI interactions
 */
export class ComponentRegistry {
	private components = new Map<string, RegisteredComponent<any>[]>();
	private definedElements = new Set<string>();
	private sealed = false;

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
	 *   tagName: 'qti-choice-interaction'
	 * });
	 */
	register<TData extends BaseInteractionData>(
		type: string,
		config: ComponentConfig<TData>
	): void {
		this.assertMutable();
		// Validate tag name
		if (!config.tagName.includes('-')) {
			throw new Error(
				`Invalid tag name '${config.tagName}'. ` +
					`Web component tag names must contain a hyphen.`
			);
		}

		const registered = this.createRegisteredComponent(config);
		// Define eagerly in a browser. In a headless compiler there is no custom
		// element registry, so registration is deferred until the renderer is used.
		this.ensureCustomElementDefined(registered.config);

		// Get or create component array for this type
		let components = this.components.get(type);
		if (!components) {
			components = [];
			this.components.set(type, components);
		}

		// Add normalized component and sort by priority (highest first)
		components.push(registered as RegisteredComponent);
		components.sort((a, b) => b.config.priority - a.config.priority);
	}

	private createRegisteredComponent<TData extends BaseInteractionData>(
		config: ComponentConfig<TData>
	): RegisteredComponent<TData> {
		return Object.freeze({
			config: Object.freeze({
				...config,
				priority: config.priority ?? 0,
				canHandle: config.canHandle?.bind(config) ?? (() => true),
			}),
		});
	}

	private ensureCustomElementDefined<TData extends BaseInteractionData>(
		config: RegisteredComponent<TData>['config'],
	): void {
		if (
			!config.componentClass ||
			config.autoRegister === false ||
			this.definedElements.has(config.tagName)
		) {
			return;
		}

		const registry = globalThis.customElements;
		if (!registry) return;
		if (!registry.get(config.tagName)) {
			registry.define(config.tagName, config.componentClass);
		}
		this.definedElements.add(config.tagName);
	}

	/**
	 * Get a web component tag name for an interaction type
	 * Evaluates canHandle predicates in priority order
	 *
	 * @param data - Interaction data
	 * @returns Web component tag name (e.g., 'qti-choice-interaction')
	 * @throws Error if no component matches
	 */
	getTagName<TData extends BaseInteractionData>(data: TData): string {
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
					this.ensureCustomElementDefined(config);
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

	/**
	 * Get the tag name for a registered type by name (no canHandle evaluation).
	 * Useful for non-interaction components like catalogPopup where the type string
	 * is known and there is no delivered interaction object to pass.
	 *
	 * Returns the highest-priority registered tag name for the type, or null if
	 * the type is not registered.
	 */
	getTagNameForType(type: string): string | null {
		const components = this.components.get(type);
		if (!components || components.length === 0) return null;
		const config = components[0].config;
		this.ensureCustomElementDefined(config);
		return config.tagName;
	}

	/** Freeze renderer selection for a compiled AssessmentItem definition. */
	seal(): this {
		this.sealed = true;
		return this;
	}

	isSealed(): boolean {
		return this.sealed;
	}

	private assertMutable(): void {
		if (this.sealed) {
			throw new Error(
				'ComponentRegistry is sealed for this AssessmentItem; create a new definition to change renderers',
			);
		}
	}
}

/**
 * Create a new component registry
 */
export function createComponentRegistry(): ComponentRegistry {
	const registry = new ComponentRegistry();
	registerDefaultComponentTags(registry);
	return registry;
}

/**
 * Register the default QTI interaction tag names without importing their implementations.
 *
 * Hosts still choose the implementation bundle, typically by importing
 * `@pie-qti/default-components/plugins` in the browser. Keeping only tag metadata here lets
 * the item-player custom element remain the public rendering boundary without depending on
 * Svelte-authored default components.
 */
export function registerDefaultComponentTags(registry: ComponentRegistry): void {
	for (const [type, component] of Object.entries(DEFAULT_COMPONENT_TAGS_BY_TYPE)) {
		registry.register(type, {
			...component,
			description: `Default web component tag for ${type}`,
			priority: -100,
		});
	}
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
