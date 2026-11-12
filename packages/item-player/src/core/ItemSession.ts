import type { ResolvedItemDeliveryContext } from '@pie-qti/ims-cp-core';
import type { PnpProfile } from '../pnp/types.js';
import type { ExtractedPci, PciHostController } from '../pci/types.js';
import {
	createItemPresentation,
	type CreateItemPresentationOptions,
	type ItemPresentation,
} from '../presentation/itemPresentationPlan.js';
import type {
	CompletionStatus,
	HtmlContent,
	ItemLifecycleStatus,
	ItemSessionActionCommand,
	ItemSessionActionResult,
	ItemSessionEngineConfig,
	PlayerSecurityConfig,
	QTIRole,
	SerializedItemSessionState,
	SerializedItemSessionVariable,
} from '../types/index.js';
import type { BaseInteractionData } from '../interactions/shared/types.js';
import { deepFreezeInPlace, frozenSnapshot, withFreshTypedArrays } from '../utils/cloneFreeze.js';
import { createPlayerFromPreparedInternal, type Player } from './Player.js';

export interface OpenItemSessionOptions {
	/** Restore a previously serialized state before applying response overrides. */
	restore?: SerializedItemSessionState;
	/** Initial responses, or overrides applied after restore. */
	responses?: Readonly<Record<string, unknown>>;
	/** Resume a suspended handoff as an active interaction session. */
	activate?: boolean;
	/**
	 * Values for the item's context variables, e.g. `QTI_CONTEXT`, set before template processing.
	 * A restored session keeps its saved context values.
	 */
	contextVariables?: Readonly<Record<string, unknown>>;
	/**
	 * Default values for template variables, set before template processing, as an
	 * assessmentItemRef's `templateDefault` requires. A restored session keeps its saved values.
	 */
	templateDefaults?: Readonly<Record<string, unknown>>;
	/** Test-level item session control applied by `present()`. */
	presentation?: ItemSessionPresentationPolicy;
}

export interface ItemSessionPresentationPolicy {
	/**
	 * False hides integrated feedback (`feedbackInline` / `feedbackBlock`), as
	 * `itemSessionControl@showFeedback="false"` requires. An assessment host passes the test's
	 * item session control here; standalone delivery through `ItemPlayer` defaults to the QTI
	 * default (hidden) unless the host opts in.
	 */
	showFeedback?: boolean;
	/** True shows correct responses once the attempt has ended (`showSolution="true"`). */
	showSolution?: boolean;
}

/**
 * Opening a session with responses the item does not declare. Hosts that re-use an item
 * element across items can catch this to drop responses that belonged to the previous item.
 */
export class UnknownResponseIdentifierError extends Error {
	readonly identifier: string;
	constructor(identifier: string) {
		super(`Unknown response identifier '${identifier}'`);
		this.name = 'UnknownResponseIdentifierError';
		this.identifier = identifier;
	}
}

export type ItemSessionCommand =
	| ItemSessionActionCommand
	| { action: 'setResponse'; responseIdentifier: string; value: unknown }
	| { action: 'setResponses'; responses: Readonly<Record<string, unknown>> }
	| { action: 'updatePnp'; profile: Partial<PnpProfile> };

export type ItemSessionEventCommand = ItemSessionCommand | { action: 'dispose' };

export interface ItemSessionView {
	readonly revision: number;
	readonly itemIdentifier?: string;
	readonly role: QTIRole;
	readonly lifecycleStatus: ItemLifecycleStatus;
	readonly completionStatus: CompletionStatus;
	readonly numAttempts: number;
	/**
	 * Time on task in milliseconds. `context.duration`, the QTI built-in variable, holds the same
	 * time in seconds.
	 */
	readonly duration: number;
	readonly adaptive: boolean;
	readonly completed: boolean;
	readonly canSubmit: boolean;
	readonly disposed: boolean;
	readonly responses: Readonly<Record<string, unknown>>;
	readonly outcomes: Readonly<Record<string, unknown>>;
	readonly templates: Readonly<Record<string, unknown>>;
	readonly context: Readonly<Record<string, unknown>>;
}

export interface ItemSessionTransition {
	readonly command: ItemSessionEventCommand;
	readonly previous: ItemSessionView;
	readonly current: ItemSessionView;
	readonly result?: ItemSessionActionResult;
}

export type ItemSessionListener = (transition: ItemSessionTransition) => void;

export type ItemPresentationView = Omit<
	CreateItemPresentationOptions,
	'outcomeValues' | 'responses' | 'role' | 'source' | 'showFeedback' | 'showSolution'
>;

export interface ItemSession {
	state(): ItemSessionView;
	dispatch(command: ItemSessionCommand): ItemSessionTransition;
	present(view?: ItemPresentationView): ItemPresentation;
	subscribe(listener: ItemSessionListener): () => void;
	serialize(): SerializedItemSessionState;
	dispose(): void;
}

/**
 * Narrow browser/runtime capabilities needed after a presentation has been produced.
 * This interface deliberately excludes Player, parser nodes, declarations, and extraction registries.
 * @internal
 */
export interface ItemSessionBinding {
	readonly role: QTIRole;
	applyPnp(root: HTMLElement): void;
	getPnp(): PnpProfile | undefined;
	onPnpChange(listener: () => void): () => void;
	getCatalogEntry(
		idref: string,
		usage: string,
		lang?: string,
		options?: { stimulusIdentifier?: string }
	): HtmlContent | null;
	getContentLanguage(): string | undefined;
	getComponentRegistry(): ItemSessionComponentRegistry;
	getDeliveryContext(): ResolvedItemDeliveryContext | undefined;
	getSecurityConfig(): PlayerSecurityConfig | undefined;
	/**
	 * Response identifiers the item's content prints live (`printedVariable` targets declared
	 * as responses): the part of the response state a presentation's markup actually renders.
	 * A presentation presenter can key its caching on these — other response changes only
	 * carry interaction values, which present() reads into mounts, not into markup.
	 */
	getResponseIdentifiersPrintedInContent(): ReadonlySet<string>;
	/**
	 * Context identifiers the item's content prints live (`printedVariable` targets the session
	 * reports as context state — the QTI built-ins `duration`, `numAttempts`,
	 * `completionStatus` and declared context variables): the part of the context state a
	 * presentation's markup actually renders. A presentation presenter can key its caching on
	 * these — unprinted context values, `duration` included, never reach the markup.
	 */
	getContextIdentifiersPrintedInContent(): ReadonlySet<string>;
	getI18nProvider(): unknown;
	createPciHost(data: ExtractedPci): PciHostController;
}

/** @internal */
export interface ItemSessionComponentRegistry {
	getTagName(interaction: BaseInteractionData): string;
	getTagNameForType(type: string): string | null;
}

/**
 * Browser adapters use this without gaining access to the private session engine.
 * @internal
 */
export function getItemSessionBinding(session: ItemSession): ItemSessionBinding {
	const runtimeSession = session as ItemSession & {
		getRuntimeBinding?: () => ItemSessionBinding;
	};
	if (typeof runtimeSession.getRuntimeBinding !== 'function') {
		throw new Error('ItemSession runtime binding is unavailable');
	}
	return runtimeSession.getRuntimeBinding();
}

/**
 * Construct sessions through AssessmentItemDefinition.openSession().
 * @internal
 */
export class LiveItemSession implements ItemSession {
	private readonly player: Player;
	private readonly listeners = new Set<ItemSessionListener>();
	private readonly defaultRole: QTIRole;
	private readonly presentation: ItemSessionPresentationPolicy;
	private revision = 0;
	private disposed = false;
	private currentView: ItemSessionView;
	private readonly runtimeBinding: ItemSessionBinding;

	/** @internal Construct sessions through AssessmentItemDefinition.openSession(). */
	constructor(
		private readonly itemIdentifier: string,
		config: ItemSessionEngineConfig,
		options: OpenItemSessionOptions = {},
		prepared: unknown,
	) {
		this.defaultRole = config.role ?? 'candidate';
		this.presentation = { ...options.presentation };
		const playerConfig = {
			...config,
			...(options.contextVariables ? { contextVariables: options.contextVariables } : {}),
			...(options.templateDefaults ? { templateDefaults: options.templateDefaults } : {}),
		};
		this.player = createPlayerFromPreparedInternal(playerConfig, prepared, Boolean(options.restore));

		try {
			if (options.responses) {
				this.assertKnownResponseIdentifiers(Object.keys(options.responses));
			}
			if (options.restore) this.player.restoreItemSession(options.restore);
			if (options.activate && this.player.getLifecycleStatus() === 'suspended') {
				this.player.activateAttempt();
			}
			if (options.responses) {
				const lifecycle = this.player.getLifecycleStatus();
				if (!isResponseWritableLifecycle(lifecycle)) {
					throw new Error(`Cannot override responses while item session is ${lifecycle}`);
				}
				this.player.setResponses({ ...options.responses });
			}
			this.currentView = this.captureView();
		} catch (error) {
			this.player.destroy();
			throw error;
		}

		this.runtimeBinding = this.createBinding();
	}

	state(): ItemSessionView {
		return frozenSnapshot(this.currentView);
	}

	dispatch(command: ItemSessionCommand): ItemSessionTransition {
		this.assertActive();
		if (
			commandRequiresWritableLifecycle(command) &&
			!isResponseWritableLifecycle(this.currentView.lifecycleStatus)
		) {
			throw new Error(
				`Cannot ${describeCommand(command)} while item session is ${this.currentView.lifecycleStatus}`
			);
		}
		const previous = this.currentView;
		let result: ItemSessionActionResult | undefined;

		switch (command.action) {
			case 'setResponse':
				this.assertKnownResponseIdentifiers([command.responseIdentifier]);
				this.player.setResponses({ [command.responseIdentifier]: command.value });
				break;
			case 'setResponses':
				this.assertKnownResponseIdentifiers(Object.keys(command.responses));
				this.player.setResponses({ ...command.responses });
				break;
			case 'updatePnp':
				this.player.updatePnp(command.profile);
				break;
			default:
				result = this.player.runItemSessionAction(command);
		}

		this.revision += 1;
		this.currentView = this.captureView(result?.sessionState);
		const transition = freezeTransition({ command, previous, current: this.currentView, result });
		this.notify(transition);
		// The returned hand-out isolates the typed-array leaves for the caller, exactly as
		// each listener's copy does (see notify and withFreshTypedArrays).
		return withFreshTypedArrays(transition);
	}

	present(view: ItemPresentationView = {}): ItemPresentation {
		this.assertActive();
		const lifecycle = this.currentView.lifecycleStatus;
		const attemptEnded = !isResponseWritableLifecycle(lifecycle) && lifecycle !== 'suspended';
		return createItemPresentation({
			...view,
			disabled: view.disabled === true || !isResponseWritableLifecycle(lifecycle),
			showFeedback: this.presentation.showFeedback !== false,
			showSolution: this.presentation.showSolution === true && attemptEnded,
			source: {
				itemBodyHtml: this.player.getItemBodyHtml(),
				contentLanguage: this.player.getContentLanguage(),
				interactions: this.player.getInteractionData(),
				correctResponses: this.player.getCorrectResponses(),
				componentRegistry: this.player.getComponentRegistry(),
				deliveryContext: this.player.getDeliveryContext(),
				pnp: this.player.getPnp(),
				security: this.player.getSecurityConfig(),
				directRubrics: this.player.getRubrics({ scope: 'direct' }),
			},
			responses: frozenSnapshot(this.currentView.responses),
			outcomeValues: frozenSnapshot(this.currentView.outcomes),
			role: this.defaultRole,
		});
	}

	subscribe(listener: ItemSessionListener): () => void {
		this.assertActive();
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	serialize(): SerializedItemSessionState {
		this.assertActive();
		return frozenSnapshot(this.player.saveItemSession());
	}

	/**
	 * Browser/runtime capabilities carried by the session across package bundles.
	 * @internal
	 */
	getRuntimeBinding(): ItemSessionBinding {
		this.assertActive();
		return this.runtimeBinding;
	}

	dispose(): void {
		if (this.disposed) return;
		const previous = this.currentView;
		this.disposed = true;
		this.revision += 1;
		// The previous view is deeply frozen, so the disposed view can share its variable
		// records; only the new shell needs freezing.
		this.currentView = deepFreezeInPlace({
			...previous,
			revision: this.revision,
			disposed: true,
		});
		this.player.destroy();
		this.notify(
			freezeTransition({
				command: { action: 'dispose' },
				previous,
				current: this.currentView,
			})
		);
		this.listeners.clear();
	}

	/**
	 * Builds the immutable view a dispatch hands out. The variable records come from the
	 * serializer, whose values are per-call copies already independent of the engine (see
	 * qtiValueToSerializable) — freezing them in place needs no second clone. The shell is
	 * frozen around them, which leaves the frozen records untouched.
	 *
	 * `canSubmit` validates the engine's own response snapshot record: the same record the
	 * serializer's validation step used, so within one dispatch the validation memo hits and
	 * the responses are walked once.
	 */
	private captureView(serialized = this.player.saveItemSession()): ItemSessionView {
		const responses = frozenValuesOf(serialized.responseVariables);
		return deepFreezeInPlace({
			revision: this.revision,
			itemIdentifier: serialized.itemIdentifier || this.itemIdentifier || undefined,
			role: this.defaultRole,
			lifecycleStatus: serialized.lifecycleStatus,
			completionStatus: serialized.completionStatus,
			numAttempts: serialized.numAttempts,
			duration: serialized.duration,
			adaptive: this.player.isAdaptive(),
			completed: this.player.isCompleted(),
			canSubmit: this.player.canSubmitResponses(this.player.responseSnapshot()),
			disposed: this.disposed,
			responses,
			outcomes: frozenValuesOf(serialized.outcomeVariables),
			templates: frozenValuesOf(serialized.templateVariables),
			context: frozenValuesOf(serialized.contextVariables),
		});
	}

	private createBinding(): ItemSessionBinding {
		return Object.freeze({
			role: this.defaultRole,
			applyPnp: (root: HTMLElement) => {
				this.assertActive();
				this.player.applyPnp(root);
			},
			getPnp: () => {
				this.assertActive();
				return this.player.getPnp();
			},
			onPnpChange: (listener: () => void) => {
				this.assertActive();
				return this.player.onPnpChange(() => listener());
			},
			getContentLanguage: () => {
				this.assertActive();
				return this.player.getContentLanguage();
			},
			getCatalogEntry: (
				idref: string,
				usage: string,
				lang?: string,
				options?: { stimulusIdentifier?: string }
			) => {
				this.assertActive();
				return this.player.getCatalogEntry(idref, usage, lang, options);
			},
			getComponentRegistry: () => {
				this.assertActive();
				return this.player.getComponentRegistry();
			},
			getDeliveryContext: () => {
				this.assertActive();
				return this.player.getDeliveryContext();
			},
			getSecurityConfig: () => {
				this.assertActive();
				return this.player.getSecurityConfig();
			},
			getResponseIdentifiersPrintedInContent: () => {
				this.assertActive();
				return this.player.getResponseIdentifiersPrintedInContent();
			},
			getContextIdentifiersPrintedInContent: () => {
				this.assertActive();
				return this.player.getContextIdentifiersPrintedInContent();
			},
			getI18nProvider: () => {
				this.assertActive();
				return this.player.getI18nProvider();
			},
			createPciHost: (data: ExtractedPci) => {
				this.assertActive();
				const host = this.player.createPciHost(data);
				host.onResponseChange(() => {
					if (
						this.disposed ||
						!isResponseWritableLifecycle(this.currentView.lifecycleStatus)
					) return;
					const previous = this.currentView;
					this.revision += 1;
					this.currentView = this.captureView();
					this.notify(
						freezeTransition({
							command: {
								action: 'setResponse',
								responseIdentifier: data.responseIdentifier,
								value: host.getResponse(),
							},
							previous,
							current: this.currentView,
						})
					);
				});
				return host;
			},
		});
	}

	/**
	 * Every listener receives a deeply frozen transition, and one whose unfreezable
	 * typed-array leaves are its own: the frozen plain structure is shared across listeners
	 * (no listener can observe another's view of it through mutation — freezing forbids it),
	 * while each hand-out re-copies the leaves no platform can freeze (withFreshTypedArrays).
	 * A dispatch without such leaves — every keystroke on ordinary items — hands the same
	 * frozen object to every listener and clones nothing. A listener that must keep an owned
	 * copy of the whole view uses `state()`.
	 */
	private notify(transition: ItemSessionTransition): void {
		for (const listener of [...this.listeners]) {
			try {
				listener(withFreshTypedArrays(transition) as ItemSessionTransition);
			} catch (error) {
				console.error('[QTI ItemSession] subscriber failed:', error);
			}
		}
	}

	private assertActive(): void {
		if (this.disposed) throw new Error('ItemSession has been disposed');
	}

	private assertKnownResponseIdentifiers(responseIdentifiers: readonly string[]): void {
		const knownIdentifiers = new Set(Object.keys(this.player.getResponses()));
		const unknown = responseIdentifiers.find((identifier) => !knownIdentifiers.has(identifier));
		if (unknown) throw new UnknownResponseIdentifierError(unknown);
	}
}

function isResponseWritableLifecycle(status: ItemLifecycleStatus): boolean {
	return status === 'initial' || status === 'interacting';
}

function commandRequiresWritableLifecycle(command: ItemSessionCommand): boolean {
	return command.action === 'setResponse' ||
		command.action === 'setResponses' ||
		command.action === 'suspendAttempt' ||
		command.action === 'endAttempt' ||
		command.action === 'submitAttempt';
}

function describeCommand(command: ItemSessionCommand): string {
	return command.action === 'setResponse' || command.action === 'setResponses'
		? 'update responses'
		: `run ${command.action}`;
}

/**
 * The view's variable values, frozen for hand-out. The serializer's values are per-call
 * copies independent of the engine, so freezing them in place needs no clone of its own.
 */
function frozenValuesOf(
	variables: Record<string, SerializedItemSessionVariable>
): Readonly<Record<string, unknown>> {
	return Object.fromEntries(
		Object.entries(variables).map(([identifier, variable]) => [
			identifier,
			deepFreezeInPlace(variable.value),
		])
	);
}

/**
 * Freezes a dispatch's transition for hand-out. The previous and current views are deeply
 * frozen already (captureView, dispose) and freeze in place for free. The command and the
 * action result are engine output owned by this dispatch — the command is copied (it is the
 * caller's object and carries the candidate's submitted value), while the result's serialized
 * session state and validation/scoring results are per-call copies that freeze in place;
 * the memoized base-validation result is shared with the engine's memo, which never mutates
 * a result once built. What remains unfrozen are only the leaves no platform can freeze
 * (typed arrays), as everywhere else in the clone/freeze family.
 */
function freezeTransition(transition: ItemSessionTransition): ItemSessionTransition {
	return deepFreezeInPlace({
		...transition,
		command: frozenSnapshot(transition.command),
	});
}
