#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const matrixPath = join(repoRoot, 'docs/certification/public-coverage-matrix.json');

const skipE2e = process.env.PIE_QTI_PUBLIC_CERT_SKIP_E2E === '1' || process.argv.includes('--skip-e2e');
const skipPrebuild =
	process.env.PIE_QTI_PUBLIC_CERT_SKIP_PREBUILD === '1' || process.argv.includes('--skip-prebuild');
const listOnly = process.argv.includes('--list');

function isBrowserCommand(command) {
	return command.id?.startsWith('browser-');
}

function fail(message) {
	console.error(`\n[public-certification] ${message}`);
	process.exit(1);
}

function readMatrix() {
	if (!existsSync(matrixPath)) fail(`Missing coverage matrix: ${matrixPath}`);
	return JSON.parse(readFileSync(matrixPath, 'utf8'));
}

function pathExists(relativePath) {
	return existsSync(join(repoRoot, relativePath));
}

function assertNoOfficialPublicArtifacts() {
	const conformanceDir = join(repoRoot, 'apps/demo/static/conformance');
	if (!existsSync(conformanceDir)) return;

	const stack = [conformanceDir];
	const zipFiles = [];
	while (stack.length) {
		const dir = stack.pop();
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) stack.push(full);
			else if (entry.name.endsWith('.zip')) zipFiles.push(full);
		}
	}

	if (zipFiles.length > 0) {
		fail(`Public demo still contains conformance ZIP artifacts:\n${zipFiles.join('\n')}`);
	}
}

function validateMatrix(matrix) {
	const commandIds = new Set((matrix.commands ?? []).map((command) => command.id));
	const errors = [];

	for (const row of matrix.rows ?? []) {
		if (!row.id) errors.push('A matrix row is missing id.');
		if (!row.version || !row.feature) errors.push(`${row.id}: missing version or feature.`);
		if (!Array.isArray(row.publicTests) || row.publicTests.length === 0) {
			errors.push(`${row.id}: missing publicTests.`);
		}
		for (const testPath of row.publicTests ?? []) {
			if (testPath.includes('qti-conformance')) {
				errors.push(`${row.id}: publicTests must not reference qti-conformance (${testPath}).`);
			}
			if (!pathExists(testPath)) {
				errors.push(`${row.id}: referenced public test does not exist: ${testPath}`);
			}
		}
		for (const fixturePath of row.fixturePackages ?? []) {
			if (!pathExists(fixturePath)) errors.push(`${row.id}: referenced fixture does not exist: ${fixturePath}`);
			if (!pathExists(join(fixturePath, 'manifest.json'))) {
				errors.push(`${row.id}: fixture is missing provenance manifest: ${fixturePath}/manifest.json`);
			}
		}
		for (const commandId of row.commandIds ?? []) {
			if (!commandIds.has(commandId)) errors.push(`${row.id}: unknown commandId ${commandId}.`);
		}
		if (row.e2eRequired && !(row.commandIds ?? []).includes('browser-visible')) {
			errors.push(`${row.id}: e2eRequired rows must include browser-visible command.`);
		}
	}

	if (errors.length > 0) fail(`Coverage matrix validation failed:\n${errors.map((e) => `- ${e}`).join('\n')}`);
}

function runCommand(command) {
	return new Promise((resolveCommand, rejectCommand) => {
		const cwd = join(repoRoot, command.cwd ?? '.');
		console.log(`\n[public-certification] ${command.description}`);
		console.log(`[public-certification] $ bun ${command.args.join(' ')}`);

		const child = spawn('bun', command.args, {
			cwd,
			stdio: 'inherit',
			env: process.env,
		});
		child.on('error', rejectCommand);
		child.on('close', (code) => {
			if (code === 0) resolveCommand();
			else rejectCommand(new Error(`${command.id} failed with exit code ${code}`));
		});
	});
}

const matrix = readMatrix();
validateMatrix(matrix);
assertNoOfficialPublicArtifacts();

const skippedBrowserCommands = skipE2e ? (matrix.commands ?? []).filter(isBrowserCommand) : [];
const commands = (matrix.commands ?? []).filter((command) => !(skipE2e && isBrowserCommand(command)));

console.log(`[public-certification] Matrix rows: ${matrix.rows.length}`);
console.log(`[public-certification] Commands: ${commands.map((command) => command.id).join(', ')}`);
if (skipE2e) {
	console.log(
		`[public-certification] Browser-backed commands skipped by request: ${skippedBrowserCommands.map((command) => command.id).join(', ')}`
	);
}

if (!listOnly) {
	if (!skipPrebuild) {
		await runCommand({
			id: 'workspace-prebuild',
			description: 'Build workspace packages needed by certification tests',
			args: [
				'x',
				'turbo',
				'build',
				'--filter=@pie-qti/logger',
				'--filter=@pie-qti/qti-common',
				'--filter=@pie-qti/qti-processing',
				'--filter=@pie-qti/ims-cp-core',
				'--filter=@pie-qti/ims-cp-browser',
				'--filter=@pie-qti/i18n',
				'--filter=@pie-qti/typeset-katex',
				'--filter=@pie-qti/item-player',
				'--filter=@pie-qti/default-components',
				'--filter=@pie-qti/assessment-player',
				'--filter=@pie-qti/player-elements',
				'--filter=@pie-qti/theme-daisyui',
				'--filter=@pie-qti/web-component-loaders',
				'--filter=@acme/likert-scale-plugin',
			],
		});
	}
	for (const command of commands) {
		await runCommand(command);
	}
}

console.log('\n[public-certification] Public QTI certification gate passed.');
