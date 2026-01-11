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

		// Example: Custom translations (optional)
		// Clients can provide complete locale bundles or override specific strings
		const customMessages = {
			// Example: Override specific strings for branding
			'en-US': {
				common: {
					submit: 'Send Answer',  // Custom submit button text
				}
			},
			// Example: Provide a complete custom locale bundle
			'pt-PT': {
				common: {
					submit: 'Submeter',
					next: 'Próximo',
					previous: 'Anterior',
				},
				assessment: {
					question: 'Questão {current} de {total}',
				}
			}
		};

		// Initialize i18n system with new architecture
		// Pass customMessages to provide your own translations or override defaults
		i18n = await createDefaultSvelteI18nProvider(savedLocale, customMessages);

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
		closeDropdown();
	}

	async function changeLocale(newLocale: LocaleCode) {
		if (i18n) {
			// setLocale now stores to localStorage and triggers page reload
			await i18n.setLocale(newLocale);
		}
		closeDropdown();
	}

	function closeDropdown() {
		// Remove focus from the dropdown trigger to close it
		if (document.activeElement instanceof HTMLElement) {
			document.activeElement.blur();
		}
	}

	const locales: { code: LocaleCode; label: string }[] = [
		// Framework-provided locales
		{ code: 'en-US', label: 'English (US)' },
		{ code: 'es-ES', label: 'Español' },
		{ code: 'fr-FR', label: 'Français' },
		{ code: 'nl-NL', label: 'Nederlands' },
		{ code: 'ro-RO', label: 'Română' },
		{ code: 'th-TH', label: 'ไทย' },
		// Example: Custom locale with client-provided translations
		{ code: 'pt-PT', label: 'Português (Portugal) [Custom]' },
	];
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
					PIE QTI 2.2 Player
				</a>
			</div>
			<div class="flex-none gap-2">
				<ul class="menu menu-horizontal px-1">
					<li><a href="{base}/" class:active={currentPath === `${base}/`}>Home</a></li>
					<li>
						<a href="{base}/item-demo" class:active={currentPath === `${base}/item-demo`}>Item Demo</a>
					</li>
					<li>
						<a
							href="{base}/assessment-demo"
							class:active={currentPath === `${base}/assessment-demo`}
							>Assessment Demo</a
						>
					</li>
					<li>
						<a
							href="{base}/likert-demo"
							class:active={currentPath === `${base}/likert-demo`}
							>Likert Plugin Demo</a
						>
					</li>
					<li>
						<a href="{base}/iframe-demo" class:active={currentPath === `${base}/iframe-demo`}>Iframe Demo</a>
					</li>
				</ul>
				<!-- Settings Menu -->
				<div class="dropdown dropdown-end">
					<div tabindex="0" role="button" class="btn btn-ghost btn-circle" aria-label="Settings">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							class="w-5 h-5 stroke-current"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
							/>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
							/>
						</svg>
					</div>
					<div class="dropdown-content bg-base-100 rounded-box z-[1] w-80 p-4 shadow-2xl">
						<!-- Language Section -->
						<div class="mb-4">
							<h3 class="flex items-center gap-2 text-sm font-semibold mb-2 px-2">
								<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="w-4 h-4 stroke-current">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
								</svg>
								Language
							</h3>
							<div class="max-h-64 overflow-y-auto">
								<ul class="menu menu-compact">
									{#each locales as loc}
										<li>
											<button
												class="justify-between"
												class:active={currentLocale === loc.code}
												onclick={() => changeLocale(loc.code)}
											>
												<span>{loc.label}</span>
												{#if currentLocale === loc.code}
													<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
														<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
													</svg>
												{/if}
											</button>
										</li>
									{/each}
								</ul>
							</div>
						</div>

						<div class="divider my-2"></div>

						<!-- Theme Section -->
						<div>
							<h3 class="flex items-center gap-2 text-sm font-semibold mb-2 px-2">
								<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="w-4 h-4 stroke-current">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
								</svg>
								Theme
							</h3>
							<div class="max-h-64 overflow-y-auto">
								<ul class="menu menu-compact">
									{#each themes as themeName}
										<li>
											<button
												class="justify-between"
												class:active={theme === themeName}
												onclick={() => changeTheme(themeName)}
											>
												<span>{themeName}</span>
												{#if theme === themeName}
													<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
														<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
													</svg>
												{/if}
											</button>
										</li>
									{/each}
								</ul>
							</div>
						</div>
					</div>
				</div>
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
