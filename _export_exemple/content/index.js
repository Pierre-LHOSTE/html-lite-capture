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

  // src/utils/clean-html.ts
  var REMOVE_TAG_SUBTREES = toLowerSet([
    // SVG
    "svg",
    "g",
    "path",
    "rect",
    "circle",
    "ellipse",
    "line",
    "polyline",
    "polygon",
    "defs",
    "use",
    "clipPath",
    "mask",
    "pattern",
    "linearGradient",
    "radialGradient",
    "stop",
    "symbol",
    "marker",
    "filter",
    // Other
    "script",
    "style",
    "iframe",
    "object",
    "embed",
    "template",
    "link",
    "meta",
    "base",
    "noscript"
  ]);
  var CONTAINER_TAGS = toLowerSet(["div", "span"]);
  var REMOVABLE_IF_EMPTY = toLowerSet(["div", "span"]);
  var ATTRIBUTES_POLICY = {
    img: /* @__PURE__ */ new Set(["src", "alt"]),
    a: /* @__PURE__ */ new Set(["href"]),
    video: /* @__PURE__ */ new Set(["poster"])
  };
  function KEEP_ATTRIBUTE_HOOK(ctx) {
    if (ctx.name === "aria-label") return true;
    if (ctx.name.indexOf("data-") === 0) return true;
    return false;
  }
  var FLAGS = {
    collapseSameTagChains: true,
    // <p><p>... -> <p>...
    unwrapLoneContainerAroundNon: true,
    // <div><p>...</p></div> -> <p>...</p>
    unwrapLoneContainerUnderNon: true,
    // <p><div>...</div></p> -> <p>...</p>
    trimWhitespaceText: true,
    // supprime les textes uniquement blancs
    stripComments: true,
    // supprime les commentaires <!-- ... -->
    collapseContainerChains: true
    // <div><div>...</div></div> -> <div>...
  };
  function removeNode(node) {
    const parent = node.parentNode;
    if (parent) {
      parent.removeChild(node);
    }
  }
  function cleanHtmlTree(rootElement) {
    const wrapper = document.createElement("div");
    const clone = rootElement.cloneNode(true);
    wrapper.appendChild(clone);
    sanitize(wrapper);
    return wrapper.innerHTML;
  }
  function sanitize(node) {
    walk(node);
  }
  function walk(node) {
    if (!node) return;
    if (node.nodeType === Node.COMMENT_NODE) {
      if (FLAGS.stripComments) removeNode(node);
      return;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      if (FLAGS.trimWhitespaceText && !/\S/.test(node.nodeValue || "")) {
        removeNode(node);
      }
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node;
    const tag = element.tagName.toLowerCase();
    if (REMOVE_TAG_SUBTREES.has(tag)) {
      removeNode(element);
      return;
    }
    stripAttributesWithPolicy(element);
    const children = Array.from(element.childNodes);
    for (const child of children) {
      walk(child);
    }
    if (FLAGS.trimWhitespaceText) {
      removeWhitespaceTextNodes(element);
      element.normalize();
    }
    if (FLAGS.collapseSameTagChains) {
      collapseSameTagChains(element);
    }
    collapseContainers(element);
    if (REMOVABLE_IF_EMPTY.has(tag) && element.childNodes.length === 0) {
      removeNode(element);
    }
  }
  function stripAttributesWithPolicy(el) {
    const tag = el.tagName.toLowerCase();
    const allowed = ATTRIBUTES_POLICY[tag] || EMPTY_SET;
    const attrs = Array.from(el.attributes);
    for (const attr of attrs) {
      const name = attr.name.toLowerCase();
      let keep = allowed.has(name);
      if (!keep && typeof KEEP_ATTRIBUTE_HOOK === "function") {
        try {
          keep = !!KEEP_ATTRIBUTE_HOOK({
            tag,
            name,
            value: attr.value,
            element: el
          });
        } catch {
          keep = false;
        }
      }
      if (!keep) {
        el.removeAttribute(attr.name);
      }
    }
  }
  function isElement(node) {
    return node !== null && node.nodeType === Node.ELEMENT_NODE;
  }
  function isSignificantText(node) {
    return node !== null && node.nodeType === Node.TEXT_NODE && /\S/.test(node.nodeValue || "");
  }
  function removeWhitespaceTextNodes(node) {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE && !/\S/.test(child.nodeValue || "")) {
        removeNode(child);
      }
    }
  }
  function getOnlyElementChildIgnoringWhitespace(node) {
    let only = null;
    for (const child of Array.from(node.childNodes)) {
      if (isElement(child)) {
        if (only) return null;
        only = child;
      } else if (isSignificantText(child)) {
        return null;
      }
    }
    return only;
  }
  function collapseSameTagChains(node) {
    if (!isElement(node)) return;
    const tag = node.tagName?.toLowerCase();
    if (!tag) return;
    let child = getOnlyElementChildIgnoringWhitespace(node);
    while (child?.tagName && child.tagName.toLowerCase() === tag) {
      while (child.firstChild) {
        node.appendChild(child.firstChild);
      }
      removeNode(child);
      child = getOnlyElementChildIgnoringWhitespace(node);
    }
  }
  function collapseContainers(node) {
    if (!isElement(node)) return;
    const tag = node.tagName.toLowerCase();
    if (FLAGS.collapseContainerChains && CONTAINER_TAGS.has(tag)) {
      let only = getOnlyElementChildIgnoringWhitespace(node);
      while (only && isElement(only) && CONTAINER_TAGS.has(only.tagName.toLowerCase())) {
        while (only.firstChild) {
          node.insertBefore(only.firstChild, only);
        }
        removeNode(only);
        only = getOnlyElementChildIgnoringWhitespace(node);
      }
    }
    if (FLAGS.unwrapLoneContainerAroundNon && CONTAINER_TAGS.has(tag)) {
      const only = getOnlyElementChildIgnoringWhitespace(node);
      if (only && !CONTAINER_TAGS.has(only.tagName.toLowerCase())) {
        const parent = node.parentNode;
        if (parent) {
          parent.insertBefore(only, node);
          removeNode(node);
          collapseContainers(only);
        }
        return;
      }
    }
    if (FLAGS.unwrapLoneContainerUnderNon && !CONTAINER_TAGS.has(tag)) {
      let only = getOnlyElementChildIgnoringWhitespace(node);
      while (only && CONTAINER_TAGS.has(only.tagName.toLowerCase())) {
        while (only.firstChild) {
          node.insertBefore(only.firstChild, only);
        }
        removeNode(only);
        only = getOnlyElementChildIgnoringWhitespace(node);
      }
    }
  }
  function toLowerSet(arr) {
    const out = /* @__PURE__ */ new Set();
    for (const x of arr) {
      out.add(String(x).toLowerCase());
    }
    return out;
  }
  var EMPTY_SET = /* @__PURE__ */ new Set();

  // src/content/index.ts
  var ext = getBrowserApi();
  var selectionMode = false;
  var lastHovered = null;
  var selectedElements = [];
  var toolbarPanel = null;
  function injectStyles() {
    if (document.getElementById("html-capture-styles")) {
      return;
    }
    const style = document.createElement("style");
    style.id = "html-capture-styles";
    style.textContent = `
      .html-capture-hover {
			outline: 2px solid rgba(0, 150, 255, 0.9) !important;
			background-color: rgba(0, 150, 255, 0.1) !important;
        }
      .html-capture-hover img {
			filter: sepia(100%) saturate(500%) contrast(0.8) brightness(1.2);
        }
      .html-capture-hover * {
			outline: 1px dashed rgba(0, 150, 255, 0.5);
			background: rgba(0, 150, 255, 0.1);
        }
      .html-capture-selected {
			outline: 2px solid rgba(0, 200, 100, 0.9) !important;
			background-color: rgba(0, 200, 100, 0.1) !important;
      }
      html.html-capture-selection-mode a {
        pointer-events: none !important;
        cursor: default !important;
      }
      #html-capture-toolbar {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 999999;
        background: white;
        border: 2px solid #333;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
        display: flex;
        flex-direction: column;
      }
      .html-capture-toolbar-content {
			padding: 12px 16px;
			display: flex;
			align-items: center;
			gap: 16px;
        }
      .html-capture-toolbar-info {
        color: #333;
        font-weight: 500;
      }
      .html-capture-toolbar-buttons {
        display: flex;
        gap: 8px;
      }
      #html-capture-toolbar button {
        padding: 6px 12px;
        border: 1px solid #ccc;
        border-radius: 4px;
        background: white;
        cursor: pointer;
        font-size: 13px;
        font-family: inherit;
        color: black;
      }
      #html-capture-toolbar button:hover:not(:disabled) {
        background: #f0f0f0;
      }
      #html-capture-toolbar button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      #html-capture-generate {
        background: #007bff;
        color: white;
        border-color: #007bff;
      }
      #html-capture-generate:hover:not(:disabled) {
        background: #0056b3;
      }
      #html-capture-cancel {
        background: #6c757d;
        color: white;
        border-color: #6c757d;
      }
      #html-capture-cancel:hover {
			background: #5a6268;
        }
      #html-capture-status {
			padding: 8px 16px;
			font-size: 12px;
			text-align: center;
			min-height: 20px;
        }
      #html-capture-status.success {
			color: #28a745;
        }
      #html-capture-status.error {
			color: #dc3545;
        }
	`;
    document.head.appendChild(style);
  }
  function removeStyles() {
    const style = document.getElementById("html-capture-styles");
    if (style) {
      style.remove();
    }
  }
  function createToolbarPanel() {
    if (toolbarPanel) {
      return;
    }
    if (!document.body) {
      setTimeout(createToolbarPanel, 100);
      return;
    }
    toolbarPanel = document.createElement("div");
    toolbarPanel.id = "html-capture-toolbar";
    toolbarPanel.innerHTML = `
		<div class="html-capture-toolbar-content">
			<div class="html-capture-toolbar-info">
				<span>Selected elements: <span id="html-capture-count">0</span></span>
			</div>
			<div class="html-capture-toolbar-buttons">
				<button id="html-capture-generate" disabled>Generate & copy</button>
				<button id="html-capture-cancel">Cancel</button>
			</div>
		</div>
		<div id="html-capture-status" class="html-capture-status"></div>
	`;
    document.body.appendChild(toolbarPanel);
    const cancelButton = toolbarPanel.querySelector(
      "#html-capture-cancel"
    );
    cancelButton.addEventListener("click", () => {
      exitSelectionMode();
    });
    const generateButton = toolbarPanel.querySelector(
      "#html-capture-generate"
    );
    generateButton.addEventListener("click", () => {
      handleGenerate();
    });
    updateToolbarCount();
  }
  function removeToolbarPanel() {
    if (toolbarPanel) {
      toolbarPanel.remove();
      toolbarPanel = null;
    }
  }
  function updateToolbarCount() {
    if (!toolbarPanel) return;
    const countElement = toolbarPanel.querySelector(
      "#html-capture-count"
    );
    const generateButton = toolbarPanel.querySelector(
      "#html-capture-generate"
    );
    if (countElement) {
      countElement.textContent = selectedElements.length.toString();
    }
    if (generateButton) {
      generateButton.disabled = selectedElements.length === 0;
    }
  }
  var BLOCK_TAGS = /* @__PURE__ */ new Set([
    "div",
    "section",
    "article",
    "main",
    "header",
    "footer",
    "nav",
    "aside",
    "ul",
    "ol",
    "li",
    "p",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6"
  ]);
  function isBlockElement(el) {
    const tag = el.tagName.toLowerCase();
    return BLOCK_TAGS.has(tag);
  }
  function getBlockCandidate(start) {
    let el = start;
    while (el) {
      if (isBlockElement(el)) {
        return el;
      }
      el = el.parentElement;
    }
    return null;
  }
  function isInToolbar(element) {
    if (!element || !toolbarPanel) return false;
    return toolbarPanel.contains(element);
  }
  function handleMouseMove(e) {
    if (!selectionMode) return;
    const target = e.target;
    if (isInToolbar(target)) {
      if (lastHovered) {
        lastHovered.classList.remove("html-capture-hover");
        lastHovered = null;
      }
      return;
    }
    const candidate = getBlockCandidate(target);
    if (candidate === lastHovered) return;
    if (lastHovered) {
      lastHovered.classList.remove("html-capture-hover");
    }
    if (candidate) {
      candidate.classList.add("html-capture-hover");
    }
    lastHovered = candidate;
  }
  function handleClick(e) {
    if (!selectionMode) return;
    if (!e.shiftKey) return;
    const target = e.target;
    if (isInToolbar(target)) {
      return;
    }
    const candidate = getBlockCandidate(target);
    if (!candidate) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    const idx = selectedElements.indexOf(candidate);
    if (idx === -1) {
      selectedElements.push(candidate);
      candidate.classList.add("html-capture-selected");
    } else {
      selectedElements.splice(idx, 1);
      candidate.classList.remove("html-capture-selected");
    }
    updateToolbarCount();
  }
  function handleLinkClick(e) {
    if (!selectionMode) return;
    if (e.shiftKey) return;
    const target = e.target;
    const link = target.closest("a");
    if (link) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }
  }
  function getTopLevelSelectedElements() {
    return selectedElements.filter(
      (el) => !selectedElements.some((other) => other !== el && other.contains(el))
    );
  }
  async function handleGenerate() {
    if (selectedElements.length === 0) return;
    const topLevel = getTopLevelSelectedElements();
    const cleanedHTML = topLevel.map((el) => cleanHtmlTree(el)).join("\n\n");
    const pageUrl = window.location.href;
    const wrapped = `<simplified-extract-html data-source="${pageUrl}">
${cleanedHTML}
</simplified-extract-html>`;
    try {
      await navigator.clipboard.writeText(wrapped);
      console.log("[HTML Capture] HTML copied to clipboard");
      if (toolbarPanel) {
        const generateButton = toolbarPanel.querySelector(
          "#html-capture-generate"
        );
        const statusMessage = toolbarPanel.querySelector(
          "#html-capture-status"
        );
        const originalText = generateButton.textContent;
        generateButton.textContent = "\u2713 Copied!";
        generateButton.disabled = true;
        if (statusMessage) {
          statusMessage.textContent = "\u2713 Copied to clipboard";
          statusMessage.className = "html-capture-status success";
        }
        setTimeout(() => {
          generateButton.textContent = originalText;
          generateButton.disabled = false;
          if (statusMessage) {
            statusMessage.textContent = "";
            statusMessage.className = "html-capture-status";
          }
        }, 2e3);
      }
      setTimeout(() => {
        exitSelectionMode();
      }, 1e3);
    } catch (error) {
      console.error("[HTML Capture] Failed to copy:", error);
      if (toolbarPanel) {
        const generateButton = toolbarPanel.querySelector(
          "#html-capture-generate"
        );
        const statusMessage = toolbarPanel.querySelector(
          "#html-capture-status"
        );
        if (generateButton) {
          const originalText = generateButton.textContent;
          generateButton.textContent = "Copy failed";
          generateButton.style.color = "white";
          generateButton.style.background = "#dc3545";
          generateButton.disabled = true;
          setTimeout(() => {
            generateButton.textContent = originalText;
            generateButton.style.color = "";
            generateButton.style.background = "";
            generateButton.disabled = false;
          }, 2e3);
        }
        if (statusMessage) {
          statusMessage.textContent = "\u2717 Error while copying";
          statusMessage.className = "html-capture-status error";
          setTimeout(() => {
            statusMessage.textContent = "";
            statusMessage.className = "html-capture-status";
          }, 2e3);
        }
      }
    }
  }
  function enterSelectionMode() {
    if (selectionMode) return;
    selectionMode = true;
    document.documentElement.classList.add("html-capture-selection-mode");
    injectStyles();
    createToolbarPanel();
    document.addEventListener("mousemove", handleMouseMove, true);
    document.addEventListener("mousedown", handleClick, true);
    document.addEventListener("click", handleLinkClick, true);
  }
  function exitSelectionMode() {
    if (!selectionMode) return;
    if (lastHovered) {
      lastHovered.classList.remove("html-capture-hover");
      lastHovered = null;
    }
    for (const el of selectedElements) {
      el.classList.remove("html-capture-selected");
    }
    selectedElements = [];
    document.removeEventListener("mousemove", handleMouseMove, true);
    document.removeEventListener("mousedown", handleClick, true);
    document.removeEventListener("click", handleLinkClick, true);
    document.documentElement.classList.remove("html-capture-selection-mode");
    removeToolbarPanel();
    removeStyles();
    selectionMode = false;
  }
  function toggleMode() {
    if (selectionMode) {
      exitSelectionMode();
    } else {
      enterSelectionMode();
    }
  }
  ext.runtime.onMessage.addListener((msg) => {
    if (typeof msg === "object" && msg && msg.type === "TOGGLE_SELECTION") {
      toggleMode();
    }
  });
})();
