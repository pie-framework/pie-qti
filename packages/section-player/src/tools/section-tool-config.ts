const defaultTtsSettings = {
	layoutMode: 'expanding-row',
};

export const defaultSectionTtsProviderConfig = {
	provider: 'polly',
	serverProvider: 'polly',
	transportMode: 'pie',
	endpointMode: 'synthesizePath',
	apiEndpoint: '/api/tts',
	defaultVoice: 'Joanna',
	engine: 'standard',
	format: 'mp3',
	speechMarksMode: 'word',
	validateEndpoint: false,
	settings: defaultTtsSettings,
};

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function resolveSectionTtsProviderConfig(provider: Record<string, unknown> = {}) {
	const providerSettings = asRecord(provider.settings);

	return {
		...defaultSectionTtsProviderConfig,
		...provider,
		settings: {
			...defaultTtsSettings,
			...providerSettings,
		},
	};
}
