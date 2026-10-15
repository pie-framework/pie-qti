/**
 * The candidate needs the item player renders, from a per-candidate AfA PNP 3.0
 * profile (`pnpProfileFromAfa`). All fields are optional; absent means "use platform default".
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
		/** AfA `language-of-interface`: the language the host renders the player's own text in. */
		interfaceLanguage?: string;
		/**
		 * AfA `invert-display-polarity`: light content on a dark ground. The colours, when given,
		 * replace the inverted ones. Sets `data-qti-invert-polarity` on the player root.
		 */
		invertPolarity?: { foreground?: string; background?: string };
		/** AfA `layout-single-column`: layout grids stack. Sets `data-qti-layout="single-column"`. */
		singleColumn?: boolean;
		/** AfA `text-appearance`, applied as custom properties on the player root. */
		textAppearance?: PnpTextAppearance;
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
		extendedTime?: {
			active: boolean;
			multiplier: number;
			/** AfA `fixed-minutes`: minutes added to each time limit, with `multiplier` 1. */
			fixedMinutes?: number;
		};
	};
	cognitive?: {
		/** Render per-choice elimination toggle buttons in choiceInteraction and orderInteraction. */
		eliminationTool?: boolean;
		/** AfA `answer-masking`: each choice of a choiceInteraction stays masked until the candidate reveals it. */
		answerMasking?: boolean;
	};
	/**
	 * Tool supports in pie-players' `PersonalNeedsProfile` terms, from AfA `calculator-on-screen`,
	 * `spoken`, `line-reader` and `dictionary-on-screen`. The section player enables the tools it
	 * offers from them; a host passes them to its own toolkit.
	 */
	tools?: PnpToolSupports;
}

export interface PnpTextAppearance {
	/** Font size in points. */
	fontSize?: number;
	/** A CSS font-family list: the named fonts, then the generic face. */
	fontFamily?: string;
	fontColor?: string;
	backgroundColor?: string;
	/** Unitless line height, from AfA `line-height`, else `line-spacing`. */
	lineHeight?: number;
	/** Letter spacing in em. */
	letterSpacing?: number;
	/** Word spacing in em. */
	wordSpacing?: number;
}

export interface PnpToolSupports {
	/** Tool ids granted to the candidate. */
	supports?: string[];
	/** Tool ids withdrawn from the candidate. */
	prohibitedSupports?: string[];
	/** Granted tool ids turned on at start. */
	activateAtInit?: string[];
	/** The candidate's settings per tool id. */
	toolParameters?: Record<string, Record<string, unknown>>;
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
