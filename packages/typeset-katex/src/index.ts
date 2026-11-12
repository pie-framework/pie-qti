let loaded: Promise<typeof import('katex/contrib/auto-render')> | null = null;

/**
 * Single-flight loader for the KaTeX auto-render chunk. While pending,
 * concurrent callers share one import. A rejected import clears the cached
 * promise: a transient chunk failure (blocked network, stale-deploy 404) must
 * not poison the page for its lifetime — the next typeset pass retries.
 */
function loadAutoRender(): Promise<typeof import('katex/contrib/auto-render')> {
	if (!loaded) {
		loaded = import('katex/contrib/auto-render').catch((error: unknown) => {
			loaded = null;
			throw error;
		});
	}
	return loaded;
}

export interface TypesetMathOptions {
	/**
	 * If true, also parse single-dollar inline math `$...$`.
	 * This is off by default because `$` is common in non-math text.
	 */
	enableSingleDollar?: boolean;
}

const MATHML_NAMESPACE = 'http://www.w3.org/1998/Math/MathML';

/** MathML element names, used to re-namespace prefixed MathML such as `<m:math>`. */
const MATHML_ELEMENT_NAMES = new Set([
	'annotation',
	'annotation-xml',
	'maction',
	'maligngroup',
	'malignmark',
	'math',
	'menclose',
	'merror',
	'mfenced',
	'mfrac',
	'mglyph',
	'mi',
	'mlabeledtr',
	'mlongdiv',
	'mmultiscripts',
	'mn',
	'mo',
	'mover',
	'mpadded',
	'mphantom',
	'mprescripts',
	'mroot',
	'mrow',
	'ms',
	'mscarries',
	'mscarry',
	'msgroup',
	'msline',
	'mspace',
	'msqrt',
	'msrow',
	'mstack',
	'mstyle',
	'msub',
	'msubsup',
	'msup',
	'mtable',
	'mtd',
	'mtext',
	'mtr',
	'munder',
	'munderover',
	'none',
	'semantics',
]);

/**
 * Elements KaTeX auto-render never descends into. `math` keeps authored MathML
 * native: LaTeX-looking text inside it (for example in `<mtext>`) is content,
 * not markup to typeset. `option` matches KaTeX's own default list.
 */
const IGNORED_TAGS = ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'option', 'math'];

/** Editable regions and KaTeX output are never rewritten. */
function isProtected(element: Element): boolean {
	return element.closest('[contenteditable="true"], .katex') !== null;
}

function unprefixedName(element: Element): string {
	const name = element.localName.toLowerCase();
	return name.slice(name.indexOf(':') + 1);
}

/**
 * Rebuild a prefixed MathML subtree (`<m:math>`, `<m:mi>`, ...) that the HTML
 * parser created as unknown HTML elements, as real MathML elements so the
 * browser's MathML Core renderer can display it. Attributes (including
 * `alttext` and `display`) are kept; namespace declarations are dropped.
 */
function toNativeMathML(source: Element): Element {
	const target = source.ownerDocument.createElementNS(MATHML_NAMESPACE, unprefixedName(source));
	for (const attribute of Array.from(source.attributes)) {
		if (attribute.name === 'xmlns' || attribute.name.startsWith('xmlns:')) continue;
		target.setAttribute(attribute.name, attribute.value);
	}
	for (const child of Array.from(source.childNodes)) {
		const isMathElement =
			child.nodeType === 1 &&
			(child as Element).namespaceURI !== MATHML_NAMESPACE &&
			MATHML_ELEMENT_NAMES.has(unprefixedName(child as Element));
		target.appendChild(isMathElement ? toNativeMathML(child as Element) : child);
	}
	return target;
}

function nativizePrefixedMathML(root: HTMLElement): void {
	const roots = Array.from(root.querySelectorAll('*')).filter((element) => {
		const name = element.localName.toLowerCase();
		return name.includes(':') && unprefixedName(element) === 'math';
	});
	for (const element of roots) {
		// Nested candidates leave the document when their outer root is rebuilt.
		if (!root.contains(element) || isProtected(element)) continue;
		element.replaceWith(toNativeMathML(element));
	}
}

function createOperator(doc: Document, text: string, role: 'fence' | 'separator'): Element {
	const operator = doc.createElementNS(MATHML_NAMESPACE, 'mo');
	operator.setAttribute(role, 'true');
	operator.textContent = text;
	return operator;
}

/**
 * Expand `<mfenced>` into its MathML 3 equivalent (MathML 3, section 3.3.8):
 * an `mrow` with fence and separator `mo` elements. MathML Core, and therefore
 * Chromium, does not render `mfenced`, so its fences would otherwise vanish.
 */
function expandMfenced(mfenced: Element): void {
	const doc = mfenced.ownerDocument;
	const open = mfenced.getAttribute('open') ?? '(';
	const close = mfenced.getAttribute('close') ?? ')';
	const separators = Array.from((mfenced.getAttribute('separators') ?? ',').replace(/\s+/g, ''));
	const args = Array.from(mfenced.children);

	const outer = doc.createElementNS(MATHML_NAMESPACE, 'mrow');
	for (const attribute of Array.from(mfenced.attributes)) {
		if (attribute.name === 'open' || attribute.name === 'close' || attribute.name === 'separators') continue;
		outer.setAttribute(attribute.name, attribute.value);
	}

	if (open) outer.appendChild(createOperator(doc, open, 'fence'));
	const inner = args.length > 1 ? doc.createElementNS(MATHML_NAMESPACE, 'mrow') : outer;
	args.forEach((arg, index) => {
		if (index > 0 && separators.length > 0) {
			const separator = separators[Math.min(index - 1, separators.length - 1)];
			inner.appendChild(createOperator(doc, separator, 'separator'));
		}
		inner.appendChild(arg);
	});
	if (inner !== outer) outer.appendChild(inner);
	if (close) outer.appendChild(createOperator(doc, close, 'fence'));

	mfenced.replaceWith(outer);
}

/**
 * Authored MathML is never converted to LaTeX: it stays native MathML (MathML
 * Core renders in evergreen browsers), so authored structure and `alttext`
 * reach sighted and assistive-technology users intact. Only two lossless
 * normalisations are applied so it can render natively: prefixed MathML is
 * re-created in the MathML namespace, and `mfenced` is expanded.
 * Idempotent: a second pass finds nothing to change.
 */
function normalizeMathML(root: HTMLElement): void {
	const html = root.innerHTML;
	if (html.includes(':math')) {
		nativizePrefixedMathML(root);
	}
	if (html.includes('mfenced')) {
		for (const mfenced of Array.from(root.querySelectorAll('mfenced'))) {
			if (!isProtected(mfenced)) expandMfenced(mfenced);
		}
	}
}

function containsLatexDelimiters(root: HTMLElement, options: TypesetMathOptions) {
	// Cheap pre-check to avoid loading KaTeX on pages with no LaTeX.
	// We check innerHTML for backslashes because textContent would drop them in some cases.
	const s = root.innerHTML;
	if (s.includes('\\(') || s.includes('\\[') || s.includes('$$')) return true;
	if (options.enableSingleDollar && s.includes('$')) return true;
	// Common LaTeX environments
	if (s.includes('\\begin{') || s.includes('\\frac') || s.includes('\\sqrt')) return true;
	return false;
}

/**
 * Typeset LaTeX delimiters in text with KaTeX and leave authored MathML native.
 */
export async function typesetMathInElement(root: HTMLElement, options: TypesetMathOptions = {}) {
	normalizeMathML(root);

	if (!containsLatexDelimiters(root, options)) return;

	const autoRenderModule = await loadAutoRender();
	const renderMathInElement = (autoRenderModule as any).default || autoRenderModule;

	// Never typeset inside editable regions (e.g. TipTap / ProseMirror).
	// Auto-render mutates the DOM, which can break editors.
	const EDITOR_IGNORE_CLASS = 'katex-ignore-editor';
	const editable = Array.from(root.querySelectorAll<HTMLElement>('[contenteditable="true"]'));
	for (const el of editable) el.classList.add(EDITOR_IGNORE_CLASS);

	try {
		renderMathInElement(root, {
			// Prefer explicit delimiters to avoid false positives
			delimiters: [
				{ left: '\\(', right: '\\)', display: false },
				{ left: '\\[', right: '\\]', display: true },
				{ left: '$$', right: '$$', display: true },
				...(options.enableSingleDollar ? [{ left: '$', right: '$', display: false }] : []),
			],
			// Don't parse in code-ish areas or inside authored MathML
			ignoredTags: IGNORED_TAGS,
			// Avoid re-processing already rendered KaTeX nodes
			ignoredClasses: ['katex', 'katex-display', EDITOR_IGNORE_CLASS],
			throwOnError: false,
		});
	} finally {
		// The exclusion class must never outlive this pass: a render that
		// throws (unexpected DOM shapes) would otherwise leave every editable
		// region in `ignoredClasses` permanently — all later passes would skip
		// them and math would silently stop rendering for the session.
		for (const el of editable) el.classList.remove(EDITOR_IGNORE_CLASS);
	}
}
