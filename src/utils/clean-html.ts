const REMOVE_TAG_SUBTREES = toLowerSet([
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
	"noscript",
]);

const CONTAINER_TAGS = toLowerSet(["div", "span"]);

const REMOVABLE_IF_EMPTY = toLowerSet(["div", "span"]);

const ATTRIBUTES_POLICY: Record<string, Set<string>> = {
	// Links/media
	img: new Set(["src", "alt", "title"]),
	a: new Set(["href", "title"]),
	video: new Set(["src", "poster", "title"]),
	audio: new Set(["src", "title"]),
	source: new Set(["src"]),
	// Forms
	input: new Set(["type", "name", "value", "checked", "placeholder"]),
	select: new Set(["name", "value"]),
	option: new Set(["value", "selected"]),
	textarea: new Set(["name", "placeholder"]),
	button: new Set(["type", "name", "value"]),
	label: new Set(["for"]),
	form: new Set(["name"]),
};

interface AttributeHookContext {
	tag: string;
	name: string;
	value: string;
	element: Element;
}

const ALLOWED_ARIA_ATTRIBUTES = new Set([
	"aria-label",
	"aria-valuetext",
	"aria-placeholder",
]);

function KEEP_ATTRIBUTE_HOOK(ctx: AttributeHookContext): boolean {
	if (ALLOWED_ARIA_ATTRIBUTES.has(ctx.name)) return true;
	if (ctx.name === "role") return true;
	return false;
}

const FLAGS: Readonly<{
	collapseSameTagChains: boolean;
	unwrapLoneContainerAroundNon: boolean;
	unwrapLoneContainerUnderNon: boolean;
	trimWhitespaceText: boolean;
	stripComments: boolean;
	collapseContainerChains: boolean;
}> = {
	collapseSameTagChains: true, // <p><p>... -> <p>...
	unwrapLoneContainerAroundNon: true, // <div><p>...</p></div> -> <p>...</p>
	unwrapLoneContainerUnderNon: true, // <p><div>...</div></p> -> <p>...</p>
	trimWhitespaceText: true,
	stripComments: true,
	collapseContainerChains: true, // <div><div>...</div></div> -> <div>...
};

function removeNode(node: Node): void {
	const parent = node.parentNode;
	if (parent) {
		parent.removeChild(node);
	}
}

/* ---------------- Main API ---------------- */

export function cleanHtmlTree(rootElement: Element): string {
	const wrapper = document.createElement("div");
	const clone = rootElement.cloneNode(true) as Element;
	wrapper.appendChild(clone);
	sanitize(wrapper);
	// Return only the inner HTML, not the wrapper itself
	return wrapper.innerHTML;
}

function sanitize(node: Node): void {
	// Single post-order traversal
	walk(node);
}

function walk(node: Node | null): void {
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

	const element = node as Element;
	const tag = element.tagName.toLowerCase();

	// 1) Remove entire subtree for disallowed tags
	if (REMOVE_TAG_SUBTREES.has(tag)) {
		removeNode(element);
		return;
	}

	// 2) Strip attributes based on policy/hook
	stripAttributesWithPolicy(element);

	// 3) Recurse into a stable snapshot of children
	const children = Array.from(element.childNodes);

	for (const child of children) {
		walk(child);
	}

	// 4) Whitespace cleanup at element level
	if (FLAGS.trimWhitespaceText) {
		removeWhitespaceTextNodes(element);
		element.normalize();
	}

	// 5) Collapses
	if (FLAGS.collapseSameTagChains) {
		collapseSameTagChains(element);
	}
	collapseContainers(element);

	// 6) Remove empty containers if configured
	if (REMOVABLE_IF_EMPTY.has(tag) && element.childNodes.length === 0) {
		removeNode(element);
	}
}

/* ---------------- Helpers ---------------- */

function stripAttributesWithPolicy(el: Element): void {
	const tag = el.tagName.toLowerCase();
	const allowed = ATTRIBUTES_POLICY[tag] || EMPTY_SET;
	const attrs = Array.from(el.attributes);

	for (const attr of attrs) {
		const name = attr.name.toLowerCase();
		let keep = allowed.has(name);

		if (!keep && typeof KEEP_ATTRIBUTE_HOOK === "function") {
			// Guard against user hook errors
			try {
				keep = !!KEEP_ATTRIBUTE_HOOK({
					tag: tag,
					name: name,
					value: attr.value,
					element: el,
				});
			} catch {
				keep = false;
			}
		}

		// Remove attributes redundant with element text content
		if (keep) {
			const textContent = el.textContent?.trim() || "";
			const attrValue = attr.value.trim();
			if (textContent && attrValue === textContent) {
				keep = false;
			}
		}

		if (!keep) {
			el.removeAttribute(attr.name);
		}
	}
}

function isElement(node: Node | null): node is Element {
	return node !== null && node.nodeType === Node.ELEMENT_NODE;
}

function isSignificantText(node: Node | null): boolean {
	return (
		node !== null &&
		node.nodeType === Node.TEXT_NODE &&
		/\S/.test(node.nodeValue || "")
	);
}

function removeWhitespaceTextNodes(node: Node): void {
	for (const child of Array.from(node.childNodes)) {
		if (
			child.nodeType === Node.TEXT_NODE &&
			!/\S/.test(child.nodeValue || "")
		) {
			removeNode(child);
		}
	}
}

function getOnlyElementChildIgnoringWhitespace(node: Node): Element | null {
	let only: Element | null = null;

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

function collapseSameTagChains(node: Node): void {
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

function collapseContainers(node: Node): void {
	if (!isElement(node)) return;

	const tag = node.tagName.toLowerCase();

	// 0) NEW — collapse container chains: <container><container>...</container></container> -> keep parent, lift grandchildren
	if (FLAGS.collapseContainerChains && CONTAINER_TAGS.has(tag)) {
		let only = getOnlyElementChildIgnoringWhitespace(node);

		while (
			only &&
			isElement(only) &&
			CONTAINER_TAGS.has(only.tagName.toLowerCase())
		) {
			while (only.firstChild) {
				node.insertBefore(only.firstChild, only);
			}
			removeNode(only);
			only = getOnlyElementChildIgnoringWhitespace(node);
		}
	}

	// 1) <container><non-container>...</non-container></container> -> lift child
	if (FLAGS.unwrapLoneContainerAroundNon && CONTAINER_TAGS.has(tag)) {
		const only = getOnlyElementChildIgnoringWhitespace(node);

		if (only && !CONTAINER_TAGS.has(only.tagName.toLowerCase())) {
			const parent = node.parentNode;

			if (parent) {
				parent.insertBefore(only, node);
				removeNode(node);
				// Re-apply on the lifted node to stay normalized
				collapseContainers(only);
			}

			return;
		}
	}

	// 2) <non-container><container>...</container></non-container> -> unwrap inner container(s)
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

function toLowerSet(arr: string[]): Set<string> {
	const out = new Set<string>();
	for (const x of arr) {
		out.add(String(x).toLowerCase());
	}
	return out;
}

const EMPTY_SET = new Set<string>();
