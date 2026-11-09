import { describe, expect, test } from 'bun:test';
import { pciEntryModule, resolvePciModuleUrl } from '../../src/pci/modulePaths.js';
import type { ExtractedPci } from '../../src/pci/types.js';

const pciWith = (modules: ExtractedPci['modules'], primaryPath = modules[0]?.primaryPath ?? '') =>
	({
		responseIdentifier: 'RESPONSE',
		customInteractionTypeIdentifier: 'urn:acme:pci',
		primaryPath,
		fallbackPath: undefined,
		modules,
		resolutionConfigPath: undefined,
		markup: '<div/>',
		config: {},
	}) as ExtractedPci;

describe('resolvePciModuleUrl', () => {
	test('keeps scheme-qualified, protocol-relative, root-relative and absolute authored paths', () => {
		expect(resolvePciModuleUrl('https://cdn.test/pci.js', '/pkg/')).toBe('https://cdn.test/pci.js');
		expect(resolvePciModuleUrl('//cdn.test/pci.js', '/pkg/')).toBe('//cdn.test/pci.js');
		expect(resolvePciModuleUrl('/pkg/pci.js', 'https://host.test/base/')).toBe('/pkg/pci.js');
		expect(resolvePciModuleUrl('mailto:pci@test', '/pkg/')).toBe('mailto:pci@test');
	});

	test('resolves relative paths against the package base URL', () => {
		expect(resolvePciModuleUrl('pci.js', 'https://host.test/pkg/')).toBe('https://host.test/pkg/pci.js');
		expect(resolvePciModuleUrl('pci.js', 'https://host.test/pkg')).toBe('https://host.test/pkg/pci.js');
		expect(resolvePciModuleUrl('./a/pci.js', 'https://host.test/pkg/')).toBe(
			'https://host.test/pkg/a/pci.js',
		);
	});

	test('without a usable base, relative paths are returned as authored', () => {
		expect(resolvePciModuleUrl('pci.js', '')).toBe('pci.js');
		expect(resolvePciModuleUrl('pci.js', 'not a url')).toBe('not a url/pci.js');
	});
});

describe('pciEntryModule', () => {
	const entry = { id: 'pci-entry', primaryPath: 'entry.js', fallbackPath: 'entry-fallback.js' };
	const helper = { id: 'pci-helper', primaryPath: 'helper.js' };

	test('is the authored module whose primary path the interaction references', () => {
		expect(pciEntryModule(pciWith([helper, entry], 'entry.js'))).toBe(entry);
	});

	test('is the last authored module when no module matches the primary reference', () => {
		expect(pciEntryModule(pciWith([helper], 'missing.js'))).toBe(helper);
		expect(pciEntryModule(pciWith([], ''))).toBeUndefined();
	});
});
