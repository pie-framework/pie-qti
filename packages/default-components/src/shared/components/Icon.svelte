<script lang="ts">
	/**
	 * A shared inline stroke icon: 24×24, `fill="none"`, round caps and joins,
	 * stroke width 2. The path data lives once (see `icons.ts`); the caller
	 * passes its own part name, classes and any extra attributes, so what
	 * renders is exactly what its inline copy rendered.
	 */
	interface Props {
		/** The icon's path data, from `icons.ts`. */
		d: string;
		/** The shadow part name the interaction exposes. */
		part?: string;
		/** The classes the interaction styles the icon with. */
		class?: string;
		/** A stroke attribute on the `<svg>`, when the interaction set one. */
		stroke?: string;
		/** The legacy `focusable="false"` attribute, where the interaction set it. */
		focusable?: string;
	}

	let { d, part = 'icon', class: className = 'qti-icon', stroke, focusable }: Props = $props();
</script>

<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" {part} class={className} aria-hidden="true" stroke={stroke} focusable={focusable}>
	<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" {d} />
</svg>
