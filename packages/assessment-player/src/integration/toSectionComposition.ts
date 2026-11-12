import { normalizeQtiSharedContext } from '@pie-qti/assessment-toolkit';
import {
	resolveQtiSectionComposition,
	type QtiSectionItemRef,
	type QtiSectionRole,
	type QtiSectionToolConfig,
	type ResolvedQtiSectionComposition,
} from '@pie-qti/section-player';
import type { AssessmentPlayer, BackendAssessmentPlayerConfig } from '../core/AssessmentPlayer.js';

function toSectionRole(role: BackendAssessmentPlayerConfig['role']): QtiSectionRole {
	switch (role) {
		case 'author':
		case 'candidate':
		case 'proctor':
		case 'scorer':
		case 'testConstructor':
		case 'tutor':
			return role;
		default:
			return 'candidate';
	}
}

function scopedTools(tools: QtiSectionToolConfig[] | undefined, scope: QtiSectionToolConfig['scope']): QtiSectionToolConfig[] | undefined {
	if (!tools || tools.length === 0) return undefined;
	return tools.map((tool) => ({ ...tool, scope }));
}

export function toSectionComposition(
	player: AssessmentPlayer,
	config: Partial<BackendAssessmentPlayerConfig> = {}
): ResolvedQtiSectionComposition {
	const navState = player.getNavigationState();
	const currentItem = player.getCurrentItem();
	const role = toSectionRole(config.role);
	const sharedContext = normalizeQtiSharedContext({
		rubricBlocks: player.getCurrentSharedRubricBlocks(),
		role,
		passageTools: scopedTools(config.passageTools, 'passage'),
	});
	const activeSession = player.getCurrentItemSession();
	// One shallow snapshot of the section's response records. Inactive items here are
	// read-only composition data (only the active item renders, from its live session),
	// so per-item deep clones would copy every answer on every composition build.
	const sectionResponses = player.getSectionItemResponses();
	const sectionItems: QtiSectionItemRef[] = player.getCurrentSectionItemRefs().map((item) => {
		const common = {
			identifier: item.identifier,
			href: item.href,
			title: item.title,
			itemXml: item.itemXml,
			deliveryContext: item.deliveryContext,
			tools: scopedTools(config.itemTools, 'item'),
		};
		return item.identifier === currentItem?.identifier && activeSession
			? { ...common, session: activeSession }
			: { ...common, responses: sectionResponses[item.identifier] ?? {} };
	});

	return resolveQtiSectionComposition({
		// The assessment the section belongs to: section tool bars name it (catalogs,
		// display-settings session keys), not the section identifier.
		assessmentId: player.getAssessmentId(),
		section: {
			identifier: navState.currentSection?.id ?? 'active-section',
			title: navState.currentSection?.title ?? currentItem?.title,
			role,
			layoutPreference: sharedContext.passages.length > 0 ? 'split-pane' : 'vertical',
			tools: scopedTools(config.sectionTools, 'section'),
			itemRefs: sectionItems,
			sharedContext,
		},
		activeItemIdentifier: currentItem?.identifier,
		canPrevious: navState.canPrevious,
		canNext: navState.canNext,
		security: config.security,
		host: config.sectionHost,
		pnp: config.pnp,
	});
}
