import { describe, expect, test } from 'bun:test';
import {
	createAssessmentItemDefinition,
	type AssessmentItemDefinitionPlugin,
} from '../../src/core/AssessmentItemDefinition.js';
import { getItemSessionBinding } from '../../src/core/ItemSession.js';
import type { ComponentRegistry } from '../../src/core/ComponentRegistry.js';
import type { ElementExtractor } from '../../src/extraction/types.js';
import type { ExtractionRegistry } from '../../src/extraction/ExtractionRegistry.js';
import { htmlField } from '../../src/extraction/deliveryTypes.js';
import { getStandardInteractionModule } from '../../src/interactions/modules.js';
import type { QTIFileResponse } from '../../src/types/index.js';

const CHOICE_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item
  xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
  identifier="definition-choice"
  title="Definition choice"
  adaptive="false"
  time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
    <qti-default-value><qti-value>0</qti-value></qti-default-value>
  </qti-outcome-declaration>
  <qti-item-body>
    <p>Choose A.</p>
    <qti-choice-interaction response-identifier="RESPONSE" shuffle="false" max-choices="1">
      <qti-prompt>Choose one.</qti-prompt>
      <qti-simple-choice identifier="A">A</qti-simple-choice>
      <qti-simple-choice identifier="B">B</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
  <qti-response-processing>
    <qti-response-condition>
      <qti-response-if>
        <qti-match>
          <qti-variable identifier="RESPONSE"/>
          <qti-correct identifier="RESPONSE"/>
        </qti-match>
        <qti-set-outcome-value identifier="SCORE">
          <qti-base-value base-type="float">1</qti-base-value>
        </qti-set-outcome-value>
      </qti-response-if>
    </qti-response-condition>
  </qti-response-processing>
</qti-assessment-item>`;

const TEMPLATE_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="definition-template"
  title="Definition template"
  adaptive="false"
  timeDependent="false">
  <templateDeclaration identifier="NUMBER" cardinality="single" baseType="integer">
    <defaultValue><value>0</value></defaultValue>
  </templateDeclaration>
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="integer"/>
  <templateProcessing>
    <setTemplateValue identifier="NUMBER"><randomInteger min="1" max="10"/></setTemplateValue>
  </templateProcessing>
  <itemBody>
    <p>Enter <printedVariable identifier="NUMBER"/>.</p>
    <textEntryInteraction responseIdentifier="RESPONSE"/>
  </itemBody>
</assessmentItem>`;

const DRAWING_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="definition-drawing"
  title="Definition drawing"
  adaptive="false"
  timeDependent="false">
  <responseDeclaration identifier="DRAWING" cardinality="single" baseType="file"/>
  <itemBody>
    <drawingInteraction responseIdentifier="DRAWING"/>
  </itemBody>
</assessmentItem>`;

describe('AssessmentItemDefinition', () => {
	test('owns one authoritative response state and presents that state', () => {
		const definition = createAssessmentItemDefinition({ itemXml: CHOICE_ITEM });
		const session = definition.openSession();

		expect(definition.identifier).toBe('definition-choice');
		expect(Object.isFrozen(definition)).toBe(true);
		expect(session.state().responses.RESPONSE).toBeNull();

		session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 'A' });

		expect(session.state().responses.RESPONSE).toBe('A');
		const presentation = session.present();
		expect(Object.isFrozen(presentation)).toBe(true);
		expect(Object.isFrozen(presentation.flow)).toBe(true);
		const html = presentation.flow
			.filter((node) => node.kind === 'html')
			.map((node) => String(node.html))
			.join('');
		const blockMounts = presentation.flow
			.filter((node) => node.kind === 'interaction' && node.mount.placement === 'block')
			.map((node) => node.mount);
		expect(html).toContain('Choose A.');
		expect(blockMounts).toHaveLength(1);
		const block = blockMounts[0];
		expect(block && 'response' in block ? block.response : undefined).toBe('A');
		expect(block && 'tagName' in block ? block.tagName : undefined).toBe('pie-qti-choice');
		expect(Object.isFrozen(block)).toBe(true);

		session.dispose();
	});

	test('restores serialized state without sharing a second live state owner', () => {
		const definition = createAssessmentItemDefinition({ itemXml: CHOICE_ITEM });
		const first = definition.openSession({ responses: { RESPONSE: 'A' } });
		const saved = first.dispatch({ action: 'suspendAttempt' }).result?.sessionState;
		first.dispose();

		expect(saved).toBeDefined();
		const restored = definition.openSession({ restore: saved! });
		expect(restored.state().responses.RESPONSE).toBe('A');
		expect(restored.state().lifecycleStatus).toBe('suspended');
		expect(restored.serialize().sessionGuid).toBe(saved?.sessionGuid);

		restored.dispose();
	});

	test('activates suspended handoffs and rejects candidate writes after closing', () => {
		const definition = createAssessmentItemDefinition({ itemXml: CHOICE_ITEM });
		const original = definition.openSession({ responses: { RESPONSE: 'A' } });
		const suspended = original.dispatch({ action: 'suspendAttempt' }).result?.sessionState;
		original.dispose();

		const active = definition.openSession({ restore: suspended!, activate: true });
		expect(active.state().lifecycleStatus).toBe('interacting');
		active.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 'B' });
		active.dispatch({ action: 'endAttempt' });

		expect(active.state().lifecycleStatus).toBe('closed');
		expect(active.present().disabled).toBe(true);
		expect(() =>
			active.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 'A' })
		).toThrow('Cannot update responses while item session is closed');
		expect(() => active.dispatch({ action: 'endAttempt' })).toThrow(
			'Cannot run endAttempt while item session is closed',
		);
		expect(active.state().responses.RESPONSE).toBe('B');
		expect(active.state().revision).toBe(2);

		active.dispose();
	});

	test('publishes one immutable revision transition for each command', () => {
		const session = createAssessmentItemDefinition({ itemXml: CHOICE_ITEM }).openSession();
		const revisions: number[] = [];
		const unsubscribe = session.subscribe(({ current }) => revisions.push(current.revision));
		const callerOwnedResponses = { RESPONSE: 'A' };

		const responseTransition = session.dispatch({
			action: 'setResponses',
			responses: callerOwnedResponses,
		});
		const lifecycleTransition = session.dispatch({ action: 'endAttempt' });

		expect(revisions).toEqual([1, 2]);
		expect(responseTransition.current.responses.RESPONSE).toBe('A');
		expect(Object.isFrozen(responseTransition.current)).toBe(true);
		expect(Object.isFrozen(callerOwnedResponses)).toBe(false);
		expect(lifecycleTransition.result?.scoring?.score).toBe(1);
		expect(lifecycleTransition.current.lifecycleStatus).toBe('closed');
		expect(lifecycleTransition.current.numAttempts).toBe(1);
		unsubscribe();
		session.dispose();
	});

	test('detaches drawing response data at command and snapshot boundaries', () => {
		const session = createAssessmentItemDefinition({ itemXml: DRAWING_ITEM }).openSession();
		const drawing: QTIFileResponse = {
			name: 'drawing.png',
			type: 'image/png',
			size: 4,
			lastModified: 123,
			dataUrl: 'data:image/png;base64,AAAA',
			imageData: {
				data: new Uint8ClampedArray([10, 20, 30, 255]),
				width: 1,
				height: 1,
			},
		};
		let subscriberDrawing: QTIFileResponse | undefined;
		let secondSubscriberByte: number | undefined;
		session.subscribe(({ current }) => {
			subscriberDrawing = current.responses.DRAWING as QTIFileResponse;
			subscriberDrawing.imageData!.data[0] = 50;
		});
		session.subscribe(({ current }) => {
			secondSubscriberByte = (current.responses.DRAWING as QTIFileResponse).imageData?.data[0];
		});

		const transition = session.dispatch({
			action: 'setResponse',
			responseIdentifier: 'DRAWING',
			value: drawing,
		});
		drawing.name = 'caller-mutated.png';
		drawing.imageData!.data[0] = 60;

		const transitionDrawing = transition.current.responses.DRAWING as QTIFileResponse;
		expect(transitionDrawing.name).toBe('drawing.png');
		expect(transitionDrawing.imageData?.data[0]).toBe(10);
		expect(subscriberDrawing?.imageData?.data[0]).toBe(50);
		expect(secondSubscriberByte).toBe(10);
		transitionDrawing.imageData!.data[0] = 70;

		const firstView = session.state();
		const firstViewDrawing = firstView.responses.DRAWING as QTIFileResponse;
		expect(Object.isFrozen(firstViewDrawing)).toBe(true);
		expect(Reflect.set(firstViewDrawing, 'name', 'view-mutated.png')).toBe(false);
		firstViewDrawing.imageData!.data[0] = 80;

		const serialized = session.serialize();
		const serializedDrawing = serialized.responseVariables.DRAWING?.value as QTIFileResponse;
		expect(Object.isFrozen(serializedDrawing)).toBe(true);
		serializedDrawing.imageData!.data[0] = 90;
		const presentedDrawing = session
			.present()
			.flow.find((node) => node.kind === 'interaction')?.mount;
		if (!presentedDrawing || presentedDrawing.placement !== 'block') {
			throw new Error('Expected drawing presentation mount');
		}
		(presentedDrawing.response as QTIFileResponse).imageData!.data[0] = 100;

		const authoritativeDrawing = session.state().responses.DRAWING as QTIFileResponse;
		const freshlySerializedDrawing = session.serialize().responseVariables.DRAWING
			?.value as QTIFileResponse;
		expect(authoritativeDrawing.name).toBe('drawing.png');
		expect(authoritativeDrawing.imageData?.data[0]).toBe(10);
		expect(freshlySerializedDrawing.name).toBe('drawing.png');
		expect(freshlySerializedDrawing.imageData?.data[0]).toBe(10);
		expect(session.state().revision).toBe(1);

		session.dispose();
	});

	test('exposes browser capabilities through a narrow binding and closes cleanly', () => {
		const session = createAssessmentItemDefinition({
			itemXml: CHOICE_ITEM,
			role: 'scorer',
			pnp: { cognitive: { eliminationTool: true } },
		}).openSession();
		const binding = getItemSessionBinding(session);
		const observed: string[] = [];
		session.subscribe(({ command }) => observed.push(command.action));

		expect(binding.role).toBe('scorer');
		expect(binding.getPnp()?.cognitive?.eliminationTool).toBe(true);
		const blockNode = session
			.present()
			.flow.find((node) => node.kind === 'interaction' && node.mount.placement === 'block');
		expect(blockNode?.kind).toBe('interaction');
		if (blockNode?.kind !== 'interaction') throw new Error('Expected a block interaction');
		expect(binding.getComponentRegistry().getTagName(blockNode.mount.interaction)).toBe('pie-qti-choice');

		session.dispose();
		expect(session.state().disposed).toBe(true);
		expect(observed).toEqual(['dispose']);
		expect(() => session.dispatch({ action: 'scoreAttempt' })).toThrow('disposed');
		expect(() => getItemSessionBinding(session)).toThrow('disposed');
	});

	test('keeps role authority and direct rubric projection inside the session', () => {
		const itemXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="session-role">
  <rubricBlock view="scorer" use="rubric"><p>Direct scoring guide</p></rubricBlock>
  <itemBody><p>Stem</p></itemBody>
</assessmentItem>`;
		const session = createAssessmentItemDefinition({ itemXml, role: 'scorer' }).openSession();
		expect(session.state().role).toBe('scorer');

		const presentation = (session.present as (view: { role: string }) => ReturnType<typeof session.present>)({
			role: 'candidate',
		});
		expect(presentation.capabilities.isReadOnly).toBe(true);
		expect(presentation.capabilities.canViewCorrectResponses).toBe(true);
		expect(presentation.directRubrics).toHaveLength(1);
		expect(presentation.directRubrics[0]?.scope).toBe('direct');
		expect(String(presentation.directRubrics[0]?.html)).toContain('Direct scoring guide');

		session.dispose();
	});

	test('carries its runtime binding across module and package boundaries', () => {
		const session = createAssessmentItemDefinition({ itemXml: CHOICE_ITEM }).openSession();
		const binding = getItemSessionBinding(session);
		const crossBundleReference = {
			state: () => session.state(),
			dispatch: (command) => session.dispatch(command),
			present: (view) => session.present(view),
			subscribe: (listener) => session.subscribe(listener),
			serialize: () => session.serialize(),
			getRuntimeBinding: () => binding,
			dispose: () => session.dispose(),
		} satisfies typeof session & { getRuntimeBinding(): typeof binding };

		expect(getItemSessionBinding(crossBundleReference)).toBe(binding);
		crossBundleReference.dispose();
	});

	test('rejects unknown response identifiers without publishing a revision', () => {
		const session = createAssessmentItemDefinition({ itemXml: CHOICE_ITEM }).openSession();
		const revisions: number[] = [];
		session.subscribe(({ current }) => revisions.push(current.revision));

		expect(() =>
			session.dispatch({ action: 'setResponse', responseIdentifier: 'MISSING', value: 'A' })
		).toThrow("Unknown response identifier 'MISSING'");
		expect(session.state().revision).toBe(0);
		expect(revisions).toEqual([]);

		session.dispose();
	});

	test('rejects unknown initial and restored response overrides', () => {
		const definition = createAssessmentItemDefinition({ itemXml: CHOICE_ITEM });

		expect(() =>
			definition.openSession({ responses: { MISSING: 'A' } })
		).toThrow("Unknown response identifier 'MISSING'");

		const original = definition.openSession({ responses: { RESPONSE: 'A' } });
		const saved = original.serialize();
		original.dispose();

		expect(() =>
			definition.openSession({ restore: saved, responses: { MISSING: 'B' } })
		).toThrow("Unknown response identifier 'MISSING'");

		const restored = definition.openSession({
			restore: saved,
			responses: { RESPONSE: 'B' },
		});
		expect(restored.state().responses.RESPONSE).toBe('B');
		restored.dispose();
	});

	test('rejects response overrides on restored non-writable sessions', () => {
		const definition = createAssessmentItemDefinition({ itemXml: CHOICE_ITEM });
		const active = definition.openSession({ responses: { RESPONSE: 'A' } });
		active.dispatch({ action: 'endAttempt' });
		const closed = active.serialize();
		active.dispose();

		expect(() =>
			definition.openSession({ restore: closed, responses: { RESPONSE: 'B' } })
		).toThrow('Cannot override responses while item session is closed');
		const restored = definition.openSession({ restore: closed });
		expect(restored.state().responses.RESPONSE).toBe('A');
		restored.dispose();
	});

	test('rejects restoration state belonging to another assessment item', () => {
		const definition = createAssessmentItemDefinition({ itemXml: CHOICE_ITEM });
		const session = definition.openSession();
		const saved = { ...session.serialize(), itemIdentifier: 'another-item' };
		session.dispose();

		expect(() => definition.openSession({ restore: saved })).toThrow(
			"Cannot restore item session for 'another-item' into 'definition-choice'"
		);
	});

	test('compiles plugins once and gives each new session an independent template RNG', () => {
		let extractorRegistrations = 0;
		let componentRegistrations = 0;
		let rngFactoryCalls = 0;
		let randomCalls = 0;
		class DefinitionTestPlugin implements AssessmentItemDefinitionPlugin {
			readonly kind = 'assessment-item-definition-plugin' as const;
			readonly name = 'definition-test-plugin';
			readonly version = '1.0.0';
			registerExtractors() {
				extractorRegistrations += 1;
			}
			registerComponents() {
				componentRegistrations += 1;
			}
		}
		const definition = createAssessmentItemDefinition({
			itemXml: TEMPLATE_ITEM,
			rngFactory: () => {
				rngFactoryCalls += 1;
				let sessionRandomCalls = 0;
				return () => {
					randomCalls += 1;
					sessionRandomCalls += 1;
					return sessionRandomCalls === 1 ? 0.25 : 0.75;
				};
			},
			plugins: [new DefinitionTestPlugin()],
		});

		expect(extractorRegistrations).toBe(1);
		expect(componentRegistrations).toBe(1);
		expect(randomCalls).toBe(0);
		expect(rngFactoryCalls).toBe(0);

		const first = definition.openSession();
		const callsAfterFirstSession = randomCalls;
		expect(callsAfterFirstSession).toBeGreaterThan(0);
		expect(rngFactoryCalls).toBe(1);
		expect(first.state().templates.NUMBER).toBe(3);

		const second = definition.openSession();
		expect(randomCalls).toBeGreaterThan(callsAfterFirstSession);
		expect(rngFactoryCalls).toBe(2);
		expect(second.state().templates.NUMBER).toBe(3);
		expect(extractorRegistrations).toBe(1);
		expect(componentRegistrations).toBe(1);

		const saved = first.serialize();
		const callsBeforeRestore = randomCalls;
		const restored = definition.openSession({ restore: saved });
		expect(rngFactoryCalls).toBe(3);
		expect(randomCalls).toBe(callsBeforeRestore);
		expect(restored.state().templates.NUMBER).toBe(first.state().templates.NUMBER);

		first.dispose();
		second.dispose();
		restored.dispose();
	});

	test('snapshots plugin delivery schemas before opening sessions', () => {
		const mutableFields = [htmlField('prompt')];
		let definitionRegistry: ExtractionRegistry | undefined;
		const extractor: ElementExtractor = {
			id: 'definition:mutable-delivery',
			name: 'Mutable delivery extractor',
			priority: 1000,
			elementTypes: ['choiceInteraction'],
			delivery: { fields: mutableFields },
			canHandle: () => true,
			extract: () => ({
				prompt: '<strong>Safe</strong><script>bad()</script>',
				choices: [],
				shuffle: false,
				maxChoices: 1,
			}),
		};
		const definition = createAssessmentItemDefinition({
			itemXml: CHOICE_ITEM,
			plugins: [
				{
					kind: 'assessment-item-definition-plugin',
					name: 'mutable-delivery-plugin',
					version: '1.0.0',
					registerExtractors: (registry) => {
						definitionRegistry = registry;
						registry.register(extractor);
					},
				},
			],
		});

		expect(definitionRegistry?.isSealed()).toBe(true);
		expect(() => definitionRegistry?.clear()).toThrow('sealed');
		const registered = definitionRegistry?.getExtractorsForType('choiceInteraction');
		expect(Object.isFrozen(registered)).toBe(true);
		expect(() => (registered as ElementExtractor[]).splice(0)).toThrow();
		mutableFields.splice(0);
		extractor.elementTypes.splice(0);
		const session = definition.openSession();
		const interaction = session
			.present()
			.flow.find((node) => node.kind === 'interaction')?.mount.interaction as any;

		expect(String(interaction.prompt)).toBe('<strong>Safe</strong>');
		expect(Object.isFrozen(interaction)).toBe(true);
		session.dispose();
	});

	test('snapshots standard delivery policy into the compiled definition', () => {
		let definitionRegistry: ExtractionRegistry | undefined;
		const definition = createAssessmentItemDefinition({
			itemXml: CHOICE_ITEM,
			plugins: [
				{
					kind: 'assessment-item-definition-plugin',
					name: 'standard-policy-probe',
					version: '1.0.0',
					registerExtractors: (registry) => {
						definitionRegistry = registry;
						registry.register({
							id: 'definition:standard-policy-probe',
							name: 'Standard policy probe',
							priority: 1000,
							elementTypes: ['choiceInteraction'],
							canHandle: () => true,
							extract: () => ({
								prompt: '<strong onclick="bad()">Safe</strong><script>bad()</script>',
								choices: [
									{ identifier: 'A', text: '<span onmouseover="bad()">A</span>' },
								],
								shuffle: false,
								maxChoices: 1,
							}),
						});
					},
				},
			],
		});
		const exportedModule = getStandardInteractionModule('choiceInteraction');
		if (!exportedModule || !definitionRegistry) {
			throw new Error('Expected compiled choice delivery policy');
		}
		const compiledFields = definitionRegistry.getDeliveryFieldsForType('choiceInteraction');

		expect(compiledFields).not.toBe(exportedModule.delivery);
		expect(Object.isFrozen(compiledFields)).toBe(true);
		expect(Object.isFrozen(compiledFields[0]?.path)).toBe(true);
		expect(Object.isFrozen(exportedModule)).toBe(true);
		expect(Object.isFrozen(exportedModule.delivery)).toBe(true);
		expect(() => (exportedModule.delivery as any[]).splice(0)).toThrow();

		for (let sessionNumber = 0; sessionNumber < 2; sessionNumber += 1) {
			const session = definition.openSession();
			const interaction = session
				.present()
				.flow.find((node) => node.kind === 'interaction')?.mount.interaction as any;
			expect(String(interaction.prompt)).toBe('<strong>Safe</strong>');
			expect(String(interaction.choices[0]?.text)).toBe('<span>A</span>');
			session.dispose();
		}
	});

	test('isolates mutable extraction nodes between sessions of one definition', () => {
		const observedPriorMarkers: Array<string | null> = [];
		const definition = createAssessmentItemDefinition({
			itemXml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="mutation-isolation" title="Mutation isolation" adaptive="false" timeDependent="false">
	<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string"/>
	<itemBody><vendorInteraction responseIdentifier="RESPONSE"/></itemBody>
</assessmentItem>`,
			plugins: [
				{
					kind: 'assessment-item-definition-plugin',
					name: 'mutation-probe',
					version: '1.0.0',
					registerExtractors: (registry: ExtractionRegistry) =>
						registry.register({
							id: 'definition:mutation-probe',
							name: 'Mutation probe',
							priority: 1000,
							elementTypes: ['vendorInteraction'],
							outputType: 'mutationProbeInteraction',
							canHandle: () => true,
							extract: (element) => {
								const priorMarker = element.getAttribute?.('data-session-marker') ?? null;
								observedPriorMarkers.push(priorMarker);
								element.setAttribute?.('data-session-marker', 'mutated');
								return { marker: priorMarker ?? 'clean' };
							},
						}),
					registerComponents: (registry: ComponentRegistry) =>
						registry.register('mutationProbeInteraction', {
							name: 'mutation-probe',
							tagName: 'mutation-probe',
						}),
				},
			],
		});

		for (let sessionNumber = 0; sessionNumber < 2; sessionNumber += 1) {
			const session = definition.openSession();
			const interaction = session
				.present()
				.flow.find((node) => node.kind === 'interaction')?.mount.interaction as any;
			expect(interaction.marker).toBe('clean');
			session.dispose();
		}
		expect(observedPriorMarkers).toEqual([null, null]);
	});

	test('fails definition construction when plugin registration fails', () => {
		expect(() =>
			createAssessmentItemDefinition({
				itemXml: CHOICE_ITEM,
				plugins: [
					{
						kind: 'assessment-item-definition-plugin',
						name: 'broken-definition-plugin',
						version: '1.0.0',
						registerExtractors: () => {
							throw new Error('invalid plugin delivery schema');
						},
					},
				],
			}),
		).toThrow('invalid plugin delivery schema');
	});

	test('validates definition-plugin identity and dependency order', () => {
		const dependency: AssessmentItemDefinitionPlugin = {
			kind: 'assessment-item-definition-plugin',
			name: 'dependency',
			version: '1.0.0',
		};
		const dependent: AssessmentItemDefinitionPlugin = {
			kind: 'assessment-item-definition-plugin',
			name: 'dependent',
			version: '1.0.0',
			dependencies: ['dependency'],
		};

		expect(() =>
			createAssessmentItemDefinition({ itemXml: CHOICE_ITEM, plugins: [dependent] }),
		).toThrow("Definition plugin 'dependent' has missing dependencies: dependency");
		expect(() =>
			createAssessmentItemDefinition({
				itemXml: CHOICE_ITEM,
				plugins: [
					{
						...dependency,
						kind: 'legacy-plugin' as never,
					},
				],
			}),
		).toThrow("must declare kind 'assessment-item-definition-plugin'");

		const definition = createAssessmentItemDefinition({
			itemXml: CHOICE_ITEM,
			plugins: [dependency, dependent],
		});
		definition.openSession().dispose();
	});
});
