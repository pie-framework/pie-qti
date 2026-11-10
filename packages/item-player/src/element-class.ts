/**
 * Registration-free implementation of the <pie-qti-item-player> custom element.
 *
 * Import `@pie-qti/item-player/element` when registration side effects are
 * desired. Browser runtimes that own registration can import this module and
 * define the class themselves.
 */

import type { ResolvedItemDeliveryContext } from '@pie-qti/ims-cp-core';
import type { I18nProvider } from '@pie-qti/i18n';
import { createSvelteMountController, warnOnce } from '@pie-qti/qti-common';
import { mount, unmount } from 'svelte';
import { createSubscriber } from 'svelte/reactivity';
import ItemPlayer from './components/ItemPlayer.svelte';
import type {
	AssessmentItemDefinitionConfig,
	AssessmentItemDefinitionPlugin,
} from './core/AssessmentItemDefinition.js';
import type { ItemSession } from './core/ItemSession.js';
import type { PnpProfile } from './pnp/types.js';
import type {
	AdaptiveAttemptResult,
	ItemPlayerErrorCode,
	ItemPlayerErrorDetail,
	PlayerSecurityConfig,
	QTIRole,
	ScoringResult,
} from './types/index.js';

const HTMLElementBase: typeof HTMLElement = globalThis.HTMLElement ?? (class {} as typeof HTMLElement);

export type PieQtiItemPlayerResponseMap = Record<string, unknown>;
export type PieQtiItemPlayerSubmissionResult = ScoringResult | AdaptiveAttemptResult;
export type PieQtiItemPlayerErrorDetail = ItemPlayerErrorDetail;
export type PieQtiItemPlayerErrorCode = ItemPlayerErrorCode;

export interface PieQtiItemPlayerResponseChangeDetail {
	responseId: string;
	value: unknown;
	responses: PieQtiItemPlayerResponseMap;
}

export interface PieQtiItemPlayerSubmitDetail {
	responses: PieQtiItemPlayerResponseMap;
	result: PieQtiItemPlayerSubmissionResult;
}

export interface PieQtiItemPlayerCompleteDetail {
	result: AdaptiveAttemptResult;
}

export interface PieQtiItemPlayerEventMap {
	'response-change': CustomEvent<PieQtiItemPlayerResponseChangeDetail>;
	ready: CustomEvent<void>;
	submit: CustomEvent<PieQtiItemPlayerSubmitDetail>;
	complete: CustomEvent<PieQtiItemPlayerCompleteDetail>;
	/**
	 * A load, response-processing, submission or render failure. The detail carries the raw
	 * `message` for host logs; the candidate sees a localized generic message instead.
	 */
	error: CustomEvent<PieQtiItemPlayerErrorDetail>;
}

const QTI_ROLES: readonly QTIRole[] = [
	'candidate',
	'scorer',
	'proctor',
	'testConstructor',
	'tutor',
	'author',
];

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

function isQtiRole(value: string): value is QTIRole {
	return (QTI_ROLES as readonly string[]).includes(value);
}

/** Unknown values never make the item silently read-only: they render as `candidate`. */
function parseQtiRole(value: string | null | undefined): QTIRole {
	const role = value ?? 'candidate';
	if (isQtiRole(role)) return role;
	warnOnce(
		'item-player:unknown-role',
		`Unknown player role '${role}': the item renders as 'candidate'. Accepted values are ${QTI_ROLES.join(', ')}, set with the qti-role attribute or the role property.`,
	);
	return 'candidate';
}

type ItemPlayerElementProps = {
	itemXml: string;
	session: ItemSession | undefined;
	role: QTIRole;
	disabled: boolean;
	renderItemBodyRubrics: boolean;
	typeset: ((el: HTMLElement) => void) | undefined;
	i18n: I18nProvider | undefined;
	security: PlayerSecurityConfig | undefined;
	pnp: PnpProfile | undefined;
	deliveryContext: ResolvedItemDeliveryContext | undefined;
	resolveProcessingFragment: AssessmentItemDefinitionConfig['resolveProcessingFragment'];
	processingFragmentLimits: AssessmentItemDefinitionConfig['processingFragmentLimits'];
	pci: AssessmentItemDefinitionConfig['pci'];
	stringComparison: AssessmentItemDefinitionConfig['stringComparison'];
	plugins: readonly AssessmentItemDefinitionPlugin[] | undefined;
	responses: PieQtiItemPlayerResponseMap | undefined;
	onResponseChange: (id: string, value: unknown) => void;
	onSubmit: (responses: PieQtiItemPlayerResponseMap, result: PieQtiItemPlayerSubmissionResult) => void;
	showSubmit: boolean;
	onComplete: (result: AdaptiveAttemptResult) => void;
	showFeedback: boolean | undefined;
	showSolution: boolean | undefined;
	onReady: () => void;
	onError: (error: PieQtiItemPlayerErrorDetail) => void;
	onOwnedSession: (session: ItemSession) => void;
	onOwnedSessionRelease: (session: ItemSession) => void;
	resumeSession: () => ItemSession | undefined;
};

type ItemPlayerComponentInstance = {
	submit(countAttempt?: boolean): PieQtiItemPlayerSubmissionResult | undefined;
};

export class PieQtiItemPlayerElement extends HTMLElementBase {
	static get observedAttributes() {
		return ['item-xml', 'qti-role', 'disabled', 'locale', 'show-feedback', 'show-solution'];
	}

	#mountController = createSvelteMountController<ItemPlayerElementProps, ItemPlayerComponentInstance>({
		host: this,
		createSubscriber,
		mount: (target, props) => mount(ItemPlayer, { target, props }) as ItemPlayerComponentInstance,
		unmount,
	});

	// Attribute-backed props
	#itemXml = '';
	#role: QTIRole = 'candidate';
	#disabled = false;
	#locale: string | undefined;
	#showFeedback: boolean | undefined;
	#showSolution: boolean | undefined;
	#renderItemBodyRubrics = true;

	// JS-only props
	#typeset: ((el: HTMLElement) => void) | undefined;
	#i18n: I18nProvider | undefined;
	#security: PlayerSecurityConfig | undefined;
	#pnp: PnpProfile | undefined;
	#deliveryContext: ResolvedItemDeliveryContext | undefined;
	#resolveProcessingFragment: AssessmentItemDefinitionConfig['resolveProcessingFragment'];
	#processingFragmentLimits: AssessmentItemDefinitionConfig['processingFragmentLimits'];
	#pci: AssessmentItemDefinitionConfig['pci'];
	#stringComparison: AssessmentItemDefinitionConfig['stringComparison'];
	#plugins: readonly AssessmentItemDefinitionPlugin[] | undefined;
	#session: ItemSession | undefined;
	/**
	 * The session the player owns on this element's behalf. The component hands it over when
	 * it opens one and returns it undisposed when it unmounts, so reconnecting the element
	 * resumes the attempt instead of opening a fresh session.
	 */
	#owned: ItemSession | undefined;
	/**
	 * A definition-fixed input changed since `#owned` was opened: it no longer matches the item
	 * and is not resumed. The mounted player's re-open supersedes and closes it.
	 */
	#ownedStale = false;
	/** The provider and locale whose view's `ready` this element already awaits. */
	#awaited: { i18n: I18nProvider; locale: string } | undefined;
	#responses: PieQtiItemPlayerResponseMap | undefined;

	get itemXml() {
		return this.#itemXml;
	}
	set itemXml(value: string | undefined) {
		const next = value ?? '';
		if (next !== this.#itemXml) this.#retireOwnedSession();
		this.#itemXml = next;
		this.#update();
	}

	/**
	 * The QTI view the item renders for: `candidate`, `scorer`, `proctor`, `testConstructor`,
	 * `tutor` or `author`. Declaratively this is the `qti-role` attribute — a bare `role`
	 * attribute is the ARIA role. Unknown values render as `candidate` with a diagnostic.
	 */
	get role(): QTIRole {
		return this.#role;
	}
	set role(value: QTIRole | null) {
		const next = parseQtiRole(value ?? undefined);
		if (next !== this.#role) this.#retireOwnedSession();
		this.#role = next;
		this.#update();
	}

	get disabled() {
		return this.#disabled;
	}
	set disabled(value: boolean | undefined) {
		this.#disabled = Boolean(value);
		this.#update();
	}

	/**
	 * Per-element locale override, settable declaratively as `locale="ar-SA"`.
	 *
	 * Applied by asking the provider for a locale-scoped view rather than by
	 * calling `setLocale()` on it: the provider is shared with everything else on
	 * the page, and a host may have it persist or reload on `setLocale()`. Two
	 * players can therefore carry different `locale` attributes over one provider.
	 * A view whose catalog is not loaded renders English first and re-renders once
	 * its `ready` settles. Has no effect without an `i18n` provider — there is
	 * nothing to translate with.
	 */
	get locale(): string | undefined {
		return this.#locale;
	}
	set locale(value: string | null | undefined) {
		if (value && !this.#i18n) {
			warnOnce(
				'item-player:locale-without-provider',
				'locale attribute set but no i18n provider configured: it has no effect. Pass an I18nProvider via the i18n property.',
			);
		}
		this.#locale = value ?? undefined;
		this.#update();
	}

	get renderItemBodyRubrics() {
		return this.#renderItemBodyRubrics;
	}
	set renderItemBodyRubrics(value: boolean | undefined) {
		this.#renderItemBodyRubrics = value !== false;
		this.#update();
	}

	/**
	 * Standalone integrated-feedback policy, declaratively the `show-feedback` attribute. QTI
	 * `itemSessionControl@showFeedback` defaults to false, so feedbackInline and feedbackBlock
	 * stay hidden unless the host opts in. Changing it re-opens the session the element owns.
	 */
	get showFeedback(): boolean | undefined {
		return this.#showFeedback;
	}
	set showFeedback(value: boolean | undefined) {
		if ((value ?? false) !== (this.#showFeedback ?? false)) this.#retireOwnedSession();
		this.#showFeedback = value;
		this.#update();
	}

	/**
	 * Standalone correct-response policy, declaratively the `show-solution` attribute: true
	 * exposes correct responses once the attempt has ended. Changing it re-opens the session
	 * the element owns.
	 */
	get showSolution(): boolean | undefined {
		return this.#showSolution;
	}
	set showSolution(value: boolean | undefined) {
		if ((value ?? false) !== (this.#showSolution ?? false)) this.#retireOwnedSession();
		this.#showSolution = value;
		this.#update();
	}

	get typeset() {
		return this.#typeset;
	}
	set typeset(value: ((el: HTMLElement) => void) | undefined) {
		this.#typeset = value;
		this.#update();
	}

	get i18n() {
		return this.#i18n;
	}
	set i18n(value: I18nProvider | undefined) {
		this.#i18n = value;
		this.#update();
	}

	get security() {
		return this.#security;
	}
	set security(value: PlayerSecurityConfig | undefined) {
		if (value !== this.#security) this.#retireOwnedSession();
		this.#security = value;
		this.#update();
	}

	get pnp() {
		return this.#pnp;
	}
	set pnp(value: PnpProfile | undefined) {
		if (value !== this.#pnp) this.#retireOwnedSession();
		this.#pnp = value;
		this.#update();
	}

	get deliveryContext() {
		return this.#deliveryContext;
	}
	set deliveryContext(value: ResolvedItemDeliveryContext | undefined) {
		if (value !== this.#deliveryContext) this.#retireOwnedSession();
		this.#deliveryContext = value;
		this.#update();
	}

	/**
	 * Portable Custom Interaction trust configuration. Set as a JavaScript property;
	 * functions such as moduleResolver cannot be represented safely as attributes.
	 */
	get pci() {
		return this.#pci;
	}
	set pci(value: AssessmentItemDefinitionConfig['pci']) {
		if (value !== this.#pci) this.#retireOwnedSession();
		this.#pci = value;
		this.#update();
	}

	/**
	 * String comparison folds beyond QTI's equality for the candidates' input, applied when the
	 * element creates its own definition (see `AssessmentItemDefinitionConfig.stringComparison`).
	 */
	get stringComparison() {
		return this.#stringComparison;
	}
	set stringComparison(value: AssessmentItemDefinitionConfig['stringComparison']) {
		// Keep the frozen copy when the options are unchanged: a re-assigned equal object is not
		// a new definition and must not re-open the session.
		if (!sameRecord(this.#stringComparison, value)) {
			this.#stringComparison = value ? Object.freeze({ ...value }) : undefined;
			this.#retireOwnedSession();
		}
		this.#update();
	}

	get plugins() {
		return this.#plugins;
	}
	set plugins(value: readonly AssessmentItemDefinitionPlugin[] | undefined) {
		// Keep the frozen copy when the same plugins are re-assigned: an equal list is not a new
		// definition and must not re-open the session.
		if (!sameList(this.#plugins, value)) {
			this.#plugins = value ? Object.freeze([...value]) : undefined;
			this.#retireOwnedSession();
		}
		this.#update();
	}

	get resolveProcessingFragment() {
		return this.#resolveProcessingFragment;
	}
	set resolveProcessingFragment(value: AssessmentItemDefinitionConfig['resolveProcessingFragment']) {
		if (value !== this.#resolveProcessingFragment) this.#retireOwnedSession();
		this.#resolveProcessingFragment = value;
		this.#update();
	}

	get processingFragmentLimits() {
		return this.#processingFragmentLimits;
	}
	set processingFragmentLimits(value: AssessmentItemDefinitionConfig['processingFragmentLimits']) {
		if (value !== this.#processingFragmentLimits) this.#retireOwnedSession();
		this.#processingFragmentLimits = value;
		this.#update();
	}

	get responses() {
		return this.#responses;
	}

	/**
	 * Live session injection point for assessment/section composition.
	 * Set as a JavaScript property; the element never owns or disposes an injected session.
	 * Injecting one supersedes the session the element opened for itself.
	 */
	get session() {
		return this.#session;
	}
	set session(value: ItemSession | undefined) {
		// A mounted player returns its own session as it switches to the injected one, and
		// #releaseOwnedSession closes it there; detached, nothing will, so close it here.
		if (value && this.#owned && !this.isConnected) {
			this.#owned.dispose();
			this.#owned = undefined;
			this.#ownedStale = false;
		}
		this.#session = value;
		this.#update();
	}
	set responses(value: PieQtiItemPlayerResponseMap | undefined) {
		this.#responses = value ? { ...value } : undefined;
		this.#update();
	}

	connectedCallback() {
		this.#warnLegacyRoleAttribute();
		this.#mountController.mountOrUpdate(this.#getProps());
	}

	disconnectedCallback() {
		// Unmounting hands the session the player owns to #releaseOwnedSession, which keeps it
		// alive so a reattach resumes the attempt. A removed element's session closes with the page.
		this.#mountController.teardown({ removeContainer: true });
	}

	attributeChangedCallback(name: string, _old: string | null, value: string | null) {
		if (name === 'item-xml') this.itemXml = value ?? '';
		else if (name === 'qti-role') this.role = parseQtiRole(value);
		else if (name === 'disabled') this.disabled = value !== null;
		else if (name === 'locale') {
			// Not the property setter: markup may carry `locale` before the host assigns `i18n`.
			this.#locale = value ?? undefined;
			this.#update();
		} else if (name === 'show-feedback') this.showFeedback = value === null ? undefined : true;
		else if (name === 'show-solution') this.showSolution = value === null ? undefined : true;
	}

	/** Score the current responses and emit `submit` (and, when applicable, `complete`). */
	submit(countAttempt = true): PieQtiItemPlayerSubmissionResult | undefined {
		return this.#mountController.instance?.submit(countAttempt);
	}

	addEventListener<K extends keyof PieQtiItemPlayerEventMap>(
		type: K,
		listener: (this: PieQtiItemPlayerElement, event: PieQtiItemPlayerEventMap[K]) => unknown,
		options?: boolean | AddEventListenerOptions,
	): void;
	addEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject,
		options?: boolean | AddEventListenerOptions,
	): void;
	addEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject,
		options?: boolean | AddEventListenerOptions,
	): void {
		super.addEventListener(type, listener, options);
	}

	/**
	 * The provider the component actually renders with: the injected one, narrowed
	 * to the `locale` attribute when both are present.
	 */
	#resolveI18n(): I18nProvider | undefined {
		if (!this.#i18n || !this.#locale) return this.#i18n;
		const view = this.#i18n.withLocale?.(this.#locale) ?? this.#i18n;
		this.#awaitCatalog(this.#i18n, this.#locale, view);
		return view;
	}

	/**
	 * Re-render once when the view's catalog finishes loading. Once per provider
	 * and locale: renders in between get fresh views over the same load, and a
	 * provider that sets `ready` on every view cannot loop. A change of provider
	 * or locale meanwhile drops the re-render; that change rendered, and awaits,
	 * its own view.
	 */
	#awaitCatalog(i18n: I18nProvider, locale: string, view: I18nProvider) {
		if (!view.ready) return;
		if (this.#awaited?.i18n === i18n && this.#awaited.locale === locale) return;
		const awaited = { i18n, locale };
		this.#awaited = awaited;
		void view.ready.then(() => {
			if (this.#awaited !== awaited || this.#i18n !== i18n || this.#locale !== locale) return;
			this.#update();
		});
	}

	/** The `role` attribute is the ARIA role now; QTI-role values there used to configure the player. */
	#warnLegacyRoleAttribute() {
		const legacy = this.getAttribute('role');
		if (legacy && isQtiRole(legacy)) {
			warnOnce(
				'item-player:role-attribute',
				`The 'role' attribute is the ARIA role and no longer configures the player. Use qti-role="${legacy}" to render the ${legacy} view.`,
			);
		}
	}

	/**
	 * The session the element kept for a remount, if it still matches the item. Read once per
	 * effect run, so the session adopted at mount is not a reactive dependency.
	 */
	#resumableSession = (): ItemSession | undefined => {
		return this.#session || this.#ownedStale ? undefined : this.#owned;
	};

	/** The player opened, adopted or replaced the session it owns for this element. */
	#takeOwnedSession = (session: ItemSession) => {
		if (this.#owned && this.#owned !== session) this.#owned.dispose();
		this.#owned = session;
		this.#ownedStale = false;
	};

	/**
	 * The player's own session left its effect. Superseded by a host-injected session, or
	 * already closed, it is spent; otherwise it stays alive so reconnecting the element
	 * resumes the attempt.
	 */
	#releaseOwnedSession = (session: ItemSession) => {
		if (this.#session || session.state().disposed) {
			session.dispose();
			if (this.#owned === session) {
				this.#owned = undefined;
				this.#ownedStale = false;
			}
			return;
		}
		this.#owned = session;
	};

	/** A definition-fixed input changed: the session the element kept no longer matches the item. */
	#retireOwnedSession() {
		if (!this.#owned) return;
		if (this.isConnected) {
			// The mounted player still renders it; its re-open supersedes and closes it.
			this.#ownedStale = true;
			return;
		}
		this.#owned.dispose();
		this.#owned = undefined;
		this.#ownedStale = false;
	}

	#getProps(): ItemPlayerElementProps {
		return {
			itemXml: this.#itemXml,
			session: this.#session,
			role: this.#role,
			disabled: this.#disabled,
			renderItemBodyRubrics: this.#renderItemBodyRubrics,
			typeset: this.#typeset,
			i18n: this.#resolveI18n(),
			security: this.#security,
			pnp: this.#pnp,
			deliveryContext: this.#deliveryContext,
			resolveProcessingFragment: this.#resolveProcessingFragment,
			processingFragmentLimits: this.#processingFragmentLimits,
			pci: this.#pci,
			stringComparison: this.#stringComparison,
			plugins: this.#plugins,
			responses: this.#responses,
			showFeedback: this.#showFeedback,
			showSolution: this.#showSolution,
			onReady: () => {
				// Deferred so hosts that listen after appending still observe the first render.
				queueMicrotask(() => {
					if (!this.isConnected) return;
					this.dispatchEvent(new CustomEvent<void>('ready', { bubbles: true, composed: true }));
				});
			},
			onError: (error) => {
				this.dispatchEvent(
					new CustomEvent<PieQtiItemPlayerErrorDetail>('error', {
						detail: error,
						bubbles: true,
						composed: true,
					}),
				);
			},
			onOwnedSession: this.#takeOwnedSession,
			onOwnedSessionRelease: this.#releaseOwnedSession,
			resumeSession: this.#resumableSession,
			onResponseChange: (responseId, value) => {
				const owned = this.#session ?? this.#owned;
				let sessionSnapshot: PieQtiItemPlayerResponseMap | null = null;
				if (owned) {
					try {
						sessionSnapshot = { ...owned.state().responses } as PieQtiItemPlayerResponseMap;
					} catch {
						sessionSnapshot = null; // the session closed between the dispatch and this event
					}
				}
				const responses =
					sessionSnapshot ?? { ...(this.#responses ?? {}), [responseId]: value };
				this.#responses = responses;
				this.dispatchEvent(
					new CustomEvent<PieQtiItemPlayerResponseChangeDetail>('response-change', {
						detail: { responseId, value, responses: { ...responses } },
						bubbles: true,
						composed: true,
					}),
				);
			},
			onSubmit: (responses, result) => {
				const snapshot = { ...responses };
				this.#responses = snapshot;
				this.dispatchEvent(
					new CustomEvent<PieQtiItemPlayerSubmitDetail>('submit', {
						detail: { responses: snapshot, result },
						bubbles: true,
						composed: true,
					}),
				);
			},
			showSubmit: false,
			onComplete: (result) => {
				this.dispatchEvent(
					new CustomEvent<PieQtiItemPlayerCompleteDetail>('complete', {
						detail: { result },
						bubbles: true,
						composed: true,
					}),
				);
			},
		};
	}

	#update() {
		this.#mountController.update(this.#getProps());
	}
}
