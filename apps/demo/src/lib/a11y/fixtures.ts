export type A11yFixtureId =
	| 'sortable-list'
	| 'match-drag-drop'
	| 'graphic-gap-match'
	| 'inline-interaction-renderer'
	| 'file-upload'
	| 'drawing-canvas'
	| 'custom-interaction-fallback'
	| 'choice-interaction'
	| 'slider-interaction'
	| 'hotspot-interaction'
	| 'hottext-interaction'
	| 'extended-text-interaction'
	| 'associate-interaction'
	| 'media-interaction'
	| 'modal-feedback'
	| 'assessment-navigation-bar'
	| 'assessment-section-menu'
	| 'assessment-rubric-display'
	| 'assessment-timer'
	| 'assessment-shell'
	| 'pnp-catalog-stimulus';

export interface A11yFixture {
	id: A11yFixtureId;
	title: string;
}

export const A11Y_FIXTURES: A11yFixture[] = [
	{ id: 'sortable-list', title: 'SortableList component fixture' },
	{ id: 'match-drag-drop', title: 'MatchDragDrop component fixture' },
	{ id: 'graphic-gap-match', title: 'GraphicGapMatch component fixture' },
	{ id: 'inline-interaction-renderer', title: 'Inline interactions through ItemBody' },
	{ id: 'file-upload', title: 'FileUpload component fixture' },
	{ id: 'drawing-canvas', title: 'DrawingCanvas component fixture' },
	{ id: 'custom-interaction-fallback', title: 'CustomInteractionFallback component fixture' },
	{ id: 'choice-interaction', title: 'ChoiceInteraction through ItemBody' },
	{ id: 'slider-interaction', title: 'SliderInteraction through ItemBody' },
	{ id: 'hotspot-interaction', title: 'HotspotInteraction through ItemBody' },
	{ id: 'hottext-interaction', title: 'HottextInteraction through ItemBody' },
	{ id: 'extended-text-interaction', title: 'ExtendedTextInteraction through ItemBody' },
	{ id: 'associate-interaction', title: 'AssociateInteraction through ItemBody' },
	{ id: 'media-interaction', title: 'MediaInteraction through ItemBody' },
	{ id: 'modal-feedback', title: 'ModalFeedbackDisplay component fixture' },
	{ id: 'assessment-navigation-bar', title: 'NavigationBar (assessment-player)' },
	{ id: 'assessment-section-menu', title: 'SectionMenu (assessment-player)' },
	{ id: 'assessment-rubric-display', title: 'RubricDisplay (assessment-player)' },
	{ id: 'assessment-timer', title: 'AssessmentTimer (assessment-player)' },
	{ id: 'assessment-shell', title: 'AssessmentShell (assessment-player)' },
	{ id: 'pnp-catalog-stimulus', title: 'PNP catalog and shared stimulus runtime' },
];


