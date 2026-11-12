/**
 * Drift pins between the published facade (src/public/api.ts) and the runtime
 * contract types it publishes. Two families:
 *
 * (a) The @pie-qti/section-player contract types are published as 1:1 type
 *     aliases at their contract names. SECTION_CONTRACT_ALIASES lists the names,
 *     the bun-test walk (tests/data-model-drift.test.ts) asserts api.ts really
 *     aliases each of those names — not a hand copy under a drifted name — and
 *     the SectionIdentityPin types below assert each alias is the exact upstream
 *     type. An alias can neither drop a member nor ship under a renamed or
 *     hand-mirrored identity.
 *
 * (b) This package's own parsed-assessment runtime types (src/qti/types.ts,
 *     src/qti/resolveItems.ts) keep hand-written facade interfaces: the reviewed
 *     mapping in DATA_MODEL_MIRRORS names the mirror that must carry each
 *     contract member, the source walk fails when a member has no mirror
 *     counterpart, and the type pins below fail the same narrowing at compile
 *     time.
 *
 * (c) The @pie-qti/item-player contract types the facade publishes (the PnP
 *     profile and the PCI host-trust family) are aliases to the exact upstream
 *     types, listed in ITEM_PLAYER_CONTRACT_ALIASES with the entry each type is
 *     exported from; the identity pins below assert each alias is the exact
 *     upstream type, and the walk in tests/data-model-drift.test.ts asserts the
 *     alias really is `import('<entry>').<UpstreamName>` — not a hand copy.
 *
 * Typechecked by `tsc -p tsconfig.types.test.json` (part of `bun run test`).
 * Every pin is a type alias; the module also evaluates to the mapping lists the
 * bun-test walk reads, so the reviewed tables live in exactly one place.
 */
import type {
	ParsedAssessmentItemRef,
	ParsedAssessmentSection,
	ParsedAssessmentTest,
	ParsedTestPart,
	QtiItemFetchPolicy,
	ResolveItemsForAssessmentOptions,
} from '../src/public/api.js';

/** A contract type and the facade mirror that must carry every one of its members. */
export interface DataModelMirrorPin {
	/** The runtime contract source, relative to tests/. */
	contractSource: string;
	/** The contract type's name in that source. */
	contract: string;
	/** The mirror type's name in the facade. */
	mirror: string;
	/**
	 * The mirror's source when it is not an api.ts interface declaration (for
	 * example an element-file event detail); defaults to src/public/api.ts.
	 */
	mirrorSource?: string;
}

/** The section-player contract files whose types the facade publishes. */
export const SECTION_CONTRACT_SOURCES = [
	'../../section-player/src/contracts/layout-contract.ts',
	'../../section-player/src/contracts/runtime-host-contract.ts',
] as const;

/** This package's runtime sources for the published parsed-assessment types. */
export const PARSED_TYPE_SOURCES = ['../src/qti/types.ts', '../src/qti/resolveItems.ts'] as const;

/**
 * The section contract types the facade must publish under their own names, as
 * `export type <Name> = import('@pie-qti/section-player').<Name>` aliases. The
 * contracts are the source of truth: a host learns one name per concept across
 * both packages, and renames cannot silently diverge again.
 */
export const SECTION_CONTRACT_ALIASES: readonly string[] = [
	// layout-contract.ts
	'QtiSectionToolConfig',
	'QtiSectionModel',
	'QtiSectionItemRef',
	'QtiSharedHtmlBlock',
	'QtiSharedStimulus',
	'QtiResolvedStylesheetRef',
	'QtiResolvedCatalogSource',
	'QtiSharedContext',
	'QtiSectionSnapshot',
	'ResolvedQtiSectionComposition',
	// runtime-host-contract.ts
	'QtiSectionDiagnosticSource',
	'QtiSectionDiagnostic',
	'QtiPackageResolveContext',
	'QtiSharedHtmlSanitizeContext',
	'QtiAssetUrlPolicyContext',
	'QtiSectionResponseDeltaEvent',
	'QtiSectionActiveItemChangeEvent',
	'QtiSectionFrameworkError',
	'QtiSectionDisplaySettingsEvent',
	'QtiSectionRuntimeHostContract',
];

/**
 * Exported contract interfaces with no facade publication, and why none is
 * needed. The walk fails when a section contract interface is in neither table,
 * so a new contract type cannot ship without an explicit facade decision.
 */
export const SECTION_CONTRACT_NOT_PUBLISHED: Record<string, string> = {
	ResolveQtiSectionCompositionOptions:
		'section-player-internal function options; the facade takes a complete composition, not these options.',
};

/**
 * The reviewed contract→mirror table for the parsed-assessment family. Every
 * exported interface in PARSED_TYPE_SOURCES must appear here or in
 * PINNED_BY_REEXPORT, and every member of a pinned contract type must appear on
 * its mirror.
 */
export const DATA_MODEL_MIRRORS: DataModelMirrorPin[] = [
	// src/qti/types.ts — the parsed-assessment family
	{
		contractSource: PARSED_TYPE_SOURCES[0],
		contract: 'ParsedAssessmentItemRef',
		mirror: 'ParsedAssessmentItemRef',
	},
	{
		contractSource: PARSED_TYPE_SOURCES[0],
		contract: 'ParsedAssessmentSection',
		mirror: 'ParsedAssessmentSection',
	},
	{ contractSource: PARSED_TYPE_SOURCES[0], contract: 'ParsedTestPart', mirror: 'ParsedTestPart' },
	{ contractSource: PARSED_TYPE_SOURCES[0], contract: 'ParsedAssessmentTest', mirror: 'ParsedAssessmentTest' },
	// src/qti/resolveItems.ts — the resolve-options family
	{ contractSource: PARSED_TYPE_SOURCES[1], contract: 'QtiItemFetchPolicy', mirror: 'QtiItemFetchPolicy' },
	{
		contractSource: PARSED_TYPE_SOURCES[1],
		contract: 'ResolveItemsForAssessmentOptions',
		mirror: 'ResolveItemsForAssessmentOptions',
	},
];

/**
 * Exported parsed-type interfaces with no hand mirror, and why none is needed.
 * The walk fails when a parsed-type interface is in neither table.
 */
export const PINNED_BY_REEXPORT: Record<string, string> = {
	QtiItemMap: 'a Record<string, string> alias on both sides; no members to mirror.',
	QtiAssessmentResourceResolver: 'a function type alias; no members to mirror.',
	CreateAssessmentResourceResolverOptions:
		'an Omit<> alias over ResolveItemsForAssessmentOptions, which is pinned.',
};

/** One facade name published as an alias of an exact @pie-qti/item-player contract type. */
export interface ItemPlayerContractAlias {
	/** The name the facade publishes. */
	facade: string;
	/** The contract type's own name upstream. */
	upstream: string;
	/**
	 * The @pie-qti/item-player entry the type is exported from. The two PCI
	 * types the root entry does not carry come from item-player's `./pci`
	 * entry, which exports them at their own names.
	 */
	from: string;
}

/**
 * The item-player contract types the facade publishes as aliases to the exact
 * upstream type. `QtiPciHostConfiguration` keeps its round-4 facade name —
 * item-player's `QtiPciConfiguration` is the unrelated module-facing contract —
 * every other entry publishes the upstream name, Qti-prefixed.
 */
export const ITEM_PLAYER_CONTRACT_ALIASES: readonly ItemPlayerContractAlias[] = [
	{ facade: 'QtiPnpProfile', upstream: 'PnpProfile', from: '@pie-qti/item-player' },
	{ facade: 'QtiPciHostConfiguration', upstream: 'PciConfiguration', from: '@pie-qti/item-player' },
	{ facade: 'QtiPciModulePathKind', upstream: 'PciModulePathKind', from: '@pie-qti/item-player' },
	{
		facade: 'QtiPciModuleResolutionContext',
		upstream: 'PciModuleResolutionContext',
		from: '@pie-qti/item-player',
	},
	{ facade: 'QtiPciModuleResolver', upstream: 'PciModuleResolver', from: '@pie-qti/item-player' },
	{ facade: 'QtiPciSandboxConfiguration', upstream: 'PciSandboxConfiguration', from: '@pie-qti/item-player/pci' },
	{ facade: 'QtiPciModulePolicy', upstream: 'PciModulePolicy', from: '@pie-qti/item-player/pci' },
];

/** True only when A and B are the same type — no missing, no extra members. */
type Exactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/** True only when every key of Contract also exists on Mirror: a mirror that
 * drops a contract field fails here even though impl→contract assignability
 * would still pass. */
type HasContractKeys<Contract extends object, Mirror extends object> =
	keyof Contract extends keyof Mirror ? true : false;

/** The assertion itself: a pin that does not hold fails the constraint here. */
type Expect<T extends true> = T;

// ——— (a) Section contract identity pins: the facade name IS the contract type. ———
type SectionToolConfigIdentityPin = Expect<
	Exactly<import('@pie-qti/section-player').QtiSectionToolConfig, import('../src/public/api.js').QtiSectionToolConfig>
>;
type SectionModelIdentityPin = Expect<
	Exactly<import('@pie-qti/section-player').QtiSectionModel, import('../src/public/api.js').QtiSectionModel>
>;
type SectionItemRefIdentityPin = Expect<
	Exactly<import('@pie-qti/section-player').QtiSectionItemRef, import('../src/public/api.js').QtiSectionItemRef>
>;
type SharedHtmlBlockIdentityPin = Expect<
	Exactly<import('@pie-qti/section-player').QtiSharedHtmlBlock, import('../src/public/api.js').QtiSharedHtmlBlock>
>;
type SharedStimulusIdentityPin = Expect<
	Exactly<import('@pie-qti/section-player').QtiSharedStimulus, import('../src/public/api.js').QtiSharedStimulus>
>;
type ResolvedStylesheetRefIdentityPin = Expect<
	Exactly<
		import('@pie-qti/section-player').QtiResolvedStylesheetRef,
		import('../src/public/api.js').QtiResolvedStylesheetRef
	>
>;
type ResolvedCatalogSourceIdentityPin = Expect<
	Exactly<
		import('@pie-qti/section-player').QtiResolvedCatalogSource,
		import('../src/public/api.js').QtiResolvedCatalogSource
	>
>;
type SharedContextIdentityPin = Expect<
	Exactly<import('@pie-qti/section-player').QtiSharedContext, import('../src/public/api.js').QtiSharedContext>
>;
type SectionSnapshotIdentityPin = Expect<
	Exactly<import('@pie-qti/section-player').QtiSectionSnapshot, import('../src/public/api.js').QtiSectionSnapshot>
>;
type SectionCompositionIdentityPin = Expect<
	Exactly<
		import('@pie-qti/section-player').ResolvedQtiSectionComposition,
		import('../src/public/api.js').ResolvedQtiSectionComposition
	>
>;
type SectionDiagnosticSourceIdentityPin = Expect<
	Exactly<
		import('@pie-qti/section-player').QtiSectionDiagnosticSource,
		import('../src/public/api.js').QtiSectionDiagnosticSource
	>
>;
type SectionDiagnosticIdentityPin = Expect<
	Exactly<import('@pie-qti/section-player').QtiSectionDiagnostic, import('../src/public/api.js').QtiSectionDiagnostic>
>;
type PackageResolveContextIdentityPin = Expect<
	Exactly<
		import('@pie-qti/section-player').QtiPackageResolveContext,
		import('../src/public/api.js').QtiPackageResolveContext
	>
>;
type SharedHtmlSanitizeContextIdentityPin = Expect<
	Exactly<
		import('@pie-qti/section-player').QtiSharedHtmlSanitizeContext,
		import('../src/public/api.js').QtiSharedHtmlSanitizeContext
	>
>;
type AssetUrlPolicyContextIdentityPin = Expect<
	Exactly<
		import('@pie-qti/section-player').QtiAssetUrlPolicyContext,
		import('../src/public/api.js').QtiAssetUrlPolicyContext
	>
>;
type SectionResponseDeltaEventIdentityPin = Expect<
	Exactly<
		import('@pie-qti/section-player').QtiSectionResponseDeltaEvent,
		import('../src/public/api.js').QtiSectionResponseDeltaEvent
	>
>;
type SectionActiveItemChangeEventIdentityPin = Expect<
	Exactly<
		import('@pie-qti/section-player').QtiSectionActiveItemChangeEvent,
		import('../src/public/api.js').QtiSectionActiveItemChangeEvent
	>
>;
type SectionFrameworkErrorIdentityPin = Expect<
	Exactly<
		import('@pie-qti/section-player').QtiSectionFrameworkError,
		import('../src/public/api.js').QtiSectionFrameworkError
	>
>;
type SectionDisplaySettingsEventIdentityPin = Expect<
	Exactly<
		import('@pie-qti/section-player').QtiSectionDisplaySettingsEvent,
		import('../src/public/api.js').QtiSectionDisplaySettingsEvent
	>
>;
type SectionRuntimeHostIdentityPin = Expect<
	Exactly<
		import('@pie-qti/section-player').QtiSectionRuntimeHostContract,
		import('../src/public/api.js').QtiSectionRuntimeHostContract
	>
>;

// ——— (b) The parsed-assessment family pins against this package's runtime types. ———
type ParsedAssessmentTestKeysPin = Expect<
	HasContractKeys<import('../src/qti/types.js').ParsedAssessmentTest, ParsedAssessmentTest>
>;
type ParsedAssessmentSectionKeysPin = Expect<
	HasContractKeys<import('../src/qti/types.js').ParsedAssessmentSection, ParsedAssessmentSection>
>;
type ParsedAssessmentItemRefKeysPin = Expect<
	HasContractKeys<import('../src/qti/types.js').ParsedAssessmentItemRef, ParsedAssessmentItemRef>
>;
type ParsedTestPartKeysPin = Expect<
	HasContractKeys<import('../src/qti/types.js').ParsedTestPart, ParsedTestPart>
>;
type ResolveItemsOptionsKeysPin = Expect<
	HasContractKeys<
		import('../src/qti/resolveItems.js').ResolveItemsForAssessmentOptions,
		ResolveItemsForAssessmentOptions
	>
>;
type ItemFetchPolicyKeysPin = Expect<
	HasContractKeys<import('../src/qti/resolveItems.js').QtiItemFetchPolicy, QtiItemFetchPolicy>
>;

// ——— (c) Item-player contract identity pins: the facade name IS the contract type. ———
// A hand copy under any of these names fails here, and so does an upstream type
// that grows a field the facade alias cannot see (an alias sees everything).
type PnpProfileIdentityPin = Expect<
	Exactly<import('@pie-qti/item-player').PnpProfile, import('../src/public/api.js').QtiPnpProfile>
>;
type PciHostConfigurationIdentityPin = Expect<
	Exactly<
		import('@pie-qti/item-player').PciConfiguration,
		import('../src/public/api.js').QtiPciHostConfiguration
	>
>;
type PciModulePathKindIdentityPin = Expect<
	Exactly<
		import('@pie-qti/item-player').PciModulePathKind,
		import('../src/public/api.js').QtiPciModulePathKind
	>
>;
type PciModuleResolutionContextIdentityPin = Expect<
	Exactly<
		import('@pie-qti/item-player').PciModuleResolutionContext,
		import('../src/public/api.js').QtiPciModuleResolutionContext
	>
>;
type PciModuleResolverIdentityPin = Expect<
	Exactly<
		import('@pie-qti/item-player').PciModuleResolver,
		import('../src/public/api.js').QtiPciModuleResolver
	>
>;
type PciSandboxConfigurationIdentityPin = Expect<
	Exactly<
		import('@pie-qti/item-player/pci').PciSandboxConfiguration,
		import('../src/public/api.js').QtiPciSandboxConfiguration
	>
>;
type PciModulePolicyIdentityPin = Expect<
	Exactly<
		import('@pie-qti/item-player/pci').PciModulePolicy,
		import('../src/public/api.js').QtiPciModulePolicy
	>
>;
