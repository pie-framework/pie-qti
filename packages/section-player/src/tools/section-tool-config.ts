import type { PnpProfile } from '@pie-qti/item-player';
import { warnOnce } from '@pie-qti/qti-common';

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

/**
 * The assessment a section tool bar binds to its toolkit: the host's assessment
 * identity, and the candidate's PNP tool supports as its personal needs profile.
 * With PNP enforcement on, the toolkit reads the profile to protect granted tools
 * (they skip its content-relevance check, so a granted ruler shows on an item
 * without math markup) and to withdraw prohibited ones.
 */
export function toolkitAssessmentOf(
	assessmentId: string,
	pnp: PnpProfile | undefined,
): { id: string; personalNeedsProfile?: Record<string, unknown> } {
	const tools = pnp?.tools;
	const supports = tools?.supports ?? [];
	const prohibitedSupports = tools?.prohibitedSupports ?? [];
	const activateAtInit = tools?.activateAtInit ?? [];
	if (supports.length === 0 && prohibitedSupports.length === 0 && activateAtInit.length === 0) {
		return { id: assessmentId };
	}
	return {
		id: assessmentId,
		personalNeedsProfile: {
			supports: [...supports],
			...(prohibitedSupports.length > 0 ? { prohibitedSupports: [...prohibitedSupports] } : {}),
			...(activateAtInit.length > 0 ? { activateAtInit: [...activateAtInit] } : {}),
			...(tools?.toolParameters ? { toolParameters: tools.toolParameters } : {}),
		},
	};
}

/**
 * The TTS provider config for one scope: the host's record, in the toolkit's own shape, over the
 * defaults. The content language sets the synthesis language and, for Polly, the voice; a voice
 * the host configures wins.
 */
export function resolveSectionTtsProviderConfig(
	provider: Record<string, unknown> = {},
	language?: string,
): Record<string, unknown> {
	const resolved: Record<string, unknown> = { ...defaultSectionTtsProviderConfig, ...provider };
	const polly = resolved.backend === 'server' && resolved.serverProvider === 'polly';
	if (polly && resolved.endpointMode === 'synthesizePath' && resolved.apiEndpoint === defaultSectionTtsProviderConfig.apiEndpoint && !('apiEndpoint' in provider)) {
		warnOnce(
			'section-player:tts-default-endpoint',
			`TTS tool uses the default host-served endpoint ${String(defaultSectionTtsProviderConfig.apiEndpoint)}: the host must serve that route (Polly-backed) or override sectionTools[].provider.apiEndpoint.`,
		);
	}
	const voice = typeof provider.defaultVoice === 'string' ? undefined : polly ? pollyVoiceForLanguage(language) : undefined;

	return {
		...resolved,
		...(language ? { language } : {}),
		...(voice ? { defaultVoice: voice } : {}),
	};
}
