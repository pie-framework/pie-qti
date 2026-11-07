export type QtiSectionDiagnosticSeverity = 'info' | 'warning' | 'error';
export type QtiSectionDiagnosticSource =
  | 'assessment-player'
  | 'host'
  | 'manifest'
  | 'assessment-test'
  | 'item'
  | 'stimulus'
  | 'security'
  | 'section-player';

export interface QtiSectionDiagnostic {
  severity: QtiSectionDiagnosticSeverity;
  source: QtiSectionDiagnosticSource;
  code: string;
  message: string;
  path?: string;
}

export interface QtiPackageResolveContext {
  ownerHref?: string;
  referenceKind: 'item' | 'passage' | 'stimulus' | 'stylesheet' | 'catalog-file' | 'asset' | 'source-xml';
}

export interface QtiSharedHtmlSanitizeContext {
  source?: string;
  kind: 'passage' | 'rubric' | 'stimulus' | 'test-feedback' | 'instructions';
}

export interface QtiAssetUrlPolicyContext {
  source?: string;
  kind: 'img' | 'media' | 'object' | 'link' | 'any';
}

export interface QtiSectionResponseDeltaEvent {
  sectionIdentifier: string;
  itemIdentifier: string;
  responseIdentifier: string;
  value: unknown;
}

export interface QtiSectionActiveItemChangeEvent {
  sectionIdentifier: string;
  itemIdentifier: string;
  itemIndex: number;
  itemCount: number;
}

export interface QtiSectionFrameworkError {
  sectionIdentifier?: string;
  itemIdentifier?: string;
  code: string;
  message: string;
  cause?: unknown;
}

/**
 * The candidate changed their display settings. `pnp` is the profile the section
 * now renders with: the host's PNP with the settings applied. Settings last for the
 * session; a host that wants them to persist stores `pnp` and passes it back as the
 * candidate's PNP next time.
 */
export interface QtiSectionDisplaySettingsEvent {
  sectionIdentifier: string;
  settings: import('../tools/display-settings.js').QtiCandidateDisplaySettings;
  pnp: import('@pie-qti/item-player').PnpProfile;
}

export interface QtiSectionRuntimeHostContract {
  resolvePackageUrl?(href: string, context: QtiPackageResolveContext): string | null;
  readPackageFile?(href: string, context: QtiPackageResolveContext): Promise<string | Uint8Array | null>;
  sanitizeSharedHtml?(html: string, context: QtiSharedHtmlSanitizeContext): string;
  sanitizeAssetUrl?(href: string, context: QtiAssetUrlPolicyContext): string | null;
  onResponseDelta?(event: QtiSectionResponseDeltaEvent): void;
  onActiveItemChange?(event: QtiSectionActiveItemChangeEvent): void;
  onSnapshotChange?(snapshot: import('./layout-contract.js').QtiSectionSnapshot): void;
  onFrameworkError?(error: QtiSectionFrameworkError): void;
  onDisplaySettingsChange?(event: QtiSectionDisplaySettingsEvent): void;
}
