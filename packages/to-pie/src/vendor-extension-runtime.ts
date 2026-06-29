import type { HTMLElement } from 'node-html-parser';
import type {
  AssetResolver,
  CssClassExtractor,
  ResolvedAsset,
  VendorClasses,
  VendorInfo,
} from './types/vendor-extensions.js';

export interface ResolveAssetWithHooksInput {
  resolvers: readonly AssetResolver[];
  assetType: string;
  assetUrl: string;
  baseDir: string;
}

export interface VendorCssClassExtraction {
  vendor: string;
  elementName: string;
  classes: string[];
  categorized: VendorClasses;
}

export interface ExtractCssClassesWithHooksInput {
  extractors: readonly CssClassExtractor[];
  root: HTMLElement;
  vendorInfo: VendorInfo | null;
}

export async function resolveAssetWithHooks({
  resolvers,
  assetType,
  assetUrl,
  baseDir,
}: ResolveAssetWithHooksInput): Promise<ResolvedAsset | null> {
  for (const resolver of resolvers) {
    let canResolve = false;

    try {
      canResolve = resolver.canResolve(assetType, assetUrl);
    } catch (error) {
      console.warn(`Asset resolver ${resolver.name} failed canResolve():`, error);
      continue;
    }

    if (canResolve) {
      return resolver.resolve(assetType, assetUrl, baseDir);
    }
  }

  return null;
}

export function extractCssClassesWithHooks({
  extractors,
  root,
  vendorInfo,
}: ExtractCssClassesWithHooksInput): VendorCssClassExtraction[] {
  if (!vendorInfo) {
    return [];
  }

  const vendorExtractors = extractors.filter((extractor) => extractor.vendor === vendorInfo.vendor);
  if (vendorExtractors.length === 0) {
    return [];
  }

  const elementsWithClasses = root
    .querySelectorAll('*')
    .filter((element) => Boolean(element.getAttribute('class')));
  const results: VendorCssClassExtraction[] = [];

  for (const element of elementsWithClasses) {
    for (const extractor of vendorExtractors) {
      try {
        const categorized = extractor.extract(element);
        if (hasAnyVendorClasses(categorized)) {
          results.push({
            vendor: extractor.vendor,
            elementName: getElementName(element),
            classes: splitClasses(element.getAttribute('class') ?? ''),
            categorized,
          });
        }
      } catch (error) {
        console.warn(`CSS class extractor ${extractor.vendor} failed:`, error);
      }
    }
  }

  return results;
}

function splitClasses(className: string): string[] {
  return className.split(/\s+/).filter(Boolean);
}

function hasAnyVendorClasses(classes: VendorClasses): boolean {
  return (
    classes.behavioral.length > 0 ||
    classes.styling.length > 0 ||
    classes.semantic.length > 0 ||
    classes.unknown.length > 0
  );
}

function getElementName(element: HTMLElement): string {
  return element.rawTagName || element.tagName || 'unknown';
}
