"use strict";
(() => {
  // src/utils/browser-api.ts
  function getBrowserApi() {
    if (typeof browser !== "undefined") {
      return browser;
    }
    if (typeof chrome !== "undefined") {
      return chrome;
    }
    throw new Error("No browser or chrome API found");
  }

  // src/background.ts
  var ext = getBrowserApi();
  ext.browserAction.onClicked.addListener((tab) => {
    if (tab?.id != null) {
      ext.tabs.sendMessage(tab.id, { type: "TOGGLE_SELECTION" }).catch(
        (e) => console.error("SendMessage failed:", e)
      );
    }
  });
})();
