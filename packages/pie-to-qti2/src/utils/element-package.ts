/**
 * Element package resolution
 *
 * Delivered PIE items name each model's element by its custom-element tag
 * (`pie-multiple-choice`) and map the tag to a versioned package in
 * `config.elements`. Generators and the passage and rubric filters are keyed by
 * package id (`@pie-element/multiple-choice`), so each model is resolved once,
 * before either sees it.
 */

import type { PieModel } from '@pie-qti/transform-types';

/**
 * Strip the version from a package spec: `@pie-element/x@1.2.3` -> `@pie-element/x`.
 */
export function packageName(packageSpec: string): string {
  const searchFrom = packageSpec.startsWith('@') ? packageSpec.indexOf('/') + 1 : 1;
  const versionAt = packageSpec.indexOf('@', searchFrom);
  return versionAt > 0 ? packageSpec.slice(0, versionAt) : packageSpec;
}

/**
 * The package id for a model's element: its `config.elements` entry when the
 * element is a mapped tag, otherwise the element itself without a version.
 * Older items key `config.elements` by package id and map it to a bare version
 * (`'@pie-element/x': '1.0.0'`); those entries name no package and are skipped.
 */
export function resolveElementPackage(
  element: string | undefined,
  elements?: Record<string, string>
): string | undefined {
  if (!element) {
    return element;
  }
  const mapped = elements && Object.hasOwn(elements, element) ? elements[element] : undefined;
  return packageName(typeof mapped === 'string' && isPackageSpec(mapped) ? mapped : element);
}

function isPackageSpec(value: string): boolean {
  return /^(@[^/@\s]+\/)?[a-z][^@\s]*(@.*)?$/i.test(value) && value !== 'latest';
}

/**
 * Copies of the models with `element` set to the resolved package id.
 */
export function withResolvedPackages(models: PieModel[], elements?: Record<string, string>): PieModel[] {
  return models.map((model) => {
    const element = resolveElementPackage(model.element, elements);
    return element === model.element ? model : { ...model, element };
  });
}
