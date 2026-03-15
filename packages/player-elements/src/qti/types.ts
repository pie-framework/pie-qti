import type { AssessmentRubricBlock } from '@pie-qti/assessment-player';

export interface ParsedAssessmentItemRef {
	identifier: string;
	title?: string;
	href?: string;
	required?: boolean;
	itemXml?: string;
}

export interface ParsedAssessmentSection {
	identifier: string;
	title?: string;
	visible?: boolean;
	rubricBlocks?: AssessmentRubricBlock[];
	assessmentItemRefs?: ParsedAssessmentItemRef[];
	sections?: ParsedAssessmentSection[];
}

export interface ParsedTestPart {
	identifier: string;
	navigationMode: 'linear' | 'nonlinear';
	submissionMode: 'individual' | 'simultaneous';
	sections: ParsedAssessmentSection[];
}

export interface ParsedAssessmentTest {
	identifier?: string;
	title?: string;
	testParts: ParsedTestPart[];
}


