<script lang="ts">
	/**
	 * A selectable hotspot region rendered as the SVG shape the QTI coords describe.
	 *
	 * Owns the per-shape geometry parsing (QTI 2.2/3.0 §3.4 shape/coords conventions) and the
	 * accessible widget attribute set (role, tabindex, aria-label, aria-pressed or aria-checked)
	 * plus the activation and drag events. Visual state is owned by the plugin: pass colors,
	 * classes, styles and data-attributes through `presentation`, which is spread onto the element.
	 *
	 * The shape is a button by default (a toggle button when `pressed` is given). With
	 * `role="radio"` it is one option of a radio group the caller renders around it: `checked`
	 * is its state, and `tabStop` lets the group keep a single Tab stop (roving tabindex).
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
		/** Accessible name of the hotspot control (ignored when not interactive). */
		label?: string;
		/** Removes the shape from the tab order (interaction is also gated by the handlers). */
		disabled?: boolean;
		/** 'button' (default), or 'radio' for one option of a caller-rendered radio group. */
		role?: 'button' | 'radio';
		/** Button only: mirrors selection state to assistive tech; omit when the shape has no pressed concept. */
		pressed?: boolean;
		/** Radio only: whether this option is the checked one (aria-checked). */
		checked?: boolean;
		/**
		 * Whether the shape is a Tab stop (default true). A radio group passes false for every
		 * option but one; those stay focusable by script, for the arrow keys.
		 */
		tabStop?: boolean;
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
		role = 'button',
		pressed = undefined,
		checked = false,
		tabStop = true,
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
		{role}
		aria-label={label}
		aria-pressed={role === 'button' ? pressed : undefined}
		aria-checked={role === 'radio' ? (checked ? 'true' : 'false') : undefined}
		tabindex={disabled || !tabStop ? -1 : 0}
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
