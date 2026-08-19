import { describe, expect, test } from 'bun:test';
import { getImageDimensionsFromBuffer } from '../../src/utils/image-utils';

/**
 * Crafted buffers that hang image-size's unpatched parsers (GHSA-w3rx-r6r6-pgpr,
 * GHSA-5p2g-fcmc-qvqq). image-utils disables those parsers, so these must return
 * rather than spin. Each test fails by timing out if the mitigation regresses.
 */
describe('getImageDimensionsFromBuffer with crafted input', () => {
  test('refuses an ICNS buffer with a zero-length entry, naming why', () => {
    const buf = Buffer.alloc(32);
    buf.write('icns', 0, 'ascii');
    buf.writeUInt32BE(32, 4); // file length
    buf.write('ic07', 8, 'ascii'); // entry type
    buf.writeUInt32BE(0, 12); // entry length of 0 never advances the offset

    const result = getImageDimensionsFromBuffer(buf);

    expect(result.dimensions).toBeNull();
    expect(result.reason).toContain('denial-of-service advisory');
  });

  test('refuses a JXL container with a zero-size box, naming why', () => {
    const buf = Buffer.alloc(48);
    buf.writeUInt32BE(12, 0); // signature box size
    buf.write('JXL ', 4, 'ascii');
    buf.writeUInt32BE(0x0d0a870a, 8);
    buf.writeUInt32BE(20, 12); // ftyp box size
    buf.write('ftyp', 16, 'ascii');
    buf.write('jxl ', 20, 'ascii'); // brand
    buf.writeUInt32BE(0, 32); // zero-size jxlp box never advances the offset
    buf.write('jxlp', 36, 'ascii');

    const result = getImageDimensionsFromBuffer(buf);

    expect(result.dimensions).toBeNull();
    expect(result.reason).toContain('denial-of-service advisory');
  });

  test('refuses a HEIF buffer with a zero-size box, naming why', () => {
    const buf = Buffer.alloc(40);
    buf.writeUInt32BE(20, 0); // ftyp box size
    buf.write('ftyp', 4, 'ascii');
    buf.write('heic', 8, 'ascii'); // brand
    buf.writeUInt32BE(0, 20); // zero-size meta box
    buf.write('meta', 24, 'ascii');

    const result = getImageDimensionsFromBuffer(buf);

    expect(result.dimensions).toBeNull();
    expect(result.reason).toContain('denial-of-service advisory');
  });

  test('still measures a supported format', () => {
    // 1x1 PNG
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
      'base64',
    );

    expect(getImageDimensionsFromBuffer(png)).toEqual({ dimensions: { width: 1, height: 1, type: 'png' } });
  });
});
