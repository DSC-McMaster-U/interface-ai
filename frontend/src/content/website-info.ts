/**
 * Website Info Capture Module
 * Captures DOM/HTML content and screenshots for sending to the backend.
 */

import type { ScreenshotResponse } from "./types";

/**
 * Website information structure
 */
export interface WebsiteInfo {
  screenshot: string | null;
  html: string;
  url: string;
  title: string;
  metadata: {
    description: string | null;
    keywords: string | null;
    viewport: string | null;
  };
  forms: FormInfo[];
  links: LinkInfo[];
  buttons: ButtonInfo[];
  inputs: InputInfo[];
}

interface FormInfo {
  id: string | null;
  name: string | null;
  action: string | null;
  method: string | null;
  inputCount: number;
}

interface LinkInfo {
  href: string | null;
  text: string;
  id: string | null;
}

interface ButtonInfo {
  text: string;
  id: string | null;
  type: string | null;
  name: string | null;
}

interface InputInfo {
  type: string | null;
  name: string | null;
  id: string | null;
  placeholder: string | null;
  value: string;
  label: string | null;
}

/**
 * Request screenshot capture from the background service worker
 */
function captureScreenshot(): Promise<ScreenshotResponse> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "CAPTURE_SCREENSHOT" },
      (response: ScreenshotResponse) => {
        if (chrome.runtime.lastError) {
          resolve({
            success: false,
            error:
              chrome.runtime.lastError.message || "Screenshot capture failed",
          });
        } else {
          resolve(
            response || {
              success: false,
              error: "No response from background",
            },
          );
        }
      },
    );
  });
}

/**
 * Capture screenshot and return the image data
 */
async function captureScreenshotData(): Promise<string | null> {
  try {
    const response = await captureScreenshot();

    if (response.success && response.imageData) {
      return response.imageData;
    } else {
      return null;
    }
  } catch (error) {
    console.error("[InterfaceAI] Screenshot error:", error);
    return null;
  }
}

/**
 * Get the label text for an input element
 */
function getInputLabel(
  input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
): string | null {
  if (input.id) {
    const label = document.querySelector(`label[for="${input.id}"]`);
    if (label) return label.textContent?.trim() || null;
  }

  const parentLabel = input.closest("label");
  if (parentLabel) {
    return parentLabel.textContent?.trim() || null;
  }

  return input.getAttribute("aria-label");
}

/**
 * Parse the DOM to extract relevant information
 */
function parseDOMInfo(): Omit<WebsiteInfo, "screenshot"> {
  const description =
    document
      .querySelector('meta[name="description"]')
      ?.getAttribute("content") || null;
  const keywords =
    document.querySelector('meta[name="keywords"]')?.getAttribute("content") ||
    null;
  const viewport =
    document.querySelector('meta[name="viewport"]')?.getAttribute("content") ||
    null;

  const forms: FormInfo[] = Array.from(document.querySelectorAll("form")).map(
    (form) => ({
      id: form.id || null,
      name: form.name || null,
      action: form.action || null,
      method: form.method || null,
      inputCount: form.querySelectorAll("input, textarea, select").length,
    }),
  );

  const links: LinkInfo[] = Array.from(document.querySelectorAll("a"))
    .slice(0, 50)
    .map((link) => ({
      href: link.href || null,
      text: link.textContent?.trim().substring(0, 100) || "",
      id: link.id || null,
    }));

  const buttons: ButtonInfo[] = Array.from(
    document.querySelectorAll(
      "button, input[type='submit'], input[type='button']",
    ),
  )
    .slice(0, 30)
    .map((btn) => ({
      text: (
        btn.textContent?.trim() ||
        (btn as HTMLInputElement).value ||
        ""
      ).substring(0, 100),
      id: btn.id || null,
      type: btn.getAttribute("type"),
      name: (btn as HTMLButtonElement).name || null,
    }));

  const inputs: InputInfo[] = Array.from(
    document.querySelectorAll("input, textarea, select"),
  )
    .slice(0, 50)
    .map((input) => {
      const el = input as
        | HTMLInputElement
        | HTMLTextAreaElement
        | HTMLSelectElement;
      return {
        type: el.getAttribute("type") || el.tagName.toLowerCase(),
        name: el.name || null,
        id: el.id || null,
        placeholder: (el as HTMLInputElement).placeholder || null,
        value:
          el.type === "password"
            ? "[hidden]"
            : el.value?.substring(0, 200) || "",
        label: getInputLabel(el),
      };
    });

  const clonedDoc = document.documentElement.cloneNode(true) as HTMLElement;
  clonedDoc
    .querySelectorAll("script, style, noscript, iframe, svg, canvas")
    .forEach((el) => el.remove());
  clonedDoc.querySelector("#interface-ai-root")?.remove();

  let html = clonedDoc.outerHTML;
  const MAX_HTML_SIZE = 50000; // 50KB limit
  if (html.length > MAX_HTML_SIZE) {
    html = html.substring(0, MAX_HTML_SIZE) + "\n<!-- HTML truncated -->";
  }

  return {
    html,
    url: window.location.href,
    title: document.title,
    metadata: {
      description,
      keywords,
      viewport,
    },
    forms,
    links,
    buttons,
    inputs,
  };
}

/**
 * Capture complete website information (screenshot + DOM)
 */
export async function captureWebsiteInfo(): Promise<WebsiteInfo> {
  const [screenshot, domInfo] = await Promise.all([
    captureScreenshotData(),
    Promise.resolve(parseDOMInfo()),
  ]);

  return {
    screenshot,
    ...domInfo,
  };
}
