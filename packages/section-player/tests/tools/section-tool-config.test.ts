import { describe, expect, test } from 'bun:test';
import { pollyVoiceForLanguage, resolveSectionTtsProviderConfig } from '../../src/tools/section-tool-config';

describe('resolveSectionTtsProviderConfig', () => {
	test('keeps Polly defaults when no provider override is supplied', () => {
		expect(resolveSectionTtsProviderConfig()).toMatchObject({
			provider: 'polly',
			serverProvider: 'polly',
			transportMode: 'pie',
			endpointMode: 'synthesizePath',
			apiEndpoint: '/api/tts',
			engine: 'standard',
			format: 'mp3',
			speechMarksMode: 'word',
			validateEndpoint: false,
			settings: {
				layoutMode: 'expanding-row',
			},
		});
	});

	test('lets consumer provider values override defaults without losing default settings', () => {
		expect(
			resolveSectionTtsProviderConfig({
				provider: 'custom',
				serverProvider: 'custom',
				apiEndpoint: 'https://tts.example.test/speak',
				transportMode: 'custom',
				endpointMode: 'rootPost',
				defaultVoice: 'Ava',
				settings: {
					speedControl: true,
				},
			}),
		).toMatchObject({
			provider: 'custom',
			serverProvider: 'custom',
			apiEndpoint: 'https://tts.example.test/speak',
			transportMode: 'custom',
			endpointMode: 'rootPost',
			defaultVoice: 'Ava',
			settings: {
				layoutMode: 'expanding-row',
				speedControl: true,
			},
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
		const config = resolveSectionTtsProviderConfig({ provider: 'browser', serverProvider: 'browser' }, 'es');
		expect(config.language).toBe('es');
		expect(config).not.toHaveProperty('defaultVoice');
	});

	test('finds no voice for a language without one', () => {
		expect(pollyVoiceForLanguage('xx')).toBeUndefined();
		expect(pollyVoiceForLanguage('pt_PT')).toBe('Ines');
	});
});
