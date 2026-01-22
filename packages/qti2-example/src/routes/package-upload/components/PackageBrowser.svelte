<script lang="ts">
	import { goto } from '$app/navigation';
	import ItemList from './ItemList.svelte';
	import TestList from './TestList.svelte';

	export let packageData: {
		packageId: string;
		items: Array<{ identifier: string; href: string; title?: string }>;
		tests: Array<{ identifier: string; href: string; title?: string }>;
		assets: {
			images: string[];
			styles: string[];
			audio: string[];
			video: string[];
			passages: string[];
		};
	};

	function viewItem(event: CustomEvent<[item: { identifier: string; href: string }]>) {
		const item = event.detail[0];
		goto(`/package-upload/${packageData.packageId}/item/${item.identifier}`);
	}

	function viewTest(event: CustomEvent<[test: { identifier: string; href: string }]>) {
		const test = event.detail[0];
		goto(`/package-upload/${packageData.packageId}/test/${test.identifier}`);
	}
</script>

<div class="space-y-6">
	<!-- Package Summary -->
	<div class="stats stats-vertical lg:stats-horizontal shadow w-full">
		<div class="stat">
			<div class="stat-title">Items</div>
			<div class="stat-value text-primary">{packageData.items.length}</div>
			<div class="stat-desc">QTI assessment items</div>
		</div>

		<div class="stat">
			<div class="stat-title">Tests</div>
			<div class="stat-value text-secondary">{packageData.tests.length}</div>
			<div class="stat-desc">QTI assessments</div>
		</div>

		<div class="stat">
			<div class="stat-title">Assets</div>
			<div class="stat-value">
				{packageData.assets.images.length + packageData.assets.styles.length +
					packageData.assets.audio.length + packageData.assets.video.length}
			</div>
			<div class="stat-desc">
				{packageData.assets.images.length} images, {packageData.assets.styles.length} styles
			</div>
		</div>
	</div>

	<!-- Items List -->
	{#if packageData.items.length > 0}
		<ItemList items={packageData.items} on:view={viewItem} />
	{/if}

	<!-- Tests List -->
	{#if packageData.tests.length > 0}
		<TestList tests={packageData.tests} on:view={viewTest} />
	{/if}
</div>
