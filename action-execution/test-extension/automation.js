// ============================================
// automation.js — Content Script
// Runs inside the browser tab.
// Accepts commands from:
//   1. Terminal CLI via WebSocket (ws://localhost:7878)
//   2. Popup via chrome.runtime.onMessage
// ============================================

(function () {
  // Prevent double-injection
  if (window.__interfaceAI) return;
  window.__interfaceAI = true;

  // ── Action Functions ──

  function clickAtCoordinate(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return { success: false, error: `No element at (${x}, ${y})` };

    const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y };
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.dispatchEvent(new MouseEvent('click', opts));

    return {
      success: true, x, y,
      element: el.tagName,
      text: (el.textContent || '').trim().substring(0, 80)
    };
  }

  function clickByName(name, exactMatch) {
    const selectors = ['button', 'a', '[role="button"]', 'input[type="button"]', 'input[type="submit"]'];
    const lower = name.toLowerCase();

    for (const selector of selectors) {
      for (const el of document.querySelectorAll(selector)) {
        const text = (el.textContent?.trim() || el.value || el.getAttribute('aria-label') || '');
        const matches = exactMatch
          ? text.toLowerCase() === lower
          : text.toLowerCase().includes(lower);
        if (matches) {
          el.click();
          return { success: true, element: el.tagName, text };
        }
      }
    }
    return { success: false, error: `No element found: "${name}"` };
  }

  function scrollUp(pixels)    { window.scrollBy(0, -(pixels || 500)); return { success: true, scrolledBy: -(pixels || 500) }; }
  function scrollDown(pixels)  { window.scrollBy(0, pixels || 500);    return { success: true, scrolledBy: pixels || 500 }; }
  function scrollToTop()       { window.scrollTo(0, 0);                return { success: true }; }
  function scrollToBottom()    { window.scrollTo(0, document.body.scrollHeight); return { success: true }; }

  function fillInput(identifier, value) {
    const lower = identifier.toLowerCase();
    let input =
      document.querySelector(`input[name="${identifier}" i], textarea[name="${identifier}" i]`) ||
      document.querySelector(`#${CSS.escape(identifier)}`) ||
      document.querySelector(`input[placeholder*="${identifier}" i], textarea[placeholder*="${identifier}" i]`) ||
      document.querySelector(`input[aria-label*="${identifier}" i], textarea[aria-label*="${identifier}" i]`);

    if (!input) {
      for (const label of document.querySelectorAll('label')) {
        if (label.textContent.toLowerCase().includes(lower)) {
          input = label.getAttribute('for')
            ? document.getElementById(label.getAttribute('for'))
            : label.querySelector('input, textarea');
          if (input) break;
        }
      }
    }

    if (!input) {
      const typeMap = {
        search:   'input[type="search"], input[name*="search" i]',
        email:    'input[type="email"]',
        password: 'input[type="password"]',
      };
      if (typeMap[lower]) input = document.querySelector(typeMap[lower]);
    }

    if (!input) return { success: false, error: `No input found: "${identifier}"` };

    const setter =
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set ||
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;

    input.focus();
    if (setter) setter.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    return { success: true, name: input.name || input.id || input.placeholder || 'unknown' };
  }

  function clickFirstSearchResult() {
    const selectors = [
      '#search a h3', '#rso a h3', 'div.g a h3',
      '#b_results .b_algo h2 a',
      '[data-testid="result-title-a"]',
      '.result__a',
      'main a h2', 'main a h3',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const link = el.closest('a') || el;
        link.click();
        return { success: true, url: link.href, text: el.textContent?.trim() };
      }
    }
    return { success: false, error: 'No search results found' };
  }

  function pressEnter() {
    const active = document.activeElement || document.body;
    active.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
    active.dispatchEvent(new KeyboardEvent('keyup',   { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
    const form = active.closest?.('form');
    if (form) { form.requestSubmit ? form.requestSubmit() : form.submit(); }
    return { success: true };
  }

  function pressKey(key) {
    const active = document.activeElement || document.body;
    active.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    active.dispatchEvent(new KeyboardEvent('keyup',   { key, bubbles: true }));
    return { success: true };
  }

  function typeText(text) {
    const active = document.activeElement;
    if (!active || active === document.body) return { success: false, error: 'No focused input' };

    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(active, (active.value || '') + text);
    else active.value = (active.value || '') + text;
    active.dispatchEvent(new Event('input', { bubbles: true }));
    return { success: true };
  }

  function getPageStatus() {
    return {
      success: true,
      title: document.title,
      url: window.location.href,
      scroll: {
        position: window.scrollY,
        maxScroll: document.body.scrollHeight,
        percent: Math.round((window.scrollY / Math.max(1, document.body.scrollHeight - window.innerHeight)) * 100),
      },
      headings: [...document.querySelectorAll('h1,h2,h3')].slice(0, 15).map(h => ({
        level: h.tagName, text: h.textContent.trim().substring(0, 100),
      })),
      buttons: [...document.querySelectorAll('button, [role="button"], input[type="submit"]')].slice(0, 20).map(b => ({
        text: (b.textContent?.trim() || b.value || b.getAttribute('aria-label') || '').substring(0, 50),
      })),
      textboxes: [...document.querySelectorAll('input:not([type="hidden"]), textarea')].slice(0, 15).map(i => ({
        name: i.name || i.id || i.placeholder || 'unnamed',
        type: i.type || 'text',
      })),
      links: [...document.querySelectorAll('a[href]')].slice(0, 20).map(a => ({
        text: (a.textContent || '').trim().substring(0, 50),
        href: a.href.substring(0, 100),
      })),
    };
  }

  function gotoUrl(url) { window.location.href = url; return { success: true, url }; }
  function goBack()     { window.history.back();       return { success: true }; }
  function goForward()  { window.history.forward();    return { success: true }; }

  // ── Command Router ──

  function execute(action, params) {
    try {
      switch (action) {
        case 'clickAtCoordinate':     return clickAtCoordinate(params.x, params.y);
        case 'clickByName':           return clickByName(params.name, params.exactMatch);
        case 'scrollUp':              return scrollUp(params.pixels);
        case 'scrollDown':            return scrollDown(params.pixels);
        case 'scrollToTop':           return scrollToTop();
        case 'scrollToBottom':        return scrollToBottom();
        case 'fillInput':             return fillInput(params.identifier, params.value);
        case 'clickFirstSearchResult':return clickFirstSearchResult();
        case 'pressEnter':            return pressEnter();
        case 'pressKey':              return pressKey(params.key);
        case 'typeText':              return typeText(params.text);
        case 'getPageStatus':         return getPageStatus();
        case 'goto':                  return gotoUrl(params.url);
        case 'goBack':                return goBack();
        case 'goForward':             return goForward();
        case 'ping':                  return { success: true, pong: true };
        default:                      return { success: false, error: `Unknown action: ${action}` };
      }
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // ── Listener 1: Chrome Messages (popup / background.js) ──

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const result = execute(message.action, message.params || {});
    sendResponse(result);
    return true;
  });

  // ── Listener 2: WebSocket (terminal CLI) ──

  let ws = null;
  let reconnectDelay = 2000;

  function connectWS() {
    try {
      ws = new WebSocket('ws://localhost:7878');

      ws.onopen = () => {
        console.log('[InterfaceAI] Connected to CLI server');
        reconnectDelay = 2000;
        ws.send(JSON.stringify({
          type: 'connected',
          title: document.title,
          url: window.location.href
        }));
      };

      ws.onmessage = (event) => {
        let msg;
        try { msg = JSON.parse(event.data); } catch { return; }
        const result = execute(msg.action, msg.params || {});
        ws.send(JSON.stringify({ type: 'result', id: msg.id, result }));
      };

      ws.onclose = () => {
        setTimeout(connectWS, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 1.5, 15000);
      };

      ws.onerror = () => ws.close();
    } catch {
      setTimeout(connectWS, reconnectDelay);
    }
  }

  connectWS();

  console.log('[InterfaceAI] Content script ready on', window.location.href);
})();
