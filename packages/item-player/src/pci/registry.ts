import type {
	PciCustomInteractionContext,
	PciRegistryObservation,
	QtiCustomInteractionRegistration,
} from './types.js';

/** The global name QTI 3.0 §6.1 reserves for the PCI registry. */
export const PCI_REGISTRY_GLOBAL = 'qtiCustomInteractionContext';

interface RegistryHost {
	[PCI_REGISTRY_GLOBAL]?: PciCustomInteractionContext;
}

/**
 * Install the page's `qtiCustomInteractionContext` and observe registrations.
 *
 * Conformant modules register as a side effect of their evaluation, so the runtime
 * installs the registry global before the host resolver evaluates a module and reads
 * the registration afterward. A context that already exists is preserved: registrations
 * made through it keep working, and new registrations land in both — one PCI
 * coordinator per page remains the sane assumption, but an existing global is never
 * broken by the player's install.
 */
export function installPciRegistry(target: object = globalThis): PciRegistryObservation {
	const host = target as RegistryHost;
	const registrations = new Map<string, QtiCustomInteractionRegistration>();
	const pending = new Map<string, Set<(registration: QtiCustomInteractionRegistration) => void>>();

	const register = (registration: QtiCustomInteractionRegistration): void => {
		if (!registration || typeof registration.getInstance !== 'function') return;
		const typeIdentifier = registration.typeIdentifier;
		if (typeof typeIdentifier !== 'string' || typeIdentifier.length === 0) return;
		registrations.set(typeIdentifier, registration);
		const waiters = pending.get(typeIdentifier);
		if (waiters) {
			pending.delete(typeIdentifier);
			for (const waiter of waiters) waiter(registration);
		}
	};

	const previous = host[PCI_REGISTRY_GLOBAL];
	if (previous && typeof previous.register === 'function') {
		const previousRegister = previous.register.bind(previous);
		host[PCI_REGISTRY_GLOBAL] = {
			register: (registration) => {
				register(registration);
				// A context installed before ours may keep its own bookkeeping.
				try {
					previousRegister(registration);
				} catch {
					// The observer's job is to see the registration, not to police another
					// context's reaction to it.
				}
			},
		};
	} else {
		const context: PciCustomInteractionContext = { register };
		host[PCI_REGISTRY_GLOBAL] = context;
	}

	return {
		whenRegistered(typeIdentifier) {
			const known = registrations.get(typeIdentifier);
			if (known) return Promise.resolve(known);
			return new Promise((resolve) => {
				const waiters = pending.get(typeIdentifier) ?? new Set();
				waiters.add(resolve);
				pending.set(typeIdentifier, waiters);
			});
		},
		registeredTypes() {
			return [...registrations.keys()];
		},
		dispose() {
			pending.clear();
		},
	};
}

/** The process-wide observation every PciHost uses unless it is given one. */
let sharedObservation: PciRegistryObservation | undefined;

export function getSharedPciRegistry(): PciRegistryObservation {
	sharedObservation ??= installPciRegistry(globalThis);
	return sharedObservation;
}
