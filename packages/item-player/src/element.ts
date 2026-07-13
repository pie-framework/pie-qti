/**
 * Side-effect entry that registers <pie-qti-item-player>.
 *
 * Import `@pie-qti/item-player/element-class` for the registration-free class.
 */

import { PieQtiItemPlayerElement } from './element-class.js';

const TAG = 'pie-qti-item-player';

if (globalThis.customElements && !customElements.get(TAG)) {
	customElements.define(TAG, PieQtiItemPlayerElement);
}

export * from './element-class.js';
