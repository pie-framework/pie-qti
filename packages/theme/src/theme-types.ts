export type QtiThemeVariables = Record<`--pie-qti-${string}`, string>;

export function normalizeQtiThemeVariables(value: unknown): QtiThemeVariables {
	if (!value || typeof value !== 'object') {
		return {};
	}

	const output: QtiThemeVariables = {};
	for (const [key, rawValue] of Object.entries(value as Record<string, unknown>)) {
		if (!key.startsWith('--pie-qti-')) {
			continue;
		}

		if (typeof rawValue === 'string') {
			const trimmed = rawValue.trim();
			if (trimmed) {
				output[key as `--pie-qti-${string}`] = trimmed;
			}
		} else if (typeof rawValue === 'number') {
			output[key as `--pie-qti-${string}`] = String(rawValue);
		}
	}

	return output;
}
