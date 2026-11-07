/**
 * Standard QTI mediaInteraction extractor
 *
 * Extracts data from mediaInteraction elements (video/audio playback): every
 * `<source>` and every `<track>` (captions, subtitles, descriptions) of QTI 2.2
 * and QTI 3.0 `audio`/`video` content, or the legacy QTI 2.1 `<object>`.
 */

import type { ElementExtractor, ExtractionUtils } from '../../extraction/types.js';
import type {
	MediaElement,
	MediaElementSource,
	MediaElementTrack,
	MediaTrackKind,
	QTIElement,
} from '../shared/types.js';

export type { MediaElement };

const TRACK_KINDS: readonly MediaTrackKind[] = ['subtitles', 'captions', 'descriptions', 'chapters', 'metadata'];

/**
 * The track kind as HTML reads it: a missing kind is `subtitles`, an
 * unrecognized one is `metadata` (which no browser displays).
 */
function trackKind(value: string | undefined): MediaTrackKind {
	if (value === undefined || value.trim() === '') return 'subtitles';
	const normalized = value.trim().toLowerCase();
	return TRACK_KINDS.find((kind) => kind === normalized) ?? 'metadata';
}

/**
 * An HTML boolean attribute, which QTI XML writes as an `xs:boolean`: present
 * means on (`default`, `default="default"`, `default="true"`), except an
 * explicit `false` or `0`.
 */
function isBooleanAttributeOn(element: QTIElement, name: string): boolean {
	const value = element.getAttribute(name);
	if (value === undefined || value === null) return false;
	const normalized = value.trim().toLowerCase();
	return normalized !== 'false' && normalized !== '0';
}

/** HTML's CORS mode for a media element: an empty or unknown value is `anonymous`. */
function crossOriginMode(element: QTIElement): MediaElement['crossOrigin'] {
	const value = element.getAttribute('crossorigin');
	if (value === undefined || value === null) return undefined;
	return value.trim().toLowerCase() === 'use-credentials' ? 'use-credentials' : 'anonymous';
}

/**
 * Every source of an audio or video element, in document order. As in HTML, a
 * `src` attribute on the element itself takes precedence over `<source>` children.
 */
function readSources(mediaElement: QTIElement, utils: ExtractionUtils): MediaElementSource[] {
	const ownSrc = utils.getAttribute(mediaElement, 'src', '');
	if (ownSrc) return [{ src: ownSrc, mimeType: '' }];
	return utils.getChildrenByTag(mediaElement, 'source').map((source) => ({
		src: utils.getAttribute(source, 'src', ''),
		mimeType: utils.getAttribute(source, 'type', ''),
	}));
}

/** Every text track (captions, subtitles, descriptions, chapters) of an audio or video element. */
function readTracks(mediaElement: QTIElement, utils: ExtractionUtils): MediaElementTrack[] {
	return utils
		.getChildrenByTag(mediaElement, 'track')
		.map((track) => {
			const parsed: MediaElementTrack = {
				src: utils.getAttribute(track, 'src', ''),
				kind: trackKind(track.getAttribute('kind')),
			};
			const srclang = utils.getAttribute(track, 'srclang', '');
			if (srclang) parsed.srclang = srclang;
			const label = utils.getAttribute(track, 'label', '');
			if (label) parsed.label = label;
			if (isBooleanAttributeOn(track, 'default')) parsed.default = true;
			return parsed;
		})
		.filter((track) => track.src !== '');
}

/** An audio or video element with all of its sources and text tracks. */
function readPlayableMedia(
	type: 'audio' | 'video',
	mediaElement: QTIElement,
	utils: ExtractionUtils,
): MediaElement {
	const sources = readSources(mediaElement, utils);
	const [firstSource] = sources;
	if (!firstSource) {
		throw new Error(`${type} element must contain at least one source element`);
	}
	const crossOrigin = crossOriginMode(mediaElement);
	return {
		type,
		src: firstSource.src,
		mimeType: firstSource.mimeType,
		...(type === 'video'
			? {
					width: utils.getNumberAttribute(mediaElement, 'width', 640),
					height: utils.getNumberAttribute(mediaElement, 'height', 480),
				}
			: {}),
		sources,
		tracks: readTracks(mediaElement, utils),
		...(crossOrigin ? { crossOrigin } : {}),
	};
}

/**
 * Media data extracted from mediaInteraction elements
 */
export interface MediaData {
	mediaElement: MediaElement | null;
	autostart: boolean;
	minPlays: number;
	maxPlays: number;
	loop: boolean;
	prompt: string | null;
}

/**
 * Standard QTI media interaction extractor
 * Handles mediaInteraction elements (video/audio playback with interaction)
 */
export const standardMediaExtractor: ElementExtractor<MediaData> = {
	id: 'qti:media-interaction',
	name: 'QTI Standard Media Interaction',
	priority: 10,
	elementTypes: ['mediaInteraction'],
	description: 'Extracts standard QTI mediaInteraction (video/audio playback)',

	canHandle(element, context) {
		// All mediaInteraction elements are standard
		return context.utils.matchesTag(element, 'mediaInteraction');
	},

	extract(element, context) {
		const { utils } = context;

		// Extract attributes
		const autostart = utils.getBooleanAttribute(element, 'autostart', false);
		const minPlays = utils.getNumberAttribute(element, 'minPlays', 0);
		const maxPlays = utils.getNumberAttribute(element, 'maxPlays', 0);
		const loop = utils.getBooleanAttribute(element, 'loop', false);

		// Extract prompt (optional)
		const promptElements = utils.getChildrenByTag(element, 'prompt');
		const prompt = promptElements.length > 0 ? utils.getHtmlContent(promptElements[0]) : null;

		// Extract media element (audio, video, or object). The schema allows exactly
		// one; should several appear, the last kind checked wins, as before.
		let mediaElement: MediaElement | null = null;

		const [audioElement] = utils.getChildrenByTag(element, 'audio');
		if (audioElement) {
			mediaElement = readPlayableMedia('audio', audioElement, utils);
		}

		const [videoElement] = utils.getChildrenByTag(element, 'video');
		if (videoElement) {
			mediaElement = readPlayableMedia('video', videoElement, utils);
		}

		// Check for object element
		const objectElements = utils.getChildrenByTag(element, 'object');
		if (objectElements.length > 0) {
			const objectElement = objectElements[0];
			const data = utils.getAttribute(objectElement, 'data', '');
			if (!data) {
				throw new Error('object element must have data attribute');
			}
			const width = utils.getNumberAttribute(objectElement, 'width', 0);
			const height = utils.getNumberAttribute(objectElement, 'height', 0);
			mediaElement = {
				type: 'object',
				src: data,
				mimeType: utils.getAttribute(objectElement, 'type', ''),
				...(width > 0 ? { width } : {}),
				...(height > 0 ? { height } : {}),
			};
		}

		// Throw error if no media element found
		if (!mediaElement) {
			throw new Error('mediaInteraction must contain audio, video, or object element');
		}

		return {
			mediaElement,
			autostart,
			minPlays,
			maxPlays,
			loop,
			prompt,
		};
	},

	validate(data) {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Validate media element exists
		if (!data.mediaElement) {
			errors.push('mediaInteraction must have a mediaElement');
		}

		// Validate play constraints
		if (data.minPlays < 0) {
			errors.push('minPlays must be non-negative');
		}

		if (data.maxPlays < 0) {
			errors.push('maxPlays must be non-negative');
		}

		// Validate minPlays <= maxPlays (when maxPlays > 0, as 0 means unlimited)
		if (data.maxPlays > 0 && data.minPlays > data.maxPlays) {
			errors.push(`maxPlays (${data.maxPlays}) must be greater than or equal to minPlays (${data.minPlays})`);
		}

		// Looping honors the limit: playback restarts only until maxPlays plays have started.
		if (data.loop && data.maxPlays > 0) {
			warnings.push('mediaInteraction has loop=true with maxPlays - looping stops once maxPlays plays have started');
		}

		return {
			valid: errors.length === 0,
			errors: errors.length > 0 ? errors : undefined,
			warnings: warnings.length > 0 ? warnings : undefined,
		};
	},
};
