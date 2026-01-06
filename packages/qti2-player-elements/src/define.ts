import { defineQti22AssessmentPlayerElement } from './elements/Qti22AssessmentPlayerElement.js';
import { defineQti22ItemPlayerElement } from './elements/Qti22ItemPlayerElement.js';

export function defineQti22PlayerElements() {
	defineQti22ItemPlayerElement();
	defineQti22AssessmentPlayerElement();
}


