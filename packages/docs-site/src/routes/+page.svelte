<script lang="ts">
	import { base } from '$app/paths';
	import DocLayout from '$lib/layouts/DocLayout.svelte';
</script>

<svelte:head>
	<title>PIE-QTI</title>
</svelte:head>

<DocLayout>
	<h1>PIE-QTI</h1>

	<p>
		<img alt="QTI 2.2 compliant" src="https://img.shields.io/badge/QTI%202.2-100%25%20Compliant-success" />
		<img alt="Interactions" src="https://img.shields.io/badge/Interactions-21%2F21-success" />
		<img alt="Tests" src="https://img.shields.io/badge/Tests-1112%2B-success" />
		<img alt="Accessibility" src="https://img.shields.io/badge/Accessibility-Tested-blue" />
		<img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-Strict-blue" />
	</p>

	<p>This project provides two major capabilities:</p>

	<ol>
		<li><strong>QTI 2.x Players</strong> — Production-ready item and assessment players with extensibility and theming</li>
		<li>
			<strong>PIE ↔ QTI Transformation Framework</strong> — Bidirectional transforms between QTI 2.2 and PIE, with
			CLI, web app, and IMS Content Package support
		</li>
	</ol>

	<p>
		<!-- Use an absolute URL so docs-site prerender does not try to crawl /examples as a docs route -->
		📚
		<strong>
			<a href="https://pie-framework.github.io/pie-qti/examples/" target="_blank" rel="noreferrer">Live Examples</a>
		</strong>
	</p>

	<figure>
		<img alt="QTI player examples" src="{base}/images/examples-screenshot-1.png" loading="lazy" />
	</figure>

	<blockquote>
		<p>
			<strong>Project Status</strong>: QTI 2.x players are production-ready. Transform framework is under active
			development. See
			<a href="https://github.com/pie-framework/pie-qti/blob/master/STATUS.md" target="_blank" rel="noreferrer">STATUS.md</a>
			for details.
		</p>
	</blockquote>

	<hr />

	<h2>Why This Project Exists</h2>

	<p>
		<a href="https://pie-framework.org/" target="_blank" rel="noreferrer">PIE</a> (Portable Interactions and Elements)
		is a complete framework for playing and authoring assessment items, maintained by
		<a href="https://www.renaissance.com/" target="_blank" rel="noreferrer">Renaissance Learning</a> with implementation
		partner <a href="https://mcro.tech/" target="_blank" rel="noreferrer">MCRO</a>.
	</p>

	<p>
		Many Renaissance partners exchange content in <strong>QTI format</strong>, so bidirectional QTI ↔ PIE transformation
		is essential. This project <strong>open sources that transformation framework</strong> for partners and the broader
		community.
	</p>

	<p>
		We also built a <strong>spec-complete QTI 2.x player</strong> because a modern, open-source option was missing—and
		we needed one for previewing, analysis, and "convert then render" workflows.
	</p>

	<hr />

	<h2>Part 1: QTI 2.x Players</h2>

	<blockquote><p><strong>Status</strong>: Production-ready</p></blockquote>

	<p>Full-featured players for rendering QTI 2.x assessment content in the browser.</p>

	<h3>Item Player (<code>@pie-qti/qti2-item-player</code>)</h3>

	<p>Renders and scores individual QTI items:</p>
	<ul>
		<li><strong>21 interaction types</strong> — All QTI 2.2 interactions supported</li>
		<li><strong>45 response processing operators</strong> — Complete client-side scoring</li>
		<li><strong>Role-based rendering</strong> — Candidate, scorer, author, tutor, proctor, testConstructor</li>
		<li><strong>Adaptive items</strong> — Multi-attempt workflows with progressive feedback</li>
		<li>
			<strong>Accessible</strong> — Full keyboard navigation and screen reader support (follows WCAG 2.2 Level AA
			guidelines)
		</li>
		<li><strong>Iframe isolation mode</strong> — Optional secure rendering for untrusted content</li>
	</ul>

	<h3>Assessment Player (<code>@pie-qti/qti2-assessment-player</code>)</h3>

	<p>Orchestrates multi-item assessments:</p>
	<ul>
		<li><strong>Navigation modes</strong> — Linear (sequential) and nonlinear (free navigation)</li>
		<li><strong>Sections &amp; hierarchy</strong> — Nested sections with rubric blocks</li>
		<li><strong>Selection &amp; ordering</strong> — Random item selection and shuffling per QTI spec</li>
		<li><strong>Time limits</strong> — Countdown timers with warnings and auto-submission</li>
		<li><strong>Item session control</strong> — Max attempts, review/skip, response validation</li>
		<li><strong>State persistence</strong> — Auto-save with resume capability</li>
		<li><strong>Outcome processing</strong> — Scoring templates (total, weighted, percentage, pass/fail)</li>
		<li><strong>Backend adapter</strong> — Optional server-side scoring and secure data handling</li>
	</ul>

	<h3>Extensibility</h3>

	<p>The player architecture separates QTI logic from UI rendering:</p>
	<ul>
		<li><strong>Plugin system</strong> (<code>QTIPlugin</code>) — Register custom extractors, components, and lifecycle hooks</li>
		<li><strong>Registries</strong> — Priority-based <code>ExtractionRegistry</code> and <code>ComponentRegistry</code></li>
		<li><strong>Typesetting hook</strong> — Host-provided math rendering (KaTeX adapter included)</li>
		<li><strong>Custom operators</strong> — Support for <code>&lt;customOperator&gt;</code> elements</li>
	</ul>

	<p>
		See the
		<a href="https://github.com/pie-framework/pie-qti/tree/master/packages/acme-likert-plugin" target="_blank" rel="noreferrer">
			ACME Likert plugin
		</a>
		for a complete extensibility example.
	</p>

	<h3>Theming</h3>

	<p>Components render via web components (Shadow DOM) with a CSS variable contract:</p>
	<ul>
		<li><strong>Theme tokens</strong> — DaisyUI-compatible variables (<code>--p</code>, <code>--a</code>, <code>--b1</code>, <code>--bc</code>, etc.)</li>
		<li><strong><code>::part()</code> hooks</strong> — Stable part names for host-side style refinement</li>
		<li><strong>Zero-CSS fallback</strong> — Components render correctly with no host styles</li>
	</ul>

	<p>
		See
		<a href="https://github.com/pie-framework/pie-qti/blob/master/packages/qti2-default-components/STYLING.md" target="_blank" rel="noreferrer">
			STYLING.md
		</a>
		for the full styling contract.
	</p>

	<hr />

	<h2>Part 2: PIE ↔ QTI Transformation Framework</h2>

	<blockquote><p><strong>Status</strong>: Under active development</p></blockquote>

	<p>Bidirectional transformation between QTI 2.2 XML and PIE JSON.</p>

	<h3>Transform Capabilities</h3>

	<p><strong>QTI → PIE</strong> (<code>@pie-qti/qti2-to-pie</code>)</p>
	<ul>
		<li>Lossless round-trip when QTI originated from PIE</li>
		<li>Best-effort semantic transformation otherwise</li>
		<li>Vendor extension system for custom QTI variants</li>
	</ul>

	<p><strong>PIE → QTI</strong> (<code>@pie-qti/pie-to-qti2</code>)</p>
	<ul>
		<li>Lossless reconstruction when PIE contains embedded QTI</li>
		<li>Generator registry for custom PIE model handling</li>
		<li>IMS Content Package generation (<code>imsmanifest.xml</code>)</li>
	</ul>

	<h3>Transform App (<code>@pie-qti/transform-web</code>)</h3>

	<figure>
		<img alt="Transform app screenshot" src="{base}/images/transform-app-screenshot-1.png" loading="lazy" />
	</figure>

	<p>Interactive web UI for transformations:</p>
	<ul>
		<li><strong>Upload</strong> — Single files or ZIP packages (including nested ZIPs)</li>
		<li><strong>Analyze</strong> — Discover items, count interactions, report issues</li>
		<li><strong>Transform</strong> — Batch convert with progress reporting</li>
		<li><strong>Preview</strong> — Side-by-side QTI and PIE rendering</li>
	</ul>

	<p>
		The app uses sessionized local filesystem storage by default, but the architecture supports custom backend
		adapters.
	</p>

	<h3>CLI (<code>@pie-qti/transform-cli</code>)</h3>

	<pre><code class="language-bash"># Transform a single item
bun run pie-qti -- transform input.xml --format qti22:pie --output output.json

# Analyze QTI content
bun run pie-qti -- analyze ./content-package/

# See all commands
bun run pie-qti -- --help</code></pre>

	<hr />

	<h2>Development</h2>

	<pre><code class="language-bash"># Install dependencies
bun install

# Build all packages
bun run build

# Run tests
bun run test

# Lint and typecheck
bun run lint
bun run typecheck

# E2E tests (Playwright)
bun run test:e2e</code></pre>

	<h3>GitHub Pages Preview</h3>

	<pre><code class="language-bash">bun run build:pages
bun run preview:pages
# Open http://localhost:4173/pie-qti/</code></pre>

	<hr />

	<h2>Documentation</h2>

	<h3>Architecture &amp; Project Layout</h3>
	<ul>
		<li>
			<strong>Architecture Guide</strong> —
			<a href="https://github.com/pie-framework/pie-qti/blob/master/docs/ARCHITECTURE.md" target="_blank" rel="noreferrer">
				<code>docs/ARCHITECTURE.md</code>
			</a>
		</li>
	</ul>

	<h3>Players</h3>
	<ul>
		<li>
			<a href="https://github.com/pie-framework/pie-qti/blob/master/packages/qti2-item-player/README.md" target="_blank" rel="noreferrer">Item Player</a>
		</li>
		<li>
			<a href="https://github.com/pie-framework/pie-qti/blob/master/packages/qti2-assessment-player/README.md" target="_blank" rel="noreferrer">Assessment Player</a>
		</li>
		<li>
			<a href="https://github.com/pie-framework/pie-qti/blob/master/packages/qti2-default-components/STYLING.md" target="_blank" rel="noreferrer">Styling Contract</a>
		</li>
		<li>
			<a href="https://github.com/pie-framework/pie-qti/blob/master/packages/qti2-example/README.md" target="_blank" rel="noreferrer">Example App</a>
		</li>
	</ul>

	<h3>Transforms</h3>
	<ul>
		<li>
			<a href="https://github.com/pie-framework/pie-qti/blob/master/docs/PIE-QTI-TRANSFORMATION-GUIDE.md" target="_blank" rel="noreferrer">
				Transformation Guide
			</a>
		</li>
		<li>
			<a href="https://github.com/pie-framework/pie-qti/blob/master/packages/transform-app/README.md" target="_blank" rel="noreferrer">Transform App</a>
		</li>
		<li>
			<a href="https://github.com/pie-framework/pie-qti/blob/master/packages/cli/README.md" target="_blank" rel="noreferrer">CLI</a>
		</li>
		<li>
			<a href="https://github.com/pie-framework/pie-qti/blob/master/packages/qti2-to-pie/README.md" target="_blank" rel="noreferrer">QTI → PIE</a>
		</li>
		<li>
			<a href="https://github.com/pie-framework/pie-qti/blob/master/packages/pie-to-qti2/README.md" target="_blank" rel="noreferrer">PIE → QTI</a>
		</li>
		<li>
			<a href="https://github.com/pie-framework/pie-qti/blob/master/packages/pie-to-qti2/docs/MANIFEST-GENERATION.md" target="_blank" rel="noreferrer">
				IMS Content Packages
			</a>
		</li>
	</ul>

	<h3>Extensibility</h3>
	<ul>
		<li>
			<a href="https://github.com/pie-framework/pie-qti/blob/master/packages/pie-to-qti2/CUSTOM-GENERATORS.md" target="_blank" rel="noreferrer">
				Custom Generators
			</a>
		</li>
		<li>
			<a href="https://github.com/pie-framework/pie-qti/blob/master/packages/acme-likert-plugin/README.md" target="_blank" rel="noreferrer">
				ACME Likert Plugin
			</a>
		</li>
	</ul>
</DocLayout>
