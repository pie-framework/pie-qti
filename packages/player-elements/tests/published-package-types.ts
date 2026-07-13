import {
	QTI_ITEM_PLAYER_TAG,
	QtiItemPlayerElement,
	type QtiAssessmentBackend,
	type QtiAssessmentSessionState,
	parseAssessmentTestXml,
} from '@pie-qti/player-elements';
import {
	QtiAssessmentPlayerElement,
	QtiSectionPlayerVerticalElement,
} from '@pie-qti/player-elements/elements';
import '@pie-qti/player-elements/register-players';

const state: QtiAssessmentSessionState = {
	currentItemIdentifier: 'item-1',
	visitedItems: [],
	itemResponses: {},
	timing: {
		startedAt: Date.now(),
		itemTimes: {},
		totalTime: 0,
	},
};

const backend: QtiAssessmentBackend = {
	async initSession() {
		return {
			sessionId: 'session-1',
			assessment: {
				identifier: 'assessment-1',
				title: 'Assessment',
				navigationMode: 'linear',
				submissionMode: 'individual',
				testParts: [],
			},
		};
	},
	async submitResponses() {
		return { success: true };
	},
	async saveState() {
		return { success: true, savedAt: Date.now() };
	},
	async finalizeAssessment() {
		return {
			success: true,
			totalScore: 0,
			maxScore: 0,
			itemScores: {},
			finalizedAt: Date.now(),
		};
	},
};

const item = new QtiItemPlayerElement();
item.itemXml = '<assessmentItem />';
item.addEventListener('response-change', (event) => void event.detail.responses);

const assessment = new QtiAssessmentPlayerElement();
assessment.backend = backend;
assessment.initSession = { assessmentId: 'assessment-1', candidateId: 'candidate-1' };
assessment.restoreState(state);

const section = new QtiSectionPlayerVerticalElement();
section.addEventListener('qti-section-response-delta', (event) => void event.detail.value);

const tagName: 'pie-qti-item-player' = QTI_ITEM_PLAYER_TAG;
const parsed = parseAssessmentTestXml(
	'<assessmentTest identifier="assessment-1"><testPart identifier="part-1" navigationMode="linear" submissionMode="individual" /></assessmentTest>',
);

void tagName;
void parsed;
void document.createElement('pie-qti-assessment-player').backend;
