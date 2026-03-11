<script lang="ts">
	interface ItemReference {
		identifier: string;
		href: string;
		category?: string[];
		required?: boolean;
		fixed?: boolean;
		preCondition?: string;
		branchRule?: { target: string; condition?: string }[];
		itemSessionControl?: {
			maxAttempts?: number;
			showFeedback?: boolean;
			allowReview?: boolean;
			showSolution?: boolean;
			allowComment?: boolean;
			allowSkipping?: boolean;
			validateResponses?: boolean;
		};
		timeLimits?: {
			maxTime?: number;
			allowLateSubmission?: boolean;
		};
		weight?: number;
	}

	interface AssessmentSection {
		id: string;
		identifier: string;
		title: string;
		description?: string;
		visible: boolean;
		fixed: boolean;
		shuffle: boolean;
		itemRefs: ItemReference[];
		subsections?: AssessmentSection[];
		selection?: {
			select: number;
			withReplacement?: boolean;
			fromBank?: string;
		};
		ordering?: {
			shuffle: boolean;
		};
		rubricRefs?: string[];
		timeLimits?: {
			maxTime?: number;
			allowLateSubmission?: boolean;
		};
	}

	interface PieAssessment {
		id: string;
		title: string;
		identifier: string;
		description?: string;
		metadata: {
			source: 'qti22';
			qtiIdentifier: string;
			navigationMode?: 'linear' | 'nonlinear';
			submissionMode?: 'individual' | 'simultaneous';
		};
		sections: AssessmentSection[];
		timeLimits?: {
			maxTime?: number;
			allowLateSubmission?: boolean;
		};
	}

	interface Props {
		assessment: PieAssessment;
	}

	const { assessment }: Props = $props();

	function formatTime(seconds?: number): string {
		if (!seconds) return 'None';
		if (seconds < 60) return `${seconds}s`;
		const minutes = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
	}

	function countTotalItems(sections: AssessmentSection[]): number {
		return sections.reduce((sum, section) => {
			const itemCount = section.selection?.select || section.itemRefs.length;
			const subsectionCount = section.subsections ? countTotalItems(section.subsections) : 0;
			return sum + itemCount + subsectionCount;
		}, 0);
	}

	const totalItems = $derived(countTotalItems(assessment.sections));
</script>

<div class="space-y-6">
	<!-- Assessment Header -->
	<div class="border-b pb-4">
		<h2 class="text-2xl font-bold">{assessment.title}</h2>
		<p class="text-sm text-base-content/60 mt-1">{assessment.identifier}</p>
		{#if assessment.description}
			<p class="text-sm mt-2">{assessment.description}</p>
		{/if}
	</div>

	<!-- Assessment Metadata -->
	<div class="stats stats-horizontal shadow">
		<div class="stat">
			<div class="stat-title">Total Items</div>
			<div class="stat-value text-2xl">{totalItems}</div>
		</div>
		<div class="stat">
			<div class="stat-title">Sections</div>
			<div class="stat-value text-2xl">{assessment.sections.length}</div>
		</div>
		{#if assessment.timeLimits?.maxTime}
			<div class="stat">
				<div class="stat-title">Time Limit</div>
				<div class="stat-value text-2xl">{formatTime(assessment.timeLimits.maxTime)}</div>
			</div>
		{/if}
	</div>

	<!-- Assessment Configuration -->
	{#if assessment.metadata.navigationMode || assessment.metadata.submissionMode}
		<div class="card bg-base-200">
			<div class="card-body py-3">
				<h3 class="font-semibold text-sm">Configuration</h3>
				<div class="flex gap-4 text-sm">
					{#if assessment.metadata.navigationMode}
						<div>
							<span class="text-base-content/60">Navigation:</span>
							<span class="badge badge-sm ml-1">{assessment.metadata.navigationMode}</span>
						</div>
					{/if}
					{#if assessment.metadata.submissionMode}
						<div>
							<span class="text-base-content/60">Submission:</span>
							<span class="badge badge-sm ml-1">{assessment.metadata.submissionMode}</span>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- Sections -->
	<div class="space-y-4">
		<h3 class="font-bold text-lg">Sections</h3>
		{#each assessment.sections as section}
			<div class="card bg-base-100 shadow">
				<div class="card-body">
					<div class="flex justify-between items-start">
						<div>
							<h4 class="card-title text-base">{section.title}</h4>
							<p class="text-xs text-base-content/60">{section.identifier}</p>
						</div>
						<div class="flex gap-1">
							{#if section.shuffle}
								<div class="badge badge-info badge-sm">shuffle</div>
							{/if}
							{#if section.fixed}
								<div class="badge badge-warning badge-sm">fixed</div>
							{/if}
							{#if !section.visible}
								<div class="badge badge-ghost badge-sm">hidden</div>
							{/if}
						</div>
					</div>

					{#if section.description}
						<p class="text-sm mt-2">{section.description}</p>
					{/if}

					<!-- Selection Rules -->
					{#if section.selection}
						<div class="alert alert-info mt-2">
							<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							<span class="text-sm">
								Select {section.selection.select} item{section.selection.select > 1 ? 's' : ''}
								{#if section.selection.fromBank}
									from bank: {section.selection.fromBank}
								{/if}
								{#if section.selection.withReplacement}
									(with replacement)
								{/if}
							</span>
						</div>
					{/if}

					<!-- Time Limits -->
					{#if section.timeLimits?.maxTime}
						<div class="text-sm text-base-content/60 mt-2">
							⏱️ Time limit: {formatTime(section.timeLimits.maxTime)}
							{#if section.timeLimits.allowLateSubmission}
								<span class="badge badge-xs ml-1">late submission allowed</span>
							{/if}
						</div>
					{/if}

					<!-- Item References -->
					{#if section.itemRefs.length > 0}
						<div class="mt-3">
							<div class="text-sm font-semibold mb-2">
								Items ({section.itemRefs.length})
							</div>
							<div class="overflow-x-auto">
								<table class="table table-xs">
									<thead>
										<tr>
											<th>Identifier</th>
											<th>File</th>
											<th>Categories</th>
											<th>Controls</th>
										</tr>
									</thead>
									<tbody>
										{#each section.itemRefs as item}
											<tr>
												<td class="font-mono text-xs">
													{item.identifier}
													{#if item.required}
														<span class="badge badge-xs badge-error ml-1">required</span>
													{/if}
													{#if item.fixed}
														<span class="badge badge-xs badge-warning ml-1">fixed</span>
													{/if}
												</td>
												<td class="text-xs">{item.href}</td>
												<td>
													{#if item.category && item.category.length > 0}
														<div class="flex gap-1 flex-wrap">
															{#each item.category as cat}
																<span class="badge badge-xs badge-ghost">{cat}</span>
															{/each}
														</div>
													{:else}
														<span class="text-base-content/40">-</span>
													{/if}
												</td>
												<td class="text-xs">
													{#if item.itemSessionControl}
														<div class="flex flex-col gap-1">
															{#if item.itemSessionControl.maxAttempts}
																<span>Max: {item.itemSessionControl.maxAttempts}</span>
															{/if}
															{#if item.itemSessionControl.allowSkipping}
																<span class="text-success">Skippable</span>
															{/if}
														</div>
													{:else}
														<span class="text-base-content/40">-</span>
													{/if}
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					{/if}

					<!-- Subsections -->
					{#if section.subsections && section.subsections.length > 0}
						<div class="ml-4 mt-3 space-y-2">
							<div class="text-sm font-semibold">Subsections</div>
							{#each section.subsections as subsection}
								<div class="card bg-base-200">
									<div class="card-body py-2">
										<h5 class="font-semibold text-sm">{subsection.title}</h5>
										<p class="text-xs text-base-content/60">
											{subsection.itemRefs.length} item{subsection.itemRefs.length > 1 ? 's' : ''}
										</p>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		{/each}
	</div>
</div>
