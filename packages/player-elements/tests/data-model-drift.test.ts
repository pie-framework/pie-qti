/**
 * Runtime walk of the data-model drift pins: for every contract interface in
 * @pie-qti/section-player's contract files and this package's parsed-assessment
 * sources, the reviewed mapping in tests/data-model-contracts.ts names the
 * facade mirror (src/public/api.ts, or the runtime element file for event
 * details) that must carry each of its members. A mirror that drops — or a
 * contract that gains — a field fails here, and an exported contract interface
 * that is in neither the mirror table nor the documented re-export pins fails
 * too, so a new contract type cannot ship without an explicit facade decision.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import {
	DATA_MODEL_MIRRORS,
	type DataModelMirrorPin,
	PARSED_TYPE_SOURCES,
	PINNED_BY_REEXPORT,
	SECTION_CONTRACT_SOURCES,
} from './data-model-contracts.js';

const API_SOURCE = '../src/public/api.ts';

function readSource(relativePath: string): string {
	return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

/**
 * Member names of an interface or object-literal type alias, in declaration
 * order. Comments are stripped first (contract docs contain semicolons), then
 * the body is split into top-level statements so multi-line method signatures
 * contribute only the member's own name, never a parameter line.
 */
function extractMemberNames(source: string, name: string): string[] {
	const declaration = new RegExp(`\\b(?:interface|type) ${name}\\b`).exec(source);
	if (!declaration) {
		throw new Error(`No type declaration named ${name} found`);
	}
	const bodyStart = source.indexOf('{', declaration.index + declaration[0].length);
	if (bodyStart === -1) {
		throw new Error(`Type ${name} has no object-literal body`);
	}
	let depth = 0;
	let bodyEnd = bodyStart;
	for (; bodyEnd < source.length; bodyEnd++) {
		const character = source[bodyEnd];
		if (character === '{') depth++;
		else if (character === '}') {
			depth--;
			if (depth === 0) break;
		}
	}
	const withoutComments = source
		.slice(bodyStart + 1, bodyEnd)
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/\/\/[^\n]*/g, '');

	const members: string[] = [];
	let statementStart = -1;
	let statementDepth = 0;
	for (let index = 0; index < withoutComments.length; index++) {
		const character = withoutComments[index];
		if (character === '(' || character === '{') statementDepth++;
		else if (character === ')' || character === '}') statementDepth--;
		else if (character === ';' && statementDepth === 0) {
			const statement = withoutComments.slice(statementStart + 1, index);
			const member = /^\s*(?:readonly\s+)?([A-Za-z_$][\w$]*)/.exec(statement);
			if (member) members.push(member[1]!);
			statementStart = index;
		}
	}
	return members;
}

describe('every contract interface has an explicit facade decision', () => {
	for (const source of [...SECTION_CONTRACT_SOURCES, ...PARSED_TYPE_SOURCES]) {
		test(`${source} exports no interface outside the mirror and re-export tables`, () => {
			const text = readSource(source);
			const exported = [...text.matchAll(/^export interface (\w+)/gm)].map((match) => match[1]!);
			const mapped = new Set(
				DATA_MODEL_MIRRORS.filter((pin: DataModelMirrorPin) => pin.contractSource === source).map(
					(pin) => pin.contract,
				),
			);
			const undecided = exported.filter((name) => !mapped.has(name) && !(name in PINNED_BY_REEXPORT));
			expect(undecided).toEqual([]);
		});
	}
});

describe('facade mirrors carry every contract member', () => {
	for (const pin of DATA_MODEL_MIRRORS) {
		test(`${pin.contractSource} ${pin.contract} members all appear on ${pin.mirror}`, () => {
			const contractMembers = extractMemberNames(readSource(pin.contractSource), pin.contract);
			expect(contractMembers.length, 'contract members were extracted').toBeGreaterThan(0);
			const mirrorMembers = extractMemberNames(readSource(pin.mirrorSource ?? API_SOURCE), pin.mirror);
			const missing = contractMembers.filter((member) => !mirrorMembers.includes(member));
			expect(missing).toEqual([]);
		});
	}
});
