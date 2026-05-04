import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const SAMPLE_PATH = ['packages', 'to-pie', 'tests', 'fixtures', 'qti-samples'];

export function getQtiSampleRoot(): string {
	const candidates = [
		resolve(process.cwd(), ...SAMPLE_PATH),
		resolve(process.cwd(), '..', '..', ...SAMPLE_PATH),
	];

	return candidates.find((path) => existsSync(path)) ?? candidates[0];
}
