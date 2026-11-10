/**
 * The session-side PCI host registry: the PciHost a mounted custom interaction uses,
 * its response write-back into the session's declarations, and teardown.
 */
import type { BaseType, Cardinality, DeclarationMap, QtiValue } from '@pie-qti/qti-processing';
import type { ItemLifecycleStatus } from '../types/index.js';
import { PciHost } from './PciHost.js';
import type { ExtractedPci, PciConfiguration, PciInteractionStatus } from './types.js';

/** What the PCI session registry reads from the session engine. */
export interface PciSessionContext {
	readonly pci?: PciConfiguration;
	readonly decls: DeclarationMap;
	/** The session's lifecycle stage, read when a module reports a response. */
	lifecycleStatus(): ItemLifecycleStatus;
	/** The QTI 3.0 §6.1 interaction status a host instantiates with. */
	interactionStatus(): PciInteractionStatus;
	contentLanguage(): string | undefined;
	coerceToDeclarationValue(
		baseType: BaseType | undefined,
		cardinality: Cardinality,
		raw: unknown,
		identifier?: string,
	): QtiValue;
}

/**
 * The PciHosts of one item session, by response identifier. Created as presentation
 * mounts custom interactions; destroyed with the session.
 */
export class PciHostSession {
	private readonly hosts = new Map<string, PciHost>();

	get(responseIdentifier: string): PciHost | undefined {
		return this.hosts.get(responseIdentifier);
	}

	/**
	 * Create a PciHost for an extracted PCI and register it for response tracking.
	 * The caller is responsible for calling host.load() and
	 * host.initialize(domNode) once the DOM element is available.
	 */
	create(data: ExtractedPci, context: PciSessionContext): PciHost {
		const host = new PciHost(data, {
			baseUrl: context.pci?.baseUrl,
			moduleResolver: context.pci?.moduleResolver,
			sandbox: context.pci?.sandbox,
			modulePolicy: context.pci?.modulePolicy,
			responseDeclaration: (() => {
				const d = context.decls[data.responseIdentifier];
				return d ? { baseType: d.baseType, cardinality: d.cardinality } : undefined;
			})(),
			status: () => context.interactionStatus(),
			contentLanguage: context.contentLanguage(),
		});

		// Wire response changes back into the player's declaration context
		host.onResponseChange((responseId: string, value: unknown) => {
			if (context.lifecycleStatus() !== 'initial' && context.lifecycleStatus() !== 'interacting') return;
			const d = context.decls[responseId];
			if (d) {
				d.value = context.coerceToDeclarationValue(d.baseType, d.cardinality, value, d.identifier);
			}
		});

		this.hosts.set(data.responseIdentifier, host);
		return host;
	}

	/**
	 * Offer a response value to the PCI identified by responseIdentifier. A
	 * mounted module that has already reported a response keeps it.
	 */
	offer(responseIdentifier: string, value: unknown): void {
		this.hosts.get(responseIdentifier)?.offerResponse(value);
	}

	/**
	 * Authoritatively replace a PCI's response, discarding in-progress candidate
	 * state. Session restore and reset-to-default use this.
	 */
	restore(responseIdentifier: string, value: unknown): void {
		this.hosts.get(responseIdentifier)?.restore(value);
	}

	/** Destroy all PCI hosts. Call on session teardown. */
	destroyAll(): void {
		for (const host of this.hosts.values()) {
			host.destroy();
		}
		this.hosts.clear();
	}
}
