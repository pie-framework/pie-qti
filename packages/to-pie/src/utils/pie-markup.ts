/**
 * The PIE config's two-level element naming, and the markup that joins them.
 *
 * A PIE config names its elements twice: `elements` is keyed by the *tag* the markup uses
 * (`passage`) and holds a versioned package spec (`@pie-element/passage@latest`), while each
 * model's `element` is the *unversioned package name* (`@pie-element/passage`). Markup can only
 * be written in terms of the tag, so producing it means resolving one naming to the other.
 *
 * The composite conversion and a host assembling markup from a stored config share this one
 * resolution, so a config produced by one renders through the other.
 */

/** A package spec's name without its version, the form a model's `element` takes. */
export function piePackageName(packageSpec: string): string {
  if (!packageSpec.startsWith('@')) {
    const versionAt = packageSpec.indexOf('@');
    return versionAt > 0 ? packageSpec.slice(0, versionAt) : packageSpec;
  }

  const scopeSeparatorAt = packageSpec.indexOf('/');
  const versionAt = packageSpec.indexOf('@', scopeSeparatorAt + 1);
  return versionAt > 0 ? packageSpec.slice(0, versionAt) : packageSpec;
}

/**
 * The markup tag for a model's element, or `null` when `elements` declares nothing that could
 * render it. Matches on package name rather than on the spec string so a model keeps resolving
 * when the declared version changes.
 */
export function pieElementTagForModel(
  modelElement: string,
  elements: Record<string, string>
): string | null {
  if (Object.hasOwn(elements, modelElement)) {
    return modelElement;
  }
  const modelPackageName = piePackageName(modelElement);
  return (
    Object.entries(elements).find(
      ([, packageSpec]) => piePackageName(packageSpec) === modelPackageName
    )?.[0] ?? null
  );
}

/** Whether a model renders through the given PIE package. */
export function isPieModelOfPackage(
  model: Record<string, unknown>,
  elements: Record<string, string>,
  packageSpec: string
): boolean {
  const element = typeof model.element === 'string' ? model.element : null;
  if (!element) {
    return false;
  }
  return piePackageName(elements[element] ?? element) === piePackageName(packageSpec);
}

/**
 * The empty element a model is rendered by, `<passage id="…"></passage>`.
 *
 * Returns `null` for a model the config cannot render — no element, no id, or an element
 * `elements` never declared — because the callers differ on what that means: the composite
 * conversion treats it as a bug in its own output and throws, while a preview assembling
 * markup from a stored config drops the model.
 */
export function piePlaceholderMarkup(
  model: Record<string, unknown>,
  elements: Record<string, string>
): string | null {
  const element = typeof model.element === 'string' ? model.element : null;
  const id = typeof model.id === 'string' ? model.id : null;
  if (!element || !id) {
    return null;
  }
  const elementTag = pieElementTagForModel(element, elements);
  if (!elementTag) {
    return null;
  }
  return `<${elementTag} id="${escapePieAttribute(id)}"></${elementTag}>`;
}

export function escapePieAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
