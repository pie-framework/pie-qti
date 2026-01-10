<script lang="ts">
/**
 * Reusable drag handle icon component
 * Displays horizontal bars to indicate draggable items
 */

interface Props {
	/** Size in rem units. Default: 1rem (16px) */
	size?: number;
	/** Opacity level. Default: 0.5 */
	opacity?: number;
	/** Additional CSS classes */
	class?: string;
}

const { size = 1, opacity = 0.5, class: className = '' }: Props = $props();

const sizeInRem = `${size}rem`;
const opacityStyle = opacity;
</script>

<svg
	class="qti-drag-handle {className}"
	part="drag-handle"
	style="width: {sizeInRem}; height: {sizeInRem}; opacity: {opacityStyle};"
	fill="none"
	stroke="currentColor"
	viewBox="0 0 24 24"
	aria-hidden="true"
>
	<path
		stroke-linecap="round"
		stroke-linejoin="round"
		stroke-width="2"
		d="M4 8h16M4 16h16"
	/>
</svg>

<style>
	.qti-drag-handle {
		flex: 0 0 auto;
		display: inline-block;
	}
</style>
