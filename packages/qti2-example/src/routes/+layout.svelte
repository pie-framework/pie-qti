<script lang="ts">
	import '../app.css';
	import '@pie-qti/qti2-typeset-katex/css';
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { page } from '$app/stores';

	const { children } = $props();
	let theme = $state('light');
	const currentPath = $derived($page.url.pathname);
	const isIframeRuntime = $derived(currentPath.startsWith(`${base}/iframe-runtime`));

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

	onMount(() => {
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
					<li><a href="{base}/docs" class:active={currentPath === `${base}/docs`}>Docs</a></li>
				</ul>
				<div class="dropdown dropdown-end">
					<div tabindex="0" role="button" class="btn btn-ghost" aria-label="Theme: {theme}">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							class="w-5 h-5 stroke-current"
							aria-hidden="true"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
							></path>
						</svg>
						<span class="hidden sm:inline">{theme}</span>
					</div>
					<ul
						class="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow-2xl"
					>
						{#each themes as themeName}
							<li>
								<button
									class="justify-start"
									class:active={theme === themeName}
									onclick={() => changeTheme(themeName)}
								>
									{themeName}
								</button>
							</li>
						{/each}
					</ul>
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
