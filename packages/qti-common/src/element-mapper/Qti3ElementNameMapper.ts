import type { ElementNameMapper } from './ElementNameMapper.js';
import { getCanonicalName, QTI3_ELEMENT_MAPPINGS } from './qti3-element-mappings.js';

const QTI3_NATIVE_BY_CANONICAL = new Map<string, string>(
	Object.entries(QTI3_ELEMENT_MAPPINGS).map(([native, canonical]) => [canonical, native]),
);

/**
 * Element name mapper for QTI 3.0.
 *
 * QTI-defined elements use kebab-case with a `qti-` prefix. HTML, MathML,
 * SVG, and extension vocabularies retain their native names.
 */
export class Qti3ElementNameMapper implements ElementNameMapper {
	readonly version = '3.0';
	private readonly PREFIX = 'qti-';

	toCanonical(elementName: string): string {
		const knownQtiName = getCanonicalName(elementName);
		if (knownQtiName) return knownQtiName;
		const canonicalName = elementName.toLowerCase();
		if (QTI3_NATIVE_BY_CANONICAL.has(canonicalName)) return canonicalName;

		if (elementName.startsWith(this.PREFIX)) {
			return elementName.slice(this.PREFIX.length).replace(/-/g, '').toLowerCase();
		}

		return elementName;
	}

	toNative(canonicalName: string): string {
		return QTI3_NATIVE_BY_CANONICAL.get(canonicalName.toLowerCase()) ?? canonicalName;
	}

	isValidElementName(elementName: string): boolean {
		if (!elementName.startsWith(this.PREFIX)) return false;
		if (elementName === this.PREFIX) return false;
		if (elementName.includes('--')) return false;
		if (elementName.endsWith('-')) return false;
		return /^qti-[a-z][a-z0-9-]*$/.test(elementName);
	}
}
