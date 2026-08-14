/**
 * QTI 2.2 Assessment Player - Backend Integration
 *
 * ## Reference/demo behavior
 *
 * AssessmentPlayer always requires an explicit BackendAdapter. Demos can opt in
 * to ReferenceBackendAdapter, which stores and scores client-side.
 *
 * @example
 * ```typescript
 * import { AssessmentPlayer } from '@pie-qti/assessment-player';
 * import { ReferenceBackendAdapter } from '@pie-qti/assessment-player/integration';
 *
 * const backend = new ReferenceBackendAdapter();
 * backend.registerAssessment('preview', secureAssessment);
 * const player = await AssessmentPlayer.create({
 *   backend,
 *   initSession: { assessmentId: 'preview', candidateId: 'local' }
 * });
 * ```
 *
 * ## Production: Backend Integration
 *
 * For production deployments, implement BackendAdapter for:
 * - Server-side scoring (secure)
 * - Persistent session storage
 * - Authentication/authorization
 * - Sensitive data protection
 *
 * @example
 * ```typescript
 * import { AssessmentPlayer } from '@pie-qti/assessment-player';
 * import { MyBackendAdapter } from './adapters/MyBackendAdapter';
 *
 * // Production mode with backend
 * const player = await AssessmentPlayer.create({
 *   backend: new MyBackendAdapter('https://api.example.com', authToken),
 *   initSession: { assessmentId: 'test-001', candidateId: 'student-123' }
 * });
 * ```
 *
 * See BACKEND-INTEGRATION.md for complete implementation guide.
 */

// Export API contract (TypeScript interfaces)
export type {
	BackendAdapter,
	FeedbackItem,
	AssessmentSessionState,
	AssessmentScoringResult,
	AssessmentRubricBlock,
	FinalizeAssessmentRequest,
	FinalizeAssessmentResponse,
	InitSessionRequest,
	InitSessionResponse,
	ResponseValue,
	SaveAssessmentStateRequest,
	SaveAssessmentStateResponse,
	SecureAssessment,
	SecureItemRef,
	SecureSection,
	SecureTestPart,
	SecureTimeLimits,
	SessionId,
	SubmitTimingEvidence,
	SubmitResponsesRequest,
	SubmitResponsesResponse,
} from './api-contract.js';

// Export reference implementation (for development/demos)
export { ReferenceBackendAdapter } from './ReferenceBackendAdapter.js';
export {
	getAssessmentItemIdentifier,
	scoreAssessmentItem,
	type AssessmentItemScoringInput,
} from './assessment-item-scorer.js';
export { toSectionComposition } from './toSectionComposition.js';
