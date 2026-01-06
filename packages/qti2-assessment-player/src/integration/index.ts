/**
 * QTI 2.2 Assessment Player - Backend Integration
 *
 * ## Default Behavior: Client-Side Only
 *
 * By default, the assessment player runs entirely client-side:
 * - No backend required for demos, development, testing
 * - Uses ReferenceBackendAdapter with localStorage
 * - Scoring performed in-browser using the QTI Player
 *
 * @example
 * ```typescript
 * import { AssessmentPlayer } from '@pie-qti/qti2-assessment-player';
 *
 * // Client-only mode (default) - no backend needed
 * const player = new AssessmentPlayer({
 *   assessment: myAssessment,
 *   role: 'candidate'
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
 * import { AssessmentPlayer } from '@pie-qti/qti2-assessment-player';
 * import { MyBackendAdapter } from './adapters/MyBackendAdapter';
 *
 * // Production mode with backend
 * const player = new AssessmentPlayer({
 *   backend: new MyBackendAdapter('https://api.example.com', authToken),
 *   assessmentId: 'test-001',
 *   candidateId: 'student-123'
 * });
 * ```
 *
 * See BACKEND-INTEGRATION.md for complete implementation guide.
 */

// Export API contract (TypeScript interfaces)
export type {
	BackendAdapter,
	FeedbackItem,
	FinalizeAssessmentRequest,
	FinalizeAssessmentResponse,
	InitSessionRequest,
	InitSessionResponse,
	ResponseValue,
	RubricBlock,
	SaveStateRequest,
	SaveStateResponse,
	ScoringResult,
	SecureAssessment,
	SecureItemRef,
	SecureSection,
	SecureTestPart,
	SessionId,
	SessionState,
	SubmitResponsesRequest,
	SubmitResponsesResponse,
} from './api-contract.js';

// Export reference implementation (for development/demos)
export { ReferenceBackendAdapter } from './ReferenceBackendAdapter.js';
