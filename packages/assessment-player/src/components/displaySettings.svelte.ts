/**
 * Candidate display settings (PNP) for the shell chrome: the section layouts own
 * the settings tool and report changes; the shell root is a PNP surface so the
 * profile also covers the header, navigation and timer chrome around the item.
 */
import type { PnpProfile } from '@pie-qti/item-player';
import { applyPnpToSurface, clearPnpSurface } from '@pie-qti/item-player';
import { withDisplaySettings, type QtiCandidateDisplaySettings } from '@pie-qti/section-player';

export function createDisplaySettings(getHostPnp: () => PnpProfile | undefined) {
	let candidate = $state<QtiCandidateDisplaySettings>({});

	/** The profile the shell chrome renders with: the host profile with the candidate's display settings applied. */
	const shellPnp = $derived<PnpProfile>(withDisplaySettings(getHostPnp(), candidate));

	/** The section layouts report the candidate's changes here. */
	function handleChange(event: { settings: QtiCandidateDisplaySettings }) {
		candidate = event.settings;
	}

	return {
		/** The candidate's current display settings. */
		get settings(): QtiCandidateDisplaySettings {
			return candidate;
		},
		shellPnp,
		handleChange,
	};
}

/**
 * The section layouts repaint their own surface when the candidate changes their
 * display settings; the shell root is a separate PNP surface so the header,
 * navigation bar and timer follow too (nested inverting filters are neutralized
 * by the surface mechanism, and nothing outside the shell changes). Call during
 * component initialisation: it creates the repaint effect.
 */
export function applyDisplaySettingsSurface(getRoot: () => HTMLElement | null, getPnp: () => PnpProfile) {
	$effect(() => {
		const root = getRoot();
		if (!root) return;
		const pnp = getPnp();
		applyPnpToSurface(root, pnp);
		return () => clearPnpSurface(root);
	});
}
