<script lang="ts">
	import type { QTIRole } from '@pie-qti/qti2-item-player';

	interface Props {
		selectedRole: QTIRole;
		useBackendScoring: boolean;
		sessionId: string | null;
		isSaving: boolean;
		hasPlayer: boolean;
		templateVariables?: Record<string, any>;
		onRegenerateVariant?: () => void;
		onRoleChange: (role: QTIRole) => void;
		onBackendScoringChange: (enabled: boolean) => void;
		onSaveSession: () => void;
		onLoadSession: () => void;
		onExport: (format: 'json' | 'csv') => void;
	}

	let {
		selectedRole = $bindable(),
		useBackendScoring = $bindable(),
		sessionId,
		isSaving,
		hasPlayer,
		templateVariables = {},
		onRegenerateVariant,
		onRoleChange,
		onBackendScoringChange,
		onSaveSession,
		onLoadSession,
		onExport,
	}: Props = $props();
</script>

<div class="card bg-base-100 shadow-xl">
	<div class="card-body">
		<h2 class="card-title">Settings</h2>

		<!-- Role Selector -->
		<div class="form-control w-full">
			<label class="label" for="role-select">
				<span class="label-text font-semibold">Role</span>
			</label>
			<select
				id="role-select"
				class="select select-bordered w-full"
				bind:value={selectedRole}
				onchange={() => onRoleChange(selectedRole)}
			>
				<option value="candidate">Candidate (Student)</option>
				<option value="scorer">Scorer</option>
				<option value="tutor">Tutor</option>
				<option value="author">Author</option>
				<option value="testConstructor">Test Constructor</option>
				<option value="proctor">Proctor</option>
			</select>
			<div class="label">
				<span class="label-text-alt text-xs">
					Controls rubric visibility and correct answer display
				</span>
			</div>
		</div>

		<div class="divider"></div>

		<div class="form-control">
			<label class="label cursor-pointer justify-start gap-4">
				<input
					type="checkbox"
					class="checkbox checkbox-primary"
					bind:checked={useBackendScoring}
					onchange={() => onBackendScoringChange(useBackendScoring)}
				/>
				<div>
					<span class="label-text font-semibold">Use Backend Scoring</span>
					<p class="label-text-alt text-xs">Score responses on the server instead of client-side</p>
				</div>
			</label>
		</div>

		<div class="divider"></div>

		<h3 class="font-semibold mb-2">Session Management</h3>
		<div class="flex gap-2">
			<button
				class="btn btn-sm btn-outline flex-1"
				onclick={onSaveSession}
				disabled={isSaving || !hasPlayer}
			>
				{isSaving ? 'Saving...' : 'Save Session'}
			</button>
			<button class="btn btn-sm btn-outline flex-1" onclick={onLoadSession}>Load Session</button>
		</div>
		{#if sessionId}
			<p class="text-xs text-base-content/70 mt-2">
				Current session: <code class="text-xs">{sessionId}</code>
			</p>
		{/if}

		<div class="divider"></div>

		<h3 class="font-semibold mb-2">Export Responses</h3>
		<div class="flex gap-2">
			<button class="btn btn-sm btn-outline flex-1" onclick={() => onExport('json')} disabled={!hasPlayer}>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-4 w-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
					/>
				</svg>
				JSON
			</button>
			<button class="btn btn-sm btn-outline flex-1" onclick={() => onExport('csv')} disabled={!hasPlayer}>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-4 w-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
					/>
				</svg>
				CSV
			</button>
		</div>

		<div class="divider"></div>

		{#if hasPlayer && Object.keys(templateVariables).length > 0}
			<h3 class="font-semibold mb-2">Template Processing</h3>

			<div class="flex gap-2">
				<button
					class="btn btn-sm btn-outline flex-1"
					onclick={() => onRegenerateVariant?.()}
					disabled={!onRegenerateVariant}
					title="Re-run templateProcessing and reset the item session"
				>
					Regenerate Variant
				</button>
			</div>

			<details class="collapse collapse-arrow bg-base-200 mt-3">
				<summary class="collapse-title text-sm font-semibold">Template Variables (Debug)</summary>
				<div class="collapse-content">
					<div class="overflow-x-auto">
						<table class="table table-zebra">
							<thead>
								<tr>
									<th>Variable</th>
									<th>Value</th>
								</tr>
							</thead>
							<tbody>
								{#each Object.entries(templateVariables) as [key, value]}
									<tr>
										<td class="font-mono">{key}</td>
										<td class="font-mono">{JSON.stringify(value)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</details>

			<div class="divider"></div>
		{/if}

		<details class="collapse collapse-arrow bg-base-200">
			<summary class="collapse-title text-sm font-semibold">Keyboard Shortcuts</summary>
			<div class="collapse-content text-xs space-y-1">
				<div class="flex justify-between">
					<span class="text-base-content/70">Submit answers</span>
					<kbd class="kbd kbd-xs">Ctrl</kbd> + <kbd class="kbd kbd-xs">Enter</kbd>
				</div>
				<div class="flex justify-between">
					<span class="text-base-content/70">Try again</span>
					<kbd class="kbd kbd-xs">Ctrl</kbd> + <kbd class="kbd kbd-xs">R</kbd>
				</div>
				<div class="flex justify-between">
					<span class="text-base-content/70">Export JSON</span>
					<kbd class="kbd kbd-xs">Ctrl</kbd> + <kbd class="kbd kbd-xs">E</kbd>
				</div>
				<div class="flex justify-between">
					<span class="text-base-content/70">Save session</span>
					<kbd class="kbd kbd-xs">Ctrl</kbd> + <kbd class="kbd kbd-xs">S</kbd>
				</div>
				<p class="text-xs text-base-content/50 mt-2">
					Use <kbd class="kbd kbd-xs">Cmd</kbd> on macOS
				</p>
			</div>
		</details>
	</div>
</div>
