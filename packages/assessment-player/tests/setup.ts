/**
 * Test setup - Mock DOM environment for Bun tests
 *
 * This file sets up mocks BEFORE any test files are loaded,
 * allowing web components and other browser APIs to work in Node.js environment.
 */

// Mock HTMLElement for web components
if (typeof globalThis.HTMLElement === 'undefined') {
	(globalThis as any).HTMLElement = class HTMLElement {
		attributes: Record<string, string> = {};
		children: any[] = [];
		childNodes: any[] = [];
		classList: Set<string> = new Set();

		setAttribute(name: string, value: string) {
			this.attributes[name] = value;
		}

		getAttribute(name: string) {
			return this.attributes[name];
		}

		hasAttribute(name: string) {
			return name in this.attributes;
		}

		removeAttribute(name: string) {
			delete this.attributes[name];
		}

		appendChild(child: any) {
			this.children.push(child);
			this.childNodes.push(child);
			return child;
		}

		removeChild(child: any) {
			const index = this.children.indexOf(child);
			if (index > -1) {
				this.children.splice(index, 1);
				this.childNodes.splice(index, 1);
			}
			return child;
		}

		addEventListener() {}
		removeEventListener() {}
		dispatchEvent() {
			return true;
		}
	};
}

// Mock CustomEvent
if (typeof globalThis.CustomEvent === 'undefined') {
	(globalThis as any).CustomEvent = class CustomEvent {
		constructor(
			public type: string,
			public detail?: any
		) {}
	};
}

// Mock Event
if (typeof globalThis.Event === 'undefined') {
	(globalThis as any).Event = class Event {
		constructor(public type: string) {}
	};
}

// Mock localStorage
if (typeof globalThis.localStorage === 'undefined') {
	class LocalStorageMock {
		private store: Map<string, string> = new Map();

		getItem(key: string): string | null {
			return this.store.get(key) ?? null;
		}

		setItem(key: string, value: string): void {
			this.store.set(key, value);
		}

		removeItem(key: string): void {
			this.store.delete(key);
		}

		clear(): void {
			this.store.clear();
		}

		get length(): number {
			return this.store.size;
		}

		key(index: number): string | null {
			return Array.from(this.store.keys())[index] ?? null;
		}
	}

	(globalThis as any).localStorage = new LocalStorageMock();
}
