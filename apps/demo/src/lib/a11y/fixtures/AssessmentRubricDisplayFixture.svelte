<script lang="ts">
	import type { AssessmentRubricBlock } from '@pie-qti/assessment-player';
	import { RubricDisplay } from '@pie-qti/assessment-player/components';

	const blocks: AssessmentRubricBlock[] = [
		{
			identifier: 'p1',
			view: ['candidate'],
			use: 'passage',
			content: '<p><strong>Reading passage</strong>: This is a sample passage.</p>',
		},
		{
			identifier: 'i1',
			view: ['candidate'],
			use: 'instructions',
			content: '<p>Please answer all questions.</p>',
		},
		{
			identifier: 'r1',
			view: ['candidate'],
			use: 'rubric',
			content: '<p>Rubric: Do your best.</p>',
		},
	];
</script>

<div class="space-y-3">
	<p class="text-sm text-base-content/70">Fixture for rubric block rendering and collapse controls.</p>

	<RubricDisplay {blocks} />
</div>


