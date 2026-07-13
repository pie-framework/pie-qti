/**
 * TimeManager
 *
 * Manages time limits and tracking for QTI assessments.
 * Supports test-level, section-level, and item-level time limits.
 *
 * Features:
 * - Countdown timers with warnings
 * - Auto-submission when time expires
 * - Time spent tracking per item
 * - Pause/resume support
 * - Late submission handling
 */

import type { TimeLimits } from '../types/index.js';

export interface TimeManagerConfig {
	/** Assessment-level time limits */
	assessmentTimeLimits?: TimeLimits;
	/** Warning threshold (seconds before expiry) */
	warningThreshold?: number;
	/** Callback when time warning is triggered */
	onWarning?: (remainingSeconds: number) => void;
	/** Callback when time expires */
	onExpired?: () => void;
	/** Callback for time updates (fires every second) */
	onTick?: (remainingSeconds: number, elapsedSeconds: number) => void;
	/**
	 * QTI 3.0 PNP extended time accommodation.
	 * When active, multiplies assessmentTimeLimits.maxTime by the given multiplier.
	 * multiplier: Infinity removes the time limit entirely.
	 */
	extendedTime?: { active: boolean; multiplier: number };
	/** Injectable monotonic wall clock for deterministic hosts/tests. */
	now?: () => number;
}

export interface ActiveTimeScopes {
	testPart?: { identifier: string; timeLimits?: TimeLimits };
	section?: { identifier: string; timeLimits?: TimeLimits };
	item?: { identifier: string; timeLimits?: TimeLimits };
}

export interface TimeTrackingState {
	/** Total elapsed time (ms) */
	totalElapsed: number;
	/** Time spent per item identifier (ms) */
	itemTimes: Record<string, number>;
	/** Time spent per section identifier (ms) */
	sectionTimes: Record<string, number>;
	/** Time spent per testPart identifier (ms) */
	testPartTimes: Record<string, number>;
	/** Session start timestamp */
	startedAt: number;
	/** Current item start time (for tracking) */
	currentItemStartTime?: number;
	/** Current item identifier */
	currentItemId?: string;
	/** Current section identifier */
	currentSectionId?: string;
	/** Current section start time */
	currentSectionStartTime?: number;
	/** Current testPart identifier */
	currentTestPartId?: string;
	/** Current testPart start time */
	currentTestPartStartTime?: number;
	/** Is timer currently paused */
	isPaused: boolean;
}

export class TimeManager {
	private config: TimeManagerConfig;
	private state: TimeTrackingState;

	// Timer internals
	private intervalId: ReturnType<typeof setInterval> | null = null;
	private maxTimeSeconds: number | null = null;
	private warningTriggered = new Set<string>();
	private expirationTriggered = new Set<string>();
	private activeScopes: ActiveTimeScopes = {};
	private lastTickAt: number;

	constructor(config: TimeManagerConfig) {
		this.config = config;
		this.state = {
			totalElapsed: 0,
			itemTimes: {},
			sectionTimes: {},
			testPartTimes: {},
			startedAt: this.now(),
			isPaused: false,
		};
		this.lastTickAt = this.now();

		// Initialize timer if time limit exists, applying PNP extended-time multiplier if set.
		if (config.assessmentTimeLimits?.maxTime) {
			const base = config.assessmentTimeLimits.maxTime;
			const et = config.extendedTime;
			if (et?.active && et.multiplier === Infinity) {
				// multiplier: Infinity → unlimited time (no countdown)
				this.maxTimeSeconds = null;
			} else if (et?.active && et.multiplier > 0) {
				this.maxTimeSeconds = base * et.multiplier;
			} else {
				this.maxTimeSeconds = base;
			}
		}
		// Scope timing is required even when the assessment itself has no maxTime.
		this.startTimer();
	}

	private now(): number {
		return this.config.now?.() ?? Date.now();
	}

	private applyExtendedTime(seconds: number | undefined): number | null {
		if (seconds === undefined) return null;
		const extended = this.config.extendedTime;
		if (extended?.active && extended.multiplier === Infinity) return null;
		if (extended?.active && extended.multiplier > 0) return seconds * extended.multiplier;
		return seconds;
	}

	/**
	 * Start or resume the timer
	 */
	private startTimer(): void {
		if (this.intervalId) {
			return; // Already running
		}

		this.state.isPaused = false;
		this.lastTickAt = this.now();

		this.intervalId = setInterval(() => {
			const now = this.now();
			if (this.state.isPaused) {
				this.lastTickAt = now;
				return;
			}

			this.state.totalElapsed += Math.max(0, now - this.lastTickAt);
			this.lastTickAt = now;

			const elapsedSeconds = Math.floor(this.state.totalElapsed / 1000);
			const candidates = this.getActiveCandidates();
			for (const candidate of candidates) {
				if (candidate.remainingSeconds > 0 || this.expirationTriggered.has(candidate.key)) continue;
				this.expirationTriggered.add(candidate.key);
				if (!candidate.allowLateSubmission) {
					this.handleExpiration();
					return;
				}
			}
			const activeRemaining = this.nearestRemaining(candidates);
			if (activeRemaining) {
				const { key, remainingSeconds } = activeRemaining;

				// Trigger warning
				const warningThreshold = this.config.warningThreshold ?? 60;
				if (!this.warningTriggered.has(key) && remainingSeconds <= warningThreshold && remainingSeconds > 0) {
					this.warningTriggered.add(key);
					this.config.onWarning?.(remainingSeconds);
				}

				// Tick callback
				this.config.onTick?.(remainingSeconds, elapsedSeconds);
			} else {
				// No limit - just count up
				this.config.onTick?.(0, elapsedSeconds);
			}
		}, 1000);
	}

	private getActiveCandidates(): Array<{
		key: string;
		remainingSeconds: number;
		allowLateSubmission: boolean;
	}> {
		const candidates: Array<{ key: string; remainingSeconds: number; allowLateSubmission: boolean }> = [];
		if (this.maxTimeSeconds !== null) {
			candidates.push({
				key: 'assessment',
				remainingSeconds: this.maxTimeSeconds - this.getElapsedSeconds(),
				allowLateSubmission: this.config.assessmentTimeLimits?.allowLateSubmission === true,
			});
		}
		for (const scope of ['testPart', 'section', 'item'] as const) {
			const active = this.activeScopes[scope];
			const max = this.applyExtendedTime(active?.timeLimits?.maxTime);
			if (!active || max === null) continue;
			candidates.push({
				key: `${scope}:${active.identifier}`,
				remainingSeconds: max - this.getScopeElapsedMs(scope, active.identifier) / 1000,
				allowLateSubmission: active.timeLimits?.allowLateSubmission === true,
			});
		}
		return candidates;
	}

	private nearestRemaining(
		candidates: Array<{ key: string; remainingSeconds: number; allowLateSubmission: boolean }>,
	): { key: string; remainingSeconds: number; allowLateSubmission: boolean } | null {
		if (candidates.length === 0) return null;
		return candidates.reduce((nearest, candidate) =>
			candidate.remainingSeconds < nearest.remainingSeconds ? candidate : nearest
		);
	}

	private getActiveRemaining(): { key: string; remainingSeconds: number; allowLateSubmission: boolean } | null {
		return this.nearestRemaining(this.getActiveCandidates());
	}

	/**
	 * Handle time expiration
	 */
	private handleExpiration(): void {
		this.stopTimer();
		this.config.onExpired?.();
	}

	/**
	 * Stop the timer
	 */
	stopTimer(): void {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	/**
	 * Pause the timer
	 */
	pause(): void {
		if (this.state.isPaused) return;
		this.state.totalElapsed = this.getTotalElapsedMs();
		this.lastTickAt = this.now();
		this.checkpointActiveScopes(false);
		this.state.isPaused = true;
	}

	/**
	 * Resume the timer
	 */
	resume(): void {
		if (!this.state.isPaused) return;
		this.state.isPaused = false;
		const now = this.now();
		if (this.state.currentItemId) this.state.currentItemStartTime = now;
		if (this.state.currentSectionId) this.state.currentSectionStartTime = now;
		if (this.state.currentTestPartId) this.state.currentTestPartStartTime = now;
		this.lastTickAt = now;
	}

	/**
	 * Start tracking time for an item
	 */
	startItem(itemIdentifier: string): void {
		if (this.state.currentItemId === itemIdentifier && this.state.currentItemStartTime) return;
		// End previous item if any
		if (this.state.currentItemStartTime) {
			this.endCurrentItem();
		}

		this.state.currentItemId = itemIdentifier;
		this.state.currentItemStartTime = this.state.isPaused ? undefined : this.now();
	}

	/**
	 * End tracking time for current item
	 */
	private endCurrentItem(): void {
		if (!this.state.currentItemStartTime) {
			return;
		}

		const timeSpent = this.now() - this.state.currentItemStartTime;
		if (this.state.currentItemId) {
			this.state.itemTimes[this.state.currentItemId] =
				(this.state.itemTimes[this.state.currentItemId] || 0) + Math.max(0, timeSpent);
		}
		this.state.currentItemStartTime = undefined;
		this.state.currentItemId = undefined;
	}

	/**
	 * End tracking time for an item
	 */
	endItem(itemIdentifier: string): void {
		if (!this.state.currentItemStartTime) {
			return;
		}

		const timeSpent = this.now() - this.state.currentItemStartTime;
		const activeIdentifier = this.state.currentItemId ?? itemIdentifier;
		this.state.itemTimes[activeIdentifier] = (this.state.itemTimes[activeIdentifier] || 0) + Math.max(0, timeSpent);
		this.state.currentItemStartTime = undefined;
		this.state.currentItemId = undefined;
	}

	/**
	 * Start tracking time for a section
	 */
	startSection(sectionIdentifier: string): void {
		if (this.state.currentSectionId === sectionIdentifier && this.state.currentSectionStartTime) return;
		this.endCurrentSection();
		this.state.currentSectionId = sectionIdentifier;
		this.state.currentSectionStartTime = this.state.isPaused ? undefined : this.now();
	}

	startTestPart(testPartIdentifier: string): void {
		if (this.state.currentTestPartId === testPartIdentifier && this.state.currentTestPartStartTime) return;
		this.endCurrentTestPart();
		this.state.currentTestPartId = testPartIdentifier;
		this.state.currentTestPartStartTime = this.state.isPaused ? undefined : this.now();
	}

	activateScopes(scopes: ActiveTimeScopes): void {
		if (scopes.testPart) this.startTestPart(scopes.testPart.identifier);
		if (scopes.section) this.startSection(scopes.section.identifier);
		if (scopes.item) this.startItem(scopes.item.identifier);
		this.activeScopes = scopes;
	}

	private endCurrentSection(): void {
		if (this.state.currentSectionId && this.state.currentSectionStartTime) {
			const elapsed = Math.max(0, this.now() - this.state.currentSectionStartTime);
			this.state.sectionTimes[this.state.currentSectionId] =
				(this.state.sectionTimes[this.state.currentSectionId] || 0) + elapsed;
		}
		this.state.currentSectionStartTime = undefined;
	}

	private endCurrentTestPart(): void {
		if (this.state.currentTestPartId && this.state.currentTestPartStartTime) {
			const elapsed = Math.max(0, this.now() - this.state.currentTestPartStartTime);
			this.state.testPartTimes[this.state.currentTestPartId] =
				(this.state.testPartTimes[this.state.currentTestPartId] || 0) + elapsed;
		}
		this.state.currentTestPartStartTime = undefined;
	}

	private checkpointActiveScopes(restart: boolean): void {
		const itemId = this.state.currentItemId;
		const sectionId = this.state.currentSectionId;
		const testPartId = this.state.currentTestPartId;
		this.endCurrentItem();
		this.endCurrentSection();
		this.endCurrentTestPart();
		this.state.currentItemId = itemId;
		this.state.currentSectionId = sectionId;
		this.state.currentTestPartId = testPartId;
		if (restart && !this.state.isPaused) {
			const now = this.now();
			if (itemId) this.state.currentItemStartTime = now;
			if (sectionId) this.state.currentSectionStartTime = now;
			if (testPartId) this.state.currentTestPartStartTime = now;
		}
	}

	/**
	 * Get remaining time in seconds (null if no limit)
	 */
	getRemainingSeconds(): number | null {
		const active = this.getActiveRemaining();
		return active ? Math.max(0, Math.ceil(active.remainingSeconds)) : null;
	}

	/**
	 * Get elapsed time in seconds
	 */
	getElapsedSeconds(): number {
		return Math.floor(this.getTotalElapsedMs() / 1000);
	}

	private getTotalElapsedMs(): number {
		if (this.state.isPaused) return this.state.totalElapsed;
		return this.state.totalElapsed + Math.max(0, this.now() - this.lastTickAt);
	}

	/**
	 * Get time spent on a specific item (ms)
	 */
	getItemTime(itemIdentifier: string): number {
		return this.getScopeElapsedMs('item', itemIdentifier);
	}

	getScopeElapsedMs(scope: 'assessment' | 'testPart' | 'section' | 'item', identifier?: string): number {
		if (scope === 'assessment') return this.getTotalElapsedMs();
		const now = this.now();
		if (scope === 'item') {
			const id = identifier ?? this.state.currentItemId;
			if (!id) return 0;
			const active = id === this.state.currentItemId && this.state.currentItemStartTime && !this.state.isPaused
				? Math.max(0, now - this.state.currentItemStartTime)
				: 0;
			return (this.state.itemTimes[id] || 0) + active;
		}
		if (scope === 'section') {
			const id = identifier ?? this.state.currentSectionId;
			if (!id) return 0;
			const active = id === this.state.currentSectionId && this.state.currentSectionStartTime && !this.state.isPaused
				? Math.max(0, now - this.state.currentSectionStartTime)
				: 0;
			return (this.state.sectionTimes[id] || 0) + active;
		}
		const id = identifier ?? this.state.currentTestPartId;
		if (!id) return 0;
		const active = id === this.state.currentTestPartId && this.state.currentTestPartStartTime && !this.state.isPaused
			? Math.max(0, now - this.state.currentTestPartStartTime)
			: 0;
		return (this.state.testPartTimes[id] || 0) + active;
	}

	/**
	 * Get current tracking state (for persistence)
	 */
	getState(): TimeTrackingState {
		if (!this.state.isPaused) {
			this.state.totalElapsed = this.getTotalElapsedMs();
			this.lastTickAt = this.now();
		}
		this.checkpointActiveScopes(true);
		return {
			...this.state,
			itemTimes: { ...this.state.itemTimes },
			sectionTimes: { ...this.state.sectionTimes },
			testPartTimes: { ...this.state.testPartTimes },
		};
	}

	/**
	 * Restore tracking state (for resume)
	 */
	restoreState(state: TimeTrackingState): void {
		this.state = {
			...state,
			itemTimes: { ...state.itemTimes },
			sectionTimes: { ...state.sectionTimes },
			testPartTimes: { ...(state.testPartTimes ?? {}) },
			currentItemStartTime: undefined,
			currentSectionStartTime: undefined,
			currentTestPartStartTime: undefined,
		};
		if (!this.state.isPaused) {
			const now = this.now();
			if (this.state.currentItemId) this.state.currentItemStartTime = now;
			if (this.state.currentSectionId) this.state.currentSectionStartTime = now;
			if (this.state.currentTestPartId) this.state.currentTestPartStartTime = now;
			this.lastTickAt = now;
		}

		// Restart timer if not expired
		if (this.maxTimeSeconds) {
			const elapsedSeconds = Math.floor(this.state.totalElapsed / 1000);
			if (elapsedSeconds < this.maxTimeSeconds) {
				this.startTimer();
			}
		}
	}

	/**
	 * Check if time has expired
	 */
	isExpired(): boolean {
		const active = this.getActiveRemaining();
		return active !== null && active.remainingSeconds <= 0;
	}

	/**
	 * Check if late submission is allowed
	 */
	allowsLateSubmission(): boolean {
		const candidates = this.getActiveCandidates();
		const expired = candidates.filter((candidate) => candidate.remainingSeconds <= 0);
		if (expired.length > 0) {
			return expired.every((candidate) => candidate.allowLateSubmission);
		}
		return this.nearestRemaining(candidates)?.allowLateSubmission ?? false;
	}

	/**
	 * Format time as MM:SS or HH:MM:SS
	 */
	static formatTime(seconds: number): string {
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		const secs = seconds % 60;

		if (hours > 0) {
			return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
		}

		return `${minutes}:${secs.toString().padStart(2, '0')}`;
	}

	/**
	 * Cleanup - stop all timers
	 */
	destroy(): void {
		this.checkpointActiveScopes(false);
		this.stopTimer();
	}
}
