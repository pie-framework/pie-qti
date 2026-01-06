import type { ExportData } from './types';

export function exportToJson(exportData: ExportData): void {
	const blob = new Blob([JSON.stringify(exportData, null, 2)], {
		type: 'application/json',
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `qti-responses-${Date.now()}.json`;
	a.click();
	URL.revokeObjectURL(url);
}

export function exportToCsv(
	responses: Record<string, any>,
	scoringResult: any | null
): void {
	let csv = 'Response ID,Value,Score\n';
	for (const [responseId, value] of Object.entries(responses)) {
		const displayValue = Array.isArray(value) ? value.join('; ') : String(value || '');
		const score = scoringResult?.outcomeValues[responseId] || '';
		csv += `"${responseId}","${displayValue}","${score}"\n`;
	}

	const blob = new Blob([csv], { type: 'text/csv' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `qti-responses-${Date.now()}.csv`;
	a.click();
	URL.revokeObjectURL(url);
}
