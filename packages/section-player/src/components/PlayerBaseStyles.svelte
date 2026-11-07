<!--
	The players' low-priority base stylesheet. It renders nothing: mounting it
	injects one `@layer pie-qti-base` sheet, once per document or shadow root.

	- `.pie-qti-chrome` roots (assessment shell, section layouts) take their
	  typography from the `--pie-qti-*` tokens, not from whatever the host page
	  happens to set on its ancestors.
	- `.pie-qti-content` containers (item, passage, rubric and test feedback
	  content) get user-agent-equivalent flow defaults back: paragraph and list
	  spacing, list markers, heading sizes, link underlines, inline images and
	  bordered tables. Host resets such as Tailwind's preflight strip these, and
	  question stems lose their meaning without them. Media never overflows its
	  container.

	Every selector sits in `:where()` (specificity 0) inside a cascade layer, so
	any host or component rule outranks it on purpose; only *layered* host
	resets declared earlier rank below it. What host CSS still reaches item
	content is listed in docs/prds/architecture/assessment-player.md.
-->
<script lang="ts">
	// Style-only component: mounting it injects the base layer.
</script>

<style>
	@layer pie-qti-base {
		/* Custom-element hosts are inline by default; a block box lets the shell fill it. */
		:global(:where(pie-qti-assessment-player, pie-qti-section-player-splitpane, pie-qti-section-player-vertical):where(:not([hidden]))) {
			display: block;
		}

		:global(:where(.pie-qti-chrome)) {
			font-family: var(--pie-qti-font-family, inherit);
			font-size: var(--pie-qti-font-size-base, 1rem);
			line-height: var(--pie-qti-line-height, 1.5);
			color: var(--pie-qti-base-content, oklch(21% 0 0));
			text-align: start;
			-webkit-text-size-adjust: 100%;
			text-size-adjust: 100%;
		}

		:global(:where(.pie-qti-content)) {
			overflow-wrap: break-word;
		}

		:global(:where(.pie-qti-content) :where(p, dl, pre)) {
			margin-block: 1em;
		}

		:global(:where(.pie-qti-content) :where(blockquote, figure)) {
			margin-block: 1em;
			margin-inline: 40px;
		}

		:global(:where(.pie-qti-content) :where(dd)) {
			margin-inline-start: 40px;
		}

		/* Lists with an ARIA role are widgets (listboxes, menus) and keep their own styling. */
		:global(:where(.pie-qti-content) :where(ul:not([role]), ol:not([role]), menu:not([role]))) {
			margin-block: 1em;
			padding-inline-start: 40px;
		}

		:global(:where(.pie-qti-content) :where(ul, ol, menu) :where(ul:not([role]), ol:not([role]), menu:not([role]))) {
			margin-block: 0;
		}

		/* A `type` attribute keeps its own marker; restyling it would override the authored hint. */
		:global(:where(.pie-qti-content) :where(ul:not([role], [type]), menu:not([role], [type]))) {
			list-style-type: disc;
		}

		:global(:where(.pie-qti-content) :where(ul, ol, menu) :where(ul:not([role], [type]), menu:not([role], [type]))) {
			list-style-type: circle;
		}

		:global(:where(.pie-qti-content) :where(ul, ol, menu) :where(ul, ol, menu) :where(ul:not([role], [type]), menu:not([role], [type]))) {
			list-style-type: square;
		}

		:global(:where(.pie-qti-content) :where(ol:not([role], [type]))) {
			list-style-type: decimal;
		}

		:global(:where(.pie-qti-content) :where(h1, h2, h3, h4, h5, h6)) {
			font-weight: bold;
		}

		:global(:where(.pie-qti-content) :where(h1)) {
			font-size: 2em;
			margin-block: 0.67em;
		}

		:global(:where(.pie-qti-content) :where(h2)) {
			font-size: 1.5em;
			margin-block: 0.83em;
		}

		:global(:where(.pie-qti-content) :where(h3)) {
			font-size: 1.17em;
			margin-block: 1em;
		}

		:global(:where(.pie-qti-content) :where(h4)) {
			font-size: 1em;
			margin-block: 1.33em;
		}

		:global(:where(.pie-qti-content) :where(h5)) {
			font-size: 0.83em;
			margin-block: 1.67em;
		}

		:global(:where(.pie-qti-content) :where(h6)) {
			font-size: 0.67em;
			margin-block: 2.33em;
		}

		:global(:where(.pie-qti-content) :where(th)) {
			font-weight: bold;
		}

		/* Links stay identifiable without relying on colour (WCAG 1.4.1). */
		:global(:where(.pie-qti-content) :where(a:any-link)) {
			color: var(--pie-qti-primary, oklch(45% 0.24 277));
			text-decoration-line: underline;
		}

		/* Images and inline SVG sit in the sentence flow, as authored. */
		:global(:where(.pie-qti-content) :where(img:not([hidden]), svg:not([hidden]), canvas:not([hidden]))) {
			display: inline;
		}

		:global(:where(.pie-qti-content) :where(img, svg, video, canvas, iframe, embed, object)) {
			max-inline-size: 100%;
		}

		/* When the width is clamped, the height follows the authored aspect ratio. */
		:global(:where(.pie-qti-content) :where(img[width], video[width], svg[width][viewBox])) {
			block-size: auto;
		}

		:global(:where(.pie-qti-content) :where(table[border]:not([border='0']))) {
			border: 1px solid var(--pie-qti-border-strong, #767676);
		}

		:global(:where(.pie-qti-content) :where(table[border]:not([border='0'])) :where(th, td)) {
			border: 1px solid var(--pie-qti-border-strong, #767676);
		}
	}
</style>
