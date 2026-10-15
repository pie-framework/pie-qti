const defaultTtsSettings = {
	layoutMode: 'expanding-row',
};

export const defaultSectionTtsProviderConfig = {
	provider: 'polly',
	serverProvider: 'polly',
	transportMode: 'pie',
	endpointMode: 'synthesizePath',
	apiEndpoint: '/api/tts',
	engine: 'standard',
	format: 'mp3',
	speechMarksMode: 'word',
	validateEndpoint: false,
	settings: defaultTtsSettings,
};

/**
 * A Polly standard-engine voice per content language, by full tag and then by primary subtag.
 * The toolkit falls back to its own English voice for a language missing here.
 */
const POLLY_VOICES: Readonly<Record<string, string>> = {
	en: 'Joanna',
	'en-us': 'Joanna',
	'en-gb': 'Amy',
	'en-au': 'Nicole',
	'en-in': 'Raveena',
	es: 'Lupe',
	'es-us': 'Lupe',
	'es-mx': 'Mia',
	'es-es': 'Lucia',
	fr: 'Celine',
	'fr-ca': 'Chantal',
	de: 'Vicki',
	it: 'Carla',
	pt: 'Camila',
	'pt-br': 'Camila',
	'pt-pt': 'Ines',
	nl: 'Lotte',
	da: 'Naja',
	nb: 'Liv',
	sv: 'Astrid',
	pl: 'Ewa',
	ro: 'Carmen',
	ru: 'Tatyana',
	tr: 'Filiz',
	cy: 'Gwyneth',
	is: 'Dora',
	ar: 'Zeina',
	hi: 'Aditi',
	ja: 'Mizuki',
	ko: 'Seoyeon',
	zh: 'Zhiyu',
	cmn: 'Zhiyu',
};

/** The Polly voice for a content language, when there is one. */
export function pollyVoiceForLanguage(language: string | undefined): string | undefined {
	const tag = language?.trim().toLowerCase().replace(/_/g, '-');
	if (!tag) return undefined;
	return POLLY_VOICES[tag] ?? POLLY_VOICES[tag.split('-')[0] as string];
}

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/**
 * The TTS provider config for one scope. The content language sets the synthesis language and,
 * for Polly, the voice; a voice the host configures wins.
 */
export function resolveSectionTtsProviderConfig(provider: Record<string, unknown> = {}, language?: string) {
	const providerSettings = asRecord(provider.settings);
	const resolved = { ...defaultSectionTtsProviderConfig, ...provider };
	const polly = resolved.provider === 'polly' || resolved.serverProvider === 'polly';
	const voice = typeof provider.defaultVoice === 'string' ? undefined : polly ? pollyVoiceForLanguage(language) : undefined;

	return {
		...resolved,
		...(language ? { language } : {}),
		...(voice ? { defaultVoice: voice } : {}),
		settings: {
			...defaultTtsSettings,
			...providerSettings,
		},
	};
}
