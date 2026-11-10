/**
 * Text alternatives of graphic interaction images (WCAG 1.1.1).
 *
 * Every graphic interaction draws its response surface on an authored image.
 * The extractors must carry the author's alternative to the renderer: the
 * `<object>` fallback text (QTI 2.x), `<img alt>` (QTI 3.0, where `alt=""`
 * marks the image decorative), aria naming on the image element, and inline
 * SVG `<title>`/`<desc>`.
 */

import { describe, expect, test } from 'bun:test';
import { standardDrawingExtractor } from '../../../src/interactions/drawing/extractor.js';
import { standardGraphicAssociateExtractor } from '../../../src/interactions/graphic-associate/extractor.js';
import { standardGraphicGapMatchExtractor } from '../../../src/interactions/graphic-gap-match/extractor.js';
import { standardGraphicOrderExtractor } from '../../../src/interactions/graphic-order/extractor.js';
import { standardHotspotExtractor } from '../../../src/interactions/hotspot/extractor.js';
import { standardPositionObjectExtractor } from '../../../src/interactions/position-object/extractor.js';
import { standardSelectPointExtractor } from '../../../src/interactions/select-point/extractor.js';
import type { QTIElement } from '../../../src/interactions/shared/types.js';
import { createTestContext, parseQTI } from '../test-utils.js';

type ImageLike = { alt?: string; altDescription?: string; decorative?: boolean; src?: string; type?: string } | null;

/** One graphic interaction element wrapping `image`, plus the extractor reading it. */
const GRAPHIC_INTERACTIONS: Array<{
	name: string;
	extractImage: (image: string) => ImageLike;
}> = [
	{
		name: 'hotspotInteraction',
		extractImage: (image) => {
			const element = parseQTI(
				`<hotspotInteraction responseIdentifier="R" maxChoices="1">${image}<hotspotChoice identifier="A" shape="circle" coords="5,5,5"/></hotspotInteraction>`,
			);
			return standardHotspotExtractor.extract(element, createTestContext(element, 'R')).imageData;
		},
	},
	{
		name: 'graphicOrderInteraction',
		extractImage: (image) => {
			const element = parseQTI(
				`<graphicOrderInteraction responseIdentifier="R">${image}<hotspotChoice identifier="A" shape="circle" coords="5,5,5"/></graphicOrderInteraction>`,
			);
			return standardGraphicOrderExtractor.extract(element, createTestContext(element, 'R')).imageData;
		},
	},
	{
		name: 'graphicAssociateInteraction',
		extractImage: (image) => {
			const element = parseQTI(
				`<graphicAssociateInteraction responseIdentifier="R">${image}<associableHotspot identifier="A" shape="circle" coords="5,5,5"/></graphicAssociateInteraction>`,
			);
			return standardGraphicAssociateExtractor.extract(element, createTestContext(element, 'R')).imageData;
		},
	},
	{
		name: 'graphicGapMatchInteraction',
		extractImage: (image) => {
			const element = parseQTI(
				`<graphicGapMatchInteraction responseIdentifier="R">${image}<gapText identifier="G" matchMax="1">G</gapText><associableHotspot identifier="A" shape="circle" coords="5,5,5"/></graphicGapMatchInteraction>`,
			);
			return standardGraphicGapMatchExtractor.extract(element, createTestContext(element, 'R')).imageData;
		},
	},
	{
		name: 'selectPointInteraction',
		extractImage: (image) => {
			const element = parseQTI(`<selectPointInteraction responseIdentifier="R" maxChoices="1">${image}</selectPointInteraction>`);
			return standardSelectPointExtractor.extract(element, createTestContext(element, 'R')).imageData;
		},
	},
	{
		name: 'drawingInteraction',
		extractImage: (image) => {
			const element = parseQTI(`<drawingInteraction responseIdentifier="R">${image}</drawingInteraction>`);
			return standardDrawingExtractor.extract(element, createTestContext(element, 'R')).imageData;
		},
	},
];

describe('graphic interaction image alternatives', () => {
	for (const { name, extractImage } of GRAPHIC_INTERACTIONS) {
		describe(name, () => {
			test('keeps the <object> fallback text as alt', () => {
				const image = extractImage('<object data="map.png" type="image/png" width="40" height="20">A street map</object>');
				expect(image?.alt).toBe('A street map');
				expect(image?.decorative).toBeUndefined();
			});

			test('an <object> without fallback text has no alt and is not decorative', () => {
				const image = extractImage('<object data="map.png" type="image/png" width="40" height="20"></object>');
				expect(image?.alt).toBeUndefined();
				expect(image?.decorative).toBeUndefined();
			});

			test('reads the QTI 3.0 <img alt> attribute', () => {
				const image = extractImage('<img src="map.png" alt="A street map" width="40" height="20"/>');
				expect(image?.src).toBe('map.png');
				expect(image?.alt).toBe('A street map');
			});

			test('a <picture> delivers its <img> fallback', () => {
				// QTI 3.0 allows the interaction image as a <picture> (3.0 XSD, each
				// interaction's object|img|picture choice); the fallback <img> is the
				// content that renders, so it is what extraction delivers.
				const image = extractImage(
					'<picture><source srcset="map-2x.png 2x"/><img src="map.png" alt="A street map" width="40" height="20"/></picture>',
				);
				expect(image?.src).toBe('map.png');
				expect(image?.alt).toBe('A street map');
				// Width/height arrive as strings (the object form) or numbers (graphic
				// gap match's gap-text side) depending on the interaction's delivery.
				expect(String(image?.width)).toBe('40');
				expect(String(image?.height)).toBe('20');
			});

			test('a <picture> with an empty-fallback alt marks the image decorative', () => {
				const image = extractImage('<picture><img src="map.png" alt=""/></picture>');
				expect(image?.decorative).toBe(true);
			});

			test('an img-less <picture> delivers no image', () => {
				const image = extractImage('<picture><source srcset="map-2x.png 2x"/></picture>');
				expect(image).toBeNull();
			});

			test('an empty <img alt> marks the image decorative', () => {
				const image = extractImage('<img src="map.png" alt="" width="40" height="20"/>');
				expect(image?.decorative).toBe(true);
				expect(image?.alt).toBeUndefined();
			});

			test('aria-label on the image wins over its fallback text', () => {
				const image = extractImage('<object data="map.png" type="image/png" width="40" height="20" aria-label="Town centre map">fallback</object>');
				expect(image?.alt).toBe('Town centre map');
			});

			test('uses inline SVG <title> and <desc>, not the drawing\'s text', () => {
				const image = extractImage(
					'<object type="image/svg+xml" width="40" height="20"><svg><title>Water cycle</title><desc>Arrows link evaporation to rain.</desc><text>Sun</text></svg></object>',
				);
				expect(image?.type).toBe('svg');
				expect(image?.alt).toBe('Water cycle');
				expect(image?.altDescription).toBe('Arrows link evaporation to rain.');
			});

			test('inline SVG without a title carries no alt (its text is the drawing)', () => {
				const image = extractImage('<object type="image/svg+xml" width="40" height="20"><svg><text>Sun</text></svg></object>');
				expect(image?.alt).toBeUndefined();
			});

			test('object fallback text beside inline SVG is the alt', () => {
				const image = extractImage(
					'<object type="image/svg+xml" width="40" height="20"><svg><text>Sun</text></svg>Solar system</object>',
				);
				expect(image?.alt).toBe('Solar system');
			});
		});
	}

	test('aria-labelledby and aria-describedby resolve within the item', () => {
		const root = parseQTI(`
			<div>
				<p id="cap">Bus routes in the old town</p>
				<p id="long">Three routes cross at the station.</p>
				<hotspotInteraction responseIdentifier="R" maxChoices="1">
					<object data="map.png" type="image/png" width="40" height="20" aria-labelledby="cap" aria-describedby="long"/>
					<hotspotChoice identifier="A" shape="circle" coords="5,5,5"/>
				</hotspotInteraction>
			</div>
		`);
		const interaction = root.childNodes.find((node) =>
			(node as QTIElement).rawTagName?.toLowerCase() === 'hotspotinteraction',
		) as QTIElement;
		const imageData = standardHotspotExtractor.extract(
			interaction,
			createTestContext(interaction, 'R', root),
		).imageData;

		expect(imageData?.alt).toBe('Bus routes in the old town');
		expect(imageData?.altDescription).toBe('Three routes cross at the station.');
	});

	test('positionObjectStage background keeps its alternative', () => {
		const stage = parseQTI(`
			<positionObjectStage>
				<object data="airport-map.png" type="image/png" width="600" height="400">Map of the region</object>
				<positionObjectInteraction responseIdentifier="R">
					<object data="plane.png" type="image/png" width="30" height="30">Airport</object>
				</positionObjectInteraction>
			</positionObjectStage>
		`);
		const interaction = stage.childNodes.find((node) =>
			(node as QTIElement).rawTagName?.toLowerCase().includes('positionobjectinteraction'),
		) as QTIElement;
		const result = standardPositionObjectExtractor.extract(interaction, createTestContext(interaction, 'R', stage));

		expect(result.imageData?.alt).toBe('Map of the region');
		expect(result.positionObjectStages[0].label).toBe('Airport');
	});

	test('graphicGapMatch gap images take their name from <img alt>, never the identifier', () => {
		const element = parseQTI(`
			<graphicGapMatchInteraction responseIdentifier="R">
				<object data="bg.png" type="image/png" width="100" height="100">Background</object>
				<gapImg identifier="HAWK_IS_CORRECT" matchMax="1"><img src="hawk.png" alt="Hawk"/></gapImg>
				<gapImg identifier="MOUSE_ID" matchMax="1"><object data="mouse.png" type="image/png"/></gapImg>
				<associableHotspot identifier="A" shape="circle" coords="5,5,5"/>
			</graphicGapMatchInteraction>
		`);
		const result = standardGraphicGapMatchExtractor.extract(element, createTestContext(element, 'R'));

		expect(result.gapImages[0]).toMatchObject({ src: 'hawk.png', alt: 'Hawk' });
		expect(result.gapImages[1].alt).toBe('');
	});

	test('graphicGapMatch gap images authored as <picture> deliver their <img> fallback', () => {
		// QTI 3.0 GapImgDType allows object|img|picture for the gap label.
		const element = parseQTI(`
			<graphicGapMatchInteraction responseIdentifier="R">
				<object data="bg.png" type="image/png" width="100" height="100">Background</object>
				<gapImg identifier="I1" matchMax="1"><picture><source srcset="hawk-2x.png 2x"/><img src="hawk.png" alt="Hawk" width="20" height="20"/></picture></gapImg>
				<associableHotspot identifier="A" shape="circle" coords="5,5,5"/>
			</graphicGapMatchInteraction>
		`);
		const result = standardGraphicGapMatchExtractor.extract(element, createTestContext(element, 'R'));

		expect(result.gapImages[0]).toMatchObject({ src: 'hawk.png', alt: 'Hawk', width: 20, height: 20 });
	});
});
