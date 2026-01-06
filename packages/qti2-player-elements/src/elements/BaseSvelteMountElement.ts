import type { Component } from 'svelte';
import { mount, unmount } from 'svelte';

export abstract class BaseSvelteMountElement<TProps extends Record<string, unknown>> extends HTMLElement {
	protected abstract Component: Component<any>;
	protected abstract getProps(): TProps;

	#container: HTMLDivElement | null = null;
	protected _instance: any = null;

	connectedCallback() {
		this._mountOrUpdate();
	}

	disconnectedCallback() {
		this._teardownInstance();

		if (this.#container) {
			this.#container.remove();
			this.#container = null;
		}
	}

	protected _mountOrUpdate() {
		if (!this.#container) {
			this.#container = document.createElement('div');
			this.#container.style.display = 'contents';
			this.appendChild(this.#container);
		}

		const props = this.getProps();

		if (!this._instance) {
			this._instance = mount(this.Component, {
				target: this.#container as HTMLDivElement,
				props,
			});
			return;
		}

		// Svelte 5 `mount` returns an instance that may or may not have `$set`.
		// If it doesn't, remount.
		if (typeof this._instance?.$set === 'function') {
			this._instance.$set(props);
		} else {
			this._teardownInstance();
			this._mountOrUpdate();
		}
	}

	protected _teardownInstance() {
		if (this._instance) {
			try {
				unmount(this._instance);
			} catch {
				// ignore
			}
			this._instance = null;
		}
	}
}


