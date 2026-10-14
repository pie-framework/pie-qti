/**
 * QTI 3.0 normalization
 *
 * The unit tests pin the renames and prompt repairs. The parity tests rewrite every QTI 2.x
 * fixture into QTI 3.0 spelling and require the same conversion as the original, so each
 * transformer is shown to read QTI 3.0 content through the QTI 2.x vocabulary.
 */

import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { QTI3_ATTRIBUTE_TO_QTI2 } from '@pie-qti/qti-common/element-mapper';
import { convertQtiPassageDocument } from '../src/passage-converter.js';
import { type QtiItemTransformError, QtiToPiePlugin } from '../src/plugin.js';
import type { PieAssessment } from '../src/transformers/assessment-test.js';
import {
  demoteMisplacedQti3Prompts,
  isQti3Document,
  normalizeQti3Lexically,
  normalizeQti3ToQti2,
  relocateQti3PromptIntoInteraction,
  unsupportedQti3Construct,
} from '../src/index.js';

const logger = { info() {}, warn() {}, error() {}, debug() {} };
const QTI3_NS = 'http://www.imsglobal.org/xsd/imsqtiasi_v3p0';
const LEFTOVER_QTI3_MARKUP = /<\s*\/?\s*(?:[\w.-]+:)?qti-/i;

const item = (attrs: string, body = '<qti-item-body/>') =>
  `<qti-assessment-item xmlns="${QTI3_NS}" identifier="i1" ${attrs}>${body}</qti-assessment-item>`;

describe('normalizeQti3ToQti2', () => {
  test('renames the namespace, elements and attributes', () => {
    const xml =
      `<qti-assessment-item xmlns="${QTI3_NS}" identifier="i1" title="QTI 3">` +
      '<qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>' +
      '<qti-item-body>' +
      '<qti-choice-interaction response-identifier="RESPONSE" max-choices="1">' +
      '<qti-simple-choice identifier="A">A</qti-simple-choice>' +
      '</qti-choice-interaction>' +
      '</qti-item-body>' +
      '</qti-assessment-item>';

    expect(normalizeQti3ToQti2(xml)).toBe(
      '<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="i1" title="QTI 3">' +
        '<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>' +
        '<itemBody>' +
        '<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">' +
        '<simpleChoice identifier="A">A</simpleChoice>' +
        '</choiceInteraction>' +
        '</itemBody>' +
        '</assessmentItem>'
    );
  });

  test('renames response processing, mapping and graphic gap-match markup', () => {
    const xml =
      `<qti-assessment-item xmlns="${QTI3_NS}" identifier="i1">` +
      '<qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">' +
      '<qti-mapping default-value="0"><qti-map-entry map-key="A" mapped-value="1"/></qti-mapping>' +
      '</qti-response-declaration>' +
      '<qti-item-body>' +
      '<qti-graphic-gap-match-interaction response-identifier="RESPONSE">' +
      '<qti-gap-img identifier="G1"/><qti-associable-hotspot identifier="A"/>' +
      '</qti-graphic-gap-match-interaction>' +
      '</qti-item-body>' +
      '<qti-response-processing><qti-template-condition>' +
      '<qti-lookup-outcome-value identifier="SCORE"/>' +
      '</qti-template-condition></qti-response-processing>' +
      '</qti-assessment-item>';

    const normalized = normalizeQti3ToQti2(xml);

    expect(normalized).not.toMatch(LEFTOVER_QTI3_MARKUP);
    for (const fragment of [
      '<mapping defaultValue="0">',
      '<mapEntry mapKey="A" mappedValue="1"/>',
      '<graphicGapMatchInteraction responseIdentifier="RESPONSE">',
      '<gapImg identifier="G1"/>',
      '<associableHotspot identifier="A"/>',
      '<templateCondition>',
      '<lookupOutcomeValue identifier="SCORE"/>',
    ]) {
      expect(normalized).toContain(fragment);
    }
  });

  test('gives the duration comparisons their acronym spelling', () => {
    const normalized = normalizeQti3Lexically(
      '<qti-duration-gte><qti-variable identifier="duration"/></qti-duration-gte>' +
        '<qti-duration-lt><qti-variable identifier="duration"/></qti-duration-lt>'
    );

    expect(normalized).toBe(
      '<durationGTE><variable identifier="duration"/></durationGTE>' +
        '<durationLT><variable identifier="duration"/></durationLT>'
    );
  });

  test('renames time-dependent and the other QTI attributes the schemas spell in camelCase', () => {
    const attrs = [
      'time-dependent="false"',
      'max-attempts="1"',
      'show-feedback="false"',
      'allow-review="true"',
      'validate-responses="false"',
      'navigation-mode="linear"',
      'pattern-mask="[0-9]+"',
      'normal-maximum="2"',
    ].join(' ');

    const normalized = normalizeQti3ToQti2(item(attrs));

    for (const camel of [
      'timeDependent',
      'maxAttempts',
      'showFeedback',
      'allowReview',
      'validateResponses',
      'navigationMode',
      'patternMask',
      'normalMaximum',
    ]) {
      expect(normalized).toContain(`${camel}=`);
    }
    expect(normalized).not.toContain('time-dependent');
  });

  test('leaves kebab-case attributes outside the QTI vocabulary alone', () => {
    const body =
      '<qti-item-body><div class="qti-layout-row" data-role="stem" aria-hidden="true" ' +
      'aria-describedby="x" data-custom-thing="1">text</div></qti-item-body>';

    const normalized = normalizeQti3ToQti2(item('xml:lang="en" time-dependent="false"', body));

    for (const fragment of [
      'aria-hidden="true"',
      'aria-describedby="x"',
      'data-role="stem"',
      'data-custom-thing="1"',
      'xml:lang="en"',
      'class="qti-layout-row"',
    ]) {
      expect(normalized).toContain(fragment);
    }
  });

  test('maps no attribute QTI 2.x already spells in kebab-case', () => {
    for (const key of QTI3_ATTRIBUTE_TO_QTI2.keys()) {
      expect(key.startsWith('aria-')).toBe(false);
    }
    expect(QTI3_ATTRIBUTE_TO_QTI2.get('time-dependent')).toBe('timeDependent');
    expect(QTI3_ATTRIBUTE_TO_QTI2.get('base-type')).toBe('baseType');
  });

  test('renames a stimulus reference, a catalog and its cards', () => {
    const xml =
      `<qti-assessment-item xmlns="${QTI3_NS}" identifier="catalog">` +
      '<qti-assessment-stimulus-ref identifier="stim-1" href="../passages/stimulus.xml"/>' +
      '<qti-companion-materials-info><qti-calculator><qti-calculator-type>basic</qti-calculator-type></qti-calculator></qti-companion-materials-info>' +
      '<qti-item-body><p data-catalog-idref="c1">Text</p></qti-item-body>' +
      '<qti-catalog-info><qti-catalog id="c1">' +
      '<qti-card support="spoken"><qti-html-content>Text, read aloud</qti-html-content></qti-card>' +
      '<qti-card support="sign-language"><qti-file-href mime-type="video/mp4">media/c1.mp4#t=2,5</qti-file-href></qti-card>' +
      '<qti-card support="glossary-on-screen"><qti-card-entry xml:lang="es" default="true"><qti-html-content>Texto</qti-html-content></qti-card-entry></qti-card>' +
      '</qti-catalog></qti-catalog-info>' +
      '</qti-assessment-item>';

    expect(normalizeQti3ToQti2(xml)).toBe(
      '<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="catalog">' +
        '<assessmentStimulusRef identifier="stim-1" href="../passages/stimulus.xml"/>' +
        '<companionMaterialsInfo><calculator><calculatorType>basic</calculatorType></calculator></companionMaterialsInfo>' +
        '<itemBody><p data-catalog-idref="c1">Text</p></itemBody>' +
        '<catalogInfo><catalog id="c1">' +
        '<card support="spoken"><htmlContent>Text, read aloud</htmlContent></card>' +
        '<card support="sign-language"><fileHref mime-type="video/mp4">media/c1.mp4#t=2,5</fileHref></card>' +
        '<card support="glossary-on-screen"><cardEntry xml:lang="es" default="true"><htmlContent>Texto</htmlContent></cardEntry></card>' +
        '</catalog></catalogInfo>' +
        '</assessmentItem>'
    );
  });

  test('unwraps rubric block content from qti-content-body', () => {
    const xml = item(
      '',
      '<qti-item-body><qti-rubric-block view="scorer" use="scoring"><qti-stylesheet href="r.css" type="text/css"/>' +
        '<qti-content-body><p>Full</p></qti-content-body></qti-rubric-block>' +
        '<qti-rubric-block view="candidate" use="instructions"><qti-content-body/></qti-rubric-block></qti-item-body>'
    );

    expect(normalizeQti3Lexically(xml)).toContain(
      '<itemBody><rubricBlock view="scorer" use="scoring"><stylesheet href="r.css" type="text/css"/><p>Full</p></rubricBlock>' +
        '<rubricBlock view="candidate" use="instructions"></rubricBlock></itemBody>'
    );
  });

  test('leaves QTI 2.x markup unchanged', () => {
    const qti2 =
      '<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="i1"><itemBody/></assessmentItem>';

    expect(normalizeQti3ToQti2(qti2)).toBe(qti2);
  });
});

describe('misplaced prompt repair', () => {
  const withBody = (body: string) =>
    `<qti-assessment-item xmlns="${QTI3_NS}" identifier="i1" time-dependent="false">${body}</qti-assessment-item>`;
  const choice = (extra = '') =>
    `<qti-choice-interaction response-identifier="RESPONSE" max-choices="1"${extra}>` +
    '<qti-simple-choice identifier="A">A</qti-simple-choice></qti-choice-interaction>';

  test('moves a body-level prompt into the single interaction it introduces, first', () => {
    const normalized = normalizeQti3ToQti2(
      withBody(`<qti-item-body><qti-prompt>Pick one</qti-prompt>${choice()}</qti-item-body>`)
    );

    expect(normalized).toContain(
      '<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><prompt>Pick one</prompt>'
    );
    expect(normalized).not.toMatch(/<itemBody><prompt>/);
  });

  test('keeps a CDATA prompt body intact when moving it', () => {
    const normalized = normalizeQti3ToQti2(
      withBody(
        `<qti-item-body><qti-prompt><![CDATA[<strong>Stem</strong> & more]]></qti-prompt>${choice()}</qti-item-body>`
      )
    );

    expect(normalized).toContain('<![CDATA[<strong>Stem</strong> & more]]>');
    expect(normalized).toMatch(/<choiceInteraction[^>]*><prompt><!\[CDATA\[/);
  });

  test('demotes a prompt shared by two interactions in place', () => {
    const normalized = normalizeQti3ToQti2(
      withBody(
        `<qti-item-body><qti-prompt>Shared stem</qti-prompt>${choice()}${choice(' class="second"')}</qti-item-body>`
      )
    );

    expect(normalized).not.toMatch(/<choiceInteraction[^>]*><prompt>/);
    expect(normalized).toContain('<div class="qti-prompt">Shared stem</div>');
  });

  test('never moves a prompt into an inline interaction', () => {
    const normalized = normalizeQti3ToQti2(
      withBody(
        '<qti-item-body><qti-prompt>Fill in</qti-prompt>' +
          '<qti-text-entry-interaction response-identifier="RESPONSE"/></qti-item-body>'
      )
    );

    expect(normalized).not.toMatch(/<textEntryInteraction[^>]*><prompt>/);
    expect(normalized).toContain('<div class="qti-prompt">Fill in</div>');
  });

  test('leaves a prompt inside an inline interaction for its transformer', () => {
    const normalized = normalizeQti3ToQti2(
      withBody(
        '<qti-item-body><p>Area: <qti-text-entry-interaction response-identifier="RESPONSE">' +
          '<qti-prompt>In square meters</qti-prompt></qti-text-entry-interaction></p></qti-item-body>'
      )
    );

    expect(normalized).toContain(
      '<textEntryInteraction responseIdentifier="RESPONSE"><prompt>In square meters</prompt>'
    );
  });

  test('demotes a prompt nested in a layout column in place', () => {
    const normalized = normalizeQti3ToQti2(
      withBody(
        '<qti-item-body><div class="qti-layout-row"><div class="qti-layout-col6">' +
          `<qti-prompt>Nested stem</qti-prompt></div><div class="qti-layout-col6">${choice()}</div>` +
          '</div></qti-item-body>'
      )
    );

    expect(normalized).toContain(
      '<div class="qti-layout-col6"><div class="qti-prompt">Nested stem</div></div>'
    );
    expect(normalized).not.toContain('<prompt>');
  });

  test('takes the close tag by its extent when it carries whitespace', () => {
    const normalized = normalizeQti3ToQti2(
      withBody(
        '<qti-item-body><div class="qti-layout-col6"><qti-prompt>Stem</qti-prompt >' +
          `</div><div>${choice()}</div></qti-item-body>`
      )
    );

    expect(normalized).toContain('<div class="qti-prompt">Stem</div>');
    expect(normalized).not.toMatch(/<\/div>\s*>/);
  });

  test('demotes a self-closing prompt', () => {
    const normalized = normalizeQti3ToQti2(
      withBody(`<qti-item-body><div><qti-prompt/></div><div>${choice()}</div></qti-item-body>`)
    );

    expect(normalized).toContain('<div class="qti-prompt"></div>');
    expect(normalized).not.toMatch(/<prompt\s*\/>/);
  });

  test('composes from steps that each show whether their repair applied', () => {
    const steps = (xml: string) => {
      const renamed = normalizeQti3Lexically(xml);
      const relocated = relocateQti3PromptIntoInteraction(renamed);
      const demoted = demoteMisplacedQti3Prompts(relocated);
      expect(demoted).toBe(normalizeQti3ToQti2(xml));
      return { relocatedChanged: relocated !== renamed, demotedChanged: demoted !== relocated };
    };

    expect(
      steps(withBody(`<qti-item-body><qti-prompt>Pick one</qti-prompt>${choice()}</qti-item-body>`))
    ).toEqual({ relocatedChanged: true, demotedChanged: false });
    expect(
      steps(
        withBody(
          `<qti-item-body><div><qti-prompt>Nested stem</qti-prompt></div><div>${choice()}</div></qti-item-body>`
        )
      )
    ).toEqual({ relocatedChanged: false, demotedChanged: true });
  });

  test('leaves a prompt inside its interaction in place', () => {
    const normalized = normalizeQti3ToQti2(
      withBody(
        '<qti-item-body><qti-choice-interaction response-identifier="RESPONSE" max-choices="1">' +
          '<qti-prompt>Already right</qti-prompt>' +
          '<qti-simple-choice identifier="A">A</qti-simple-choice>' +
          '</qti-choice-interaction></qti-item-body>'
      )
    );

    expect(normalized).toContain(
      '<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><prompt>Already right</prompt>'
    );
    expect(normalized).not.toContain('qti-prompt');
  });
});

describe('QTI 3.0 detection and unsupported constructs', () => {
  test('detects QTI 3.0 by its root element', () => {
    expect(isQti3Document(`<?xml version="1.0"?>\n${item('')}`)).toBe(true);
    // A pie-to-qti2 export carries qti-metadata inside a QTI 2.2 item.
    expect(
      isQti3Document(
        '<assessmentItem identifier="i1"><qti-metadata><qti-metadata-field name="x"/></qti-metadata></assessmentItem>'
      )
    ).toBe(false);
  });

  test('names qti-accessibility, and markup the rename leaves behind', () => {
    const accessibility = item(
      '',
      '<qti-item-body/><qti-accessibility><qti-accessibility-info/></qti-accessibility>'
    );
    expect(
      unsupportedQti3Construct(accessibility, normalizeQti3ToQti2(accessibility))?.construct
    ).toBe('qti-accessibility');

    const leftover = item('', '<qti-item-body><qti-9x/></qti-item-body>');
    expect(unsupportedQti3Construct(leftover, normalizeQti3ToQti2(leftover))?.construct).toBe(
      'qti-9x'
    );
    expect(unsupportedQti3Construct(item(''), normalizeQti3ToQti2(item('')))).toBeUndefined();
  });
});

async function diagnosticCodes(xml: string): Promise<string[]> {
  try {
    await new QtiToPiePlugin().transform({ content: xml }, { logger });
  } catch (error) {
    return ((error as QtiItemTransformError).sourceDiagnostics ?? []).map(
      (diagnostic) => diagnostic.code
    );
  }
  throw new Error('expected the conversion to fail');
}

describe('QTI 3.0 item conversion', () => {
  test('rejects qti-accessibility as an unsupported QTI 3.0 construct', async () => {
    const xml = item(
      'time-dependent="false"',
      '<qti-item-body><p>Text</p></qti-item-body>' +
        '<qti-accessibility><qti-accessibility-info/></qti-accessibility>'
    );

    expect(await diagnosticCodes(xml)).toContain('QTI_VERSION_UNSUPPORTED');
  });

  test('rejects a portable custom interaction with its module', async () => {
    const xml = item(
      'time-dependent="false"',
      '<qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>' +
        '<qti-item-body>' +
        '<qti-portable-custom-interaction response-identifier="RESPONSE" ' +
        'custom-interaction-type-identifier="urn:acme:dial" module="acme-dial">' +
        '<qti-interaction-modules><qti-interaction-module id="acme-dial" primary-path="modules/dial.js"/></qti-interaction-modules>' +
        '</qti-portable-custom-interaction>' +
        '</qti-item-body>'
    );

    let message = '';
    try {
      await new QtiToPiePlugin().transform({ content: xml }, { logger });
    } catch (error) {
      message = (error as Error).message;
      expect(
        (error as QtiItemTransformError).sourceDiagnostics.map((diagnostic) => diagnostic.code)
      ).toContain('QTI_CUSTOM_INTERACTION_UNSUPPORTED');
    }
    expect(message).toContain('customInteractionIdentifierType: urn:acme:dial');
    expect(message).toContain('moduleRefs: acme-dial, modules/dial.js');
  });

  test('converts a QTI 3.0 stimulus document to a passage', () => {
    const result = convertQtiPassageDocument({
      passageId: 'stim-1',
      xml:
        `<qti-assessment-stimulus xmlns="${QTI3_NS}" identifier="stim-1" title="The River">` +
        '<qti-stimulus-body><p>The river runs.</p></qti-stimulus-body>' +
        '</qti-assessment-stimulus>',
    });

    expect(result.status).toBe('converted');
    if (result.status !== 'converted') return;
    expect(result.passage.title).toBe('The River');
    expect(JSON.stringify(result.passage.config.models)).toContain('The river runs.');
  });
});

describe('QTI 3.0 test conversion', () => {
  const test3 =
    `<qti-assessment-test xmlns="${QTI3_NS}" identifier="t3" title="Test">` +
    '<qti-test-part identifier="P1" navigation-mode="linear" submission-mode="individual">' +
    '<qti-assessment-section identifier="S1" title="Reading" visible="true">' +
    '<qti-rubric-block id="river" use="stimulus" view="candidate"><p>The river runs.</p></qti-rubric-block>' +
    '<qti-assessment-item-ref identifier="I1" href="i1.xml"/>' +
    '<qti-assessment-section identifier="S2" title="Notes" visible="true">' +
    '<qti-rubric-block view="scorer tutor" class="rubric"><p>Award one point.</p></qti-rubric-block>' +
    '<qti-assessment-item-ref identifier="I2" href="i2.xml"/>' +
    '</qti-assessment-section>' +
    '</qti-assessment-section>' +
    '</qti-test-part>' +
    '</qti-assessment-test>';

  test('reports the authored version and section rubric blocks in the player shape', async () => {
    const output = await new QtiToPiePlugin().transform({ content: test3 }, { logger });
    const assessment = output.items[0]?.content as PieAssessment;

    expect(assessment.qtiVersion).toBe('3.0');
    const [section] = assessment.testParts[0]?.sections ?? [];
    expect(section?.rubricBlocks).toEqual([
      { identifier: 'river', view: ['candidate'], class: 'stimulus', content: '<p>The river runs.</p>' },
    ]);
    expect(section?.subsections?.[0]?.rubricBlocks).toEqual([
      { view: ['scorer', 'tutor'], class: 'rubric', content: '<p>Award one point.</p>' },
    ]);
  });
});

/**
 * The QTI 2.x vocabulary's element names, from the vendored schemas, minus the XHTML elements
 * QTI 3.0 leaves unprefixed.
 */
function qtiElementNames(): Set<string> {
  const xhtml = new Set(
    (
      'a abbr acronym address b bdo big blockquote br caption cite code col colgroup dd dfn div ' +
      'dl dt em h1 h2 h3 h4 h5 h6 hr i img kbd label li object ol p param pre q samp small span ' +
      'strong sub sup table tbody td tfoot th thead tr tt ul var'
    ).split(' ')
  );
  const names = new Set<string>();
  for (const schema of ['imsqti_v2p1.xsd', 'imsqti_v2p2.xsd']) {
    const xsd = readFileSync(join(import.meta.dir, '..', 'schemas', 'qti', schema), 'utf8');
    for (const match of xsd.matchAll(/<xs:element name="([A-Za-z][\w]*)"/g)) {
      const name = match[1] as string;
      if (!xhtml.has(name)) names.add(name);
    }
  }
  return names;
}

const QTI_ELEMENT_NAMES = qtiElementNames();
const QTI2_ATTRIBUTE_TO_QTI3 = new Map(
  [...QTI3_ATTRIBUTE_TO_QTI2].map(([kebab, camel]) => [camel, kebab])
);
const ACRONYM_ELEMENTS: Record<string, string> = {
  durationGTE: 'duration-gte',
  durationLT: 'duration-lt',
};

const kebab = (name: string) =>
  ACRONYM_ELEMENTS[name] ?? name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** A QTI 2.x document in QTI 3.0 spelling: the inverse of the lexical normalization. */
function toQti3(xml: string): string {
  return xml
    .replace(/http:\/\/www\.imsglobal\.org\/xsd\/imsqti_v2p[12](?![\w/.])/g, QTI3_NS)
    .replace(
      /http:\/\/www\.imsglobal\.org\/question\/qti_v2p[12]\/rptemplates\/(\w+?)(?:\.xml)?(?=")/g,
      'https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/$1.xml'
    )
    .replace(/<(\/?)([A-Za-z][\w]*)(?=[\s/>])/g, (match, slash: string, name: string) =>
      QTI_ELEMENT_NAMES.has(name) ? `<${slash}qti-${kebab(name)}` : match
    )
    .replace(/(\s)([A-Za-z][\w]*)(\s*=)/g, (match, leading: string, name: string, eq: string) => {
      const kebabName = QTI2_ATTRIBUTE_TO_QTI3.get(name);
      return kebabName ? `${leading}${kebabName}${eq}` : match;
    });
}

function fixtureFiles(dir: string): string[] {
  return readdirSync(dir)
    .sort()
    .flatMap((entry) => {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) return fixtureFiles(path);
      return entry.endsWith('.xml') && entry !== 'imsmanifest.xml' ? [path] : [];
    });
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** What a conversion produced, without what records the source version or the run. */
function comparable(output: Awaited<ReturnType<QtiToPiePlugin['transform']>>): unknown {
  const stripped = output.items.map((entry) => {
    const content = entry.content as Record<string, any>;
    const { qtiSource: _source, qtiProcessing: _processing, ...metadata } = content.metadata ?? {};
    // A test's content reports the authored version.
    const { qtiVersion: _version, ...rest } = content;
    return { id: entry.id, ...rest, metadata };
  });
  return JSON.parse(
    JSON.stringify({
      items: stripped,
      warnings: (output.warnings ?? []).map(({ code, message }) => ({ code, message })),
    }).replace(UUID, '<uuid>')
  );
}

async function conversion(xml: string): Promise<{ output?: unknown; codes?: string[] }> {
  try {
    return { output: comparable(await new QtiToPiePlugin().transform({ content: xml }, { logger })) };
  } catch (error) {
    return {
      codes: ((error as QtiItemTransformError).sourceDiagnostics ?? []).map(
        (diagnostic) => diagnostic.code
      ),
    };
  }
}

const FIXTURES_DIR = join(import.meta.dir, 'fixtures');

describe('QTI 2.x and QTI 3.0 parity', () => {
  for (const path of fixtureFiles(FIXTURES_DIR)) {
    const name = path.slice(FIXTURES_DIR.length + 1);
    test(`${name} converts the same in QTI 3.0 spelling`, async () => {
      const qti2 = readFileSync(path, 'utf8');
      const qti3 = toQti3(qti2);
      expect(isQti3Document(qti3)).toBe(true);
      expect(normalizeQti3ToQti2(qti3)).not.toMatch(LEFTOVER_QTI3_MARKUP);

      expect(await conversion(qti3)).toEqual(await conversion(qti2));
    });
  }
});

describe('QTI 3.0 content', () => {
  const dir = join(import.meta.dir, '..', '..', 'qti-common', 'src', '__tests__', 'fixtures');
  const files = readdirSync(dir).filter((entry) => /^qti3-.*\.xml$/.test(entry)).sort();

  test('the shared QTI 3.0 fixtures are present', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    test(`${file} converts`, async () => {
      const xml = readFileSync(join(dir, file), 'utf8');
      const output = await new QtiToPiePlugin().transform({ content: xml }, { logger });

      expect(output.items).toHaveLength(1);
      expect(output.metadata?.sourceFormat).toBe('qti30');
      expect(JSON.stringify((output.items[0].content as any).config)).not.toMatch(
        LEFTOVER_QTI3_MARKUP
      );
    });
  }
});
