<!--
  Shared baseline styles for Shadow DOM web components.

  Purpose:
  - Provide minimal, readable styling when the host does NOT load DaisyUI/Tailwind CSS.
  - Still allow host theming via DaisyUI-like CSS variables (e.g. --p, --b1, --bc).

  Notes:
  - Uses :global(...) so these styles apply within the component's shadow root.
  - Intentionally minimal: interaction components may still add their own layout CSS.
-->

<style>
	/* Import KaTeX CSS for math rendering in Shadow DOM */
	@import url('https://cdn.jsdelivr.net/npm/katex@0.16.27/dist/katex.min.css');
	/* Buttons */
	:global(.btn) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		border-radius: 0.75rem;
		border: 1px solid var(--color-base-300, oklch(95% 0 0));
		background: var(--color-base-200, oklch(98% 0 0));
		color: var(--color-base-content, oklch(21% 0 0));
		font: inherit;
		line-height: 1.1;
		cursor: pointer;
		user-select: none;
		transition: background-color 0.2s, border-color 0.2s, transform 0.1s;
	}
	:global(.btn:hover:not(:disabled)) {
		background: var(--color-base-300, oklch(95% 0 0));
		border-color: var(--color-base-content, oklch(21% 0 0));
	}
	:global(.btn:active:not(:disabled)) {
		transform: scale(0.97);
	}
	:global(.btn:focus-visible) {
		outline: 2px solid var(--color-primary, oklch(45% 0.24 277));
		outline-offset: 2px;
	}
	:global(.btn:disabled),
	:global(.btn.btn-disabled) {
		opacity: 0.55;
		cursor: not-allowed;
	}
	:global(.btn-primary) {
		border-color: var(--color-primary, oklch(45% 0.24 277));
		background: color-mix(in oklch, var(--color-primary, oklch(45% 0.24 277)) 12%, transparent);
	}
	:global(.btn-secondary) {
		border-color: var(--color-secondary, oklch(65% 0.241 354.308));
		background: color-mix(in oklch, var(--color-secondary, oklch(65% 0.241 354.308)) 12%, transparent);
	}
	:global(.btn-accent) {
		border-color: var(--color-accent, oklch(77% 0.152 181.912));
		background: color-mix(in oklch, var(--color-accent, oklch(77% 0.152 181.912)) 12%, transparent);
	}
	:global(.btn-success) {
		border-color: var(--color-success, oklch(76% 0.177 163.223));
		background: color-mix(in oklch, var(--color-success, oklch(76% 0.177 163.223)) 12%, transparent);
	}
	:global(.btn-warning) {
		border-color: var(--color-warning, oklch(82% 0.189 84.429));
		background: color-mix(in oklch, var(--color-warning, oklch(82% 0.189 84.429)) 12%, transparent);
	}
	:global(.btn-error) {
		border-color: var(--color-error, oklch(71% 0.194 13.428));
		background: color-mix(in oklch, var(--color-error, oklch(71% 0.194 13.428)) 12%, transparent);
	}
	:global(.btn-ghost) {
		background: transparent;
		border-color: transparent;
	}
	:global(.btn-ghost:hover:not(:disabled)) {
		background: var(--color-base-200, oklch(98% 0 0));
		border-color: var(--color-base-300, oklch(95% 0 0));
	}
	:global(.btn-outline) {
		background: transparent;
	}
	:global(.btn-sm) {
		padding: 0.35rem 0.6rem;
		border-radius: 0.6rem;
		font-size: 0.875rem;
	}
	:global(.btn-xs) {
		padding: 0.25rem 0.45rem;
		border-radius: 0.5rem;
		font-size: 0.75rem;
	}
	:global(.btn-circle) {
		border-radius: 9999px;
		padding: 0;
		width: 2rem;
		height: 2rem;
	}

	/* Badges */
	:global(.badge) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0 0.5rem;
		height: 1.25rem;
		border-radius: 9999px;
		border: 1px solid var(--color-base-300, oklch(95% 0 0));
		background: var(--color-base-100, oklch(100% 0 0));
		color: var(--color-base-content, oklch(21% 0 0));
		font-size: 0.75rem;
		font-weight: 600;
	}
	:global(.badge-sm) {
		height: 1.1rem;
		font-size: 0.7rem;
	}
	:global(.badge-lg) {
		height: 1.5rem;
		font-size: 0.85rem;
	}
	:global(.badge-primary) {
		border-color: var(--color-primary, oklch(45% 0.24 277));
		background: color-mix(in oklch, var(--color-primary, oklch(45% 0.24 277)) 12%, transparent);
	}
	:global(.badge-success) {
		border-color: var(--color-success, oklch(76% 0.177 163.223));
		background: color-mix(in oklch, var(--color-success, oklch(76% 0.177 163.223)) 12%, transparent);
	}
	:global(.badge-warning) {
		border-color: var(--color-warning, oklch(82% 0.189 84.429));
		background: color-mix(in oklch, var(--color-warning, oklch(82% 0.189 84.429)) 12%, transparent);
	}
	:global(.badge-error) {
		border-color: var(--color-error, oklch(71% 0.194 13.428));
		background: color-mix(in oklch, var(--color-error, oklch(71% 0.194 13.428)) 12%, transparent);
	}

	/* Alerts */
	:global(.alert) {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		border-radius: 0.75rem;
		border: 1px solid var(--color-base-300, oklch(95% 0 0));
		background: var(--color-base-200, oklch(98% 0 0));
		color: var(--color-base-content, oklch(21% 0 0));
	}
	:global(.alert-info) {
		border-color: var(--color-info, oklch(74% 0.16 232.661));
		background: color-mix(in oklch, var(--color-info, oklch(74% 0.16 232.661)) 8%, transparent);
	}
	:global(.alert-success) {
		border-color: var(--color-success, oklch(76% 0.177 163.223));
		background: color-mix(in oklch, var(--color-success, oklch(76% 0.177 163.223)) 8%, transparent);
	}
	:global(.alert-warning) {
		border-color: var(--color-warning, oklch(82% 0.189 84.429));
		background: color-mix(in oklch, var(--color-warning, oklch(82% 0.189 84.429)) 8%, transparent);
	}
	:global(.alert-error) {
		border-color: var(--color-error, oklch(71% 0.194 13.428));
		background: color-mix(in oklch, var(--color-error, oklch(71% 0.194 13.428)) 8%, transparent);
	}

	/* Cards */
	:global(.card) {
		border-radius: 0.75rem;
		border: 1px solid var(--color-base-300, oklch(95% 0 0));
		background: var(--color-base-100, oklch(100% 0 0));
	}
	:global(.card-body) {
		padding: 1rem;
	}
	:global(.card-title) {
		font-weight: 700;
	}

	/* Divider */
	:global(.divider) {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin: 0.75rem 0;
		color: color-mix(in oklch, var(--color-base-content, oklch(21% 0 0)) 65%, transparent);
		font-size: 0.875rem;
	}
	:global(.divider::before),
	:global(.divider::after) {
		content: '';
		flex: 1 1 auto;
		height: 1px;
		background: var(--color-base-300, oklch(95% 0 0));
	}

	/* Form controls */
	:global(.select),
	:global(.textarea) {
		border-radius: 0.6rem;
		border: 1px solid var(--color-base-300, oklch(95% 0 0));
		background: var(--color-base-100, oklch(100% 0 0));
		color: var(--color-base-content, oklch(21% 0 0));
		padding: 0.35rem 0.6rem;
		font: inherit;
	}
	:global(.select-sm) {
		font-size: 0.85rem;
		padding: 0.25rem 0.5rem;
	}
	:global(.textarea) {
		padding: 0.5rem 0.75rem;
	}
	:global(.radio),
	:global(.checkbox) {
		accent-color: var(--color-primary, oklch(45% 0.24 277));
	}

	/* Tailwind utilities for canvas drawing */
	:global(.touch-none) {
		touch-action: none;
	}
	:global(.absolute) {
		position: absolute;
	}
	:global(.relative) {
		position: relative;
	}
	:global(.inset-0) {
		top: 0;
		right: 0;
		bottom: 0;
		left: 0;
	}
	:global(.inline-block) {
		display: inline-block;
	}
	:global(.inline-flex) {
		display: inline-flex;
	}
	:global(.flex) {
		display: flex;
	}
	:global(.items-center) {
		align-items: center;
	}
	:global(.items-start) {
		align-items: flex-start;
	}
	:global(.justify-between) {
		justify-content: space-between;
	}
	:global(.gap-2) {
		gap: 0.5rem;
	}
	:global(.gap-4) {
		gap: 1rem;
	}
	:global(.space-y-2 > * + *) {
		margin-top: 0.5rem;
	}
	:global(.space-y-3 > * + *) {
		margin-top: 0.75rem;
	}
	:global(.overflow-hidden) {
		overflow: hidden;
	}
	:global(.rounded) {
		border-radius: 0.25rem;
	}
	:global(.border) {
		border-width: 1px;
	}
	:global(.border-base-300) {
		border-color: var(--color-base-300, oklch(95% 0 0));
	}
	:global(.bg-base-100) {
		background-color: var(--color-base-100, oklch(100% 0 0));
	}
	:global(.bg-base-content\/70) {
		background-color: color-mix(in oklch, var(--color-base-content, oklch(21% 0 0)) 70%, transparent);
	}
	:global(.text-xs) {
		font-size: 0.75rem;
		line-height: 1rem;
	}
	:global(.text-sm) {
		font-size: 0.875rem;
		line-height: 1.25rem;
	}
	:global(.font-semibold) {
		font-weight: 600;
	}
	:global(.text-base-content\/70) {
		color: color-mix(in oklch, var(--color-base-content, oklch(21% 0 0)) 70%, transparent);
	}
	:global(.mb-2) {
		margin-bottom: 0.5rem;
	}
	:global(.mb-3) {
		margin-bottom: 0.75rem;
	}
	:global(.mr-2) {
		margin-right: 0.5rem;
	}
	:global(.w-full) {
		width: 100%;
	}
	:global(.w-auto) {
		width: auto;
	}
	:global(.h-6) {
		height: 1.5rem;
	}
	:global(.w-6) {
		width: 1.5rem;
	}
	:global(.shrink-0) {
		flex-shrink: 0;
	}
	:global(.stroke-current) {
		stroke: currentColor;
	}
	:global(.sr-only) {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}

	/* Form inputs */
	:global(.file-input) {
		border-radius: 0.6rem;
		border: 1px solid var(--color-base-300, oklch(95% 0 0));
		background: var(--color-base-100, oklch(100% 0 0));
		color: var(--color-base-content, oklch(21% 0 0));
		padding: 0.35rem 0.6rem;
		font: inherit;
	}
	:global(.file-input-bordered) {
		border: 1px solid var(--color-base-300, oklch(95% 0 0));
	}
	:global(.label) {
		display: flex;
		user-select: none;
		padding: 0.25rem 0;
	}
	:global(.label-text) {
		font-size: 0.875rem;
		line-height: 1.25rem;
	}
	:global(.form-control) {
		display: flex;
		flex-direction: column;
	}
</style>


