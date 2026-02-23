// ============================================
// popup.js — Command parser & UI
// ============================================

var logArea = document.getElementById('log');
var cmdInput = document.getElementById('cmdInput');
var runBtn = document.getElementById('runBtn');
var statusDot = document.getElementById('statusDot');
var autocomplete = document.getElementById('autocomplete');
var hasEntries = false;
var selectedIndex = -1;

// ── Command Definitions ──

var COMMANDS = [
  { cmd: '/status',     desc: 'Inspect the page (raw HTML)',     usage: '/status' },
  { cmd: '/click',      desc: 'Click at coords or by text',      usage: '/click <x> <y>  or  /click <text>' },
  { cmd: '/fill',       desc: 'Fill an input field',              usage: '/fill <field> <value>' },
  { cmd: '/enter',      desc: 'Press Enter',                      usage: '/enter' },
  { cmd: '/scroll',     desc: 'Scroll the page',                  usage: '/scroll up|down|top|bottom [px]' },
  { cmd: '/goto',       desc: 'Navigate to URL',                  usage: '/goto <url>' },
  { cmd: '/back',       desc: 'Go back in history',               usage: '/back' },
  { cmd: '/forward',    desc: 'Go forward in history',            usage: '/forward' },
  { cmd: '/screenshot', desc: 'Save screenshot as PNG',           usage: '/screenshot [name]' },
  { cmd: '/result',     desc: 'Click first search result',        usage: '/result' },
];

// ── Autocomplete ──

function showAutocomplete(filter) {
  var matches = COMMANDS.filter(function (c) {
    return c.cmd.startsWith(filter.toLowerCase());
  });

  if (matches.length === 0 || (matches.length === 1 && matches[0].cmd === filter.toLowerCase())) {
    hideAutocomplete();
    return;
  }

  selectedIndex = -1;
  autocomplete.innerHTML = '';

  matches.forEach(function (m) {
    var item = document.createElement('div');
    item.className = 'ac-item';
    item.innerHTML =
      '<span class="ac-cmd">' + escHtml(m.cmd) + '</span>' +
      '<span class="ac-desc">' + escHtml(m.desc) + '</span>';

    item.addEventListener('mousedown', function (e) {
      e.preventDefault();
      cmdInput.value = m.cmd + ' ';
      cmdInput.focus();
      hideAutocomplete();
    });

    autocomplete.appendChild(item);
  });

  autocomplete.style.display = 'block';
}

function hideAutocomplete() {
  autocomplete.style.display = 'none';
  selectedIndex = -1;
}

function navigateAutocomplete(direction) {
  var items = autocomplete.querySelectorAll('.ac-item');
  if (items.length === 0) return;

  if (selectedIndex >= 0) items[selectedIndex].classList.remove('ac-selected');

  selectedIndex += direction;
  if (selectedIndex < 0) selectedIndex = items.length - 1;
  if (selectedIndex >= items.length) selectedIndex = 0;

  items[selectedIndex].classList.add('ac-selected');
  items[selectedIndex].scrollIntoView({ block: 'nearest' });
}

function selectAutocomplete() {
  var items = autocomplete.querySelectorAll('.ac-item');
  if (selectedIndex >= 0 && selectedIndex < items.length) {
    var cmd = items[selectedIndex].querySelector('.ac-cmd').textContent;
    cmdInput.value = cmd + ' ';
    cmdInput.focus();
    hideAutocomplete();
    return true;
  }
  return false;
}

// ── Input Events for Autocomplete ──

cmdInput.addEventListener('input', function () {
  var val = cmdInput.value;
  if (val.startsWith('/') && val.indexOf(' ') === -1) {
    showAutocomplete(val);
  } else {
    hideAutocomplete();
  }
});

cmdInput.addEventListener('keydown', function (e) {
  if (autocomplete.style.display === 'block') {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      navigateAutocomplete(1);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      navigateAutocomplete(-1);
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      if (selectedIndex === -1) navigateAutocomplete(1);
      selectAutocomplete();
      return;
    }
    if (e.key === 'Escape') {
      hideAutocomplete();
      return;
    }
  }

  if (e.key === 'Enter') {
    if (autocomplete.style.display === 'block' && selectedIndex >= 0) {
      e.preventDefault();
      selectAutocomplete();
    } else {
      run();
    }
  }
});

cmdInput.addEventListener('blur', function () {
  setTimeout(hideAutocomplete, 150);
});

// ── Helpers ──

function escHtml(str) {
  var d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function addLog(cmd, result) {
  if (!hasEntries) {
    logArea.innerHTML = '';
    hasEntries = true;
  }

  var isOk = result && result.success !== false;
  var entry = document.createElement('div');
  entry.className = 'log-entry';

  var cmdDiv = document.createElement('div');
  cmdDiv.className = 'cmd';
  cmdDiv.textContent = '> ' + cmd;
  entry.appendChild(cmdDiv);

  // ── Status: show raw DOM ──
  if (result && result.dom) {
    var label = document.createElement('div');
    label.className = 'result ok';
    label.textContent = '✓ ' + result.title + ' — ' + result.url;
    entry.appendChild(label);

    var pre = document.createElement('pre');
    pre.className = 'dom-output';
    pre.textContent = result.dom;
    entry.appendChild(pre);

  // ── Screenshot ──
  } else if (result && result.dataUrl) {
    var msg = document.createElement('div');
    msg.className = 'result ok';
    msg.textContent = '✓ Screenshot captured';
    entry.appendChild(msg);

  // ── Error ──
  } else if (result && result.error) {
    var err = document.createElement('div');
    err.className = 'result err';
    err.textContent = '✗ ' + result.error;
    entry.appendChild(err);

  // ── Generic ──
  } else {
    var text = '';
    if (result) {
      text = result.text || result.url || result.name
        || (result.scrolledBy != null ? 'Scrolled ' + result.scrolledBy + 'px' : '')
        || JSON.stringify(result).substring(0, 200);
    } else {
      text = 'No response';
    }
    var generic = document.createElement('div');
    generic.className = 'result ' + (isOk ? 'ok' : 'err');
    generic.textContent = (isOk ? '✓ ' : '✗ ') + text;
    entry.appendChild(generic);
  }

  logArea.appendChild(entry);
  logArea.scrollTop = logArea.scrollHeight;
}

// ── Command Parser ──

function parseCommand(raw) {
  // Strip leading /
  var stripped = raw.startsWith('/') ? raw.substring(1) : null;
  if (!stripped) return null;

  var parts = stripped.trim().split(/\s+/);
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
    case 'enter':
      return { action: 'pressEnter', params: {} };
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
      return null;
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

  hideAutocomplete();

  if (!raw.startsWith('/')) {
    addLog(raw, { success: false, error: 'Commands must start with /  — type / to see all commands' });
    cmdInput.value = '';
    cmdInput.focus();
    return;
  }

  var parsed = parseCommand(raw);
  cmdInput.value = '';
  cmdInput.focus();

  if (!parsed) {
    addLog(raw, { success: false, error: 'Unknown command. Type / to see all commands.' });
    return;
  }

  sendCommand(parsed.action, parsed.params, function (result) {
    addLog(raw, result);
  });
}

// ── Events ──

runBtn.addEventListener('click', run);

document.querySelectorAll('.quick-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    cmdInput.value = btn.getAttribute('data-cmd');
    run();
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
