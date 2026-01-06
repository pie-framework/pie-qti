import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

type Manifest = {
  id?: string;
  covers?: string[];
  [k: string]: unknown;
};

const fixturesRoot = join(process.cwd(), 'packages/qti2-item-player/tests/conformance/fixtures');

// Map non-canonical tags (typically XML element names) to canonical AST-kind coverage tags.
// Keep this intentionally additive: we do NOT remove existing tags.
const CANONICAL: Record<string, string> = {
  // statements
  responsecondition: 'stmt.responseCondition',
  outcomecondition: 'stmt.outcomeCondition',
  templatecondition: 'stmt.templateCondition',
  setoutcomevalue: 'stmt.setOutcomeValue',
  settemplatevalue: 'stmt.setTemplateValue',
  setresponsevalue: 'stmt.setResponseValue',
  setcorrectresponse: 'stmt.setCorrectResponse',
  setdefaultvalue: 'stmt.setDefaultValue',
  exitresponse: 'stmt.exitResponse',
  exittemplate: 'stmt.exitTemplate',
  exittest: 'stmt.exitTest',
  templateconstraint: 'stmt.templateConstraint',
  lookupoutcomevalue: 'stmt.lookupOutcomeValue',

  // expressions (core)
  basevalue: 'expr.baseValue',
  variable: 'expr.variable',
  correct: 'expr.correct',
  null: 'expr.null',
  default: 'expr.default',

  // boolean / comparison
  and: 'expr.and',
  or: 'expr.or',
  not: 'expr.not',
  equal: 'expr.equal',
  notequal: 'expr.notEqual',
  gt: 'expr.gt',
  gte: 'expr.gte',
  lt: 'expr.lt',
  lte: 'expr.lte',
  alln: 'expr.allN',
  anyn: 'expr.anyN',
  member: 'expr.member',
  contains: 'expr.contains',
  isnull: 'expr.isNull',
  isnotnull: 'expr.isNotNull',
  stringmatch: 'expr.stringMatch',
  patternmatch: 'expr.patternMatch',
  equalrounded: 'expr.equalRounded',

  // math
  sum: 'expr.sum',
  product: 'expr.product',
  subtract: 'expr.subtract',
  divide: 'expr.divide',
  max: 'expr.max',
  min: 'expr.min',
  round: 'expr.round',
  truncate: 'expr.truncate',
  roundto: 'expr.roundTo',
  mathconstant: 'expr.mathConstant',
  mathoperator: 'expr.mathOperator',
  gcd: 'expr.gcd',
  lcm: 'expr.lcm',
  integermodulus: 'expr.integerModulus',
  integertofloat: 'expr.integerToFloat',

  // mapping / tables
  mapresponse: 'expr.mapResponse',
  mapoutcome: 'expr.mapOutcome',
  mapresponsepoint: 'expr.mapResponsePoint',
  lookuptable: 'expr.lookupTable',

  // newer / misc
  delete: 'expr.delete',
  repeat: 'expr.repeat',
  durationlt: 'expr.durationLT',
  durationgte: 'expr.durationGTE',
  inside: 'expr.inside',
  statsoperator: 'expr.statsOperator',
  random: 'expr.random',
  randominteger: 'expr.randomInteger',
  randomfloat: 'expr.randomFloat',
  precondition: 'expr.preCondition',
  customoperator: 'expr.customOperator',
  fieldvalue: 'expr.fieldValue',
  record: 'expr.record',
};

function stableJson(obj: unknown) {
  return JSON.stringify(obj, null, 2) + '\n';
}

function normalizeTag(s: string): string {
  return s.trim().toLowerCase();
}

async function main() {
  const dirs = (await readdir(fixturesRoot, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => join(fixturesRoot, d.name))
    .sort();

  let changed = 0;
  for (const d of dirs) {
    const manifestPath = join(d, 'manifest.json');
    let raw: string;
    try {
      raw = await readFile(manifestPath, 'utf8');
    } catch {
      continue; // optional
    }

    const manifest = JSON.parse(raw) as Manifest;
    const covers = Array.isArray(manifest.covers) ? manifest.covers.slice() : [];

    const extra: string[] = [];
    for (const c of covers) {
      const k = normalizeTag(c);
      const mapped = CANONICAL[k];
      if (mapped) extra.push(mapped);
    }

    const next = Array.from(new Set([...covers, ...extra])).sort((a, b) => a.localeCompare(b));
    const same =
      covers.length === next.length &&
      covers.every((v, i) => v === next[i]);

    if (!same) {
      manifest.covers = next;
      await writeFile(manifestPath, stableJson(manifest), 'utf8');
      changed++;
    }
  }

  // eslint-disable-next-line no-console
  console.log(`normalize-covers: updated ${changed} manifest(s)`);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});


