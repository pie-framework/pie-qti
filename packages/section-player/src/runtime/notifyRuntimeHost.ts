import type { PnpProfile } from '@pie-qti/item-player';
import type {
  QtiSectionDisplaySettingsEvent,
  QtiSectionFrameworkError,
  QtiSectionResponseDeltaEvent,
  ResolvedQtiSectionComposition,
} from '../contracts/index.js';
import type { QtiCandidateDisplaySettings } from '../tools/display-settings.js';

/**
 * Delivers one occurrence through one channel: the composition host contract's
 * callback when the host supplies one, otherwise the layout's callback prop.
 * The channels are alternatives, not both-firing — a host that supplies the
 * host contract and also listens to a custom element's DOM events (which the
 * elements wire to the layout's callback props) hears each occurrence once.
 */
function deliverOnce<T>(
  throughHost: ((event: T) => void) | undefined,
  fallback: ((event: T) => void) | undefined,
  event: T,
): void {
  if (throughHost) throughHost(event);
  else fallback?.(event);
}

export function notifyResponseDelta(
  composition: ResolvedQtiSectionComposition,
  itemIdentifier: string,
  responseIdentifier: string,
  value: unknown,
  /** The layout's callback prop, used when the host contract carries no `onResponseDelta`. */
  fallback?: (event: QtiSectionResponseDeltaEvent) => void
): QtiSectionResponseDeltaEvent {
  const event: QtiSectionResponseDeltaEvent = {
    sectionIdentifier: composition.section.identifier,
    itemIdentifier,
    responseIdentifier,
    value,
  };
  deliverOnce(composition.host?.onResponseDelta, fallback, event);
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
  error: QtiSectionFrameworkError,
  /** The layout's callback prop, used when the host contract carries no `onFrameworkError`. */
  fallback?: (event: QtiSectionFrameworkError) => void
): QtiSectionFrameworkError {
  const event: QtiSectionFrameworkError = {
    ...error,
    sectionIdentifier: error.sectionIdentifier ?? composition.section.identifier,
    itemIdentifier: error.itemIdentifier ?? composition.activeItem.identifier,
  };
  deliverOnce(composition.host?.onFrameworkError, fallback, event);
  return event;
}

/** The candidate changed their display settings; `pnp` is the profile the section now renders with. */
export function notifyDisplaySettingsChange(
  composition: ResolvedQtiSectionComposition,
  settings: QtiCandidateDisplaySettings,
  pnp: PnpProfile,
  /** The layout's callback prop, used when the host contract carries no `onDisplaySettingsChange`. */
  fallback?: (event: QtiSectionDisplaySettingsEvent) => void
): QtiSectionDisplaySettingsEvent {
  const event: QtiSectionDisplaySettingsEvent = {
    sectionIdentifier: composition.section.identifier,
    settings: { ...settings },
    pnp,
  };
  deliverOnce(composition.host?.onDisplaySettingsChange, fallback, event);
  return event;
}
