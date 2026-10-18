/**
 * Browser entry for the PCI runner page: binds the bridge controller to
 * `window.postMessage`, DOM script injection, and a ResizeObserver. Deploy
 * `dist/` (this page and its bundle) on a dedicated cookieless origin —
 * `https://qti.pie-framework.org` is the one the plan names — and point
 * `PciConfiguration.sandbox.runnerUrl` at it.
 */

import { createPciRunnerController, type PciRunnerTransport } from './runnerController.js';

const transport: PciRunnerTransport = {
	postToParent(message, targetOrigin) {
		window.parent.postMessage(message, targetOrigin);
	},
	onMessage(handler) {
		const listener = (event: MessageEvent) => {
			handler({
				origin: event.origin,
				data: event.data,
				// The runner accepts its first message only from its parent, which
				// is the structural fact origin locking is rooted in.
				isParentSource: event.source === window.parent,
			});
		};
		window.addEventListener('message', listener);
		return () => window.removeEventListener('message', listener);
	},
};

const mount = document.getElementById('pci-runner-mount');
if (!mount) {
	throw new Error('PCI runner page is missing its #pci-runner-mount element');
}

const controller = createPciRunnerController({
	transport,
	mount: mount as HTMLElement,
	createContainer: () => document.createElement('div'),
	fetchText: async (url) => {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`fetch of '${url}' failed with status ${response.status}`);
		}
		return response.text();
	},
	// Script-tag injection needs no CORS, so an opaque-origin frame can load
	// module code from the package origin the same way RequireJS would.
	evaluateScript: (url) =>
		new Promise<void>((resolve, reject) => {
			const script = document.createElement('script');
			script.src = url;
			script.onload = () => resolve();
			script.onerror = () => reject(new Error(`failed to load PCI module '${url}'`));
			document.head.appendChild(script);
		}),
});

const resizeObserver = new ResizeObserver((entries) => {
	for (const entry of entries) {
		controller.notifyResize(entry.contentRect.height);
	}
});
resizeObserver.observe(mount as HTMLElement);

controller.start();
