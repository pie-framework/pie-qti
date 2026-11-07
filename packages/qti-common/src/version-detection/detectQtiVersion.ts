/**
 * QTI version identifiers
 */
export type QtiVersion = '2.0' | '2.1' | '2.2' | '3.0' | 'unknown';

/** What decided a detected QTI version. */
export type QtiVersionDetectionBasis =
	/** The root element's namespace names a QTI version. */
	| 'namespace'
	/** A QTI 3.0 `qti-` element name, without a QTI namespace. */
	| 'root-element'
	/** A `version` attribute on a camelCase root, without a QTI namespace. */
	| 'version-attribute'
	/** Nothing named a version; a camelCase `assessmentItem`/`assessmentTest` is assumed to be 2.2. */
	| 'default'
	/** Not recognizable as QTI. */
	| 'none';

/**
 * How far to trust a detected version: `high` when the root declares the version's QTI namespace,
 * `medium` when another signal decided it, `low` when the version is an assumption.
 */
export type QtiVersionDetectionConfidence = 'high' | 'medium' | 'low';

export interface QtiVersionDetection {
	readonly version: QtiVersion;
	readonly basis: QtiVersionDetectionBasis;
	readonly confidence: QtiVersionDetectionConfidence;
	/** Why the result may be wrong, for callers to surface. Empty when the namespace decided. */
	readonly warnings: readonly string[];
}

type DetectedVersion = Exclude<QtiVersion, 'unknown'>;

/** The namespace each QTI version's items and tests declare. */
const QTI_NAMESPACES: Readonly<Record<DetectedVersion, string>> = {
	'2.0': 'http://www.imsglobal.org/xsd/imsqti_v2p0',
	'2.1': 'http://www.imsglobal.org/xsd/imsqti_v2p1',
	'2.2': 'http://www.imsglobal.org/xsd/imsqti_v2p2',
	'3.0': 'http://www.imsglobal.org/xsd/imsqtiasi_v3p0',
};

/**
 * Detect the QTI version from XML content.
 *
 * Detection strategy (in priority order):
 * 1. Check XML namespace URI for version indicators (v2p0, v2p1, v2p2, v3p0)
 * 2. Check root element name (qti-assessment-item => 3.0, assessmentItem => 2.x)
 * 3. Check version attribute on root element
 * 4. Fall back to '2.2' for a camelCase assessmentItem/assessmentTest root, else 'unknown'
 *
 * Use {@link detectQtiVersionDetailed} to learn whether the result was assumed.
 *
 * @param xml - QTI XML content as string
 * @returns Detected QTI version or 'unknown'
 *
 * @example
 * ```typescript
 * const xml = `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0">`;
 * detectQtiVersion(xml); // => '3.0'
 * ```
 */
export function detectQtiVersion(xml: string): QtiVersion {
	return detectQtiVersionDetailed(xml).version;
}

/**
 * Detect the QTI version from XML content, with what decided it and how far to trust it.
 *
 * The version is the one {@link detectQtiVersion} returns. An unversioned or unknown-namespace
 * camelCase root still reads as QTI 2.2, but with `basis: 'default'`, `confidence: 'low'` and a
 * warning, so callers can tell an assumption from a declaration and surface it.
 *
 * @example
 * ```typescript
 * detectQtiVersionDetailed('<assessmentItem identifier="a"/>');
 * // => { version: '2.2', basis: 'default', confidence: 'low',
 * //      warnings: ['Root <assessmentItem> declares no QTI namespace; assuming QTI 2.2.'] }
 * ```
 */
export function detectQtiVersionDetailed(xml: string): QtiVersionDetection {
	try {
		// Check if we're in a browser environment
		if (typeof window !== 'undefined' && typeof window.DOMParser !== 'undefined') {
			const parser = new window.DOMParser();
			const doc = parser.parseFromString(xml, 'text/xml');
			return detectFromDocument(doc);
		}

		// In Node.js environment, fall back to string-based detection
		// (xmldom can be optionally imported by consumers if needed)
		return detectFromString(xml);
	} catch {
		// If parsing fails, try string-based detection
		return detectFromString(xml);
	}
}

/**
 * Detect QTI version from a parsed Document.
 * @private
 */
function detectFromDocument(doc: any): QtiVersionDetection {
	const root = doc.documentElement;

	// Check for parse errors
	if (!root || root.tagName === 'parsererror') {
		return unknown('The XML could not be parsed.');
	}

	// Strategy 1: Check namespace URI
	if (root.namespaceURI) {
		const fromNamespace = namespaceDetection(root.namespaceURI);
		if (fromNamespace) return fromNamespace;
	}

	// Strategies 2 and 3: root element name, then its version attribute
	const localName = root.localName || root.tagName;
	return detectFromRoot(localName, root.getAttribute('version'), root.namespaceURI ?? null);
}

/**
 * Detect QTI version using string matching (fallback method).
 * @private
 */
function detectFromString(xml: string): QtiVersionDetection {
	const root = readRootStartTag(xml);

	// The root's own namespace declaration is authoritative.
	if (root?.namespace) {
		const fromNamespace = namespaceDetection(root.namespace);
		if (fromNamespace) return fromNamespace;
	}

	// A QTI namespace elsewhere in the document (a prefixed or nested declaration, a schema
	// location, even a comment) still decides, as it always has, but is not the root's.
	for (const [version, tokens] of DOCUMENT_NAMESPACE_TOKENS) {
		if (tokens.some((token) => xml.includes(token))) {
			return {
				version,
				basis: 'namespace',
				confidence: 'medium',
				warnings: [
					`The QTI ${version} namespace appears in the document but is not the root element's namespace; read as QTI ${version}.`,
				],
			};
		}
	}

	// Check root element or any QTI 3.0 element (kebab-case with qti- prefix)
	if (/<qti-assessment-(item|test)[\s>]/.test(xml) || /<qti-[a-z-]+[\s>]/.test(xml)) {
		return {
			version: '3.0',
			basis: 'root-element',
			confidence: 'medium',
			warnings: [missingNamespaceWarning(root?.localName ?? 'qti-*', root?.namespace ?? null, '3.0')],
		};
	}

	if (/<assessment(Item|Test)[\s>]/.test(xml)) {
		const localName = root && /^assessment(Item|Test)$/.test(root.localName) ? root.localName : 'assessmentItem';
		// The root's own version attribute, else (as before) the first version="…" in the document.
		const rootVersion = root?.attributes.get('version');
		const versionAttribute = rootVersion ?? xml.match(/version=["']([^"']+)["']/)?.[1] ?? null;
		return detectFromRoot(localName, versionAttribute, root?.namespace ?? null, rootVersion !== undefined);
	}

	return unknown(root ? `<${root.name}> is not a QTI assessmentItem or assessmentTest root.` : 'No XML root element found.');
}

/** The search order and namespace tokens of the legacy document-wide check. */
const DOCUMENT_NAMESPACE_TOKENS: ReadonlyArray<readonly [DetectedVersion, readonly string[]]> = [
	['3.0', ['imsqtiasi_v3p0', '/v3p0/']],
	['2.2', ['imsqti_v2p2', '/v2p2/']],
	['2.1', ['imsqti_v2p1', '/v2p1/']],
	['2.0', ['imsqti_v2p0', '/v2p0/']],
];

/** A root namespace that names a QTI version; null when it names none. */
function namespaceDetection(namespace: string): QtiVersionDetection | null {
	const version: DetectedVersion | null =
		namespace.includes('v3p0') || namespace.includes('imsqtiasi_v3p0')
			? '3.0'
			: namespace.includes('v2p2')
				? '2.2'
				: namespace.includes('v2p1')
					? '2.1'
					: namespace.includes('v2p0')
						? '2.0'
						: null;
	if (!version) return null;
	if (namespace === QTI_NAMESPACES[version]) {
		return { version, basis: 'namespace', confidence: 'high', warnings: [] };
	}
	return {
		version,
		basis: 'namespace',
		confidence: 'medium',
		warnings: [
			`Root namespace "${namespace}" is not the QTI ${version} namespace "${QTI_NAMESPACES[version]}"; read as QTI ${version}.`,
		],
	};
}

/** Strategies 2 to 4, for a root whose namespace names no QTI version. */
function detectFromRoot(
	localName: string,
	versionAttribute: string | null,
	namespace: string | null,
	versionOnRoot = true,
): QtiVersionDetection {
	// Strategy 2: any qti- prefixed root indicates QTI 3.0
	if (localName === 'qti-assessment-item' || localName === 'qti-assessment-test' || localName.startsWith('qti-')) {
		return {
			version: '3.0',
			basis: 'root-element',
			confidence: 'medium',
			warnings: [missingNamespaceWarning(localName, namespace, '3.0')],
		};
	}

	if (localName === 'assessmentItem' || localName === 'assessmentTest') {
		// Strategy 3: version attribute
		const fromAttribute = versionFromAttribute(versionAttribute);
		if (fromAttribute) {
			const source = versionOnRoot ? 'its' : 'a';
			return {
				version: fromAttribute,
				basis: 'version-attribute',
				confidence: 'medium',
				warnings: [
					`${missingNamespaceWarning(localName, namespace, fromAttribute)} The version comes from ${source} version="${versionAttribute}" attribute.`,
				],
			};
		}

		// Strategy 4: a camelCase root names no version; assume 2.2 (most common)
		const unread = versionAttribute && versionOnRoot ? ` Its version="${versionAttribute}" names no QTI version.` : '';
		return {
			version: '2.2',
			basis: 'default',
			confidence: 'low',
			warnings: [
				`${namespace ? `Root <${localName}> is in namespace "${namespace}", which is not a QTI namespace` : `Root <${localName}> declares no QTI namespace`}; assuming QTI 2.2.${unread}`,
			],
		};
	}

	return unknown(`<${localName}> is not a QTI assessmentItem or assessmentTest root.`);
}

function versionFromAttribute(version: string | null): DetectedVersion | null {
	if (!version) return null;
	if (version.startsWith('3.')) return '3.0';
	if (version.startsWith('2.2')) return '2.2';
	if (version.startsWith('2.1')) return '2.1';
	if (version.startsWith('2.0')) return '2.0';
	return null;
}

function missingNamespaceWarning(localName: string, namespace: string | null, version: DetectedVersion): string {
	const found = namespace ? `is in namespace "${namespace}"` : 'declares no namespace';
	return `Root <${localName}> ${found}, not the QTI ${version} namespace "${QTI_NAMESPACES[version]}".`;
}

function unknown(warning: string): QtiVersionDetection {
	return { version: 'unknown', basis: 'none', confidence: 'low', warnings: [warning] };
}

interface RootStartTag {
	/** The qualified name as written. */
	readonly name: string;
	readonly localName: string;
	readonly attributes: ReadonlyMap<string, string>;
	/** The namespace the root's prefix (or the default namespace) is bound to on the root itself. */
	readonly namespace: string | null;
}

/** The document element's start tag, read without a parser: after any prolog, comments and PIs. */
function readRootStartTag(xml: string): RootStartTag | null {
	let rest = xml.replace(/^\uFEFF/, '');
	for (;;) {
		rest = rest.trimStart();
		if (rest.startsWith('<?')) {
			const end = rest.indexOf('?>');
			if (end < 0) return null;
			rest = rest.slice(end + 2);
		} else if (rest.startsWith('<!--')) {
			const end = rest.indexOf('-->');
			if (end < 0) return null;
			rest = rest.slice(end + 3);
		} else if (rest.startsWith('<!')) {
			const end = rest.indexOf('>');
			if (end < 0) return null;
			rest = rest.slice(end + 1);
		} else {
			break;
		}
	}
	const tag = /^<([A-Za-z_][\w.:-]*)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*\/?>/.exec(rest);
	if (!tag) return null;
	const name = tag[1] as string;
	const attributes = new Map<string, string>();
	for (const attribute of (tag[2] ?? '').matchAll(/([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
		attributes.set(attribute[1] as string, attribute[2] ?? attribute[3] ?? '');
	}
	const colon = name.indexOf(':');
	const prefix = colon > 0 ? name.slice(0, colon) : null;
	const localName = prefix ? name.slice(colon + 1) : name;
	const namespace = attributes.get(prefix ? `xmlns:${prefix}` : 'xmlns') ?? null;
	return { name, localName, attributes, namespace: namespace || null };
}
