declare namespace svelteHTML {
	interface HTMLAttributes<T> {
		onclick?: (event: MouseEvent) => void;
		onchange?: (event: Event) => void;
		oninput?: (event: Event) => void;
		onsubmit?: (event: Event) => void;
		onkeydown?: (event: KeyboardEvent) => void;
		onkeyup?: (event: KeyboardEvent) => void;
		onmousedown?: (event: MouseEvent) => void;
		onmouseup?: (event: MouseEvent) => void;
		onmousemove?: (event: MouseEvent) => void;
		onmouseenter?: (event: MouseEvent) => void;
		onmouseleave?: (event: MouseEvent) => void;
		onfocus?: (event: FocusEvent) => void;
		onblur?: (event: FocusEvent) => void;
		ondragstart?: (event: DragEvent) => void;
		ondragend?: (event: DragEvent) => void;
		ondragover?: (event: DragEvent) => void;
		ondragleave?: (event: DragEvent) => void;
		ondrop?: (event: DragEvent) => void;
	}
}

declare module 'svelte/elements' {
	interface HTMLButtonAttributes {
		onclick?: (event: MouseEvent) => void;
		onmousedown?: (event: MouseEvent) => void;
		onmouseup?: (event: MouseEvent) => void;
		onmouseenter?: (event: MouseEvent) => void;
		onmouseleave?: (event: MouseEvent) => void;
		onfocus?: (event: FocusEvent) => void;
		onblur?: (event: FocusEvent) => void;
	}

	interface HTMLAttributes<T = HTMLElement> {
		onclick?: (event: MouseEvent) => void;
		onchange?: (event: Event) => void;
		oninput?: (event: Event) => void;
		onsubmit?: (event: Event) => void;
		onkeydown?: (event: KeyboardEvent) => void;
		onkeyup?: (event: KeyboardEvent) => void;
		onmousedown?: (event: MouseEvent) => void;
		onmouseup?: (event: MouseEvent) => void;
		onmousemove?: (event: MouseEvent) => void;
		onmouseenter?: (event: MouseEvent) => void;
		onmouseleave?: (event: MouseEvent) => void;
		onfocus?: (event: FocusEvent) => void;
		onblur?: (event: FocusEvent) => void;
		ondragstart?: (event: DragEvent) => void;
		ondragend?: (event: DragEvent) => void;
		ondragover?: (event: DragEvent) => void;
		ondragleave?: (event: DragEvent) => void;
		ondrop?: (event: DragEvent) => void;
	}
}
