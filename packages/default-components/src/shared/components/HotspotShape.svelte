<script lang="ts">
	/**
	 * A selectable hotspot region rendered as the SVG shape the QTI coords describe.
	 *
	 * Owns the per-shape geometry parsing (QTI 2.2/3.0 §3.4 shape/coords conventions) and the
	 * accessible-button attribute set (role, tabindex, aria-label, aria-pressed) plus the
	 * activation and drag events. Visual state is owned by the plugin: pass colors, classes,
	 * styles and data-attributes through `presentation`, which is spread onto the element.
	 *
	 * With `interactive={false}` the shape is a purely visual layer (a halo or state outline
	 * drawn beneath the interactive shape): it is hidden from assistive technology, takes no
	 * focus and handles no events.
	 *
	 * Renders in the SVG namespace regardless of compile-time context, so it works both inside
	 * an `<svg>` tree and in a standalone component template.
	 */
	interface Props {
		/** QTI shape: 'circle' | 'ellipse' | 'poly' | 'rect'. */
		shape: string;
		/** QTI coords: circle 'cx,cy,r'; ellipse 'cx,cy,rx,ry'; rect 'left,top,right,bottom'; poly 'x1,y1,x2,y2,...'. */
		coords: string;
		/** Accessible name of the hotspot button (ignored when not interactive). */
		label?: string;
		/** Removes the shape from the tab order (interaction is also gated by the handlers). */
		disabled?: boolean;
		/** Mirrors selection state to assistive tech; omit when the shape has no pressed concept. */
		pressed?: boolean;
		/** False renders a visual-only layer: aria-hidden, unfocusable, no handlers. */
		interactive?: boolean;
		/** Visual state, spread onto the element: fill, stroke, class, style, data-* … */
		presentation?: Record<string, unknown>;
		onclick?: () => void;
		onkeydown?: (event: KeyboardEvent) => void;
		ondragover?: (event: DragEvent) => void;
		ondragleave?: (event: DragEvent) => void;
		ondrop?: (event: DragEvent) => void;
	}

	let {
		shape,
		coords,
		label = '',
		disabled = false,
		pressed = undefined,
		interactive = true,
		presentation = {},
		onclick,
		onkeydown,
		ondragover,
		ondragleave,
		ondrop,
	}: Props = $props();

	const numbers = $derived(coords.split(',').map(Number));

	const geometry = $derived.by<Record<string, unknown>>(() => {
		switch (shape) {
			case 'circle': {
				const [cx, cy, r] = numbers;
				return { cx, cy, r };
			}
			case 'ellipse': {
				const [cx, cy, rx, ry] = numbers;
				return { cx, cy, rx, ry };
			}
			case 'rect': {
				const [x, y, right, bottom] = numbers;
				return { x, y, width: right - x, height: bottom - y };
			}
			case 'poly': {
				const points = numbers
					.reduce((acc: string[], value: number, index: number) => {
						if (index % 2 === 0 && index + 1 < numbers.length) {
							acc.push(`${value},${numbers[index + 1]}`);
						}
						return acc;
					}, [])
					.join(' ');
				return { points };
			}
			default:
				return {};
		}
	});

	const tag = $derived(shape === 'poly' ? 'polygon' : shape);
</script>

{#if interactive}
	<svelte:element
		xmlns="http://www.w3.org/2000/svg"
		this={tag}
		{...geometry}
		{...presentation}
		role="button"
		aria-label={label}
		aria-pressed={pressed}
		tabindex={disabled ? -1 : 0}
		{onclick}
		{onkeydown}
		{ondragover}
		{ondragleave}
		{ondrop}
	/>
{:else}
	<svelte:element
		xmlns="http://www.w3.org/2000/svg"
		this={tag}
		{...geometry}
		{...presentation}
		aria-hidden="true"
	/>
{/if}
