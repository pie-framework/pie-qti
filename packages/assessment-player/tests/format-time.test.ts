/**
 * The clock readout util the timer and the start screen render with
 * (`src/core/formatTime.ts`, moved off `TimeManager.formatTime`).
 */

import { describe, expect, test } from 'bun:test';
import { formatTime } from '../src/core/formatTime.js';

describe('formatTime', () => {
	test('minutes and seconds below an hour: M:SS', () => {
		expect(formatTime(0)).toBe('0:00');
		expect(formatTime(1)).toBe('0:01');
		expect(formatTime(9)).toBe('0:09');
		expect(formatTime(10)).toBe('0:10');
		expect(formatTime(59)).toBe('0:59');
		expect(formatTime(60)).toBe('1:00');
		expect(formatTime(65)).toBe('1:05');
		expect(formatTime(599)).toBe('9:59');
	});

	test('the hour boundary switches to H:MM:SS', () => {
		expect(formatTime(3599)).toBe('59:59');
		expect(formatTime(3600)).toBe('1:00:00');
		expect(formatTime(3661)).toBe('1:01:01');
		expect(formatTime(3725)).toBe('1:02:05');
	});

	test('minutes and seconds pad to two digits, hours stay unpadded', () => {
		expect(formatTime(86399)).toBe('23:59:59');
		expect(formatTime(360000)).toBe('100:00:00');
		expect(formatTime(3600 + 60)).toBe('1:01:00');
	});

	test('fractional seconds keep their fraction (the ticking UI rounds up)', () => {
		expect(formatTime(65.5)).toBe('1:5.5');
		expect(formatTime(65.25)).toBe('1:5.25');
	});

	test('negative durations read as the arithmetic gives them (callers clamp first)', () => {
		expect(formatTime(-5)).toBe('-1:-5');
		expect(formatTime(-3601)).toBe('-1:-1');
	});

	test('takes the locale digits from a number formatter, ungrouped', () => {
		const arabicIndic = (value: number, options?: Intl.NumberFormatOptions) =>
			new Intl.NumberFormat('ar-EG-u-nu-arab', options).format(value);
		expect(formatTime(65, arabicIndic)).toBe('١:٠٥');
		expect(formatTime(3725, arabicIndic)).toBe('١:٠٢:٠٥');
		expect(formatTime(360000, arabicIndic)).toBe('١٠٠:٠٠:٠٠');

		// A formatter that would group thousands is held to ungrouped integers.
		const grouping = (value: number, options?: Intl.NumberFormatOptions) =>
			new Intl.NumberFormat('en-US', options).format(value);
		expect(formatTime(360000, grouping)).toBe('100:00:00');

		// Western digits keep Western digits, whatever the provider's locale.
		const western = (value: number, options?: Intl.NumberFormatOptions) =>
			new Intl.NumberFormat('de-DE', options).format(value);
		expect(formatTime(65, western)).toBe('1:05');
	});
});
