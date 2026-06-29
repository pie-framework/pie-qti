import { describe, expect, test } from 'bun:test';
import { resolveQtiSectionComposition, type QtiSectionModel } from '../../src/index.js';

const emptySharedContext: NonNullable<QtiSectionModel['sharedContext']> = {
	passages: [],
	stimuli: [],
	rubricBlocks: [],
	testFeedback: [],
	stylesheets: [],
	catalogSources: [],
	assetDiagnostics: [],
};

const section: QtiSectionModel = {
	identifier: 'section-1',
	title: 'Reading section',
	itemRefs: [
		{
			identifier: 'item-1',
			itemXml: '<assessmentItem identifier="item-1" />',
			responses: { RESPONSE: 'A' },
		},
		{
			identifier: 'item-2',
			itemXml: '<assessmentItem identifier="item-2" />',
		},
	],
	sharedContext: {
		...emptySharedContext,
		passages: [
			{
				identifier: 'passage-1',
				kind: 'passage',
				scope: 'section',
				rawHtml: '<p>Passage</p>',
				view: ['candidate'],
			},
		],
	},
};

describe('resolveQtiSectionComposition', () => {
	test('selects active item by identifier and split-pane layout when passages exist', () => {
		const composition = resolveQtiSectionComposition({
			section,
			activeItemIdentifier: 'item-2',
			canPrevious: true,
			canNext: false,
			responsesByItemIdentifier: {
				'item-1': { RESPONSE: 'A' },
				'item-2': {},
			},
		});

		expect(composition.activeItem.identifier).toBe('item-2');
		expect(composition.activeItemIndex).toBe(1);
		expect(composition.layout).toBe('split-pane');
		expect(composition.snapshot.activeItemIdentifier).toBe('item-2');
		expect(composition.snapshot.responses['item-1']?.RESPONSE).toBe('A');
	});

	test('uses vertical layout when no passages or split-pane stimuli exist', () => {
		const composition = resolveQtiSectionComposition({
			section: {
				...section,
				sharedContext: emptySharedContext,
			},
			activeItemIndex: 0,
		});

		expect(composition.layout).toBe('vertical');
	});

	test('adds an error diagnostic and falls back to first item for an unknown active item', () => {
		const composition = resolveQtiSectionComposition({
			section,
			activeItemIdentifier: 'missing-item',
		});

		expect(composition.activeItem.identifier).toBe('item-1');
		expect(composition.diagnostics.some((d) => d.code === 'active-item-not-found')).toBe(true);
	});

	test('filters scorer-only shared blocks before returning a candidate composition', () => {
		const composition = resolveQtiSectionComposition({
			section: {
				...section,
				role: 'candidate',
				sharedContext: {
					...emptySharedContext,
					passages: [
						{
							identifier: 'candidate-passage',
							kind: 'passage',
							scope: 'section',
							rawHtml: '<p>Candidate passage</p>',
							view: ['candidate'],
						},
						{
							identifier: 'scorer-passage',
							kind: 'passage',
							scope: 'section',
							rawHtml: '<p>Scorer passage</p>',
							view: ['scorer'],
						},
					],
					rubricBlocks: [
						{
							identifier: 'scorer-rubric',
							kind: 'rubric',
							scope: 'section',
							rawHtml: '<p>Scorer rubric</p>',
							view: ['scorer'],
						},
					],
					testFeedback: [
						{
							identifier: 'candidate-feedback',
							kind: 'test-feedback',
							scope: 'section',
							rawHtml: '<p>Candidate feedback</p>',
							view: ['candidate'],
						},
					],
				},
			},
			activeItemIndex: 0,
		});

		expect(composition.sharedContext.passages.map((block) => block.identifier)).toEqual(['candidate-passage']);
		expect(composition.sharedContext.rubricBlocks).toEqual([]);
		expect(composition.sharedContext.testFeedback.map((block) => block.identifier)).toEqual(['candidate-feedback']);
		expect(composition.section.sharedContext?.passages.map((block) => block.identifier)).toEqual(['candidate-passage']);
		expect(composition.section.sharedContext?.rubricBlocks).toEqual([]);
		expect(composition.section.sharedContext?.testFeedback.map((block) => block.identifier)).toEqual(['candidate-feedback']);
	});

	test('preserves item and passage tool config in resolved composition', () => {
		const composition = resolveQtiSectionComposition({
			section: {
				...section,
				tools: [{ toolId: 'section-notes', label: 'Section Notes' }],
				itemRefs: [
					{
						identifier: 'item-1',
						itemXml: '<assessmentItem identifier="item-1" />',
						tools: [
							{ toolId: 'textToSpeech', label: 'Read question' },
							{ toolId: 'calculator', label: 'Calculator', renderParams: { calculatorType: 'scientific' } },
						],
					},
				],
				sharedContext: {
					...emptySharedContext,
					passages: [
						{
							identifier: 'passage-1',
							kind: 'passage',
							scope: 'section',
							rawHtml: '<p>Passage</p>',
							tools: [{ toolId: 'textToSpeech', label: 'Read passage' }],
						},
					],
				},
			},
		});

		expect(composition.section.tools?.map((tool) => tool.toolId)).toEqual(['section-notes']);
		expect(composition.activeItem.tools?.map((tool) => tool.toolId)).toEqual(['textToSpeech', 'calculator']);
		expect(composition.sharedContext.passages[0]?.tools?.map((tool) => tool.toolId)).toEqual(['textToSpeech']);
	});

	test('filters role-scoped tools from sections, passages, and items', () => {
		const composition = resolveQtiSectionComposition({
			section: {
				...section,
				role: 'candidate',
				tools: [
					{ toolId: 'candidate-section-tool', view: ['candidate'] },
					{ toolId: 'scorer-section-tool', view: ['scorer'] },
				],
				itemRefs: [
					{
						identifier: 'item-1',
						itemXml: '<assessmentItem identifier="item-1" />',
						tools: [
							{ toolId: 'textToSpeech', view: ['candidate'] },
							{ toolId: 'scorer-notes', view: ['scorer'] },
						],
					},
				],
				sharedContext: {
					...emptySharedContext,
					passages: [
						{
							identifier: 'passage-1',
							kind: 'passage',
							scope: 'section',
							rawHtml: '<p>Passage</p>',
							tools: [
								{ toolId: 'textToSpeech', view: ['candidate'] },
								{ toolId: 'scorer-passage-notes', view: ['scorer'] },
							],
						},
					],
				},
			},
		});

		expect(composition.section.tools?.map((tool) => tool.toolId)).toEqual(['candidate-section-tool']);
		expect(composition.activeItem.tools?.map((tool) => tool.toolId)).toEqual(['textToSpeech']);
		expect(composition.sharedContext.passages[0]?.tools?.map((tool) => tool.toolId)).toEqual(['textToSpeech']);
	});

	test('emits diagnostics for shared asset URLs blocked by host policy', () => {
		const composition = resolveQtiSectionComposition({
			section: {
				...section,
				sharedContext: {
					...emptySharedContext,
					stylesheets: [{ href: 'javascript:alert(1)' }],
				},
			},
			activeItemIndex: 0,
			host: {
				sanitizeAssetUrl: () => null,
			},
		});

		expect(composition.diagnostics.some((diagnostic) => diagnostic.code === 'shared-asset-url-blocked')).toBe(true);
	});

	test('blocks unsafe shared asset URLs with the baseline security policy even without a host hook', () => {
		const composition = resolveQtiSectionComposition({
			section: {
				...section,
				sharedContext: {
					...emptySharedContext,
					stylesheets: [{ href: 'http://example.test/unsafe.css' }],
				},
			},
			activeItemIndex: 0,
		});

		expect(composition.diagnostics.some((diagnostic) => diagnostic.code === 'shared-asset-url-blocked')).toBe(true);
	});

	test('keeps package-relative stylesheet hrefs separate from sanitized browser URLs', () => {
		const composition = resolveQtiSectionComposition({
			section: {
				...section,
				sharedContext: {
					...emptySharedContext,
					stylesheets: [{ href: 'styles/section.css' }],
				},
			},
			activeItemIndex: 0,
			host: {
				resolvePackageUrl: (href) => `https://assets.example.test/pkg/${href}`,
				sanitizeAssetUrl: (href) => href,
			},
		});

		expect(composition.sharedContext.stylesheets[0]).toMatchObject({
			href: 'styles/section.css',
			resolvedHref: 'styles/section.css',
			renderHref: 'https://assets.example.test/pkg/styles/section.css',
			browserHref: 'https://assets.example.test/pkg/styles/section.css',
		});
	});

	test('blocks unsafe shared stylesheet URLs returned by the host asset hook', () => {
		const composition = resolveQtiSectionComposition({
			section: {
				...section,
				sharedContext: {
					...emptySharedContext,
					stylesheets: [{ href: 'styles/section.css' }],
				},
			},
			activeItemIndex: 0,
			host: {
				resolvePackageUrl: (href) => `https://assets.example.test/pkg/${href}`,
				sanitizeAssetUrl: () => 'javascript:alert(1)',
			},
		});

		expect(composition.sharedContext.stylesheets[0]?.renderHref).toBeUndefined();
		expect(composition.diagnostics.some((diagnostic) => diagnostic.code === 'shared-asset-url-blocked')).toBe(true);
	});
});
