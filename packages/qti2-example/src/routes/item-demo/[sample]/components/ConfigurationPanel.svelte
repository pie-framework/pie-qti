<script lang="ts">
	import XmlEditor from '$lib/components/XmlEditor.svelte';
	import { SAMPLE_ITEMS } from '$lib/sample-items';
	import { hasMultilingualVariants } from '$lib/locale-aware-items';
	import { getContext } from 'svelte';
	import type { SvelteI18nProvider } from '@pie-qti/qti2-i18n';

	interface Props {
		selectedSampleId: string;
		xmlContent: string;
		onSampleChange: (id: string) => void;
		onXmlChange: (xml: string) => void;
	}

	let { selectedSampleId = $bindable(), xmlContent = $bindable(), onSampleChange, onXmlChange }: Props = $props();

	// Get i18n from context
	const i18nContext = getContext<{ value: SvelteI18nProvider | null }>('i18n');
	const i18n = $derived(i18nContext?.value);

	// Filter out locale-specific variants (items with .locale suffix like "item.en-US")
	// The locale-aware loading system will automatically load the right language variant
	const baseItems = $derived(
		SAMPLE_ITEMS.filter((item) => {
			// Keep items that don't have a locale suffix pattern
			return !item.id.match(/\.(en-US|es-ES|fr-FR|nl-NL|ro-RO|th-TH|zh-CN|ar-SA)$/);
		})
	);

	// Sort items: i18n-enabled first, then the rest
	const sortedItems = $derived(
		[...baseItems].sort((a, b) => {
			const aHasI18n = hasMultilingualVariants(a.id);
			const bHasI18n = hasMultilingualVariants(b.id);

			// If both have i18n or both don't, maintain original order
			if (aHasI18n === bHasI18n) return 0;

			// i18n items come first
			return aHasI18n ? -1 : 1;
		})
	);

	const i18nItems = $derived(sortedItems.filter(item => hasMultilingualVariants(item.id)));
	const nonI18nItems = $derived(sortedItems.filter(item => !hasMultilingualVariants(item.id)));
</script>

<div class="card bg-base-100 shadow-xl">
	<div class="card-body">
		<h2 class="card-title">{i18n?.t('demo.xmlEditor') ?? 'XML Editor'}</h2>

		<div class="form-control w-full mb-4">
			<label class="label" for="sample-select">
				<span class="label-text">{i18n?.t('demo.selectSampleItem') ?? 'Select Sample Item'}</span>
			</label>
			<select
				id="sample-select"
				class="select select-bordered w-full"
				bind:value={selectedSampleId}
				onchange={() => onSampleChange(selectedSampleId)}
			>
				{#if i18nItems.length > 0}
					<optgroup label="🌐 Multilingual Items">
						{#each i18nItems as item}
							<option value={item.id}>
								🌐 {item.title}
							</option>
						{/each}
					</optgroup>
				{/if}
				{#if nonI18nItems.length > 0}
					<optgroup label="Other Items">
						{#each nonI18nItems as item}
							<option value={item.id}>
								{item.title}
							</option>
						{/each}
					</optgroup>
				{/if}
			</select>
			<div class="label">
				<span class="label-text-alt">
					{i18n?.t(`demo.sampleItemDescriptions.${selectedSampleId}`) ?? SAMPLE_ITEMS.find((item) => item.id === selectedSampleId)?.description}
				</span>
			</div>
		</div>

		<XmlEditor bind:content={xmlContent} onContentChange={onXmlChange} />
	</div>
</div>
