import type { PnpProfile } from '@pie-qti/item-player';
import type {
  QtiSectionDisplaySettingsEvent,
  QtiSectionFrameworkError,
  QtiSectionResponseDeltaEvent,
  ResolvedQtiSectionComposition,
} from '../contracts/index.js';
import type { QtiCandidateDisplaySettings } from '../tools/display-settings.js';

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

/** The candidate changed their display settings; `pnp` is the profile the section now renders with. */
export function notifyDisplaySettingsChange(
  composition: ResolvedQtiSectionComposition,
  settings: QtiCandidateDisplaySettings,
  pnp: PnpProfile
): QtiSectionDisplaySettingsEvent {
  const event: QtiSectionDisplaySettingsEvent = {
    sectionIdentifier: composition.section.identifier,
    settings: { ...settings },
    pnp,
  };
  composition.host?.onDisplaySettingsChange?.(event);
  return event;
}
