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
	| 'assessment-navigation-bar'
	| 'assessment-section-menu'
	| 'assessment-rubric-display'
	| 'assessment-shell';

export interface A11yFixture {
	id: A11yFixtureId;
	title: string;
}

export const A11Y_FIXTURES: A11yFixture[] = [
	{ id: 'sortable-list', title: 'SortableList (item-player)' },
	{ id: 'match-drag-drop', title: 'MatchDragDrop (item-player)' },
	{ id: 'graphic-gap-match', title: 'GraphicGapMatch (item-player)' },
	{ id: 'inline-interaction-renderer', title: 'InlineInteractionRenderer (item-player)' },
	{ id: 'file-upload', title: 'FileUpload (item-player)' },
	{ id: 'drawing-canvas', title: 'DrawingCanvas (item-player)' },
	{ id: 'custom-interaction-fallback', title: 'CustomInteractionFallback (item-player)' },
	{ id: 'choice-interaction', title: 'ChoiceInteraction (item-player)' },
	{ id: 'slider-interaction', title: 'SliderInteraction (item-player)' },
	{ id: 'hotspot-interaction', title: 'HotspotInteraction (item-player)' },
	{ id: 'hottext-interaction', title: 'HottextInteraction (item-player)' },
	{ id: 'extended-text-interaction', title: 'ExtendedTextInteraction (item-player)' },
	{ id: 'assessment-navigation-bar', title: 'NavigationBar (assessment-player)' },
	{ id: 'assessment-section-menu', title: 'SectionMenu (assessment-player)' },
	{ id: 'assessment-rubric-display', title: 'RubricDisplay (assessment-player)' },
	{ id: 'assessment-shell', title: 'AssessmentShell (assessment-player)' },
];


