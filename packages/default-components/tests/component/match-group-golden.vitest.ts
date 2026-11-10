/**
 * Golden: the targets the delivered UI blocks for a held source (matchGroup) are exactly the
 * pairs response validation rejects. Each item is real QTI: the interaction data comes from the
 * item-player extractors (`present()`), and the rejections from the Player's validation of each
 * pair (`suspendAttempt`, code `match_group`) — so an extractor that dropped a `matchGroup`, or
 * a renderer that read it differently from `isMatchGroupCompatible`, fails here.
 *
 * Configurations: no groups; groups on one side only; one-sided naming (a choice names a
 * partner that names someone else); shared group tokens; mutual naming.
 */
import { createAssessmentItemDefinition } from '@pie-qti/item-player';
import { afterEach, describe, expect, test } from 'vitest';
import AssociateInteraction from '../../src/plugins/associate/AssociateInteraction.svelte';
import GapMatchInteraction from '../../src/plugins/gap-match/GapMatchInteraction.svelte';
import GraphicAssociateInteraction from '../../src/plugins/graphic-associate/GraphicAssociateInteraction.svelte';
import GraphicGapMatchInteraction from '../../src/plugins/graphic-gap-match/GraphicGapMatchInteraction.svelte';
import MatchInteraction from '../../src/plugins/match/MatchInteraction.svelte';
import { cleanupInteraction, type MountedInteraction, mountInteraction, pressKey, q, qa, settle } from './helpers';

afterEach(() => {
	for (const node of Array.from(document.body.children)) node.remove();
});

const QTI22 = 'http://www.imsglobal.org/xsd/imsqti_v2p2';

type Groups = Record<string, string>;

function group(groups: Groups, id: string): string {
	return groups[id] ? ` matchGroup="${groups[id]}"` : '';
}

function item(baseType: 'pair' | 'directedPair', body: string): string {
	return `<assessmentItem xmlns="${QTI22}" identifier="golden" adaptive="false" timeDependent="false">
		<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="${baseType}"/>
		<itemBody>${body}</itemBody>
	</assessmentItem>`;
}

/** The delivered interaction data and a validator of single pairs, from one item. */
function deliver(itemXml: string) {
	const definition = createAssessmentItemDefinition({ itemXml });
	const session = definition.openSession();
	const flow = session.present().flow;
	session.dispose();
	const node = flow.find((entry) => entry.kind === 'interaction');
	if (!node || node.kind !== 'interaction') throw new Error('no interaction delivered');
	const rejects = (pair: string): boolean => {
		const check = definition.openSession({ responses: { RESPONSE: [pair] } });
		try {
			const issues = check.dispatch({ action: 'suspendAttempt' }).result?.validation?.issues ?? [];
			return issues.some((issue) => issue.code === 'match_group');
		} finally {
			check.dispose();
		}
	};
	return { interaction: node.mount.interaction, rejects };
}

interface Surface {
	name: string;
	directed: boolean;
	sources: readonly string[];
	targets: readonly string[];
	itemXml(groups: Groups): string;
	component: Parameters<typeof mountInteraction>[0];
	/** Hold `source` in the mounted interaction. */
	hold(mounted: MountedInteraction, source: string): Promise<void>;
	/** The targets the UI marks as refusing the held source. */
	blocked(mounted: MountedInteraction): string[];
}

const DIRECTED_SOURCES = ['S1', 'S2'] as const;
const DIRECTED_TARGETS = ['T1', 'T2', 'T3'] as const;
const CHOICES = ['A', 'B', 'C', 'D'] as const;

function ariaDisabled(elements: readonly Element[], ids: readonly string[]): string[] {
	return ids.filter((_, index) => elements[index]?.getAttribute('aria-disabled') === 'true');
}

const surfaces: Surface[] = [
	{
		name: 'match',
		directed: true,
		sources: DIRECTED_SOURCES,
		targets: DIRECTED_TARGETS,
		itemXml: (g) =>
			item(
				'directedPair',
				`<matchInteraction responseIdentifier="RESPONSE" maxAssociations="0">
					<simpleMatchSet>${DIRECTED_SOURCES.map((id) => `<simpleAssociableChoice identifier="${id}" matchMax="0"${group(g, id)}>${id}</simpleAssociableChoice>`).join('')}</simpleMatchSet>
					<simpleMatchSet>${DIRECTED_TARGETS.map((id) => `<simpleAssociableChoice identifier="${id}" matchMax="0"${group(g, id)}>${id}</simpleAssociableChoice>`).join('')}</simpleMatchSet>
				</matchInteraction>`,
			),
		component: MatchInteraction,
		async hold(mounted, source) {
			q<HTMLButtonElement>(mounted, `[data-source-id="${source}"]`)!.click();
			await settle();
		},
		blocked: (mounted) => ariaDisabled(qa(mounted, '[part="target"]'), DIRECTED_TARGETS),
	},
	{
		name: 'gap match',
		directed: true,
		sources: DIRECTED_SOURCES,
		targets: DIRECTED_TARGETS,
		itemXml: (g) =>
			item(
				'directedPair',
				`<gapMatchInteraction responseIdentifier="RESPONSE" maxAssociations="0">
					<gapText identifier="S1" matchMax="0"${group(g, 'S1')}>one</gapText>
					<gapImg identifier="S2" matchMax="0"${group(g, 'S2')}><object type="image/png" data="two.png" width="10" height="10"/></gapImg>
					<p>a <gap identifier="T1"${group(g, 'T1')}/> b <gap identifier="T2"${group(g, 'T2')}/> c <gap identifier="T3"${group(g, 'T3')}/>.</p>
				</gapMatchInteraction>`,
			),
		component: GapMatchInteraction,
		async hold(mounted, source) {
			q(mounted, `button[data-word-id="${source}"]`)!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			await settle();
		},
		blocked: (mounted) =>
			DIRECTED_TARGETS.filter((id) => q(mounted, `button[data-gap-id="${id}"]`)?.getAttribute('aria-disabled') === 'true'),
	},
	{
		name: 'graphic gap match',
		directed: true,
		sources: DIRECTED_SOURCES,
		targets: DIRECTED_TARGETS,
		itemXml: (g) =>
			item(
				'directedPair',
				`<graphicGapMatchInteraction responseIdentifier="RESPONSE" maxAssociations="0">
					<object type="image/png" data="map.png" width="300" height="100"/>
					<gapText identifier="S1" matchMax="0"${group(g, 'S1')}>one</gapText>
					<gapImg identifier="S2" matchMax="0"${group(g, 'S2')}><object type="image/png" data="two.png" width="10" height="10"/></gapImg>
					${DIRECTED_TARGETS.map((id, index) => `<associableHotspot identifier="${id}" shape="rect" coords="${index * 100},0,${index * 100 + 90},90" matchMax="0"${group(g, id)}/>`).join('')}
				</graphicGapMatchInteraction>`,
			),
		component: GraphicGapMatchInteraction,
		async hold(mounted, source) {
			const labels = qa<HTMLButtonElement>(mounted, '[part="labels"] button:not([part="label-remove"])');
			pressKey(labels[DIRECTED_SOURCES.indexOf(source as never)]!, 'Enter');
			await settle();
		},
		blocked: (mounted) => ariaDisabled(qa(mounted, '.qti-ggm-hotspot'), DIRECTED_TARGETS),
	},
	{
		name: 'associate',
		directed: false,
		sources: CHOICES,
		targets: CHOICES,
		itemXml: (g) =>
			item(
				'pair',
				`<associateInteraction responseIdentifier="RESPONSE" maxAssociations="0">
					${CHOICES.map((id) => `<simpleAssociableChoice identifier="${id}" matchMax="0"${group(g, id)}>${id}</simpleAssociableChoice>`).join('')}
				</associateInteraction>`,
			),
		component: AssociateInteraction,
		async hold(mounted, source) {
			qa<HTMLButtonElement>(mounted, '[part="choice"]')[CHOICES.indexOf(source as never)]!.click();
			await settle();
		},
		blocked: (mounted) => ariaDisabled(qa(mounted, '[part="choice"]'), CHOICES),
	},
	{
		name: 'graphic associate',
		directed: false,
		sources: CHOICES,
		targets: CHOICES,
		itemXml: (g) =>
			item(
				'pair',
				`<graphicAssociateInteraction responseIdentifier="RESPONSE" maxAssociations="0">
					<object type="image/png" data="map.png" width="400" height="100"/>
					${CHOICES.map((id, index) => `<associableHotspot identifier="${id}" shape="rect" coords="${index * 100},0,${index * 100 + 90},90" matchMax="0"${group(g, id)}/>`).join('')}
				</graphicAssociateInteraction>`,
			),
		component: GraphicAssociateInteraction,
		async hold(mounted, source) {
			qa<HTMLButtonElement>(mounted, 'button[part="hotspot"]')[CHOICES.indexOf(source as never)]!.click();
			await settle();
		},
		blocked: (mounted) => ariaDisabled(qa(mounted, 'button[part="hotspot"]'), CHOICES),
	},
];

interface Configuration {
	name: string;
	directed: Groups;
	undirected: Groups;
	/** The rejected (blocked) partners per source, the golden expectation both sides must meet. */
	expectDirected: Record<string, string[]>;
	expectUndirected: Record<string, string[]>;
}

const configurations: Configuration[] = [
	{
		name: 'no groups',
		directed: {},
		undirected: {},
		expectDirected: { S1: [], S2: [] },
		expectUndirected: { A: [], B: [], C: [], D: [] },
	},
	{
		name: 'groups on one side only',
		directed: { S1: 'T1', S2: 'T2' },
		undirected: { A: 'B' },
		expectDirected: { S1: [], S2: [] },
		expectUndirected: { A: [], B: [], C: [], D: [] },
	},
	{
		name: 'one-sided naming',
		directed: { S1: 'T1', S2: 'T2', T1: 'S2', T2: 'S1' },
		undirected: { A: 'B', B: 'C', C: 'A' },
		expectDirected: { S1: ['T1', 'T2'], S2: ['T1', 'T2'] },
		expectUndirected: { A: ['B', 'C'], B: ['A', 'C'], C: ['A', 'B'], D: [] },
	},
	{
		name: 'shared group tokens',
		directed: { S1: 'g1', S2: 'g2', T1: 'g1', T2: 'g2', T3: 'g1 g2' },
		undirected: { A: 'g1', B: 'g1', C: 'g2', D: 'g1 g2' },
		expectDirected: { S1: ['T2'], S2: ['T1'] },
		expectUndirected: { A: ['C'], B: ['C'], C: ['A', 'B'], D: [] },
	},
	{
		name: 'mutual naming',
		directed: { S1: 'T1 T3', S2: 'T2', T1: 'S1', T2: 'S2', T3: 'S1' },
		undirected: { A: 'B', B: 'A', C: 'D', D: 'C' },
		expectDirected: { S1: ['T2'], S2: ['T1', 'T3'] },
		expectUndirected: { A: ['C', 'D'], B: ['C', 'D'], C: ['A', 'B'], D: ['A', 'B'] },
	},
];

describe('matchGroup: UI blocking equals response validation', () => {
	for (const surface of surfaces) {
		for (const configuration of configurations) {
			test(`${surface.name}: ${configuration.name}`, async () => {
				const groups = surface.directed ? configuration.directed : configuration.undirected;
				const expected = surface.directed ? configuration.expectDirected : configuration.expectUndirected;
				const { interaction, rejects } = deliver(surface.itemXml(groups));

				for (const source of surface.sources) {
					const partners = surface.targets.filter((target) => target !== source);
					const rejected = partners.filter((target) => rejects(`${source} ${target}`));
					expect(rejected, `validation rejects for ${source}`).toEqual(expected[source]);

					const mounted = mountInteraction(surface.component, { interaction });
					await settle();
					await surface.hold(mounted, source);
					expect(surface.blocked(mounted), `UI blocks for ${source}`).toEqual(rejected);
					cleanupInteraction(mounted);

					if (!surface.directed) {
						// The held choice is never shown as blocked; that exclusion is display-only, as
						// pairing a choice with itself never breaks matchGroup.
						expect(rejects(`${source} ${source}`), `self-pair of ${source}`).toBe(false);
					}
				}
			});
		}
	}
});
