import type {
	QtiAssessmentLoadErrorDetail,
	QtiAssessmentResponseChangeDetail,
	QtiAssessmentSubmitDetail,
	QtiItemPlayerCompleteDetail,
	QtiItemPlayerResponseChangeDetail,
	QtiItemPlayerSubmitDetail,
	QtiSectionResponseDeltaDetail,
} from '../src/index.js';

export function assertItemCustomElementTypes(element: HTMLElementTagNameMap['pie-qti-item-player']) {
	element.pci = {
		moduleResolver: (_resolvedUrl, context) => {
			void context.authoredPath;
			return {};
		},
	};

	element.addEventListener('response-change', (event) => {
		const detail: QtiItemPlayerResponseChangeDetail = event.detail;
		void detail.responses[detail.responseId];
	});

	element.addEventListener('submit', (event) => {
		const detail: QtiItemPlayerSubmitDetail = event.detail;
		void detail.result.score;
	});

	element.addEventListener('complete', (event) => {
		const detail: QtiItemPlayerCompleteDetail = event.detail;
		void detail.result.numAttempts;
	});

	const result = element.submit();
	return result?.outcomeValues;
}

export function assertAssessmentCustomElementTypes(
	element: HTMLElementTagNameMap['pie-qti-assessment-player'],
) {
	element.pci = {
		moduleResolver: (_resolvedUrl, context) => {
			void context.responseIdentifier;
			return {};
		},
	};

	element.addEventListener('load-error', (event) => {
		const detail: QtiAssessmentLoadErrorDetail = event.detail;
		void detail.message;
	});

	element.addEventListener('response-change', (event) => {
		const detail: QtiAssessmentResponseChangeDetail = event.detail;
		void detail.responses;
	});

	element.addEventListener('submit', (event) => {
		const detail: QtiAssessmentSubmitDetail = event.detail;
		void detail.results;
	});

	element.addEventListener('ready', (event) => {
		void event.detail;
	});

	element.addEventListener('complete', (event) => {
		void event.detail;
	});
}

export function assertSectionCustomElementTypes(
	element: HTMLElementTagNameMap['pie-qti-section-player-vertical'],
) {
	element.pci = {
		moduleResolver: (_resolvedUrl, context) => {
			void context.kind;
			return {};
		},
	};

	element.addEventListener('qti-section-response-delta', (event) => {
		const detail: QtiSectionResponseDeltaDetail = event.detail;
		void detail.responseIdentifier;
	});
}
