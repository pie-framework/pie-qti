/**
 * The canonical descriptor of the definition-fixed session inputs of
 * `<pie-qti-item-player>` and the `ItemPlayer` component.
 *
 * A change to any input listed here re-opens the item session the player owns; every
 * other property write — disabled, i18n, typeset, responses, a no-op — must leave the
 * session alone. Two implementations must agree on this list, so both consume this
 * descriptor and nothing else may maintain it:
 *
 * - `element-class.ts`: each input's setter stores through `SESSION_INPUTS[key].store`
 *   and retires the owned session when `SESSION_INPUTS[key].changed` reports a new
 *   definition.
 * - `components/ItemPlayer.svelte`: each input has an equality-guarded `$derived`
 *   normalizing the prop through `SESSION_INPUTS[key].sessionValue` (the
 *   `sessionInputGuards` map there names them), so no-op writes never re-run the
 *   session effect.
 *
 * Svelte's `$derived` expressions cannot be generated at runtime, so the component
 * side is written out by hand; the `sessionInputGuards` map pins it to this
 * descriptor at compile time, and
 * `tests/component/element-session-stability.vitest.ts` enforces the lockstep
 * behaviorally by flipping every input here against the mounted element and watching
 * the session. A definition-fixed input is added in this file and on both sides —
 * nowhere else.
 */

import type { ResolvedItemDeliveryContext } from '@pie-qti/ims-cp-core';
import type { ProcessingFragmentResolver } from '@pie-qti/qti-processing';
import type {
	AssessmentItemDefinitionConfig,
	AssessmentItemDefinitionPlugin,
} from './core/AssessmentItemDefinition.js';
import { parseQtiRole } from './core/rolePolicy.js';
import type { PnpProfile } from './pnp/types.js';
import type { PlayerSecurityConfig, QTIRole } from './types/index.js';

/** The stored shape of each session input, as the element's getters report it. */
export interface SessionInputValues {
	itemXml: string;
	role: QTIRole;
	security: PlayerSecurityConfig | undefined;
	pnp: PnpProfile | undefined;
	deliveryContext: ResolvedItemDeliveryContext | undefined;
	resolveProcessingFragment: AssessmentItemDefinitionConfig['resolveProcessingFragment'];
	processingFragmentLimits: AssessmentItemDefinitionConfig['processingFragmentLimits'];
	pci: AssessmentItemDefinitionConfig['pci'];
	stringComparison: AssessmentItemDefinitionConfig['stringComparison'];
	plugins: readonly AssessmentItemDefinitionPlugin[] | undefined;
	showFeedback: boolean | undefined;
	showSolution: boolean | undefined;
}

/** The value shapes the element's setters accept, before `store` normalizes them. */
export interface SessionInputRawValues {
	itemXml: string | undefined;
	role: QTIRole | null;
	security: PlayerSecurityConfig | undefined;
	pnp: PnpProfile | undefined;
	deliveryContext: ResolvedItemDeliveryContext | undefined;
	resolveProcessingFragment: AssessmentItemDefinitionConfig['resolveProcessingFragment'];
	processingFragmentLimits: AssessmentItemDefinitionConfig['processingFragmentLimits'];
	pci: AssessmentItemDefinitionConfig['pci'];
	stringComparison: AssessmentItemDefinitionConfig['stringComparison'];
	plugins: readonly AssessmentItemDefinitionPlugin[] | undefined;
	showFeedback: boolean | undefined;
	showSolution: boolean | undefined;
}

export type SessionInputKey = keyof SessionInputValues;
export type SessionInputValue<K extends SessionInputKey> = SessionInputValues[K];
export type SessionInputRaw<K extends SessionInputKey> = SessionInputRawValues[K];

/**
 * The values the player's session-guard deriveds yield. They narrow the stored value
 * where the session only consumes a normalized form: the standalone session applies
 * `showFeedback` / `showSolution` as QTI `itemSessionControl` does, where `undefined`
 * and `false` are the same policy, so the guarded value is a plain `boolean`.
 */
export type SessionInputGuardValues = {
	[K in Exclude<SessionInputKey, 'showFeedback' | 'showSolution'>]: SessionInputValues[K];
} & {
	showFeedback: boolean;
	showSolution: boolean;
};

/**
 * The change semantics of one definition-fixed input. `store` normalizes an incoming
 * value so equal definitions are stored identically where possible; `changed` decides
 * whether a stored value and a stored next value are different definitions (retire /
 * re-open) or the same one (keep the session); `sessionValue` is the value the
 * component's session-guard derived yields, which must be identical across no-op
 * writes so the session effect does not re-run.
 */
export interface SessionInputSemantics<TValue, TRaw, TGuarded = TValue> {
	store(value: TRaw): TValue;
	changed(previous: TValue, next: TValue): boolean;
	sessionValue(value: TValue): TGuarded;
}

export type SessionInputDescriptor = {
	[K in SessionInputKey]: SessionInputSemantics<
		SessionInputValues[K],
		SessionInputRawValues[K],
		SessionInputGuardValues[K]
	>;
};

// The role list and its parser live in core/rolePolicy.ts — the one copy every
// player element shares.

/** Shallow list equality, so re-assigning an equal list is not a new definition. */
function sameList(a: readonly unknown[] | undefined, b: readonly unknown[] | undefined): boolean {
	if (a === b) return true;
	if (!a || !b || a.length !== b.length) return false;
	return a.every((entry, index) => entry === b[index]);
}

/** Shallow record equality for flat option objects. */
function sameRecord(a: object | undefined, b: object | undefined): boolean {
	if (a === b) return true;
	if (!a || !b) return false;
	const keys = Object.keys(a);
	return (
		keys.length === Object.keys(b).length &&
		keys.every((key) => (a as Record<string, unknown>)[key] === (b as Record<string, unknown>)[key])
	);
}

/**
 * The definition-fixed session inputs, keyed by property name. The semantics entries
 * carry the per-input change decisions both consuming sides share:
 *
 * - Reference inputs (`security`, `pnp`, `deliveryContext`, `pci`,
 *   `resolveProcessingFragment`, `processingFragmentLimits`): any newly created
 *   object, array or function the host assigns is a new definition.
 * - `itemXml`: the empty string and `undefined` are the same definition (no item).
 * - `role`: parsed first — unknown values render as `candidate` — so two unknown
 *   values are one definition.
 * - `stringComparison` and `plugins`: equal option records / plugin lists stored as a
 *   frozen copy keep the session; only different content is a new definition.
 * - `showFeedback` / `showSolution`: `undefined` and `false` are the same policy, so
 *   the guard compares `?? false` on both sides.
 */
export const SESSION_INPUTS: SessionInputDescriptor = {
	itemXml: {
		store: (value) => value ?? '',
		changed: (previous, next) => previous !== next,
		sessionValue: (value) => value,
	},
	role: {
		store: (value) => parseQtiRole(value ?? undefined),
		changed: (previous, next) => previous !== next,
		sessionValue: (value) => value,
	},
	security: {
		store: (value) => value,
		changed: (previous, next) => previous !== next,
		sessionValue: (value) => value,
	},
	pnp: {
		store: (value) => value,
		changed: (previous, next) => previous !== next,
		sessionValue: (value) => value,
	},
	deliveryContext: {
		store: (value) => value,
		changed: (previous, next) => previous !== next,
		sessionValue: (value) => value,
	},
	resolveProcessingFragment: {
		store: (value) => value,
		changed: (previous, next) => previous !== next,
		sessionValue: (value) => value,
	},
	processingFragmentLimits: {
		store: (value) => value,
		changed: (previous, next) => previous !== next,
		sessionValue: (value) => value,
	},
	pci: {
		store: (value) => value,
		changed: (previous, next) => previous !== next,
		sessionValue: (value) => value,
	},
	stringComparison: {
		// Keep the frozen copy when the options are unchanged: a re-assigned equal object
		// is not a new definition and must not re-open the session.
		store: (value) => (value ? Object.freeze({ ...value }) : undefined),
		changed: (previous, next) => !sameRecord(previous, next),
		sessionValue: (value) => value,
	},
	plugins: {
		// Keep the frozen copy when the same plugins are re-assigned: an equal list is not
		// a new definition and must not re-open the session.
		store: (value) => (value ? Object.freeze([...value]) : undefined),
		changed: (previous, next) => !sameList(previous, next),
		sessionValue: (value) => value,
	},
	showFeedback: {
		store: (value) => value,
		changed: (previous, next) => (previous ?? false) !== (next ?? false),
		sessionValue: (value) => value ?? false,
	},
	showSolution: {
		store: (value) => value,
		changed: (previous, next) => (previous ?? false) !== (next ?? false),
		sessionValue: (value) => value ?? false,
	},
};

/** The definition-fixed session inputs as a stable, iterable list of property names. */
export const SESSION_INPUT_KEYS = Object.keys(SESSION_INPUTS) as SessionInputKey[];
