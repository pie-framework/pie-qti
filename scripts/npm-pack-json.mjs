/**
 * Parse `npm pack --json` output across npm versions.
 *
 * npm has emitted both an array and an object keyed by package name when stdout
 * is captured. Publication checks should depend on the semantic entry, not that
 * incidental envelope shape.
 */
export const getNpmPackEntry = (rawOutput, packageName) => {
	const lines = rawOutput.split(/\r?\n/);
	let parsed;
	let parseError;
	for (let index = 0; index < lines.length; index += 1) {
		const first = lines[index]?.trimStart()[0];
		if (first !== "[" && first !== "{") continue;
		try {
			parsed = JSON.parse(lines.slice(index).join("\n").trim());
			break;
		} catch (error) {
			parseError = error;
		}
	}
	if (parsed === undefined) {
		throw new Error("npm pack output did not include valid JSON payload", {
			cause: parseError,
		});
	}
	const entries = Array.isArray(parsed)
		? parsed
		: parsed && typeof parsed === "object"
			? Object.values(parsed)
			: [];
	const entry =
		entries.find(
			(candidate) =>
				candidate &&
				typeof candidate === "object" &&
				candidate.name === packageName,
		) ?? entries[0];

	if (!entry || typeof entry !== "object") {
		throw new Error(`npm pack output did not include an entry for ${packageName}`);
	}
	return entry;
};
