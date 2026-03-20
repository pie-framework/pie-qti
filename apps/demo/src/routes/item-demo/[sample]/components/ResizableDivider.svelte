<script lang="ts">
	interface Props {
		isDragging: boolean;
		leftPanelWidth: number;
		onMouseDown: (e: MouseEvent) => void;
		onKeyDown: (e: KeyboardEvent) => void;
	}

	let { isDragging, leftPanelWidth, onMouseDown, onKeyDown }: Props = $props();
</script>

<div
	class="hidden xl:block w-1 bg-base-300 hover:bg-primary cursor-col-resize transition-colors relative"
	class:bg-primary={isDragging}
	onmousedown={onMouseDown}
	onkeydown={onKeyDown}
	role="slider"
	aria-orientation="vertical"
	aria-label="Resize panels"
	aria-valuenow={Math.round(leftPanelWidth)}
	aria-valuemin="20"
	aria-valuemax="80"
	tabindex="0"
>
	<div class="absolute inset-y-0 -left-1 -right-1"></div>
</div>
