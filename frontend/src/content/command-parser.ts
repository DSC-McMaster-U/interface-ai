import type {
  ActionResult,
  ActionType,
  PageStatus,
  WebsiteContent,
} from "./actions";

export type ParsedCommand =
  | { kind: "action"; action: ActionType }
  | { kind: "screenshot" };

export function parseCommand(raw: string): ParsedCommand {
  const parts = (raw || "").trim().split(/\s+/);
  const cmd = (parts[0] || "").toLowerCase();

  switch (cmd) {
    case "click": {
      const x = parseFloat(parts[1] ?? "");
      const y = parseFloat(parts[2] ?? "");
      if (!Number.isNaN(x) && !Number.isNaN(y)) {
        return { kind: "action", action: { type: "clickAtCoordinate", x, y } };
      }
      return {
        kind: "action",
        action: { type: "clickByName", name: parts.slice(1).join(" ") },
      };
    }
    case "fill":
      return {
        kind: "action",
        action: {
          type: "fillInput",
          identifier: parts[1] || "",
          value: parts.slice(2).join(" "),
        },
      };
    case "select":
      return {
        kind: "action",
        action: {
          type: "selectOption",
          identifier: parts[1] || "",
          value: parts.slice(2).join(" "),
        },
      };
    case "check":
      return {
        kind: "action",
        action: {
          type: "setCheckbox",
          identifier: parts[1] || "",
          checked: true,
        },
      };
    case "uncheck":
      return {
        kind: "action",
        action: {
          type: "setCheckbox",
          identifier: parts[1] || "",
          checked: false,
        },
      };
    case "radio":
      return {
        kind: "action",
        action: {
          type: "selectRadio",
          identifier: parts[1] || "",
          value: parts.slice(2).join(" "),
        },
      };
    case "file":
    case "upload": {
      const identifier = parts[1] || "file";
      const target = parts.slice(2).join(" ").trim();
      if (!target) {
        return {
          kind: "action",
          action: { type: "clickFileInput", identifier },
        };
      }
      const keywordMatch = target.match(/^keyword:(.+)$/i);
      if (keywordMatch) {
        return {
          kind: "action",
          action: {
            type: "uploadFile",
            identifier,
            keyword: keywordMatch[1].trim(),
          },
        };
      }
      const looksLikePath =
        /^[A-Za-z]:[\\/]/.test(target) ||
        target.startsWith("/") ||
        target.startsWith("./") ||
        target.startsWith("../") ||
        /^https?:\/\//i.test(target) ||
        target.includes("\\");
      return {
        kind: "action",
        action: looksLikePath
          ? { type: "uploadFile", identifier, filePath: target }
          : { type: "uploadFile", identifier, keyword: target },
      };
    }
    case "upload-dom":
      return {
        kind: "action",
        action: {
          type: "uploadFileInDom",
          identifier: parts[1] || "file",
          keyword: parts.slice(2).join(" ").trim(),
        },
      };
    case "type":
      return {
        kind: "action",
        action: { type: "typeText", text: parts.slice(1).join(" ") },
      };
    case "enter":
      return { kind: "action", action: { type: "pressEnter" } };
    case "key":
      return {
        kind: "action",
        action: { type: "pressKey", key: parts.slice(1).join(" ") },
      };
    case "scroll": {
      const dir = (parts[1] || "down").toLowerCase();
      const pixels = parseInt(parts[2] ?? "", 10) || undefined;
      if (dir === "up")
        return { kind: "action", action: { type: "scrollUp", pixels } };
      if (dir === "top")
        return { kind: "action", action: { type: "scrollToTop" } };
      if (dir === "bottom")
        return { kind: "action", action: { type: "scrollToBottom" } };
      return { kind: "action", action: { type: "scrollDown", pixels } };
    }
    case "goto":
    case "go":
      return {
        kind: "action",
        action: { type: "goto", url: parts.slice(1).join(" ") },
      };
    case "back":
      return { kind: "action", action: { type: "goBack" } };
    case "forward":
      return { kind: "action", action: { type: "goForward" } };
    case "status":
      return { kind: "action", action: { type: "getPageStatus" } };
    case "content":
      return { kind: "action", action: { type: "getWebsiteContent" } };
    case "screenshot":
      return { kind: "screenshot" };
    case "result":
    case "first":
      return { kind: "action", action: { type: "clickFirstSearchResult" } };
    case "ping":
      return { kind: "action", action: { type: "ping" } };
    default:
      return {
        kind: "action",
        action: { type: "clickByName", name: (raw || "").trim() },
      };
  }
}

export function summarizeResult(
  obj: ActionResult | PageStatus | WebsiteContent | Record<string, unknown>,
): string {
  const payload =
    "data" in obj && obj.data && typeof obj.data === "object"
      ? (obj.data as ActionResult | PageStatus | WebsiteContent | Record<string, unknown>)
      : obj;

  if ("paragraphs" in payload && "fullText" in payload && "title" in payload) {
    const content = payload as WebsiteContent;
    return `Content: "${content.title}" | ${content.paragraphs.length} blocks extracted`;
  }

  if ("dataUrl" in payload && payload.dataUrl) return "Screenshot captured";

  if ("title" in payload && "url" in payload && "scroll" in payload) {
    const status = payload as PageStatus;
    const parts = [`Page: "${status.title}"`];
    parts.push(
      `${status.links?.length ?? 0} links`,
      `${status.buttons?.length ?? 0} buttons`,
    );
    if (status.fillableFields?.length)
      parts.push(`${status.fillableFields.length} fillable`);
    if (status.searchBoxes?.length)
      parts.push(`${status.searchBoxes.length} search`);
    if (status.selects?.length)
      parts.push(`${status.selects.length} dropdowns`);
    if (status.fileInputs?.length)
      parts.push(`${status.fileInputs.length} file inputs`);
    if (status.paragraphs?.length)
      parts.push(`${status.paragraphs.length} paragraphs`);
    return parts.join(" | ");
  }

  if ("text" in payload && typeof payload.text === "string" && payload.text)
    return payload.text;
  if ("url" in payload && typeof payload.url === "string" && payload.url)
    return payload.url;
  if ("name" in payload && typeof payload.name === "string" && payload.name)
    return `Field: ${payload.name}`;
  if ("fileName" in payload && typeof payload.fileName === "string")
    return `Uploaded: ${payload.fileName}`;
  if ("action" in payload && payload.action === "dom-file-pick")
    return `Picked in-page file item: ${String(payload.text || payload.keyword || "")}`;
  if ("scrolledBy" in payload && payload.scrolledBy != null)
    return `Scrolled ${String(payload.scrolledBy)}px`;
  return JSON.stringify(payload).substring(0, 160);
}
