import { defineQtiAssessmentPlayerElement } from './elements/QtiAssessmentPlayerElement.js';
import { defineQtiItemPlayerElement } from './elements/QtiItemPlayerElement.js';

export function defineQtiPlayerElements() {
	defineQtiItemPlayerElement();
	defineQtiAssessmentPlayerElement();
}


