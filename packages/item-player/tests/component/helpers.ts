import { flushSync, mount, unmount } from 'svelte';

/** Flush Svelte's effects and let pending microtasks settle before asserting on the DOM. */
export async function settle(): Promise<void> {
	flushSync();
	await new Promise((resolve) => setTimeout(resolve, 0));
	flushSync();
}

export interface Mounted {
	host: HTMLElement;
	instance: Record<string, unknown>;
	destroy(): void;
}

/** Mount a component into a fresh host attached to the document. */
export function mountInto(component: Parameters<typeof mount>[0], props: Record<string, unknown>): Mounted {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const instance = mount(component, { target: host, props }) as Record<string, unknown>;
	return {
		host,
		instance,
		destroy() {
			unmount(instance as never);
			host.remove();
		},
	};
}
