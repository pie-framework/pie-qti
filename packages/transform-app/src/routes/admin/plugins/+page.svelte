<script lang="ts">
	import type { PageData } from './$types';
	import type { SvelteI18nProvider } from '@pie-qti/i18n';
	import { getContext } from 'svelte';

	let { data }: { data: PageData } = $props();
	const i18nContext = getContext<{ value: SvelteI18nProvider | undefined }>('i18n');
	const i18n = $derived(i18nContext?.value);

	// Use $derived to create reactive computed values
	const totalExtensions = $derived(
		Object.values(data.vendorExtensions).reduce(
			(sum: number, count: any) => sum + count,
			0
		)
	);
</script>

<svelte:head>
	<title>{i18n?.t('transform.admin.plugins.title') ?? 'Plugin Management'} - QTI Transform</title>
</svelte:head>

<!-- Page Header -->
<div class="hero bg-base-200 rounded-lg mb-8">
	<div class="hero-content text-center py-12">
		<div class="max-w-md">
			<h1 class="text-4xl font-bold">{(i18n?.t('transform.admin.plugins.title') ?? 'Plugin Management')}</h1>
			<p class="py-4">
			{(i18n?.t('transform.admin.plugins.subtitle') ?? 'View installed plugins and available extension points')}
			</p>
		</div>
	</div>
</div>

<!-- Stats Cards -->
<div class="stats stats-vertical lg:stats-horizontal shadow w-full mb-8">
	<div class="stat">
		<div class="stat-figure text-primary">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				class="inline-block h-8 w-8 stroke-current"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M13 10V3L4 14h7v7l9-11h-7z"
				></path>
			</svg>
		</div>
		<div class="stat-title">{(i18n?.t('transform.admin.plugins.totalPlugins') ?? 'Total Plugins')}</div>
		<div class="stat-value text-primary">{data.plugins.length}</div>
		<div class="stat-desc">
			{(i18n?.t('transform.admin.plugins.activePlugins') ?? 'All plugins active')}
		</div>
	</div>

	<div class="stat">
		<div class="stat-figure text-secondary">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				class="inline-block h-8 w-8 stroke-current"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
				></path>
			</svg>
		</div>
		<div class="stat-title">
			{(i18n?.t('transform.admin.plugins.vendorExtensions') ?? 'Vendor Extensions')}
		</div>
		<div class="stat-value text-secondary">{totalExtensions}</div>
		<div class="stat-desc">{(i18n?.t('transform.admin.plugins.extensionsRegistered') ?? 'Registered')}</div>
	</div>

	<div class="stat">
		<div class="stat-title">{(i18n?.t('transform.admin.plugins.storageBackend') ?? 'Storage Backend')}</div>
		<div class="stat-value text-sm">{data.storageInfo.backend}</div>
		<div class="stat-desc">{data.storageInfo.type}</div>
	</div>
</div>

<!-- Installed Plugins Table -->
<div class="card bg-base-100 shadow-xl mb-8">
	<div class="card-body">
		<h2 class="card-title">
			{(i18n?.t('transform.admin.plugins.installedPlugins') ?? 'Installed Transform Plugins')}
		</h2>
		<p class="text-sm opacity-70 mb-4">
			{(i18n?.t('transform.admin.plugins.pluginsDescription') ?? 'These plugins handle transformations between different formats')}
		</p>

		<div class="overflow-x-auto">
			<table class="table table-zebra">
				<thead>
					<tr>
						<th>{(i18n?.t('transform.admin.plugins.pluginName') ?? 'Plugin Name')}</th>
						<th>{(i18n?.t('transform.admin.plugins.format') ?? 'Format')}</th>
						<th>{(i18n?.t('transform.admin.plugins.priority') ?? 'Priority')}</th>
						<th>{(i18n?.t('transform.admin.plugins.version') ?? 'Version')}</th>
						<th>{(i18n?.t('transform.admin.plugins.status') ?? 'Status')}</th>
					</tr>
				</thead>
				<tbody>
					{#each data.plugins as plugin}
						<tr>
							<td>
								<div class="font-bold">{plugin.name}</div>
								<div class="text-sm opacity-50">{plugin.id}</div>
							</td>
							<td>
								<div class="flex items-center gap-2">
									<span class="badge badge-outline">{plugin.sourceFormat}</span>
									<span>→</span>
									<span class="badge badge-outline">{plugin.targetFormat}</span>
								</div>
							</td>
							<td>
								<span class="badge {plugin.priority >= 500 ? 'badge-warning' : 'badge-info'}">
									{plugin.priority}
								</span>
							</td>
							<td class="font-mono text-sm">{plugin.version}</td>
							<td>
								<span class="badge badge-success badge-sm">
									{(i18n?.t('transform.admin.plugins.active') ?? 'Active')}
								</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>

<!-- Vendor Extensions Overview -->
<div class="card bg-base-100 shadow-xl mb-8">
	<div class="card-body">
		<h2 class="card-title">
			{(i18n?.t('transform.admin.plugins.vendorExtensionPoints') ?? 'Vendor Extension Points')}
		</h2>
		<p class="text-sm opacity-70 mb-4">
		{(i18n?.t('transform.admin.plugins.extensionsDescription') ?? 'Vendor-specific extensions registered in plugins')}
		</p>

		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{#each Object.entries(data.vendorExtensions) as [type, count]}
				<div class="stat bg-base-200 rounded-lg">
					<div class="stat-title capitalize">{type}</div>
					<div class="stat-value text-primary text-3xl">{count}</div>
					<div class="stat-desc">
						{count === 0
							? i18n?.t('transform.admin.plugins.noExtensions') ?? 'No extensions'
							: i18n?.t('transform.admin.plugins.extensionsActive', { count }) ?? `${count} active`}
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>

<!-- Available Extension Points -->
<div class="card bg-base-100 shadow-xl mb-8">
	<div class="card-body">
		<h2 class="card-title">
			{(i18n?.t('transform.admin.plugins.availableExtensionPoints') ?? 'Available Extension Points')}
		</h2>
		<p class="text-sm opacity-70 mb-4">
			{(i18n?.t('transform.admin.plugins.configureExtensions') ?? 'Configure these via config.json or environment variables')}
		</p>

		<div class="space-y-2">
			<!-- Storage Backends -->
			<div class="collapse collapse-arrow bg-base-200">
				<input type="checkbox" />
				<div class="collapse-title font-medium">
					{(i18n?.t('transform.admin.plugins.storageBackends') ?? 'Storage Backends')} ({data.extensionPoints.storageBackends.length} available)
				</div>
				<div class="collapse-content">
					<div class="flex flex-wrap gap-2 pt-2">
						{#each data.extensionPoints.storageBackends as backend}
							<span class="badge badge-lg badge-outline">{backend}</span>
						{/each}
					</div>
					<p class="text-sm mt-3 opacity-70">
					{(i18n?.t('transform.admin.plugins.storageDescription') ?? 'Choose where to store sessions and transformed content')}
					</p>
				</div>
			</div>

			<!-- Transform Formats -->
			<div class="collapse collapse-arrow bg-base-200">
				<input type="checkbox" />
				<div class="collapse-title font-medium">
					{(i18n?.t('transform.admin.plugins.transformFormats') ?? 'Transform Formats')} ({data.extensionPoints.transformFormats.length} supported)
				</div>
				<div class="collapse-content">
					<div class="flex flex-wrap gap-2 pt-2">
						{#each data.extensionPoints.transformFormats as format}
							<span class="badge badge-lg badge-outline">{format}</span>
						{/each}
					</div>
					<p class="text-sm mt-3 opacity-70">
					{(i18n?.t('transform.admin.plugins.formatsDescription') ?? 'Supported input and output formats for transformations')}
					</p>
				</div>
			</div>

			<!-- Vendor Extension Types -->
			<div class="collapse collapse-arrow bg-base-200">
				<input type="checkbox" />
				<div class="collapse-title font-medium">
					{(i18n?.t('transform.admin.plugins.vendorExtensionTypes') ?? 'Vendor Extension Types')} ({data.extensionPoints.vendorExtensionTypes.length} types)
				</div>
				<div class="collapse-content">
					<div class="flex flex-wrap gap-2 pt-2">
						{#each data.extensionPoints.vendorExtensionTypes as extType}
							<span class="badge badge-lg badge-outline">{extType}</span>
						{/each}
					</div>
					<p class="text-sm mt-3 opacity-70">
					{(i18n?.t('transform.admin.plugins.vendorTypesDescription') ?? 'Customize transformation behavior for specific vendors')}
					</p>
				</div>
			</div>

			<!-- UI Themes -->
			<div class="collapse collapse-arrow bg-base-200">
				<input type="checkbox" />
				<div class="collapse-title font-medium">
					{(i18n?.t('transform.admin.plugins.uiThemes') ?? 'UI Themes')} ({data.extensionPoints.themes.length}
					available)
				</div>
				<div class="collapse-content">
					<div class="flex flex-wrap gap-2 pt-2">
						{#each data.extensionPoints.themes as theme}
							<span class="badge badge-lg badge-outline">{theme}</span>
						{/each}
					</div>
					<p class="text-sm mt-3 opacity-70">
					{(i18n?.t('transform.admin.plugins.themesDescription') ?? 'Customize the application appearance')}
					</p>
				</div>
			</div>

			<!-- Locales -->
			<div class="collapse collapse-arrow bg-base-200">
				<input type="checkbox" />
				<div class="collapse-title font-medium">
					{(i18n?.t('transform.admin.plugins.locales') ?? 'Locales')} ({data.extensionPoints.locales.length}
					supported)
				</div>
				<div class="collapse-content">
					<div class="flex flex-wrap gap-2 pt-2">
						{#each data.extensionPoints.locales as locale}
							<span class="badge badge-lg badge-outline">{locale}</span>
						{/each}
					</div>
					<p class="text-sm mt-3 opacity-70">
					{(i18n?.t('transform.admin.plugins.localesDescription') ?? 'Add translations for different languages')}
					</p>
				</div>
			</div>
		</div>
	</div>
</div>

<!-- Configuration Guide -->
<div class="alert alert-info shadow-lg">
	<svg
		xmlns="http://www.w3.org/2000/svg"
		fill="none"
		viewBox="0 0 24 24"
		class="h-6 w-6 shrink-0 stroke-current"
	>
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="2"
			d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
		></path>
	</svg>
	<div>
		<h3 class="font-bold">{(i18n?.t('transform.admin.plugins.howToConfigure') ?? 'How to Configure')}</h3>
		<div class="text-sm mt-2">
			<p class="mb-2">
			{(i18n?.t('transform.admin.plugins.configureVia') ?? 'Configure plugins and extensions through these methods:')}
			</p>
			<ul class="list-disc list-inside space-y-1 ml-2">
				<li>
					<strong>{(i18n?.t('transform.admin.plugins.envVar') ?? 'Environment variable')}:</strong>
					<code class="bg-base-300 px-2 py-1 rounded">PIE_QTI_CONFIG=/path/to/config.json</code>
				</li>
				<li>
					<strong>{(i18n?.t('transform.admin.plugins.configFile') ?? 'Config file')}:</strong>
					{(i18n?.t('transform.admin.plugins.seeExample') ?? 'See')}
					<code class="bg-base-300 px-2 py-1 rounded">config.example.json</code>
					{(i18n?.t('transform.admin.plugins.forStructure') ?? 'for structure')}
				</li>
				<li>
					<strong>{(i18n?.t('transform.admin.plugins.directCode') ?? 'Direct code')}:</strong>
					{(i18n?.t('transform.admin.plugins.registerIn') ?? 'Register in')}
					<code class="bg-base-300 px-2 py-1 rounded">src/hooks.server.ts</code>
				</li>
			</ul>
		</div>
	</div>
</div>
