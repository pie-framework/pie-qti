import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { MediaInteractionData } from '@pie-qti/item-player';
import MediaInteraction from '../../src/plugins/media/MediaInteraction.svelte';
import { cleanupInteraction, type MountedInteraction, mountInteraction, q, qa, settle } from './helpers';

/**
 * jsdom does not implement media playback. This stand-in keeps per-element
 * playback state and fires the events a browser fires, in the same order:
 * `play()` → `play` → `playing`; `pause()` → `pause`; the end → `pause`, `ended`.
 */
interface PlaybackState {
	paused: boolean;
	ended: boolean;
	currentTime: number;
	muted: boolean;
	/** When false, `play()` fires `play` but the source never starts (`playing` never fires). */
	canStart: boolean;
}

const DURATION = 30;
const playback = new WeakMap<HTMLMediaElement, PlaybackState>();
const saved = new Map<string, PropertyDescriptor | undefined>();
const MOCKED = ['paused', 'ended', 'currentTime', 'duration', 'muted', 'play', 'pause'] as const;

function stateOf(element: HTMLMediaElement): PlaybackState {
	let state = playback.get(element);
	if (!state) {
		state = { paused: true, ended: false, currentTime: 0, muted: false, canStart: true };
		playback.set(element, state);
	}
	return state;
}

function installMediaMock() {
	const proto = HTMLMediaElement.prototype;
	for (const name of MOCKED) saved.set(name, Object.getOwnPropertyDescriptor(proto, name));
	Object.defineProperties(proto, {
		paused: { configurable: true, get(this: HTMLMediaElement) { return stateOf(this).paused; } },
		ended: { configurable: true, get(this: HTMLMediaElement) { return stateOf(this).ended; } },
		duration: { configurable: true, get() { return DURATION; } },
		currentTime: {
			configurable: true,
			get(this: HTMLMediaElement) { return stateOf(this).currentTime; },
			set(this: HTMLMediaElement, value: number) { stateOf(this).currentTime = value; },
		},
		muted: {
			configurable: true,
			get(this: HTMLMediaElement) { return stateOf(this).muted; },
			set(this: HTMLMediaElement, value: boolean) {
				stateOf(this).muted = value;
				this.dispatchEvent(new Event('volumechange'));
			},
		},
		play: {
			configurable: true,
			writable: true,
			value: vi.fn(function play(this: HTMLMediaElement) {
				const state = stateOf(this);
				if (state.ended) {
					state.ended = false;
					state.currentTime = 0;
				}
				if (state.paused) {
					state.paused = false;
					this.dispatchEvent(new Event('play'));
					if (!state.paused && state.canStart) this.dispatchEvent(new Event('playing'));
				}
				return Promise.resolve();
			}),
		},
		pause: {
			configurable: true,
			writable: true,
			value: vi.fn(function pause(this: HTMLMediaElement) {
				const state = stateOf(this);
				if (!state.paused) {
					state.paused = true;
					this.dispatchEvent(new Event('pause'));
				}
			}),
		},
	});
}

function restoreMediaMock() {
	const proto = HTMLMediaElement.prototype;
	for (const name of MOCKED) {
		const descriptor = saved.get(name);
		if (descriptor) Object.defineProperty(proto, name, descriptor);
		else delete (proto as unknown as Record<string, unknown>)[name];
	}
	saved.clear();
}

/** Play to the natural end, as a browser does: `pause`, then `ended`. */
function finish(element: HTMLMediaElement) {
	const state = stateOf(element);
	state.currentTime = DURATION;
	state.paused = true;
	state.ended = true;
	element.dispatchEvent(new Event('pause'));
	element.dispatchEvent(new Event('ended'));
}

function mediaData(overrides: Partial<MediaInteractionData> = {}): MediaInteractionData {
	return {
		type: 'mediaInteraction',
		responseId: 'MEDIA',
		prompt: '<p>Listen to the clip.</p>',
		autostart: false,
		minPlays: 0,
		maxPlays: 0,
		loop: false,
		mediaElement: {
			type: 'audio',
			src: 'clip.mp3',
			mimeType: 'audio/mpeg',
			sources: [
				{ src: 'clip.mp3', mimeType: 'audio/mpeg' },
				{ src: 'clip.ogg', mimeType: 'audio/ogg' },
			],
			tracks: [],
		},
		...overrides,
	};
}

function videoData(overrides: Partial<MediaInteractionData> = {}): MediaInteractionData {
	return mediaData({
		mediaElement: {
			type: 'video',
			src: 'clip.mp4',
			mimeType: 'video/mp4',
			width: 640,
			height: 360,
			sources: [
				{ src: 'clip.webm', mimeType: 'video/webm' },
				{ src: 'clip.mp4', mimeType: 'video/mp4' },
			],
			tracks: [
				{ kind: 'captions', srclang: 'en', label: 'English', src: 'en.vtt', default: true },
				{ kind: 'subtitles', srclang: 'es', src: 'es.vtt' },
				{ kind: 'descriptions', srclang: 'en', src: 'descriptions.vtt' },
				// A URL the delivery policy blocked arrives empty and is not rendered.
				{ kind: 'captions', srclang: 'fr', src: '' },
			],
		},
		...overrides,
	});
}

const mounted: MountedInteraction[] = [];

function mountMedia(props: Record<string, unknown>) {
	const instance = mountInteraction(MediaInteraction, props);
	mounted.push(instance);
	return instance;
}

function playButton(m: MountedInteraction) {
	return q<HTMLButtonElement>(m, 'button[part="play-button"]')!;
}

function announcement(m: MountedInteraction) {
	return (q(m, '[part="announcer"]')?.textContent ?? '').trim();
}

async function click(element: HTMLElement) {
	element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	await settle();
}

beforeEach(() => installMediaMock());

afterEach(() => {
	cleanupInteraction(...mounted.splice(0));
	restoreMediaMock();
	vi.restoreAllMocks();
});

describe('MediaInteraction (pie-qti-media) without a play limit', () => {
	test('renders native controls with every source and caption track', async () => {
		const m = mountMedia({ interaction: videoData() });
		await settle();

		const video = q<HTMLVideoElement>(m, 'video')!;
		expect(video.hasAttribute('controls')).toBe(true);
		expect(qa<HTMLSourceElement>(m, 'video source').map((source) => [source.getAttribute('src'), source.getAttribute('type')])).toEqual([
			['clip.webm', 'video/webm'],
			['clip.mp4', 'video/mp4'],
		]);
		const tracks = qa<HTMLTrackElement>(m, 'video track');
		expect(tracks.map((track) => [track.getAttribute('kind'), track.getAttribute('srclang'), track.getAttribute('src')])).toEqual([
			['captions', 'en', 'en.vtt'],
			['subtitles', 'es', 'es.vtt'],
			['descriptions', 'en', 'descriptions.vtt'],
		]);
		expect(tracks[0]!.getAttribute('label')).toBe('English');
		expect(tracks[0]!.hasAttribute('default')).toBe(true);
		expect(tracks[1]!.hasAttribute('default')).toBe(false);
		// The video is named by the prompt.
		expect(video.getAttribute('aria-labelledby')).toBe(q(m, '[part="prompt"]')!.id);
		// Without a limit there are no custom controls.
		expect(q(m, '[part="controls"]')).toBeNull();
	});

	test('falls back to the single src for data built without sources', async () => {
		const m = mountMedia({
			interaction: mediaData({ mediaElement: { type: 'audio', src: 'only.mp3', mimeType: 'audio/mpeg' } }),
		});
		await settle();

		expect(qa(m, 'audio source').map((source) => source.getAttribute('src'))).toEqual(['only.mp3']);
	});

	test('counts a play when playback starts, not on resume', async () => {
		const m = mountMedia({ interaction: mediaData() });
		await settle();
		const audio = q<HTMLAudioElement>(m, 'audio')!;

		await audio.play();
		await settle();
		expect(m.instance.response).toBe(1);
		expect(m.events.map((event) => event.detail.value)).toEqual([1]);

		// Pausing and resuming continues the same play.
		audio.pause();
		await audio.play();
		await settle();
		expect(m.instance.response).toBe(1);

		// Playing again after the end is a new play.
		finish(audio);
		await audio.play();
		await settle();
		expect(m.instance.response).toBe(2);
		expect(m.events.map((event) => event.detail.value)).toEqual([1, 2]);
	});

	test('a source that never starts playing does not count a play', async () => {
		const m = mountMedia({ interaction: mediaData() });
		await settle();
		const audio = q<HTMLAudioElement>(m, 'audio')!;
		stateOf(audio).canStart = false;

		await audio.play();
		await settle();

		expect(m.instance.response).toBeUndefined();
		expect(m.events).toHaveLength(0);
	});

	test('returning a paused player to the beginning makes the next start a new play', async () => {
		const m = mountMedia({ interaction: mediaData() });
		await settle();
		const audio = q<HTMLAudioElement>(m, 'audio')!;

		await audio.play();
		audio.pause();
		audio.currentTime = 0;
		audio.dispatchEvent(new Event('seeked'));
		await audio.play();
		await settle();

		expect(m.instance.response).toBe(2);
	});

	test('loops by restarting, and each pass counts', async () => {
		const m = mountMedia({ interaction: mediaData({ loop: true }) });
		await settle();
		const audio = q<HTMLAudioElement>(m, 'audio')!;
		// No native loop: it would suppress `ended` and so the count.
		expect(audio.hasAttribute('loop')).toBe(false);

		await audio.play();
		finish(audio);
		await settle();

		expect(audio.play).toHaveBeenCalledTimes(2);
		expect(m.instance.response).toBe(2);
	});

	test('shows and announces progress toward minPlays', async () => {
		const m = mountMedia({ interaction: mediaData({ minPlays: 2 }) });
		await settle();
		const audio = q<HTMLAudioElement>(m, 'audio')!;

		expect(q(m, '[part="stats"]')!.textContent).toContain('Play at least 2 times');
		expect(q(m, '[part="plays-needed"]')!.textContent).toContain('2 more plays needed');
		// The stats are not a live region; announcements are explicit.
		expect(q(m, '[part="stats"]')!.hasAttribute('aria-live')).toBe(false);

		await audio.play();
		await settle();
		expect(announcement(m)).toBe('Play 1 started.');
		expect(q(m, '[part="plays-needed"]')!.textContent).toContain('1 more play needed');

		finish(audio);
		await audio.play();
		await settle();
		expect(announcement(m)).toBe('Play 2 started. Required number of plays reached.');
		expect(q(m, '[part="plays-needed"]')).toBeNull();
		expect(q(m, '[part="stats"]')!.textContent).toContain('Requirement met');
	});

	test('restoring a response updates the count without emitting', async () => {
		const m = mountMedia({ interaction: mediaData({ minPlays: 3 }), response: 2 });
		await settle();

		expect(q(m, '[part="stats"]')!.textContent).toContain('Play count:');
		expect(q(m, '[part="stats"]')!.textContent).toContain('2');
		expect(q(m, '[part="plays-needed"]')!.textContent).toContain('1 more play needed');
		expect(m.events).toHaveLength(0);
	});
});

describe('MediaInteraction (pie-qti-media) with maxPlays', () => {
	test('replaces native controls with its own labelled controls', async () => {
		const m = mountMedia({ interaction: mediaData({ maxPlays: 2 }) });
		await settle();

		const audio = q<HTMLAudioElement>(m, 'audio')!;
		expect(audio.hasAttribute('controls')).toBe(false);

		const controls = q(m, '[part="controls"]')!;
		expect(controls.getAttribute('role')).toBe('group');
		expect(controls.getAttribute('aria-label')).toBe('Media controls');

		const play = playButton(m);
		expect(play.textContent?.trim()).toBe('Play');
		expect(play.getAttribute('aria-describedby')).toBe(q(m, '[part="plays-left"]')!.id);
		expect(q(m, '[part="plays-left"]')!.textContent?.trim()).toBe('2 plays left');
		expect(q(m, 'button[part="mute-button"]')!.textContent?.trim()).toBe('Mute');
	});

	test('counts plays, announces each, and stops at the limit', async () => {
		const m = mountMedia({ interaction: mediaData({ maxPlays: 2 }) });
		await settle();
		const audio = q<HTMLAudioElement>(m, 'audio')!;

		await click(playButton(m));
		expect(audio.play).toHaveBeenCalledTimes(1);
		expect(m.instance.response).toBe(1);
		expect(announcement(m)).toBe('Play 1 of 2 started.');
		expect(playButton(m).textContent?.trim()).toBe('Pause');
		expect(q(m, '[part="plays-left"]')!.textContent?.trim()).toBe('1 play left');

		// Pause and resume within the play.
		await click(playButton(m));
		expect(audio.paused).toBe(true);
		expect(playButton(m).textContent?.trim()).toBe('Play');
		await click(playButton(m));
		expect(m.instance.response).toBe(1);

		finish(audio);
		await settle();
		await click(playButton(m));
		expect(m.instance.response).toBe(2);
		expect(announcement(m)).toBe('Play 2 of 2 started.');
		// The last play is running: it can still be paused and resumed.
		expect(playButton(m).getAttribute('aria-disabled')).toBeNull();
		expect(q(m, '[part="limit"]')).toBeNull();

		finish(audio);
		await settle();
		expect(announcement(m)).toBe('Maximum play limit reached');
		expect(q(m, '[part="limit"]')!.textContent).toContain('Maximum play limit reached');
		expect(q(m, '[part="plays-left"]')!.textContent?.trim()).toBe('0 plays left');

		// The button stays focusable but no longer plays.
		const play = playButton(m);
		expect(play.disabled).toBe(false);
		expect(play.getAttribute('aria-disabled')).toBe('true');
		expect(play.getAttribute('aria-describedby')).toContain(q(m, '[part="limit"]')!.id);
		await click(play);
		expect(audio.play).toHaveBeenCalledTimes(3);
		expect(m.instance.response).toBe(2);
		expect(m.events.map((event) => event.detail.value)).toEqual([1, 2]);
	});

	test('pauses at once when playback past the limit starts by other means', async () => {
		const m = mountMedia({ interaction: mediaData({ maxPlays: 1 }), response: 1 });
		await settle();
		const audio = q<HTMLAudioElement>(m, 'audio')!;

		// Media keys, a browser menu or script call play() directly.
		await audio.play();
		await settle();

		expect(audio.pause).toHaveBeenCalled();
		expect(audio.paused).toBe(true);
		expect(m.instance.response).toBe(1);
		expect(m.events).toHaveLength(0);
		expect(announcement(m)).toBe('Maximum play limit reached');
	});

	test('does not autoplay once the restored count reached the limit', async () => {
		const reached = mountMedia({ interaction: mediaData({ maxPlays: 2, autostart: true }), response: 2 });
		const fresh = mountMedia({ interaction: mediaData({ maxPlays: 2, autostart: true }), response: 0 });
		await settle();

		expect(q<HTMLAudioElement>(reached, 'audio')!.autoplay).toBe(false);
		expect(q(reached, '[part="limit"]')).not.toBeNull();
		expect(playButton(reached).getAttribute('aria-disabled')).toBe('true');
		expect(q<HTMLAudioElement>(fresh, 'audio')!.autoplay).toBe(true);
	});

	test('a loop restarts only while plays remain', async () => {
		const m = mountMedia({ interaction: mediaData({ maxPlays: 2, loop: true }) });
		await settle();
		const audio = q<HTMLAudioElement>(m, 'audio')!;

		await click(playButton(m));
		finish(audio);
		await settle();
		expect(m.instance.response).toBe(2);

		finish(audio);
		await settle();
		expect(audio.play).toHaveBeenCalledTimes(2);
		expect(audio.paused).toBe(true);
		expect(m.instance.response).toBe(2);
	});

	test('a disabled interaction neither plays nor counts', async () => {
		const m = mountMedia({ interaction: mediaData({ maxPlays: 2 }), disabled: true });
		await settle();
		const audio = q<HTMLAudioElement>(m, 'audio')!;

		expect(playButton(m).disabled).toBe(true);
		await audio.play();
		await settle();

		expect(audio.paused).toBe(true);
		expect(m.events).toHaveLength(0);
	});

	test('mute toggles and relabels', async () => {
		const m = mountMedia({ interaction: mediaData({ maxPlays: 2 }) });
		await settle();
		const mute = q<HTMLButtonElement>(m, 'button[part="mute-button"]')!;

		await click(mute);
		expect(q<HTMLAudioElement>(m, 'audio')!.muted).toBe(true);
		expect(mute.textContent?.trim()).toBe('Unmute');
	});

	test('video offers a caption choice and keeps playback inline', async () => {
		const m = mountMedia({ interaction: videoData({ maxPlays: 1 }) });
		await settle();

		const video = q<HTMLVideoElement>(m, 'video')!;
		expect(video.hasAttribute('controls')).toBe(false);
		expect(video.hasAttribute('playsinline')).toBe(true);
		// Svelte sets this as the reflecting IDL property, which jsdom does not implement.
		expect(
			video.hasAttribute('disablepictureinpicture') ||
				(video as HTMLVideoElement & { disablePictureInPicture?: boolean }).disablePictureInPicture === true,
		).toBe(true);

		const select = q<HTMLSelectElement>(m, '[part="captions"] select')!;
		expect(q(m, '[part="captions"]')!.textContent).toContain('Captions');
		expect(Array.from(select.options).map((option) => [option.value, option.textContent])).toEqual([
			['', 'Off'],
			['0', 'English'],
			['1', 'Spanish'],
		]);
		// The track marked default is the one showing.
		expect(select.value).toBe('0');

		// The browser menu ("Show controls", "Loop") is not offered under a limit.
		const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
		video.dispatchEvent(menu);
		expect(menu.defaultPrevented).toBe(true);
	});

	test('uses the i18n provider for control labels and announcements', async () => {
		const messages: Record<string, string> = {
			'interactions.media.play': 'Afspelen',
			'interactions.media.playStartedOfMax': 'Afspeelbeurt {count} van {max} gestart.',
		};
		const i18n = {
			getLocale: () => 'nl',
			setLocale: () => {},
			t: (key: string, fallback?: unknown, values?: Record<string, unknown>) => {
				const message = messages[key] ?? (typeof fallback === 'string' ? fallback : key);
				return message.replace(/\{(\w+)\}/g, (_match, name: string) => String(values?.[name] ?? ''));
			},
		};
		const m = mountMedia({ interaction: mediaData({ maxPlays: 3 }), i18n });
		await settle();

		expect(playButton(m).textContent?.trim()).toBe('Afspelen');
		await click(playButton(m));
		expect(announcement(m)).toBe('Afspeelbeurt 1 van 3 gestart.');
	});
});

describe('MediaInteraction (pie-qti-media) object embeds', () => {
	test('explains a blocked object embed instead of rendering nothing', async () => {
		const m = mountMedia({
			interaction: mediaData({ mediaElement: { type: 'object', src: 'legacy.swf', mimeType: 'application/x-shockwave-flash' } }),
		});
		await settle();

		expect(q(m, 'object')).toBeNull();
		expect(q(m, '[part="unavailable"]')!.textContent).toContain('disabled by default for security');
	});
});
