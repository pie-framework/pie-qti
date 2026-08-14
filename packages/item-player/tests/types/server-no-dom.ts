import {
	createAssessmentItemDefinition,
	type ServerAssessmentItemDefinitionConfig,
	type ServerProcessingFragmentRequest,
	type ServerSerializedItemSessionState,
} from '../../dist/server.js';

const config: ServerAssessmentItemDefinitionConfig = {
	itemXml: '<assessmentItem identifier="server-item" />',
	role: 'scorer',
	resolveProcessingFragment: (request: ServerProcessingFragmentRequest) => {
		void request.href;
		void request.mode;
		void request.scope;
		void request.depth;
		return null;
	},
};
const definition = createAssessmentItemDefinition(config);
const session = definition.openSession({ responses: { RESPONSE: 'A' } });
const saved: ServerSerializedItemSessionState = session.serialize();
void session.dispatch({ action: 'scoreAttempt' }).result?.scoring;
session.dispose();

const restored = definition.openSession({ restore: saved, activate: true });
restored.dispose();
