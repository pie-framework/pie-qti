<script lang="ts">
	import { onMount } from 'svelte';
	import Qti2ItemPlayer from '$lib/components/Qti2ItemPlayer.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	const session = $derived(data.session);

	interface ItemInfo {
		id: string;
		title: string;
		filePath: string;
		interactions: string[];
		url: string;
		xml?: string;
	}

	let items = $state<ItemInfo[]>([]);
	let selectedItemIndex = $state(0);
	let _isLoadingItems = $state(true);
	let _itemsError = $state<string | null>(null);
	let _showCorrectResponses = $state(false);

	const _selectedItem = $derived(items[selectedItemIndex]);

	onMount(async () => {
		await loadItems();
	});

	async function loadItems() {
		_isLoadingItems = true;
		_itemsError = null;

		try {
			const response = await fetch(`/api/sessions/${session.id}/items`);

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'Failed to load items');
			}

			const result = await response.json();
			items = result.items;
		} catch (error) {
			console.error('Failed to load items:', error);
			_itemsError = error instanceof Error ? error.message : 'Failed to load items';
		} finally {
			_isLoadingItems = false;
		}
	}

	function _selectItem(index: number) {
		selectedItemIndex = index;
		_showCorrectResponses = false;
	}
</script>

<div class="min-h-screen bg-base-200" data-testid="items-page">
	<div class="mx-auto w-full max-w-screen-2xl p-4">
		<!-- Header -->
		<div class="flex items-center justify-between mb-6">
			<div>
				<div class="breadcrumbs text-sm">
					<ul>
						<li><a href="/" data-testid="items-breadcrumb-home">Home</a></li>
						<li><a href="/session/{session.id}" data-testid="items-breadcrumb-session">Session {session.id.slice(0, 8)}</a></li>
						<li data-testid="items-breadcrumb-items">Items</li>
					</ul>
				</div>
				<h1 class="text-3xl font-bold" data-testid="items-title">Item Browser</h1>
				<p class="text-base-content/60 mt-2">
					Browse and preview {session.analysis?.totalItems || 0} QTI assessment items
				</p>
			</div>
		</div>

		{#if _isLoadingItems}
			<div class="flex items-center justify-center p-12">
				<span class="loading loading-spinner loading-lg"></span>
				<span class="ml-4 text-lg">Loading items...</span>
			</div>
		{:else if _itemsError}
			<div class="alert alert-error">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="stroke-current shrink-0 h-6 w-6"
					fill="none"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<span>{_itemsError}</span>
			</div>
		{:else if items.length === 0}
			<div class="alert alert-info">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="stroke-current shrink-0 h-6 w-6"
					fill="none"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<span>No items found in this session.</span>
			</div>
		{:else}
			<!-- Split Panel Layout -->
			<div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
				<!-- Left Panel: Item List -->
				<div class="lg:col-span-4">
					<div class="card bg-base-100 shadow-xl">
						<div class="card-body p-4">
							<h2 class="card-title text-lg mb-2">Items ({items.length})</h2>

							<div class="overflow-y-auto max-h-[calc(100vh-250px)]">
								<div class="space-y-2">
									{#each items as item, index}
										<button
											class="w-full text-left p-3 rounded-lg transition-colors {index ===
											selectedItemIndex
												? 'bg-primary text-primary-content'
												: 'bg-base-200 hover:bg-base-300'}"
											onclick={() => _selectItem(index)}
											data-testid={"item-select-" + index}
										>
											<div class="font-semibold text-sm">{item.title}</div>
											<div class="text-xs opacity-80 mt-1">
												{item.interactions.join(', ')}
											</div>
										</button>
									{/each}
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Right Panel: Item Preview -->
				<div class="lg:col-span-8">
					<div class="card bg-base-100 shadow-xl">
						<div class="card-body">
							<div class="flex items-center justify-between mb-4">
								<div>
									<h2 class="card-title" data-testid="selected-item-title">{_selectedItem?.title}</h2>
									<div class="flex flex-wrap gap-2 mt-2">
										{#each _selectedItem?.interactions || [] as interaction}
											<span class="badge badge-primary badge-sm">{interaction}</span>
										{/each}
									</div>
								</div>

								<div class="form-control">
									<label class="label cursor-pointer gap-2">
										<span class="label-text">Show Correct</span>
										<input
											type="checkbox"
											class="toggle toggle-primary"
											bind:checked={_showCorrectResponses}
										/>
									</label>
								</div>
							</div>

							<div class="divider"></div>

							<!-- QTI Player -->
							{#if _selectedItem && _selectedItem.xml}
								<div class="bg-base-200 rounded-lg p-4">
									{#key _selectedItem.id}
										<Qti2ItemPlayer
											itemXml={_selectedItem.xml}
											identifier={_selectedItem.id}
											title={_selectedItem.title}
											role={_showCorrectResponses ? 'scorer' : 'candidate'}
										/>
									{/key}
								</div>
							{:else if _selectedItem}
								<div class="alert alert-warning">
									<span>Item XML not available (has xml: {_selectedItem.xml ? 'yes' : 'no'})</span>
								</div>
							{:else}
								<div class="alert alert-info">
									<span>No item selected</span>
								</div>
							{/if}
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
