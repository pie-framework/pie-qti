import { normalizeQtiSharedContext } from '@pie-qti/assessment-toolkit';
import {
	resolveQtiSectionComposition,
	type QtiSectionItemRef,
	type QtiSectionRole,
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
	});
	const sectionItems: QtiSectionItemRef[] = player.getCurrentSectionItemRefs().map((item) => ({
		identifier: item.identifier,
		href: item.href,
		title: item.title,
		itemXml: item.itemXml,
		responses: player.getResponsesForItem(item.identifier),
		deliveryContext: item.deliveryContext,
	}));

	return resolveQtiSectionComposition({
		section: {
			identifier: navState.currentSection?.id ?? 'active-section',
			title: navState.currentSection?.title ?? currentItem?.title,
			role,
			layoutPreference: sharedContext.passages.length > 0 ? 'split-pane' : 'vertical',
			itemRefs: sectionItems,
			sharedContext,
		},
		activeItemIdentifier: currentItem?.identifier,
		responsesByItemIdentifier: Object.fromEntries(
			sectionItems.map((item) => [item.identifier, item.responses ?? {}])
		),
		canPrevious: navState.canPrevious,
		canNext: navState.canNext,
		security: config.security,
	});
}
