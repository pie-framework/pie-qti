import type { PnpProfile } from '@pie-qti/item-player';

/**
 * The display settings a candidate can adjust themselves, from the section's
 * display settings tool. Every setting maps onto a PNP display mechanism the
 * item player already renders (colour schemes, text appearance tokens), so the
 * whole player — items, passages, rubrics, tool bars — follows.
 *
 * Settings are session-scoped. A host that wants to persist them listens for
 * `qti-section-display-settings` (or the layout's `onDisplaySettingsChange`) and
 * stores `pnp`, the effective profile; it passes that profile back as the
 * candidate's PNP next session.
 */
export interface QtiCandidateDisplaySettings {
  /**
   * Text size step. `0` keeps the profile's own size; `1`–`3` enlarge the
   * section's text to the size of the same step in `TEXT_SIZE_STEPS`.
   */
  textSize?: QtiDisplayTextSizeStep;
  /**
   * Higher-contrast text: the AfA `high-contrast` black-on-white scheme. While
   * on it replaces the profile's own colour scheme; off restores it.
   */
  highContrast?: boolean;
  /** Extra spacing between lines, letters and words (WCAG 1.4.12 reference values). */
  textSpacing?: boolean;
}

/** A text size step of the display settings tool; `0` is the profile's own size. */
export type QtiDisplayTextSizeStep = 0 | 1 | 2 | 3;

/** The empty settings: the profile renders as the host delivered it. */
export const DEFAULT_DISPLAY_SETTINGS: Readonly<QtiCandidateDisplaySettings> = {
  textSize: 0,
  highContrast: false,
  textSpacing: false,
};

/** What a tool bar needs from the section's display settings dialog to open it. */
export interface QtiDisplaySettingsControls {
  openDialog(): Promise<void>;
}

/**
 * Text sizes in points for steps 1–3 of the display settings tool. Step `0` is
 * the profile's own size, so it is absent here. The default body size (1rem)
 * is 12pt, so the steps enlarge by roughly a sixth, a third and two thirds.
 */
export const TEXT_SIZE_STEPS: Readonly<Record<Exclude<QtiDisplayTextSizeStep, 0>, number>> = {
  1: 14,
  2: 16,
  3: 20,
};

/** WCAG 1.4.12's reference spacing, in the units `PnpTextAppearance` takes. */
const TEXT_SPACING = { lineHeight: 1.5, letterSpacing: 0.12, wordSpacing: 0.16 } as const;

/** The AfA `high-contrast` theme, which the higher-contrast toggle turns on. */
const HIGH_CONTRAST_SCHEME = 'blackwhite' as const;

function stepOf(settings: QtiCandidateDisplaySettings | undefined): QtiDisplayTextSizeStep {
  const size = settings?.textSize;
  return size === 1 || size === 2 || size === 3 ? size : 0;
}

/**
 * The profile the section renders with: the host's PNP with the candidate's
 * display settings applied. A setting left off leaves the profile's own value,
 * so turning a toggle off restores what the host delivered. The candidate's
 * values win per field while they are on.
 */
export function withDisplaySettings(
  pnp: PnpProfile | undefined,
  settings: QtiCandidateDisplaySettings | undefined,
): PnpProfile {
  const textSize = stepOf(settings);
  const highContrast = settings?.highContrast === true;
  const textSpacing = settings?.textSpacing === true;
  const display = pnp?.display;

  let textAppearance = display?.textAppearance;
  if (textSpacing) textAppearance = { ...textAppearance, ...TEXT_SPACING };
  if (textSize !== 0) textAppearance = { ...textAppearance, fontSize: TEXT_SIZE_STEPS[textSize] };

  return {
    ...pnp,
    display: {
      ...display,
      ...(textAppearance ? { textAppearance } : {}),
      // The candidate's own choice of higher-contrast text outranks the
      // profile's scheme while it is on; off gives the profile's back.
      colorScheme: highContrast ? HIGH_CONTRAST_SCHEME : display?.colorScheme,
    },
  };
}

/**
 * The candidate's settings for this page session, by assessment. A shell that
 * swaps layouts between items (split pane for an item with a passage, vertical
 * for one without) mounts a new layout; reading the settings back from here keeps
 * them for the rest of the assessment. Written only from the candidate's own
 * changes in the browser.
 */
const sessionDisplaySettings = new Map<string, QtiCandidateDisplaySettings>();

/** The settings the candidate chose earlier in this page session for `key`, if any. */
export function readSessionDisplaySettings(key: string): QtiCandidateDisplaySettings | undefined {
  const settings = sessionDisplaySettings.get(key);
  return settings ? { ...settings } : undefined;
}

/** Remember the candidate's settings for `key` for the rest of the page session. */
export function writeSessionDisplaySettings(key: string, settings: QtiCandidateDisplaySettings): void {
  sessionDisplaySettings.set(key, { ...settings });
}

/**
 * The display settings for a profile a host persisted from an earlier session:
 * the tool's controls start where the candidate left them. A profile without
 * the settings' fingerprints — a size step, the black-on-white scheme, the
 * reference spacing — reads as the default settings.
 */
export function displaySettingsOf(pnp: PnpProfile | undefined): QtiCandidateDisplaySettings {
  const appearance = pnp?.display?.textAppearance;
  const steps: Array<Exclude<QtiDisplayTextSizeStep, 0>> = [1, 2, 3];
  const textSize = steps.find((step) => TEXT_SIZE_STEPS[step] === appearance?.fontSize);
  return {
    textSize: textSize ?? 0,
    highContrast: pnp?.display?.colorScheme === HIGH_CONTRAST_SCHEME,
    textSpacing:
      appearance?.lineHeight === TEXT_SPACING.lineHeight &&
      appearance?.letterSpacing === TEXT_SPACING.letterSpacing &&
      appearance?.wordSpacing === TEXT_SPACING.wordSpacing,
  };
}
