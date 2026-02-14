#!/usr/bin/env node

// ============================================
// cli.js — Terminal CLI for InterfaceAI
// Starts a WebSocket server on ws://localhost:7878
// The content script (automation.js) connects to it.
// ============================================

const { WebSocketServer } = require('ws');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const PORT = 7878;
var activeSocket = null;
var pendingResolve = null;
var cmdId = 0;

// ── WebSocket Server ──

const wss = new WebSocketServer({ port: PORT });

wss.on('listening', function () {
  console.log('\n\x1b[35m⚡ InterfaceAI CLI\x1b[0m');
  console.log('  WebSocket server on ws://localhost:' + PORT);
  console.log('  Open or refresh a Chrome tab to connect.\n');
});

wss.on('connection', function (ws) {
  activeSocket = ws;

  ws.on('message', function (data) {
    var msg;
    try { msg = JSON.parse(data); } catch (e) { return; }

    if (msg.type === 'connected') {
      console.log('\x1b[32m✅ Connected\x1b[0m → "' + msg.title + '"');
      console.log('   ' + msg.url + '\n');
      showHelp();
      prompt();
      return;
    }

    if (msg.type === 'result' && pendingResolve) {
      pendingResolve(msg.result);
      pendingResolve = null;
    }
  });

  ws.on('close', function () {
    console.log('\n\x1b[33m⚠️  Browser disconnected\x1b[0m');
    activeSocket = null;
  });
});

// ── Send Command ──

function send(action, params) {
  return new Promise(function (resolve) {
    if (!activeSocket || activeSocket.readyState !== 1) {
      resolve({ success: false, error: 'No browser connected' });
      return;
    }

    var id = ++cmdId;
    pendingResolve = resolve;
    activeSocket.send(JSON.stringify({ id: id, action: action, params: params || {} }));

    setTimeout(function () {
      if (pendingResolve === resolve) {
        pendingResolve = null;
        resolve({ success: false, error: 'Timeout' });
      }
    }, 10000);
  });
}

// ── Parse ──

function parseCommand(raw) {
  var parts = raw.trim().split(/\s+/);
  var cmd = parts[0].toLowerCase();

  switch (cmd) {
    case 'click': {
      var x = parseFloat(parts[1]);
      var y = parseFloat(parts[2]);
      if (!isNaN(x) && !isNaN(y)) return { action: 'clickAtCoordinate', params: { x: x, y: y } };
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
    case 'back':       return { action: 'goBack',    params: {} };
    case 'forward':    return { action: 'goForward', params: {} };
    case 'status':     return { action: 'getPageStatus', params: {} };
    case 'screenshot': return { action: 'screenshot', params: { filename: parts[1] } };
    case 'result':
    case 'first':      return { action: 'clickFirstSearchResult', params: {} };
    default:           return null;
  }
}

// ── Print ──

function printResult(result) {
  if (!result) { console.log('  \x1b[31m✗\x1b[0m No response\n'); return; }

  var icon = result.success !== false ? '✓' : '✗';
  var color = result.success !== false ? '\x1b[32m' : '\x1b[31m';

  if (result.error) {
    console.log('  ' + color + icon + '\x1b[0m ' + result.error + '\n');
    return;
  }

  if (result.title && result.url && result.scroll) {
    console.log('  ' + color + icon + '\x1b[0m ' + result.title);
    console.log('    URL: ' + result.url);
    console.log('    Scroll: ' + result.scroll.percent + '%');
    if (result.headings && result.headings.length)  console.log('    Headings: ' + result.headings.map(function (h) { return h.text; }).join(' | '));
    if (result.links && result.links.length)        console.log('    Links: ' + result.links.slice(0, 8).map(function (a) { return a.text || a.href; }).join(', '));
    if (result.buttons && result.buttons.length)    console.log('    Buttons: ' + result.buttons.map(function (b) { return b.text; }).join(', '));
    if (result.fillableFields && result.fillableFields.length) console.log('    Fillable: ' + result.fillableFields.map(function (f) { return f.name; }).join(', '));
    if (result.searchBoxes && result.searchBoxes.length)       console.log('    Search: ' + result.searchBoxes.map(function (s) { return s.name; }).join(', '));
    if (result.sliders && result.sliders.length)    console.log('    Sliders: ' + result.sliders.map(function (s) { return s.name + '(' + s.value + ')'; }).join(', '));
    if (result.checkboxes && result.checkboxes.length) console.log('    Checkboxes: ' + result.checkboxes.map(function (c) { return c.name + (c.checked ? '✓' : ''); }).join(', '));
    if (result.selects && result.selects.length)    console.log('    Selects: ' + result.selects.map(function (s) { return s.name; }).join(', '));
    if (result.paragraphs && result.paragraphs.length) console.log('    Text: ' + result.paragraphs.slice(0, 3).map(function (p) { return p.substring(0, 60) + (p.length > 60 ? '...' : ''); }).join(' | '));
    console.log();
    return;
  }

  var summary = result.text || result.url || result.name
    || (result.scrolledBy != null ? 'Scrolled ' + result.scrolledBy + 'px' : '')
    || JSON.stringify(result);
  console.log('  ' + color + icon + '\x1b[0m ' + summary + '\n');
}

// ── Save Screenshot ──

function saveScreenshot(result, filename) {
  if (!result || !result.dataUrl) {
    printResult(result);
    return;
  }

  var name = filename || 'screenshot-' + Date.now() + '.png';
  if (!name.endsWith('.png')) name += '.png';

  var base64 = result.dataUrl.replace(/^data:image\/png;base64,/, '');
  var filePath = path.resolve(name);
  fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
  console.log('  \x1b[32m✓\x1b[0m Screenshot saved → ' + filePath + '\n');
}

// ── REPL ──

var rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function showHelp() {
  console.log('\x1b[2mCommands:');
  console.log('  click <x> <y>         Click at coordinates');
  console.log('  click <name>          Click button/link by text');
  console.log('  fill <field> <value>  Fill an input field');
  console.log('  type <text>           Type into focused element');
  console.log('  enter                 Press Enter');
  console.log('  key <key>             Press any key');
  console.log('  scroll up|down [px]   Scroll the page');
  console.log('  scroll top|bottom     Jump to edges');
  console.log('  goto <url>            Navigate to URL');
  console.log('  back / forward        Browser history');
  console.log('  status                Inspect the page');
  console.log('  screenshot [name]     Save screenshot as PNG');
  console.log('  result                Click first search result');
  console.log('  help                  Show this message');
  console.log('  exit                  Quit\x1b[0m\n');
}

function prompt() {
  rl.question('\x1b[35m❯\x1b[0m ', function (input) {
    var trimmed = input.trim();
    if (!trimmed) { prompt(); return; }

    if (trimmed === 'exit' || trimmed === 'quit') {
      console.log('\nBye 👋');
      wss.close();
      rl.close();
      process.exit(0);
    }

    if (trimmed === 'help') { showHelp(); prompt(); return; }

    var parsed = parseCommand(trimmed);
    if (!parsed) {
      console.log('  Unknown command. Type "help".\n');
      prompt();
      return;
    }

    console.log('\x1b[2m→ ' + trimmed + '\x1b[0m');
    send(parsed.action, parsed.params).then(function (result) {
      if (parsed.action === 'screenshot') {
        saveScreenshot(result, parsed.params.filename);
      } else {
        printResult(result);
        if (parsed.action === 'getPageStatus' && result && result.success !== false) {
          console.log('\x1b[2mFull status (hashmap):\x1b[0m');
          console.log(JSON.stringify(result, null, 2));
        }
      }
      prompt();
    });
  });
}

rl.on('close', function () { wss.close(); process.exit(0); });
