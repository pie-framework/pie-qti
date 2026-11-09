import { describe, expect, test } from 'bun:test';
import { pollyVoiceForLanguage, resolveSectionTtsProviderConfig, toolkitAssessmentOf } from '../../src/tools/section-tool-config';

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

	test('applies the host record over the defaults as given, translating no keys', () => {
		expect(resolveSectionTtsProviderConfig({ provider: { id: 'tts-server' } })).toMatchObject({
			provider: { id: 'tts-server' },
		});
		// Only the toolkit's own keys configure it: a string `provider` does not name the server
		// (`serverProvider` does) and nested `settings` set no layout; both reach it unchanged.
		expect(
			resolveSectionTtsProviderConfig({ provider: 'custom', settings: { layoutMode: 'left-aligned' } }),
		).toMatchObject({
			backend: 'server',
			serverProvider: 'polly',
			layoutMode: 'expanding-row',
			provider: 'custom',
			settings: { layoutMode: 'left-aligned' },
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

describe('toolkitAssessmentOf', () => {
	test('names the assessment and binds no profile without PNP tool supports', () => {
		expect(toolkitAssessmentOf('assessment-1', undefined)).toEqual({ id: 'assessment-1' });
		expect(toolkitAssessmentOf('assessment-1', { display: { colorScheme: 'blackwhite' } })).toEqual({ id: 'assessment-1' });
	});

	test('binds the candidate\'s tool supports as the toolkit profile', () => {
		expect(
			toolkitAssessmentOf('assessment-1', {
				tools: {
					supports: ['ruler', 'calculator'],
					prohibitedSupports: ['textToSpeech'],
					activateAtInit: ['ruler'],
					toolParameters: { calculator: { type: 'scientific' } },
				},
			}),
		).toEqual({
			id: 'assessment-1',
			personalNeedsProfile: {
				supports: ['ruler', 'calculator'],
				prohibitedSupports: ['textToSpeech'],
				activateAtInit: ['ruler'],
				toolParameters: { calculator: { type: 'scientific' } },
			},
		});
		// A prohibition alone still binds, with no supports.
		expect(toolkitAssessmentOf('a', { tools: { prohibitedSupports: ['calculator'] } }).personalNeedsProfile).toEqual({
			supports: [],
			prohibitedSupports: ['calculator'],
		});
	});
});
