<script lang="ts">
	import { resolveQtiSectionComposition, type QtiSectionDisplaySettingsEvent } from '@pie-qti/section-player';
	import { SectionPlayerVertical } from '@pie-qti/section-player/components';

	// Clean-room fixture: one section with a shared passage and an item whose companion
	// materials list a ruler and a protractor, delivered with a PNP colour scheme. It covers
	// the section's PNP surface (the passage takes the scheme), the candidate's display
	// settings tool, and the measurement tools the companion materials grant.
	const itemXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="q-angles" title="Measuring angles" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>B</value></correctResponse>
  </responseDeclaration>
  <companionMaterialsInfo>
    <rule><description>A ruler</description><minimumLength>15</minimumLength><minorIncrement>0.1</minorIncrement></rule>
    <protractor><description>A protractor</description></protractor>
  </companionMaterialsInfo>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
      <prompt>The passage describes a corner of a square. Which kind of angle is it?</prompt>
      <simpleChoice identifier="A">An acute angle</simpleChoice>
      <simpleChoice identifier="B">A right angle</simpleChoice>
      <simpleChoice identifier="C">An obtuse angle</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;

	const composition = resolveQtiSectionComposition({
		assessmentId: 'section-pnp-display-a11y',
		pnp: { display: { colorScheme: 'yellowblue' } },
		section: {
			identifier: 'section-pnp-display',
			// Offered off, at section scope: the active item's companion materials turn it
			// on, and it renders on that item's tool bar.
			tools: [{ toolId: 'protractor', enabled: false, scope: 'section' }],
			itemRefs: [
				{
					identifier: 'q-angles',
					title: 'Measuring angles',
					itemXml,
					// Offered off: the item's companion materials turn it on.
					tools: [{ toolId: 'ruler', enabled: false, scope: 'item' }],
				},
			],
			sharedContext: {
				passages: [
					{
						identifier: 'p-square',
						kind: 'passage',
						scope: 'section',
						view: ['candidate'],
						title: 'Corners of a square',
						rawHtml:
							'<p>A square has four equal sides. Where two sides meet they form a corner, and every corner of a square is the same size.</p>',
					},
				],
				stimuli: [],
				rubricBlocks: [],
				testFeedback: [],
				stylesheets: [],
				catalogSources: [],
				assetDiagnostics: [],
			},
		},
	});

	let lastEvent = $state<QtiSectionDisplaySettingsEvent | null>(null);
</script>

<div class="space-y-3">
	<p class="text-sm text-base-content/70" data-testid="section-pnp-host-text">
		Fixture for the section's PNP surface and the candidate's display settings tool.
	</p>

	<SectionPlayerVertical {composition} onDisplaySettingsChange={(event) => (lastEvent = event)} />

	{#if lastEvent}
		<pre data-testid="section-display-settings-event" hidden>{JSON.stringify(lastEvent)}</pre>
	{/if}
</div>
