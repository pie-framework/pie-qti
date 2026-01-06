/**
 * Assessment Performance Monitor
 *
 * Tracks assessment-level performance metrics including:
 * - Navigation timing
 * - Response submission latency
 * - Section loading times
 * - Overall assessment duration
 *
 * This extends the base performance monitor from qti2-item-player with
 * assessment-specific functionality.
 */

export {
	globalPerformanceMonitor,
	type PerformanceEntry,
	PerformanceMonitor,
	type PerformanceMonitorConfig,
	type PerformanceReport,
} from '@pie-qti/qti2-item-player';

/**
 * Assessment-specific performance metrics
 */
export interface AssessmentPerformanceMetrics {
	/** Assessment start time */
	assessmentStartTime?: number;
	/** Assessment end time */
	assessmentEndTime?: number;
	/** Total assessment duration (ms) */
	totalDuration?: number;
	/** Number of items completed */
	itemsCompleted: number;
	/** Average time per item (ms) */
	averageItemTime?: number;
	/** Navigation events count */
	navigationCount: number;
	/** Response submissions count */
	submissionCount: number;
	/** Average submission latency (ms) */
	averageSubmissionLatency?: number;
}

/**
 * Assessment Performance Tracker
 *
 * Higher-level wrapper around PerformanceMonitor specifically
 * for tracking assessment-level metrics.
 *
 * Usage:
 * ```typescript
 * import { AssessmentPerformanceTracker } from './utils/PerformanceMonitor';
 *
 * const tracker = new AssessmentPerformanceTracker({ enabled: true });
 *
 * tracker.startAssessment();
 * tracker.trackNavigation('next');
 * tracker.trackItemStart('item-001');
 * tracker.trackItemComplete('item-001');
 * tracker.trackSubmission(125); // Latency in ms
 * tracker.endAssessment();
 *
 * const metrics = tracker.getAssessmentMetrics();
 * console.log(metrics);
 * ```
 */
export class AssessmentPerformanceTracker {
	private assessmentStartTime?: number;
	private assessmentEndTime?: number;
	private itemStartTimes = new Map<string, number>();
	private itemDurations: number[] = [];
	private navigationCount = 0;
	private submissionCount = 0;
	private submissionLatencies: number[] = [];
	private enabled: boolean;

	constructor(config: { enabled?: boolean } = {}) {
		this.enabled = config.enabled ?? false;
	}

	/**
	 * Enable tracking
	 */
	enable(): void {
		this.enabled = true;
	}

	/**
	 * Disable tracking
	 */
	disable(): void {
		this.enabled = false;
	}

	/**
	 * Mark assessment start
	 */
	startAssessment(): void {
		if (!this.enabled) return;
		this.assessmentStartTime = performance.now();
	}

	/**
	 * Mark assessment end
	 */
	endAssessment(): void {
		if (!this.enabled || !this.assessmentStartTime) return;
		this.assessmentEndTime = performance.now();
	}

	/**
	 * Track navigation event
	 */
	trackNavigation(_type: 'next' | 'previous' | 'jump' | 'section'): void {
		if (!this.enabled) return;
		this.navigationCount++;
	}

	/**
	 * Track item start
	 */
	trackItemStart(itemId: string): void {
		if (!this.enabled) return;
		this.itemStartTimes.set(itemId, performance.now());
	}

	/**
	 * Track item completion
	 */
	trackItemComplete(itemId: string): void {
		if (!this.enabled) return;

		const startTime = this.itemStartTimes.get(itemId);
		if (startTime) {
			const duration = performance.now() - startTime;
			this.itemDurations.push(duration);
			this.itemStartTimes.delete(itemId);
		}
	}

	/**
	 * Track response submission
	 */
	trackSubmission(latencyMs: number): void {
		if (!this.enabled) return;
		this.submissionCount++;
		this.submissionLatencies.push(latencyMs);
	}

	/**
	 * Get aggregated assessment metrics
	 */
	getAssessmentMetrics(): AssessmentPerformanceMetrics {
		const metrics: AssessmentPerformanceMetrics = {
			itemsCompleted: this.itemDurations.length,
			navigationCount: this.navigationCount,
			submissionCount: this.submissionCount,
		};

		// Calculate total duration
		if (this.assessmentStartTime && this.assessmentEndTime) {
			metrics.assessmentStartTime = this.assessmentStartTime;
			metrics.assessmentEndTime = this.assessmentEndTime;
			metrics.totalDuration = this.assessmentEndTime - this.assessmentStartTime;
		}

		// Calculate average item time
		if (this.itemDurations.length > 0) {
			const sum = this.itemDurations.reduce((a, b) => a + b, 0);
			metrics.averageItemTime = sum / this.itemDurations.length;
		}

		// Calculate average submission latency
		if (this.submissionLatencies.length > 0) {
			const sum = this.submissionLatencies.reduce((a, b) => a + b, 0);
			metrics.averageSubmissionLatency = sum / this.submissionLatencies.length;
		}

		return metrics;
	}

	/**
	 * Reset all metrics
	 */
	reset(): void {
		this.assessmentStartTime = undefined;
		this.assessmentEndTime = undefined;
		this.itemStartTimes.clear();
		this.itemDurations = [];
		this.navigationCount = 0;
		this.submissionCount = 0;
		this.submissionLatencies = [];
	}

	/**
	 * Export metrics to console
	 */
	exportToConsole(): void {
		const metrics = this.getAssessmentMetrics();

		console.group('📊 Assessment Performance Metrics');

		if (metrics.totalDuration) {
			console.log(`Total Duration: ${(metrics.totalDuration / 1000).toFixed(1)}s`);
		}

		console.log(`Items Completed: ${metrics.itemsCompleted}`);

		if (metrics.averageItemTime) {
			console.log(`Average Item Time: ${(metrics.averageItemTime / 1000).toFixed(1)}s`);
		}

		console.log(`Navigation Events: ${metrics.navigationCount}`);
		console.log(`Submissions: ${metrics.submissionCount}`);

		if (metrics.averageSubmissionLatency) {
			console.log(`Average Submission Latency: ${metrics.averageSubmissionLatency.toFixed(0)}ms`);
		}

		console.groupEnd();
	}
}
