// ============================================
// popup.js — Command parser & UI
// ============================================

var logArea = document.getElementById('log');
var cmdInput = document.getElementById('cmdInput');
var runBtn = document.getElementById('runBtn');
var statusDot = document.getElementById('statusDot');
var hasEntries = false;

// ── Helpers ──

function escHtml(str) {
  var d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function summarize(obj) {
  if (obj.dataUrl) return 'Screenshot captured';
  if (obj.title && obj.url && obj.scroll) {
    var parts = ['Page: "' + obj.title + '"'];
    var nLinks = (obj.links && obj.links.length) || 0;
    var nBtns = (obj.buttons && obj.buttons.length) || 0;
    parts.push(nLinks + ' links', nBtns + ' buttons');
    if (obj.fillableFields && obj.fillableFields.length) parts.push(obj.fillableFields.length + ' fillable');
    if (obj.searchBoxes && obj.searchBoxes.length) parts.push(obj.searchBoxes.length + ' search');
    return parts.join(' | ');
  }
  if (obj.title && obj.url) return 'Page: "' + obj.title + '"';
  if (obj.text)  return obj.text;
  if (obj.url)   return obj.url;
  if (obj.name)  return 'Field: ' + obj.name;
  if (obj.scrolledBy != null) return 'Scrolled ' + obj.scrolledBy + 'px';
  return JSON.stringify(obj).substring(0, 120);
}

function addLog(cmd, text, isOk) {
  if (!hasEntries) {
    logArea.innerHTML = '';
    hasEntries = true;
  }
  var entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML =
    '<div class="cmd">&gt; ' + escHtml(cmd) + '</div>' +
    '<div class="result ' + (isOk ? 'ok' : 'err') + '">' +
    (isOk ? '✓ ' : '✗ ') + escHtml(text) + '</div>';
  logArea.appendChild(entry);
  logArea.scrollTop = logArea.scrollHeight;
}

// ── Command Parser ──

function parseCommand(raw) {
  var parts = raw.trim().split(/\s+/);
  var cmd = parts[0].toLowerCase();

  switch (cmd) {
    case 'click': {
      var x = parseFloat(parts[1]);
      var y = parseFloat(parts[2]);
      if (!isNaN(x) && !isNaN(y)) {
        return { action: 'clickAtCoordinate', params: { x: x, y: y } };
      }
      return { action: 'clickByName', params: { name: parts.slice(1).join(' ') } };
    }
    case 'fill':
      return { action: 'fillInput', params: { identifier: parts[1], value: parts.slice(2).join(' ') } };
    case 'type':
      return { action: 'typeText', params: { text: parts.slice(1).join(' ') } };
    case 'enter':
      return { action: 'pressEnter', params: {} };
    case 'key':
      return { action: 'pressKey', params: { key: parts.slice(1).join(' ') } };
    case 'scroll': {
      var dir = (parts[1] || 'down').toLowerCase();
      var px = parseInt(parts[2]) || undefined;
      if (dir === 'up')     return { action: 'scrollUp',       params: { pixels: px } };
      if (dir === 'top')    return { action: 'scrollToTop',    params: {} };
      if (dir === 'bottom') return { action: 'scrollToBottom', params: {} };
      return { action: 'scrollDown', params: { pixels: px } };
    }
    case 'goto':
    case 'go':
      return { action: 'goto', params: { url: parts.slice(1).join(' ') } };
    case 'back':
      return { action: 'goBack', params: {} };
    case 'forward':
      return { action: 'goForward', params: {} };
    case 'status':
      return { action: 'getPageStatus', params: {} };
    case 'screenshot':
      return { action: 'screenshot', params: {} };
    case 'result':
    case 'first':
      return { action: 'clickFirstSearchResult', params: {} };
    default:
      return { action: 'clickByName', params: { name: raw.trim() } };
  }
}

// ── Send Command ──

function sendCommand(action, params, callback) {
  chrome.runtime.sendMessage(
    { target: 'background', action: action, params: params },
    function (response) {
      if (chrome.runtime.lastError) {
        callback({ success: false, error: chrome.runtime.lastError.message });
      } else {
        callback(response || { success: false, error: 'No response' });
      }
    }
  );
}

// ── Run ──

function run() {
  var raw = cmdInput.value.trim();
  if (!raw) return;

  var parsed = parseCommand(raw);
  cmdInput.value = '';
  cmdInput.focus();

  sendCommand(parsed.action, parsed.params, function (result) {
    var isOk = result && result.success !== false;
    var text = result.error || summarize(result);
    addLog(raw, text, isOk);
    if (parsed.action === 'getPageStatus' && result && result.success !== false) {
      console.log('[InterfaceAI] Page status (full hashmap):', result);
    }
  });
}

// ── Events ──

runBtn.addEventListener('click', run);
cmdInput.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') run();
});

document.querySelectorAll('.quick-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var cmd = btn.getAttribute('data-cmd');
    var prefill = btn.getAttribute('data-prefill');
    if (prefill != null) {
      cmdInput.value = prefill;
      cmdInput.focus();
      return;
    }
    if (cmd) {
      cmdInput.value = cmd;
      run();
    }
  });
});

// ── Connection Check ──

sendCommand('ping', {}, function (result) {
  if (result && result.success !== false) {
    statusDot.className = 'dot dot-green';
    statusDot.title = 'Connected';
  } else {
    statusDot.className = 'dot dot-red';
    statusDot.title = 'Not connected — refresh the tab';
  }
});
