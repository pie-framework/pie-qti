/** A `heading-level` attribute value: an integer from 1 to 6, else unset. */
export function parseHeadingLevel(value: string | null): number | undefined {
	if (value === null || value.trim() === '') return undefined;
	const level = Number(value);
	return Number.isInteger(level) && level >= 1 && level <= 6 ? level : undefined;
}
