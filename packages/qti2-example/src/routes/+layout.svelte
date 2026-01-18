<script lang="ts">
	import '../app.css';
	import '@pie-qti/qti2-typeset-katex/css';
	import { onMount, setContext } from 'svelte';
	import { browser } from '$app/environment';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import {
		createDefaultSvelteI18nProvider,
		type SvelteI18nProvider,
		type LocaleCode
	} from '@pie-qti/qti2-i18n';
	import SettingsMenu from '$lib/components/SettingsMenu.svelte';

	const { children } = $props();
	let theme = $state('light');
	let i18n = $state<SvelteI18nProvider | null>(null);
	let currentLocale = $state<LocaleCode>('en-US');
	const currentPath = $derived($page.url.pathname);
	const isIframeRuntime = $derived(currentPath.startsWith(`${base}/iframe-runtime`));

	// Provide i18n to child components via Svelte context
	// Use a getter to make it reactive - captures the current value of i18n
	setContext('i18n', {
		get value() {
			return i18n;
		}
	});

	// All standard DaisyUI themes + custom high contrast theme
	const themes = [
		'light',
		'dark',
		'cupcake',
		'bumblebee',
		'emerald',
		'corporate',
		'synthwave',
		'retro',
		'cyberpunk',
		'valentine',
		'halloween',
		'garden',
		'forest',
		'aqua',
		'lofi',
		'pastel',
		'fantasy',
		'wireframe',
		'black',
		'luxury',
		'dracula',
		'cmyk',
		'autumn',
		'business',
		'acid',
		'lemonade',
		'night',
		'coffee',
		'winter',
		'dim',
		'nord',
		'sunset',
		'high-contrast', // WCAG AAA compliant high contrast theme
	];

	onMount(async () => {
		// Load saved locale from localStorage or use default
		// pie-qti-locale is managed by SvelteI18nProvider
		const savedLocale = (localStorage.getItem('pie-qti-locale') as LocaleCode) || 'en-US';
		currentLocale = savedLocale;

		// Initialize i18n system
		i18n = await createDefaultSvelteI18nProvider(savedLocale);

		// Register QTI player web components on the client only.
		// This module touches browser globals (customElements/window) and must not run during prerender/SSR.
		if (browser) {
			void import('@pie-qti/qti2-default-components/plugins');
		}

		// Load saved theme from localStorage
		const savedTheme = localStorage.getItem('theme') || 'light';
		theme = savedTheme;
		document.documentElement.setAttribute('data-theme', theme);
	});

	function changeTheme(newTheme: string) {
		theme = newTheme;
		document.documentElement.setAttribute('data-theme', theme);
		localStorage.setItem('theme', theme);
	}

	async function changeLocale(newLocale: LocaleCode) {
		if (i18n) {
			// setLocale stores to localStorage and triggers page reload
			await i18n.setLocale(newLocale);
		}
	}
</script>

<svelte:head>
	<title>PIE QTI 2.2 Player</title>
</svelte:head>

{#if isIframeRuntime}
	<!-- Runtime pages should look like “just the player”, not the full demo app shell. -->
	<main class="min-h-screen bg-base-200" aria-label="Main content">
		{@render children()}
	</main>
{:else}
	<!-- Skip link for keyboard navigation -->
	<a
		href="#main-content"
		class="skip-link"
	>
		Skip to main content
	</a>

	<div class="min-h-screen flex flex-col bg-base-200">
		<!-- Navigation -->
		<nav class="navbar bg-base-100 shadow-lg" role="banner" aria-label="Main navigation">
			<div class="flex-1">
				<a href="{base}/" class="btn btn-ghost normal-case text-xl">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
						/>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					{i18n?.t('demo.appName') ?? 'PIE QTI 2.2 Player'}
				</a>
			</div>
			<div class="flex-none gap-2">
				<ul class="menu menu-horizontal px-1">
					<li><a href="{base}/" class:active={currentPath === `${base}/`}>{i18n?.t('demo.home') ?? 'Home'}</a></li>
					<li>
						<a href="{base}/item-demo" class:active={currentPath === `${base}/item-demo`}>{i18n?.t('demo.itemDemo') ?? 'Item Demo'}</a>
					</li>
					<li>
						<a
							href="{base}/assessment-demo"
							class:active={currentPath === `${base}/assessment-demo`}
							>{i18n?.t('demo.assessmentDemo') ?? 'Assessment Demo'}</a
						>
					</li>
					<li>
						<a
							href="{base}/likert-demo"
							class:active={currentPath === `${base}/likert-demo`}
							>{i18n?.t('demo.likertDemo') ?? 'Likert Plugin Demo'}</a
						>
					</li>
					<li>
						<a href="{base}/iframe-demo" class:active={currentPath === `${base}/iframe-demo`}>{i18n?.t('demo.iframeDemo') ?? 'Iframe Demo'}</a>
					</li>
				</ul>
				<!-- Settings Menu -->
				<SettingsMenu
					{i18n}
					{currentLocale}
					{theme}
					onLocaleChange={changeLocale}
					onThemeChange={changeTheme}
					availableThemes={themes}
				/>
			</div>
		</nav>

		<!-- Main Content -->
		<main id="main-content" class="flex-1" aria-label="Main content">
			{@render children()}
		</main>
	</div>
{/if}

<style>
	/* Skip link styles - only visible when focused */
	.skip-link {
		position: absolute;
		top: -40px;
		left: 0;
		background: hsl(var(--p));
		color: hsl(var(--pc));
		padding: 8px 16px;
		text-decoration: none;
		font-weight: 600;
		z-index: 9999;
		border-radius: 0 0 4px 0;
	}

	.skip-link:focus {
		top: 0;
		outline: 2px solid hsl(var(--pf));
		outline-offset: 2px;
	}

	/* Style for active navigation items */
	.menu a.active {
		background-color: hsl(var(--p) / 0.1);
		color: hsl(var(--p));
		font-weight: 600;
	}
</style>
