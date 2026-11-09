import { mount, unmount } from 'svelte';
import { createSubscriber } from 'svelte/reactivity';
import { createSvelteMountController, type SvelteMountController } from '@pie-qti/qti-common';

const HTMLElementBase: typeof HTMLElement = globalThis.HTMLElement ?? (class {} as typeof HTMLElement);

export abstract class BaseSvelteMountElement<
	TProps extends Record<string, unknown>,
	// The mounted component's exported instance API. Elements that proxy imperative
	// calls through the component (see QtiAssessmentPlayerElement's shell façade) pass
	// a real interface here so a moved or renamed export fails to compile instead of
	// silently no-oping through `any`.
	TInstance = any,
> extends HTMLElementBase {
	protected abstract Component: any;
	protected abstract getProps(): TProps;
	protected readonly reactiveProps: boolean = true;

	#mountController: SvelteMountController<TProps, TInstance> | null = null;

	protected get _instance(): TInstance | null {
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
			this.#mountController = createSvelteMountController<TProps, TInstance>({
				host: this,
				createSubscriber: this.reactiveProps ? createSubscriber : undefined,
				mount: (target, props) =>
					// Svelte's mount returns the component's exported instance API; the
					// element declares that shape as TInstance.
					mount(this.Component, {
						target,
						props,
					}) as TInstance,
				unmount: (instance) => unmount(instance as Record<string, any>),
			});
		}
		return this.#mountController;
	}
}
