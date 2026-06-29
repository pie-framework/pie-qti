export default {
	// ItemPlayer.svelte is a regular Svelte component, not a CE component.
	// The CE wrapper is hand-rolled in element.ts using svelte.mount().
	compilerOptions: {
		customElement: false,
	},
};
