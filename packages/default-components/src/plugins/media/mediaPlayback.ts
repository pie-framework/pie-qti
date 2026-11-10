import type { MediaElement, MediaElementSource, MediaElementTrack } from '@pie-qti/item-player';
import { isAtLimit } from '../../shared/utils/capacity';

/**
 * Playback helpers for the media interaction.
 *
 * A *play* starts when playback begins at the start of the media: the first
 * time, after the media has ended, or after a paused player was returned to the
 * beginning. It counts once the media is actually playing (the `playing` event),
 * so a source that fails to load costs nothing. Pausing and resuming within a
 * play does not start a new one. The play count (the interaction's response)
 * counts plays started, so `maxPlays` bounds how many times the media can be
 * heard, however each play ends.
 */

/** A text track the candidate can switch on: a caption or subtitle track and its position. */
export interface SelectableTextTrack {
	/** Position among the rendered `<track>` elements, which is the `textTracks` index. */
	index: number;
	track: MediaElementTrack;
}

/** A play count from a response value: a non-negative integer, else 0. */
export function normalizePlayCount(value: unknown): number {
	const count = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
	return typeof count === 'number' && Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

/** A play limit from interaction data: a positive integer, or 0 for unlimited. */
export function normalizePlayLimit(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/** Whether another play may start under `maxPlays`: only a positive limit restricts, so 0 and a non-numeric limit are unlimited. */
export function canStartPlay(playCount: number, maxPlays: number): boolean {
	return !isAtLimit(playCount, maxPlays);
}

/** Plays still available under `maxPlays`; `null` when plays are unlimited. */
export function playsLeft(playCount: number, maxPlays: number): number | null {
	return maxPlays > 0 ? Math.max(0, maxPlays - playCount) : null;
}

/**
 * The sources to render, in document order. A URL the delivery policy blocked
 * arrives empty and is dropped; data built without `sources` falls back to `src`.
 */
export function playableSources(media: MediaElement): MediaElementSource[] {
	const sources = media.sources ?? [{ src: media.src, mimeType: media.mimeType }];
	return sources.filter((source) => typeof source.src === 'string' && source.src !== '');
}

/** The text tracks to render, in document order, without tracks whose URL was blocked. */
export function renderableTracks(media: MediaElement): MediaElementTrack[] {
	return (media.tracks ?? []).filter((track) => typeof track.src === 'string' && track.src !== '');
}

/** The caption and subtitle tracks among `tracks`, which a candidate can turn on. */
export function selectableTextTracks(tracks: readonly MediaElementTrack[]): SelectableTextTrack[] {
	return tracks.flatMap((track, index) =>
		track.kind === 'captions' || track.kind === 'subtitles' ? [{ index, track }] : [],
	);
}

/** The selectable track a browser shows by default (the first marked `default`), or `null`. */
export function defaultTextTrackIndex(tracks: readonly SelectableTextTrack[]): number | null {
	return tracks.find((entry) => entry.track.default)?.index ?? null;
}

/** A media time as `m:ss` (or `h:mm:ss`); `--:--` while the duration is unknown. */
export function formatPlaybackTime(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
	const whole = Math.floor(seconds);
	const hours = Math.floor(whole / 3600);
	const minutes = Math.floor((whole % 3600) / 60);
	const secs = String(whole % 60).padStart(2, '0');
	return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${secs}` : `${minutes}:${secs}`;
}
