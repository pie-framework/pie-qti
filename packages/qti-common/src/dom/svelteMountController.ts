export interface SvelteMountControllerOptions<TProps, TInstance> {
	host: HTMLElement;
	mount: (target: HTMLElement, props: TProps) => TInstance;
	/** Svelte 5's createSubscriber, supplied by the browser adapter's runtime. */
	createSubscriber?: (start: (update: () => void) => () => void) => () => void;
	unmount: (instance: TInstance) => void | Promise<void>;
	createContainer?: () => HTMLElement;
}

export interface SvelteMountController<TProps, TInstance> {
	readonly instance: TInstance | null;
	readonly mounted: boolean;
	mountOrUpdate(props: TProps): TInstance | null;
	update(props: TProps): void;
	teardown(options?: { removeContainer?: boolean }): void;
}

type SettableSvelteInstance<TProps> = {
	$set?: (props: TProps) => void;
};

/**
 * Owns Svelte custom-element mount policy in one place.
 *
 * Svelte 5 adapters supply createSubscriber to track shallow reactive props so a
 * response update preserves the component, input focus, and local state.
 * The $set/remount fallback remains for existing callers without that bridge.
 */
export function createSvelteMountController<TProps, TInstance>({
	host,
	mount,
	createSubscriber,
	unmount,
	createContainer = defaultContainer,
}: SvelteMountControllerOptions<TProps, TInstance>): SvelteMountController<TProps, TInstance> {
	let container: HTMLElement | null = null;
	let instance: TInstance | null = null;
	let pendingRemount = false;
	let latestProps: TProps | null = null;
	let notifyProps: (() => void) | undefined;
	const trackProps = createSubscriber?.((update) => {
		notifyProps = update;
		return () => { notifyProps = undefined; };
	});
	// Track reads without deep-proxying externally owned sessions and providers.
	const reactiveProps = trackProps ? new Proxy({}, {
		get(_target, key) {
			trackProps();
			return Reflect.get(latestProps as object, key);
		},
		has(_target, key) {
			trackProps();
			return Reflect.has(latestProps as object, key);
		},
		ownKeys() {
			trackProps();
			return Reflect.ownKeys(latestProps as object);
		},
		getOwnPropertyDescriptor(_target, key) {
			trackProps();
			return Reflect.has(latestProps as object, key)
				? { configurable: true, enumerable: true }
				: undefined;
		},
	}) as TProps : undefined;

	function ensureContainer() {
		if (!container) {
			container = createContainer();
			host.appendChild(container);
		}
		return container;
	}

	function mountFresh(props: TProps) {
		latestProps = props;
		instance = mount(ensureContainer(), reactiveProps ?? props);
		return instance;
	}

	function scheduleRemount() {
		if (pendingRemount) return;
		pendingRemount = true;
		queueMicrotask(() => {
			pendingRemount = false;
			if (!host.isConnected || !container || latestProps === null) return;
			teardownInstance();
			mountFresh(latestProps);
		});
	}

	function teardownInstance() {
		if (!instance) return;
		try {
			void unmount(instance);
		} catch {
			// Unmount should not make custom-element disconnection throw.
		}
		instance = null;
	}

	function mountOrUpdate(props: TProps) {
		latestProps = props;
		if (!instance) {
			return mountFresh(props);
		}
		update(props);
		return instance;
	}

	function update(props: TProps) {
		latestProps = props;
		if (!instance) return;
		if (trackProps) {
			notifyProps?.();
			return;
		}

		const set = (instance as SettableSvelteInstance<TProps>).$set;
		if (typeof set === 'function') {
			try {
				set.call(instance, props);
				return;
			} catch (error) {
				if (!isSvelteComponentApiChanged(error)) throw error;
			}
		}

		scheduleRemount();
	}

	function teardown(options: { removeContainer?: boolean } = {}) {
		pendingRemount = false;
		teardownInstance();
		if (options.removeContainer ?? true) {
			container?.remove();
			container = null;
		}
	}

	return {
		get instance() {
			return instance;
		},
		get mounted() {
			return instance !== null;
		},
		mountOrUpdate,
		update,
		teardown,
	};
}

function isSvelteComponentApiChanged(error: unknown): error is Error {
	return error instanceof Error && error.message.includes('https://svelte.dev/e/component_api_changed');
}

function defaultContainer() {
	const container = document.createElement('div');
	container.style.display = 'contents';
	return container;
}
