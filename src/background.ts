import { getBrowserApi } from "./utils/browser-api";

const ext = getBrowserApi();

ext.browserAction.onClicked.addListener((tab: { id?: number }) => {
	if (tab?.id != null) {
		ext.tabs.sendMessage(tab.id, { type: "TOGGLE_SELECTION" }).catch((e: unknown) =>
			console.error("SendMessage failed:", e),
		);
	}
});
