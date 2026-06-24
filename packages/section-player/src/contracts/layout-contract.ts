import type { ResolvedItemDeliveryContext } from '@pie-qti/ims-cp-core';
import type { HtmlContent, PlayerSecurityConfig, SerializedItemSessionState } from '@pie-qti/item-player';
import type { QtiSectionDiagnostic, QtiSectionRuntimeHostContract } from './runtime-host-contract.js';

export type QtiSectionLayoutPreference = 'split-pane' | 'vertical' | 'auto';
export type QtiSectionResolvedLayout = 'split-pane' | 'vertical';
export type QtiSectionRole = 'candidate' | 'scorer' | 'author' | 'proctor' | 'tutor' | 'testConstructor';
export type QtiSectionNavigationMode = 'linear' | 'nonlinear';
export type QtiSectionSubmissionMode = 'individual' | 'simultaneous';
export type QtiSharedHtmlBlockKind = 'passage' | 'instructions' | 'rubric' | 'stimulus' | 'test-feedback';
export type QtiSharedHtmlBlockScope = 'assessment' | 'testPart' | 'section' | 'item' | 'stimulus';

export interface QtiSectionModel {
  identifier: string;
  title?: string;
  role?: QtiSectionRole;
  view?: string[];
  layoutPreference?: QtiSectionLayoutPreference;
  navigationMode?: QtiSectionNavigationMode;
  submissionMode?: QtiSectionSubmissionMode;
  itemRefs: QtiSectionItemRef[];
  sharedContext?: QtiSharedContext;
  diagnostics?: QtiSectionDiagnostic[];
}

export interface QtiSectionItemRef {
  identifier: string;
  sourcePath?: string;
  href?: string;
  title?: string;
  itemXml: string;
  responses?: Record<string, unknown>;
  sessionSnapshot?: SerializedItemSessionState;
  deliveryContext?: ResolvedItemDeliveryContext;
  diagnostics?: QtiSectionDiagnostic[];
}

export interface QtiSharedHtmlBlock {
  identifier: string;
  kind: QtiSharedHtmlBlockKind;
  scope: QtiSharedHtmlBlockScope;
  source?: string;
  view?: string[];
  rawHtml?: string;
  html?: HtmlContent;
}

export interface QtiSharedStimulus {
  identifier: string;
  href?: string;
  source?: string;
  bodyHtml?: HtmlContent;
  rawBodyHtml?: string;
  stylesheets?: QtiResolvedStylesheetRef[];
  catalogSource?: QtiResolvedCatalogSource;
  diagnostics?: QtiSectionDiagnostic[];
}

export interface QtiResolvedStylesheetRef {
  href: string;
  resolvedHref?: string;
  source?: string;
}

export interface QtiResolvedCatalogSource {
  scope: 'item' | 'stimulus' | 'section';
  xml: string;
  baseHref?: string;
  stimulusIdentifier?: string;
}

export interface QtiSharedContext {
  passages: QtiSharedHtmlBlock[];
  stimuli: QtiSharedStimulus[];
  rubricBlocks: QtiSharedHtmlBlock[];
  testFeedback: QtiSharedHtmlBlock[];
  stylesheets: QtiResolvedStylesheetRef[];
  catalogSources: QtiResolvedCatalogSource[];
  assetDiagnostics: QtiSectionDiagnostic[];
}

export interface QtiSectionSnapshot {
  sectionIdentifier: string;
  activeItemIdentifier: string;
  activeItemIndex: number;
  itemCount: number;
  responses: Record<string, Record<string, unknown>>;
}

export interface ResolvedQtiSectionComposition {
  section: QtiSectionModel;
  activeItem: QtiSectionItemRef;
  activeItemIndex: number;
  sharedContext: QtiSharedContext;
  layout: QtiSectionResolvedLayout;
  canPrevious: boolean;
  canNext: boolean;
  snapshot: QtiSectionSnapshot;
  diagnostics: QtiSectionDiagnostic[];
  security?: PlayerSecurityConfig;
  host?: QtiSectionRuntimeHostContract;
}

export interface ResolveQtiSectionCompositionOptions {
  section: QtiSectionModel;
  activeItemIdentifier?: string;
  activeItemIndex?: number;
  canPrevious?: boolean;
  canNext?: boolean;
  responsesByItemIdentifier?: Record<string, Record<string, unknown>>;
  security?: PlayerSecurityConfig;
  host?: QtiSectionRuntimeHostContract;
}
