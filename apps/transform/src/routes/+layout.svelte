<script lang="ts">
	import '../app.css';
	import '@pie-qti/typeset-katex/css';
	import { onMount, setContext } from 'svelte';
	import { createDefaultSvelteI18nProvider, type SvelteI18nProvider, type LocaleCode } from '@pie-qti/i18n';

	const { children } = $props();
	let theme = $state('light');
	let i18n = $state<SvelteI18nProvider | null>(null);

	const _themes = ['light', 'dark', 'cupcake', 'cyberpunk'];

	// Provide i18n to child components via Svelte context
	// Use a getter to make it reactive - captures the current value of i18n
	setContext('i18n', {
		get value() {
			return i18n;
		}
	});

	onMount(async () => {
		// Load saved locale from localStorage or use default
		// pie-qti-locale is managed by SvelteI18nProvider
		const savedLocale = (localStorage.getItem('pie-qti-locale') as LocaleCode) || 'en-US';

		// Initialize i18n system
		i18n = await createDefaultSvelteI18nProvider(savedLocale);

		// Load saved theme from localStorage
		const savedTheme = localStorage.getItem('theme') || 'light';
		theme = savedTheme;
		document.documentElement.setAttribute('data-theme', theme);
	});

	function _changeTheme(newTheme: string) {
		theme = newTheme;
		document.documentElement.setAttribute('data-theme', theme);
		localStorage.setItem('theme', theme);
	}
</script>

<svelte:head>
	<title>{i18n?.t('transform.appName') ?? 'QTI Batch Processor'}</title>
</svelte:head>

<div class="h-screen flex flex-col bg-base-200">
	<!-- Theme Selector -->
	<div class="navbar bg-base-100 shadow-lg min-h-0 h-12">
		<div class="flex-1">
			<a href="/" class="btn btn-ghost btn-sm normal-case" data-testid="navbar-home">{i18n?.t('transform.appName') ?? 'QTI Batch Processor'}</a>
		</div>
		<div class="flex-none gap-2">
			<a href="/admin/plugins" class="btn btn-ghost btn-sm">
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="w-4 h-4 stroke-current">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
				</svg>
				<span class="hidden sm:inline">Plugins</span>
			</a>
			<div class="dropdown dropdown-end">
				<div tabindex="0" role="button" class="btn btn-ghost btn-sm">
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="w-4 h-4 stroke-current">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"></path>
					</svg>
					<span class="hidden sm:inline text-sm">{theme}</span>
				</div>
				<ul class="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow-2xl">
					{#each _themes as themeName}
						<li>
							<button
								class="btn btn-ghost btn-sm justify-start"
								class:btn-active={theme === themeName}
								onclick={() => _changeTheme(themeName)}
							>
								{themeName}
							</button>
						</li>
					{/each}
				</ul>
			</div>
		</div>
	</div>

	<main class="flex-1 min-h-0 overflow-auto" id="main-content">
		{@render children()}
	</main>
</div>
