/**
 * Standard QTI mediaInteraction extractor
 *
 * Extracts data from mediaInteraction elements (video/audio playback)
 */

import type { ElementExtractor } from '../types.js';

/**
 * Media element data
 */
export interface MediaElement {
	type: 'audio' | 'video' | 'object';
	src: string;
	mimeType: string;
	width?: number;
	height?: number;
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

	canHandle(element, _context) {
		// All mediaInteraction elements are standard
		return element.rawTagName === 'mediaInteraction';
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

		// Extract media element (audio, video, or object)
		let mediaElement: MediaElement | null = null;

		// Check for audio element
		const audioElements = utils.getChildrenByTag(element, 'audio');
		if (audioElements.length > 0) {
			const audioElement = audioElements[0];
			const sourceElements = utils.getChildrenByTag(audioElement, 'source');
			if (sourceElements.length === 0) {
				throw new Error('audio element must contain at least one source element');
			}
			const firstSource = sourceElements[0];
			mediaElement = {
				type: 'audio',
				src: utils.getAttribute(firstSource, 'src', ''),
				mimeType: utils.getAttribute(firstSource, 'type', ''),
			};
		}

		// Check for video element
		const videoElements = utils.getChildrenByTag(element, 'video');
		if (videoElements.length > 0) {
			const videoElement = videoElements[0];
			const sourceElements = utils.getChildrenByTag(videoElement, 'source');
			if (sourceElements.length === 0) {
				throw new Error('video element must contain at least one source element');
			}
			const firstSource = sourceElements[0];
			const width = utils.getNumberAttribute(videoElement, 'width', 640);
			const height = utils.getNumberAttribute(videoElement, 'height', 480);
			mediaElement = {
				type: 'video',
				src: utils.getAttribute(firstSource, 'src', ''),
				mimeType: utils.getAttribute(firstSource, 'type', ''),
				width,
				height,
			};
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

		// Warn if loop is true with maxPlays
		if (data.loop && data.maxPlays > 0) {
			warnings.push('mediaInteraction has loop=true with maxPlays - loop may be ignored');
		}

		return {
			valid: errors.length === 0,
			errors: errors.length > 0 ? errors : undefined,
			warnings: warnings.length > 0 ? warnings : undefined,
		};
	},
};
