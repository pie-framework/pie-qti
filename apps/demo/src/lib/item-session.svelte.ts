import { registerDefaultComponents } from '@pie-qti/default-components';
import {
	createAssessmentItemDefinition,
	type AssessmentItemDefinitionConfig,
	type AssessmentItemDefinitionPlugin,
	type ItemSession,
	type ItemSessionCommand,
	type ItemSessionTransition,
	type ItemSessionView,
	type OpenItemSessionOptions,
} from '@pie-qti/item-player';

const defaultComponentsPlugin: AssessmentItemDefinitionPlugin = Object.freeze({
	kind: 'assessment-item-definition-plugin',
	name: '@pie-qti/demo-default-components',
	version: '1.0.0',
	registerComponents: registerDefaultComponents,
});

export type DemoItemDefinitionConfig = Omit<AssessmentItemDefinitionConfig, 'plugins'> & {
	plugins?: readonly AssessmentItemDefinitionPlugin[];
};

/**
 * Demo-only Svelte adapter around the authoritative item definition/session API.
 * It owns exactly one live session and exposes its revision as reactive state.
 */
export class DemoItemSessionController {
	session: ItemSession | null = $state(null);
	view: ItemSessionView | null = $state(null);
	revision = $state(0);

	private unsubscribe: (() => void) | null = null;

	open(
		config: DemoItemDefinitionConfig,
		options: OpenItemSessionOptions = {},
	): ItemSession {
		const plugins = [defaultComponentsPlugin, ...(config.plugins ?? [])];
		const definition = createAssessmentItemDefinition({ ...config, plugins });
		const nextSession = definition.openSession(options);
		this.replace(nextSession);
		return nextSession;
	}

	dispatch(command: ItemSessionCommand): ItemSessionTransition {
		if (!this.session) throw new Error('No item session is open');
		return this.session.dispatch(command);
	}

	setResponse(responseIdentifier: string, value: unknown): ItemSessionTransition {
		return this.dispatch({ action: 'setResponse', responseIdentifier, value });
	}

	dispose(): void {
		this.unsubscribe?.();
		this.unsubscribe = null;
		this.session?.dispose();
		this.session = null;
		this.view = null;
		this.revision = 0;
	}

	private replace(nextSession: ItemSession): void {
		this.unsubscribe?.();
		this.session?.dispose();
		this.session = nextSession;
		this.view = nextSession.state();
		this.revision = this.view.revision;
		this.unsubscribe = nextSession.subscribe(({ current }) => {
			this.view = current;
			this.revision = current.revision;
		});
	}
}
