import { mount, unmount } from 'svelte';
import { createSvelteMountController, type SvelteMountController } from '@pie-qti/qti-common';

export abstract class BaseSvelteMountElement<TProps extends Record<string, unknown>> extends HTMLElement {
	protected abstract Component: any;
	protected abstract getProps(): TProps;

	#mountController: SvelteMountController<TProps, any> | null = null;

	protected get _instance() {
		return this.#mountController?.instance ?? null;
	}

	connectedCallback() {
		this._mountOrUpdate();
	}

	disconnectedCallback() {
		this._teardownInstance();
	}

	protected _mountOrUpdate() {
		this.#controller().mountOrUpdate(this.getProps());
	}

	protected _teardownInstance() {
		this.#mountController?.teardown({ removeContainer: true });
	}

	#controller() {
		if (!this.#mountController) {
			this.#mountController = createSvelteMountController({
				host: this,
				mount: (target, props) =>
					mount(this.Component, {
						target,
						props,
					}),
				unmount,
			});
		}
		return this.#mountController;
	}
}


