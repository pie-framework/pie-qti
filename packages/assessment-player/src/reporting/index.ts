export {
	ASSESSMENT_RESULT_NAMESPACES,
	AssessmentResultSerializationError,
	type SerializeAssessmentResultOptions,
	serializeAssessmentResult,
} from './serializeAssessmentResult.js';
export {
	type AssessmentResultsData,
	type AssessmentResultXmlOptions,
	buildAssessmentResultReport,
	toAssessmentResultXml,
} from './toAssessmentResultXml.js';
export type {
	AssessmentItemResult,
	AssessmentResultContext,
	AssessmentResultReport,
	AssessmentResultVersion,
	AssessmentTestResult,
	ResultBaseType,
	ResultCardinality,
	ResultContextVariable,
	ResultDatestamp,
	ResultOutcomeVariable,
	ResultResponseVariable,
	ResultSessionIdentifier,
	ResultSessionStatus,
	ResultTemplateVariable,
	ResultVariable,
} from './types.js';
