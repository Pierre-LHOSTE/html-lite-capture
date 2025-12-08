export function getBrowserApi() {
	// @ts-expect-error
	if (typeof browser !== "undefined") {
		// @ts-expect-error
		return browser;
	}
	// @ts-expect-error
	if (typeof chrome !== "undefined") {
		// @ts-expect-error
		return chrome;
	}
	throw new Error("No browser or chrome API found");
}
