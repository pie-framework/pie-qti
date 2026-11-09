/**
 * Formats a duration as a clock readout: `MM:SS`, or `HH:MM:SS` once hours are
 * involved (hours unpadded, minutes and seconds padded to two digits).
 *
 * Pass the provider's `formatNumber` to render the locale's digits; without it the
 * digits are Western.
 */
export function formatTime(
	seconds: number,
	formatNumber?: (value: number, options?: Intl.NumberFormatOptions) => string
): string {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = seconds % 60;
	const format = (value: number, digits: number) =>
		formatNumber
			? formatNumber(value, { minimumIntegerDigits: digits, useGrouping: false })
			: value.toString().padStart(digits, '0');

	if (hours > 0) {
		return `${format(hours, 1)}:${format(minutes, 2)}:${format(secs, 2)}`;
	}

	return `${format(minutes, 1)}:${format(secs, 2)}`;
}
