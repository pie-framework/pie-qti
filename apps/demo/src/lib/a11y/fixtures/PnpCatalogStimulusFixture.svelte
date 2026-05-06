<script lang="ts">
	// @ts-expect-error - Svelte-check can't resolve workspace subpath exports, but runtime works correctly
	import { ItemBody } from '@pie-qti/item-player/components';
	import { Player, type PnpProfile } from '@pie-qti/item-player';
	import type { InteractionResponseValue } from '@pie-qti/item-player/web-components';
	import type { ResolvedItemDeliveryContext } from '@pie-qti/ims-cp-core';
	import { registerDefaultComponents } from '@pie-qti/default-components';
	import { onMount } from 'svelte';

	type FixtureResponseValue = InteractionResponseValue | null;

	// Clean-room QTI 3 fixture authored for Stage 5 public accessibility evidence.
	// It exercises shared stimulus, scoped catalog lookup, PNP rebinding, and
	// answer-key non-disclosure without using official/private conformance assets.
	const qtiXml = `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
		identifier="pnp-catalog-stimulus-a11y" title="PNP Catalog Stimulus A11y Fixture"
		adaptive="false" time-dependent="false">
		<qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string">
			<qti-correct-response>
				<qti-value>braided delta</qti-value>
			</qti-correct-response>
		</qti-response-declaration>
		<qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
		<qti-assessment-stimulus-ref identifier="passage_1" href="../stimuli/river.xml" title="River passage"/>
		<qti-item-body>
			<p class="item-note" data-catalog-idref="item_term">Use the shared passage to answer the question.</p>
			<p>
				Name the river feature:
				<qti-text-entry-interaction response-identifier="RESPONSE" expected-length="16"/>
			</p>
		</qti-item-body>
		<qti-catalog-info>
			<qti-card identifier="item_term">
				<qti-card-entry usage="glossary-on-screen">
					<qti-html-content>Question instructions.</qti-html-content>
				</qti-card-entry>
			</qti-card>
			<qti-card identifier="term_delta">
				<qti-card-entry usage="glossary-on-screen">
					<qti-html-content>Item-local fallback definition.</qti-html-content>
				</qti-card-entry>
			</qti-card>
		</qti-catalog-info>
	</qti-assessment-item>`;

	const deliveryContext: ResolvedItemDeliveryContext = {
		itemHref: 'items/item.xml',
		stimuli: {
			passage_1: {
				identifier: 'passage_1',
				href: '../stimuli/river.xml',
				resolvedHref: 'stimuli/river.xml',
				title: 'River passage',
				bodyHtml: `<section aria-label="Shared river passage">
					<p>
						A <span class="stimulus-term" data-catalog-idref="term_delta">delta</span>
						forms where a river drops sediment.
					</p>
				</section>`,
				stylesheets: [],
				validationMessages: [],
			},
		},
		stylesheets: [
			{
				href: 'item.css',
				xml: '<qti-stylesheet href="item.css"/>',
				resolvedHref: 'items/item.css',
				source: 'item',
				cssText: '.item-note { border-left: 4px solid currentColor; padding-left: 0.5rem; }',
			},
			{
				href: 'stimulus.css',
				xml: '<qti-stylesheet href="stimulus.css"/>',
				resolvedHref: 'stimuli/stimulus.css',
				source: 'stimulus',
				stimulusIdentifier: 'passage_1',
				cssText: '.stimulus-term { text-decoration: underline; }',
			},
		],
		catalogSources: [
			{
				scope: 'stimulus',
				baseHref: 'stimuli/river.xml',
				stimulusIdentifier: 'passage_1',
				xml: `<qti-catalog-info>
					<qti-card identifier="term_delta">
						<qti-card-entry usage="glossary-on-screen">
							<qti-html-content>Stimulus-scoped delta definition.</qti-html-content>
						</qti-card-entry>
						<qti-card-entry usage="tts-pronunciation" xml:lang="en">
							<qti-html-content>DEL-tuh</qti-html-content>
						</qti-card-entry>
					</qti-card>
				</qti-catalog-info>`,
			},
		],
		validationMessages: [],
	};

	const initialPnp: PnpProfile = {
		content: {
			glossaryOnScreen: true,
			catalogSupports: { ttsPronunciation: { active: true, languageCode: 'en' } },
		},
	};

	let player = $state<Player | null>(null);
	let responses = $state<Record<string, FixtureResponseValue>>({ RESPONSE: null });
	let glossaryEnabled = $state(true);
	let lastCatalogEvent = $state<string>('none');
	let mounted = $state(false);
	let fixtureRoot: HTMLDivElement | null = $state(null);

	onMount(() => {
		const newPlayer = new Player({
			itemXml: qtiXml,
			role: 'candidate',
			pnp: initialPnp,
			deliveryContext,
		});
		registerDefaultComponents(newPlayer.getComponentRegistry());
		player = newPlayer;
		mounted = true;
	});

	function toggleGlossary() {
		glossaryEnabled = !glossaryEnabled;
		player?.updatePnp({ content: { glossaryOnScreen: glossaryEnabled } });
	}

	$effect(() => {
		if (!fixtureRoot) return;
		const handler = (event: Event) => handleCatalogLookup(event as CustomEvent);
		const el = fixtureRoot;
		el.addEventListener('qti-catalog-lookup', handler);
		return () => el.removeEventListener('qti-catalog-lookup', handler);
	});

	function handleCatalogLookup(event: CustomEvent) {
		const detail = event.detail ?? {};
		lastCatalogEvent = `${detail.usage ?? 'unknown'}:${detail.html ?? ''}`;
	}
</script>

<div bind:this={fixtureRoot} class="space-y-4">
	<p class="text-sm text-base-content/70">
		Fixture for shared stimulus rendering, dynamic PNP catalog supports, keyboard focus behavior,
		host catalog events, and scoped stylesheet isolation.
	</p>

	<div class="flex flex-wrap gap-2">
		<button type="button" class="btn btn-sm" onclick={toggleGlossary}>
			{glossaryEnabled ? 'Disable glossary support' : 'Enable glossary support'}
		</button>
		<div role="status" aria-live="polite" data-testid="catalog-event-status">
			Last catalog event: {lastCatalogEvent}
		</div>
	</div>

	{#if mounted && player}
		<div class="qti-item-player">
			<ItemBody
				{player}
				{responses}
				disabled={false}
				onResponseChange={(id: string, value: FixtureResponseValue) => (responses = { ...responses, [id]: value })}
			/>
		</div>
	{/if}
</div>
