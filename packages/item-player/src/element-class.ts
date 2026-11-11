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
import {
	SESSION_INPUTS,
	isQtiRole,
	parseQtiRole,
	type SessionInputKey,
	type SessionInputRaw,
	type SessionInputValues,
} from './session-inputs.js';
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
	#disabled = false;
	#locale: string | undefined;
	#renderItemBodyRubrics = true;

	// JS-only props
	#typeset: ((el: HTMLElement) => void) | undefined;
	#i18n: I18nProvider | undefined;
	#session: ItemSession | undefined;

	/**
	 * The definition-fixed session inputs (see `src/session-inputs.ts` for the canonical
	 * list and its change semantics). The setters below store through `SESSION_INPUTS`:
	 * `changed` decides whether a write is a new definition, and only then is the owned
	 * session retired. Unchanged writes keep the stored value, so a re-assigned equal
	 * list or options record pushes an identical prop and the player's session effect
	 * does not re-run.
	 */
	#inputs: SessionInputValues = {
		itemXml: '',
		role: 'candidate',
		security: undefined,
		pnp: undefined,
		deliveryContext: undefined,
		resolveProcessingFragment: undefined,
		processingFragmentLimits: undefined,
		pci: undefined,
		stringComparison: undefined,
		plugins: undefined,
		showFeedback: undefined,
		showSolution: undefined,
	};
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
		return this.#inputs.itemXml;
	}
	set itemXml(value: string | undefined) {
		this.#writeSessionInput('itemXml', value);
		this.#update();
	}

	/**
	 * The QTI view the item renders for: `candidate`, `scorer`, `proctor`, `testConstructor`,
	 * `tutor` or `author`. Declaratively this is the `qti-role` attribute — a bare `role`
	 * attribute is the ARIA role. Unknown values render as `candidate` with a diagnostic.
	 */
	get role(): QTIRole {
		return this.#inputs.role;
	}
	set role(value: QTIRole | null) {
		this.#writeSessionInput('role', value);
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
		return this.#inputs.showFeedback;
	}
	set showFeedback(value: boolean | undefined) {
		this.#writeSessionInput('showFeedback', value);
		this.#update();
	}

	/**
	 * Standalone correct-response policy, declaratively the `show-solution` attribute: true
	 * exposes correct responses once the attempt has ended. Changing it re-opens the session
	 * the element owns.
	 */
	get showSolution(): boolean | undefined {
		return this.#inputs.showSolution;
	}
	set showSolution(value: boolean | undefined) {
		this.#writeSessionInput('showSolution', value);
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
		return this.#inputs.security;
	}
	set security(value: PlayerSecurityConfig | undefined) {
		this.#writeSessionInput('security', value);
		this.#update();
	}

	get pnp() {
		return this.#inputs.pnp;
	}
	set pnp(value: PnpProfile | undefined) {
		this.#writeSessionInput('pnp', value);
		this.#update();
	}

	get deliveryContext() {
		return this.#inputs.deliveryContext;
	}
	set deliveryContext(value: ResolvedItemDeliveryContext | undefined) {
		this.#writeSessionInput('deliveryContext', value);
		this.#update();
	}

	/**
	 * Portable Custom Interaction trust configuration. Set as a JavaScript property;
	 * functions such as moduleResolver cannot be represented safely as attributes.
	 */
	get pci() {
		return this.#inputs.pci;
	}
	set pci(value: AssessmentItemDefinitionConfig['pci']) {
		this.#writeSessionInput('pci', value);
		this.#update();
	}

	/**
	 * String comparison folds beyond QTI's equality for the candidates' input, applied when the
	 * element creates its own definition (see `AssessmentItemDefinitionConfig.stringComparison`).
	 */
	get stringComparison() {
		return this.#inputs.stringComparison;
	}
	set stringComparison(value: AssessmentItemDefinitionConfig['stringComparison']) {
		this.#writeSessionInput('stringComparison', value);
		this.#update();
	}

	get plugins() {
		return this.#inputs.plugins;
	}
	set plugins(value: readonly AssessmentItemDefinitionPlugin[] | undefined) {
		this.#writeSessionInput('plugins', value);
		this.#update();
	}

	get resolveProcessingFragment() {
		return this.#inputs.resolveProcessingFragment;
	}
	set resolveProcessingFragment(value: AssessmentItemDefinitionConfig['resolveProcessingFragment']) {
		this.#writeSessionInput('resolveProcessingFragment', value);
		this.#update();
	}

	get processingFragmentLimits() {
		return this.#inputs.processingFragmentLimits;
	}
	set processingFragmentLimits(value: AssessmentItemDefinitionConfig['processingFragmentLimits']) {
		this.#writeSessionInput('processingFragmentLimits', value);
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

	/**
	 * Store one definition-fixed session input through its `SESSION_INPUTS` semantics
	 * (src/session-inputs.ts): a write the descriptor's `changed` rejects is a no-op that
	 * keeps the stored value and the session; a write it accepts replaces the stored
	 * value and retires the session the element owns.
	 */
	#writeSessionInput<K extends SessionInputKey>(key: K, value: SessionInputRaw<K>) {
		const input = SESSION_INPUTS[key];
		const next = input.store(value);
		if (!input.changed(this.#inputs[key], next)) return;
		this.#inputs[key] = next;
		this.#retireOwnedSession();
	}

	#getProps(): ItemPlayerElementProps {
		return {
			itemXml: this.#inputs.itemXml,
			session: this.#session,
			role: this.#inputs.role,
			disabled: this.#disabled,
			renderItemBodyRubrics: this.#renderItemBodyRubrics,
			typeset: this.#typeset,
			i18n: this.#resolveI18n(),
			security: this.#inputs.security,
			pnp: this.#inputs.pnp,
			deliveryContext: this.#inputs.deliveryContext,
			resolveProcessingFragment: this.#inputs.resolveProcessingFragment,
			processingFragmentLimits: this.#inputs.processingFragmentLimits,
			pci: this.#inputs.pci,
			stringComparison: this.#inputs.stringComparison,
			plugins: this.#inputs.plugins,
			responses: this.#responses,
			showFeedback: this.#inputs.showFeedback,
			showSolution: this.#inputs.showSolution,
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
