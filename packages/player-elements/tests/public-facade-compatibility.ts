import type { PieQtiItemPlayerElement } from '@pie-qti/item-player/element-class';
import type { QtiAssessmentPlayerElement as AssessmentImplementation } from '../src/elements/QtiAssessmentPlayerElement.js';
import type { QtiSectionPlayerSplitPaneElement as SectionImplementation } from '../src/elements/QtiSectionPlayerSplitPaneElement.js';
import type {
	QtiAssessmentPlayerElement as AssessmentContract,
	QtiItemPlayerElement as ItemContract,
	QtiSectionPlayerElement as SectionContract,
} from '../src/public/api.js';

declare const itemImplementation: PieQtiItemPlayerElement;
declare const assessmentImplementation: AssessmentImplementation;
declare const sectionImplementation: SectionImplementation;

const itemContract: ItemContract = itemImplementation;
const assessmentContract: AssessmentContract = assessmentImplementation;
const sectionContract: SectionContract = sectionImplementation;

void itemContract;
void assessmentContract;
void sectionContract;
