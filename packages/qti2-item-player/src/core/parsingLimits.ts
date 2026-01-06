import type { PlayerSecurityConfig } from '../types/index.js';

export type NormalizedParsingLimits = {
	enabled: boolean;
	rejectDoctype: boolean;
	maxItemXmlBytes: number;
	maxHtmlBytes: number;
	maxHtmlNodes: number;
	maxHtmlDepth: number;
};

const DEFAULTS: Omit<NormalizedParsingLimits, 'enabled'> = {
	rejectDoctype: true,
	maxItemXmlBytes: 10_000_000,
	maxHtmlBytes: 5_000_000,
	maxHtmlNodes: 200_000,
	maxHtmlDepth: 200,
};

function getByteLengthUtf8(s: string): number {
	// TextEncoder is available in modern runtimes (browser + Bun/node 18+).
	// Fall back to a conservative approximation if unavailable.
	const TE: typeof TextEncoder | undefined = (globalThis as any).TextEncoder;
	if (!TE) return s.length * 2;
	return new TE().encode(s).byteLength;
}

export function normalizeParsingLimits(security?: PlayerSecurityConfig): NormalizedParsingLimits {
	const cfg = security?.parsingLimits;
	const enabled = cfg?.enabled === true;
	if (!enabled) {
		return { enabled: false, ...DEFAULTS };
	}

	return {
		enabled: true,
		rejectDoctype: cfg?.rejectDoctype ?? DEFAULTS.rejectDoctype,
		maxItemXmlBytes: cfg?.maxItemXmlBytes ?? DEFAULTS.maxItemXmlBytes,
		maxHtmlBytes: cfg?.maxHtmlBytes ?? DEFAULTS.maxHtmlBytes,
		maxHtmlNodes: cfg?.maxHtmlNodes ?? DEFAULTS.maxHtmlNodes,
		maxHtmlDepth: cfg?.maxHtmlDepth ?? DEFAULTS.maxHtmlDepth,
	};
}

export function enforceItemXmlLimits(itemXml: string, security?: PlayerSecurityConfig): void {
	const limits = normalizeParsingLimits(security);
	if (!limits.enabled) return;

	const bytes = getByteLengthUtf8(String(itemXml ?? ''));
	if (bytes > limits.maxItemXmlBytes) {
		throw new Error(`itemXml exceeds maxItemXmlBytes (${bytes} > ${limits.maxItemXmlBytes})`);
	}

	if (limits.rejectDoctype) {
		// Case-insensitive and tolerant of whitespace: "<!DOCTYPE"
		if (/<!\s*doctype/i.test(itemXml)) {
			throw new Error('itemXml contains <!DOCTYPE>, which is rejected by parsingLimits');
		}
	}
}


