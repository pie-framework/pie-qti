/**
 * No-host-CSS regression tests
 *
 * Goal: Ensure our web components render sensibly even when the host page does NOT
 * provide Tailwind/DaisyUI CSS utilities. This is required for the Shadow DOM +
 * CSS variables (Option A) strategy.
 *
 * We run the components inside an iframe `srcdoc` document (no CSS), and import
 * the custom elements via Vite's dev server module graph (`/ @id / ...`).
 */

import { expect, test } from '@playwright/test';

const NO_CSS_SRC_DOC = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>No host CSS</title>
    <style>
      /* Intentionally minimal: no Tailwind/DaisyUI. */
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 16px; }
      .stack { display: grid; gap: 20px; }
      h2 { margin: 0 0 8px; font-size: 16px; }
    </style>
  </head>
  <body>
    <div class="stack">
      <div>
        <h2>Order interaction</h2>
        <pie-qti-order id="order"></pie-qti-order>
      </div>
      <div>
        <h2>Match interaction</h2>
        <pie-qti-match id="match"></pie-qti-match>
      </div>
      <div>
        <h2>End attempt interaction</h2>
        <pie-qti-end-attempt id="end"></pie-qti-end-attempt>
      </div>
      <div>
        <h2>Media interaction</h2>
        <pie-qti-media id="media"></pie-qti-media>
      </div>
      <div>
        <h2>Select point interaction</h2>
        <pie-qti-select-point id="select-point"></pie-qti-select-point>
      </div>
      <div>
        <h2>Hotspot interaction</h2>
        <pie-qti-hotspot id="hotspot"></pie-qti-hotspot>
      </div>
      <div>
        <h2>Graphic gap match interaction</h2>
        <pie-qti-graphic-gap-match id="ggm"></pie-qti-graphic-gap-match>
      </div>
      <div>
        <h2>Graphic order interaction</h2>
        <pie-qti-graphic-order id="go"></pie-qti-graphic-order>
      </div>
      <div>
        <h2>Position object interaction</h2>
        <pie-qti-position-object id="po"></pie-qti-position-object>
      </div>
      <div>
        <h2>Graphic associate interaction</h2>
        <pie-qti-graphic-associate id="ga"></pie-qti-graphic-associate>
      </div>
      <div>
        <h2>Choice interaction</h2>
        <pie-qti-choice id="choice"></pie-qti-choice>
      </div>
      <div>
        <h2>Slider interaction</h2>
        <pie-qti-slider id="slider"></pie-qti-slider>
      </div>
      <div>
        <h2>Gap match interaction</h2>
        <pie-qti-gap-match id="gap-match"></pie-qti-gap-match>
      </div>
      <div>
        <h2>Hottext interaction</h2>
        <pie-qti-hottext id="hottext"></pie-qti-hottext>
      </div>
      <div>
        <h2>Associate interaction</h2>
        <pie-qti-associate id="associate"></pie-qti-associate>
      </div>
      <div>
        <h2>Custom interaction</h2>
        <pie-qti-custom id="custom"></pie-qti-custom>
      </div>
      <div>
        <h2>Extended text interaction</h2>
        <pie-qti-extended-text id="extended-text"></pie-qti-extended-text>
      </div>
    </div>

    <script type="module">
      // Load and register custom elements (Shadow DOM).
      import '/@id/@pie-qti/qti2-default-components/plugins';

      // Feed minimal interaction data directly as properties (no QTI player required).
      const order = document.getElementById('order');
      order.interaction = {
        type: 'orderInteraction',
        responseId: 'RESPONSE',
        shuffle: false,
        prompt: 'Arrange items in the correct order.',
        choices: [
          { identifier: 'A', text: 'Ask a question' },
          { identifier: 'B', text: 'Conduct research' },
          { identifier: 'C', text: 'Form a hypothesis' },
          { identifier: 'D', text: 'Test with an experiment' },
        ],
      };
      order.response = null;
      order.disabled = false;

      const match = document.getElementById('match');
      match.interaction = {
        type: 'matchInteraction',
        responseId: 'RESPONSE',
        shuffle: false,
        maxAssociations: 3,
        prompt: 'Match each planet to its type.',
        sourceSet: [
          { identifier: 'MERCURY', text: 'Mercury', matchMax: 1 },
          { identifier: 'EARTH', text: 'Earth', matchMax: 1 },
          { identifier: 'JUPITER', text: 'Jupiter', matchMax: 1 },
        ],
        targetSet: [
          { identifier: 'TERRESTRIAL', text: 'Terrestrial', matchMax: 0 },
          { identifier: 'GAS_GIANT', text: 'Gas giant', matchMax: 0 },
          { identifier: 'TERRESTRIAL_2', text: 'Terrestrial (again)', matchMax: 0 },
        ],
      };
      match.response = null;
      match.disabled = false;

      const end = document.getElementById('end');
      end.interaction = {
        type: 'endAttemptInteraction',
        responseId: 'END',
        prompt: 'When you are finished, end your attempt.',
        title: 'End Attempt',
      };
      end.response = null;
      end.disabled = false;

      const media = document.getElementById('media');
      media.interaction = {
        type: 'mediaInteraction',
        responseId: 'MEDIA',
        prompt: 'Listen once.',
        minPlays: 0,
        maxPlays: 1,
        autostart: false,
        loop: false,
        mediaElement: {
          type: 'audio',
          src: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=',
          mimeType: 'audio/wav',
          width: 0,
          height: 0,
        },
      };
      // Force max-play state so the info icon is present.
      media.response = 1;
      media.disabled = false;

      const sp = document.getElementById('select-point');
      sp.interaction = {
        type: 'selectPointInteraction',
        responseId: 'POINTS',
        prompt: 'Select exactly one point.',
        minChoices: 0,
        maxChoices: 1,
        imageData: null,
      };
      // Force "max reached" state so the info icon is present.
      sp.response = [{ x: 10, y: 10 }];
      sp.disabled = false;

      const hs = document.getElementById('hotspot');
      hs.interaction = {
        type: 'hotspotInteraction',
        responseId: 'HS',
        maxChoices: 1,
        prompt: 'Select the highlighted region.',
        imageData: {
          type: 'svg',
          width: '240',
          height: '120',
          content: '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120" viewBox="0 0 240 120"><rect width="240" height="120" fill="#eee"/></svg>'
        },
        hotspotChoices: [
          { identifier: 'A', shape: 'rect', coords: '20,20,80,40' }
        ]
      };
      hs.response = null;
      hs.disabled = false;

      const ggm = document.getElementById('ggm');
      ggm.interaction = {
        type: 'graphicGapMatchInteraction',
        responseId: 'GGM',
        prompt: 'Drag labels onto hotspots.',
        gapTexts: [
          { identifier: 'L1', text: 'Label 1', matchMax: 1 },
          { identifier: 'L2', text: 'Label 2', matchMax: 1 }
        ],
        hotspots: [
          { identifier: 'H1', shape: 'rect', coords: '20,20,60,30', matchMax: 1 },
          { identifier: 'H2', shape: 'rect', coords: '120,20,60,30', matchMax: 1 }
        ],
        imageData: {
          type: 'svg',
          width: '240',
          height: '120',
          content: '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120" viewBox="0 0 240 120"><rect width="240" height="120" fill="#eee"/></svg>'
        }
      };
      ggm.response = [];
      ggm.disabled = false;

      const go = document.getElementById('go');
      go.interaction = {
        type: 'graphicOrderInteraction',
        responseId: 'GO',
        shuffle: false,
        prompt: 'Order the labels.',
        imageData: {
          type: 'svg',
          width: '240',
          height: '120',
          content: '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120" viewBox="0 0 240 120"><rect width="240" height="120" fill="#eee"/></svg>'
        },
        hotspotChoices: [
          { identifier: 'A', label: 'A' },
          { identifier: 'B', label: 'B' },
          { identifier: 'C', label: 'C' }
        ]
      };
      go.response = null;
      go.disabled = false;

      const po = document.getElementById('po');
      po.interaction = {
        type: 'positionObjectInteraction',
        responseId: 'PO',
        prompt: 'Place the object.',
        minChoices: 0,
        maxChoices: 2,
        centerPoint: true,
        imageData: {
          type: 'svg',
          width: '240',
          height: '120',
          content: '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120" viewBox="0 0 240 120"><rect width="240" height="120" fill="#eee"/></svg>',
          src: ''
        },
        positionObjectStages: [
          {
            identifier: 'S1',
            label: 'Obj',
            matchMax: 2,
            objectData: null
          }
        ]
      };
      // Seed a placed object so we can assert absolute positioning exists.
      po.response = [{ stageId: 'S1', x: 20, y: 20 }];
      po.disabled = false;

      const ga = document.getElementById('ga');
      ga.interaction = {
        type: 'graphicAssociateInteraction',
        responseId: 'GA',
        prompt: 'Associate hotspots.',
        shuffle: false,
        maxAssociations: 2,
        minAssociations: 0,
        imageData: {
          type: 'svg',
          width: '240',
          height: '120',
          content: '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120" viewBox="0 0 240 120"><rect width="240" height="120" fill="#eee"/></svg>',
          src: ''
        },
        associableHotspots: [
          { identifier: 'H1', label: 'H1', shape: 'rect', coords: '20,20,80,40', matchMax: 2 },
          { identifier: 'H2', label: 'H2', shape: 'rect', coords: '120,20,180,40', matchMax: 2 }
        ]
      };
      ga.response = [];
      ga.disabled = false;

      const choice = document.getElementById('choice');
      choice.interaction = {
        type: 'choiceInteraction',
        responseId: 'CHOICE',
        shuffle: false,
        maxChoices: 1,
        prompt: null,
        choices: [
          { identifier: 'A', text: 'Option A' },
          { identifier: 'B', text: 'Option B' }
        ]
      };
      choice.response = null;
      choice.disabled = false;

      const slider = document.getElementById('slider');
      slider.interaction = {
        type: 'sliderInteraction',
        responseId: 'SLIDER',
        lowerBound: 0,
        upperBound: 10,
        step: 1,
        orientation: 'horizontal',
        reverse: false,
        prompt: 'Pick a value.'
      };
      slider.response = 5;
      slider.disabled = false;

      const gm = document.getElementById('gap-match');
      gm.interaction = {
        type: 'gapMatchInteraction',
        responseId: 'GM',
        shuffle: false,
        prompt: 'Fill the gaps.',
        gapTexts: [
          { identifier: 'W1', text: 'one', matchMax: 1 },
          { identifier: 'W2', text: 'two', matchMax: 1 }
        ],
        gaps: [{ identifier: 'G1', index: 0 }, { identifier: 'G2', index: 1 }],
        promptText: 'Count: [GAP:G1] and [GAP:G2].'
      };
      gm.response = [];
      gm.disabled = false;

      const ht = document.getElementById('hottext');
      ht.interaction = {
        type: 'hottextInteraction',
        responseId: 'HT',
        maxChoices: 1,
        minChoices: 0,
        prompt: 'Select a word.',
        contentHtml: '<p>Pick <hottext identifier="A">this</hottext> or <hottext identifier="B">that</hottext>.</p>'
      };
      ht.response = null;
      ht.disabled = false;

      const assoc = document.getElementById('associate');
      assoc.interaction = {
        type: 'associateInteraction',
        responseId: 'ASSOC',
        shuffle: false,
        maxAssociations: 2,
        prompt: 'Associate items.',
        choices: [
          { identifier: 'X', text: 'X', matchMax: 1 },
          { identifier: 'Y', text: 'Y', matchMax: 1 },
          { identifier: 'Z', text: 'Z', matchMax: 1 },
          { identifier: 'W', text: 'W', matchMax: 1 }
        ]
      };
      assoc.response = [];
      assoc.disabled = false;

      const custom = document.getElementById('custom');
      custom.interaction = {
        type: 'customInteraction',
        responseId: 'CUSTOM',
        prompt: 'Vendor custom interaction',
        rawAttributes: { vendor: 'acme' },
        xml: '<customInteraction responseIdentifier="CUSTOM" vendor="acme" />'
      };
      custom.response = null;
      custom.disabled = false;

      const ext = document.getElementById('extended-text');
      ext.interaction = {
        type: 'extendedTextInteraction',
        responseId: 'EXT',
        expectedLines: 4,
        expectedLength: 0,
        placeholderText: 'Type here…',
        format: 'plain'
      };
      ext.response = '<p></p>';
      ext.disabled = false;
    </script>
  </body>
</html>`;

test.describe('Web components without host CSS', () => {
	test('key interactions should not render giant SVG icons without Tailwind', async ({ page }) => {
		await page.goto('./');
		await page.waitForLoadState('networkidle');

		// Create an iframe that does NOT load app.css (no Tailwind/DaisyUI), and render components there.
		await page.evaluate((srcdoc) => {
			const iframe = document.createElement('iframe');
			iframe.id = 'no-host-css';
			iframe.style.width = '1100px';
			iframe.style.height = '900px';
			iframe.style.border = '1px solid #ccc';
			iframe.srcdoc = srcdoc;
			document.body.appendChild(iframe);
		}, NO_CSS_SRC_DOC);

		const frame = page.frameLocator('#no-host-css');

		// Ensure elements exist and are upgraded.
		await frame.locator('pie-qti-order').waitFor();
		await frame.locator('pie-qti-match').waitFor();
		await frame.locator('pie-qti-end-attempt').waitFor();
		await frame.locator('pie-qti-media').waitFor();
		await frame.locator('pie-qti-select-point').waitFor();
		await frame.locator('pie-qti-hotspot').waitFor();
		await frame.locator('pie-qti-graphic-gap-match').waitFor();
		await frame.locator('pie-qti-graphic-order').waitFor();
		await frame.locator('pie-qti-position-object').waitFor();
		await frame.locator('pie-qti-graphic-associate').waitFor();
		await frame.locator('pie-qti-choice').waitFor();
		await frame.locator('pie-qti-slider').waitFor();
		await frame.locator('pie-qti-gap-match').waitFor();
		await frame.locator('pie-qti-hottext').waitFor();
		await frame.locator('pie-qti-associate').waitFor();
		await frame.locator('pie-qti-custom').waitFor();
		await frame.locator('pie-qti-extended-text').waitFor();

		// Order: the drag-handle SVG should be small (not browser default 300x150).
		const orderHandleSize = await frame.locator('pie-qti-order').evaluate((el) => {
			const svg = (el as HTMLElement).shadowRoot?.querySelector('svg');
			if (!svg) return null;
			const r = svg.getBoundingClientRect();
			return { width: r.width, height: r.height };
		});
		expect(orderHandleSize).not.toBeNull();
		expect(orderHandleSize!.width).toBeGreaterThan(0);
		expect(orderHandleSize!.height).toBeGreaterThan(0);
		expect(orderHandleSize!.width).toBeLessThan(64);
		expect(orderHandleSize!.height).toBeLessThan(64);

		// Match: the draggable source handle SVG should be small as well.
		const matchHandleSize = await frame.locator('pie-qti-match').evaluate((el) => {
			const svg = (el as HTMLElement).shadowRoot?.querySelector('svg');
			if (!svg) return null;
			const r = svg.getBoundingClientRect();
			return { width: r.width, height: r.height };
		});
		expect(matchHandleSize).not.toBeNull();
		expect(matchHandleSize!.width).toBeGreaterThan(0);
		expect(matchHandleSize!.height).toBeGreaterThan(0);
		expect(matchHandleSize!.width).toBeLessThan(64);
		expect(matchHandleSize!.height).toBeLessThan(64);

		// End attempt: the icon should be small.
		const endIconSize = await frame.locator('pie-qti-end-attempt').evaluate((el) => {
			const svg = (el as HTMLElement).shadowRoot?.querySelector('svg.qti-icon');
			if (!svg) return null;
			const r = svg.getBoundingClientRect();
			return { width: r.width, height: r.height };
		});
		expect(endIconSize).not.toBeNull();
		expect(endIconSize!.width).toBeGreaterThan(0);
		expect(endIconSize!.height).toBeGreaterThan(0);
		expect(endIconSize!.width).toBeLessThan(64);
		expect(endIconSize!.height).toBeLessThan(64);

		// Media: the max-play info icon should be small.
		const mediaIconSize = await frame.locator('pie-qti-media').evaluate((el) => {
			const svg = (el as HTMLElement).shadowRoot?.querySelector('svg.qti-icon');
			if (!svg) return null;
			const r = svg.getBoundingClientRect();
			return { width: r.width, height: r.height };
		});
		expect(mediaIconSize).not.toBeNull();
		expect(mediaIconSize!.width).toBeGreaterThan(0);
		expect(mediaIconSize!.height).toBeGreaterThan(0);
		expect(mediaIconSize!.width).toBeLessThan(64);
		expect(mediaIconSize!.height).toBeLessThan(64);

		// Select point: the "max reached" info icon should be small.
		const spIconSize = await frame.locator('pie-qti-select-point').evaluate((el) => {
			const svg = (el as HTMLElement).shadowRoot?.querySelector('svg.qti-icon');
			if (!svg) return null;
			const r = svg.getBoundingClientRect();
			return { width: r.width, height: r.height };
		});
		expect(spIconSize).not.toBeNull();
		expect(spIconSize!.width).toBeGreaterThan(0);
		expect(spIconSize!.height).toBeGreaterThan(0);
		expect(spIconSize!.width).toBeLessThan(64);
		expect(spIconSize!.height).toBeLessThan(64);

		// Hotspot: overlay should be absolutely positioned inside the shadow root.
		const hotspotOverlayPos = await frame.locator('pie-qti-hotspot').evaluate((el) => {
			const svg = (el as HTMLElement).shadowRoot?.querySelector('svg[part="overlay"]') as SVGElement | null;
			if (!svg) return null;
			const cs = getComputedStyle(svg);
			return { position: cs.position, width: svg.getBoundingClientRect().width, height: svg.getBoundingClientRect().height };
		});
		expect(hotspotOverlayPos).not.toBeNull();
		expect(hotspotOverlayPos!.position).toBe('absolute');
		// Should match our image size, not browser default.
		expect(hotspotOverlayPos!.width).toBeGreaterThan(0);
		expect(hotspotOverlayPos!.height).toBeGreaterThan(0);
		expect(hotspotOverlayPos!.width).toBeLessThan(400);
		expect(hotspotOverlayPos!.height).toBeLessThan(300);

		// Graphic gap match: overlay should be absolutely positioned inside the shadow root.
		const ggmOverlayPos = await frame.locator('pie-qti-graphic-gap-match').evaluate((el) => {
			const svg = (el as HTMLElement).shadowRoot?.querySelector('svg[part="overlay"]') as SVGElement | null;
			if (!svg) return null;
			const cs = getComputedStyle(svg);
			return { position: cs.position, width: svg.getBoundingClientRect().width, height: svg.getBoundingClientRect().height };
		});
		expect(ggmOverlayPos).not.toBeNull();
		expect(ggmOverlayPos!.position).toBe('absolute');
		expect(ggmOverlayPos!.width).toBeGreaterThan(0);
		expect(ggmOverlayPos!.height).toBeGreaterThan(0);
		expect(ggmOverlayPos!.width).toBeLessThan(400);
		expect(ggmOverlayPos!.height).toBeLessThan(300);

		// Graphic associate: overlay should be absolutely positioned.
		const gaOverlayPos = await frame.locator('pie-qti-graphic-associate').evaluate((el) => {
			const svg = (el as HTMLElement).shadowRoot?.querySelector('svg[part="overlay"]') as SVGElement | null;
			if (!svg) return null;
			return { position: getComputedStyle(svg).position };
		});
		expect(gaOverlayPos).not.toBeNull();
		expect(gaOverlayPos!.position).toBe('absolute');

		// Position object: placed object wrapper must be absolutely positioned.
		const poPlacedPos = await frame.locator('pie-qti-position-object').evaluate((el) => {
			const placed = (el as HTMLElement).shadowRoot?.querySelector('[part="placed"]') as HTMLElement | null;
			if (!placed) return null;
			return { position: getComputedStyle(placed).position };
		});
		expect(poPlacedPos).not.toBeNull();
		expect(poPlacedPos!.position).toBe('absolute');

		// Choice: ensure fallback layout CSS is applied (display should be grid on root).
		const choiceDisplay = await frame.locator('pie-qti-choice').evaluate((el) => {
			const root = (el as HTMLElement).shadowRoot?.querySelector('[part="root"]') as HTMLElement | null;
			return root ? getComputedStyle(root).display : null;
		});
		expect(choiceDisplay).toBe('grid');

		// Slider: ensure range input stretches (width not browser default narrow).
		const sliderRangeWidth = await frame.locator('pie-qti-slider').evaluate((el) => {
			const input = (el as HTMLElement).shadowRoot?.querySelector('input[type="range"]') as HTMLInputElement | null;
			if (!input) return null;
			return input.getBoundingClientRect().width;
		});
		expect(sliderRangeWidth).not.toBeNull();
		expect(sliderRangeWidth!).toBeGreaterThan(80);

		// Custom: ensure fallback textarea exists and is visible-sized.
		const customTextareaWidth = await frame.locator('pie-qti-custom').evaluate((el) => {
			const ta = (el as HTMLElement).shadowRoot?.querySelector('textarea') as HTMLTextAreaElement | null;
			if (!ta) return null;
			return ta.getBoundingClientRect().width;
		});
		expect(customTextareaWidth).not.toBeNull();
		expect(customTextareaWidth!).toBeGreaterThan(80);

		// Extended text: editor container should exist and have non-zero size.
		const rteWidth = await frame.locator('pie-qti-extended-text').evaluate((el) => {
			const editor = (el as HTMLElement).shadowRoot?.querySelector('[part="editor"]') as HTMLElement | null;
			if (!editor) return null;
			return editor.getBoundingClientRect().width;
		});
		expect(rteWidth).not.toBeNull();
		expect(rteWidth!).toBeGreaterThan(80);
	});
});


