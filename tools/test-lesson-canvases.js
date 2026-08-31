/* eslint-disable no-console */
/**
 * Test script to validate that lesson canvases are being drawn to.
 * Uses vm module to simulate browser environment.
 *
 * Usage: node tools/test-lesson-canvases.js [lesson-path]
 * Example: node tools/test-lesson-canvases.js lessons/module-02/lesson-04.html
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Canvas stub that tracks if drawing operations occurred
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
    fillText(text, x, y) { this.operations.push(`fillText("${text}",${x},${y})`); }
    strokeText(text, x, y) { this.operations.push(`strokeText("${text}",${x},${y})`); }
    setLineDash(arr) { this.operations.push(`setLineDash([${arr.join(',')}])`); }
    getLineDash() { return []; }
    measureText(text) { return { width: text.length * 8 }; }
    translate(x, y) { this.operations.push(`translate(${x},${y})`); }
    rotate(angle) { this.operations.push(`rotate(${angle})`); }
    scale(x, y) { this.operations.push(`scale(${x},${y})`); }
    getImageData(x, y, w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; }
    putImageData() {}
    createLinearGradient() { return { addColorStop: () => {} }; }
    createRadialGradient() { return { addColorStop: () => {} }; }
    quadraticCurveTo(cpx, cpy, x, y) { this.operations.push(`quadraticCurveTo(${cpx},${cpy},${x},${y})`); }
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
        if (!this._ctx) {
            this._ctx = new CanvasContextStub(this);
        }
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
        if (handlers) {
            const idx = handlers.indexOf(handler);
            if (idx >= 0) handlers.splice(idx, 1);
        }
    }

    dispatchEvent(event) {
        const handlers = this._listeners.get(event.type) || [];
        handlers.forEach(h => h(event));
    }

    querySelector(selector) {
        return null;
    }

    querySelectorAll(selector) {
        return [];
    }
}

class DocumentStub {
    constructor() {
        this._byId = new Map();
        this._canvases = new Map();
    }

    createElement(tagName) {
        if (tagName.toLowerCase() === 'canvas') {
            return new CanvasStub('', 300, 150);
        }
        return new ElementStub(this, tagName);
    }

    createElementNS(ns, tagName) {
        return new ElementStub(this, tagName);
    }

    getElementById(id) {
        return this._byId.get(String(id)) ?? null;
    }

    querySelector(selector) {
        // Basic ID selector support
        if (selector.startsWith('#')) {
            return this.getElementById(selector.slice(1));
        }
        return null;
    }

    querySelectorAll(selector) {
        return [];
    }

    register(id, element) {
        element.id = id;
        this._byId.set(id, element);
        if (element instanceof CanvasStub) {
            this._canvases.set(id, element);
        }
        return element;
    }
}

function parseHTMLForElements(html) {
    // Extract canvas elements with their dimensions
    const canvasRegex = /<canvas\s+id=["']([^"']+)["']\s+width=["'](\d+)["']\s+height=["'](\d+)["']/gi;
    const canvases = [];
    let match;
    while ((match = canvasRegex.exec(html)) !== null) {
        canvases.push({ id: match[1], width: parseInt(match[2]), height: parseInt(match[3]) });
    }

    // Extract input elements
    const inputRegex = /<input\s+[^>]*id=["']([^"']+)["'][^>]*>/gi;
    const inputDetailRegex = /type=["']([^"']+)["']|value=["']([^"']+)["']|min=["']([^"']+)["']|max=["']([^"']+)["']/gi;
    const inputs = [];
    while ((match = inputRegex.exec(html)) !== null) {
        const id = match[1];
        const fullTag = match[0];
        const details = { id, type: 'text', value: '' };
        let detailMatch;
        while ((detailMatch = inputDetailRegex.exec(fullTag)) !== null) {
            if (detailMatch[1]) details.type = detailMatch[1];
            if (detailMatch[2]) details.value = detailMatch[2];
        }
        inputs.push(details);
    }

    // Extract div containers
    const divRegex = /<div[^>]+id=["']([^"']+)["'][^>]*>/gi;
    const divs = [];
    while ((match = divRegex.exec(html)) !== null) {
        divs.push({ id: match[1] });
    }

    // Extract span elements for output display
    const spanRegex = /<span[^>]+id=["']([^"']+)["'][^>]*>/gi;
    const spans = [];
    while ((match = spanRegex.exec(html)) !== null) {
        spans.push({ id: match[1] });
    }

    return { canvases, inputs, divs, spans };
}

function extractScript(html) {
    const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
    return scriptMatch ? scriptMatch[1] : '';
}

function createBrowserEnvironment(lessonHtml) {
    const document = new DocumentStub();
    const elements = parseHTMLForElements(lessonHtml);

    // Register canvases
    for (const c of elements.canvases) {
        const canvas = new CanvasStub(c.id, c.width, c.height);
        document.register(c.id, canvas);
    }

    // Register inputs
    for (const inp of elements.inputs) {
        const el = new ElementStub(document, 'INPUT');
        el.type = inp.type;
        el.value = inp.value;
        document.register(inp.id, el);
    }

    // Register divs
    for (const d of elements.divs) {
        const el = new ElementStub(document, 'DIV');
        document.register(d.id, el);
    }

    // Register spans
    for (const s of elements.spans) {
        const el = new ElementStub(document, 'SPAN');
        document.register(s.id, el);
    }

    return { document, elements };
}

function loadFrameworks(context) {
    const basePath = process.cwd();

    // Load ad-framework.js
    const adFrameworkPath = path.join(basePath, 'assets', 'ad-framework.js');
    const adCode = fs.readFileSync(adFrameworkPath, 'utf8');
    new vm.Script(adCode, { filename: adFrameworkPath }).runInContext(context);

    // Load widgets.js (contains SpiceNetlistWidget, ChecklistWidget, ExerciseWidget)
    const widgetsPath = path.join(basePath, 'assets', 'widgets.js');
    const widgetsCode = fs.readFileSync(widgetsPath, 'utf8');
    new vm.Script(widgetsCode, { filename: widgetsPath }).runInContext(context);

    // Load schematic-svg.js
    const schematicPath = path.join(basePath, 'assets', 'schematic-svg.js');
    const schematicCode = fs.readFileSync(schematicPath, 'utf8');
    new vm.Script(schematicCode, { filename: schematicPath }).runInContext(context);
}

function testLesson(lessonPath) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${lessonPath}`);
    console.log('='.repeat(60));

    const fullPath = path.join(process.cwd(), lessonPath);
    if (!fs.existsSync(fullPath)) {
        console.log(`ERROR: File not found: ${fullPath}`);
        return { success: false, error: 'File not found' };
    }

    const lessonHtml = fs.readFileSync(fullPath, 'utf8');
    const { document, elements } = createBrowserEnvironment(lessonHtml);
    const script = extractScript(lessonHtml);

    if (!script) {
        console.log('No script found in lesson');
        return { success: true, canvases: [] };
    }

    // Create execution context
    const localStorage = {
        _data: {},
        getItem(key) { return this._data[key] || null; },
        setItem(key, val) { this._data[key] = val; },
        removeItem(key) { delete this._data[key]; }
    };

    const errors = [];
    const warnings = [];

    const captureConsole = {
        log: (...args) => {},
        warn: (...args) => { warnings.push(args.join(' ')); },
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
        Math,
        Array,
        Object,
        String,
        Number,
        Boolean,
        Date,
        JSON,
        parseFloat,
        parseInt,
        isNaN,
        isFinite,
        undefined,
        NaN,
        Infinity,
        setTimeout: (fn) => { try { fn(); } catch(e) { errors.push(e.message); } },
        setInterval: () => 0,
        clearTimeout: () => {},
        clearInterval: () => {},
        navigator: { clipboard: { writeText: async () => true } }
    });

    try {
        // Load frameworks
        loadFrameworks(context);

        // Make AD available
        context.window.AD = context.AD;

        // Override SpiceNetlistWidget, ChecklistWidget, ExerciseWidget AFTER loading widgets.js
        // to avoid DOM errors in headless test
        context.SpiceNetlistWidget = function() {};
        context.ChecklistWidget = function() {};
        context.ExerciseWidget = function() {};

        // Execute lesson script
        new vm.Script(script, { filename: lessonPath }).runInContext(context);

        console.log('\nScript executed successfully');
    } catch (err) {
        console.log(`\nScript execution error: ${err.message}`);
        console.log(`Stack: ${err.stack}`);
        errors.push(err.message);
    }

    // Check canvas states
    console.log('\nCanvas States:');
    const canvasResults = [];
    for (const [id, canvas] of document._canvases) {
        const ctx = canvas._ctx;
        const hasDrawing = ctx ? ctx.hasDrawingOperations() : false;
        const opCount = ctx ? ctx.operations.length : 0;
        const status = hasDrawing ? 'OK' : 'EMPTY';
        console.log(`  ${id}: ${status} (${opCount} operations)`);
        canvasResults.push({ id, hasDrawing, opCount });

        if (!hasDrawing && opCount > 0) {
            console.log(`    Operations: ${ctx.operations.slice(0, 10).join(', ')}${opCount > 10 ? '...' : ''}`);
        }
    }

    // Report errors and warnings
    if (errors.length > 0) {
        console.log('\nErrors:');
        errors.forEach(e => console.log(`  - ${e}`));
    }
    if (warnings.length > 0) {
        console.log('\nWarnings:');
        warnings.slice(0, 10).forEach(w => console.log(`  - ${w}`));
        if (warnings.length > 10) console.log(`  ... and ${warnings.length - 10} more`);
    }

    const emptyCanvases = canvasResults.filter(c => !c.hasDrawing);
    if (emptyCanvases.length > 0) {
        console.log(`\nPROBLEM: ${emptyCanvases.length} canvas(es) have no drawing operations:`);
        emptyCanvases.forEach(c => console.log(`  - ${c.id}`));
    }

    // Only fail if canvases are empty - widget errors in headless test are expected
    const hasCanvasIssue = emptyCanvases.length > 0;
    const hasCriticalError = errors.some(e =>
        !e.includes('addEventListener') &&
        !e.includes('SpiceNetlistWidget') &&
        !e.includes('ChecklistWidget') &&
        !e.includes('ExerciseWidget')
    );

    return {
        success: !hasCanvasIssue && !hasCriticalError,
        errors,
        warnings,
        canvases: canvasResults
    };
}

// Main
const lessonArg = process.argv[2] || 'lessons/module-02/lesson-04.html';
const result = testLesson(lessonArg);

console.log('\n' + '='.repeat(60));
console.log(result.success ? 'TEST PASSED' : 'TEST FAILED');
console.log('='.repeat(60));

process.exit(result.success ? 0 : 1);
