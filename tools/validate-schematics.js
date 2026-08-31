// Headless schematic validation for assets/schematic-svg.js and lesson schematics.
//
// Usage:
//   node tools/validate-schematics.js
//   node tools/validate-schematics.js --lessons
//   node tools/validate-schematics.js --factories
//   node tools/validate-schematics.js --all
//   node tools/validate-schematics.js lessons/module-01/lesson-08.html
//
// Prints any validation errors/warnings produced by:
// 1) AD.Schematic circuit factories (from assets/schematic-svg.js)
// 2) Lesson-level schematics embedded in lessons/*.html

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ===== STUB DOM IMPLEMENTATION =====

class CanvasContextStub {
  constructor(canvas) {
    this.canvas = canvas;
    this.operations = [];
    this.fillStyle = '#000';
    this.strokeStyle = '#000';
    this.lineWidth = 1;
    this.font = '12px sans-serif';
    this.textAlign = 'left';
    this.textBaseline = 'top';
    this.globalAlpha = 1;
  }

  save() { this.operations.push('save'); }
  restore() { this.operations.push('restore'); }
  beginPath() { this.operations.push('beginPath'); }
  closePath() { this.operations.push('closePath'); }
  moveTo(x, y) { this.operations.push(`moveTo(${x},${y})`); }
  lineTo(x, y) { this.operations.push(`lineTo(${x},${y})`); }
  stroke() { this.operations.push('stroke'); }
  fill() { this.operations.push('fill'); }
  arc(x, y, r, sa, ea) { this.operations.push(`arc(${x},${y},${r})`); }
  rect(x, y, w, h) { this.operations.push(`rect(${x},${y},${w},${h})`); }
  fillRect(x, y, w, h) { this.operations.push(`fillRect(${x},${y},${w},${h})`); }
  strokeRect(x, y, w, h) { this.operations.push(`strokeRect(${x},${y},${w},${h})`); }
  clearRect(x, y, w, h) { this.operations.push(`clearRect(${x},${y},${w},${h})`); }
  fillText(text, x, y) { this.operations.push(`fillText(${text},${x},${y})`); }
  strokeText(text, x, y) { this.operations.push(`strokeText(${text},${x},${y})`); }
  setLineDash(arr) { this.operations.push(`setLineDash([${arr.join(',')}])`); }
  getLineDash() { return []; }
  measureText(text) { return { width: String(text).length * 8 }; }
  translate(x, y) { this.operations.push(`translate(${x},${y})`); }
  rotate(angle) { this.operations.push(`rotate(${angle})`); }
  scale(x, y) { this.operations.push(`scale(${x},${y})`); }
  getImageData(x, y, w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; }
  putImageData() {}
  createLinearGradient() { return { addColorStop: () => {} }; }
  createRadialGradient() { return { addColorStop: () => {} }; }
  quadraticCurveTo(cpx, cpy, x, y) { this.operations.push(`quadraticCurveTo(${cpx},${cpy},${x},${y})`); }
  bezierCurveTo() { this.operations.push('bezierCurveTo'); }
  arcTo() { this.operations.push('arcTo'); }
  ellipse() { this.operations.push('ellipse'); }
  roundRect() { this.operations.push('roundRect'); }
}

class CanvasStub {
  constructor(id, width = 300, height = 150) {
    this.id = id;
    this.width = width;
    this.height = height;
    this.tagName = 'CANVAS';
    this._ctx = null;
    this.style = {};
    this.classList = { add: () => {}, remove: () => {}, contains: () => false, toggle: () => false };
    this._listeners = new Map();
  }

  getContext() {
    if (!this._ctx) this._ctx = new CanvasContextStub(this);
    return this._ctx;
  }

  addEventListener(type, handler) {
    if (!this._listeners.has(type)) this._listeners.set(type, []);
    this._listeners.get(type).push(handler);
  }

  removeEventListener(type, handler) {
    const handlers = this._listeners.get(type);
    if (!handlers) return;
    const idx = handlers.indexOf(handler);
    if (idx >= 0) handlers.splice(idx, 1);
  }

  getAttribute(name) {
    if (name === 'width') return String(this.width);
    if (name === 'height') return String(this.height);
    return null;
  }

  setAttribute(name, value) {
    if (name === 'width') this.width = parseInt(value, 10) || this.width;
    if (name === 'height') this.height = parseInt(value, 10) || this.height;
  }

  getBoundingClientRect() {
    return { width: this.width, height: this.height, top: 0, left: 0, right: this.width, bottom: this.height };
  }
}

class ElementStub {
  constructor(ownerDocument, tagName, namespaceURI = null) {
    this.ownerDocument = ownerDocument;
    this.tagName = String(tagName || 'div').toUpperCase();
    this.namespaceURI = namespaceURI;
    this.attributes = new Map();
    this.children = [];
    this.innerHTML = '';
    this.textContent = '';
    this.id = '';
    this.value = '';
    this.checked = false;
    this.style = {};
    this.dataset = {};
    this.classList = {
      add: () => {},
      remove: () => {},
      contains: () => false,
      toggle: () => false
    };
    this._listeners = new Map();
  }

  setAttribute(name, value) {
    const key = String(name);
    if (key === 'id') this.id = String(value);
    this.attributes.set(key, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(String(name)) ?? null;
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx >= 0) this.children.splice(idx, 1);
    return child;
  }

  addEventListener(type, handler) {
    if (!this._listeners.has(type)) this._listeners.set(type, []);
    this._listeners.get(type).push(handler);
  }

  removeEventListener(type, handler) {
    const handlers = this._listeners.get(type);
    if (!handlers) return;
    const idx = handlers.indexOf(handler);
    if (idx >= 0) handlers.splice(idx, 1);
  }

  dispatchEvent(event) {
    const handlers = this._listeners.get(event.type) || [];
    handlers.forEach((h) => h(event));
  }

  querySelector(selector) {
    if (!selector) return null;
    if (selector.startsWith('#')) {
      return this.ownerDocument.getElementById(selector.slice(1));
    }
    if (!this._qsCache) this._qsCache = new Map();
    if (!this._qsCache.has(selector)) {
      const node = new ElementStub(this.ownerDocument, 'div');
      this._qsCache.set(selector, node);
    }
    return this._qsCache.get(selector);
  }

  querySelectorAll() { return []; }

  getBoundingClientRect() {
    return { width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 };
  }

  getContext() {
    if (!this._ctx) this._ctx = new CanvasContextStub(this);
    return this._ctx;
  }
}

class DocumentStub {
  constructor() {
    this._byId = new Map();
    this.body = new ElementStub(this, 'body');
  }

  createElementNS(namespaceURI, tagName) {
    return new ElementStub(this, tagName, namespaceURI);
  }

  createElement(tagName) {
    if (String(tagName).toLowerCase() === 'canvas') return new CanvasStub('', 300, 150);
    return new ElementStub(this, tagName, null);
  }

  getElementById(id) {
    const key = String(id);
    if (this._byId.has(key)) return this._byId.get(key);
    const node = new ElementStub(this, 'div');
    node.__virtual = true;
    this._byId.set(key, node);
    return node;
  }

  registerElement(el, id) {
    el.id = String(id);
    this._byId.set(String(id), el);
    return el;
  }

  querySelector(selector) {
    if (selector && selector.startsWith('#')) return this.getElementById(selector.slice(1));
    if (!selector) return null;
    if (!this._qsCache) this._qsCache = new Map();
    if (!this._qsCache.has(selector)) {
      const node = new ElementStub(this, 'div');
      this._qsCache.set(selector, node);
    }
    return this._qsCache.get(selector);
  }

  querySelectorAll() { return []; }

  addEventListener(type, handler) {
    if (type === 'DOMContentLoaded' && typeof handler === 'function') handler();
  }

  dispatchEvent() { return true; }

  execCommand() { return false; }
}

function createLocalStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); }
  };
}

function createSilentConsole() {
  return {
    log: () => {},
    warn: () => {},
    error: () => {},
    group: () => {},
    groupCollapsed: () => {},
    groupEnd: () => {},
    table: () => {}
  };
}

// ===== FACTORY VALIDATION =====

function loadSchematicLibForFactories() {
  const document = new DocumentStub();
  const AD = {};
  const window = { document, AD };
  const silentConsole = createSilentConsole();
  const context = vm.createContext({ console: silentConsole, document, AD, window });

  const libPath = path.join(process.cwd(), 'assets', 'schematic-svg.js');
  const code = fs.readFileSync(libPath, 'utf8');
  new vm.Script(code, { filename: libPath }).runInContext(context);

  if (!context.AD || !context.AD.Schematic) {
    throw new Error('Failed to load schematic-svg.js: AD.Schematic is not defined');
  }

  return { context, document, AD: context.AD };
}

function validateFactories() {
  const { AD, document } = loadSchematicLibForFactories();

  const results = [];
  let currentName = null;

  const Schematic = AD.Schematic.Schematic;
  if (!Schematic || !Schematic.prototype || typeof Schematic.prototype.finalize !== 'function') {
    throw new Error('AD.Schematic.Schematic.prototype.finalize not found');
  }
  const origFinalize = Schematic.prototype.finalize;
  Schematic.prototype.finalize = function patchedFinalize(options = {}) {
    const report = origFinalize.call(this, options);
    results.push({ name: currentName ?? '(unknown)', report });
    return report;
  };

  const skip = new Set([
    'create',
    'Schematic',
    'COLORS',
    'resistorTerminals',
    'capacitorTerminals',
    'diodeTerminals',
    'npnTerminals',
    'pnpTerminals',
    'opampTerminals',
    'nmosTerminals',
    'pmosTerminals'
  ]);

  const keys = Object.keys(AD.Schematic)
    .filter((k) => typeof AD.Schematic[k] === 'function' && !skip.has(k))
    .sort();

  const failures = [];
  for (const key of keys) {
    currentName = key;
    const container = document.registerElement(document.createElement('div'), `container-${key}`);
    try {
      AD.Schematic[key](container, {});
    } catch (err) {
      failures.push({ name: key, error: err });
    }
  }

  const merged = new Map();
  for (const { name, report } of results) {
    const prev = merged.get(name) ?? { warnings: [], errors: [] };
    prev.warnings.push(...(report.warnings ?? []));
    prev.errors.push(...(report.errors ?? []));
    merged.set(name, prev);
  }

  const bad = [];
  for (const [name, rep] of merged) {
    const warnCount = rep.warnings.length;
    const errCount = rep.errors.length;
    if (warnCount > 0 || errCount > 0) bad.push({ name, warnCount, errCount, rep });
  }
  bad.sort((a, b) => (b.errCount - a.errCount) || (b.warnCount - a.warnCount) || a.name.localeCompare(b.name));

  return { bad, failures };
}

// ===== LESSON VALIDATION =====

function findLessonFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findLessonFiles(fullPath));
    } else if (entry.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }
  return files;
}

function extractScripts(html) {
  const scripts = [];
  const scriptRe = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRe.exec(html)) !== null) {
    const fullTag = match[0];
    if (/\ssrc\s*=\s*['"][^'"]+['"]/i.test(fullTag)) continue;
    scripts.push(match[1]);
  }
  return scripts;
}

function extractElements(html) {
  const elements = [];
  const tagRe = /<([a-zA-Z0-9-]+)\b[^>]*\bid\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = tagRe.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    const id = match[2];
    const tagText = match[0];
    let width = null;
    let height = null;
    if (tag === 'canvas') {
      const wMatch = tagText.match(/\bwidth\s*=\s*["'](\d+)["']/i);
      const hMatch = tagText.match(/\bheight\s*=\s*["'](\d+)["']/i);
      if (wMatch) width = parseInt(wMatch[1], 10);
      if (hMatch) height = parseInt(hMatch[1], 10);
    }
    elements.push({ tag, id, width, height });
  }
  return elements;
}

function isIIFEStart(script, index) {
  const slice = script.slice(index);
  return /^\(\s*function\b/.test(slice) || /^\(\s*\(\s*\)\s*=>/.test(slice) || /^\(\s*\([^)]*\)\s*=>/.test(slice);
}

function findMatchingBrace(script, startIndex) {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;
  let escape = false;

  for (let i = startIndex; i < script.length; i++) {
    const ch = script[i];
    const next = script[i + 1];

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (inSingle) {
      if (!escape && ch === '\'') inSingle = false;
      escape = ch === '\\' && !escape;
      continue;
    }
    if (inDouble) {
      if (!escape && ch === '"') inDouble = false;
      escape = ch === '\\' && !escape;
      continue;
    }
    if (inTemplate) {
      if (!escape && ch === '`') inTemplate = false;
      escape = ch === '\\' && !escape;
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }

    if (ch === '\'') { inSingle = true; continue; }
    if (ch === '"') { inDouble = true; continue; }
    if (ch === '`') { inTemplate = true; continue; }

    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }

  return -1;
}

function extractIIFEs(script) {
  const blocks = [];
  for (let i = 0; i < script.length; i++) {
    if (!isIIFEStart(script, i)) continue;
    const braceStart = script.indexOf('{', i);
    if (braceStart < 0) continue;
    const braceEnd = findMatchingBrace(script, braceStart);
    if (braceEnd < 0) continue;

    let end = braceEnd + 1;
    let semi = script.indexOf(';', end);
    if (semi < 0) semi = end;
    blocks.push(script.slice(i, semi + 1));
    i = semi;
  }
  return blocks;
}

function isSchematicBlock(code) {
  return /AD\.Schematic|SchematicSVG|Schematic\.create|new\s+SchematicSVG/.test(code);
}

function createLessonContext(html) {
  const document = new DocumentStub();
  const localStorage = createLocalStorage();
  const AD = {};
  const silentConsole = createSilentConsole();
  let timerCounter = 1;
  const taskQueue = [];
  const enqueueTask = (fn) => {
    if (typeof fn === 'function') taskQueue.push(fn);
  };

  const setTimeoutStub = (fn, _ms, ...args) => {
    const id = timerCounter++;
    enqueueTask(() => fn(...args));
    return id;
  };
  const clearTimeoutStub = () => {};
  const setIntervalStub = (fn, _ms, ...args) => {
    const id = timerCounter++;
    // Run at most once via the task queue to avoid infinite loops.
    enqueueTask(() => fn(...args));
    return id;
  };
  const clearIntervalStub = () => {};

  // Pre-register elements found in HTML so getElementById works.
  const elements = extractElements(html);
  for (const el of elements) {
    let node;
    if (el.tag === 'canvas') {
      node = new CanvasStub(el.id, el.width || 300, el.height || 150);
    } else {
      node = new ElementStub(document, el.tag);
    }
    document.registerElement(node, el.id);
  }

  const context = vm.createContext({
    console: silentConsole,
    document,
    window: {},
    AD,
    localStorage,
    setTimeout: setTimeoutStub,
    clearTimeout: clearTimeoutStub,
    setInterval: setIntervalStub,
    clearInterval: clearIntervalStub,
    queueMicrotask: (fn) => Promise.resolve().then(fn),
    requestAnimationFrame: (fn) => setTimeoutStub(() => fn(Date.now()), 0),
    cancelAnimationFrame: (id) => clearTimeoutStub(id)
  });
  context.window = context;
  context.window.addEventListener = () => {};
  context.window.removeEventListener = () => {};
  context.document = document;
  context.localStorage = localStorage;
  context.AD = AD;
  context.navigator = {
    userAgent: 'node',
    clipboard: {
      writeText: async () => true
    }
  };
  context.Event = class EventStub {
    constructor(type) { this.type = type; }
  };

  // Load core libs into the lesson VM.
  const adPath = path.join(process.cwd(), 'assets', 'ad-framework.js');
  const adCode = fs.readFileSync(adPath, 'utf8');
  new vm.Script(adCode, { filename: adPath }).runInContext(context);

  const widgetsPath = path.join(process.cwd(), 'assets', 'widgets.js');
  if (fs.existsSync(widgetsPath)) {
    const widgetsCode = fs.readFileSync(widgetsPath, 'utf8');
    new vm.Script(widgetsCode, { filename: widgetsPath }).runInContext(context);
  }

  const schematicPath = path.join(process.cwd(), 'assets', 'schematic-svg.js');
  const schematicCode = fs.readFileSync(schematicPath, 'utf8');
  new vm.Script(schematicCode, { filename: schematicPath }).runInContext(context);

  const curriculumPath = path.join(process.cwd(), 'assets', 'curriculum.js');
  if (fs.existsSync(curriculumPath)) {
    const curriculumCode = fs.readFileSync(curriculumPath, 'utf8');
    new vm.Script(curriculumCode, { filename: curriculumPath }).runInContext(context);
  }

  const exercisesPath = path.join(process.cwd(), 'assets', 'exercises.js');
  if (fs.existsSync(exercisesPath)) {
    const exercisesCode = fs.readFileSync(exercisesPath, 'utf8');
    new vm.Script(exercisesCode, { filename: exercisesPath }).runInContext(context);
  }

  const runQueuedTasks = (limit = 25) => {
    let count = 0;
    while (taskQueue.length && count < limit) {
      const task = taskQueue.shift();
      task();
      count += 1;
    }
    return count;
  };

  return { context, document, runQueuedTasks };
}

function validateLessonFile(lessonPath) {
  const html = fs.readFileSync(lessonPath, 'utf8');
  const scripts = extractScripts(html);

  const { context, runQueuedTasks } = createLessonContext(html);

  const reports = [];
  const exceptions = [];

  if (context.AD && context.AD.Schematic) {
    const origCreate = context.AD.Schematic.create;
    context.AD.Schematic.create = function patchedCreate(container, options = {}) {
      const sch = origCreate(container, options);
      sch.__containerId = container && container.id ? container.id : '(unknown)';
      return sch;
    };

    const Schematic = context.AD.Schematic.Schematic;
    if (Schematic && Schematic.prototype && typeof Schematic.prototype.finalize === 'function') {
      const origFinalize = Schematic.prototype.finalize;
      Schematic.prototype.finalize = function patchedFinalize(options = {}) {
        const report = origFinalize.call(this, options);
        report.__containerId = this.__containerId || '(unknown)';
        reports.push(report);
        return report;
      };
    }
  }

  const drainQueuedTasks = (scriptIndex, phase) => {
    if (typeof runQueuedTasks !== 'function') return;
    let remaining = 50;
    while (remaining > 0) {
      let ran = 0;
      try {
        ran = runQueuedTasks(Math.min(remaining, 25));
      } catch (err) {
        exceptions.push({
          scriptIndex,
          message: `Queued task error (${phase}): ${err && err.message ? err.message : String(err)}`,
          stack: err && err.stack ? err.stack : null
        });
        return;
      }
      if (ran === 0) break;
      remaining -= ran;
    }
  };

  scripts.forEach((script, idx) => {
    const beforeCount = reports.length;
    try {
      new vm.Script(script, { filename: `${lessonPath}#script${idx + 1}` }).runInContext(context);
    } catch (err) {
      exceptions.push({
        scriptIndex: idx + 1,
        message: err && err.message ? err.message : String(err),
        stack: err && err.stack ? err.stack : null
      });
    }

    drainQueuedTasks(idx + 1, 'post-script');

    // If the script threw and produced no schematic reports, try to salvage schematic IIFEs.
    if (reports.length === beforeCount && exceptions.length > 0) {
      const blocks = extractIIFEs(script).filter(isSchematicBlock);
      blocks.forEach((block, blockIdx) => {
        try {
          new vm.Script(block, { filename: `${lessonPath}#script${idx + 1}-schematic${blockIdx + 1}` }).runInContext(context);
        } catch (err) {
          exceptions.push({
            scriptIndex: idx + 1,
            message: err && err.message ? err.message : String(err),
            stack: err && err.stack ? err.stack : null
          });
        }
      });
      drainQueuedTasks(idx + 1, 'post-salvage');
    }
  });

  return { lessonPath, reports, exceptions };
}

function validateLessons(targetLessonPath = null) {
  const lessonsDir = path.join(process.cwd(), 'lessons');
  const files = targetLessonPath
    ? [path.resolve(targetLessonPath)]
    : findLessonFiles(lessonsDir);

  const results = [];
  for (const file of files) {
    if (!fs.existsSync(file)) {
      results.push({ lessonPath: file, reports: [], exceptions: [{ scriptIndex: 0, message: 'File not found' }] });
      continue;
    }
    results.push(validateLessonFile(file));
  }

  return results;
}

function printFactoryResults(bad, failures) {
  if (failures.length) {
    console.log('\n=== FACTORY EXCEPTIONS (THREW) ===');
    for (const f of failures) console.log(`- ${f.name}: ${f.error && f.error.message ? f.error.message : String(f.error)}`);
  }

  if (!bad.length && !failures.length) {
    console.log('Factory schematics validated with 0 warnings/errors.');
    return;
  }

  console.log('\n=== FACTORY VALIDATION FINDINGS ===');
  for (const item of bad) {
    console.log(`\n--- ${item.name}: ${item.errCount} errors, ${item.warnCount} warnings ---`);
    for (const e of item.rep.errors.slice(0, 20)) console.log(`E: ${e.type}: ${e.message}`);
    if (item.rep.errors.length > 20) console.log(`E: ... +${item.rep.errors.length - 20} more`);
    for (const w of item.rep.warnings.slice(0, 20)) console.log(`W: ${w.type}: ${w.message}`);
    if (item.rep.warnings.length > 20) console.log(`W: ... +${item.rep.warnings.length - 20} more`);
  }

  console.log(`\nFactory summary: ${bad.length} factories with warnings/errors, ${failures.length} factories threw.`);
}

function summarizeLessonResult(result) {
  const hasErrors = result.reports.some((rep) => (rep.errors && rep.errors.length > 0) || (rep.warnings && rep.warnings.length > 0));
  const hasExceptions = result.exceptions.length > 0;
  if (!hasErrors && !hasExceptions) return { hasIssues: false, byContainer: new Map() };

  const byContainer = new Map();
  result.reports.forEach((rep) => {
    const id = rep.__containerId || '(unknown)';
    const bucket = byContainer.get(id) || { errors: new Map(), warnings: new Map() };
    (rep.errors || []).forEach((e) => {
      const key = `${e.type}:${e.message}`;
      if (!bucket.errors.has(key)) bucket.errors.set(key, e);
    });
    (rep.warnings || []).forEach((w) => {
      const key = `${w.type}:${w.message}`;
      if (!bucket.warnings.has(key)) bucket.warnings.set(key, w);
    });
    byContainer.set(id, bucket);
  });

  return { hasIssues: true, byContainer };
}

function printSingleLessonResult(result, options = {}) {
  const { showHeader = false } = options;
  const summary = summarizeLessonResult(result);
  if (!summary.hasIssues) return { hadIssues: false };

  if (showHeader) console.log('\n=== LESSON SCHEMATIC FINDINGS ===');
  const relPath = path.relative(process.cwd(), result.lessonPath).replace(/\\/g, '/');
  console.log(`\n--- ${relPath} ---`);

  for (const [containerId, bucket] of summary.byContainer) {
    const errors = Array.from(bucket.errors.values());
    const warnings = Array.from(bucket.warnings.values());
    if (errors.length === 0 && warnings.length === 0) continue;
    console.log(`  [${containerId}] ${errors.length} errors, ${warnings.length} warnings`);
    errors.slice(0, 20).forEach((e) => console.log(`    E: ${e.type}: ${e.message}`));
    if (errors.length > 20) console.log(`    E: ... +${errors.length - 20} more`);
    warnings.slice(0, 20).forEach((w) => console.log(`    W: ${w.type}: ${w.message}`));
    if (warnings.length > 20) console.log(`    W: ... +${warnings.length - 20} more`);
  }

  if (result.exceptions.length) {
    console.log('  Script exceptions:');
    result.exceptions.forEach((ex) => {
      const stackLine = ex.stack ? String(ex.stack).split('\n')[0] : null;
      const stackInfo = stackLine ? ` | ${stackLine}` : '';
      console.log(`    - script ${ex.scriptIndex}: ${ex.message}${stackInfo}`);
    });
  }

  return { hadIssues: true };
}

function printLessonResults(results) {
  const withIssues = results.filter((r) => summarizeLessonResult(r).hasIssues || r.exceptions.length > 0);

  if (!withIssues.length) {
    console.log('Lesson schematics validated with 0 warnings/errors.');
    return;
  }

  console.log('\n=== LESSON SCHEMATIC FINDINGS ===');
  for (const result of withIssues) {
    printSingleLessonResult(result);
  }

  console.log(`\nLesson summary: ${withIssues.length} lesson files with warnings/errors or exceptions.`);
}

function main() {
  const args = process.argv.slice(2);
  const targetLesson = args.find((arg) => arg.endsWith('.html')) || null;

  const runFactories = args.includes('--factories') || args.includes('--all') || args.length === 0;
  const runLessons = args.includes('--lessons') || args.includes('--all') || args.length === 0 || !!targetLesson;

  let hadIssues = false;

  if (runFactories) {
    const { bad, failures } = validateFactories();
    printFactoryResults(bad, failures);
    if (bad.length || failures.length) hadIssues = true;
  }

  if (runLessons) {
    if (targetLesson) {
      const lessonResults = validateLessons(targetLesson);
      printLessonResults(lessonResults);
      if (lessonResults.some((r) => r.reports.some((rep) => (rep.errors && rep.errors.length > 0) || (rep.warnings && rep.warnings.length > 0)) || r.exceptions.length > 0)) {
        hadIssues = true;
      }
    } else {
      const lessonsDir = path.join(process.cwd(), 'lessons');
      const files = findLessonFiles(lessonsDir);
      let issueFiles = 0;
      let printedHeader = false;
      for (const file of files) {
        const result = validateLessonFile(file);
        const outcome = printSingleLessonResult(result, { showHeader: !printedHeader });
        if (outcome.hadIssues) {
          issueFiles += 1;
          printedHeader = true;
          hadIssues = true;
        }
        if (typeof global.gc === 'function') {
          global.gc();
        }
      }
      if (!printedHeader) {
        console.log('Lesson schematics validated with 0 warnings/errors.');
      } else {
        console.log(`\nLesson summary: ${issueFiles} lesson files with warnings/errors or exceptions.`);
      }
    }
  }

  if (!hadIssues) {
    console.log('\nAll schematics validated with 0 warnings/errors.');
  } else {
    process.exitCode = 1;
  }
}

main();
