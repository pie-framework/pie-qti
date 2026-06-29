import SectionPlayerVertical from '../../../section-player/src/components/SectionPlayerVertical.svelte';
import { QTI_SECTION_PLAYER_VERTICAL_TAG } from '../constants.js';
import { QtiSectionPlayerElementBase } from './QtiSectionPlayerSplitPaneElement.js';

export class QtiSectionPlayerVerticalElement extends QtiSectionPlayerElementBase {
	protected Component: any = SectionPlayerVertical;
}

export function defineQtiSectionPlayerVerticalElement() {
	if (!customElements.get(QTI_SECTION_PLAYER_VERTICAL_TAG)) {
		customElements.define(QTI_SECTION_PLAYER_VERTICAL_TAG, QtiSectionPlayerVerticalElement);
	}
}
