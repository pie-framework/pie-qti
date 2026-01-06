let loaded: Promise<typeof import('katex/contrib/auto-render')> | null = null;

async function loadAutoRender() {
	if (!loaded) {
		loaded = import('katex/contrib/auto-render');
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

/**
 * Convert MathML element to LaTeX string.
 * This is a basic converter for common QTI 2.2 MathML patterns.
 *
 * NOTE: This is intentionally minimal; if you need comprehensive MathML support,
 * consider integrating a dedicated MathML→LaTeX library in your host app.
 */
function mathmlToLatex(mathElement: Element): string {
	const tagName = mathElement.tagName.toLowerCase().replace(/^m:/, '');

	// Handle <math> root element
	if (tagName === 'math') {
		const children = Array.from(mathElement.children);
		return children.map((c) => mathmlToLatex(c)).join(' ');
	}

	// Handle <mrow> (row of elements)
	if (tagName === 'mrow') {
		const children = Array.from(mathElement.children);
		return children.map((c) => mathmlToLatex(c)).join(' ');
	}

	// Handle <mi> (identifier), <mn> (number), <mo> (operator)
	if (tagName === 'mi' || tagName === 'mn' || tagName === 'mo') {
		return mathElement.textContent || '';
	}

	// Handle <msup> (superscript: base^exponent)
	if (tagName === 'msup') {
		const children = Array.from(mathElement.children);
		if (children.length === 2) {
			const base = mathmlToLatex(children[0]);
			const exp = mathmlToLatex(children[1]);
			return `{${base}}^{${exp}}`;
		}
	}

	// Handle <msub> (subscript: base_subscript)
	if (tagName === 'msub') {
		const children = Array.from(mathElement.children);
		if (children.length === 2) {
			const base = mathmlToLatex(children[0]);
			const sub = mathmlToLatex(children[1]);
			return `{${base}}_{${sub}}`;
		}
	}

	// Handle <mfrac> (fraction)
	if (tagName === 'mfrac') {
		const children = Array.from(mathElement.children);
		if (children.length === 2) {
			const num = mathmlToLatex(children[0]);
			const den = mathmlToLatex(children[1]);
			return `\\frac{${num}}{${den}}`;
		}
	}

	// Handle <msqrt> (square root)
	if (tagName === 'msqrt') {
		const children = Array.from(mathElement.children);
		const content = children.map((c) => mathmlToLatex(c)).join(' ');
		return `\\sqrt{${content}}`;
	}

	// Handle <mroot> (nth root)
	if (tagName === 'mroot') {
		const children = Array.from(mathElement.children);
		if (children.length === 2) {
			const base = mathmlToLatex(children[0]);
			const index = mathmlToLatex(children[1]);
			return `\\sqrt[${index}]{${base}}`;
		}
	}

	// Handle <mfenced> (parentheses, brackets, etc.)
	if (tagName === 'mfenced') {
		const open = mathElement.getAttribute('open') || '(';
		const close = mathElement.getAttribute('close') || ')';
		const children = Array.from(mathElement.children);
		const content = children.map((c) => mathmlToLatex(c)).join(', ');
		return `${open}${content}${close}`;
	}

	// Fallback: return text content
	return mathElement.textContent || '';
}

/**
 * Convert MathML elements to LaTeX delimited strings in place.
 * This pre-processes the DOM before KaTeX auto-render runs.
 */
function convertMathMLToLatex(root: HTMLElement): void {
	// Find all <math> elements (with or without namespace prefix)
	const mathElements = Array.from(root.querySelectorAll('math, m\\:math'));

	for (const mathEl of mathElements) {
		try {
			const latex = mathmlToLatex(mathEl);
			// Determine if this should be display or inline math
			const display = mathEl.getAttribute('display') === 'block';
			// Create text node with LaTeX delimiters
			const latexText = display ? `\\[${latex}\\]` : `\\(${latex}\\)`;
			const textNode = document.createTextNode(latexText);
			// Replace MathML element with LaTeX text
			mathEl.replaceWith(textNode);
		} catch (error) {
			console.error('Failed to convert MathML to LaTeX:', error, mathEl);
			// Leave the original MathML in place on error
		}
	}
}

function containsMathDelimiters(root: HTMLElement, options: TypesetMathOptions) {
	// Cheap pre-check to avoid loading KaTeX on pages with no math.
	// We check innerHTML for backslashes because textContent would drop them in some cases.
	const s = root.innerHTML;
	if (s.includes('\\(') || s.includes('\\[') || s.includes('$$')) return true;
	if (options.enableSingleDollar && s.includes('$')) return true;
	// Common LaTeX environments
	if (s.includes('\\begin{') || s.includes('\\frac') || s.includes('\\sqrt')) return true;
	// MathML tags (QTI 2.2 standard)
	if (s.includes('<math') || s.includes('<m:math')) return true;
	return false;
}

export async function typesetMathInElement(root: HTMLElement, options: TypesetMathOptions = {}) {
	if (!containsMathDelimiters(root, options)) return;

	// Pre-process: Convert MathML to LaTeX before KaTeX typesetting
	convertMathMLToLatex(root);

	const autoRenderModule = await loadAutoRender();
	const renderMathInElement = (autoRenderModule as any).default || autoRenderModule;

	// Never typeset inside editable regions (e.g. TipTap / ProseMirror).
	// Auto-render mutates the DOM, which can break editors.
	const EDITOR_IGNORE_CLASS = 'katex-ignore-editor';
	const editable = Array.from(root.querySelectorAll<HTMLElement>('[contenteditable="true"]'));
	for (const el of editable) el.classList.add(EDITOR_IGNORE_CLASS);

	renderMathInElement(root, {
		// Prefer explicit delimiters to avoid false positives
		delimiters: [
			{ left: '\\(', right: '\\)', display: false },
			{ left: '\\[', right: '\\]', display: true },
			{ left: '$$', right: '$$', display: true },
			...(options.enableSingleDollar ? [{ left: '$', right: '$', display: false }] : []),
		],
		// Don't try to parse in code-ish areas
		ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
		// Avoid re-processing already rendered KaTeX nodes
		ignoredClasses: ['katex', 'katex-display', EDITOR_IGNORE_CLASS],
		throwOnError: false,
	});

	for (const el of editable) el.classList.remove(EDITOR_IGNORE_CLASS);
}


