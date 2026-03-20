// Optional PIE players: dynamically imported at runtime only.
// They are peerDependencies in some environments and may be absent in others.

declare module '@pie-framework/pie-assessment-player' {
	const pieAssessmentPlayer: any;
	export default pieAssessmentPlayer;
}

declare module '@pie-framework/pie-iife-player' {
	const pieIifePlayer: any;
	export default pieIifePlayer;
}

declare module '@pie-framework/pie-esm-player' {
	const pieEsmPlayer: any;
	export default pieEsmPlayer;
}




