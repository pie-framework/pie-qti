# QTI Sample Packages

This directory contains public, clean-room QTI sample packages used by `@pie-qti/to-pie` integration tests and CLI examples.

## Available Samples

- **assessment-test** - A complete QTI 2.2 `assessmentTest` (`assessment-test.xml`) with sections, item refs, and outcome processing, plus the four items (`item1.xml`-`item4.xml`) it references
- **basic-interactions** - Five items demonstrating common interaction types: single-select and multi-select choice (`choice_simple.xml`, `choice_multiple.xml`), text entry (`text_entry.xml`), inline dropdown (`inline_choice.xml`), and match (`match_interaction.xml`)
- **graphic-interactions** - Image-based interactions: clickable regions on an image (`hotspot.xml`) and dragging labels onto image gaps (`graphic_gap_match.xml`)
- **interactive-interactions** - Drag-and-drop and selection interactions: associate (`associate.xml`), match (`match.xml`), gap match (`gap_match.xml`), and inline choice (`inline_choice.xml`)
- **math-assessment** - A math `assessmentTest` (`math-test.xml`) referencing four items (algebra equation, fraction ordering, geometry area, word problem) that use choice, order, and text-entry interactions with math content
- **text-interactions** - Text response items: short text entry (`text_entry.xml`) and extended text (`extended_text.xml`)
- **with-passages** - Reading comprehension items: a choice item with an inline `<stimulus>` passage (`choice-with-stimulus.xml`) and an extended-response item with a `rubricBlock` scoring rubric (`extended-response-with-rubric.xml`)

Every package ships an `imsmanifest.xml` and uses QTI 2.2. See `samples-metadata.json` for per-sample details.

## Adding New Samples

To add a new sample package:

1. Create a directory in `packages/to-pie/tests/fixtures/qti-samples/`
2. Add QTI XML files
3. Include an `imsmanifest.xml` (optional but recommended)
4. Update `samples-metadata.json`
5. Add or update integration coverage that exercises the sample

## Sample Format

Samples should:
- Use valid QTI 2.2 XML
- Include response declarations
- Include response processing
- Be self-contained (no external dependencies initially)
- Demonstrate specific features or interaction types
