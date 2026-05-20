import { describe, expect, test } from 'bun:test';
import {
	dirnamePackagePath,
	isExternalPackageHref,
	isPackageRelativeHref,
	resolveCheckedPackagePathFromFile,
	resolvePackagePath,
	resolvePackagePathFromFile,
} from '../src/package-path';

describe('IMS CP package path resolution', () => {
	test('normalizes package paths with manifest-style base directories', () => {
		expect(resolvePackagePath('content/items', './images/../item.xml')).toBe('content/items/item.xml');
		expect(resolvePackagePath('content/items', '/shared/passage.xml')).toBe('shared/passage.xml');
		expect(resolvePackagePath('content/items', '..\\assets\\chart.png')).toBe('content/assets/chart.png');
	});

	test('resolves hrefs relative to source files', () => {
		expect(resolvePackagePathFromFile('items/item.xml', 'images/chart.png')).toBe('items/images/chart.png');
		expect(resolvePackagePathFromFile('tests/test.xml', '../items/item.xml')).toBe('items/item.xml');
		expect(dirnamePackagePath('tests/unit/test.xml')).toBe('tests/unit');
	});

	test('checked resolution rejects hrefs that escape the package root', () => {
		expect(resolveCheckedPackagePathFromFile('items/item.xml', '../shared/passage.xml')).toBe('shared/passage.xml');
		expect(resolveCheckedPackagePathFromFile('item.xml', '../outside.xml')).toBeNull();
		expect(resolveCheckedPackagePathFromFile('item.xml', 'http://example.com/item.xml')).toBeNull();
	});

	test('classifies package-relative and external hrefs', () => {
		expect(isPackageRelativeHref('items/item.xml')).toBe(true);
		expect(isPackageRelativeHref('/items/item.xml')).toBe(false);
		expect(isPackageRelativeHref('https://example.com/item.xml')).toBe(false);
		expect(isExternalPackageHref('#fragment')).toBe(true);
		expect(isExternalPackageHref('//cdn.example.com/item.xml')).toBe(true);
	});
});
