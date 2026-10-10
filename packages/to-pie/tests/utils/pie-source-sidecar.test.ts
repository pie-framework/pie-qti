import { describe, expect, test } from 'bun:test';
import { PIE_SOURCE_SIDECAR_FORMAT } from '@pie-qti/transform-types';
import { findPieSourceSidecarPath, readPieSourceSidecar } from '../../src/utils/pie-source-sidecar';

const sidecar = {
  format: PIE_SOURCE_SIDECAR_FORMAT,
  version: 1,
  sourceModel: { id: 'item-1', config: { models: [] } },
};

describe('readPieSourceSidecar', () => {
  test('reads a parsed sidecar and its JSON text', () => {
    expect(readPieSourceSidecar(sidecar)?.sourceModel.id).toBe('item-1');
    expect(readPieSourceSidecar(JSON.stringify(sidecar))?.sourceModel.id).toBe('item-1');
  });

  test('rejects values that do not match the contract', () => {
    expect(readPieSourceSidecar(null)).toBeNull();
    expect(readPieSourceSidecar('{"format": "pie-qti/pie-source"')).toBeNull();
    expect(readPieSourceSidecar({ ...sidecar, format: 'other' })).toBeNull();
    expect(readPieSourceSidecar({ ...sidecar, version: 2 })).toBeNull();
    expect(readPieSourceSidecar({ ...sidecar, sourceModel: [] })).toBeNull();
  });
});

describe('findPieSourceSidecarPath', () => {
  test('finds the .pie.json among a resource files', () => {
    expect(findPieSourceSidecarPath(['items/a.xml', 'items/a.pie.json'])).toBe('items/a.pie.json');
    expect(findPieSourceSidecarPath(['items/a.xml', 'items/a.json'])).toBeUndefined();
  });
});
