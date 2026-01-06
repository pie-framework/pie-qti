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
</style>


