<script lang="ts">
	import type { HottextInteractionData } from '../types/interactions';

	interface Props {
		interaction: HottextInteractionData;
		response: string[] | null;
		disabled: boolean;
		onChange: (value: string[]) => void;
	}

	let { interaction, response, disabled, onChange }: Props = $props();

	let selectedIds = $state<string[]>([]);

	$effect(() => {
		// Sync with parent response changes
		selectedIds = response ? [...response] : [];
	});
	let contentElement: HTMLDivElement | null = $state(null);

	/**
	 * Check if selection limit has been reached
	 */
	const canSelectMore = $derived(selectedIds.length < interaction.maxChoices);

	/**
	 * Check if a hottext element is selected
	 */
	function isSelected(identifier: string): boolean {
		return selectedIds.includes(identifier);
	}

	/**
	 * Handle hottext element click
	 */
	function handleHottextClick(identifier: string) {
		if (disabled) return;

		const currentlySelected = isSelected(identifier);

		if (currentlySelected) {
			// Deselect
			selectedIds = selectedIds.filter((id) => id !== identifier);
		} else if (canSelectMore) {
			// Select
			selectedIds = [...selectedIds, identifier];
		}

		onChange(selectedIds);
		updateHottextStyles();
	}

	/**
	 * Update visual styles of hottext elements based on selection state
	 */
	function updateHottextStyles() {
		if (!contentElement) return;

		const hottextElements = contentElement.querySelectorAll('hottext');
		hottextElements.forEach((elem: Element) => {
			const identifier = elem.getAttribute('identifier');
			if (identifier) {
				const htmlElem = elem as HTMLElement;
				const selected = isSelected(identifier);

				// Update classes
				if (selected) {
					htmlElem.classList.add('selected');
					htmlElem.classList.remove('selectable');
				} else {
					htmlElem.classList.remove('selected');
					if (canSelectMore && !disabled) {
						htmlElem.classList.add('selectable');
					} else {
						htmlElem.classList.remove('selectable');
					}
				}
			}
		});
	}

	/**
	 * Initialize hottext elements with click handlers
	 */
	$effect(() => {
		if (!contentElement) return;

		const hottextElements = contentElement.querySelectorAll('hottext');
		hottextElements.forEach((elem: Element) => {
			const identifier = elem.getAttribute('identifier');
			if (identifier) {
				const htmlElem = elem as HTMLElement;

				// Make it visually interactive
				htmlElem.style.cursor = disabled ? 'default' : 'pointer';
				htmlElem.style.padding = '2px 4px';
				htmlElem.style.borderRadius = '3px';
				htmlElem.style.transition = 'all 0.2s';

				// Add click handler
				htmlElem.onclick = () => handleHottextClick(identifier);
			}
		});

		updateHottextStyles();
	});

	/**
	 * Update styles when selection or disabled state changes
	 */
	$effect(() => {
		updateHottextStyles();
	});
</script>

<div class="qti-hottext-interaction space-y-3">
	{#if interaction.prompt}
		<p class="font-semibold">{interaction.prompt}</p>
	{/if}

	<div
		bind:this={contentElement}
		class="hottext-content prose max-w-none"
		role="group"
		aria-label="Text selection interaction"
	>
		{@html interaction.contentHtml}
	</div>

	<div class="flex items-center justify-between text-sm text-base-content/70">
		<div>
			<span class="font-medium">Selected:</span>
			<span class="ml-2">{selectedIds.length} / {interaction.maxChoices}</span>
		</div>

		{#if selectedIds.length > 0}
			<button
				type="button"
				class="btn btn-sm btn-ghost"
				onclick={() => {
					selectedIds = [];
					onChange(selectedIds);
					updateHottextStyles();
				}}
				{disabled}
			>
				Clear Selection
			</button>
		{/if}
	</div>
</div>

<style>
	:global(.hottext-content hottext) {
		display: inline;
		user-select: none;
	}

	:global(.hottext-content hottext.selectable) {
		background-color: hsl(var(--bc) / 0.1);
		border: 1px solid hsl(var(--bc) / 0.2);
	}

	:global(.hottext-content hottext.selectable:hover) {
		background-color: hsl(var(--p) / 0.2);
		border-color: hsl(var(--p) / 0.4);
	}

	:global(.hottext-content hottext.selected) {
		background-color: hsl(var(--p) / 0.3);
		border: 2px solid hsl(var(--p));
		font-weight: 600;
	}
</style>
