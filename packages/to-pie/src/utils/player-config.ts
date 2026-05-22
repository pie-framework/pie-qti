import type { PieItem, PieModel } from '@pie-qti/transform-types';

export function makePieItemPlayerReady(pieItem: PieItem): PieItem {
  const config = pieItem.config;
  const models = config.models.map((model) => normalizeModelElement(model, config.elements));
  const markup = typeof config.markup === 'string' && config.markup.trim()
    ? config.markup
    : markupFromModels(models, config.elements);

  return {
    ...pieItem,
    config: {
      ...config,
      models,
      markup,
    },
  };
}

function normalizeModelElement(model: PieModel, elements: Record<string, string>): PieModel {
  const element = typeof model.element === 'string' ? model.element : null;
  if (!element || Object.hasOwn(elements, element)) {
    return model;
  }

  const elementTag = elementTagForPackage(elements, packageName(element));
  return elementTag ? { ...model, element: elementTag } : model;
}

function elementTagForPackage(elements: Record<string, string>, modelPackageName: string) {
  return Object.entries(elements).find(([, packageSpec]) =>
    packageName(packageSpec) === modelPackageName
  )?.[0];
}

function markupFromModels(models: PieModel[], elements: Record<string, string>) {
  return models
    .map((model) => {
      const element = typeof model.element === 'string' ? model.element : null;
      const id = typeof model.id === 'string' ? model.id : null;
      if (!element || !id || !Object.hasOwn(elements, element)) {
        return null;
      }
      return `<${element} id="${escapeAttribute(id)}"></${element}>`;
    })
    .filter((entry): entry is string => Boolean(entry))
    .join('');
}

function packageName(packageSpec: string) {
  if (!packageSpec.startsWith('@')) {
    const versionAt = packageSpec.indexOf('@');
    return versionAt > 0 ? packageSpec.slice(0, versionAt) : packageSpec;
  }

  const scopeSeparatorAt = packageSpec.indexOf('/');
  const versionAt = packageSpec.indexOf('@', scopeSeparatorAt + 1);
  return versionAt > 0 ? packageSpec.slice(0, versionAt) : packageSpec;
}

function escapeAttribute(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
