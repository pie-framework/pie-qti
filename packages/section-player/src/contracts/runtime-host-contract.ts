export type QtiSectionDiagnosticSeverity = 'info' | 'warning' | 'error';
export type QtiSectionDiagnosticSource =
  | 'assessment-player'
  | 'composer'
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

export interface QtiSectionRuntimeHostContract {
  resolvePackageUrl?(href: string, context: QtiPackageResolveContext): string | null;
  readPackageFile?(href: string, context: QtiPackageResolveContext): Promise<string | Uint8Array | null>;
  sanitizeSharedHtml?(html: string, context: QtiSharedHtmlSanitizeContext): string;
  sanitizeAssetUrl?(href: string, context: QtiAssetUrlPolicyContext): string | null;
  onResponseDelta?(event: QtiSectionResponseDeltaEvent): void;
  onActiveItemChange?(event: QtiSectionActiveItemChangeEvent): void;
  onSnapshotChange?(snapshot: import('./layout-contract.js').QtiSectionSnapshot): void;
  onFrameworkError?(error: QtiSectionFrameworkError): void;
}
