<script lang="ts">
	import GraphicGapMatch from '@pie-qti/qti2-default-components/shared/components/GraphicGapMatch.svelte';

	const gapTexts = [
		{ identifier: 'g1', text: 'Label A', matchMax: 1 },
		{ identifier: 'g2', text: 'Label B', matchMax: 1 },
	];

	const hotspots = [
		{ identifier: 'h1', shape: 'circle' as const, coords: '120,100,25', matchMax: 1 },
		{ identifier: 'h2', shape: 'circle' as const, coords: '280,100,25', matchMax: 1 },
	];

	const imageData = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" width="400" height="200">
  <rect x="0" y="0" width="400" height="200" fill="#ffffff"/>
  <circle cx="120" cy="100" r="28" fill="#e5e7eb" stroke="#9ca3af" stroke-width="2"/>
  <circle cx="280" cy="100" r="28" fill="#e5e7eb" stroke="#9ca3af" stroke-width="2"/>
  <text x="120" y="105" text-anchor="middle" font-family="system-ui" font-size="12" fill="#111827">H1</text>
  <text x="280" y="105" text-anchor="middle" font-family="system-ui" font-size="12" fill="#111827">H2</text>
</svg>`;

	let pairs = $state<string[]>([]);
</script>

<div class="space-y-3">
	<p class="text-sm text-base-content/70">
		Fixture for label placement accessibility (keyboard selection + placement onto hotspots).
	</p>

	<GraphicGapMatch
		{gapTexts}
		{hotspots}
		{pairs}
		{imageData}
		imageWidth="400"
		imageHeight="200"
		onPairsChange={(newPairs) => (pairs = newPairs)}
	/>
</div>


