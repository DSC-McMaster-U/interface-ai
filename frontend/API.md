# Frontend API Documentation

This document describes all HTTP API endpoints that the Chrome extension sends to the backend server. Use this as a reference when implementing the backend.

### Architecture

1. **Content scripts** run in the webpage context and can access the DOM, but cannot make HTTP requests to `localhost` due to CORS restrictions.

2. **Background scripts** service workers that can make HTTP requests without CORS issues, and can use Chrome APIs like `chrome.tabs.captureVisibleTab()` to take screenshots.

3. All API calls go through the background script as a proxy.

## Base URL

```
http://localhost:5000
```

Configured in `src/background.ts`

## API Endpoints

### 1. POST `/api/relay`

Receive a user's chat message along with complete website context. Called every time a user sends a message through the InterfaceAI chat overlay.

**Source:** `src/content/ui-handlers.ts` → `src/background.ts` → Backend

#### Flow

```
User types message → Content Script captures website info → Background Script sends to backend
```

1. User types a message in the overlay and clicks "Send"
2. Content script (`ui-handlers.ts`) calls `captureWebsiteInfo()` which:
   - Sends `CAPTURE_SCREENSHOT` message to background script
   - Background script calls `chrome.tabs.captureVisibleTab()` to get screenshot
   - Content script parses the DOM for forms, inputs, links, buttons, metadata
3. Content script sends `API_REQUEST` message to background script
4. Background script makes HTTP POST to `/api/relay`

#### Request Body

```typescript
{
  // The user's chat message
  message: string;

  // Complete website context
  websiteInfo: {
    // Base64 PNG screenshot of visible viewport & format: "data:image/png;base64,iVBORw0KGgo..."
    screenshot: string | null;

    // Cleaned HTML of the page (scripts, styles, iframes removed) and Truncated to 50KB max with "<!-- HTML truncated -->" appended if exceeded
    html: string;

    url: string;

    title: string;

    metadata: {
      description: string | null;
      keywords: string | null;
      viewport: string | null;
    }

    forms: Array<{
      id: string | null;
      name: string | null;
      action: string | null; // Form action URL
      method: string | null; // GET, POST, etc.
      inputCount: number; // Number of input fields in form
    }>;

    links: Array<{
      href: string | null;
      text: string; // max 100 chars
      id: string | null;
    }>;

    buttons: Array<{
      text: string; // max 100 chars
      id: string | null;
      type: string | null; // button, submit, etc.
      name: string | null;
    }>;

    inputs: Array<{
      type: string | null; // text, email, password, select, textarea, etc.
      name: string | null;
      id: string | null;
      placeholder: string | null;
      value: string; // max 200 chars, [hidden] for passwords
      label: string | null; // Associated <label> text or aria-label
    }>;
  }
}
```

#### Expected Response

```typescript
{
  // Message to display to the user in the chat
  echo: string;
}
```

#### Example Response

```json
{
  "echo": "I can see the contact form. Fill in your name, email, and message, then click the Submit button."
}
```

---

### 2. POST `/api/website-info`

**Purpose:** Receive website context when the backend explicitly requests it. Called when the backend needs fresh website information (e.g., to check if a page has changed, or to get context for a multi-step automation task).

**Source:** Backend triggers → `src/background.ts` → `src/content.ts` → `src/background.ts` → Backend

#### Flow

```
Backend needs info → (some trigger mechanism) → Background sends REQUEST_WEBSITE_INFO to Content
→ Content captures info → Content sends to Background → Background POSTs to /api/website-info
```

The extension polls the backend every second to check for pending requests. This is necessary because Chrome extension service workers cannot receive incoming HTTP requests - they can only make outgoing requests.

#### How It Works

1. Extension polls `GET /api/pending-requests` every 5 seconds
2. If backend returns `{ pending: true }`, the extension captures website info
3. Extension sends the captured data to `POST /api/website-info`

#### Request Body

Same structure as `websiteInfo` in `/api/relay`, with an additional field:

```typescript
{
  screenshot: string | null;
  html: string;
  url: string;
  title: string;
  metadata: {
    description: string | null;
    keywords: string | null;
    viewport: string | null;
  }
  forms: Array<FormInfo>;
  links: Array<LinkInfo>;
  buttons: Array<ButtonInfo>;
  inputs: Array<InputInfo>;

  // Indicates this was triggered by a backend request
  trigger: "backend_request";
}
```

#### Expected Response

```typescript
{
  success: boolean;
  // Any additional data you want to return
}
```

### 3. GET `/api/pending-requests`

**Purpose:** The extension polls this endpoint to check if the backend needs website information. This is the mechanism that allows the backend to "trigger" the extension.

**Source:** `src/background.ts` polls this endpoint every 5 seconds

#### Flow

```
Extension polls → Backend returns true/false → If true, extension captures info → POSTs to /api/website-info
```

#### Request

No body. GET request.

#### Response

```typescript
{
  pending: boolean; // true = send website info, false = do nothing
}
```

#### Example Responses

```json
{ "pending": false }
```

```json
{ "pending": true }
```

#### Backend Implementation Notes

- Return `{ pending: true }` when you need fresh website info
- After returning `true`, set it back to `false` until you need info again
- The extension will send website info to `POST /api/website-info` within a few seconds

## Data Limits & Notes

| Field                      | Limit     | Notes                                                  |
| -------------------------- | --------- | ------------------------------------------------------ |
| `screenshot`               | ~1-3 MB   | Base64 PNG of visible viewport, 100% quality           |
| `html`                     | 50 KB     | Scripts, styles, iframes removed. Truncated if larger. |
| `forms`                    | All       | No limit                                               |
| `links`                    | 50        | First 50 only                                          |
| `buttons`                  | 30        | First 30 only                                          |
| `inputs`                   | 50        | First 50 only                                          |
| `link.text`, `button.text` | 100 chars | Truncated                                              |
| `input.value`              | 200 chars | Truncated, passwords show as "[hidden]"                |

## Internal Chrome Messages

These are internal messages between the content script and background script.

| Message Type                        | Direction             | Purpose                                                         |
| ----------------------------------- | --------------------- | --------------------------------------------------------------- |
| `API_REQUEST`                       | Content → Background  | Proxy an HTTP request to the backend                            |
| `CAPTURE_SCREENSHOT`                | Content → Background  | Request screenshot via `chrome.tabs.captureVisibleTab()`        |
| `REQUEST_WEBSITE_INFO`              | Background → Content  | Tell content script to capture and send website info            |
| `REQUEST_WEBSITE_INFO_FROM_CONTENT` | External → Background | Trigger a website info request (for backend-initiated requests) |
| `TOGGLE_OVERLAY`                    | Background → Content  | Show/hide the UI overlay                                        |
| `OPEN_SETTINGS`                     | Background → Content  | Open settings panel                                             |
| `GET_USER_SETTINGS`                 | Content → Background  | Fetch user settings                                             |
| `UPDATE_USER_SETTINGS`              | Content → Background  | Update user settings                                            |
