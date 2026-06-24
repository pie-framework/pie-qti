import {
	isQtiViewVisibleForRole,
	resolveQtiSectionComposition,
	type QtiSectionItemRef,
	type QtiSectionRole,
	type QtiSharedContext,
	type QtiSharedHtmlBlock,
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

function toSharedHtmlBlock(
	block: ReturnType<AssessmentPlayer['getCurrentSharedRubricBlocks']>[number],
	index: number
): QtiSharedHtmlBlock {
	return {
		identifier: block.identifier ?? `${block.use ?? 'rubric'}-${index}`,
		kind: block.use === 'passage' ? 'passage' : block.use === 'instructions' ? 'instructions' : 'rubric',
		scope: 'section',
		view: block.view,
		rawHtml: block.content,
	};
}

function normalizeRubricBlocks(
	rubricBlocks: ReturnType<AssessmentPlayer['getCurrentSharedRubricBlocks']>,
	role: QtiSectionRole
): QtiSharedContext {
	const passages: QtiSharedHtmlBlock[] = [];
	const sharedRubrics: QtiSharedHtmlBlock[] = [];

	for (const [index, block] of rubricBlocks.entries()) {
		const normalized = toSharedHtmlBlock(block, index);
		if (!isQtiViewVisibleForRole(normalized.view, role)) continue;

		if (normalized.kind === 'passage') {
			passages.push(normalized);
		} else {
			sharedRubrics.push(normalized);
		}
	}

	return {
		passages,
		stimuli: [],
		rubricBlocks: sharedRubrics,
		testFeedback: [],
		stylesheets: [],
		catalogSources: [],
		assetDiagnostics: [],
	};
}

export function toSectionComposition(
	player: AssessmentPlayer,
	config: Partial<BackendAssessmentPlayerConfig> = {}
): ResolvedQtiSectionComposition {
	const navState = player.getNavigationState();
	const currentItem = player.getCurrentItem();
	const role = toSectionRole(config.role);
	const sharedContext = normalizeRubricBlocks(player.getCurrentSharedRubricBlocks(), role);
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
