<script lang="ts">
	/**
	 * PIE Item Player with mode/role controls
	 *
	 * Wraps the pie-iife-player and pie-esm-player web components with
	 * control UI for switching player types, modes, and roles.
	 */
	import { onMount } from 'svelte';

	type PlayerType = 'iife' | 'esm';
	type PlayerMode = 'gather' | 'view' | 'evaluate' | 'browse';
	type PlayerRole = 'student' | 'instructor';

	interface Props {
		/** PIE configuration object */
		config: any;
		/** Optional title to display above the player */
		title?: string;
		/** Optional description to display below the title */
		description?: string;
		/** Show debug panel with config JSON */
		showDebug?: boolean;
	}

	let { config, title, description, showDebug = false }: Props = $props();

	let playerType = $state<PlayerType>('iife');
	let env = $state<{ mode: PlayerMode; role: PlayerRole }>({ mode: 'gather', role: 'student' });
	let session = $state({ id: 'preview', data: [] as any[] });
	let isLoaded = $state(false);

	// Register custom elements in browser only (SSR-safe)
	onMount(async () => {
		if (typeof window !== 'undefined') {
			try {
				// Dynamically import PIE players
				await import('@pie-framework/pie-iife-player');
				await import('@pie-framework/pie-esm-player');
				isLoaded = true;
			} catch (error) {
				console.error('Failed to load PIE players:', error);
			}
		}
	});

	function clearSession() {
		session = { id: 'preview', data: [] };
	}
</script>

<div class="flex flex-col gap-4">
	<!-- Control bar matching pie-players example pattern -->
	<div class="flex items-center justify-between gap-4 p-4 border border-base-300 rounded-lg bg-base-200">
		<!-- Left side: Player selection and Mode buttons -->
		<div class="flex items-center gap-4">
			<!-- Player selection dropdown -->
			<div class="flex items-center gap-2">
				<label for="player-select" class="text-sm font-medium">player:</label>
				<select
					id="player-select"
					class="select select-bordered select-sm w-28"
					bind:value={playerType}
					aria-label="Select player type"
				>
					<option value="iife">IIFE</option>
					<option value="esm">ESM</option>
				</select>
			</div>

			<!-- Mode radio buttons -->
			<div class="flex items-center gap-2">
				<label class="flex items-center gap-1 cursor-pointer">
					<input
						type="radio"
						name="mode"
						value="gather"
						checked={env.mode === 'gather'}
						onchange={() => (env = { ...env, mode: 'gather' })}
						class="radio radio-sm"
					/>
					<span class="text-sm">Gather</span>
				</label>
				<label class="flex items-center gap-1 cursor-pointer">
					<input
						type="radio"
						name="mode"
						value="view"
						checked={env.mode === 'view'}
						onchange={() => (env = { ...env, mode: 'view' })}
						class="radio radio-sm"
					/>
					<span class="text-sm">View</span>
				</label>
				<label class="flex items-center gap-1 cursor-pointer">
					<input
						type="radio"
						name="mode"
						value="evaluate"
						checked={env.mode === 'evaluate'}
						onchange={() => (env = { ...env, mode: 'evaluate' })}
						class="radio radio-sm"
					/>
					<span class="text-sm">Evaluate</span>
				</label>
				<label class="flex items-center gap-1 cursor-pointer">
					<input
						type="radio"
						name="mode"
						value="browse"
						checked={env.mode === 'browse'}
						onchange={() => (env = { ...env, mode: 'browse' })}
						class="radio radio-sm"
					/>
					<span class="text-sm">Browse</span>
				</label>
			</div>
		</div>

		<!-- Right side: Role radio buttons and actions -->
		<div class="flex items-center gap-4">
			<!-- Role radio buttons -->
			<div class="flex items-center gap-2">
				<label class="flex items-center gap-1 cursor-pointer">
					<input
						type="radio"
						name="role"
						value="student"
						checked={env.role === 'student'}
						onchange={() => (env = { ...env, role: 'student' })}
						class="radio radio-sm"
					/>
					<span class="text-sm">Student</span>
				</label>
				<label class="flex items-center gap-1 cursor-pointer">
					<input
						type="radio"
						name="role"
						value="instructor"
						checked={env.role === 'instructor'}
						onchange={() => (env = { ...env, role: 'instructor' })}
						class="radio radio-sm"
					/>
					<span class="text-sm">Instructor</span>
				</label>
			</div>

			<!-- Clear session button -->
			<button class="btn btn-sm btn-ghost" onclick={() => clearSession()}>
				Clear
			</button>
		</div>
	</div>

	<!-- Title section (if provided) -->
	{#if title}
		<div>
			<h2 class="text-2xl font-bold">{title}</h2>
			{#if description}
				<p class="text-sm opacity-80">{description}</p>
			{/if}
		</div>
	{/if}

	<!-- Player content area -->
	<div class="rounded-lg border border-base-300 bg-base-200 p-6 min-h-[400px]">
		{#if !isLoaded}
			<div class="flex items-center justify-center h-64">
				<span class="loading loading-spinner loading-lg"></span>
			</div>
		{:else if playerType === 'iife'}
			<pie-iife-player
				config={JSON.stringify(config)}
				session={JSON.stringify(session)}
				env={JSON.stringify(env)}
			></pie-iife-player>
		{:else if playerType === 'esm'}
			<pie-esm-player
				config={JSON.stringify(config)}
				session={JSON.stringify(session)}
				env={JSON.stringify(env)}
			></pie-esm-player>
		{/if}
	</div>

	<!-- Debug section (collapsible, optional) -->
	{#if showDebug}
		<details class="collapse collapse-arrow bg-base-200 border border-base-300">
			<summary class="collapse-title text-sm font-medium">Debug: config JSON</summary>
			<div class="collapse-content">
				<pre class="text-xs overflow-auto max-h-72">{JSON.stringify(config, null, 2)}</pre>
			</div>
		</details>
	{/if}
</div>
