# QTI Integration Test Fixtures

This directory contains real-world QTI 2.1/2.2 assessment item samples used for integration testing.

## Source

These files are sourced from the [OAT-SA QTI-SDK](https://github.com/oat-sa/qti-sdk) project, specifically from the `test/samples/ims/items/2_1` directory.

**Source URL:** https://github.com/oat-sa/qti-sdk/tree/master/test/samples/ims/items/2_1

## License

These files are licensed under **GPL-2.0** (GNU General Public License v2.0), which is compatible with open source projects.

**License:** GPL-2.0
**Copyright:** Open Assessment Technologies S.A. and contributors

## Files

| File | Interaction Type | PIE Element | Description |
|------|-----------------|-------------|-------------|
| `choice.xml` | choiceInteraction | multiple-choice | Single choice: "Unattended Luggage" sign comprehension |
| `choice_multiple.xml` | choiceInteraction | multiple-choice | Multiple choice with checkbox mode |
| `extended_text.xml` | extendedTextInteraction | extended-text-entry | Essay/long-form text response |
| `order.xml` | orderInteraction | placement-ordering | Ordering items in sequence |
| `match.xml` | matchInteraction | match | Matching Shakespeare characters to plays |
| `text_entry.xml` | textEntryInteraction | explicit-constructed-response | Fill-in-the-blank text entry |
| `inline_choice.xml` | inlineChoiceInteraction | inline-dropdown | Inline dropdown selections |
| `gap_match.xml` | gapMatchInteraction | drag-in-the-blank | Drag tokens into gaps |
| `hotspot.xml` | hotspotInteraction | hotspot | Click regions on an image |
| `graphic_gap_match.xml` | graphicGapMatchInteraction | image-cloze-association | Drag items onto image areas |
| `associate.xml` | associateInteraction | match | Association pairs (can be match or match-list) |

## Coverage

These fixtures provide coverage for:

- ✅ All 13 implemented transformer types
- ✅ QTI 2.1/2.2 specification compliance
- ✅ Real-world educational content scenarios
- ✅ Various response types (single, multiple, pairs, text)
- ✅ Image and media references
- ✅ Scoring and correct responses
- ✅ Prompts and instructions

## Attribution

Original samples from IMS Global Learning Consortium / 1EdTech, adapted and maintained by:

**OAT-SA (Open Assessment Technologies S.A.)**
GitHub: https://github.com/oat-sa
Project: https://github.com/oat-sa/qti-sdk

Some examples adapted from:
- University of Cambridge ESOL Examinations (PET Handbook)
- IMS Global QTI Best Practice Guides

## Updating Fixtures

To refresh or add fixtures:

```bash
cd tests/integration/fixtures
bash download-samples.sh
```

To add new fixtures, edit `download-samples.sh` and add curl commands for additional files from the OAT-SA repository.

## Testing

These fixtures are used by `../real-world.test.ts` for integration testing. Run tests with:

```bash
bun test tests/integration/real-world.test.ts
```

## Compliance Notes

1. **GPL-2.0 Compatibility**: This project is compatible with GPL-2.0, allowing us to use these test fixtures.

2. **Distribution**: When distributing this software, the GPL-2.0 license of these fixtures must be honored. They are only used for testing and are not embedded in production code.

3. **Attribution**: We acknowledge the OAT-SA project and IMS Global Learning Consortium as the source of these educational assessment examples.

4. **Modification**: Files in this directory are used as-is for testing purposes. Any modifications would be noted in this README.

## See Also

- [OAT-SA QTI-SDK License](https://github.com/oat-sa/qti-sdk/blob/master/LICENSE)
- [IMS Global QTI Specification](http://www.imsglobal.org/question/)
- [Integration Test Documentation](../../../docs/integration-testing.md)
