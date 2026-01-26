/**
 * StatePersistenceManager
 *
 * Manages automatic state persistence for assessment sessions.
 * Supports both client-side (localStorage) and server-side persistence.
 *
 * Features:
 * - Auto-save on state changes (debounced)
 * - Manual save triggers
 * - State restoration
 * - Optional backend integration
 * - Fallback to localStorage when backend unavailable
 */

export interface PersistableState {
	/** Assessment identifier */
	assessmentId: string;
	/** Current item index */
	currentItemIndex: number;
	/** Visited item indices */
	visitedItems: number[];
	/** Response data per item */
	responses: Record<string, unknown>;
	/** Item session states (attempts, submission status) */
	itemSessionStates: Record<string, {
		attemptCount: number;
		isAnswered: boolean;
		isSubmitted: boolean;
		lastSubmissionTime?: number;
	}>;
	/** Time tracking data */
	timeTracking?: {
		startedAt: number;
		totalElapsed: number;
		itemTimes: Record<string, number>;
		sectionTimes: Record<string, number>;
	};
	/** Last saved timestamp */
	savedAt: number;
}

export interface PersistenceConfig {
	/** Unique session identifier */
	sessionId: string;
	/** Assessment identifier */
	assessmentId: string;
	/** Auto-save enabled (default: true) */
	autoSave?: boolean;
	/** Auto-save debounce delay in ms (default: 2000) */
	autoSaveDelay?: number;
	/** Storage strategy */
	storage?: 'localStorage' | 'sessionStorage' | 'memory';
	/** Optional backend save callback */
	onBackendSave?: (state: PersistableState) => Promise<void>;
	/** Optional save success callback */
	onSaveSuccess?: (state: PersistableState) => void;
	/** Optional save error callback */
	onSaveError?: (error: Error) => void;
}

export class StatePersistenceManager {
	private config: PersistenceConfig;
	private currentState: PersistableState | null = null;
	private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
	private isSaving = false;
	private memoryStorage: Map<string, string> = new Map();

	constructor(config: PersistenceConfig) {
		this.config = {
			autoSave: true,
			autoSaveDelay: 2000,
			storage: 'localStorage',
			...config,
		};
	}

	/**
	 * Update state and trigger auto-save
	 */
	updateState(state: Partial<PersistableState>): void {
		// Merge with existing state
		this.currentState = {
			...this.currentState,
			assessmentId: this.config.assessmentId,
			savedAt: Date.now(),
			...state,
		} as PersistableState;

		// Trigger auto-save
		if (this.config.autoSave) {
			this.scheduleAutoSave();
		}
	}

	/**
	 * Schedule auto-save with debouncing
	 */
	private scheduleAutoSave(): void {
		// Clear existing timer
		if (this.autoSaveTimer) {
			clearTimeout(this.autoSaveTimer);
		}

		// Schedule new save
		this.autoSaveTimer = setTimeout(() => {
			this.save().catch((error) => {
				console.error('[StatePersistenceManager] Auto-save failed:', error);
				this.config.onSaveError?.(error);
			});
		}, this.config.autoSaveDelay);
	}

	/**
	 * Manually save current state
	 */
	async save(): Promise<void> {
		if (!this.currentState) {
			return;
		}

		if (this.isSaving) {
			console.warn('[StatePersistenceManager] Save already in progress');
			return;
		}

		this.isSaving = true;

		try {
			// Update timestamp
			this.currentState.savedAt = Date.now();

			// Try backend save first (if configured)
			if (this.config.onBackendSave) {
				try {
					await this.config.onBackendSave(this.currentState);
				} catch (backendError) {
					console.warn('[StatePersistenceManager] Backend save failed, falling back to local:', backendError);
					// Continue to local save as fallback
				}
			}

			// Save to local storage
			this.saveToStorage(this.currentState);

			// Success callback
			this.config.onSaveSuccess?.(this.currentState);
		} catch (error) {
			console.error('[StatePersistenceManager] Save failed:', error);
			this.config.onSaveError?.(error as Error);
			throw error;
		} finally {
			this.isSaving = false;
		}
	}

	/**
	 * Save to configured storage
	 */
	private saveToStorage(state: PersistableState): void {
		const key = this.getStorageKey();
		const data = JSON.stringify(state);

		try {
			switch (this.config.storage) {
				case 'localStorage':
					if (typeof localStorage !== 'undefined') {
						localStorage.setItem(key, data);
					} else {
						this.memoryStorage.set(key, data);
					}
					break;

				case 'sessionStorage':
					if (typeof sessionStorage !== 'undefined') {
						sessionStorage.setItem(key, data);
					} else {
						this.memoryStorage.set(key, data);
					}
					break;

				case 'memory':
					this.memoryStorage.set(key, data);
					break;
			}
		} catch (error) {
			// Storage quota exceeded or other storage error
			console.error('[StatePersistenceManager] Storage save failed:', error);
			// Fallback to memory storage
			this.memoryStorage.set(key, data);
		}
	}

	/**
	 * Load state from storage
	 */
	async load(): Promise<PersistableState | null> {
		const key = this.getStorageKey();
		let data: string | null = null;

		try {
			switch (this.config.storage) {
				case 'localStorage':
					data = typeof localStorage !== 'undefined'
						? localStorage.getItem(key)
						: this.memoryStorage.get(key) || null;
					break;

				case 'sessionStorage':
					data = typeof sessionStorage !== 'undefined'
						? sessionStorage.getItem(key)
						: this.memoryStorage.get(key) || null;
					break;

				case 'memory':
					data = this.memoryStorage.get(key) || null;
					break;
			}

			if (!data) {
				return null;
			}

			const state = JSON.parse(data) as PersistableState;
			this.currentState = state;
			return state;
		} catch (error) {
			console.error('[StatePersistenceManager] Failed to load state:', error);
			return null;
		}
	}

	/**
	 * Check if saved state exists
	 */
	async hasSavedState(): Promise<boolean> {
		const state = await this.load();
		return state !== null;
	}

	/**
	 * Clear saved state
	 */
	async clear(): Promise<void> {
		const key = this.getStorageKey();

		try {
			switch (this.config.storage) {
				case 'localStorage':
					if (typeof localStorage !== 'undefined') {
						localStorage.removeItem(key);
					}
					this.memoryStorage.delete(key);
					break;

				case 'sessionStorage':
					if (typeof sessionStorage !== 'undefined') {
						sessionStorage.removeItem(key);
					}
					this.memoryStorage.delete(key);
					break;

				case 'memory':
					this.memoryStorage.delete(key);
					break;
			}

			this.currentState = null;
		} catch (error) {
			console.error('[StatePersistenceManager] Failed to clear state:', error);
		}
	}

	/**
	 * Get current state without saving
	 */
	getCurrentState(): PersistableState | null {
		return this.currentState ? { ...this.currentState } : null;
	}

	/**
	 * Get storage key for this session
	 */
	private getStorageKey(): string {
		return `qti-assessment-${this.config.assessmentId}-${this.config.sessionId}`;
	}

	/**
	 * Force immediate save (bypasses debounce)
	 */
	async forceSave(): Promise<void> {
		// Clear any pending auto-save
		if (this.autoSaveTimer) {
			clearTimeout(this.autoSaveTimer);
			this.autoSaveTimer = null;
		}

		await this.save();
	}

	/**
	 * Pause auto-save (useful during navigation transitions)
	 */
	pauseAutoSave(): void {
		if (this.autoSaveTimer) {
			clearTimeout(this.autoSaveTimer);
			this.autoSaveTimer = null;
		}
	}

	/**
	 * Resume auto-save
	 */
	resumeAutoSave(): void {
		if (this.config.autoSave && this.currentState) {
			this.scheduleAutoSave();
		}
	}

	/**
	 * Get last save timestamp
	 */
	getLastSaveTime(): number | null {
		return this.currentState?.savedAt || null;
	}

	/**
	 * Check if state has been modified since last save
	 */
	isDirty(): boolean {
		// Simple check - could be enhanced with deep comparison
		return this.autoSaveTimer !== null;
	}

	/**
	 * Cleanup
	 */
	destroy(): void {
		if (this.autoSaveTimer) {
			clearTimeout(this.autoSaveTimer);
			this.autoSaveTimer = null;
		}
		this.currentState = null;
	}
}
