import type { ResolvedItemDeliveryContext } from '@pie-qti/ims-cp-core';
import type { HtmlContent, ItemSession, PlayerSecurityConfig, PnpProfile } from '@pie-qti/item-player';
import type { QtiSectionDiagnostic, QtiSectionRuntimeHostContract } from './runtime-host-contract.js';

export type QtiSectionLayoutPreference = 'split-pane' | 'vertical' | 'auto';
export type QtiSectionResolvedLayout = 'split-pane' | 'vertical';
export type QtiSectionRole = 'candidate' | 'scorer' | 'author' | 'proctor' | 'tutor' | 'testConstructor';
export type QtiSectionNavigationMode = 'linear' | 'nonlinear';
export type QtiSectionSubmissionMode = 'individual' | 'simultaneous';
export type QtiSharedHtmlBlockKind = 'passage' | 'instructions' | 'rubric' | 'stimulus' | 'test-feedback';
export type QtiSharedHtmlBlockScope = 'assessment' | 'testPart' | 'section' | 'item' | 'stimulus';
export type QtiSectionToolId = 'textToSpeech' | 'calculator' | 'ruler' | 'protractor' | (string & {});
export type QtiSectionToolScope = 'section' | 'passage' | 'item';

export interface QtiSectionToolConfig {
  toolId: QtiSectionToolId;
  label?: string;
  view?: string[];
  enabled?: boolean;
  scope?: QtiSectionToolScope;
  provider?: Record<string, unknown>;
  renderParams?: Record<string, unknown>;
}

export interface QtiSectionModel {
  identifier: string;
  /** The assessment the section belongs to; names the tool bars' toolkit assessment. */
  assessmentId?: string;
  title?: string;
  role?: QtiSectionRole;
  view?: string[];
  layoutPreference?: QtiSectionLayoutPreference;
  navigationMode?: QtiSectionNavigationMode;
  submissionMode?: QtiSectionSubmissionMode;
  tools?: QtiSectionToolConfig[];
  itemRefs: QtiSectionItemRef[];
  sharedContext?: QtiSharedContext;
  diagnostics?: QtiSectionDiagnostic[];
}

interface QtiSectionItemRefBase {
  identifier: string;
  sourcePath?: string;
  href?: string;
  title?: string;
  itemXml: string;
  deliveryContext?: ResolvedItemDeliveryContext;
  tools?: QtiSectionToolConfig[];
  diagnostics?: QtiSectionDiagnostic[];
}

/**
 * An item ref carries either one authoritative live session or a detached
 * response snapshot. Supplying both would create two competing state inputs.
 */
export type QtiSectionItemRef =
  | (QtiSectionItemRefBase & {
      /** Exact live session owned by the assessment runtime for the active item. */
      session: ItemSession;
      responses?: never;
    })
  | (QtiSectionItemRefBase & {
      session?: undefined;
      responses?: Record<string, unknown>;
    });

export interface QtiSharedHtmlBlock {
  identifier: string;
  kind: QtiSharedHtmlBlockKind;
  scope: QtiSharedHtmlBlockScope;
  source?: string;
  view?: string[];
  tools?: QtiSectionToolConfig[];
  /**
   * The passage or stimulus title (for example a QTI 3 `qti-assessment-stimulus`
   * `title`). Section layouts head the block with it; untitled passages get a
   * neutral localized label.
   */
  title?: string;
  rawHtml?: string;
  /** The block's content language, from its `xml:lang`; sets its `lang` and its read-aloud voice. */
  language?: string;
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
  renderHref?: string;
  browserHref?: string;
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
  /**
   * The assessment the section belongs to. It names the tool bars' toolkit
   * assessment and keys the candidate's session display settings; layouts fall
   * back to the section identifier.
   */
  assessmentId?: string;
  /**
   * The candidate's PNP. A layout given no `pnp` of its own applies this one: its
   * display needs to the whole section surface, the rest to the items.
   */
  pnp?: PnpProfile;
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
  /** The assessment the section belongs to; see `ResolvedQtiSectionComposition.assessmentId`. */
  assessmentId?: string;
  /**
   * The candidate's PNP. Its tool supports turn on the tools the host offers with
   * `enabled: false`, remove prohibited ones and fill unset tool parameters. The
   * composition carries it on, for layouts to apply.
   */
  pnp?: PnpProfile;
}
