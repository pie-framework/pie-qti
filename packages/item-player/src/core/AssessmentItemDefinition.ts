import {
	type AttributeNameMapper,
	type ElementNameMapper,
	Qti2xAttributeNameMapper,
	Qti2xElementNameMapper,
	Qti3AttributeNameMapper,
	Qti3ElementNameMapper,
	detectQtiVersion,
} from '@pie-qti/qti-common';
import type { I18nProvider } from '@pie-qti/i18n';
import type { ResolvedItemDeliveryContext } from '@pie-qti/ims-cp-core';
import type { ProcessingFragmentResolver, QtiValue } from '@pie-qti/qti-processing';
import {
	createExtractionRegistry,
	registerFrameworkDeliveryFields,
	type ExtractionRegistry,
} from '../extraction/ExtractionRegistry.js';
import { getStandardInteractionModules } from '../interactions/modules.js';
import type { PciConfiguration } from '../pci/types.js';
import type { PnpProfile } from '../pnp/types.js';
import type {
	ItemSessionEngineConfig,
	PlayerSecurityConfig,
	QTIComplianceConfig,
	QTIRole,
} from '../types/index.js';
import { createComponentRegistry } from './ComponentRegistry.js';
import type { ComponentRegistry } from './ComponentRegistry.js';
import { preparePlayerDefinitionInternal } from './Player.js';
import {
	LiveItemSession,
	type ItemSession,
	type OpenItemSessionOptions,
} from './ItemSession.js';

/**
 * Synchronous, definition-lifetime extension contract.
 *
 * Definition plugins describe immutable extraction and rendering extensions. Any
 * asynchronous setup must finish before definition construction.
 */
export interface AssessmentItemDefinitionPlugin {
	readonly kind: 'assessment-item-definition-plugin';
	readonly name: string;
	readonly version: string;
	readonly description?: string;
	readonly dependencies?: readonly string[];
	registerExtractors?(registry: ExtractionRegistry): void;
	registerComponents?(registry: ComponentRegistry): void;
}

/**
 * Configuration compiled into an immutable assessment-item definition.
 *
 * Mutable registry instances are deliberately not accepted here. Extensions are
 * described as plugins, applied once to definition-owned registries, then sealed
 * before those registries are shared by live sessions.
 */
export interface AssessmentItemDefinitionConfig {
	readonly itemXml: string;
	readonly pnp?: PnpProfile;
	readonly catalogXml?: string;
	readonly deliveryContext?: ResolvedItemDeliveryContext;
	readonly role?: QTIRole;
	/** Optional seed for deterministic template-processing random operations. */
	readonly seed?: number;
	readonly elementNameMapper?: ElementNameMapper;
	readonly attributeNameMapper?: AttributeNameMapper;
	readonly i18nProvider?: I18nProvider;
	readonly customOperators?: Readonly<
		Record<
			string,
			(args: QtiValue[], meta: { class?: string; definition?: string }) => QtiValue
		>
	>;
	readonly resolveProcessingFragment?: ProcessingFragmentResolver;
	readonly processingFragmentLimits?: Readonly<{
		/** Maximum nested xi:include depth. Default: 16. */
		maxDepth?: number;
		/** Maximum cumulative XML characters. Default: 2 MiB. */
		maxCharacters?: number;
	}>;
	readonly pci?: PciConfiguration;
	readonly security?: PlayerSecurityConfig;
	readonly strictQtiCompliance?: QTIComplianceConfig;
	readonly plugins?: readonly AssessmentItemDefinitionPlugin[];
	/** Creates an independent random stream for each opened live session. */
	readonly rngFactory?: () => () => number;
}

export interface AssessmentItemDefinition {
	readonly identifier: string;
	openSession(options?: OpenItemSessionOptions): ItemSession;
}

/**
 * Compile QTI source and immutable delivery configuration into a reusable item definition.
 */
export function createAssessmentItemDefinition(
	input: AssessmentItemDefinitionConfig
): AssessmentItemDefinition {
	return new CompiledAssessmentItemDefinition(input);
}

class CompiledAssessmentItemDefinition implements AssessmentItemDefinition {
	readonly identifier: string;
	private readonly playerConfig: Readonly<ItemSessionEngineConfig>;
	private readonly prepared: unknown;
	private readonly rngFactory?: () => () => number;

	constructor(input: AssessmentItemDefinitionConfig) {
		if (!input.itemXml.trim()) {
			throw new Error('AssessmentItemDefinition requires non-empty itemXml');
		}
		this.rngFactory = input.rngFactory;

		const plugins = input.plugins ? Object.freeze([...input.plugins]) : Object.freeze([]);
		const snapshot = snapshotDefinitionConfig(input);
		const { elementNameMapper, attributeNameMapper } = resolveNameMappers(snapshot);
		const config = compileDefinitionConfig(
			snapshot,
			{
				elementNameMapper,
				attributeNameMapper,
			},
			plugins,
		);
		this.prepared = preparePlayerDefinitionInternal({ ...config });
		this.identifier = readPreparedIdentifier(this.prepared);
		this.playerConfig = config;
		Object.freeze(this);
	}

	openSession(options: OpenItemSessionOptions = {}): ItemSession {
		if (
			options.restore?.itemIdentifier &&
			this.identifier &&
			options.restore.itemIdentifier !== this.identifier
		) {
			throw new Error(
				`Cannot restore item session for '${options.restore.itemIdentifier}' into '${this.identifier}'`
			);
		}

		return new LiveItemSession(
			this.identifier,
			createSessionPlayerConfig(this.playerConfig, this.rngFactory),
			options,
			this.prepared,
		);
	}
}

function readPreparedIdentifier(prepared: unknown): string {
	if (
		!prepared ||
		typeof prepared !== 'object' ||
		!('identifier' in prepared) ||
		typeof prepared.identifier !== 'string'
	) {
		throw new Error('AssessmentItemDefinition compilation did not produce an identifier');
	}
	return prepared.identifier;
}

function resolveNameMappers(config: Readonly<ItemSessionEngineConfig>) {
	if (config.elementNameMapper && config.attributeNameMapper) {
		return {
			elementNameMapper: config.elementNameMapper,
			attributeNameMapper: config.attributeNameMapper,
		};
	}

	const qti3 = detectQtiVersion(config.itemXml ?? '') === '3.0';
	return {
		elementNameMapper:
			config.elementNameMapper ?? (qti3 ? new Qti3ElementNameMapper() : new Qti2xElementNameMapper()),
		attributeNameMapper:
			config.attributeNameMapper ??
			(qti3 ? new Qti3AttributeNameMapper() : new Qti2xAttributeNameMapper()),
	};
}

function snapshotDefinitionConfig(input: AssessmentItemDefinitionConfig): Readonly<ItemSessionEngineConfig> {
	const { plugins, rngFactory, ...baseConfig } = input;
	void plugins;
	void rngFactory;
	const config: ItemSessionEngineConfig = {
		...baseConfig,
		itemXml: input.itemXml,
		...(input.processingFragmentLimits
			? { processingFragmentLimits: Object.freeze({ ...input.processingFragmentLimits }) }
			: {}),
		...(input.pci ? { pci: Object.freeze({ ...input.pci }) } : {}),
		...(input.customOperators
			? { customOperators: Object.freeze({ ...input.customOperators }) }
			: {}),
		...(input.security ? { security: freezePlainSnapshot(input.security) } : {}),
		...(input.pnp ? { pnp: freezePlainSnapshot(input.pnp) } : {}),
		...(input.deliveryContext
			? { deliveryContext: freezePlainSnapshot(input.deliveryContext) }
			: {}),
	};
	return Object.freeze(config);
}

function compileDefinitionConfig(
	config: Readonly<ItemSessionEngineConfig>,
	mappers: ReturnType<typeof resolveNameMappers>,
	plugins: readonly AssessmentItemDefinitionPlugin[],
): Readonly<ItemSessionEngineConfig> {
	const extractionRegistry = createExtractionRegistry(mappers.elementNameMapper);
	for (const module of getStandardInteractionModules()) {
		extractionRegistry.register(module.extractor);
		registerFrameworkDeliveryFields(extractionRegistry, module.type, module.delivery);
	}
	const componentRegistry = createComponentRegistry();

	const registeredPluginNames = new Set<string>();
	for (const plugin of plugins) {
		validateDefinitionPlugin(plugin, registeredPluginNames);
		plugin.registerExtractors?.(extractionRegistry);
		plugin.registerComponents?.(componentRegistry);
		registeredPluginNames.add(plugin.name);
	}

	extractionRegistry.seal();
	componentRegistry.seal();
	return Object.freeze({
		...config,
		elementNameMapper: mappers.elementNameMapper,
		attributeNameMapper: mappers.attributeNameMapper,
		extractionRegistry,
		componentRegistry,
	});
}

function validateDefinitionPlugin(
	plugin: AssessmentItemDefinitionPlugin,
	registeredPluginNames: ReadonlySet<string>,
): void {
	if (plugin.kind !== 'assessment-item-definition-plugin') {
		throw new Error(
			`Definition plugin '${plugin.name || '<unnamed>'}' must declare kind 'assessment-item-definition-plugin'`,
		);
	}
	if (!plugin.name || typeof plugin.name !== 'string') {
		throw new Error('AssessmentItemDefinition plugin must have a valid name');
	}
	if (!/^\d+\.\d+\.\d+/.test(plugin.version)) {
		throw new Error(
			`Definition plugin '${plugin.name}' has invalid version format: ${plugin.version}`,
		);
	}
	if (registeredPluginNames.has(plugin.name)) {
		throw new Error(`Definition plugin '${plugin.name}' is registered more than once`);
	}
	const missing = (plugin.dependencies ?? []).filter(
		(dependency) => !registeredPluginNames.has(dependency),
	);
	if (missing.length > 0) {
		throw new Error(
			`Definition plugin '${plugin.name}' has missing dependencies: ${missing.join(', ')}`,
		);
	}
}

function createSessionPlayerConfig(
	config: Readonly<ItemSessionEngineConfig>,
	rngFactory?: () => () => number,
): ItemSessionEngineConfig {
	return {
		...config,
		...(rngFactory ? { rng: rngFactory() } : {}),
		// Give each session a private top-level object while the compiled definition
		// and its sealed extension registries remain shared and immutable.
	};
}

function freezePlainSnapshot<T>(value: T): T {
	if (Array.isArray(value)) {
		return Object.freeze(value.map((entry) => freezePlainSnapshot(entry))) as T;
	}
	if (!value || typeof value !== 'object') return value;
	if (Object.getPrototypeOf(value) !== Object.prototype) return value;

	const snapshot = Object.fromEntries(
		Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
			key,
			freezePlainSnapshot(entry),
		])
	);
	return Object.freeze(snapshot) as T;
}
