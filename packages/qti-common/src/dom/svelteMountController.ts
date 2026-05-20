export interface SvelteMountControllerOptions<TProps, TInstance> {
	host: HTMLElement;
	mount: (target: HTMLElement, props: TProps) => TInstance;
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
 * Svelte 5 runes components do not expose `$set`, so updates fall back to one
 * microtask-scheduled remount. Coalescing here prevents synchronous remount
 * loops in custom element setters and attribute callbacks.
 */
export function createSvelteMountController<TProps, TInstance>({
	host,
	mount,
	unmount,
	createContainer = defaultContainer,
}: SvelteMountControllerOptions<TProps, TInstance>): SvelteMountController<TProps, TInstance> {
	let container: HTMLElement | null = null;
	let instance: TInstance | null = null;
	let pendingRemount = false;
	let latestProps: TProps | null = null;

	function ensureContainer() {
		if (!container) {
			container = createContainer();
			host.appendChild(container);
		}
		return container;
	}

	function mountFresh(props: TProps) {
		latestProps = props;
		instance = mount(ensureContainer(), props);
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

		const set = (instance as SettableSvelteInstance<TProps>).$set;
		if (typeof set === 'function') {
			set.call(instance, props);
			return;
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

function defaultContainer() {
	const container = document.createElement('div');
	container.style.display = 'contents';
	return container;
}
