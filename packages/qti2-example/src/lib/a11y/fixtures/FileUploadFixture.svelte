<script lang="ts">
	
	import FileUpload from '@pie-qti/qti2-default-components/shared/components/FileUpload.svelte';
import type { QTIFileResponse } from '@pie-qti/qti2-item-player';

	let value = $state<QTIFileResponse | null>(null);
</script>

<div class="space-y-3">
	<p class="text-sm text-base-content/70">Fixture for file input labeling and error messaging.</p>

	<FileUpload
		label="Upload a file (fixture)"
		responseId="UPLOAD_1"
		fileTypes={['.txt']}
		{value}
		onChange={(v) => (value = v)}
	/>
</div>


