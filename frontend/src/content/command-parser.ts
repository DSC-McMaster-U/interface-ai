import type { ActionResult, ActionType, PageStatus } from "./actions";

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
    case "file":
    case "upload":
      return {
        kind: "action",
        action: {
          type: "clickFileInput",
          identifier: parts.slice(1).join(" ") || "file",
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
  obj: ActionResult | PageStatus | Record<string, unknown>,
): string {
  if ("dataUrl" in obj && obj.dataUrl) return "Screenshot captured";

  if ("title" in obj && "url" in obj && "scroll" in obj) {
    const status = obj as PageStatus;
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
    return parts.join(" | ");
  }

  if ("text" in obj && typeof obj.text === "string" && obj.text)
    return obj.text;
  if ("url" in obj && typeof obj.url === "string" && obj.url) return obj.url;
  if ("name" in obj && typeof obj.name === "string" && obj.name)
    return `Field: ${obj.name}`;
  if ("scrolledBy" in obj && obj.scrolledBy != null)
    return `Scrolled ${String(obj.scrolledBy)}px`;
  return JSON.stringify(obj).substring(0, 160);
}
