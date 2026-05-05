import { describe, expect, test } from 'bun:test';
import { parse } from 'node-html-parser';
import type { AssetResolver, CssClassExtractor } from '../src/types/vendor-extensions';
import {
  extractCssClassesWithHooks,
  resolveAssetWithHooks,
} from '../src/vendor-extension-runtime';

describe('vendor extension runtime', () => {
  test('resolves assets with the first resolver that can handle the URL', async () => {
    const calls: string[] = [];
    const resolvers: AssetResolver[] = [
      {
        name: 'first',
        canResolve(assetType, assetUrl) {
          calls.push(`first:${assetType}:${assetUrl}`);
          return false;
        },
        async resolve() {
          throw new Error('should not resolve');
        },
      },
      {
        name: 'second',
        canResolve(assetType, assetUrl) {
          calls.push(`second:${assetType}:${assetUrl}`);
          return true;
        },
        async resolve(assetType, assetUrl, baseDir) {
          return {
            url: assetUrl,
            content: `${assetType}:${baseDir}`,
            mimeType: 'text/css',
          };
        },
      },
      {
        name: 'third',
        canResolve() {
          calls.push('third');
          return true;
        },
        async resolve() {
          throw new Error('should not reach later resolvers');
        },
      },
    ];

    const resolved = await resolveAssetWithHooks({
      resolvers,
      assetType: 'stylesheet',
      assetUrl: 'theme.css',
      baseDir: '/content',
    });

    expect(resolved).toEqual({
      url: 'theme.css',
      content: 'stylesheet:/content',
      mimeType: 'text/css',
    });
    expect(calls).toEqual(['first:stylesheet:theme.css', 'second:stylesheet:theme.css']);
  });

  test('returns null when no asset resolver matches', async () => {
    const resolved = await resolveAssetWithHooks({
      resolvers: [
        {
          name: 'no-match',
          canResolve: () => false,
          async resolve() {
            throw new Error('should not resolve');
          },
        },
      ],
      assetType: 'image',
      assetUrl: 'img.png',
      baseDir: '/content',
    });

    expect(resolved).toBeNull();
  });

  test('surfaces resolve failures from the first matching asset resolver', async () => {
    await expect(
      resolveAssetWithHooks({
        resolvers: [
          {
            name: 'broken',
            canResolve: () => true,
            async resolve() {
              throw new Error('asset unavailable');
            },
          },
        ],
        assetType: 'image',
        assetUrl: 'img.png',
        baseDir: '/content',
      })
    ).rejects.toThrow('asset unavailable');
  });

  test('extracts CSS classes with extractors matching the detected vendor', () => {
    const doc = parse(`
      <assessmentItem>
        <itemBody>
          <div class="acme-input-large acme-theme-blue other-class">Prompt</div>
        </itemBody>
      </assessmentItem>
    `);
    const extractors: CssClassExtractor[] = [
      {
        vendor: 'other',
        extract() {
          throw new Error('wrong vendor');
        },
      },
      {
        vendor: 'acme',
        extract(element) {
          const classes = element.getAttribute('class')?.split(/\s+/) ?? [];
          return {
            behavioral: classes.filter((className) => className.startsWith('acme-input-')),
            styling: classes.filter((className) => className.startsWith('acme-theme-')),
            semantic: [],
            unknown: classes.filter((className) => className === 'other-class'),
          };
        },
      },
    ];

    const extracted = extractCssClassesWithHooks({
      extractors,
      root: doc,
      vendorInfo: { vendor: 'acme', confidence: 0.9 },
    });

    expect(extracted).toHaveLength(1);
    expect(extracted[0].vendor).toBe('acme');
    expect(extracted[0].elementName).toBe('div');
    expect(extracted[0].classes).toEqual(['acme-input-large', 'acme-theme-blue', 'other-class']);
    expect(extracted[0].categorized).toEqual({
      behavioral: ['acme-input-large'],
      styling: ['acme-theme-blue'],
      semantic: [],
      unknown: ['other-class'],
    });
  });

  test('returns no CSS class extractions without detected vendor info', () => {
    const doc = parse('<assessmentItem><div class="acme-input-large"/></assessmentItem>');

    const extracted = extractCssClassesWithHooks({
      extractors: [
        {
          vendor: 'acme',
          extract() {
            throw new Error('should not extract without vendor info');
          },
        },
      ],
      root: doc,
      vendorInfo: null,
    });

    expect(extracted).toEqual([]);
  });
});
