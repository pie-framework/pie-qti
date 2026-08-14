import {
	QTI_ITEM_PLAYER_TAG,
	QtiItemPlayerElement,
	type QtiAssessmentBackend,
	type QtiAssessmentItemDefinitionPlugin,
	type QtiAssessmentSessionState,
	type QtiHtmlContent,
	type QtiScoringResult,
	type QtiSharedHtmlBlock,
	type QtiSharedStimulus,
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
item.session = {} as import('@pie-qti/item-player').ItemSession;
declare const definitionPlugin: import('@pie-qti/item-player').AssessmentItemDefinitionPlugin;
const publicDefinitionPlugin: QtiAssessmentItemDefinitionPlugin = definitionPlugin;
item.plugins = [publicDefinitionPlugin];
item.addEventListener('response-change', (event) => void event.detail.responses);

const assessment = new QtiAssessmentPlayerElement();
assessment.backend = backend;
assessment.config = { plugins: [publicDefinitionPlugin] };
assessment.initSession = { assessmentId: 'assessment-1', candidateId: 'candidate-1' };
assessment.restoreState(state);

const section = new QtiSectionPlayerVerticalElement();
section.addEventListener('qti-section-response-delta', (event) => void event.detail.value);

declare const finalizedHtml: import('@pie-qti/item-player').HtmlContent;
const publicHtml: QtiHtmlContent = finalizedHtml;
const scoringWithTrustedFeedback: QtiScoringResult = {
	score: 0,
	maxScore: 1,
	completed: false,
	outcomeValues: {},
	modalFeedback: [
		{
			identifier: 'feedback-1',
			outcomeIdentifier: 'FEEDBACK',
			showHide: 'show',
			content: publicHtml,
		},
	],
};

declare const sectionBlock: import('@pie-qti/section-player').QtiSharedHtmlBlock;
declare const sectionStimulus: import('@pie-qti/section-player').QtiSharedStimulus;
const facadeBlock: QtiSharedHtmlBlock = sectionBlock;
const facadeStimulus: QtiSharedStimulus = sectionStimulus;
const sectionBlockRoundTrip: import('@pie-qti/section-player').QtiSharedHtmlBlock = facadeBlock;
const sectionStimulusRoundTrip: import('@pie-qti/section-player').QtiSharedStimulus = facadeStimulus;

const tagName: 'pie-qti-item-player' = QTI_ITEM_PLAYER_TAG;
const parsed = parseAssessmentTestXml(
	'<assessmentTest identifier="assessment-1"><testPart identifier="part-1" navigationMode="linear" submissionMode="individual" /></assessmentTest>',
);

void tagName;
void parsed;
void scoringWithTrustedFeedback;
void sectionBlockRoundTrip;
void sectionStimulusRoundTrip;
void document.createElement('pie-qti-assessment-player').backend;
