<script lang="ts">
	
	import DrawingCanvas from '@pie-qti/qti2-default-components/shared/components/DrawingCanvas.svelte';
import type { QTIFileResponse } from '@pie-qti/qti2-item-player';

	const imageData = {
		type: 'svg' as const,
		width: '400',
		height: '200',
		content: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" width="400" height="200">
  <rect x="0" y="0" width="400" height="200" fill="#ffffff"/>
  <path d="M0 100H400" stroke="#e5e7eb" />
  <path d="M200 0V200" stroke="#e5e7eb" />
</svg>`,
	};

	let value = $state<QTIFileResponse | null>(null);
</script>

<div class="space-y-3">
	<p class="text-sm text-base-content/70">
		Fixture for pointer-based drawing + labeling/instructions.
	</p>

	<DrawingCanvas
		responseId="DRAW_1"
		label="Draw something (fixture)"
		{imageData}
		{value}
		onChange={(v) => (value = v)}
	/>
</div>


