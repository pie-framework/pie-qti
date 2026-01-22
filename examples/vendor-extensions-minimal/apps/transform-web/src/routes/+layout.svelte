<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	let currentTheme = 'light';

	onMount(() => {
		const savedTheme = localStorage.getItem('theme') || 'light';
		currentTheme = savedTheme;
		document.documentElement.setAttribute('data-theme', savedTheme);
	});

	function changeTheme(theme: string) {
		currentTheme = theme;
		if (browser) {
			document.documentElement.setAttribute('data-theme', theme);
			localStorage.setItem('theme', theme);
		}
	}

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
		'examplecorp'
	];
</script>

<div class="min-h-screen flex flex-col">
	<!-- Navbar -->
	<div class="navbar bg-base-100 shadow-lg">
		<div class="flex-1">
			<a href="/" class="btn btn-ghost text-xl">
				<span class="font-bold">PIE-QTI</span>
				<span class="text-sm opacity-70 ml-2">Vendor Extensions Example</span>
			</a>
		</div>
		<div class="flex-none gap-2">
			<div class="dropdown dropdown-end">
				<div tabindex="0" role="button" class="btn btn-ghost btn-sm">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
						/>
					</svg>
					Theme
				</div>
				<ul class="menu dropdown-content bg-base-100 rounded-box z-[1] w-52 p-2 shadow-2xl mt-4">
					{#each themes as theme}
						<li>
							<button class:active={currentTheme === theme} onclick={() => changeTheme(theme)}>
								<span class="capitalize">{theme.replace('-', ' ')}</span>
							</button>
						</li>
					{/each}
				</ul>
			</div>
		</div>
	</div>

	<!-- Page content -->
	<main class="flex-grow">
		<slot />
	</main>

	<!-- Footer -->
	<footer class="footer footer-center p-4 bg-base-300 text-base-content">
		<aside>
			<p>Example PIE-QTI Vendor Extensions Project • <a href="https://github.com/pie-framework/pie-qti" class="link">Documentation</a></p>
		</aside>
	</footer>
</div>
