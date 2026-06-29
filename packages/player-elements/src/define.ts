import { defineQtiAssessmentPlayerElement } from './elements/QtiAssessmentPlayerElement.js';
import { defineQtiItemPlayerElement } from './elements/QtiItemPlayerElement.js';
import { defineQtiSectionPlayerSplitPaneElement } from './elements/QtiSectionPlayerSplitPaneElement.js';
import { defineQtiSectionPlayerVerticalElement } from './elements/QtiSectionPlayerVerticalElement.js';

export function defineQtiPlayerElements() {
	defineQtiItemPlayerElement();
	defineQtiAssessmentPlayerElement();
	defineQtiSectionPlayerSplitPaneElement();
	defineQtiSectionPlayerVerticalElement();
}


