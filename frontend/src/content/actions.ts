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

function resolveFileInput(identifier: string): HTMLInputElement | null {
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

  return input ?? document.querySelector<HTMLInputElement>('input[type="file"]');
}

/**
 * Upload a file to a file input by fetching it from a path or URL.
 *
 * - filePath: a local file path (e.g. C:\Users\...\doc.pdf or /home/.../doc.pdf)
 *   or an http/https URL. Local paths are converted to file:// URLs — this
 *   requires the extension to have file:// access enabled in browser settings.
 * - keyword: if provided (and no filePath), searches the current page for
 *   clickable elements whose visible text contains the keyword (useful in
 *   web-based file managers like Google Drive, OneDrive, etc.) and clicks the
 *   first match to select/navigate to that file before attaching it.
 */
export async function uploadFile(
  identifier: string,
  filePath?: string,
  keyword?: string,
): Promise<ActionResult> {
  const input = resolveFileInput(identifier);
  if (!input) {
    return {
      success: false,
      error: `No file input found matching: "${identifier}"`,
    };
  }

  // Keyword / filename search
  if (keyword && !filePath) {
    // If the keyword looks like a filename (has a file extension), search the
    // local filesystem via the background service worker first.
    if (/\.\w{2,5}$/.test(keyword)) {
      const bgResponse = await new Promise<{
        success: boolean;
        data?: string;
        error?: string;
      }>((resolve) =>
        chrome.runtime.sendMessage(
          { type: "FIND_AND_FETCH_FILE", fileName: keyword },
          resolve,
        ),
      );
      if (bgResponse?.success && bgResponse.data) {
        const fetchedBlob = await fetch(bgResponse.data).then((r) => r.blob());
        const file = new File([fetchedBlob], keyword, {
          type: fetchedBlob.type || "application/octet-stream",
          lastModified: Date.now(),
        });
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
        input.dispatchEvent(new Event("input", { bubbles: true }));
        return {
          success: true,
          fileName: keyword,
          size: file.size,
          type: file.type,
          inputName: input.name || input.id || "file input",
        };
      }
      return {
        success: false,
        error: bgResponse?.error ?? `"${keyword}" not found on filesystem`,
      };
    }

    // Otherwise: search the current page's DOM for a matching element
    // (useful in web-based file managers like Google Drive, OneDrive, etc.)
    const kw = keyword.toLowerCase();
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>(
        'a, [role="row"], [role="listitem"], li, tr, [role="option"]',
      ),
    );
    const match = candidates.find((el) =>
      el.textContent?.toLowerCase().includes(kw),
    );
    if (match) {
      match.click();
      return {
        success: true,
        action: "keyword-click",
        keyword,
        element: match.tagName,
        text: match.textContent?.trim().substring(0, 80),
      };
    }
    return {
      success: false,
      error: `No page element found containing: "${keyword}"`,
    };
  }

  if (!filePath) {
    return { success: false, error: "Provide filePath or keyword" };
  }

  // Build a fetchable URL from the path
  let fileUrl: string;
  if (/^https?:\/\//i.test(filePath)) {
    fileUrl = filePath;
  } else {
    const normalized = filePath.replace(/\\/g, "/");
    fileUrl = normalized.startsWith("/")
      ? `file://${normalized}`
      : `file:///${normalized}`;
  }

  const fileName = filePath.split(/[/\\]/).pop() || "upload";

  // For file:// URLs, route through the background service worker because
  // content scripts cannot fetch file:// URLs directly (browser security policy).
  const fetchViaBackground = fileUrl.startsWith("file://");

  try {
    let dataUrl: string;

    if (fetchViaBackground) {
      const response = await new Promise<{ success: boolean; data?: string; error?: string }>(
        (resolve) => chrome.runtime.sendMessage({ type: "FETCH_FILE", fileUrl }, resolve),
      );
      if (!response?.success || !response.data) {
        throw new Error(response?.error ?? "Background fetch failed");
      }
      dataUrl = response.data;
    } else {
      const r = await fetch(fileUrl);
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
      const blob = await r.blob();
      dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("FileReader failed"));
        reader.readAsDataURL(blob);
      });
    }

    // Convert data URL → Blob → File and attach to the input
    const fetchedBlob = await fetch(dataUrl).then((r) => r.blob());
    const file = new File([fetchedBlob], fileName, {
      type: fetchedBlob.type || "application/octet-stream",
      lastModified: Date.now(),
    });

    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new Event("input", { bubbles: true }));

    return {
      success: true,
      fileName,
      size: file.size,
      type: file.type,
      inputName: input.name || input.id || "file input",
    };
  } catch (err) {
    return {
      success: false,
      error: `Could not load "${filePath}": ${err instanceof Error ? err.message : String(err)}`,
    };
  }
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

// -------------------- WEBSITE CONTENT --------------------

export interface WebsiteContent {
  title: string;
  url: string;
  /** Extracted readable paragraphs/headings, noise-filtered */
  paragraphs: string[];
  /** Full text joined with newlines, capped at 50 000 chars */
  fullText: string;
}

/**
 * Scrape the readable text content of the current page.
 * Strips navigation, footers, scripts, ads, etc. and returns the main prose.
 */
export function getWebsiteContent(): WebsiteContent {
  // Clone body so we can strip noise without touching the live DOM
  const clone = document.body.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll(
      "script, style, noscript, nav, header, footer, aside, " +
        '[role="navigation"], [role="banner"], [role="contentinfo"], ' +
        '[role="complementary"], form, .ad, .ads, .advertisement, ' +
        ".sidebar, .menu, .navbar, .nav, .footer, .header",
    )
    .forEach((el) => el.remove());

  // Prefer a semantic content container
  const root =
    clone.querySelector("article") ??
    clone.querySelector("main") ??
    clone.querySelector('[role="main"]') ??
    clone;

  const seen = new Set<string>();
  const paragraphs: string[] = [];

  root
    .querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, blockquote, figcaption")
    .forEach((el) => {
      const text = el.textContent?.replace(/\s+/g, " ").trim();
      if (text && text.length > 20 && !seen.has(text)) {
        seen.add(text);
        paragraphs.push(text);
      }
    });

  return {
    title: document.title,
    url: window.location.href,
    paragraphs: paragraphs.slice(0, 200),
    fullText: paragraphs.slice(0, 200).join("\n\n").substring(0, 50_000),
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
  | {
      type: "uploadFile";
      /** Label/name/id of the file input element */
      identifier: string;
      /** Full local file path (e.g. C:\docs\cv.pdf) or http/https URL */
      filePath?: string;
      /** Keyword to search for in the page when a full path is unavailable */
      keyword?: string;
    }
  | { type: "getPageStatus" }
  | { type: "getWebsiteContent" };

export async function executeAction(
  action: ActionType,
): Promise<ActionResult | PageStatus | WebsiteContent> {
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
    case "uploadFile":
      return uploadFile(action.identifier, action.filePath, action.keyword);
    case "getPageStatus":
      return getPageStatus();
    case "getWebsiteContent":
      return getWebsiteContent();
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
    case "uploadFile":
      if (action.keyword) {
        return `Search page for "${action.keyword}" and select file for "${action.identifier}"`;
      }
      return `Upload "${action.filePath ?? "file"}" to "${action.identifier}"`;
    case "getPageStatus":
      return "Get page status";
    case "getWebsiteContent":
      return "Get website text content";
    default:
      return "Execute action";
  }
}
