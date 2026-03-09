/**
 * Action Execution Functions
 * Browser-native equivalents of automation.js actions, adapted for Chrome extension content scripts.
 * These run directly in the page context (no Puppeteer needed).
 */

export interface ActionResult {
  success: boolean;
  error?: string;
  [key: string]: unknown;
}

// -------------------- ACTION FUNCTIONS --------------------

export function clickAtCoordinate(x: number, y: number): ActionResult {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  if (el) {
    el.click();
    return { success: true, x, y, tag: el.tagName };
  }
  const event = new MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
  });
  document.dispatchEvent(event);
  return { success: true, x, y };
}

export function clickByName(name: string, exactMatch = false): ActionResult {
  const selectors = [
    "button",
    "a",
    '[role="button"]',
    'input[type="button"]',
    'input[type="submit"]',
  ];
  for (const selector of selectors) {
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      const inputEl = el as HTMLInputElement;
      const text =
        el.textContent?.trim() ||
        inputEl.value ||
        el.getAttribute("aria-label") ||
        "";
      const matches = exactMatch
        ? text.toLowerCase() === name.toLowerCase()
        : text.toLowerCase().includes(name.toLowerCase());
      if (matches) {
        el.click();
        return { success: true, element: el.tagName, text };
      }
    }
  }
  return { success: false, error: `No element found matching: "${name}"` };
}

export function scrollUp(pixels = 500): ActionResult {
  window.scrollBy(0, -pixels);
  return { success: true, scrolledBy: -pixels };
}

export function scrollDown(pixels = 500): ActionResult {
  window.scrollBy(0, pixels);
  return { success: true, scrolledBy: pixels };
}

export function scrollToTop(): ActionResult {
  window.scrollTo(0, 0);
  return { success: true };
}

export function scrollToBottom(): ActionResult {
  window.scrollTo(0, document.body.scrollHeight);
  return { success: true };
}

export function fillInput(identifier: string, value: string): ActionResult {
  const lower = identifier.toLowerCase();

  let input: HTMLInputElement | HTMLTextAreaElement | null =
    document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      `input[name="${identifier}" i], textarea[name="${identifier}" i]`,
    ) ||
    document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      `#${CSS.escape(identifier)}`,
    ) ||
    document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      `input[placeholder*="${identifier}" i], textarea[placeholder*="${identifier}" i]`,
    ) ||
    document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      `input[aria-label*="${identifier}" i], textarea[aria-label*="${identifier}" i]`,
    );

  if (!input) {
    for (const label of document.querySelectorAll("label")) {
      if (label.textContent?.toLowerCase().includes(lower)) {
        const forAttr = label.getAttribute("for");
        input = forAttr
          ? (document.getElementById(forAttr) as HTMLInputElement | null)
          : label.querySelector("input, textarea");
        if (input) break;
      }
    }
  }

  if (!input) {
    const typeMap: Record<string, string> = {
      search: 'input[type="search"], input[name*="search" i]',
      email: 'input[type="email"]',
      password: 'input[type="password"]',
    };
    if (typeMap[lower]) {
      input = document.querySelector(typeMap[lower]);
    }
  }

  if (input) {
    input.focus();
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return { success: true, name: input.name || input.id || input.placeholder };
  }
  return { success: false, error: `No input found matching: "${identifier}"` };
}

export function clickFirstSearchResult(): ActionResult {
  const selectors = [
    "#search a h3",
    "#rso a h3",
    "div.g a h3",
    "#b_results .b_algo h2 a",
    '[data-testid="result-title-a"]',
    ".result__a",
    "main a h2",
    "main a h3",
  ];
  for (const sel of selectors) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el) {
      const link = (el.closest("a") || el) as HTMLAnchorElement;
      link.click();
      return { success: true, url: link.href, text: el.textContent?.trim() };
    }
  }
  return { success: false, error: "No search results found" };
}

export function pressEnter(): ActionResult {
  const active = document.activeElement as HTMLElement | null;
  if (active) {
    active.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        bubbles: true,
      }),
    );
    active.dispatchEvent(
      new KeyboardEvent("keypress", {
        key: "Enter",
        code: "Enter",
        bubbles: true,
      }),
    );
    active.dispatchEvent(
      new KeyboardEvent("keyup", {
        key: "Enter",
        code: "Enter",
        bubbles: true,
      }),
    );
  }
  return { success: true };
}

export function pressEnterOn(identifier: string): ActionResult {
  const lower = identifier.toLowerCase();

  let input: HTMLInputElement | HTMLTextAreaElement | null =
    document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      `input[name="${identifier}" i], textarea[name="${identifier}" i]`,
    ) ||
    document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      `#${CSS.escape(identifier)}`,
    ) ||
    document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      `input[placeholder*="${identifier}" i], textarea[placeholder*="${identifier}" i]`,
    ) ||
    document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      `input[aria-label*="${identifier}" i], textarea[aria-label*="${identifier}" i]`,
    );

  if (!input) {
    for (const label of document.querySelectorAll("label")) {
      if (label.textContent?.toLowerCase().includes(lower)) {
        const forAttr = label.getAttribute("for");
        input = forAttr
          ? (document.getElementById(forAttr) as HTMLInputElement | null)
          : label.querySelector("input, textarea");
        if (input) break;
      }
    }
  }

  if (!input) {
    const typeMap: Record<string, string> = {
      search: 'input[type="search"], input[name*="search" i]',
      email: 'input[type="email"]',
      password: 'input[type="password"]',
    };
    if (typeMap[lower]) {
      input = document.querySelector(typeMap[lower]);
    }
  }

  if (!input) {
    return {
      success: false,
      error: `No input found matching: "${identifier}"`,
    };
  }

  input.focus();
  input.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Enter",
      code: "Enter",
      bubbles: true,
    }),
  );
  input.dispatchEvent(
    new KeyboardEvent("keypress", {
      key: "Enter",
      code: "Enter",
      bubbles: true,
    }),
  );
  input.dispatchEvent(
    new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true }),
  );
  return { success: true, name: input.name || input.id || input.placeholder };
}

export function typeText(text: string): ActionResult {
  const active = document.activeElement as HTMLInputElement | null;
  if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) {
    const start = active.selectionStart ?? active.value.length;
    const end = active.selectionEnd ?? active.value.length;
    active.value =
      active.value.substring(0, start) + text + active.value.substring(end);
    active.dispatchEvent(new Event("input", { bubbles: true }));
    active.dispatchEvent(new Event("change", { bubbles: true }));
    return { success: true };
  }
  return { success: false, error: "No active input element to type into" };
}

export function selectOption(identifier: string, value: string): ActionResult {
  const lower = identifier.toLowerCase();

  let select: HTMLSelectElement | null =
    document.querySelector<HTMLSelectElement>(
      `select[name="${identifier}" i]`,
    ) ||
    document.querySelector<HTMLSelectElement>(`#${CSS.escape(identifier)}`) ||
    document.querySelector<HTMLSelectElement>(
      `select[aria-label*="${identifier}" i]`,
    );

  if (!select) {
    for (const label of document.querySelectorAll("label")) {
      if (label.textContent?.toLowerCase().includes(lower)) {
        const forAttr = label.getAttribute("for");
        select = forAttr
          ? (document.getElementById(forAttr) as HTMLSelectElement | null)
          : label.querySelector("select");
        if (select) break;
      }
    }
  }

  if (!select) {
    return {
      success: false,
      error: `No dropdown found matching: "${identifier}"`,
    };
  }

  // Try matching by option value first, then by option text
  const valueLower = value.toLowerCase();
  let matched = false;
  for (const opt of select.options) {
    if (
      opt.value.toLowerCase() === valueLower ||
      opt.text.toLowerCase().includes(valueLower)
    ) {
      select.value = opt.value;
      matched = true;
      break;
    }
  }

  if (!matched) {
    const available = Array.from(select.options)
      .map((o) => o.text.trim())
      .join(", ");
    return {
      success: false,
      error: `No option matching "${value}". Available: ${available}`,
    };
  }

  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
  return {
    success: true,
    name: select.name || select.id,
    selected: select.options[select.selectedIndex]?.text,
  };
}

export function clickFileInput(identifier: string): ActionResult {
  const lower = identifier.toLowerCase();

  let input: HTMLInputElement | null =
    document.querySelector<HTMLInputElement>(
      `input[type="file"][name="${identifier}" i]`,
    ) ||
    document.querySelector<HTMLInputElement>(
      `input[type="file"]#${CSS.escape(identifier)}`,
    ) ||
    document.querySelector<HTMLInputElement>(
      `input[type="file"][aria-label*="${identifier}" i]`,
    );

  if (!input) {
    for (const label of document.querySelectorAll("label")) {
      if (label.textContent?.toLowerCase().includes(lower)) {
        const forAttr = label.getAttribute("for");
        const candidate = forAttr
          ? (document.getElementById(forAttr) as HTMLInputElement | null)
          : label.querySelector<HTMLInputElement>('input[type="file"]');
        if (candidate?.type === "file") {
          input = candidate;
          break;
        }
      }
    }
  }

  // Fall back to any file input on the page
  if (!input) {
    input = document.querySelector<HTMLInputElement>('input[type="file"]');
  }

  if (!input) {
    return {
      success: false,
      error: `No file input found matching: "${identifier}"`,
    };
  }

  input.click();
  return { success: true, name: input.name || input.id || "file input" };
}

// -------------------- PAGE STATUS --------------------

export interface PageStatus {
  title: string;
  url: string;
  scroll: { position: number; maxScroll: number; percent: number };
  headings: { level: string; text: string }[];
  buttons: { text: string; disabled: boolean }[];
  textboxes: { name: string; type: string; value: string }[];
  links: { text: string; href: string }[];
  images: { alt: string; src: string }[];
}

export function getPageStatus(): PageStatus {
  return {
    title: document.title,
    url: window.location.href,
    scroll: {
      position: window.scrollY,
      maxScroll: document.body.scrollHeight,
      percent:
        Math.round(
          (window.scrollY / (document.body.scrollHeight - window.innerHeight)) *
            100,
        ) || 0,
    },
    headings: Array.from(document.querySelectorAll("h1,h2,h3"))
      .slice(0, 20)
      .map((h) => ({
        level: h.tagName,
        text: h.textContent?.trim().substring(0, 100) ?? "",
      })),
    buttons: Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        'button, [role="button"], input[type="submit"]',
      ),
    )
      .slice(0, 30)
      .map((b) => ({
        text: (
          b.textContent?.trim() ||
          b.value ||
          b.getAttribute("aria-label") ||
          ""
        ).substring(0, 50),
        disabled: b.disabled,
      })),
    textboxes: Array.from(
      document.querySelectorAll<HTMLInputElement>(
        'input:not([type="hidden"]), textarea',
      ),
    )
      .slice(0, 20)
      .map((i) => ({
        name: i.name || i.id || i.placeholder || "unnamed",
        type: i.type || "text",
        value: i.type === "password" ? "***" : (i.value || "").substring(0, 50),
      })),
    links: Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
      .slice(0, 30)
      .map((a) => ({
        text: (a.textContent || "").trim().substring(0, 50),
        href: a.href.substring(0, 100),
      })),
    images: Array.from(document.querySelectorAll<HTMLImageElement>("img[src]"))
      .slice(0, 20)
      .map((i) => ({
        alt: (i.alt || "").substring(0, 50),
        src: i.src.substring(0, 100),
      })),
  };
}

// -------------------- ACTION DISPATCHER --------------------

export type ActionType =
  | { type: "clickAtCoordinate"; x: number; y: number }
  | { type: "clickByName"; name: string; exactMatch?: boolean }
  | { type: "scrollUp"; pixels?: number }
  | { type: "scrollDown"; pixels?: number }
  | { type: "scrollToTop" }
  | { type: "scrollToBottom" }
  | { type: "fillInput"; identifier: string; value: string }
  | { type: "clickFirstSearchResult" }
  | { type: "pressEnter" }
  | { type: "pressEnterOn"; identifier: string }
  | { type: "typeText"; text: string }
  | { type: "selectOption"; identifier: string; value: string }
  | { type: "clickFileInput"; identifier: string }
  | { type: "getPageStatus" };

export function executeAction(action: ActionType): ActionResult | PageStatus {
  switch (action.type) {
    case "clickAtCoordinate":
      return clickAtCoordinate(action.x, action.y);
    case "clickByName":
      return clickByName(action.name, action.exactMatch);
    case "scrollUp":
      return scrollUp(action.pixels);
    case "scrollDown":
      return scrollDown(action.pixels);
    case "scrollToTop":
      return scrollToTop();
    case "scrollToBottom":
      return scrollToBottom();
    case "fillInput":
      return fillInput(action.identifier, action.value);
    case "clickFirstSearchResult":
      return clickFirstSearchResult();
    case "pressEnter":
      return pressEnter();
    case "pressEnterOn":
      return pressEnterOn(action.identifier);
    case "typeText":
      return typeText(action.text);
    case "selectOption":
      return selectOption(action.identifier, action.value);
    case "clickFileInput":
      return clickFileInput(action.identifier);
    case "getPageStatus":
      return getPageStatus();
    default:
      return { success: false, error: "Unknown action type" };
  }
}

export function describeAction(action: ActionType): string {
  switch (action.type) {
    case "clickAtCoordinate":
      return `Click at (${action.x}, ${action.y})`;
    case "clickByName":
      return `Click "${action.name}"`;
    case "scrollUp":
      return `Scroll up ${action.pixels ?? 500}px`;
    case "scrollDown":
      return `Scroll down ${action.pixels ?? 500}px`;
    case "scrollToTop":
      return "Scroll to top";
    case "scrollToBottom":
      return "Scroll to bottom";
    case "fillInput":
      return `Fill "${action.identifier}" with "${action.value}"`;
    case "clickFirstSearchResult":
      return "Click first search result";
    case "pressEnter":
      return "Press Enter";
    case "pressEnterOn":
      return `Press Enter on "${action.identifier}"`;
    case "typeText":
      return `Type "${action.text}"`;
    case "selectOption":
      return `Select "${action.value}" in "${action.identifier}"`;
    case "clickFileInput":
      return `Open file picker for "${action.identifier}"`;
    case "getPageStatus":
      return "Get page status";
    default:
      return "Execute action";
  }
}
