export function detectSystemTheme(): "light" | "dark" {
	if (window.matchMedia?.("(prefers-color-scheme: dark)")?.matches) {
		return "dark";
	}
	return "light";
}

export function applyThemeToToolbar(
	toolbar: HTMLElement,
	theme: "light" | "dark",
): void {
	toolbar.setAttribute("data-theme", theme);
}

export function watchSystemTheme(
	callback: (theme: "light" | "dark") => void,
): () => void {
	const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

	const handler = (e: MediaQueryListEvent) => {
		callback(e.matches ? "dark" : "light");
	};

	mediaQuery.addEventListener("change", handler);

	// Return cleanup function
	return () => mediaQuery.removeEventListener("change", handler);
}
