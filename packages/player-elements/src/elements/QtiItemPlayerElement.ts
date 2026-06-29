import { QTI_ITEM_PLAYER_TAG } from '../constants.js';
import '@pie-qti/item-player/element';
export { PieQtiItemPlayerElement as QtiItemPlayerElement } from '@pie-qti/item-player/element';

export type QtiItemPlayerResponseChangeDetail = {
	responseId: string;
	value: unknown;
	responses: Record<string, unknown>;
};

export function defineQtiItemPlayerElement() {
	if (!customElements.get(QTI_ITEM_PLAYER_TAG)) {
		throw new Error('@pie-qti/item-player/element did not register <pie-qti-item-player>.');
	}
}


