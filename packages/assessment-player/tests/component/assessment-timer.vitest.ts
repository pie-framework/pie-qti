/**
 * The rebuilt AssessmentTimer, mounted with a stub player that replays the core's time
 * events: the ticking readout never announces (live region off, name carries the
 * reading), threshold warnings and expiry go through their own separate regions, the
 * hide toggle and the paused state work, and the only animation sits behind
 * prefers-reduced-motion.
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { flushSync } from 'svelte';
import AssessmentTimer from '../../src/components/AssessmentTimer.svelte';
import { mountInto, settle, type Mounted } from './helpers';

const mounted: Mounted[] = [];
const i18n = {
	t: (key: string, fallbackOrParams?: string | Record<string, unknown>, params?: Record<string, unknown>) => {
		const fallback = typeof fallbackOrParams === 'string' ? fallbackOrParams : key;
		if (params && typeof fallback === 'string') {
			return fallback.replace(/\{(\w+)\}/g, (_m, name) => String(params[name]));
		}
		return fallback;
	},
};

/** The core's time surface, narrowed to what the timer reads. */
function stubPlayer(initial: { remaining: number | null; expired?: boolean; paused?: boolean } = { remaining: 300 }) {
	const warningListeners = new Set<(remaining: number) => void>();
	const expiredListeners = new Set<(event: { autoFinalized: boolean }) => void>();
	const tickListeners = new Set<(remaining: number, elapsed: number) => void>();
	const pauseListeners = new Set<(paused: boolean) => void>();
	let remaining = initial.remaining;
	let paused = initial.paused ?? false;
	return {
		getRemainingTime: () => remaining ?? 0,
		getTimeState: () => ({
			limited: remaining !== null,
			remainingSeconds: remaining,
			elapsedSeconds: 0,
			expired: initial.expired ?? false,
			scope: 'assessment' as const,
			allowLateSubmission: false,
			paused,
			started: true,
		}),
		isTimeExpired: () => initial.expired ?? false,
		isPaused: () => paused,
		onTimeWarning: (listener: (remaining: number) => void) => {
			warningListeners.add(listener);
			return () => warningListeners.delete(listener);
		},
		onTimeExpired: (listener: (event: { autoFinalized: boolean }) => void) => {
			expiredListeners.add(listener);
			return () => expiredListeners.delete(listener);
		},
		onTimeTick: (listener: (remaining: number, elapsed: number) => void) => {
			tickListeners.add(listener);
			return () => tickListeners.delete(listener);
		},
		onPauseChange: (listener: (paused: boolean) => void) => {
			pauseListeners.add(listener);
			return () => pauseListeners.delete(listener);
		},
		emit: {
			warning: (seconds: number) => {
				remaining = seconds;
				for (const listener of warningListeners) listener(seconds);
			},
			tick: (seconds: number) => {
				remaining = seconds;
				for (const listener of tickListeners) listener(seconds, 0);
			},
			expired: () => {
				remaining = 0;
				for (const listener of expiredListeners) listener({ autoFinalized: false });
			},
			pause: (next: boolean) => {
				paused = next;
				for (const listener of pauseListeners) listener(next);
			},
		},
	};
}

function timerIn(host: HTMLElement) {
	return {
		root: host.querySelector<HTMLElement>('[data-testid="assessment-timer"]')!,
		readout: host.querySelector<HTMLElement>('[role="timer"]'),
		value: host.querySelector<HTMLElement>('[data-testid="assessment-timer-value"]'),
		toggle: host.querySelector<HTMLButtonElement>('[data-testid="assessment-timer-toggle"]')!,
		warningRegion: host.querySelector<HTMLElement>('[data-testid="assessment-timer-warning"]')!,
		expiredRegion: host.querySelector<HTMLElement>('[data-testid="assessment-timer-expired"]')!,
	};
}

afterEach(() => {
	for (const m of mounted.splice(0)) m.destroy();
});

describe('AssessmentTimer', () => {
	test('shows the reading as the accessible name without a live region', async () => {
		const player = stubPlayer({ remaining: 754 });
		const m = mountInto(AssessmentTimer, { player, i18n });
		mounted.push(m);
		await settle();
		const ui = timerIn(m.host);

		expect(ui.readout).not.toBeNull();
		// The per-second element must never announce: role=timer with the live region off.
		expect(ui.readout?.getAttribute('aria-live')).toBe('off');
		expect(ui.readout?.getAttribute('role')).toBe('timer');
		expect(ui.readout?.getAttribute('aria-label')).toBe('Time remaining: 12:34');
		expect(ui.value?.textContent).toBe('Time remaining: 12:34');
		expect(ui.readout?.getAttribute('aria-labelledby')).toBeNull();

		player.emit.tick(753);
		flushSync();
		expect(ui.readout?.getAttribute('aria-label')).toBe('Time remaining: 12:33');
	});

	test('announces threshold warnings through its own polite region, once each', async () => {
		const player = stubPlayer({ remaining: 301 });
		const m = mountInto(AssessmentTimer, { player, i18n });
		mounted.push(m);
		await settle();
		const ui = timerIn(m.host);

		expect(ui.warningRegion.getAttribute('aria-live')).toBe('polite');
		expect(ui.warningRegion.textContent).toBe('');

		player.emit.warning(300);
		flushSync();
		expect(ui.warningRegion.textContent).toBe('5 minutes remaining');
		expect(ui.root.dataset.timerState).toBe('warning');

		// Ticks never touch the announcement regions.
		player.emit.tick(299);
		flushSync();
		expect(ui.warningRegion.textContent).toBe('5 minutes remaining');

		player.emit.warning(60);
		flushSync();
		expect(ui.warningRegion.textContent).toBe('1 minute remaining');

		// An odd threshold reads as clock time.
		player.emit.warning(90);
		flushSync();
		expect(ui.warningRegion.textContent).toBe('1:30 remaining');
	});

	test('the announcement regions are computed-hidden through the shared sr-only rule', async () => {
		const player = stubPlayer({ remaining: 300 });
		const m = mountInto(AssessmentTimer, { player, i18n });
		mounted.push(m);
		await settle();
		const ui = timerIn(m.host);

		// jsdom resolves the injected document rule: visually hidden (1px, clipped,
		// absolute) yet reachable — not display:none, not visibility:hidden.
		for (const region of [ui.warningRegion, ui.expiredRegion]) {
			const cs = getComputedStyle(region);
			expect(cs.position).toBe('absolute');
			expect(cs.width).toBe('1px');
			expect(cs.height).toBe('1px');
			expect(cs.overflow).toBe('hidden');
			expect(cs.clip).toBe('rect(0px, 0px, 0px, 0px)');
			expect(cs.display).not.toBe('none');
			expect(cs.visibility).not.toBe('hidden');
		}
	});

	test('announces expiry assertively and keeps announcing the warning politely', async () => {
		const player = stubPlayer({ remaining: 10 });
		const m = mountInto(AssessmentTimer, { player, i18n });
		mounted.push(m);
		await settle();
		const ui = timerIn(m.host);

		player.emit.warning(10);
		player.emit.expired();
		flushSync();

		expect(ui.expiredRegion.getAttribute('aria-live')).toBe('assertive');
		expect(ui.expiredRegion.textContent).toBe('Time expired');
		expect(ui.root.dataset.timerState).toBe('expired');
		expect(ui.readout?.getAttribute('aria-label')).toBe('Time expired');
		// Both regions stay attached so assistive technology keeps discovering them.
		expect(ui.warningRegion.textContent).toBe('0:10 remaining');
	});

	test('the hide toggle collapses the readout and reports the choice', async () => {
		const player = stubPlayer();
		const onToggleHidden = vi.fn();
		const m = mountInto(AssessmentTimer, { player, i18n, onToggleHidden });
		mounted.push(m);
		await settle();
		const ui = timerIn(m.host);

		// One name in both states (WCAG 4.1.2): the control is named for the countdown it
		// shows, and `aria-expanded` alone says whether the countdown is showing.
		expect(ui.toggle.textContent?.trim()).toBe('Timer');
		expect(ui.toggle.getAttribute('aria-label')).toBeNull();
		expect(ui.toggle.getAttribute('aria-expanded')).toBe('true');
		expect(ui.toggle.getAttribute('aria-controls')).toBe(ui.readout?.id);

		ui.toggle.click();
		flushSync();
		expect(onToggleHidden).toHaveBeenCalledWith(true);

		// The shell persists the choice and passes `hidden` back.
		m.destroy();
		const hidden = mountInto(AssessmentTimer, { player, i18n, hidden: true, onToggleHidden });
		mounted.push(hidden);
		await settle();
		const hiddenUi = timerIn(hidden.host);
		expect(hiddenUi.readout).toBeNull();
		// The name did not change with the state; only `aria-expanded` did.
		expect(hiddenUi.toggle.textContent?.trim()).toBe('Timer');
		expect(hiddenUi.toggle.getAttribute('aria-expanded')).toBe('false');
		// Nothing to point at while the readout is hidden.
		expect(hiddenUi.toggle.getAttribute('aria-controls')).toBeNull();
		// The announcements stay reachable even while the readout is hidden.
		player.emit.warning(60);
		flushSync();
		expect(hiddenUi.warningRegion.textContent).toBe('1 minute remaining');
	});

	test('shows the pause state while a proctor pause freezes the clock', async () => {
		const player = stubPlayer({ remaining: 120 });
		const m = mountInto(AssessmentTimer, { player, i18n });
		mounted.push(m);
		await settle();
		const ui = timerIn(m.host);

		player.emit.pause(true);
		flushSync();
		expect(ui.root.dataset.timerState).toBe('paused');
		expect(ui.readout?.getAttribute('aria-label')).toBe('Paused: 2:00');

		player.emit.tick(120);
		flushSync();
		// Frozen: the reading is unchanged and still named as paused.
		expect(ui.readout?.getAttribute('aria-label')).toBe('Paused: 2:00');

		player.emit.pause(false);
		flushSync();
		expect(ui.root.dataset.timerState).toBe('running');
		expect(ui.readout?.getAttribute('aria-label')).toBe('Time remaining: 2:00');
	});

	test('resets the warning look when a new limiting scope takes over', async () => {
		const player = stubPlayer({ remaining: 30 });
		const m = mountInto(AssessmentTimer, { player, i18n });
		mounted.push(m);
		await settle();
		const ui = timerIn(m.host);

		player.emit.warning(30);
		flushSync();
		expect(ui.root.dataset.timerState).toBe('warning');

		// Navigation to a section with a fresh, higher limit.
		player.emit.tick(90);
		flushSync();
		expect(ui.root.dataset.timerState).toBe('running');
	});

	test('renders nothing to count down when no scope is limited', async () => {
		const player = stubPlayer({ remaining: null });
		const m = mountInto(AssessmentTimer, { player, i18n });
		mounted.push(m);
		await settle();
		const ui = timerIn(m.host);
		expect(ui.readout).toBeNull();
		expect(ui.toggle).not.toBeNull();
	});

	test('the pulse animation exists only behind prefers-reduced-motion: no-preference', async () => {
		const player = stubPlayer();
		const m = mountInto(AssessmentTimer, { player, i18n });
		mounted.push(m);
		await settle();
		const css = Array.from(document.querySelectorAll('style'))
			.map((style) => style.textContent ?? '')
			.join('\n');
		expect(css).toContain('@media (prefers-reduced-motion: no-preference)');
		// The only animation declaration in the component lives inside that guard.
		const pulseIndex = css.indexOf('timer-warning-pulse');
		const guardIndex = css.indexOf('@media (prefers-reduced-motion: no-preference)');
		expect(pulseIndex).toBeGreaterThan(guardIndex);
		for (const rule of css.match(/animation:[^;]*;/g) ?? []) {
			expect(css.indexOf(rule)).toBeGreaterThan(guardIndex);
		}
	});
});
