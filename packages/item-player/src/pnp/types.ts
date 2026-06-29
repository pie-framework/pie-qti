/**
 * QTI 3.0 §6.2 Personal Needs and Preferences profile.
 * All fields are optional; absent means "use platform default".
 */
export interface PnpProfile {
	display?: {
		/**
		 * Named color scheme. Maps to the data-qti-colorscheme attribute on the player root.
		 * 'default' or undefined → attribute removed (browser/host default).
		 */
		colorScheme?:
			| 'default'
			| 'defaultreverse'
			| 'blackwhite'
			| 'whiteblack'
			| 'blackrose'
			| 'roseblack'
			| 'yellowblue'
			| 'blueyellow'
			| 'mgraydgray'
			| 'dgraymgray'
			| 'blackcyan'
			| 'cyanblack'
			| 'blackcream'
			| 'creamblack'
			| 'whitenav'
			| 'medgray';
		/**
		 * CSS zoom factor (1.0 = 100%). Deferred — set by browser zoom or host stylesheet.
		 * Stored here for forward-compatibility but not yet applied by the player.
		 */
		magnification?: number;
	};
	content?: {
		/** Show glossary trigger buttons on [data-catalog-idref] terms (G-10). */
		glossaryOnScreen?: boolean;
		/** Show keyword-translation trigger buttons using the given language code. */
		keywordTranslation?: { active: boolean; languageCode: string };
		/** Show illustrated glossary supports when catalog entries provide them. */
		illustratedGlossary?: boolean;
		/** Enable user-initiated host-routed catalog supports. */
		catalogSupports?: CatalogSupportPreferences;
		/**
		 * Scale assessment time limits. multiplier: 1.5 means 50% extra time.
		 * multiplier: Infinity removes the time limit entirely.
		 */
		extendedTime?: { active: boolean; multiplier: number };
	};
	cognitive?: {
		/** Render per-choice elimination toggle buttons in choiceInteraction and orderInteraction. */
		eliminationTool?: boolean;
	};
}

export interface CatalogSupportPreferences {
	ttsPronunciation?: CatalogSupportPreference;
	signingDefinition?: CatalogSupportPreference;
	brailleText?: CatalogSupportPreference;
	audioDescription?: CatalogSupportPreference;
	extendedDescription?: CatalogSupportPreference;
	/**
	 * Host-defined catalog usage names. Use QTI/catalog usage strings such as
	 * "custom-audio" rather than DOM event names or implementation-specific APIs.
	 */
	[usage: string]: CatalogSupportPreference | undefined;
}

export type CatalogSupportPreference = boolean | CatalogSupportPreferenceOptions;

export interface CatalogSupportPreferenceOptions {
	/** Defaults to true when omitted. */
	active?: boolean;
	/** Preferred catalog entry language for this support, such as "en-US" or "es". */
	languageCode?: string;
}
