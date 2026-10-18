import { flushSync, mount, unmount } from 'svelte';

/**
 * Flush Svelte's effect queue and let pending microtasks (async handlers,
 * FileReader callbacks) settle before asserting on the rendered DOM.
 */
export async function settle(): Promise<void> {
	flushSync();
	await new Promise((resolve) => setTimeout(resolve, 0));
}

export interface MountedInteraction<T = Record<string, unknown>> {
	/** Wrapper element the component is mounted to (kept in the document, removed on cleanup). */
	host: HTMLElement;
	/** Svelte 5 component instance: exposes bindable props such as `response`. */
	instance: T;
	/** Every `qti-change` event that bubbled out of the component. */
	events: CustomEvent[];
}

/**
 * Mount an interaction component with Svelte's runtime and record the
 * `qti-change` events it emits — the same contract the custom-element wrapper
 * forwards to host players.
 */
export function mountInteraction<P extends Record<string, unknown> = Record<string, unknown>>(
	component: Parameters<typeof mount>[0],
	props: P,
): MountedInteraction {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const events: CustomEvent[] = [];
	host.addEventListener('qti-change', (event) => events.push(event as CustomEvent));
	const instance = mount(component, { target: host, props }) as Record<string, unknown>;
	return { host, instance, events };
}

export function cleanupInteraction(...mounted: Array<MountedInteraction>): void {
	for (const m of mounted) {
		unmount(m.instance as never);
		m.host.remove();
	}
}

/** Query inside the mounted component. */
export function q<T extends Element = Element>(
	mounted: { host: HTMLElement },
	selector: string,
): T | null {
	return mounted.host.querySelector<T>(selector);
}

/** Query all matches inside the mounted component. */
export function qa<T extends Element = Element>(
	mounted: { host: HTMLElement },
	selector: string,
): T[] {
	return Array.from(mounted.host.querySelectorAll<T>(selector));
}

/** Simulate a user changing a checkbox/radio input. */
export function check(input: HTMLInputElement, checked: boolean): void {
	input.checked = checked;
	input.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Simulate a user typing into a text field. */
export function type(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
	input.value = value;
	input.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Simulate a key press with a real KeyboardEvent (cancelable, like a user's). */
export function pressKey(target: Element, key: string): void {
	target.dispatchEvent(
		new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
	);
}

/**
 * Wait until a condition holds, polling with short timeouts — for asynchronous
 * callbacks such as FileReader results that settle outside Svelte's queue.
 */
export async function waitFor(condition: () => boolean, timeoutMs = 500): Promise<void> {
	const start = Date.now();
	while (!condition()) {
		if (Date.now() - start > timeoutMs) {
			throw new Error('waitFor: condition was not met within the timeout');
		}
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
}
