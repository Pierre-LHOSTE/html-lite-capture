import { getBrowserApi } from "../utils/browser-api";
import { cleanHtmlTree } from "../utils/clean-html";

const ext = getBrowserApi();

let selectionMode = false;
let lastHovered: Element | null = null;
let selectedElements: Element[] = [];
let toolbarPanel: HTMLElement | null = null;

// Styles CSS
function injectStyles(): void {
	if (document.getElementById("html-capture-styles")) {
		return; // Déjà injecté
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

// Retirer les styles CSS
function removeStyles(): void {
	const style = document.getElementById("html-capture-styles");
	if (style) {
		style.remove();
	}
}

// Créer le panneau UI
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

	updateToolbarCount();
}

// Supprimer le panneau
function removeToolbarPanel(): void {
	if (toolbarPanel) {
		toolbarPanel.remove();
		toolbarPanel = null;
	}
}

// Mettre à jour le compteur
function updateToolbarCount(): void {
	if (!toolbarPanel) return;

	const countElement = toolbarPanel.querySelector(
		"#html-capture-count",
	) as HTMLElement;
	const generateButton = toolbarPanel.querySelector(
		"#html-capture-generate",
	) as HTMLButtonElement;

	if (countElement) {
		countElement.textContent = selectedElements.length.toString();
	}

	if (generateButton) {
		generateButton.disabled = selectedElements.length === 0;
	}
}

// Vérifier si un élément est un bloc
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

// Trouver le bloc parent le plus proche
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

// Vérifier si un élément est dans le panneau
function isInToolbar(element: Element | null): boolean {
	if (!element || !toolbarPanel) return false;
	return toolbarPanel.contains(element);
}

// Gérer le hover
function handleMouseMove(e: MouseEvent): void {
	if (!selectionMode) return;

	const target = e.target as Element;

	// Ignorer les événements dans le panneau
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

// Gérer le clic (Shift+clic pour sélectionner)
function handleClick(e: MouseEvent): void {
	if (!selectionMode) return;
	if (!e.shiftKey) return;

	const target = e.target as Element;

	// Ignorer les clics dans le panneau
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

// Empêcher la navigation sur les liens
function handleLinkClick(e: MouseEvent): void {
	if (!selectionMode) return;
	if (e.shiftKey) return;

	const target = e.target as HTMLElement;
	const link = target.closest("a");

	if (link) {
		e.preventDefault();
		e.stopPropagation();
		e.stopImmediatePropagation();
	}
}

// Obtenir uniquement les éléments de plus haut niveau
function getTopLevelSelectedElements(): Element[] {
	// Ne garder que les éléments qui ne sont pas contenus dans un autre élément sélectionné
	return selectedElements.filter(
		(el) =>
			!selectedElements.some((other) => other !== el && other.contains(el)),
	);
}

// Générer et copier le HTML
async function handleGenerate(): Promise<void> {
	if (selectedElements.length === 0) return;

	// On ne génère que les éléments top-level pour éviter les doublons
	const topLevel = getTopLevelSelectedElements();

	const cleanedHTML = topLevel.map((el) => cleanHtmlTree(el)).join("\n\n");
	const pageUrl = window.location.href;
	const wrapped = `<simplified-extract-html data-source="${pageUrl}">\n${cleanedHTML}\n</simplified-extract-html>`;

	try {
		await navigator.clipboard.writeText(wrapped);
		console.log("[HTML Capture] HTML copied to clipboard");

		// Feedback visuel
		if (toolbarPanel) {
			const generateButton = toolbarPanel.querySelector(
				"#html-capture-generate",
			) as HTMLButtonElement;
			const statusMessage = toolbarPanel.querySelector(
				"#html-capture-status",
			) as HTMLElement;
			const originalText = generateButton.textContent;
			generateButton.textContent = "✓ Copied!";
			generateButton.disabled = true;

			if (statusMessage) {
				statusMessage.textContent = "✓ Copied to clipboard";
				statusMessage.className = "html-capture-status success";
			}

			setTimeout(() => {
				generateButton.textContent = originalText;
				generateButton.disabled = false;
				if (statusMessage) {
					statusMessage.textContent = "";
					statusMessage.className = "html-capture-status";
				}
			}, 2000);
		}

		// Sortir du mode sélection après copie
		setTimeout(() => {
			exitSelectionMode();
		}, 1000);
	} catch (error) {
		console.error("[HTML Capture] Failed to copy:", error);

		// Feedback visuel d'erreur (pas d'alert)
		if (toolbarPanel) {
			const generateButton = toolbarPanel.querySelector(
				"#html-capture-generate",
			) as HTMLButtonElement;
			const statusMessage = toolbarPanel.querySelector(
				"#html-capture-status",
			) as HTMLElement;

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
				}, 2000);
			}

			if (statusMessage) {
				statusMessage.textContent = "✗ Error while copying";
				statusMessage.className = "html-capture-status error";
				setTimeout(() => {
					statusMessage.textContent = "";
					statusMessage.className = "html-capture-status";
				}, 2000);
			}
		}
	}
}

// Entrer en mode sélection
function enterSelectionMode(): void {
	if (selectionMode) return;

	selectionMode = true;
	document.documentElement.classList.add("html-capture-selection-mode");

	injectStyles();
	createToolbarPanel();
	document.addEventListener("mousemove", handleMouseMove, true);
	document.addEventListener("mousedown", handleClick, true);
	document.addEventListener("click", handleLinkClick, true);
}

// Sortir du mode sélection
function exitSelectionMode(): void {
	if (!selectionMode) return;

	// Nettoyer le hover
	if (lastHovered) {
		lastHovered.classList.remove("html-capture-hover");
		lastHovered = null;
	}

	// Nettoyer la sélection
	for (const el of selectedElements) {
		el.classList.remove("html-capture-selected");
	}
	selectedElements = [];

	// Retirer les listeners
	document.removeEventListener("mousemove", handleMouseMove, true);
	document.removeEventListener("mousedown", handleClick, true);
	document.removeEventListener("click", handleLinkClick, true);

	// Retirer la classe du document
	document.documentElement.classList.remove("html-capture-selection-mode");

	// Supprimer le panneau
	removeToolbarPanel();

	// Retirer les styles injectés
	removeStyles();

	selectionMode = false;
}

// Toggle du mode
function toggleMode(): void {
	if (selectionMode) {
		exitSelectionMode();
	} else {
		enterSelectionMode();
	}
}

// Écouter les messages du background
ext.runtime.onMessage.addListener((msg: unknown) => {
	if (
		typeof msg === "object" &&
		msg &&
		(msg as { type?: string }).type === "TOGGLE_SELECTION"
	) {
		toggleMode();
	}
});
