import { describe, expect, test } from 'bun:test';
import { pollyVoiceForLanguage, resolveSectionTtsProviderConfig } from '../../src/tools/section-tool-config';

describe('resolveSectionTtsProviderConfig', () => {
	test('keeps Polly defaults when no provider override is supplied', () => {
		expect(resolveSectionTtsProviderConfig()).toEqual({
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
		});
	});

	test('lets consumer provider values override defaults', () => {
		expect(
			resolveSectionTtsProviderConfig({
				serverProvider: 'custom',
				apiEndpoint: 'https://tts.example.test/speak',
				transportMode: 'custom',
				endpointMode: 'rootPost',
				defaultVoice: 'Ava',
				layoutMode: 'left-aligned',
			}),
		).toMatchObject({
			backend: 'server',
			serverProvider: 'custom',
			apiEndpoint: 'https://tts.example.test/speak',
			transportMode: 'custom',
			endpointMode: 'rootPost',
			defaultVoice: 'Ava',
			layoutMode: 'left-aligned',
		});
	});

	test('maps the pre-1.0 toolkit keys onto the 1.0 shape', () => {
		const config = resolveSectionTtsProviderConfig({
			provider: 'custom',
			validateEndpoint: true,
			settings: { layoutMode: 'left-aligned', speedOptions: [1, 1.5] },
		});
		expect(config).toMatchObject({
			backend: 'server',
			serverProvider: 'custom',
			layoutMode: 'left-aligned',
			speedOptions: [1, 1.5],
		});
		expect(config).not.toHaveProperty('provider');
		expect(config).not.toHaveProperty('settings');
		expect(config).not.toHaveProperty('validateEndpoint');
		expect(resolveSectionTtsProviderConfig({ provider: 'browser' })).toMatchObject({ backend: 'browser' });
		expect(resolveSectionTtsProviderConfig({ provider: { id: 'tts-server' } })).toMatchObject({
			provider: { id: 'tts-server' },
		});
	});

	test('leaves the voice to the toolkit when no content language is given', () => {
		expect(resolveSectionTtsProviderConfig()).not.toHaveProperty('defaultVoice');
		expect(resolveSectionTtsProviderConfig()).not.toHaveProperty('language');
	});

	test('sets the language and the Polly voice from the content language', () => {
		expect(resolveSectionTtsProviderConfig({}, 'es')).toMatchObject({ language: 'es', defaultVoice: 'Lupe' });
		expect(resolveSectionTtsProviderConfig({}, 'fr-CA')).toMatchObject({ language: 'fr-CA', defaultVoice: 'Chantal' });
		expect(resolveSectionTtsProviderConfig({}, 'fr-BE')).toMatchObject({ language: 'fr-BE', defaultVoice: 'Celine' });
	});

	test('keeps a voice the host configures', () => {
		expect(resolveSectionTtsProviderConfig({ defaultVoice: 'Matthew' }, 'es')).toMatchObject({
			language: 'es',
			defaultVoice: 'Matthew',
		});
	});

	test('picks no Polly voice for another provider', () => {
		const config = resolveSectionTtsProviderConfig({ backend: 'browser' }, 'es');
		expect(config.language).toBe('es');
		expect(config).not.toHaveProperty('defaultVoice');
	});

	test('finds no voice for a language without one', () => {
		expect(pollyVoiceForLanguage('xx')).toBeUndefined();
		expect(pollyVoiceForLanguage('pt_PT')).toBe('Ines');
	});
});
