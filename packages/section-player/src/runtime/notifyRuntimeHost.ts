import type {
  QtiSectionFrameworkError,
  QtiSectionResponseDeltaEvent,
  ResolvedQtiSectionComposition,
} from '../contracts/index.js';

export function notifyResponseDelta(
  composition: ResolvedQtiSectionComposition,
  itemIdentifier: string,
  responseIdentifier: string,
  value: unknown
): QtiSectionResponseDeltaEvent {
  const event: QtiSectionResponseDeltaEvent = {
    sectionIdentifier: composition.section.identifier,
    itemIdentifier,
    responseIdentifier,
    value,
  };
  composition.host?.onResponseDelta?.(event);
  return event;
}

export function notifyActiveItemChange(composition: ResolvedQtiSectionComposition) {
  composition.host?.onActiveItemChange?.({
    sectionIdentifier: composition.section.identifier,
    itemIdentifier: composition.activeItem.identifier,
    itemIndex: composition.activeItemIndex,
    itemCount: composition.section.itemRefs.length,
  });
}

export function notifySnapshotChange(composition: ResolvedQtiSectionComposition) {
  composition.host?.onSnapshotChange?.(composition.snapshot);
}

export function notifyFrameworkError(
  composition: ResolvedQtiSectionComposition,
  error: QtiSectionFrameworkError
): QtiSectionFrameworkError {
  const event: QtiSectionFrameworkError = {
    ...error,
    sectionIdentifier: error.sectionIdentifier ?? composition.section.identifier,
    itemIdentifier: error.itemIdentifier ?? composition.activeItem.identifier,
  };
  composition.host?.onFrameworkError?.(event);
  return event;
}
