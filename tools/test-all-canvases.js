/* eslint-disable no-console */
/**
 * Batch test script to validate that ALL lesson canvases are being drawn to.
 *
 * Usage: node tools/test-all-canvases.js
 *
 * This will test every lesson file that contains <canvas> elements and report:
 * - Which lessons pass (all canvases have drawing operations)
 * - Which lessons fail (some canvases are empty)
 * - Summary statistics
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ===== STUBS FOR HEADLESS TESTING =====

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
    moveTo(x, y) { this.operations.push(`moveTo`); }
    lineTo(x, y) { this.operations.push(`lineTo`); }
    stroke() { this.operations.push('stroke'); }
    fill() { this.operations.push('fill'); }
    arc(x, y, r, sa, ea) { this.operations.push(`arc`); }
    arcTo(x1, y1, x2, y2, r) { this.operations.push(`arcTo`); }
    rect(x, y, w, h) { this.operations.push(`rect`); }
    clip() { this.operations.push('clip'); }
    isPointInPath() { return false; }
    drawImage() { this.operations.push('drawImage'); }
    fillRect(x, y, w, h) { this.operations.push(`fillRect`); }
    strokeRect(x, y, w, h) { this.operations.push(`strokeRect`); }
    clearRect(x, y, w, h) { this.operations.push(`clearRect`); }
    fillText(text, x, y) { this.operations.push(`fillText`); }
    strokeText(text, x, y) { this.operations.push(`strokeText`); }
    setLineDash(arr) { this.operations.push(`setLineDash`); }
    getLineDash() { return []; }
    measureText(text) { return { width: text.length * 8 }; }
    translate(x, y) { this.operations.push(`translate`); }
    rotate(angle) { this.operations.push(`rotate`); }
    scale(x, y) { this.operations.push(`scale`); }
    getImageData(x, y, w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; }
    putImageData() {}
    createLinearGradient() { return { addColorStop: () => {} }; }
    createRadialGradient() { return { addColorStop: () => {} }; }
    quadraticCurveTo(cpx, cpy, x, y) { this.operations.push(`quadraticCurveTo`); }
    bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) { this.operations.push('bezierCurveTo'); }

    hasDrawingOperations() {
        const drawOps = ['stroke', 'fill', 'fillRect', 'strokeRect'];
        return this.operations.some(op => drawOps.some(d => op.startsWith(d)));
    }
}

class CanvasStub {
    constructor(id, width = 300, height = 150) {
        this.id = id;
        this.width = width;
        this.height = height;
        this.tagName = 'CANVAS';
        this._ctx = null;
        this.style = {};
        this.classList = { add: () => {}, remove: () => {}, contains: () => false };
    }

    getContext(type) {
        if (!this._ctx) this._ctx = new CanvasContextStub(this);
        return this._ctx;
    }

    getAttribute(name) {
        if (name === 'width') return String(this.width);
        if (name === 'height') return String(this.height);
        return null;
    }

    setAttribute(name, value) {
        if (name === 'width') this.width = parseInt(value) || 300;
        if (name === 'height') this.height = parseInt(value) || 150;
    }
}

class ElementStub {
    constructor(document, tagName) {
        this.ownerDocument = document;
        this.tagName = tagName.toUpperCase();
        this.id = '';
        this.className = '';
        this.innerHTML = '';
        this.textContent = '';
        this.value = '';
        this.checked = false;
        this.style = {};
        this.children = [];
        this.attributes = new Map();
        this._listeners = new Map();
        this.classList = {
            add: () => {},
            remove: () => {},
            contains: () => false,
            toggle: () => false
        };
    }

    setAttribute(name, value) {
        if (name === 'id') this.id = String(value);
        if (name === 'class') this.className = String(value);
        if (name === 'value') this.value = String(value);
        this.attributes.set(String(name), String(value));
    }

    getAttribute(name) {
        if (name === 'id') return this.id;
        if (name === 'class') return this.className;
        if (name === 'value') return this.value;
        return this.attributes.get(String(name)) ?? null;
    }

    appendChild(child) { this.children.push(child); return child; }
    removeChild(child) { const idx = this.children.indexOf(child); if (idx >= 0) this.children.splice(idx, 1); return child; }
    addEventListener(type, handler) { if (!this._listeners.has(type)) this._listeners.set(type, []); this._listeners.get(type).push(handler); }
    removeEventListener(type, handler) { const handlers = this._listeners.get(type); if (handlers) { const idx = handlers.indexOf(handler); if (idx >= 0) handlers.splice(idx, 1); } }
    dispatchEvent(event) { const handlers = this._listeners.get(event.type) || []; handlers.forEach(h => h(event)); }
    querySelector(selector) { return null; }
    querySelectorAll(selector) { return []; }
}

class DocumentStub {
    constructor() {
        this._byId = new Map();
        this._canvases = new Map();
    }

    createElement(tagName) {
        if (tagName.toLowerCase() === 'canvas') return new CanvasStub('', 300, 150);
        return new ElementStub(this, tagName);
    }

    createElementNS(ns, tagName) { return new ElementStub(this, tagName); }
    getElementById(id) { return this._byId.get(String(id)) ?? null; }
    querySelector(selector) { if (selector.startsWith('#')) return this.getElementById(selector.slice(1)); return null; }
    querySelectorAll(selector) { return []; }

    register(id, element) {
        element.id = id;
        this._byId.set(id, element);
        if (element instanceof CanvasStub) this._canvases.set(id, element);
        return element;
    }
}

// ===== PARSING =====

function parseHTMLForElements(html) {
    const canvasRegex = /<canvas\s+[^>]*id=["']([^"']+)["'][^>]*>/gi;
    const widthRegex = /width=["'](\d+)["']/i;
    const heightRegex = /height=["'](\d+)["']/i;
    const canvases = [];
    let match;
    while ((match = canvasRegex.exec(html)) !== null) {
        const fullTag = match[0];
        const id = match[1];
        const widthMatch = fullTag.match(widthRegex);
        const heightMatch = fullTag.match(heightRegex);
        canvases.push({
            id,
            width: widthMatch ? parseInt(widthMatch[1]) : 300,
            height: heightMatch ? parseInt(heightMatch[1]) : 150
        });
    }

    const inputRegex = /<input\s+[^>]*id=["']([^"']+)["'][^>]*/gi;
    const inputs = [];
    while ((match = inputRegex.exec(html)) !== null) {
        const fullTag = match[0];
        const id = match[1];
        const typeMatch = fullTag.match(/type=["']([^"']+)["']/i);
        const valueMatch = fullTag.match(/value=["']([^"']+)["']/i);
        inputs.push({ id, type: typeMatch ? typeMatch[1] : 'text', value: valueMatch ? valueMatch[1] : '' });
    }

    const divRegex = /<div[^>]+id=["']([^"']+)["'][^>]*>/gi;
    const divs = [];
    while ((match = divRegex.exec(html)) !== null) divs.push({ id: match[1] });

    const spanRegex = /<span[^>]+id=["']([^"']+)["'][^>]*>/gi;
    const spans = [];
    while ((match = spanRegex.exec(html)) !== null) spans.push({ id: match[1] });

    return { canvases, inputs, divs, spans };
}

function extractScript(html) {
    // Extract ALL script blocks, not just the first one
    const scriptRegex = /<script>([\s\S]*?)<\/script>/g;
    const scripts = [];
    let match;
    while ((match = scriptRegex.exec(html)) !== null) {
        scripts.push(match[1]);
    }
    return scripts.join('\n;\n');  // Join with semicolon to prevent syntax issues
}

// ===== FRAMEWORK LOADING =====

let cachedFrameworks = null;

function loadFrameworks() {
    if (cachedFrameworks) return cachedFrameworks;

    const basePath = process.cwd();
    const adCode = fs.readFileSync(path.join(basePath, 'assets', 'ad-framework.js'), 'utf8');
    const widgetsCode = fs.readFileSync(path.join(basePath, 'assets', 'widgets.js'), 'utf8');
    const schematicCode = fs.readFileSync(path.join(basePath, 'assets', 'schematic-svg.js'), 'utf8');

    cachedFrameworks = { adCode, widgetsCode, schematicCode };
    return cachedFrameworks;
}

// ===== TEST SINGLE LESSON =====

function testLesson(lessonPath) {
    const fullPath = path.join(process.cwd(), lessonPath);
    if (!fs.existsSync(fullPath)) {
        return { success: false, error: 'File not found', canvases: [] };
    }

    const lessonHtml = fs.readFileSync(fullPath, 'utf8');
    const elements = parseHTMLForElements(lessonHtml);

    if (elements.canvases.length === 0) {
        return { success: true, canvases: [], note: 'No canvases' };
    }

    const document = new DocumentStub();

    // Register elements
    for (const c of elements.canvases) {
        document.register(c.id, new CanvasStub(c.id, c.width, c.height));
    }
    for (const inp of elements.inputs) {
        const el = new ElementStub(document, 'INPUT');
        el.type = inp.type;
        el.value = inp.value;
        document.register(inp.id, el);
    }
    for (const d of elements.divs) {
        document.register(d.id, new ElementStub(document, 'DIV'));
    }
    for (const s of elements.spans) {
        document.register(s.id, new ElementStub(document, 'SPAN'));
    }

    const script = extractScript(lessonHtml);
    if (!script) {
        return { success: true, canvases: elements.canvases.map(c => ({ id: c.id, hasDrawing: false, note: 'No script' })) };
    }

    // Create context
    const localStorage = {
        _data: {},
        getItem(key) { return this._data[key] || null; },
        setItem(key, val) { this._data[key] = val; },
        removeItem(key) { delete this._data[key]; }
    };

    const errors = [];
    const captureConsole = {
        log: () => {},
        warn: () => {},
        error: (...args) => { errors.push(args.join(' ')); },
        group: () => {},
        groupCollapsed: () => {},
        groupEnd: () => {},
        table: () => {}
    };

    const context = vm.createContext({
        console: captureConsole,
        document,
        window: { document, AD: {}, localStorage },
        AD: {},
        localStorage,
        Math, Array, Object, String, Number, Boolean, Date, JSON,
        parseFloat, parseInt, isNaN, isFinite, undefined, NaN, Infinity,
        setTimeout: (fn) => { try { fn(); } catch(e) { errors.push(e.message); } },
        setInterval: () => 0,
        clearTimeout: () => {},
        clearInterval: () => {},
        requestAnimationFrame: (fn) => { try { fn(0); } catch(e) {} return 0; },
        cancelAnimationFrame: () => {},
        navigator: { clipboard: { writeText: async () => true } }
    });

    try {
        const { adCode, widgetsCode, schematicCode } = loadFrameworks();

        new vm.Script(adCode, { filename: 'ad-framework.js' }).runInContext(context);
        new vm.Script(widgetsCode, { filename: 'widgets.js' }).runInContext(context);
        new vm.Script(schematicCode, { filename: 'schematic-svg.js' }).runInContext(context);

        context.window.AD = context.AD;

        // Expose SchematicSVG for lessons that use `new SchematicSVG()`
        // The script sets window.SchematicSVG = SchematicSVGBuilder
        if (context.window.SchematicSVG) {
            context.SchematicSVG = context.window.SchematicSVG;
        }

        // Override widgets to avoid DOM errors
        context.SpiceNetlistWidget = function() {};
        context.ChecklistWidget = function() {};
        context.ExerciseWidget = function() {};

        new vm.Script(script, { filename: lessonPath }).runInContext(context);
    } catch (err) {
        // Check if it's a critical error (not DOM/widget-related)
        const nonCriticalPatterns = [
            'addEventListener',
            'SpiceNetlistWidget',
            'ChecklistWidget',
            'ExerciseWidget',
            'appendChild',
            'Cannot read properties of null',
            'Cannot set properties of null',
            'is not a constructor',  // Often a consequence of earlier DOM error
            'is not defined',         // Often missing function due to DOM error
            'innerHTML',
            'textContent',
            'setAttribute',
            'getElementsBy',
            'querySelector'
        ];
        const isCritical = !nonCriticalPatterns.some(p => err.message.includes(p));

        if (isCritical) {
            return {
                success: false,
                error: err.message,
                canvases: elements.canvases.map(c => ({ id: c.id, hasDrawing: false }))
            };
        }
    }

    // Check canvas states
    const canvasResults = [];
    for (const [id, canvas] of document._canvases) {
        const ctx = canvas._ctx;
        const hasDrawing = ctx ? ctx.hasDrawingOperations() : false;
        const opCount = ctx ? ctx.operations.length : 0;
        canvasResults.push({ id, hasDrawing, opCount });
    }

    const emptyCanvases = canvasResults.filter(c => !c.hasDrawing);

    return {
        success: emptyCanvases.length === 0,
        canvases: canvasResults,
        emptyCanvases: emptyCanvases.map(c => c.id)
    };
}

// ===== FIND ALL LESSONS WITH CANVASES =====

function findLessonsWithCanvases() {
    const lessonsDir = path.join(process.cwd(), 'lessons');
    const lessons = [];

    function scanDir(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                scanDir(fullPath);
            } else if (entry.isFile() && entry.name.endsWith('.html')) {
                const content = fs.readFileSync(fullPath, 'utf8');
                if (content.includes('<canvas')) {
                    lessons.push(fullPath.replace(process.cwd() + path.sep, '').replace(/\\/g, '/'));
                }
            }
        }
    }

    scanDir(lessonsDir);
    return lessons.sort();
}

// ===== MAIN =====

function main() {
    console.log('='.repeat(70));
    console.log('  CANVAS VISUALIZATION TEST SUITE');
    console.log('='.repeat(70));
    console.log();

    const lessons = findLessonsWithCanvases();
    console.log(`Found ${lessons.length} lessons with canvas elements\n`);

    const results = {
        passed: [],
        failed: [],
        errors: []
    };

    for (const lesson of lessons) {
        process.stdout.write(`Testing ${lesson}... `);
        const result = testLesson(lesson);

        if (result.error && !result.success) {
            console.log(`ERROR: ${result.error}`);
            results.errors.push({ lesson, error: result.error });
        } else if (!result.success) {
            console.log(`FAIL (empty: ${result.emptyCanvases.join(', ')})`);
            results.failed.push({ lesson, emptyCanvases: result.emptyCanvases });
        } else {
            const canvasCount = result.canvases.length;
            console.log(`PASS (${canvasCount} canvas${canvasCount !== 1 ? 'es' : ''})`);
            results.passed.push({ lesson, canvasCount });
        }
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('  SUMMARY');
    console.log('='.repeat(70));
    console.log(`  Total lessons tested: ${lessons.length}`);
    console.log(`  Passed: ${results.passed.length}`);
    console.log(`  Failed: ${results.failed.length}`);
    console.log(`  Errors: ${results.errors.length}`);

    if (results.failed.length > 0) {
        console.log('\n--- FAILED LESSONS ---');
        for (const f of results.failed) {
            console.log(`  ${f.lesson}`);
            console.log(`    Empty canvases: ${f.emptyCanvases.join(', ')}`);
        }
    }

    if (results.errors.length > 0) {
        console.log('\n--- ERRORS ---');
        for (const e of results.errors) {
            console.log(`  ${e.lesson}`);
            console.log(`    Error: ${e.error}`);
        }
    }

    console.log('\n' + '='.repeat(70));
    const allPass = results.failed.length === 0 && results.errors.length === 0;
    console.log(allPass ? '  ALL TESTS PASSED' : '  SOME TESTS FAILED');
    console.log('='.repeat(70));

    process.exit(allPass ? 0 : 1);
}

main();
