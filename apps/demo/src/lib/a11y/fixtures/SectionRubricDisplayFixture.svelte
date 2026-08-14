<script lang="ts">
	import type { QtiSharedHtmlBlock } from '@pie-qti/section-player';
	import { RubricDisplay } from '@pie-qti/section-player/components';

	const passages: QtiSharedHtmlBlock[] = [
		{
			identifier: 'p1',
			kind: 'passage',
			scope: 'section',
			view: ['candidate'],
			rawHtml: '<p><strong>Reading passage</strong>: This is a sample passage.</p>',
		},
	];

	const rubricBlocks: QtiSharedHtmlBlock[] = [
		{
			identifier: 'i1',
			kind: 'instructions',
			scope: 'section',
			view: ['candidate'],
			rawHtml: '<p>Please answer all questions.</p>',
		},
		{
			identifier: 'r1',
			kind: 'rubric',
			scope: 'section',
			view: ['candidate'],
			rawHtml: '<p>Rubric: Do your best.</p>',
		},
	];
</script>

<div class="space-y-3">
	<p class="text-sm text-base-content/70">Fixture for rubric block rendering and collapse controls.</p>

	<RubricDisplay {passages} {rubricBlocks} />
</div>
