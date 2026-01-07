<script lang="ts">
	import { base } from '$app/paths';
	import DocLayout from '$lib/layouts/DocLayout.svelte';
</script>

<svelte:head>
	<title>Architecture - PIE-QTI</title>
</svelte:head>

<DocLayout>
	<h1>PIE QTI</h1>

	<p>
		The PIE-QTI project provides a production-grade <strong>QTI 2.x item player</strong>, a
		<strong>QTI 2.x assessment player</strong>, and <strong>transformation tools</strong>
		to translate between PIE and QTI.
	</p>

	<hr />

	<h2>Why this project exists</h2>
	<p>
		Renaissance Learning standardized on <strong>PIE</strong> for item delivery and authoring. Partners often
		need to interchange content using <strong>QTI</strong>, so PIE-QTI exists to provide both
		<strong>QTI↔PIE transformations</strong> and a modern, extensible <strong>QTI 2.x player</strong> for
		previewing, analysis, and rendering workflows.
	</p>

	<hr />

	<h2>The QTI item player</h2>
	<p>
		The player is built to keep “QTI logic” separate from “UI rendering”, so you can customize behavior without
		forking the core.
	</p>

	<figure>
		<img alt="Item player extensibility" src="{base}/images/item_player_extensibility.jpeg" loading="lazy" />
		<figcaption>Extensibility model</figcaption>
	</figure>

	<h3>Three layers</h3>
	<ul>
		<li>
			<strong>Core engine</strong>: parses QTI XML, manages state, applies roles, executes response processing.
		</li>
		<li>
			<strong>Extraction</strong>: converts QTI XML into typed <code>InteractionData</code> via priority-based
			extractors.
		</li>
		<li>
			<strong>Rendering</strong>: maps <code>InteractionData</code> to renderers via a priority-based registry
			(web-component contract; default UI implementations are provided).
		</li>
	</ul>

	<h3>How you extend it</h3>
	<ul>
		<li>
			<strong>Plugins (<code>QTIPlugin</code>)</strong>: register extractors, custom renderer selection, and
			lifecycle hooks.
		</li>
		<li>
			<strong>Registries</strong>: override/compose extraction and rendering behavior explicitly (great for
			vendor content).
		</li>
		<li>
			<strong>Custom interaction renderers</strong>: add vendor-specific interactions or override selection via
			<code>canHandle()</code> + priority.
		</li>
	</ul>

	<p>
		For an example plugin package, see
		<a href="https://github.com/pie-framework/pie-qti/tree/master/packages/acme-likert-plugin" target="_blank" rel="noreferrer">
			<code>packages/acme-likert-plugin</code>
		</a>.
	</p>

	<h3>Typesetting is host-owned</h3>
	<p>
		The player doesn’t bundle a math engine. Instead, the host supplies a <code>typeset(rootEl)</code> function
		(run after render and on DOM updates). The default adapter package is
		<a href="https://github.com/pie-framework/pie-qti/tree/master/packages/qti2-typeset-katex" target="_blank" rel="noreferrer">
			<code>packages/qti2-typeset-katex</code>
		</a>.
	</p>

	<hr />

	<h2>Links</h2>
	<ul>
		<li>
			Item player README:
			<a href="https://github.com/pie-framework/pie-qti/blob/master/packages/qti2-item-player/README.md" target="_blank" rel="noreferrer">
				<code>packages/qti2-item-player/README.md</code>
			</a>
		</li>
		<li>
			Backend integration (assessment player):
			<a href="https://github.com/pie-framework/pie-qti/blob/master/packages/qti2-assessment-player/BACKEND-INTEGRATION.md" target="_blank" rel="noreferrer">
				<code>BACKEND-INTEGRATION.md</code>
			</a>
		</li>
		<li>
			Transformation guide:
			<a href="https://github.com/pie-framework/pie-qti/blob/master/docs/PIE-QTI-TRANSFORMATION-GUIDE.md" target="_blank" rel="noreferrer">
				<code>docs/PIE-QTI-TRANSFORMATION-GUIDE.md</code>
			</a>
		</li>
	</ul>
</DocLayout>
