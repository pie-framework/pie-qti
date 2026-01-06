/**
 * Performance Monitor Utility
 *
 * Provides lightweight performance monitoring for QTI player operations
 * without requiring external dependencies. Useful for debugging, optimization,
 * and tracking performance metrics in production.
 *
 * Features:
 * - Measure operation durations
 * - Track custom metrics
 * - Export performance data
 * - Memory-efficient (circular buffer for metrics)
 *
 * Usage:
 * ```typescript
 * import { PerformanceMonitor } from './utils/PerformanceMonitor';
 *
 * const monitor = new PerformanceMonitor({ enabled: true, maxEntries: 100 });
 *
 * // Measure an operation
 * const stopTimer = monitor.startTimer('render-item');
 * // ... do work
 * stopTimer(); // Records duration
 *
 * // Track custom metrics
 * monitor.recordMetric('item-response-time', 245);
 *
 * // Get performance report
 * const report = monitor.getReport();
 * console.log(report);
 * ```
 */

export interface PerformanceEntry {
	/** Metric name */
	name: string;
	/** Timestamp when metric was recorded (ms since epoch) */
	timestamp: number;
	/** Duration in milliseconds (for timers) */
	duration?: number;
	/** Custom value (for non-timer metrics) */
	value?: number;
	/** Additional metadata */
	metadata?: Record<string, unknown>;
}

export interface PerformanceReport {
	/** Total number of metrics recorded */
	totalEntries: number;
	/** Number of entries currently stored (may be less due to circular buffer) */
	storedEntries: number;
	/** Summary statistics by metric name */
	metrics: Record<
		string,
		{
			count: number;
			min: number;
			max: number;
			avg: number;
			total: number;
		}
	>;
	/** Recent entries (last N based on buffer size) */
	recentEntries: PerformanceEntry[];
}

export interface PerformanceMonitorConfig {
	/** Enable/disable monitoring (default: false) */
	enabled?: boolean;
	/** Maximum entries to store (circular buffer, default: 100) */
	maxEntries?: number;
	/** Auto-export metrics when buffer is full (default: false) */
	autoExport?: boolean;
	/** Callback for auto-export */
	onExport?: (report: PerformanceReport) => void;
	/** Log warnings to console (default: false) */
	logWarnings?: boolean;
}

export class PerformanceMonitor {
	private enabled: boolean;
	private maxEntries: number;
	private autoExport: boolean;
	private onExport?: (report: PerformanceReport) => void;
	private logWarnings: boolean;

	private entries: PerformanceEntry[] = [];
	private totalRecorded = 0;
	private startTimes = new Map<string, number>();

	constructor(config: PerformanceMonitorConfig = {}) {
		this.enabled = config.enabled ?? false;
		this.maxEntries = config.maxEntries ?? 100;
		this.autoExport = config.autoExport ?? false;
		this.onExport = config.onExport;
		this.logWarnings = config.logWarnings ?? false;
	}

	/**
	 * Enable performance monitoring
	 */
	enable(): void {
		this.enabled = true;
	}

	/**
	 * Disable performance monitoring
	 */
	disable(): void {
		this.enabled = false;
	}

	/**
	 * Check if monitoring is enabled
	 */
	isEnabled(): boolean {
		return this.enabled;
	}

	/**
	 * Start a timer for an operation
	 *
	 * @param name - Name of the operation
	 * @param metadata - Optional metadata to attach
	 * @returns Function to stop the timer and record duration
	 *
	 * @example
	 * const stop = monitor.startTimer('render-item', { itemId: 'item-001' });
	 * // ... do work
	 * stop(); // Records duration automatically
	 */
	startTimer(name: string, metadata?: Record<string, unknown>): () => void {
		if (!this.enabled) {
			return () => {}; // No-op
		}

		const startTime = performance.now();
		const timerKey = `${name}:${startTime}`;
		this.startTimes.set(timerKey, startTime);

		return () => {
			const endTime = performance.now();
			const duration = endTime - startTime;
			this.startTimes.delete(timerKey);

			this.recordEntry({
				name,
				timestamp: Date.now(),
				duration,
				metadata,
			});
		};
	}

	/**
	 * Record a custom metric value
	 *
	 * @param name - Name of the metric
	 * @param value - Numeric value
	 * @param metadata - Optional metadata
	 *
	 * @example
	 * monitor.recordMetric('item-count', 25);
	 * monitor.recordMetric('memory-usage', process.memoryUsage().heapUsed);
	 */
	recordMetric(name: string, value: number, metadata?: Record<string, unknown>): void {
		if (!this.enabled) return;

		this.recordEntry({
			name,
			timestamp: Date.now(),
			value,
			metadata,
		});
	}

	/**
	 * Record a performance entry
	 */
	private recordEntry(entry: PerformanceEntry): void {
		this.totalRecorded++;

		// Add to circular buffer
		if (this.entries.length >= this.maxEntries) {
			// Remove oldest entry
			this.entries.shift();

			// Auto-export if configured
			if (this.autoExport && this.onExport) {
				try {
					this.onExport(this.getReport());
				} catch (error) {
					if (this.logWarnings) {
						console.warn('Performance monitor auto-export failed:', error);
					}
				}
			}
		}

		this.entries.push(entry);
	}

	/**
	 * Get performance report with statistics
	 */
	getReport(): PerformanceReport {
		const metrics: Record<
			string,
			{
				count: number;
				min: number;
				max: number;
				avg: number;
				total: number;
			}
		> = {};

		// Calculate statistics for each metric
		for (const entry of this.entries) {
			const value = entry.duration ?? entry.value ?? 0;

			if (!metrics[entry.name]) {
				metrics[entry.name] = {
					count: 0,
					min: Infinity,
					max: -Infinity,
					avg: 0,
					total: 0,
				};
			}

			const stats = metrics[entry.name];
			stats.count++;
			stats.total += value;
			stats.min = Math.min(stats.min, value);
			stats.max = Math.max(stats.max, value);
		}

		// Calculate averages
		for (const stats of Object.values(metrics)) {
			stats.avg = stats.total / stats.count;
		}

		return {
			totalEntries: this.totalRecorded,
			storedEntries: this.entries.length,
			metrics,
			recentEntries: [...this.entries],
		};
	}

	/**
	 * Get entries for a specific metric name
	 */
	getEntriesByName(name: string): PerformanceEntry[] {
		return this.entries.filter((entry) => entry.name === name);
	}

	/**
	 * Clear all stored entries
	 */
	clear(): void {
		this.entries = [];
		this.totalRecorded = 0;
		this.startTimes.clear();
	}

	/**
	 * Export report as JSON string
	 */
	exportJSON(): string {
		return JSON.stringify(this.getReport(), null, 2);
	}

	/**
	 * Export report to console
	 */
	exportToConsole(): void {
		const report = this.getReport();

		console.group('📊 Performance Report');
		console.log(`Total Entries: ${report.totalEntries}`);
		console.log(`Stored Entries: ${report.storedEntries}`);
		console.log('\nMetrics:');

		for (const [name, stats] of Object.entries(report.metrics)) {
			console.group(`  ${name}`);
			console.log(`    Count: ${stats.count}`);
			console.log(`    Min: ${stats.min.toFixed(2)}ms`);
			console.log(`    Max: ${stats.max.toFixed(2)}ms`);
			console.log(`    Avg: ${stats.avg.toFixed(2)}ms`);
			console.log(`    Total: ${stats.total.toFixed(2)}ms`);
			console.groupEnd();
		}

		console.groupEnd();
	}

	/**
	 * Get performance marks for Web Performance API integration
	 *
	 * If using browser's Performance API, this exports entries
	 * in a compatible format.
	 */
	getPerformanceMarks(): Array<{
		name: string;
		startTime: number;
		duration?: number;
	}> {
		return this.entries.map((entry) => ({
			name: entry.name,
			startTime: entry.timestamp,
			duration: entry.duration,
		}));
	}
}

/**
 * Singleton instance for global performance monitoring
 *
 * Usage:
 * ```typescript
 * import { globalPerformanceMonitor } from './utils/PerformanceMonitor';
 *
 * globalPerformanceMonitor.enable();
 * const stop = globalPerformanceMonitor.startTimer('operation');
 * // ... work
 * stop();
 * ```
 */
export const globalPerformanceMonitor = new PerformanceMonitor({
	enabled: false, // Disabled by default, enable explicitly
	maxEntries: 100,
	logWarnings: false,
});
