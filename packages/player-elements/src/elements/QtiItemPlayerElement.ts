import { QTI_ITEM_PLAYER_TAG } from '../constants.js';
import { PieQtiItemPlayerElement } from '@pie-qti/item-player/element-class';

export { PieQtiItemPlayerElement as QtiItemPlayerElement } from '@pie-qti/item-player/element-class';
export type {
	PieQtiItemPlayerCompleteDetail as QtiItemPlayerCompleteDetail,
	PieQtiItemPlayerEventMap as QtiItemPlayerEventMap,
	PieQtiItemPlayerResponseChangeDetail as QtiItemPlayerResponseChangeDetail,
	PieQtiItemPlayerResponseMap as QtiItemPlayerResponseMap,
	PieQtiItemPlayerSubmissionResult as QtiItemPlayerSubmissionResult,
	PieQtiItemPlayerSubmitDetail as QtiItemPlayerSubmitDetail,
} from '@pie-qti/item-player/element-class';

export function defineQtiItemPlayerElement() {
	if (!customElements.get(QTI_ITEM_PLAYER_TAG)) {
		customElements.define(QTI_ITEM_PLAYER_TAG, PieQtiItemPlayerElement);
	}
}

