<script lang="ts">
	import type { QTIRole } from '@pie-qti/qti2-item-player';
	import { getContext } from 'svelte';
	import type { SvelteI18nProvider } from '@pie-qti/qti2-i18n';

	const i18nContext = getContext<{ value: SvelteI18nProvider | null }>('i18n');
	const i18n = $derived(i18nContext?.value);

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
		<h2 class="card-title">{i18n?.t('demo.settings') ?? 'Settings'}</h2>

		<!-- Role Selector -->
		<div class="form-control w-full">
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
					<span class="label-text font-semibold">{i18n?.t('demo.useBackendScoring') ?? 'Use Backend Scoring'}</span>
					<p class="label-text-alt text-xs">{i18n?.t('demo.scoreOnServer') ?? 'Score responses on the server instead of client-side'}</p>
				</div>
			</label>
		</div>

		<div class="divider"></div>

		<h3 class="font-semibold mb-2">{i18n?.t('demo.sessionManagement') ?? 'Session Management'}</h3>
		<div class="flex gap-2">
			<button
				class="btn btn-sm btn-outline flex-1"
				onclick={onSaveSession}
				disabled={isSaving || !hasPlayer}
			>
				{isSaving ? (i18n?.t('demo.saving') ?? 'Saving...') : (i18n?.t('demo.saveSession') ?? 'Save Session')}
			</button>
			<button class="btn btn-sm btn-outline flex-1" onclick={onLoadSession}>{i18n?.t('demo.loadSession') ?? 'Load Session'}</button>
		</div>
		{#if sessionId}
			<p class="text-xs text-base-content/70 mt-2">
				Current session: <code class="text-xs">{sessionId}</code>
			</p>
		{/if}

		<div class="divider"></div>

		<h3 class="font-semibold mb-2">{i18n?.t('demo.exportResponses') ?? 'Export Responses'}</h3>
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
				{i18n?.t('demo.json') ?? 'JSON'}
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
				{i18n?.t('demo.csv') ?? 'CSV'}
			</button>
		</div>

		<div class="divider"></div>

		{#if hasPlayer && Object.keys(templateVariables).length > 0}
			<h3 class="font-semibold mb-2">{i18n?.t('demo.templateProcessing') ?? 'Template Processing'}</h3>

			<div class="flex gap-2">
				<button
					class="btn btn-sm btn-outline flex-1"
					onclick={() => onRegenerateVariant?.()}
					disabled={!onRegenerateVariant}
					title={i18n?.t('demo.rerunTemplateProcessing') ?? 'Re-run templateProcessing and reset the item session'}
				>
					{i18n?.t('demo.regenerateVariant') ?? 'Regenerate Variant'}
				</button>
			</div>

			<details class="collapse collapse-arrow bg-base-200 mt-3">
				<summary class="collapse-title text-sm font-semibold">{i18n?.t('demo.templateVariablesDebug') ?? 'Template Variables (Debug)'}</summary>
				<div class="collapse-content">
					<div class="overflow-x-auto">
						<table class="table table-zebra">
							<thead>
								<tr>
									<th>{i18n?.t('demo.variable') ?? 'Variable'}</th>
									<th>{i18n?.t('demo.value') ?? 'Value'}</th>
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
			<summary class="collapse-title text-sm font-semibold">{i18n?.t('demo.keyboardShortcuts') ?? 'Keyboard Shortcuts'}</summary>
			<div class="collapse-content text-xs space-y-1">
				<div class="flex justify-between">
					<span class="text-base-content/70">{i18n?.t('demo.submitAnswersShortcut') ?? 'Submit answers'}</span>
					<kbd class="kbd kbd-xs">Ctrl</kbd> + <kbd class="kbd kbd-xs">Enter</kbd>
				</div>
				<div class="flex justify-between">
					<span class="text-base-content/70">{i18n?.t('demo.tryAgainShortcut') ?? 'Try again'}</span>
					<kbd class="kbd kbd-xs">Ctrl</kbd> + <kbd class="kbd kbd-xs">R</kbd>
				</div>
				<div class="flex justify-between">
					<span class="text-base-content/70">{i18n?.t('demo.exportJsonShortcut') ?? 'Export JSON'}</span>
					<kbd class="kbd kbd-xs">Ctrl</kbd> + <kbd class="kbd kbd-xs">E</kbd>
				</div>
				<div class="flex justify-between">
					<span class="text-base-content/70">{i18n?.t('demo.saveSessionShortcut') ?? 'Save session'}</span>
					<kbd class="kbd kbd-xs">Ctrl</kbd> + <kbd class="kbd kbd-xs">S</kbd>
				</div>
				<p class="text-xs text-base-content/50 mt-2">
					{@html i18n?.t('demo.useCmdOnMacOS') ?? 'Use <kbd class="kbd kbd-xs">Cmd</kbd> on macOS'}
				</p>
			</div>
		</details>
	</div>
</div>
