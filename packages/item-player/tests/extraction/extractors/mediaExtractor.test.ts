/**
 * Tests for standardMediaExtractor
 */

import { describe, expect, test } from 'bun:test';
import { Qti3AttributeNameMapper, Qti3ElementNameMapper } from '@pie-qti/qti-common';
import { standardMediaExtractor } from '../../../src/interactions/media/extractor.js';
import { createTestContext, parseQTI } from '../test-utils.js';

describe('standardMediaExtractor', () => {
	describe('Audio MediaInteraction', () => {
		test('extracts audio mediaInteraction with HTML5 audio element', () => {
			const xml = `
				<mediaInteraction responseIdentifier="RESPONSE" minPlays="1" maxPlays="3">
					<prompt>Listen to the audio clip</prompt>
					<audio>
						<source src="audio.mp3" type="audio/mpeg"/>
					</audio>
				</mediaInteraction>
			`;

			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE');

			const result = standardMediaExtractor.extract(element, context);

			expect(result.prompt).toBe('Listen to the audio clip');
			expect(result.minPlays).toBe(1);
			expect(result.maxPlays).toBe(3);
			expect(result.autostart).toBe(false);
			expect(result.loop).toBe(false);
			expect(result.mediaElement.type).toBe('audio');
			expect(result.mediaElement.src).toBe('audio.mp3');
			expect(result.mediaElement.mimeType).toBe('audio/mpeg');
		});

		test('extracts audio with multiple source elements', () => {
			const xml = `
				<mediaInteraction responseIdentifier="RESPONSE">
					<audio>
						<source src="audio.mp3" type="audio/mpeg"/>
						<source src="audio.ogg" type="audio/ogg"/>
					</audio>
				</mediaInteraction>
			`;

			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE');

			const result = standardMediaExtractor.extract(element, context);

			// The first source stays the single-URL `src`; every source is kept in order
			// so the browser can fall back to the next one it can play.
			expect(result.mediaElement.src).toBe('audio.mp3');
			expect(result.mediaElement.mimeType).toBe('audio/mpeg');
			expect(result.mediaElement.sources).toEqual([
				{ src: 'audio.mp3', mimeType: 'audio/mpeg' },
				{ src: 'audio.ogg', mimeType: 'audio/ogg' },
			]);
			expect(result.mediaElement.tracks).toEqual([]);
		});

		test('reads the src attribute of an audio element without source children', () => {
			const xml = `
				<mediaInteraction responseIdentifier="RESPONSE">
					<audio src="audio.mp3"></audio>
				</mediaInteraction>
			`;

			const element = parseQTI(xml);
			const result = standardMediaExtractor.extract(element, createTestContext(element, 'RESPONSE'));

			expect(result.mediaElement.src).toBe('audio.mp3');
			expect(result.mediaElement.sources).toEqual([{ src: 'audio.mp3', mimeType: '' }]);
		});

		test('throws error if audio element has no source', () => {
			const xml = `
				<mediaInteraction responseIdentifier="RESPONSE">
					<audio></audio>
				</mediaInteraction>
			`;

			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE');

			expect(() => standardMediaExtractor.extract(element, context)).toThrow(
				'audio element must contain at least one source element'
			);
		});
	});

	describe('Video MediaInteraction', () => {
		test('extracts video mediaInteraction with HTML5 video element', () => {
			const xml = `
				<mediaInteraction responseIdentifier="RESPONSE" autostart="true" loop="true">
					<prompt>Watch the video clip</prompt>
					<video width="640" height="480">
						<source src="video.mp4" type="video/mp4"/>
					</video>
				</mediaInteraction>
			`;

			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE');

			const result = standardMediaExtractor.extract(element, context);

			expect(result.autostart).toBe(true);
			expect(result.loop).toBe(true);
			expect(result.mediaElement.type).toBe('video');
			expect(result.mediaElement.src).toBe('video.mp4');
			expect(result.mediaElement.mimeType).toBe('video/mp4');
			expect(result.mediaElement.width).toBe(640);
			expect(result.mediaElement.height).toBe(480);
		});

		test('uses default dimensions if not specified', () => {
			const xml = `
				<mediaInteraction responseIdentifier="RESPONSE">
					<video>
						<source src="video.mp4" type="video/mp4"/>
					</video>
				</mediaInteraction>
			`;

			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE');

			const result = standardMediaExtractor.extract(element, context);

			expect(result.mediaElement.width).toBe(640);
			expect(result.mediaElement.height).toBe(480);
		});

		test('extracts every source and every caption, subtitle and description track', () => {
			const xml = `
				<mediaInteraction responseIdentifier="RESPONSE">
					<video width="320" height="180" crossorigin="anonymous">
						<source src="clip.webm" type="video/webm"/>
						<source src="clip.mp4" type="video/mp4"/>
						<track kind="captions" srclang="en" label="English" src="captions-en.vtt" default="true"/>
						<track kind="subtitles" srclang="es" label="Español" src="subtitles-es.vtt"/>
						<track kind="descriptions" srclang="en" src="descriptions.vtt" default="false"/>
						<track srclang="fr" src="no-kind.vtt"/>
						<track kind="caption" src="typo.vtt"/>
						<track kind="captions" label="Missing source"/>
					</video>
				</mediaInteraction>
			`;

			const element = parseQTI(xml);
			const result = standardMediaExtractor.extract(element, createTestContext(element, 'RESPONSE'));

			expect(result.mediaElement).toMatchObject({
				type: 'video',
				src: 'clip.webm',
				mimeType: 'video/webm',
				width: 320,
				height: 180,
				crossOrigin: 'anonymous',
			});
			expect(result.mediaElement.sources).toEqual([
				{ src: 'clip.webm', mimeType: 'video/webm' },
				{ src: 'clip.mp4', mimeType: 'video/mp4' },
			]);
			expect(result.mediaElement.tracks).toEqual([
				{ kind: 'captions', srclang: 'en', label: 'English', src: 'captions-en.vtt', default: true },
				{ kind: 'subtitles', srclang: 'es', label: 'Español', src: 'subtitles-es.vtt' },
				{ kind: 'descriptions', srclang: 'en', src: 'descriptions.vtt' },
				// HTML reads a missing kind as subtitles and an unknown one as metadata.
				{ kind: 'subtitles', srclang: 'fr', src: 'no-kind.vtt' },
				{ kind: 'metadata', src: 'typo.vtt' },
			]);
		});

		test('reads the HTML boolean default attribute by presence', () => {
			const xml = `
				<mediaInteraction responseIdentifier="RESPONSE">
					<video>
						<source src="clip.mp4" type="video/mp4"/>
						<track kind="captions" src="valueless.vtt" default/>
						<track kind="captions" src="named.vtt" default="default"/>
						<track kind="captions" src="off.vtt" default="0"/>
					</video>
				</mediaInteraction>
			`;

			const element = parseQTI(xml);
			const result = standardMediaExtractor.extract(element, createTestContext(element, 'RESPONSE'));

			expect(result.mediaElement.tracks?.map((track) => track.default ?? false)).toEqual([true, true, false]);
		});

		test('extracts QTI 3.0 qti-media-interaction video sources and tracks', () => {
			const xml = `
				<qti-media-interaction response-identifier="RESPONSE" autostart="false" min-plays="1" max-plays="2">
					<qti-prompt>Watch the clip.</qti-prompt>
					<video width="640" height="360">
						<source src="clip.mp4" type="video/mp4"/>
						<track kind="captions" srclang="en" label="English captions" src="captions.vtt"/>
					</video>
				</qti-media-interaction>
			`;

			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE', element, new Map(), {
				elementNameMapper: new Qti3ElementNameMapper(),
				attributeNameMapper: new Qti3AttributeNameMapper(),
			} as any);

			expect(standardMediaExtractor.canHandle(element, context)).toBe(true);
			const result = standardMediaExtractor.extract(element, context);

			expect(result.minPlays).toBe(1);
			expect(result.maxPlays).toBe(2);
			expect(result.prompt).toBe('Watch the clip.');
			expect(result.mediaElement.sources).toEqual([{ src: 'clip.mp4', mimeType: 'video/mp4' }]);
			expect(result.mediaElement.tracks).toEqual([
				{ kind: 'captions', srclang: 'en', label: 'English captions', src: 'captions.vtt' },
			]);
		});

		test('throws error if video element has no source', () => {
			const xml = `
				<mediaInteraction responseIdentifier="RESPONSE">
					<video></video>
				</mediaInteraction>
			`;

			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE');

			expect(() => standardMediaExtractor.extract(element, context)).toThrow(
				'video element must contain at least one source element'
			);
		});
	});

	describe('Object MediaInteraction', () => {
		test('extracts media from object element', () => {
			const xml = `
				<mediaInteraction responseIdentifier="RESPONSE" minPlays="2">
					<object data="media.mp3" type="audio/mpeg" width="400" height="300"/>
				</mediaInteraction>
			`;

			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE');

			const result = standardMediaExtractor.extract(element, context);

			expect(result.mediaElement.type).toBe('object');
			expect(result.mediaElement.src).toBe('media.mp3');
			expect(result.mediaElement.mimeType).toBe('audio/mpeg');
			expect(result.mediaElement.width).toBe(400);
			expect(result.mediaElement.height).toBe(300);
			expect(result.minPlays).toBe(2);
		});

		test('throws error if object element has no data attribute', () => {
			const xml = `
				<mediaInteraction responseIdentifier="RESPONSE">
					<object type="audio/mpeg"/>
				</mediaInteraction>
			`;

			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE');

			expect(() => standardMediaExtractor.extract(element, context)).toThrow(
				'object element must have data attribute'
			);
		});
	});

	describe('Default Values', () => {
		test('uses default values when attributes are not specified', () => {
			const xml = `
				<mediaInteraction responseIdentifier="RESPONSE">
					<audio>
						<source src="audio.mp3" type="audio/mpeg"/>
					</audio>
				</mediaInteraction>
			`;

			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE');

			const result = standardMediaExtractor.extract(element, context);

			expect(result.autostart).toBe(false);
			expect(result.minPlays).toBe(0);
			expect(result.maxPlays).toBe(0); // 0 means unlimited
			expect(result.loop).toBe(false);
			expect(result.prompt).toBeNull();
		});
	});

	describe('Error Handling', () => {
		test('throws error if no media element is present', () => {
			const xml = `
				<mediaInteraction responseIdentifier="RESPONSE">
					<prompt>No media element</prompt>
				</mediaInteraction>
			`;

			const element = parseQTI(xml);
			const context = createTestContext(element, 'RESPONSE');

			expect(() => standardMediaExtractor.extract(element, context)).toThrow(
				'mediaInteraction must contain audio, video, or object element'
			);
		});
	});

	describe('canHandle predicate', () => {
		test('handles mediaInteraction element', () => {
			const xml = `
				<mediaInteraction responseIdentifier="RESPONSE">
					<audio><source src="test.mp3" type="audio/mpeg"/></audio>
				</mediaInteraction>
			`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardMediaExtractor.canHandle(element, context)).toBe(true);
		});

		test('rejects non-mediaInteraction elements', () => {
			const xml = `<choiceInteraction responseIdentifier="RESPONSE" />`;
			const element = parseQTI(xml);
			const context = createTestContext(element);

			expect(standardMediaExtractor.canHandle(element, context)).toBe(false);
		});
	});

	describe('validation', () => {
		test('validates correct media data', () => {
			const data = {
				mediaElement: { type: 'audio', src: 'audio.mp3', mimeType: 'audio/mpeg' },
				autostart: false,
				minPlays: 0,
				maxPlays: 0,
				loop: false,
				prompt: null,
			};

			const validation = standardMediaExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.errors).toBeUndefined();
		});

		test('reports error for missing mediaElement', () => {
			const data = {
				mediaElement: null,
				autostart: false,
				minPlays: 0,
				maxPlays: 0,
				loop: false,
				prompt: null,
			};

			const validation = standardMediaExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('mediaInteraction must have a mediaElement');
		});

		test('reports error when maxPlays < minPlays', () => {
			const data = {
				mediaElement: { type: 'audio', src: 'audio.mp3', mimeType: 'audio/mpeg' },
				autostart: false,
				minPlays: 5,
				maxPlays: 2,
				loop: false,
				prompt: null,
			};

			const validation = standardMediaExtractor.validate!(data);

			expect(validation.valid).toBe(false);
			expect(validation.errors).toContain('maxPlays (2) must be greater than or equal to minPlays (5)');
		});

		test('reports warning when loop is true with maxPlays', () => {
			const data = {
				mediaElement: { type: 'audio', src: 'audio.mp3', mimeType: 'audio/mpeg' },
				autostart: false,
				minPlays: 0,
				maxPlays: 5,
				loop: true,
				prompt: null,
			};

			const validation = standardMediaExtractor.validate!(data);

			expect(validation.valid).toBe(true);
			expect(validation.warnings).toContain(
				'mediaInteraction has loop=true with maxPlays - looping stops once maxPlays plays have started'
			);
		});
	});
});
