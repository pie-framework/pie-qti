import { describe, expect, test } from 'bun:test';
import { resolveSectionTtsProviderConfig } from '../../src/tools/section-tool-config';

describe('resolveSectionTtsProviderConfig', () => {
	test('keeps Polly defaults when no provider override is supplied', () => {
		expect(resolveSectionTtsProviderConfig()).toMatchObject({
			provider: 'polly',
			serverProvider: 'polly',
			transportMode: 'pie',
			endpointMode: 'synthesizePath',
			apiEndpoint: '/api/tts',
			defaultVoice: 'Joanna',
			engine: 'standard',
			format: 'mp3',
			speechMarksMode: 'word',
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
});
