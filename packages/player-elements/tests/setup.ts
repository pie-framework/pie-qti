// Bun test setup: provide browser globals that tests need

import { parseHTML } from 'linkedom';

// Create a minimal DOM environment
const dom = parseHTML('<!DOCTYPE html><html><body></body></html>');

// Make DOMParser and other DOM APIs globally available in tests
(globalThis as any).DOMParser = dom.DOMParser;
(globalThis as any).Document = dom.Document;
(globalThis as any).Element = dom.Element;
(globalThis as any).Node = dom.Node;

// Polyfill XMLSerializer since linkedom doesn't provide it
// Use the innerHTML/outerHTML properties instead
(globalThis as any).XMLSerializer = class XMLSerializer {
	serializeToString(node: any): string {
		if (node.outerHTML) {
			return node.outerHTML;
		}
		if (node.innerHTML !== undefined) {
			return node.innerHTML;
		}
		if (node.textContent !== undefined) {
			return node.textContent;
		}
		return String(node);
	}
};
