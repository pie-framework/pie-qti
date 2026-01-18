<script lang="ts">
	import type { I18nProvider } from '@pie-qti/qti2-i18n';

	interface Section {
		id: string;
		title?: string;
		index: number;
	}

	interface Props {
		sections: Section[];
		currentSectionIndex?: number;
		i18n?: I18nProvider;
		onSectionSelect?: (sectionIndex: number) => void;
		disabled?: boolean;
	}

	const { sections, currentSectionIndex, i18n, onSectionSelect, disabled = false }: Props = $props();

	let isOpen = $state(false);

	function toggleMenu() {
		isOpen = !isOpen;
	}

	function selectSection(sectionIndex: number) {
		if (disabled) return;
		if (onSectionSelect) {
			onSectionSelect(sectionIndex);
		}
		isOpen = false;
	}
</script>

{#if sections.length > 1}
	<div class="section-menu">
		<button class="btn btn-outline btn-sm" onclick={() => toggleMenu?.()} disabled={disabled}>
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
					d="M4 6h16M4 12h16M4 18h16"
				/>
			</svg>
			{i18n?.t('assessment.sections.title') ?? 'Sections'}
		</button>

		{#if isOpen}
			<div class="section-dropdown">
				<div class="section-dropdown-content">
					<div class="section-list">
						{#each sections as section}
							<button
								class="section-item"
								class:active={currentSectionIndex === section.index}
								onclick={() => selectSection(section.index)}
								disabled={disabled}
							>
								<div class="section-icon">
									{#if currentSectionIndex === section.index}
										<svg
											xmlns="http://www.w3.org/2000/svg"
											class="h-5 w-5"
											viewBox="0 0 20 20"
											fill="currentColor"
										>
											<path
												fill-rule="evenodd"
												d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
												clip-rule="evenodd"
											/>
										</svg>
									{:else}
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
												d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
											/>
										</svg>
									{/if}
								</div>
								<div class="section-info">
									<div class="section-title">
										{section.title || (i18n?.t('assessment.sectionDefault', { number: section.index + 1 }) ?? `Section ${section.index + 1}`)}
									</div>
								</div>
							</button>
						{/each}
					</div>
				</div>
				<button class="section-backdrop" onclick={() => toggleMenu?.()} aria-label={i18n?.t('assessment.closeMenu') ?? 'Close menu'}></button>
			</div>
		{/if}
	</div>
{/if}

<style>
	.section-menu {
		position: relative;
	}

	.section-dropdown {
		position: fixed;
		inset: 0;
		z-index: 50;
	}

	.section-backdrop {
		position: absolute;
		inset: 0;
		background: transparent;
		border: none;
		cursor: default;
	}

	.section-dropdown-content {
		position: absolute;
		top: 4rem;
		right: 1rem;
		width: 20rem;
		max-height: 24rem;
		overflow-y: auto;
		background: var(--color-base-100);
		border: 1px solid var(--color-base-300);
		border-radius: 0.5rem;
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
		z-index: 51;
	}

	.section-list {
		padding: 0.5rem;
	}

	.section-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		padding: 0.75rem;
		border: none;
		background: transparent;
		border-radius: 0.375rem;
		cursor: pointer;
		transition: background-color 0.2s;
		text-align: left;
	}

	.section-item:hover:not(:disabled) {
		background: var(--color-base-200);
	}

	.section-item.active {
		background: color-mix(in oklab, var(--color-primary) 12%, transparent);
		color: var(--color-primary);
	}

	.section-item:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.section-icon {
		flex-shrink: 0;
		color: color-mix(in oklab, var(--color-base-content) 60%, transparent);
	}

	.section-item.active .section-icon {
		color: var(--color-primary);
	}

	.section-info {
		flex: 1;
		min-width: 0;
	}

	.section-title {
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@media (max-width: 640px) {
		.section-dropdown-content {
			right: 0;
			left: 0;
			width: auto;
			margin: 0 1rem;
		}
	}
</style>
