<script lang="ts">
	import type { QtiCompatibilityReport, QtiDiagnosticIssue } from '$lib/qti-diagnostics';

	interface Props {
		report: QtiCompatibilityReport | null;
		compact?: boolean;
	}

	let { report, compact = false }: Props = $props();

	const statusTone = $derived(
		report?.status === 'blocked'
			? 'badge-error'
			: report?.status === 'usable-with-warnings'
				? 'badge-warning'
				: 'badge-success'
	);
	const statusLabel = $derived(
		report?.status === 'blocked'
			? 'Blocked'
			: report?.status === 'usable-with-warnings'
				? 'Usable with warnings'
				: 'Ready'
	);

	function issueClass(issue: QtiDiagnosticIssue): string {
		switch (issue.severity) {
			case 'error':
				return 'alert-error';
			case 'warning':
				return 'alert-warning';
			case 'success':
				return 'alert-success';
			default:
				return 'alert-info';
		}
	}
</script>

{#if report}
	<section class="card bg-base-100 shadow-xl" aria-labelledby="qti-diagnostics-title">
		<div class="card-body gap-4">
			<div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
				<div>
					<p class="text-xs uppercase tracking-wide text-base-content/60">Import compatibility</p>
					<h2 id="qti-diagnostics-title" class="card-title">QTI diagnostics</h2>
					<p class="text-sm text-base-content/70">
						Checks this item against the standard player, extraction registry, response processing path, package assets, and public certification coverage.
					</p>
				</div>
				<div class="badge {statusTone} badge-lg" role="status" aria-live="polite">{statusLabel}</div>
			</div>

			<div class="grid grid-cols-2 gap-3 md:grid-cols-5">
				<div class="rounded-box bg-base-200 p-3">
					<div class="text-xs text-base-content/60">QTI version</div>
					<div class="font-semibold">{report.version}</div>
				</div>
				<div class="rounded-box bg-base-200 p-3">
					<div class="text-xs text-base-content/60">Interactions</div>
					<div class="font-semibold">{report.summary.interactions}</div>
				</div>
				<div class="rounded-box bg-base-200 p-3">
					<div class="text-xs text-base-content/60">Responses</div>
					<div class="font-semibold">{report.summary.responseVariables}</div>
				</div>
				<div class="rounded-box bg-base-200 p-3">
					<div class="text-xs text-base-content/60">Outcomes</div>
					<div class="font-semibold">{report.summary.outcomeVariables}</div>
				</div>
				<div class="rounded-box bg-base-200 p-3">
					<div class="text-xs text-base-content/60">Coverage rows</div>
					<div class="font-semibold">{report.summary.certificationRows}</div>
				</div>
			</div>

			{#if !compact && report.interactions.length > 0}
				<div>
					<h3 class="font-semibold mb-2">Detected interactions</h3>
					<div class="flex flex-wrap gap-2">
						{#each report.interactions as interaction}
							<span class="badge {interaction.supported ? 'badge-primary' : 'badge-warning'}">
								{interaction.type} × {interaction.count}
							</span>
						{/each}
					</div>
				</div>
			{/if}

			<div class="space-y-2" aria-live="polite">
				{#each report.issues as issue}
					<div class="alert {issueClass(issue)} py-3">
						<div>
							<h3 class="font-semibold">{issue.title}</h3>
							{#if issue.detail}
								<p class="text-sm">{issue.detail}</p>
							{/if}
						</div>
					</div>
				{/each}
			</div>

			{#if !compact && report.responseTemplates.length > 0}
				<details class="collapse collapse-arrow bg-base-200">
					<summary class="collapse-title font-medium">Response processing templates</summary>
					<div class="collapse-content">
						<ul class="space-y-2">
							{#each report.responseTemplates as template}
								<li class="flex flex-wrap items-center gap-2">
									<code class="text-xs">{template.name}</code>
									<span class="badge badge-sm {template.supported ? 'badge-success' : 'badge-warning'}">
										{template.supported ? 'supported' : 'unsupported'}
									</span>
								</li>
							{/each}
						</ul>
					</div>
				</details>
			{/if}
		</div>
	</section>
{/if}
