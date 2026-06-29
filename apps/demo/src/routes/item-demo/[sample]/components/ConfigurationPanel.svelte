<script lang="ts">
	import XmlEditor from '$lib/components/XmlEditor.svelte';
	import { SAMPLE_ITEMS } from '$lib/sample-items';
	import { hasMultilingualVariants } from '$lib/locale-aware-items';
	import { getContext } from 'svelte';
	import type { SvelteI18nProvider } from '@pie-qti/i18n';
	import type { QTIRole } from '@pie-qti/item-player';

	interface Props {
		selectedSampleId: string;
		xmlContent: string;
		selectedRole: QTIRole;
		onSampleChange: (id: string) => void;
		onXmlChange: (xml: string) => void;
		onRoleChange: (role: QTIRole) => void;
	}

	let { selectedSampleId = $bindable(), xmlContent = $bindable(), selectedRole = $bindable(), onSampleChange, onXmlChange, onRoleChange }: Props = $props();

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
	const conformanceItems = $derived(sortedItems.filter(item => item.group === 'conformance-qti22-advanced'));
	const nonI18nItems = $derived(sortedItems.filter(item => !hasMultilingualVariants(item.id) && item.group !== 'conformance-qti22-advanced'));
</script>

<div class="card bg-base-100 shadow-xl">
	<div class="card-body">

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
				{#if selectedSampleId === ''}
					<option value="">Custom Upload</option>
				{/if}
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
				{#if conformanceItems.length > 0}
					<optgroup label="QTI 2.2 Advanced Conformance">
						{#each conformanceItems as item}
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

		<!-- Role Selector -->
		<div class="form-control w-full mb-4">
			<label class="label" for="role-select">
				<span class="label-text font-semibold">{i18n?.t('demo.role') ?? 'Role'}</span>
			</label>
			<select
				id="role-select"
				class="select select-bordered w-full"
				bind:value={selectedRole}
				onchange={() => onRoleChange(selectedRole)}
			>
				<option value="candidate">{i18n?.t('demo.candidateStudent') ?? 'Candidate (Student)'}</option>
				<option value="scorer">{i18n?.t('demo.scorer') ?? 'Scorer'}</option>
				<option value="tutor">{i18n?.t('demo.tutor') ?? 'Tutor'}</option>
				<option value="author">{i18n?.t('demo.author') ?? 'Author'}</option>
				<option value="testConstructor">{i18n?.t('demo.testConstructor') ?? 'Test Constructor'}</option>
				<option value="proctor">{i18n?.t('demo.proctor') ?? 'Proctor'}</option>
			</select>
			<div class="label">
				<span class="label-text-alt text-xs">
					{i18n?.t('demo.controlsRubricVisibility') ?? 'Controls rubric visibility and correct answer display'}
				</span>
			</div>
		</div>

		<!-- XML Editor in collapsible block - open by default for custom uploads -->
		{#if selectedSampleId === ''}
			<!-- Always open for custom uploads -->
			<div class="bg-base-200 mt-4 rounded-lg p-4">
				<h3 class="text-lg font-medium mb-4">{i18n?.t('demo.xmlEditor') ?? 'XML Editor'}</h3>
				<XmlEditor bind:content={xmlContent} onContentChange={onXmlChange} />
			</div>
		{:else}
			<!-- Collapsible for sample items -->
			<details class="collapse collapse-arrow bg-base-200 mt-4">
				<summary class="collapse-title text-lg font-medium">
					{i18n?.t('demo.xmlEditor') ?? 'XML Editor'}
				</summary>
				<div class="collapse-content">
					<XmlEditor bind:content={xmlContent} onContentChange={onXmlChange} />
				</div>
			</details>
		{/if}
	</div>
</div>
