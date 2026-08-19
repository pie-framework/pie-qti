import { describe, expect, test } from 'bun:test';
import { detectQtiSchemaVersion, QtiValidator, validateQti, validateQtiBatch } from '../../src/utils/qti-validator';

/**
 * `qti-validator.ts` shipped with **no tests at all**, which is how it kept a
 * well-formedness check that never rejected anything: tag balance was a regex count and
 * unescaped entities were a first-match regex, and both only ever produced *warnings*.
 * A QTI-stage transform emitting broken XML therefore passed the gate — the one failure
 * mode the pipeline itself can introduce.
 *
 * These tests pin all three tiers: well-formedness (fatal), structural rules (errors),
 * and XSD validation against the vendored IMS schemas. The test that used to assert the
 * validator does **not** do XSD validation is inverted below — that gap is closed, and
 * these cases exist so it cannot silently reopen.
 */

const item = (body: string, attrs = 'identifier="i1" title="T"') =>
  `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" ${attrs}>
  ${body}
</assessmentItem>`;

const choiceBody = `<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <simpleChoice identifier="A">Alpha</simpleChoice>
      <simpleChoice identifier="B">Beta</simpleChoice>
    </choiceInteraction>
  </itemBody>`;

/** A fully schema-conformant QTI 2.2 item: the required attributes are all present. */
const conformantItem = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="i1" title="T" adaptive="false" timeDependent="false">
  ${choiceBody}
</assessmentItem>`;

describe('validateQti', () => {
  test('accepts a well-formed QTI 2.2 item', async () => {
    const result = await validateQti(item(choiceBody), { xsd: false });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  describe('well-formedness is enforced, not merely reported', () => {
    test('rejects an unclosed tag', async () => {
      const result = await validateQti(item('<itemBody><p>dangling</itemBody>'), { xsd: false });

      expect(result.valid).toBe(false);
      expect(result.errors[0]?.level).toBe('fatal');
      expect(result.errors[0]?.message).toContain('not well-formed');
    });

    test('rejects mismatched tags', async () => {
      const result = await validateQti(item('<itemBody><p>text</div></itemBody>'), { xsd: false });

      expect(result.valid).toBe(false);
      expect(result.errors[0]?.level).toBe('fatal');
    });

    test('rejects a bare ampersand in content', async () => {
      const result = await validateQti(item('<itemBody><p>Salt & pepper</p></itemBody>'), {
        xsd: false,
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0]?.level).toBe('fatal');
    });

    test('rejects a bare ampersand that follows a valid entity', async () => {
      // The retired heuristic tested only the first entity match in a run, so a valid
      // `&amp;` earlier in the same text node made a later bare `&` invisible.
      const result = await validateQti(
        item('<itemBody><p>Fish &amp; chips & mushy peas</p></itemBody>'),
        { xsd: false }
      );

      expect(result.valid).toBe(false);
    });

    test('accepts escaped entities and CDATA', async () => {
      const result = await validateQti(
        item(
          '<itemBody><p>Fish &amp; chips &lt;5 &#38; more</p><p><![CDATA[a & b]]></p></itemBody>'
        ),
        { xsd: false }
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('does not report a false tag mismatch for namespaced or hyphenated names', async () => {
      // The retired regex matched `[a-zA-Z][a-zA-Z0-9]*` only, so it silently miscounted
      // `qti-` and `m:` names and warned about balanced documents.
      const result = await validateQti(
        item(
          '<itemBody><m:math xmlns:m="http://www.w3.org/1998/Math/MathML"><m:mi>x</m:mi></m:math>' +
            '<div class="custom-block"><span data-role="x">ok</span></div></itemBody>'
        ),
        { xsd: false }
      );

      expect(result.valid).toBe(true);
      expect(result.warnings.map((w) => w.message).join(' ')).not.toContain('tag mismatch');
    });

    test('accepts a self-closed element without counting it as unbalanced', async () => {
      const result = await validateQti(
        item('<itemBody><p>see <img src="a.png"/><br/></p></itemBody>'),
        { xsd: false }
      );

      expect(result.valid).toBe(true);
    });

    test('malformed XML is never handed to the schema processor', async () => {
      // Well-formedness short-circuits, so a malformed document reports the parse failure
      // and nothing else — no schema findings about a tree that could not be built.
      const result = await validateQti(item('<itemBody><p>dangling</itemBody>'));

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.schemaValidated).toBe(false);
    });
  });

  describe('structural rules', () => {
    test('rejects a document with no QTI root element', async () => {
      const result = await validateQti('<?xml version="1.0"?><notQti><a>1</a></notQti>', {
        xsd: false,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('Missing required root element'))).toBe(
        true
      );
    });

    test('warns but does not block an assessmentItem with no identifier', async () => {
      // Downgraded from an error on purpose: the conversion derives an id (manifest resource
      // id, else a deterministic content hash), so this is recoverable and must not produce
      // the `invalid` stage verdict, which no reviewer acknowledgement can clear.
      const result = await validateQti(item(choiceBody, 'title="T"'), { xsd: false });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings.some((w) => w.message.includes('identifier'))).toBe(true);
    });

    test('treats an empty identifier the same as an absent one', async () => {
      // `identifier=""` is what real partner content ships; the old pattern required
      // `[^"]+` and so happened to catch it, and that equivalence must survive.
      const result = await validateQti(item(choiceBody, 'identifier="" title="T"'), {
        xsd: false,
      });

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.message.includes('identifier'))).toBe(true);
    });

    test('accepts a usable identifier without comment', async () => {
      const result = await validateQti(item(choiceBody), { xsd: false });

      expect(result.warnings.some((w) => w.message.includes('identifier'))).toBe(false);
    });

    test('warns but stays valid when the QTI namespace is absent', async () => {
      const result = await validateQti(
        '<?xml version="1.0"?><assessmentItem identifier="i1" title="T"><itemBody/></assessmentItem>',
        { xsd: false }
      );

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.message.includes('namespace'))).toBe(true);
    });

    test('accepts assessmentTest and assessmentStimulus roots', async () => {
      for (const root of ['assessmentTest', 'assessmentStimulus']) {
        const result = await validateQti(
          `<?xml version="1.0"?><${root} xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="x"/>`,
          { xsd: false }
        );
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('XSD schema validation', () => {
    test('accepts a schema-conformant QTI 2.2 item with no findings', async () => {
      const result = await validateQti(conformantItem);

      expect(result.schemaValidated).toBe(true);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    test('reports a baseType outside the QTI enumeration', async () => {
      // This is the exact payload the retired `does NOT perform XSD schema validation`
      // test used to pin as unreachable. Both findings are now produced.
      const result = await validateQti(
        item(
          `<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="notARealBaseType"/>
           <itemBody><madeUpElement foo="bar"/></itemBody>`
        )
      );

      expect(result.schemaValidated).toBe(true);
      const messages = result.warnings.map((w) => w.message).join('\n');
      expect(messages).toContain('notARealBaseType');
      expect(messages).toContain('madeUpElement');
    });

    test('schema findings are warnings by default so convertible content is not blocked', async () => {
      // A vendor extension attribute: rejected by the schema, converts fine today. The
      // measured corpus rate for findings like this is why the default is not `error`.
      const result = await validateQti(
        conformantItem.replace('title="T"', 'title="T" pointsPossible="2"')
      );

      expect(result.schemaValidated).toBe(true);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings.some((w) => w.message.includes('pointsPossible'))).toBe(true);
    });

    test('xsdSeverity error makes the same finding blocking', async () => {
      const result = await validateQti(
        conformantItem.replace('title="T"', 'title="T" pointsPossible="2"'),
        { xsdSeverity: 'error' }
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('pointsPossible'))).toBe(true);
      expect(result.errors.every((e) => e.level === 'error')).toBe(true);
    });

    test('validates a QTI 2.1 document against the 2.1 schema, not 2.2', async () => {
      // Same document under each namespace. `imsqti_v2p2` in the message proves the 2.2
      // root was chosen for the 2.2 document, and `imsqti_v2p1` for the 2.1 one — the
      // schema follows the declared namespace rather than a fixed default.
      const qti21 = conformantItem.replace(/imsqti_v2p2/g, 'imsqti_v2p1');
      const result = await validateQti(qti21);

      expect(result.schemaValidated).toBe(true);
      expect(result.valid).toBe(true);
      expect(result.warnings).toEqual([]);

      const findingIn = async (xml: string) => {
        const bad = await validateQti(xml.replace('baseType="identifier"', 'baseType="nope"'));
        return bad.warnings.map((w) => w.message).join('\n');
      };
      expect(await findingIn(qti21)).toContain('imsqti_v2p1');
      expect(await findingIn(conformantItem)).toContain('imsqti_v2p2');
    });

    test('reports a required attribute the schema demands but the document omits', async () => {
      // `timeDependent` is required by QTI 2.x and routinely absent in partner content.
      const result = await validateQti(item(choiceBody));

      expect(result.schemaValidated).toBe(true);
      expect(result.warnings.some((w) => w.message.includes('timeDependent'))).toBe(true);
    });

    test('makes no schema claim for a document in no QTI 2.x namespace', async () => {
      const result = await validateQti(
        '<?xml version="1.0"?><assessmentItem identifier="i1" title="T"><itemBody/></assessmentItem>'
      );

      // Nothing to validate against, so the result must not imply conformance.
      expect(result.schemaValidated).toBe(false);
      expect(result.valid).toBe(true);
    });

    test('makes no schema claim when XSD validation is switched off', async () => {
      const result = await validateQti(conformantItem, { xsd: false });

      expect(result.schemaValidated).toBe(false);
      expect(result.valid).toBe(true);
    });

    test('a missing vendored schema is reported as a validator fault, not invalid content', async () => {
      const result = await validateQti(conformantItem, { schemaDir: '/nonexistent-schema-dir' });

      // A deployment problem must not masquerade as a content problem.
      expect(result.valid).toBe(true);
      expect(result.schemaValidated).toBe(false);
      expect(result.warnings.some((w) => w.message.includes('could not run'))).toBe(true);
    });
  });

  describe('batching', () => {
    test('attributes findings to the right document across a mixed batch', async () => {
      // The whole batch is validated in one schema compile, so per-document attribution
      // is the property that makes batching safe. Deliberately mixes versions and
      // failure kinds.
      const results = await validateQtiBatch([
        { path: 'clean.xml', content: conformantItem },
        {
          path: 'bad-enum.xml',
          content: conformantItem.replace('baseType="identifier"', 'baseType="notAType"'),
        },
        { path: 'malformed.xml', content: item('<itemBody><p>x</itemBody>') },
        {
          path: 'qti21.xml',
          content: conformantItem.replace(/imsqti_v2p2/g, 'imsqti_v2p1'),
        },
      ]);

      expect(results.size).toBe(4);
      expect(results.get('clean.xml')?.warnings).toEqual([]);
      expect(results.get('clean.xml')?.valid).toBe(true);

      const badEnum = results.get('bad-enum.xml');
      expect(badEnum?.schemaValidated).toBe(true);
      expect(badEnum?.warnings.some((w) => w.message.includes('notAType'))).toBe(true);

      const malformed = results.get('malformed.xml');
      expect(malformed?.valid).toBe(false);
      expect(malformed?.errors[0]?.level).toBe('fatal');

      expect(results.get('qti21.xml')?.schemaValidated).toBe(true);
      expect(results.get('qti21.xml')?.warnings).toEqual([]);
    });

    test('a finding on one document does not leak onto its neighbours', async () => {
      const results = await validateQtiBatch(
        Array.from({ length: 6 }, (_, i) => ({
          path: `item-${i}.xml`,
          content:
            i === 4
              ? conformantItem.replace('<itemBody>', '<itemBody><madeUpElement/>')
              : conformantItem,
        }))
      );

      for (let i = 0; i < 6; i++) {
        const result = results.get(`item-${i}.xml`);
        expect(result?.schemaValidated).toBe(true);
        if (i === 4) {
          expect(result?.warnings.some((w) => w.message.includes('madeUpElement'))).toBe(true);
        } else {
          expect(result?.warnings).toEqual([]);
        }
      }
    });

    test('summary counts how many documents were schema-judged', async () => {
      const results = await validateQtiBatch([
        { path: 'judged.xml', content: conformantItem },
        // No QTI 2.x namespace, so it cannot be judged.
        {
          path: 'unjudged.xml',
          content:
            '<?xml version="1.0"?><assessmentItem identifier="i" title="T"><itemBody/></assessmentItem>',
        },
      ]);

      const summary = QtiValidator.getValidationSummary(results);
      expect(summary.total).toBe(2);
      expect(summary.schemaValidated).toBe(1);
      expect(summary.invalid).toBe(0);
    });
  });

  describe('detectQtiSchemaVersion', () => {
    test('resolves the declared namespace, and refuses to guess', () => {
      expect(detectQtiSchemaVersion('<a xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1"/>')).toBe(
        '2.1'
      );
      expect(detectQtiSchemaVersion('<a xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"/>')).toBe(
        '2.2'
      );
      // QTI 3.0 is judged after normalization into QTI-2 shape, not against a QTI 3
      // schema, so the validator reports it as unresolvable rather than picking one.
      expect(
        detectQtiSchemaVersion(
          '<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"/>'
        )
      ).toBeNull();
      expect(detectQtiSchemaVersion('<assessmentItem/>')).toBeNull();
    });
  });
});
