/**
 * Runtime walk of the data-model drift pins. Two families:
 *
 * (a) Section contracts: for every contract type in tests/data-model-contracts.ts's
 *     SECTION_CONTRACT_ALIASES, the facade (src/public/api.ts) must publish the
 *     type under its own contract name as a direct `import('@pie-qti/section-player')`
 *     alias — NAME parity, not just member parity — and must not hand-copy it under
 *     any name. Every exported contract interface must appear in the alias table or
 *     the documented not-published table, so a new contract type cannot ship
 *     without an explicit facade decision.
 *
 * (b) Parsed-assessment types: for every contract interface in this package's
 *     parsed-assessment sources, the reviewed mapping in DATA_MODEL_MIRRORS names
 *     the facade mirror that must carry each of its members. A mirror that drops —
 *     or a contract that gains — a field fails here.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import {
	DATA_MODEL_MIRRORS,
	type DataModelMirrorPin,
	ITEM_PLAYER_CONTRACT_ALIASES,
	PARSED_TYPE_SOURCES,
	PINNED_BY_REEXPORT,
	SECTION_CONTRACT_ALIASES,
	SECTION_CONTRACT_NOT_PUBLISHED,
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
	for (const source of SECTION_CONTRACT_SOURCES) {
		test(`${source} exports no interface outside the alias and not-published tables`, () => {
			const text = readSource(source);
			const exported = [...text.matchAll(/^export interface (\w+)/gm)].map((match) => match[1]!);
			const aliased = new Set(SECTION_CONTRACT_ALIASES);
			const undecided = exported.filter(
				(name) => !aliased.has(name) && !(name in SECTION_CONTRACT_NOT_PUBLISHED),
			);
			expect(undecided).toEqual([]);
		});
	}

	for (const source of PARSED_TYPE_SOURCES) {
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

describe('section contract names are published at parity', () => {
	test('every alias table entry names a type the contract files actually export', () => {
		const contractText = SECTION_CONTRACT_SOURCES.map((source) => readSource(source)).join('\n');
		const phantom = SECTION_CONTRACT_ALIASES.filter(
			(name) => !new RegExp(`\\bexport (?:interface|type) ${name}\\b`).exec(contractText),
		);
		expect(phantom).toEqual([]);
	});

	test('api.ts aliases each section contract type under its own name', () => {
		const apiText = readSource(API_SOURCE);
		const drifted = SECTION_CONTRACT_ALIASES.filter(
			(name) =>
				!new RegExp(
					`export type ${name}\\s*=\\s*import\\('@pie-qti/section-player'\\)\\.${name}\\s*;`,
				).exec(apiText),
		);
		expect(drifted).toEqual([]);
	});

	test('api.ts hand-copies no section contract type under any name', () => {
		const apiText = readSource(API_SOURCE);
		const handCopied = SECTION_CONTRACT_ALIASES.filter((name) =>
			new RegExp(`\\bexport interface ${name}\\b`).exec(apiText),
		);
		expect(handCopied).toEqual([]);
	});
});

describe('item-player contract names are published at parity', () => {
	test('api.ts aliases each item-player contract type to its exact upstream', () => {
		const apiText = readSource(API_SOURCE);
		const drifted = ITEM_PLAYER_CONTRACT_ALIASES.filter(
			({ facade, upstream, from }) =>
				!new RegExp(`export type ${facade}\\s*=\\s*import\\('${from}'\\)\\.${upstream}\\s*;`).exec(apiText),
		);
		expect(drifted).toEqual([]);
	});

	test('api.ts hand-copies no item-player contract type under any name', () => {
		const apiText = readSource(API_SOURCE);
		const handCopied = ITEM_PLAYER_CONTRACT_ALIASES.filter(({ facade }) =>
			new RegExp(`\\bexport interface ${facade}\\b`).exec(apiText),
		);
		expect(handCopied).toEqual([]);
	});
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
