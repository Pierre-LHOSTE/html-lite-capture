export interface SelectionStats {
	elementsCount: number;
	charactersCount: number;
	estimatedSizeKb: number;
}

export function calculateSelectionStats(
	getTopLevel: () => Element[],
): SelectionStats {
	const topLevel = getTopLevel();

	let chars = 0;

	for (const el of topLevel) {
		const text = el.textContent || "";
		chars += text.length;
	}

	// Estimation: HTML tags add ~50% to text content
	const estimatedBytes = chars * 1.5;
	const estimatedKb = estimatedBytes / 1024;

	return {
		elementsCount: topLevel.length,
		charactersCount: chars,
		estimatedSizeKb: Math.round(estimatedKb * 100) / 100,
	};
}

export function formatNumber(num: number): string {
	if (num >= 1000000) {
		return `${Math.round(num / 1000000)}M`;
	}
	if (num >= 1000) {
		return `${Math.round(num / 1000)}K`;
	}
	return num.toString();
}

export function formatSize(kb: number): string {
	if (kb >= 1024) {
		return `${Math.round(kb / 1024)} MB`;
	}
	return `${Math.round(kb)} KB`;
}
