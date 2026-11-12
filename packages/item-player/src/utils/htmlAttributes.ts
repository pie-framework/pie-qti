/**
 * Reads one attribute out of a serialized HTML attribute string — the attribute text of a matched
 * tag (e.g. a regex capture of `<gap identifier="g1">`), not a DOM element. This is the one reader
 * for markup the player handles as text: the gap-match extractor's prompt rewriting, the
 * presentation pass's stimulus docking, and the feedback announcement's feedback tags.
 *
 * Quote pairs must match, an empty value is a value (`identifier=""` is present and empty, not
 * absent), and a camelCase name also tries its kebab spelling (`outcomeIdentifier` or
 * `outcome-identifier`), since QTI 2.x and QTI 3.0 spell attributes differently. Only whitespace
 * may precede the name, so `data-identifier` does not read as `identifier`. Returns null when the
 * attribute is absent; otherwise its value, untrimmed.
 */
export function readHtmlAttribute(attrs: string, name: string): string | null {
	const kebab = name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
	for (const spelling of kebab === name ? [name] : [name, kebab]) {
		const match = new RegExp(`(?:^|\\s)${spelling}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(attrs);
		if (match) return match[1] ?? match[2] ?? '';
	}
	return null;
}
