import type { InteractionData } from '../interactions/index.js';
import type { PlayerSecurityConfig } from '../types/index.js';
import { toTrustedHtml } from '../core/trustedTypes.js';
import { sanitizeResourceUrl } from '../core/urlPolicy.js';

export function applyInteractionSecurity(
	interactions: InteractionData[],
	security?: PlayerSecurityConfig
): InteractionData[] {
	const policy = security?.urlPolicy;
	const allowObjectEmbeds = security?.allowObjectEmbeds === true;
	const ttPolicyName = security?.trustedTypesPolicyName;

	for (const interaction of interactions as any[]) {
		// Wrap known HTML injection fields in TrustedHTML (when enabled).
		// Important: do NOT wrap fields rendered as plain text (e.g. prompt).
		if (interaction.type === 'choiceInteraction' && Array.isArray(interaction.choices)) {
			for (const choice of interaction.choices) {
				if (typeof choice?.text === 'string') {
					choice.text = toTrustedHtml(choice.text, ttPolicyName);
				}
			}
		}

		// Shared ImageData shape.
		if (interaction.imageData?.src) {
			interaction.imageData.src = sanitizeResourceUrl(interaction.imageData.src, policy, 'img') ?? '';
		}
		if (interaction.imageData?.content && typeof interaction.imageData.content === 'string') {
			interaction.imageData.content = toTrustedHtml(interaction.imageData.content, ttPolicyName);
		}

		// positionObject stages.
		if (Array.isArray(interaction.positionObjectStages)) {
			for (const stage of interaction.positionObjectStages) {
				if (stage?.objectData?.src) {
					stage.objectData.src = sanitizeResourceUrl(stage.objectData.src, policy, 'img') ?? '';
				}
				if (stage?.objectData?.content && typeof stage.objectData.content === 'string') {
					stage.objectData.content = toTrustedHtml(stage.objectData.content, ttPolicyName);
				}
			}
		}

		// mediaInteraction.
		if (interaction.type === 'mediaInteraction' && interaction.mediaElement?.src) {
			const kind = interaction.mediaElement.type === 'object' ? 'object' : 'media';
			interaction.mediaElement.src =
				sanitizeResourceUrl(interaction.mediaElement.src, policy, kind) ?? '';
			interaction.allowObjectEmbeds = allowObjectEmbeds;
		}

		// hottextInteraction content is injected via {@html}.
		if (interaction.type === 'hottextInteraction' && typeof interaction.contentHtml === 'string') {
			interaction.contentHtml = toTrustedHtml(interaction.contentHtml, ttPolicyName);
		}
	}

	return interactions;
}
