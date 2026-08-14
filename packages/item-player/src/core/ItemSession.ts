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
import { createPlayerFromPreparedInternal, Player } from './Player.js';

export interface OpenItemSessionOptions {
	/** Restore a previously serialized state before applying response overrides. */
	restore?: SerializedItemSessionState;
	/** Initial responses, or overrides applied after restore. */
	responses?: Readonly<Record<string, unknown>>;
	/** Resume a suspended handoff as an active interaction session. */
	activate?: boolean;
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
	'outcomeValues' | 'responses' | 'role' | 'source'
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
	getComponentRegistry(): ItemSessionComponentRegistry;
	getDeliveryContext(): ResolvedItemDeliveryContext | undefined;
	getSecurityConfig(): PlayerSecurityConfig | undefined;
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
	private revision = 0;
	private disposed = false;
	private currentView: ItemSessionView;
	private readonly runtimeBinding: ItemSessionBinding;

	/** @internal Construct sessions through AssessmentItemDefinition.openSession(). */
	constructor(
		private readonly itemIdentifier: string,
		config: ItemSessionEngineConfig,
		options: OpenItemSessionOptions = {},
		prepared?: unknown,
	) {
		this.defaultRole = config.role ?? 'candidate';
		const playerConfig = { ...config };
		this.player = prepared
			? createPlayerFromPreparedInternal(playerConfig, prepared, Boolean(options.restore))
			: new Player(playerConfig);

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
		return immutableSnapshot(this.currentView);
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
		return transition;
	}

	present(view: ItemPresentationView = {}): ItemPresentation {
		this.assertActive();
		return createItemPresentation({
			...view,
			disabled:
				view.disabled === true || !isResponseWritableLifecycle(this.currentView.lifecycleStatus),
			source: {
				itemBodyHtml: this.player.getItemBodyHtml(),
				interactions: this.player.getInteractionData(),
				correctResponses: this.player.getCorrectResponses(),
				componentRegistry: this.player.getComponentRegistry(),
				deliveryContext: this.player.getDeliveryContext(),
				pnp: this.player.getPnp(),
				security: this.player.getSecurityConfig(),
				directRubrics: this.player.getRubrics({ scope: 'direct' }),
			},
			responses: immutableSnapshot(this.currentView.responses),
			outcomeValues: immutableSnapshot(this.currentView.outcomes),
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
		return immutableSnapshot(this.player.saveItemSession());
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
		this.currentView = immutableSnapshot({
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

	private captureView(serialized = this.player.saveItemSession()): ItemSessionView {
		const responses = valuesOf(serialized.responseVariables);
		return immutableSnapshot({
			revision: this.revision,
			itemIdentifier: serialized.itemIdentifier || this.itemIdentifier || undefined,
			role: this.defaultRole,
			lifecycleStatus: serialized.lifecycleStatus,
			completionStatus: serialized.completionStatus,
			numAttempts: serialized.numAttempts,
			duration: serialized.duration,
			adaptive: this.player.isAdaptive(),
			completed: this.player.isCompleted(),
			canSubmit: this.player.canSubmitResponses(responses),
			disposed: this.disposed,
			responses,
			outcomes: valuesOf(serialized.outcomeVariables),
			templates: valuesOf(serialized.templateVariables),
			context: valuesOf(serialized.contextVariables),
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

	private notify(transition: ItemSessionTransition): void {
		for (const listener of [...this.listeners]) {
			try {
				listener(immutableSnapshot(transition));
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
		if (unknown) throw new Error(`Unknown response identifier '${unknown}'`);
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

function valuesOf(
	variables: Record<string, SerializedItemSessionVariable>
): Readonly<Record<string, unknown>> {
	return Object.fromEntries(
		Object.entries(variables).map(([identifier, variable]) => [
			identifier,
			immutableSnapshot(variable.value),
		])
	);
}

function freezeTransition(transition: ItemSessionTransition): ItemSessionTransition {
	return immutableSnapshot(transition);
}

/** Clone and freeze plain data without mutating values owned by the caller or a PCI module. */
function immutableSnapshot<T>(value: T): T {
	if (Array.isArray(value)) {
		return Object.freeze(value.map((entry) => immutableSnapshot(entry))) as T;
	}
	if (!value || typeof value !== 'object') return value;
	if (ArrayBuffer.isView(value)) return structuredClone(value);
	if (value instanceof ArrayBuffer) return value.slice(0) as T;
	const prototype = Object.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null) return value;
	const snapshot = Object.fromEntries(
		Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
			key,
			immutableSnapshot(entry),
		])
	);
	return Object.freeze(snapshot) as T;
}
