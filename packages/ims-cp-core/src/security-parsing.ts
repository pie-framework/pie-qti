export interface SrcsetCandidate {
	readonly raw: string;
	readonly url: string;
	readonly descriptors: string;
}

export function decodeXmlAttribute(value: string): string {
	return value.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|amp|lt|gt|quot|apos);/g, (match, entity: string) => {
		switch (entity) {
			case 'amp':
				return '&';
			case 'lt':
				return '<';
			case 'gt':
				return '>';
			case 'quot':
				return '"';
			case 'apos':
				return "'";
			default: {
				const radix = entity.startsWith('#x') ? 16 : 10;
				const codePoint = Number.parseInt(entity.slice(radix === 16 ? 2 : 1), radix);
				if (!Number.isFinite(codePoint)) return match;
				try {
					return String.fromCodePoint(codePoint);
				} catch {
					return match;
				}
			}
		}
	});
}

export function parseSrcsetCandidates(value: string): SrcsetCandidate[] {
	const candidates: SrcsetCandidate[] = [];
	let index = 0;
	while (index < value.length) {
		while (index < value.length && /[\s,]/.test(value[index] ?? '')) index += 1;
		const start = index;
		if (start >= value.length) break;
		const isDataUrl = value.slice(index).toLowerCase().startsWith('data:');
		while (index < value.length && (isDataUrl ? !/\s/.test(value[index] ?? '') : !/[\s,]/.test(value[index] ?? ''))) {
			index += 1;
		}
		const url = value.slice(start, index);
		const descriptorStart = index;
		while (index < value.length && value[index] !== ',') index += 1;
		const raw = value.slice(start, index).trim();
		const descriptors = value.slice(descriptorStart, index).trim();
		if (url) candidates.push({ raw, url, descriptors });
		if (value[index] === ',') index += 1;
	}
	return candidates;
}

export function isBlockedStylesheetCss(css: string): boolean {
	const normalized = normalizeCssForPolicy(css);
	return /@import|url\(|(?:-webkit-)?image-set\(|<\/style|expression\(|javascript:|vbscript:|data:/i.test(normalized);
}

export function normalizeCssForPolicy(css: string): string {
	return decodeCssEscapes(css.replace(/\/\*[\s\S]*?\*\//g, '')).replace(/\s+/g, '');
}

function decodeCssEscapes(css: string): string {
	return css.replace(/\\([0-9a-fA-F]{1,6}\s?|.)/g, (_, escaped: string) => {
		const hex = escaped.trim();
		if (/^[0-9a-fA-F]+$/.test(hex)) {
			const codePoint = Number.parseInt(hex, 16);
			if (Number.isFinite(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff) {
				return String.fromCodePoint(codePoint);
			}
		}
		return escaped.charAt(0);
	});
}
