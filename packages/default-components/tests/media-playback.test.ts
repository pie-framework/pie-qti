import { describe, expect, test } from 'bun:test';
import {
	canStartPlay,
	defaultTextTrackIndex,
	formatPlaybackTime,
	normalizePlayCount,
	normalizePlayLimit,
	playableSources,
	playsLeft,
	renderableTracks,
	selectableTextTracks,
} from '../src/plugins/media/mediaPlayback';

describe('media playback helpers', () => {
	test('a play count is a non-negative integer', () => {
		expect(normalizePlayCount(3)).toBe(3);
		expect(normalizePlayCount('2')).toBe(2);
		expect(normalizePlayCount(2.7)).toBe(2);
		expect(normalizePlayCount(-1)).toBe(0);
		expect(normalizePlayCount(null)).toBe(0);
		expect(normalizePlayCount(undefined)).toBe(0);
		expect(normalizePlayCount('')).toBe(0);
		expect(normalizePlayCount(Number.NaN)).toBe(0);
	});

	test('a play limit of zero or less means unlimited', () => {
		expect(normalizePlayLimit(2)).toBe(2);
		expect(normalizePlayLimit(0)).toBe(0);
		expect(normalizePlayLimit(-3)).toBe(0);
		expect(normalizePlayLimit(undefined)).toBe(0);

		expect(canStartPlay(5, 0)).toBe(true);
		expect(canStartPlay(1, 2)).toBe(true);
		expect(canStartPlay(2, 2)).toBe(false);
		expect(playsLeft(1, 3)).toBe(2);
		expect(playsLeft(4, 3)).toBe(0);
		expect(playsLeft(4, 0)).toBeNull();
	});

	test('sources and tracks whose URL the delivery policy blocked are dropped', () => {
		const media = {
			type: 'video' as const,
			src: 'a.webm',
			mimeType: 'video/webm',
			sources: [
				{ src: 'a.webm', mimeType: 'video/webm' },
				{ src: '', mimeType: 'video/mp4' },
			],
			tracks: [
				{ kind: 'captions' as const, src: 'en.vtt', srclang: 'en' },
				{ kind: 'captions' as const, src: '' },
			],
		};
		expect(playableSources(media)).toEqual([{ src: 'a.webm', mimeType: 'video/webm' }]);
		expect(renderableTracks(media)).toEqual([{ kind: 'captions', src: 'en.vtt', srclang: 'en' }]);
		// Data built without `sources` falls back to the single src.
		expect(playableSources({ type: 'audio', src: 'b.mp3', mimeType: 'audio/mpeg' })).toEqual([
			{ src: 'b.mp3', mimeType: 'audio/mpeg' },
		]);
		expect(playableSources({ type: 'audio', src: '', mimeType: 'audio/mpeg' })).toEqual([]);
	});

	test('only caption and subtitle tracks are selectable, by their text track index', () => {
		const tracks = [
			{ kind: 'descriptions' as const, src: 'd.vtt' },
			{ kind: 'captions' as const, src: 'c.vtt' },
			{ kind: 'subtitles' as const, src: 's.vtt', default: true },
			{ kind: 'chapters' as const, src: 'ch.vtt' },
		];
		const selectable = selectableTextTracks(tracks);
		expect(selectable.map((entry) => entry.index)).toEqual([1, 2]);
		expect(defaultTextTrackIndex(selectable)).toBe(2);
		expect(defaultTextTrackIndex(selectableTextTracks([{ kind: 'captions', src: 'c.vtt' }]))).toBeNull();
	});

	test('playback times read as m:ss or h:mm:ss, and unknown as --:--', () => {
		expect(formatPlaybackTime(0)).toBe('0:00');
		expect(formatPlaybackTime(65.9)).toBe('1:05');
		expect(formatPlaybackTime(3725)).toBe('1:02:05');
		expect(formatPlaybackTime(Number.NaN)).toBe('--:--');
		expect(formatPlaybackTime(Number.POSITIVE_INFINITY)).toBe('--:--');
	});
});
