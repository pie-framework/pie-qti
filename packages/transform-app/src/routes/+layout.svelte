<script lang="ts">
	import '../app.css';
	import '@pie-qti/qti2-typeset-katex/css';
	import { onMount } from 'svelte';

	const { children } = $props();
	let theme = $state('light');

	const _themes = ['light', 'dark', 'cupcake', 'cyberpunk'];

	onMount(() => {
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
	<title>QTI to PIE Transformer</title>
</svelte:head>

<div class="h-screen flex flex-col bg-base-200">
	<!-- Theme Selector -->
	<div class="navbar bg-base-100 shadow-lg min-h-0 h-12">
		<div class="flex-1">
			<a href="/" class="btn btn-ghost btn-sm normal-case" data-testid="navbar-home">QTI Batch Processor</a>
		</div>
		<div class="flex-none gap-2">
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

	<div class="flex-1 min-h-0 overflow-auto">
		{@render children()}
	</div>
</div>
