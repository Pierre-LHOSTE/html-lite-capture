import { getBrowserApi } from "../utils/browser-api";
import { cleanHtmlTree } from "../utils/clean-html";
import {
	calculateSelectionStats,
	formatNumber,
	formatSize,
} from "../utils/stats";
import {
	applyThemeToToolbar,
	detectSystemTheme,
	watchSystemTheme,
} from "../utils/theme";
import { ICONS } from "./icons";

const ext = getBrowserApi();

let selectionMode = false;
let lastHovered: Element | null = null;
let selectedElements: Element[] = [];
let toolbarPanel: HTMLElement | null = null;
let currentTheme: "light" | "dark" = "light";
let systemThemeWatcher: (() => void) | null = null;

function injectStyles(): void {
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

      /* Toolbar - Theme light */
      #html-capture-toolbar[data-theme="light"] {
        --bg-primary: #ffffff;
        --bg-secondary: #f8f9fa;
        --text-primary: #212529;
        --text-secondary: #6c757d;
        --border-color: #dee2e6;
        --accent-primary: #0066cc;
        --accent-hover: #0052a3;
        --success: #28a745;
        --error: #dc3545;
        --shadow: rgba(0, 0, 0, 0.1);
      }

      /* Toolbar - Theme dark */
      #html-capture-toolbar[data-theme="dark"] {
        --bg-primary: #1e1e1e;
        --bg-secondary: #2d2d2d;
        --text-primary: #e0e0e0;
        --text-secondary: #a0a0a0;
        --border-color: #404040;
        --accent-primary: #4da3ff;
        --accent-hover: #6bb3ff;
        --success: #4ade80;
        --error: #f87171;
        --shadow: rgba(0, 0, 0, 0.4);
      }

      #html-capture-toolbar {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 999999;
        background: var(--bg-primary);
        border: 2px solid var(--border-color);
        border-radius: 8px;
        box-shadow: 0 4px 12px var(--shadow);
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
        display: flex;
        flex-direction: column;
        width: 300px;
        color: var(--text-primary);
      }
      .html-capture-toolbar-header {
        padding: 12px;
        border-bottom: 1px solid var(--border-color);
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
        font-size: 15px;
      }

      .html-capture-toolbar-header svg {
        flex-shrink: 0;
        width: 20px;
        height: 20px;
      }

      .html-capture-toolbar-stats {
        padding: 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }

      .html-capture-stat-item {
        display: flex;
		flex: 1;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        background: var(--bg-secondary);
        border-radius: 8px;
        border: 1px solid var(--border-color);
      }

      .html-capture-stat-icon {
        color: var(--text-secondary);
        flex-shrink: 0;
      }

      .html-capture-stat-icon svg {
        width: 18px;
        height: 18px;
        display: block;
      }

      .html-capture-stat-value {
        font-size: 14px;
        font-weight: 600;
        color: var(--text-primary);
        white-space: nowrap;
      }

      .html-capture-toolbar-actions {
        padding: 12px;
        border-top: 1px solid var(--border-color);
        display: flex;
        gap: 8px;
      }

      #html-capture-toolbar button {
        flex: 1;
        padding: 8px 12px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        font-family: inherit;
        font-weight: 500;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: all 0.15s ease;
      }


      #html-capture-toolbar button:first-child {
        flex: 2;
      }

      #html-capture-toolbar button svg {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
      }

      #html-capture-toolbar button:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 2px 4px var(--shadow);
      }

      #html-capture-toolbar button:active:not(:disabled) {
        transform: translateY(0);
      }

      #html-capture-toolbar button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      #html-capture-generate {
        background: var(--accent-primary);
        color: white;
      }

      #html-capture-generate:hover:not(:disabled) {
        background: var(--accent-hover);
      }

      #html-capture-cancel {
        background: var(--bg-secondary);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
      }

      #html-capture-cancel:hover {
        background: var(--border-color);
      }

      /* Overlay de feedback */
      #html-capture-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 100;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s ease;
        border-radius: 8px;
        overflow: hidden;
      }

      #html-capture-overlay.show {
        opacity: 1;
        pointer-events: auto;
      }

      #html-capture-toolbar[data-theme="light"] #html-capture-overlay {
        backdrop-filter: blur(8px);
        background: rgba(0, 0, 0, 0.15);
      }

      #html-capture-toolbar[data-theme="dark"] #html-capture-overlay {
        backdrop-filter: blur(8px);
        background: rgba(255, 255, 255, 0.1);
      }

      .html-capture-overlay-content {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 24px;
        border-radius: 8px;
        font-weight: 600;
        font-size: 15px;
      }

      .html-capture-overlay-icon svg {
        width: 20px;
        height: 20px;
      }
	`;
	document.head.appendChild(style);
}

function removeStyles(): void {
	const style = document.getElementById("html-capture-styles");
	if (style) {
		style.remove();
	}
}

function createToolbarPanel(): void {
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
		<div class="html-capture-toolbar-header">
			${ICONS.capture}
			<span>HTML Capture</span>
		</div>
		<div class="html-capture-toolbar-stats">
			<div class="html-capture-stat-item">
				<div class="html-capture-stat-icon">${ICONS.elements}</div>
				<span class="html-capture-stat-value" id="html-capture-count">0</span>
			</div>
			<div class="html-capture-stat-item">
				<div class="html-capture-stat-icon">${ICONS.text}</div>
				<span class="html-capture-stat-value" id="html-capture-chars">0</span>
			</div>
			<div class="html-capture-stat-item">
				<div class="html-capture-stat-icon">${ICONS.fileSize}</div>
				<span class="html-capture-stat-value" id="html-capture-size">0 KB</span>
			</div>
		</div>
		<div class="html-capture-toolbar-actions">
			<button id="html-capture-generate" disabled>
				${ICONS.copy}
				<span>Generate & Copy</span>
			</button>
			<button id="html-capture-cancel">
				${ICONS.cancel}
				<span>Cancel</span>
			</button>
		</div>
		<div id="html-capture-overlay" class="html-capture-overlay">
			<div class="html-capture-overlay-content">
				<div class="html-capture-overlay-icon" id="html-capture-overlay-icon"></div>
				<span class="html-capture-overlay-message" id="html-capture-overlay-message"></span>
			</div>
		</div>
	`;

	document.body.appendChild(toolbarPanel);

	// Initialize theme
	initializeTheme();

	const cancelButton = toolbarPanel.querySelector(
		"#html-capture-cancel",
	) as HTMLButtonElement;
	cancelButton.addEventListener("click", () => {
		exitSelectionMode();
	});

	const generateButton = toolbarPanel.querySelector(
		"#html-capture-generate",
	) as HTMLButtonElement;
	generateButton.addEventListener("click", () => {
		handleGenerate();
	});

	updateToolbar();
}

function removeToolbarPanel(): void {
	if (toolbarPanel) {
		toolbarPanel.remove();
		toolbarPanel = null;
	}
}

function initializeTheme(): void {
	currentTheme = detectSystemTheme();

	if (toolbarPanel) {
		applyThemeToToolbar(toolbarPanel, currentTheme);
	}

	// Watch for system theme changes
	systemThemeWatcher = watchSystemTheme((theme) => {
		currentTheme = theme;
		if (toolbarPanel) {
			applyThemeToToolbar(toolbarPanel, currentTheme);
		}
	});
}

function showOverlay(type: "success" | "error", message: string): void {
	if (!toolbarPanel) return;

	const overlay = toolbarPanel.querySelector("#html-capture-overlay");
	const icon = toolbarPanel.querySelector("#html-capture-overlay-icon");
	const messageEl = toolbarPanel.querySelector("#html-capture-overlay-message");

	if (!overlay || !icon || !messageEl) return;

	// Update icon
	icon.innerHTML = type === "success" ? ICONS.check : ICONS.cancel;
	(icon as HTMLElement).style.color =
		type === "success" ? "var(--success)" : "var(--error)";

	// Update message
	messageEl.textContent = message;

	// Show overlay
	overlay.classList.add("show");

	// Hide after 2 seconds
	setTimeout(() => {
		overlay.classList.remove("show");
	}, 2000);
}

function updateToolbar(): void {
	if (!toolbarPanel) return;

	const stats = calculateSelectionStats(getTopLevelSelectedElements);

	const countElement = toolbarPanel.querySelector(
		"#html-capture-count",
	) as HTMLElement;
	const charsElement = toolbarPanel.querySelector(
		"#html-capture-chars",
	) as HTMLElement;
	const sizeElement = toolbarPanel.querySelector(
		"#html-capture-size",
	) as HTMLElement;
	const generateButton = toolbarPanel.querySelector(
		"#html-capture-generate",
	) as HTMLButtonElement;

	if (countElement) {
		countElement.textContent = stats.elementsCount.toString();
	}

	if (charsElement) {
		charsElement.textContent = formatNumber(stats.charactersCount);
	}

	if (sizeElement) {
		sizeElement.textContent = formatSize(stats.estimatedSizeKb);
	}

	if (generateButton) {
		generateButton.disabled = stats.elementsCount === 0;
	}
}

const BLOCK_TAGS = new Set([
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
	"h6",
]);

function isBlockElement(el: Element): boolean {
	const tag = el.tagName.toLowerCase();
	return BLOCK_TAGS.has(tag);
}

function getBlockCandidate(start: Element): Element | null {
	let el: Element | null = start;
	while (el) {
		if (isBlockElement(el)) {
			return el;
		}
		el = el.parentElement;
	}
	return null;
}

function isInToolbar(element: Element | null): boolean {
	if (!element || !toolbarPanel) return false;
	return toolbarPanel.contains(element);
}

function handleMouseMove(e: MouseEvent): void {
	if (!selectionMode) return;

	const target = e.target as Element;

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

function handleClick(e: MouseEvent): void {
	if (!selectionMode) return;

	const target = e.target as Element;

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

	updateToolbar();
}

function handleLinkClick(e: MouseEvent): void {
	if (!selectionMode) return;

	const target = e.target as HTMLElement;
	const link = target.closest("a");

	if (link) {
		e.preventDefault();
		e.stopPropagation();
		e.stopImmediatePropagation();
	}
}

function getTopLevelSelectedElements(): Element[] {
	return selectedElements.filter(
		(el) =>
			!selectedElements.some((other) => other !== el && other.contains(el)),
	);
}

async function handleGenerate(): Promise<void> {
	if (selectedElements.length === 0) return;

	// Generate only top-level elements to avoid duplicates
	const topLevel = getTopLevelSelectedElements();

	const cleanedHTML = topLevel.map((el) => cleanHtmlTree(el)).join("\n\n");
	const pageUrl = window.location.href;
	const wrapped = `<simplified-extract-html data-source="${pageUrl}">\n${cleanedHTML}\n</simplified-extract-html>`;

	try {
		await navigator.clipboard.writeText(wrapped);
		console.log("[HTML Capture] HTML copied to clipboard");

		// Show success overlay
		showOverlay("success", "Copied!");

		// Exit selection mode after copy
		setTimeout(() => {
			exitSelectionMode();
		}, 1000);
	} catch (error) {
		console.error("[HTML Capture] Failed to copy:", error);

		// Show error overlay
		showOverlay("error", "Copy failed");
	}
}

function enterSelectionMode(): void {
	if (selectionMode) return;

	selectionMode = true;
	document.documentElement.classList.add("html-capture-selection-mode");

	// Clean up any leftover selections from previous sessions
	const oldSelections = document.querySelectorAll(".html-capture-selected");
	for (const el of oldSelections) {
		el.classList.remove("html-capture-selected");
	}
	selectedElements = [];

	injectStyles();
	createToolbarPanel();
	document.addEventListener("mousemove", handleMouseMove, true);
	document.addEventListener("mousedown", handleClick, true);
	document.addEventListener("click", handleLinkClick, true);
}

function exitSelectionMode(): void {
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

	// Cleanup system theme watcher
	if (systemThemeWatcher) {
		systemThemeWatcher();
		systemThemeWatcher = null;
	}

	removeToolbarPanel();

	removeStyles();

	selectionMode = false;
}

function toggleMode(): void {
	if (selectionMode) {
		exitSelectionMode();
	} else {
		enterSelectionMode();
	}
}

ext.runtime.onMessage.addListener((msg: unknown) => {
	if (
		typeof msg === "object" &&
		msg &&
		(msg as { type?: string }).type === "TOGGLE_SELECTION"
	) {
		toggleMode();
	}
});
