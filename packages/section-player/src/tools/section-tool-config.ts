export const defaultSectionTtsProviderConfig = {
	backend: 'server',
	serverProvider: 'polly',
	transportMode: 'pie',
	endpointMode: 'synthesizePath',
	apiEndpoint: '/api/tts',
	endpointValidationMode: 'none',
	engine: 'standard',
	format: 'mp3',
	speechMarksMode: 'word',
	layoutMode: 'expanding-row',
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
 * The pre-1.0 toolkit shape mapped onto the 1.0 one, which rejects a string `provider` and
 * reads no `settings` or `validateEndpoint`: a string `provider` names the backend or the
 * server provider, and `settings` move to the top level.
 */
function liftLegacyProviderKeys(provider: Record<string, unknown>): Record<string, unknown> {
	const { provider: legacyProvider, settings, validateEndpoint, ...rest } = provider;
	const lifted: Record<string, unknown> = { ...asRecord(settings), ...rest };
	if (typeof legacyProvider === 'string') {
		if (legacyProvider === 'browser') lifted.backend ??= 'browser';
		else {
			lifted.backend ??= 'server';
			lifted.serverProvider ??= legacyProvider;
		}
	} else if (legacyProvider !== undefined) {
		lifted.provider = legacyProvider;
	}
	if (validateEndpoint === false) lifted.endpointValidationMode ??= 'none';
	return lifted;
}

/**
 * The TTS provider config for one scope. The content language sets the synthesis language and,
 * for Polly, the voice; a voice the host configures wins.
 */
export function resolveSectionTtsProviderConfig(
	provider: Record<string, unknown> = {},
	language?: string,
): Record<string, unknown> {
	const hostConfig = liftLegacyProviderKeys(provider);
	const resolved: Record<string, unknown> = { ...defaultSectionTtsProviderConfig, ...hostConfig };
	const polly = resolved.backend === 'server' && resolved.serverProvider === 'polly';
	const voice = typeof hostConfig.defaultVoice === 'string' ? undefined : polly ? pollyVoiceForLanguage(language) : undefined;

	return {
		...resolved,
		...(language ? { language } : {}),
		...(voice ? { defaultVoice: voice } : {}),
	};
}
