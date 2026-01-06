/**
 * Test setup - mock browser globals for Node/Bun environment
 */

// Mock HTMLElement for web components
if (typeof globalThis.HTMLElement === 'undefined') {
	(globalThis as any).HTMLElement = class HTMLElement {
		setAttribute() {}
		getAttribute() { return null; }
		removeAttribute() {}
		addEventListener() {}
		removeEventListener() {}
		dispatchEvent() { return true; }
	};
}

// Mock customElements
if (typeof globalThis.customElements === 'undefined') {
	(globalThis as any).customElements = {
		define: () => {},
		get: () => undefined,
		whenDefined: () => Promise.resolve(),
	};
}

// Mock window if needed
if (typeof globalThis.window === 'undefined') {
	(globalThis as any).window = globalThis;
}
