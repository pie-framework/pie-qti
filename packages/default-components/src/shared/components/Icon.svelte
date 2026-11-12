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

<!--
	Intrinsic size via width/height attributes (24 = 1.5rem at the default root size):
	a viewBox-only SVG has no intrinsic size, and without it the icon collapses to 0×0
	in WebKit once no CSS reaches it. Callers override through their own classes
	(w-4 h-4, w-6 h-6, …); CSS beats these presentation attributes everywhere.
	Parent-scoped rules cannot size this element — Svelte 5 does not forward the
	parent's scoping class to a child component's root.
-->
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" width="24" height="24" {part} class={className} aria-hidden="true" stroke={stroke} focusable={focusable}>
	<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" {d} />
</svg>
