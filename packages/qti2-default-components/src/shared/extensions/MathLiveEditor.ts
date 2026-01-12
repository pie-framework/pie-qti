/// <reference lib="dom" />

/**
 * MathLive Editor Extension for TipTap
 *
 * Integrates MathLive (visual math editor) with TipTap's Mathematics extension.
 * Provides a modal dialog with MathLive mathfield for editing LaTeX formulas.
 *
 * Note: MathLive CSS is loaded dynamically to avoid build issues with package exports.
 */

import type { MathfieldElement } from 'mathlive';

// Dynamically import MathLive to register the custom element
let mathLiveLoaded: Promise<void> | null = null;

async function ensureMathLiveLoaded(): Promise<void> {
	if (!mathLiveLoaded && typeof window !== 'undefined') {
		mathLiveLoaded = (async () => {
			// Import MathLive to register the <math-field> custom element
			await import('mathlive');

			// Load MathLive CSS if not already loaded
			if (!document.querySelector('link[href*="mathlive"]')) {
				const link = document.createElement('link');
				link.rel = 'stylesheet';
				link.href = 'https://cdn.jsdelivr.net/npm/mathlive@0.108.2/dist/mathlive-static.css';
				document.head.appendChild(link);
			}
		})();
	}
	return mathLiveLoaded || Promise.resolve();
}

export interface MathLiveEditorOptions {
	/** Called when user confirms the LaTeX input */
	onConfirm: (latex: string) => void;
	/** Called when user cancels */
	onCancel: () => void;
	/** Initial LaTeX value */
	initialLatex?: string;
	/** Whether this is inline or block math */
	isBlock?: boolean;
	/** Optional i18n provider for translations */
	i18n?: { t: (key: string) => string | undefined };
}

/**
 * Opens a modal dialog with MathLive editor for LaTeX input
 */
export async function openMathLiveEditor(options: MathLiveEditorOptions): Promise<() => void> {
	const { onConfirm, onCancel, initialLatex = '', isBlock = false } = options;

	// Ensure MathLive is loaded and registered before creating the mathfield
	await ensureMathLiveLoaded();

	// Create modal overlay - use DaisyUI modal classes
	const overlay = document.createElement('div');
	overlay.className = 'modal modal-open';
	overlay.style.cssText = `
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9999;
	`;

	// Create modal dialog - use DaisyUI modal-box class
	const modal = document.createElement('div');
	modal.className = 'modal-box max-w-2xl';
	modal.style.cssText = `
		padding: 1.5rem;
		position: relative;
		z-index: 10000;
	`;

	// Create header - use DaisyUI font-bold text-lg
	const header = document.createElement('h3');
	header.textContent = isBlock ? (options.i18n?.t('interactions.extendedText.insertBlockMath') ?? 'Insert Block Math') : (options.i18n?.t('interactions.extendedText.insertInlineMath') ?? 'Insert Inline Math');
	header.className = 'font-bold text-lg mb-4';

	// Create form control wrapper
	const formControl = document.createElement('div');
	formControl.className = 'form-control';

	// Create label for mathfield
	const label = document.createElement('label');
	label.className = 'label';
	const labelText = document.createElement('span');
	labelText.className = 'label-text';
	labelText.textContent = 'Enter your math expression:';
	label.appendChild(labelText);

	// Create MathLive mathfield - style like DaisyUI input
	const mathfield = document.createElement('math-field') as MathfieldElement;
	mathfield.value = initialLatex;
	mathfield.className = 'input input-bordered w-full';
	mathfield.style.cssText = `
		display: block;
		min-height: 100px;
		padding: 0.75rem;
		font-size: 1.125rem;
	`;

	// Set MathLive options for better UX via attributes
	// Use 'manual' mode so keyboard only shows when explicitly requested
	mathfield.setAttribute('virtual-keyboard-mode', 'manual');
	mathfield.setAttribute('smart-mode', 'on');
	// Explicitly enable virtual keyboard
	mathfield.setAttribute('use-shared-virtual-keyboard', 'true');
	// Hide the built-in virtual keyboard toggle
	mathfield.setAttribute('virtual-keyboard-toggle-glyph', '');

	// Inject CSS to ensure virtual keyboard appears above modal and accepts clicks
	const style = document.createElement('style');
	style.textContent = `
		/* Ensure MathLive virtual keyboard appears above the modal and is clickable */
		.ML__keyboard {
			z-index: 10001 !important;
			pointer-events: auto !important;
		}
		/* Hide the built-in keyboard toggle button in the mathfield - try multiple selectors */
		.ML__virtual-keyboard-toggle,
		.ML__keyboard-toggle,
		math-field::part(virtual-keyboard-toggle) {
			display: none !important;
			visibility: hidden !important;
			opacity: 0 !important;
			pointer-events: none !important;
		}
	`;
	document.head.appendChild(style);

	// Create LaTeX preview label
	const previewLabel = document.createElement('label');
	previewLabel.className = 'label';
	const previewLabelText = document.createElement('span');
	previewLabelText.className = 'label-text';
	previewLabelText.textContent = 'LaTeX source:';
	previewLabel.appendChild(previewLabelText);

	// Create LaTeX preview/source - use alert info styling
	const latexPreview = document.createElement('div');
	latexPreview.className = 'alert alert-info';
	latexPreview.style.cssText = `
		font-family: 'Monaco', 'Courier New', monospace;
		font-size: 0.875rem;
		word-break: break-all;
		margin-bottom: 1rem;
	`;
	latexPreview.textContent = initialLatex || '(LaTeX will appear here)';

	// Update preview when mathfield changes
	mathfield.addEventListener('input', () => {
		const latex = mathfield.value;
		latexPreview.textContent = latex || '(LaTeX will appear here)';
	});

	// Create button container - use DaisyUI modal-action class
	const buttons = document.createElement('div');
	buttons.className = 'modal-action';
	buttons.style.cssText = 'justify-content: space-between;';

	// Create left-side buttons (keyboard toggle)
	const leftButtons = document.createElement('div');
	leftButtons.style.cssText = 'display: flex; gap: 0.5rem;';

	// Create Keyboard Toggle button
	const keyboardBtn = document.createElement('button');
	keyboardBtn.textContent = '⌨️ Keyboard';
	keyboardBtn.type = 'button';
	keyboardBtn.className = 'btn btn-sm btn-outline';
	keyboardBtn.onclick = () => {
		if (mathfield.executeCommand) {
			mathfield.executeCommand('toggleVirtualKeyboard');
		}
	};

	leftButtons.appendChild(keyboardBtn);

	// Create right-side buttons (Cancel/Insert)
	const rightButtons = document.createElement('div');
	rightButtons.style.cssText = 'display: flex; gap: 0.5rem;';

	// Create Cancel button - use DaisyUI classes
	const cancelBtn = document.createElement('button');
	cancelBtn.textContent = 'Cancel';
	cancelBtn.type = 'button';
	cancelBtn.className = 'btn btn-ghost';

	// Create Insert button - use DaisyUI classes
	const insertBtn = document.createElement('button');
	insertBtn.textContent = initialLatex ? 'Update' : 'Insert';
	insertBtn.type = 'button';
	insertBtn.className = 'btn btn-primary';

	rightButtons.appendChild(cancelBtn);
	rightButtons.appendChild(insertBtn);

	// Assemble modal
	buttons.appendChild(leftButtons);
	buttons.appendChild(rightButtons);

	// Assemble form-control
	formControl.appendChild(label);
	formControl.appendChild(mathfield);
	formControl.appendChild(previewLabel);
	formControl.appendChild(latexPreview);

	modal.appendChild(header);
	modal.appendChild(formControl);
	modal.appendChild(buttons);

	overlay.appendChild(modal);

	// Cleanup function
	const cleanup = () => {
		// Remove event listeners to prevent memory leaks
		cancelBtn.removeEventListener('click', handleCancel);
		insertBtn.removeEventListener('click', handleConfirm);
		document.removeEventListener('keydown', handleEscape);
		overlay.removeEventListener('click', handleOverlayClick);

		// Hide virtual keyboard before cleanup
		if (mathfield.executeCommand) {
			mathfield.executeCommand('hideVirtualKeyboard');
		}

		// Remove DOM elements
		overlay.remove();
		style.remove();

		// Restore body scroll
		document.body.style.overflow = '';
	};

	// Event handlers
	const handleCancel = () => {
		cleanup();
		onCancel();
	};

	const handleConfirm = () => {
		const latex = mathfield.value;
		cleanup();
		onConfirm(latex);
	};

	const handleEscape = (e: KeyboardEvent) => {
		if (e.key === 'Escape') {
			handleCancel();
		}
	};

	const handleOverlayClick = (e: MouseEvent) => {
		// Don't close if clicking on the modal content or virtual keyboard
		const target = e.target as HTMLElement;

		// Check if click is on overlay background (not modal or keyboard)
		if (target === overlay) {
			// Additional check: don't close if virtual keyboard is open
			// MathLive virtual keyboard has class 'ML__keyboard'
			const virtualKeyboard = document.querySelector('.ML__keyboard');
			if (!virtualKeyboard) {
				handleCancel();
			}
		}
	};

	// Attach event listeners
	cancelBtn.addEventListener('click', handleCancel);
	insertBtn.addEventListener('click', handleConfirm);
	document.addEventListener('keydown', handleEscape);
	overlay.addEventListener('click', handleOverlayClick);

	// Prevent body scroll when modal is open
	document.body.style.overflow = 'hidden';

	// Add to DOM
	document.body.appendChild(overlay);

	// Focus the mathfield (but don't auto-show keyboard)
	setTimeout(() => {
		mathfield.focus();
		// Try to programmatically disable the built-in toggle via options
		try {
			(mathfield as any).setOptions({
				virtualKeyboardToggleGlyph: '',
			});
		} catch (e) {
			// Silently ignore if this API doesn't exist
		}
	}, 100);

	// Return cleanup function
	return cleanup;
}
