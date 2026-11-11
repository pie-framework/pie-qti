/**
 * Drift pins between the published facade's data-model mirrors and the runtime
 * contract types they mirror. The hand-written interfaces in src/public/api.ts
 * mirror (a) @pie-qti/section-player's contract files and (b) this package's
 * own parsed-assessment types (src/qti/types.ts, src/qti/resolveItems.ts).
 * A mirror that drops a contract field still compiles against every
 * impl→contract assignability pin, so narrowing drift ships silently — the
 * source walk (tests/data-model-drift.test.ts) fails when a contract member has
 * no mirror counterpart, and the type pins below fail the same narrowing at
 * compile time.
 *
 * Typechecked by `tsc -p tsconfig.types.test.json` (part of `bun run test`).
 * Every pin is a type alias; the module also evaluates to the mapping lists the
 * bun-test walk reads, so the reviewed contract→mirror table lives in exactly
 * one place.
 */
import type {
	ParsedAssessmentItemRef,
	ParsedAssessmentSection,
	ParsedAssessmentTest,
	ParsedTestPart,
	QtiAssetUrlPolicyContext,
	QtiItemFetchPolicy,
	QtiPackageResolveContext,
	QtiSectionComposition,
	QtiSectionDiagnostic,
	QtiSectionModel,
	QtiSectionResolvedCatalogSource,
	QtiSectionResolvedStylesheetRef,
	QtiSectionRuntimeHost,
	QtiSectionSharedContext,
	QtiSectionSnapshot,
	QtiSectionToolConfig,
	QtiSharedHtmlBlock,
	QtiSharedHtmlSanitizeContext,
	QtiSharedStimulus,
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

/** The section-player contract files the facade's data-model mirrors duplicate. */
export const SECTION_CONTRACT_SOURCES = [
	'../../section-player/src/contracts/layout-contract.ts',
	'../../section-player/src/contracts/runtime-host-contract.ts',
] as const;

/** This package's runtime sources for the published parsed-assessment types. */
export const PARSED_TYPE_SOURCES = ['../src/qti/types.ts', '../src/qti/resolveItems.ts'] as const;

/**
 * The reviewed contract→mirror table. Every exported interface in the contract
 * sources above must appear here or in PINNED_BY_REEXPORT, and every member of
 * a pinned contract type must appear on its mirror.
 */
export const DATA_MODEL_MIRRORS: DataModelMirrorPin[] = [
	// layout-contract.ts
	{ contractSource: SECTION_CONTRACT_SOURCES[0], contract: 'QtiSectionToolConfig', mirror: 'QtiSectionToolConfig' },
	{ contractSource: SECTION_CONTRACT_SOURCES[0], contract: 'QtiSectionModel', mirror: 'QtiSectionModel' },
	{
		// QtiSectionItemRef itself is a session/responses union; both sides keep the
		// carried fields in this (package-private) base interface.
		contractSource: SECTION_CONTRACT_SOURCES[0],
		contract: 'QtiSectionItemRefBase',
		mirror: 'QtiSectionItemRefBase',
	},
	{ contractSource: SECTION_CONTRACT_SOURCES[0], contract: 'QtiSharedHtmlBlock', mirror: 'QtiSharedHtmlBlock' },
	{ contractSource: SECTION_CONTRACT_SOURCES[0], contract: 'QtiSharedStimulus', mirror: 'QtiSharedStimulus' },
	{
		contractSource: SECTION_CONTRACT_SOURCES[0],
		contract: 'QtiResolvedStylesheetRef',
		mirror: 'QtiSectionResolvedStylesheetRef',
	},
	{
		contractSource: SECTION_CONTRACT_SOURCES[0],
		contract: 'QtiResolvedCatalogSource',
		mirror: 'QtiSectionResolvedCatalogSource',
	},
	{ contractSource: SECTION_CONTRACT_SOURCES[0], contract: 'QtiSharedContext', mirror: 'QtiSectionSharedContext' },
	{ contractSource: SECTION_CONTRACT_SOURCES[0], contract: 'QtiSectionSnapshot', mirror: 'QtiSectionSnapshot' },
	{
		contractSource: SECTION_CONTRACT_SOURCES[0],
		contract: 'ResolvedQtiSectionComposition',
		mirror: 'QtiSectionComposition',
	},
	// runtime-host-contract.ts
	{ contractSource: SECTION_CONTRACT_SOURCES[1], contract: 'QtiSectionDiagnostic', mirror: 'QtiSectionDiagnostic' },
	{
		contractSource: SECTION_CONTRACT_SOURCES[1],
		contract: 'QtiPackageResolveContext',
		mirror: 'QtiPackageResolveContext',
	},
	{
		contractSource: SECTION_CONTRACT_SOURCES[1],
		contract: 'QtiSharedHtmlSanitizeContext',
		mirror: 'QtiSharedHtmlSanitizeContext',
	},
	{
		contractSource: SECTION_CONTRACT_SOURCES[1],
		contract: 'QtiAssetUrlPolicyContext',
		mirror: 'QtiAssetUrlPolicyContext',
	},
	{
		contractSource: SECTION_CONTRACT_SOURCES[1],
		contract: 'QtiSectionRuntimeHostContract',
		mirror: 'QtiSectionRuntimeHost',
	},
	{
		// The event detail is declared on the runtime element and re-exported
		// through api.ts; the contract interface must keep matching it.
		contractSource: SECTION_CONTRACT_SOURCES[1],
		contract: 'QtiSectionResponseDeltaEvent',
		mirror: 'QtiSectionResponseDeltaDetail',
		mirrorSource: '../src/elements/QtiSectionPlayerSplitPaneElement.ts',
	},
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
 * Exported contract interfaces with no hand mirror, and why none is needed.
 * The walk fails when a contract interface is in neither table, so a new
 * contract type cannot ship without an explicit mirror decision.
 */
export const PINNED_BY_REEXPORT: Record<string, string> = {
	QtiSectionActiveItemChangeEvent: 'api.ts aliases the contract type directly (import alias; cannot drift).',
	QtiSectionFrameworkError: 'api.ts aliases the contract type directly (import alias; cannot drift).',
	QtiSectionDisplaySettingsEvent: 'the runtime element re-exports the contract type; api.ts re-exports it on.',
	ResolveQtiSectionCompositionOptions:
		'section-player-internal function options; the facade takes a complete composition, not these options.',
	QtiItemMap: 'a Record<string, string> alias on both sides; no members to mirror.',
	QtiAssessmentResourceResolver: 'a function type alias; no members to mirror.',
	CreateAssessmentResourceResolverOptions:
		'an Omit<> alias over ResolveItemsForAssessmentOptions, which is pinned.',
};

/** True only when every key of Contract also exists on Mirror: a mirror that
 * drops a contract field fails here even though impl→contract assignability
 * would still pass. */
type HasContractKeys<Contract extends object, Mirror extends object> =
	keyof Contract extends keyof Mirror ? true : false;

/** The assertion itself: a pin that does not hold fails the constraint here. */
type Expect<T extends true> = T;

// The three mirrors that drifted once (the section data model): narrowing fails
// the build, not just the runtime walk.
type SectionModelKeysPin = Expect<
	HasContractKeys<import('@pie-qti/section-player').QtiSectionModel, QtiSectionModel>
>;
type SectionCompositionKeysPin = Expect<
	HasContractKeys<import('@pie-qti/section-player').ResolvedQtiSectionComposition, QtiSectionComposition>
>;
type SectionRuntimeHostKeysPin = Expect<
	HasContractKeys<import('@pie-qti/section-player').QtiSectionRuntimeHostContract, QtiSectionRuntimeHost>
>;

// The parsed-assessment family pins against this package's own runtime types.
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
