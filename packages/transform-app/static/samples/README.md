# QTI Sample Packages

This directory contains sample QTI packages that users can load directly into the application for testing and demonstration purposes.

## Available Samples

### basic-interactions

A collection of QTI 2.2 items demonstrating various interaction types:

- **choice_simple.xml** - Single-select multiple choice question
- **choice_multiple.xml** - Multi-select multiple choice question
- **text_entry.xml** - Text entry interaction
- **inline_choice.xml** - Inline dropdown selection
- **match_interaction.xml** - Match/association question

**Package Details:**
- Items: 5
- Manifest: Yes (imsmanifest.xml)
- QTI Version: 2.2
- Media Assets: None

## Adding New Samples

To add a new sample package:

1. Create a directory in `static/samples/`
2. Add QTI XML files
3. Include an `imsmanifest.xml` (optional but recommended)
4. Update `samples-metadata.json`
5. Test loading in the application

## Sample Format

Samples should:
- Use valid QTI 2.2 XML
- Include response declarations
- Include response processing
- Be self-contained (no external dependencies initially)
- Demonstrate specific features or interaction types

## Future Samples

Planned sample packages:
- **with-media** - Items with images, audio, video
- **with-passages** - Items with reading passages/stimuli
- **math-questions** - Items with MathML
- **advanced-scoring** - Custom response processing
- **assessment-test** - Complete QTI assessment test
