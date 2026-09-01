#!/usr/bin/env node
/**
 * REPLACE SPICE NETLISTS WITH "BUILD IT IN CIRCUIT TOY" CARDS
 *
 * The course is not a SPICE tutorial and a wall of netlist syntax teaches
 * nothing about electronics - it teaches a file format, and one the reader has
 * no simulator for. But the netlists are not worthless: each one is a complete,
 * unambiguous description of a circuit. So this does not delete them, it
 * TRANSLATES them - into a parts-and-connections table a person can build from,
 * plus what to run and what to watch, pointing at Circuit Toy.
 *
 * SAFETY. Per the project's editing rules this never splices by index. For each
 * lesson it finds two exact substrings - the SPICE card and the widget call -
 * asserts each occurs exactly once, and writes the file only if BOTH matched.
 * A lesson that does not match cleanly is reported and left completely alone.
 *
 *   node tools/despice.js --dry            report what would change
 *   node tools/despice.js --dry -v         also print the generated card
 *   node tools/despice.js                  do it
 *   node tools/despice.js lessons/module-01/lesson-02.html
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const DRY = process.argv.includes('--dry');
const VERBOSE = process.argv.includes('-v');
const TIDY = process.argv.includes('--tidy');
const TOY = 'https://github.com/jfalvarez1/circuit_toy';

/**
 * --tidy: sweep up after a conversion.
 *
 * Many widget calls sat inside a `if (typeof SpiceNetlistWidget !== 'undefined')`
 * guard. Removing the call leaves the guard behind as an empty if-block that
 * still names the widget, so a grep for SPICE keeps finding it and the code
 * keeps testing for a class nothing uses. This removes the empty guards, their
 * "// SPICE widget" comments, and any heading text left saying SPICE.
 */
function tidy(files) {
    let changed = 0;
    files.forEach(f => {
        const p = path.join(ROOT, f);
        const before = fs.readFileSync(p, 'utf8');
        let s = before;

        // an empty guard, with or without a leading comment line
        s = s.replace(
            /[ \t]*\/\/[^\n]*SPICE[^\n]*\n(?=[ \t]*if \(typeof SpiceNetlistWidget)/gi, '');
        s = s.replace(
            /[ \t]*if \(typeof SpiceNetlistWidget !== ['"]undefined['"]\)\s*\{\s*\}\s*\n/g, '');

        // the widget call often lived alone inside an initSpice() helper, which
        // is now an empty function that is still declared and still called.
        s = s.replace(/[ \t]*\/\/[^\n]*SPICE[^\n]*\n(?=[ \t]*function initSpice)/gi, '');
        s = s.replace(/[ \t]*function initSpice\s*\(\s*\)\s*\{\s*\}\s*\n/g, '');
        // NOTE the \r? on every one of these. The working tree is CRLF, so a
        // pattern ending [ \t]*\n silently never matches a real line - which is
        // exactly how the initSpice() CALLS survived a pass that successfully
        // removed the initSpice() DECLARATIONS (that one ended in \s*, which
        // does match \r).
        s = s.replace(/^[ \t]*initSpice\s*\(\s*\)\s*;[ \t]*\r?\n/gm, '');

        // comment banners left over the hole where the netlist was
        s = s.replace(/^[ \t]*\/\/[ \t]*=+[ \t]*SPICE[^\r\n]*\r?\n/gim, '');
        s = s.replace(/^[ \t]*\/\/[ \t]*SPICE(?:[ \t]+Netlist)?[ \t]*\r?\n/gim, '');
        s = s.replace(/^[ \t]*<!--[ \t]*SPICE Netlist[ \t]*-->[ \t]*\r?\n/gim, '');

        // headings that still announce SPICE
        s = s.replace(/(<h[23]>)\s*SPICE Simulation\s*-\s*([^<]*)(<\/h[23]>)/gi,
                      '$1Simulating $2$3');
        s = s.replace(/(<h[23]>)\s*SPICE (Simulation|Netlist)\s*(<\/h[23]>)/gi,
                      '$1Build it in Circuit Toy$3');
        s = s.replace(/(<h[23]>)([^<]*?)\bSPICE Model(?: for)?\b([^<]*)(<\/h[23]>)/gi,
                      '$1$2Device model$3$4');
        s = s.replace(/(<h[23]>)\s*Essential SPICE Parameters\s*(<\/h[23]>)/gi,
                      '$1The model parameters that matter$2');

        // three or more blank lines collapse to one
        s = s.replace(/\n[ \t]*\n[ \t]*\n[ \t]*\n+/g, '\n\n');

        if (s !== before) {
            changed++;
            if (!DRY) fs.writeFileSync(p, s);
        }
    });
    console.log(changed + ' files tidied' + (DRY ? ' (--dry, nothing written)' : ''));
}

// ---------------------------------------------------------------- value units

const SUFFIX = { t: 1e12, g: 1e9, meg: 1e6, k: 1e3, m: 1e-3, u: 1e-6, n: 1e-9, p: 1e-12, f: 1e-15 };

function parseVal(s) {
    if (!s) return null;
    const m = /^([-+]?[\d.]+(?:[eE][-+]?\d+)?)\s*(meg|[tgkmunpf])?/i.exec(s.trim());
    if (!m) return null;
    const mult = m[2] ? SUFFIX[m[2].toLowerCase()] : 1;
    return parseFloat(m[1]) * (mult === undefined ? 1 : mult);
}

/** Render a number in engineering notation with the right unit. */
function fmt(v, unit) {
    if (v === null || !isFinite(v)) return '';
    if (v === 0) return '0&nbsp;' + unit;      // otherwise zero renders as "0 pV"
    const a = Math.abs(v);
    let s = 1, p = '';
    if (a >= 1e9) { s = 1e9; p = 'G'; }
    else if (a >= 1e6) { s = 1e6; p = 'M'; }
    else if (a >= 1e3) { s = 1e3; p = 'k'; }
    else if (a >= 1) { s = 1; p = ''; }
    else if (a >= 1e-3) { s = 1e-3; p = 'm'; }
    else if (a >= 1e-6) { s = 1e-6; p = '&micro;'; }
    else if (a >= 1e-9) { s = 1e-9; p = 'n'; }
    else { s = 1e-12; p = 'p'; }
    const n = v / s;
    const txt = Math.abs(n - Math.round(n)) < 1e-9 ? String(Math.round(n)) : n.toFixed(2);
    return txt + '&nbsp;' + p + unit;
}

const node = n => (n === '0' || /^gnd$/i.test(n)) ? 'ground' : '<span class="mono">' + n + '</span>';

// ---------------------------------------------------------------- netlist

const TYPES = {
    R: { unit: '&Omega;', what: 'Resistor',  pins: 2 },
    C: { unit: 'F',       what: 'Capacitor', pins: 2 },
    L: { unit: 'H',       what: 'Inductor',  pins: 2 }
};

function describeSource(rest, isCurrent) {
    const u = isCurrent ? 'A' : 'V';
    const bits = [];
    const s = rest.join(' ');

    const sin = /SIN\s*\(([^)]*)\)/i.exec(s);
    const pulse = /PULSE\s*\(([^)]*)\)/i.exec(s);
    const dc = /\bDC\s+([-\w.]+)/i.exec(s);
    const ac = /\bAC\s+([-\w.]+)/i.exec(s);

    if (dc) bits.push(fmt(parseVal(dc[1]), u) + ' DC');
    if (sin) {
        const p = sin[1].trim().split(/[\s,]+/);
        const off = parseVal(p[0]), amp = parseVal(p[1]), f = parseVal(p[2]);
        bits.push('sine ' + fmt(amp, u) + ' amplitude at ' + fmt(f, 'Hz') +
                  (off ? ', offset ' + fmt(off, u) : ''));
    }
    if (pulse) {
        const p = pulse[1].trim().split(/[\s,]+/);
        const per = p[5] ? fmt(parseVal(p[5]), 's') : '';
        bits.push('pulse ' + fmt(parseVal(p[0]), u) + ' to ' + fmt(parseVal(p[1]), u) +
                  (per ? ', period ' + per : ''));
    }
    if (ac && !sin) bits.push('AC ' + fmt(parseVal(ac[1]), u) + ' for a frequency sweep');
    if (!bits.length) {
        const v = parseVal(rest[0]);
        if (v !== null) bits.push(fmt(v, u));
    }
    // A {PARAM} reference has no numeric value, but naming it is far more
    // use to a reader than an em-dash - it says "this is the thing you sweep".
    if (!bits.length) {
        const brace = /\{([^}]+)\}/.exec(s);
        if (brace) bits.push('set by <span class="mono">' + brace[1] + '</span>');
    }
    return bits.join(', ') || '&mdash;';
}

/**
 * Some "netlists" are not circuits at all - they are .model parameter cards,
 * with the meaning of each parameter in a trailing comment. That is genuinely
 * useful content and must not be thrown away with the syntax, so it becomes a
 * parameter table instead of a build table.
 */
function parseModelCard(text) {
    const models = [];
    let cur = null;
    text.split('\n').forEach(raw => {
        const line = raw.trim();
        if (!line || line.startsWith('*')) return;
        const start = /^\.model\s+(\S+)\s+(\w+)/i.exec(line);
        if (start) {
            cur = { name: start[1], type: start[2], rows: [] };
            models.push(cur);
            return;
        }
        if (!cur) return;
        // continuation lines: "+ NAME=VALUE   ; description"
        const m = /^\+?\s*([A-Za-z_]\w*)\s*=\s*([^;)\s]+)\s*(?:[;)]\s*(.*))?$/.exec(line);
        if (m) cur.rows.push({ k: m[1], v: m[2], d: (m[3] || '').replace(/\)$/, '').trim() });
        if (/^\)/.test(line)) cur = null;
    });
    return models.filter(m => m.rows.length);
}

function buildModelCard(models, netTitle) {
    const lines = [];
    lines.push('    <div class="card">');
    lines.push('        <h3>The device model, parameter by parameter</h3>');
    lines.push('        <p>A simulator&rsquo;s idea of a transistor is this list of numbers.');
    lines.push('        Every one of them is a coefficient in an equation from this module, and');
    lines.push('        reading them is a fast way to see what a model does and does not');
    lines.push('        capture. Enter these in');
    lines.push('        <a href="' + TOY + '" target="_blank" rel="noopener">Circuit Toy</a>');
    lines.push('        or any solver that accepts a device model.</p>');
    models.forEach(m => {
        lines.push('');
        lines.push('        <p><strong>' + m.name + '</strong> &mdash; ' + m.type + '</p>');
        lines.push('        <div class="table-wrap">');
        lines.push('            <table>');
        lines.push('                <thead><tr><th>Parameter</th><th>Value</th><th>What it sets</th></tr></thead>');
        lines.push('                <tbody>');
        m.rows.forEach(r => {
            lines.push('                    <tr><td class="mono">' + r.k + '</td><td class="mono">' +
                       r.v + '</td><td>' + (r.d || '&mdash;') + '</td></tr>');
        });
        lines.push('                </tbody>');
        lines.push('            </table>');
        lines.push('        </div>');
    });
    lines.push('');
    lines.push('        <p>Change one and re-run: it is the cheapest way to find out which');
    lines.push('        parameters your circuit is actually sensitive to, and the answer is');
    lines.push('        usually fewer than you expect.</p>');
    lines.push('    </div>');
    return lines.join('\n');
}

function parseNetlist(text, includeSubckts) {
    const parts = [];
    const runs = [];
    const probes = [];
    const subckts = [];
    let section = null;
    let inSub = false;
    let title = null;

    text.split('\n').forEach(raw => {
        let line = raw.trim();
        if (!line) return;

        if (line.startsWith('*')) {
            // Strip only RUNS of '=' (the banner rule), never a single one -
            // that ate the "= 4" out of "Non-Inverting Amplifier - Gain = 4".
            const c = line.replace(/^\*+/, '').replace(/={2,}/g, '').trim();
            if (!c) return;
            if (/^={2,}|={2,}$/.test(line) || /^\*\s*===/.test(raw)) { section = c; return; }
            if (/===/.test(line)) { section = c; return; }
            if (!title) title = c;
            return;
        }

        if (/^\.subckt/i.test(line)) {
            inSub = true;
            subckts.push(line.split(/\s+/)[1]);
            return;
        }
        if (/^\.ends/i.test(line)) { inSub = false; return; }
        // Normally a subcircuit's internals are a model, not build steps. But
        // some netlists put the WHOLE circuit inside one .SUBCKT, and skipping
        // it yields an empty table - so the caller retries with this on.
        if (inSub && !includeSubckts) return;

        if (line.startsWith('.')) {
            const tok = line.split(/\s+/);
            const d = tok[0].toLowerCase();
            if (d === '.tran') {
                runs.push('a <strong>transient run</strong> of ' + fmt(parseVal(tok[2]), 's') +
                          (tok[1] ? ' in steps of ' + fmt(parseVal(tok[1]), 's') : ''));
            } else if (d === '.ac') {
                const f1 = parseVal(tok[3]), f2 = parseVal(tok[4]);
                runs.push('an <strong>AC sweep</strong> from ' + fmt(f1, 'Hz') + ' to ' + fmt(f2, 'Hz'));
            } else if (d === '.dc') {
                runs.push('a <strong>DC sweep</strong> of <span class="mono">' + tok[1] +
                          '</span> from ' + fmt(parseVal(tok[2]), '') + ' to ' + fmt(parseVal(tok[3]), ''));
            } else if (d === '.op') {
                runs.push('a <strong>DC operating point</strong>');
            } else if (d === '.noise') {
                runs.push('a <strong>noise analysis</strong>');
            } else if (d === '.probe' || d === '.plot' || d === '.print') {
                line.slice(tok[0].length).trim().split(/\s+/).forEach(p => {
                    if (p && !/^(dc|ac|tran)$/i.test(p)) probes.push(p);
                });
            }
            return;
        }

        // a component
        const tok = line.split(/\s+/);
        const name = tok[0];
        const t = name[0].toUpperCase();
        const rest = tok.slice(1);

        if (TYPES[t]) {
            const spec = TYPES[t];
            parts.push({
                section: section, name: name, what: spec.what,
                value: fmt(parseVal(rest[2]), spec.unit),
                conn: 'between ' + node(rest[0]) + ' and ' + node(rest[1])
            });
        } else if (t === 'V' || t === 'I') {
            parts.push({
                section: section, name: name,
                what: t === 'V' ? 'Voltage source' : 'Current source',
                value: describeSource(rest.slice(2), t === 'I'),
                conn: 'from ' + node(rest[0]) + ' to ' + node(rest[1])
            });
        } else if (t === 'Q') {
            parts.push({
                section: section, name: name, what: 'Transistor (BJT)',
                value: rest[3] ? '<span class="mono">' + rest[3] + '</span>' : '&mdash;',
                conn: 'collector ' + node(rest[0]) + ', base ' + node(rest[1]) +
                      ', emitter ' + node(rest[2])
            });
        } else if (t === 'M' || t === 'J') {
            parts.push({
                section: section, name: name,
                what: t === 'M' ? 'Transistor (MOSFET)' : 'Transistor (JFET)',
                value: rest[4] ? '<span class="mono">' + rest[4] + '</span>' :
                       (rest[3] ? '<span class="mono">' + rest[3] + '</span>' : '&mdash;'),
                conn: 'drain ' + node(rest[0]) + ', gate ' + node(rest[1]) +
                      ', source ' + node(rest[2])
            });
        } else if (t === 'D') {
            parts.push({
                section: section, name: name, what: 'Diode',
                value: rest[2] ? '<span class="mono">' + rest[2] + '</span>' : '&mdash;',
                conn: 'anode ' + node(rest[0]) + ', cathode ' + node(rest[1])
            });
        } else if (t === 'X') {
            const sub = rest[rest.length - 1];
            const pins = rest.slice(0, -1);
            const isOp = /op(amp|-amp)|amp/i.test(sub);
            parts.push({
                section: section, name: name,
                what: isOp ? 'Op-amp' : 'Block (' + sub + ')',
                value: '<span class="mono">' + sub + '</span>',
                conn: isOp && pins.length >= 3
                    ? '+ input ' + node(pins[0]) + ', &minus; input ' + node(pins[1]) +
                      ', output ' + node(pins[2])
                    : 'pins ' + pins.map(node).join(', ')
            });
        } else if (t === 'E' || t === 'G' || t === 'F' || t === 'H') {
            parts.push({
                section: section, name: name, what: 'Controlled source',
                value: rest.slice(4).join(' ') || '&mdash;',
                conn: 'output ' + node(rest[0]) + ' to ' + node(rest[1]) +
                      ', sensing ' + node(rest[2]) + ' to ' + node(rest[3])
            });
        } else if (t === 'K') {
            parts.push({
                section: section, name: name, what: 'Magnetic coupling',
                value: rest[2] || '&mdash;',
                conn: 'couples ' + rest[0] + ' and ' + rest[1]
            });
        }
    });

    return { parts: parts, runs: runs, probes: probes, subckts: subckts, title: title };
}

// ---------------------------------------------------------------- the card

/**
 * `bare` emits just the title, table and run/watch lines, with no card wrapper
 * and no framing prose - for embedding inside an exercise that already says
 * what is being built. Post-filtering the full card by line was tried first and
 * produced dangling links and an unbalanced </div>; building the smaller thing
 * directly is the only way to keep the HTML balanced by construction.
 */
function buildCard(spec, netTitle, bare) {
    const p = spec.parts;
    if (!p.length) return null;

    const name = (netTitle || spec.title || '').replace(/\s*$/, '');
    const hasSections = p.some(x => x.section);

    const rows = [];
    let cur = null;
    p.forEach(x => {
        if (hasSections && x.section !== cur) {
            cur = x.section;
            if (cur) {
                rows.push('                    <tr><td colspan="4"><strong>' + cur +
                          '</strong></td></tr>');
            }
        }
        rows.push('                    <tr><td class="mono">' + x.name + '</td><td>' +
                  x.what + '</td><td>' + x.value + '</td><td>' + x.conn + '</td></tr>');
    });

    const lines = [];
    if (!bare) {
        lines.push('    <div class="card">');
        lines.push('        <h3>Build it in Circuit Toy</h3>');
        lines.push('        <p>The interactives above are models with the physics written into them.');
        lines.push('        To put this circuit in front of a real solver, build it in');
        lines.push('        <a href="' + TOY + '" target="_blank" rel="noopener">Circuit Toy</a>');
        lines.push('        from the table below. Node names are just labels &mdash; anything');
        lines.push('        sharing a name is one wire.</p>');
    }

    if (name) {
        lines.push('');
        lines.push('        <p><strong>' + name + '</strong></p>');
    }

    lines.push('');
    lines.push('        <div class="table-wrap">');
    lines.push('            <table>');
    lines.push('                <thead><tr><th>Part</th><th>What</th><th>Value</th><th>Connect</th></tr></thead>');
    lines.push('                <tbody>');
    rows.forEach(r => lines.push(r));
    lines.push('                </tbody>');
    lines.push('            </table>');
    lines.push('        </div>');

    if (spec.runs.length) {
        lines.push('');
        lines.push('        <p><strong>What to run:</strong> ' +
                   spec.runs.join('; then ') + '.</p>');
    }
    if (spec.probes.length) {
        const uniq = [];
        spec.probes.forEach(x => { if (uniq.indexOf(x) === -1) uniq.push(x); });
        lines.push('        <p><strong>What to watch:</strong> <span class="mono">' +
                   uniq.slice(0, 10).join('</span>, <span class="mono">') + '</span>.</p>');
    }

    if (!bare) {
        lines.push('');
        lines.push('        <p>Then change one thing at a time and predict the result before you run');
        lines.push('        it. A simulator is only worth the time if you are checking an answer you');
        lines.push('        already have &mdash; otherwise it is a very slow way of being surprised.</p>');
        lines.push('    </div>');
    }

    let out = lines.join('\n');
    if (bare) out = out.replace(/^ {4,8}/gm, '').trim();
    return out;
}

// ------------------------------------------------------- locating both blocks

/** Balanced scan from an opening brace, aware of strings, templates, comments. */
function matchBraces(s, start) {
    let depth = 0, i = start, str = null, cmt = null;
    for (; i < s.length; i++) {
        const c = s[i], n = s[i + 1];
        if (cmt === '//') { if (c === '\n') cmt = null; continue; }
        if (cmt === '/*') { if (c === '*' && n === '/') { i++; cmt = null; } continue; }
        if (str) {
            if (c === '\\') { i++; continue; }
            if (c === str) str = null;
            continue;
        }
        if (c === '/' && n === '/') { cmt = '//'; i++; continue; }
        if (c === '/' && n === '*') { cmt = '/*'; i++; continue; }
        if (c === '"' || c === "'" || c === '`') { str = c; continue; }
        if (c === '{') depth++;
        else if (c === '}') { depth--; if (depth === 0) return i + 1; }
    }
    return -1;
}

/** Find `<div class="card"> ... <div id="ID"></div> ... </div>` around the container. */
function findCard(html, id) {
    const anchor = html.indexOf('id="' + id + '"');
    if (anchor === -1) return null;
    const open = html.lastIndexOf('<div class="card">', anchor);
    if (open === -1) return null;

    // walk divs forward from `open` to find its matching close
    let depth = 0, i = open;
    const re = /<div\b[^>]*>|<\/div>/gi;
    re.lastIndex = open;
    let m;
    while ((m = re.exec(html)) !== null) {
        if (m[0].toLowerCase().startsWith('</div')) {
            depth--;
            if (depth === 0) return { start: open, end: m.index + m[0].length };
        } else depth++;
        if (depth === 0) break;
    }
    return null;
}

/**
 * Three call shapes exist in the catalogue and all three have to be found:
 *   new SpiceNetlistWidget('id', { ... })
 *   new SpiceNetlistWidget(document.getElementById('id'), { ... })
 *   const w = new SpiceNetlistWidget('id'); w.setNetlist(`...`)
 */
function findWidget(html) {
    const marker = 'new SpiceNetlistWidget(';
    const at = html.indexOf(marker);
    if (at === -1) return null;

    const head = html.slice(at, at + 400);
    const idm = /new SpiceNetlistWidget\(\s*(?:document\.getElementById\(\s*)?['"]([^'"]+)['"]/
                .exec(head);
    const id = idm ? idm[1] : null;

    // Does an options object follow on this call?
    const semi = html.indexOf(';', at);
    const brace = html.indexOf('{', at);
    if (brace !== -1 && (semi === -1 || brace < semi)) {
        const close = matchBraces(html, brace);
        if (close === -1) return null;
        let end = close;
        while (end < html.length && /[\s)]/.test(html[end])) end++;
        if (html[end] === ';') end++;
        return { start: at, end: end, id: id, body: html.slice(brace, close) };
    }

    // Otherwise the netlist arrives via a later setNetlist(...) call.
    const setAt = html.indexOf('setNetlist(', at);
    if (setAt === -1) return null;
    const q = html.slice(setAt).search(/[`'"]/);
    if (q === -1) return null;
    const qAt = setAt + q;
    const quote = html[qAt];
    let i = qAt + 1;
    for (; i < html.length; i++) {
        if (html[i] === '\\') { i++; continue; }
        if (html[i] === quote) break;
    }
    let end = i + 1;
    while (end < html.length && /[\s)]/.test(html[end])) end++;
    if (html[end] === ';') end++;

    // Start at the statement that constructs the widget, so both go together.
    let start = at;
    const lineStart = html.lastIndexOf('\n', at) + 1;
    if (/^\s*(?:const|let|var)\s+\w+\s*=\s*$/.test(html.slice(lineStart, at))) start = lineStart;

    return {
        start: start, end: end, id: id,
        body: 'netlist: ' + html.slice(qAt, i + 1)
    };
}

function extractField(body, key) {
    const re = new RegExp(key + '\\s*:\\s*([`\'"])');
    const m = re.exec(body);
    if (!m) return null;
    const q = m[1];
    const from = m.index + m[0].length;
    let out = '';
    for (let i = from; i < body.length; i++) {
        const c = body[i];
        if (c === '\\') { out += body[i + 1]; i++; continue; }
        if (c === q) break;
        out += c;
    }
    return out;
}

// ---------------------------------------------------------------- per file

/**
 * A fourth shape: no widget at all, just a raw netlist in a <pre> inside
 * <div class="spice-netlist">, with a "Copy Netlist" button beside it. The
 * whole div is replaced; there is no JavaScript to remove.
 */
function convertRawPre(file, html) {
    const open = html.indexOf('<div class="spice-netlist">');
    if (open === -1) return null;

    // walk divs forward to the matching close
    let depth = 0, end = -1;
    const re = /<div\b[^>]*>|<\/div>/gi;
    re.lastIndex = open;
    let m;
    while ((m = re.exec(html)) !== null) {
        if (m[0].toLowerCase().startsWith('</div')) {
            depth--;
            if (depth === 0) { end = m.index + m[0].length; break; }
        } else depth++;
    }
    if (end === -1) return { file: file, skip: 'unbalanced spice-netlist div' };

    const block = html.slice(open, end);
    const pre = /<pre[^>]*>([\s\S]*?)<\/pre>/i.exec(block);
    if (!pre) return { file: file, skip: 'spice-netlist div has no <pre>' };

    const netlist = pre[1]
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    const h4 = /<h4[^>]*>([^<]*)<\/h4>/i.exec(block);

    let spec = parseNetlist(netlist, false);
    let card = buildCard(spec, h4 ? h4[1].trim() : null);
    if (!card && spec.subckts.length) {
        spec = parseNetlist(netlist, true);
        card = buildCard(spec, h4 ? h4[1].trim() : null);
    }
    if (!card) return { file: file, skip: 'raw netlist parsed to zero components' };

    // The generated card brings its own <div class="card">; here we are already
    // inside a <section class="card">, so strip the wrapper and keep the body.
    const inner = card
        .replace(/^\s*<div class="card">\s*\n/, '')
        .replace(/\n\s*<\/div>\s*$/, '')
        .replace(/^\s*<h3>[^<]*<\/h3>\s*\n/m, '');

    if (html.split(block).length - 1 !== 1) {
        return { file: file, skip: 'the spice-netlist block is not unique' };
    }

    let out = html.replace(block, inner.replace(/^ {4}/gm, ''));
    out = out.replace(/(<h3>)\s*Simulating\s+/i, '$1Building ');
    return { file: file, ok: true, id: 'raw <pre>', parts: spec.parts.length,
             runs: spec.runs.length, card: inner, text: out };
}

function convert(file) {
    const full = path.join(ROOT, file);
    let html = fs.readFileSync(full, 'utf8');

    const w = findWidget(html);
    if (!w) {
        const raw = convertRawPre(file, html);
        if (raw) return raw;
        return { file: file, skip: 'no widget call and no raw netlist found' };
    }
    if (!w.id) return { file: file, skip: 'could not read the container id' };

    const netlist = extractField(w.body, 'netlist');
    if (!netlist) return { file: file, skip: 'could not read the netlist string' };
    const netTitle = extractField(w.body, 'title');

    const card = findCard(html, w.id);
    if (!card) return { file: file, skip: 'could not find the enclosing card for #' + w.id };

    let spec = parseNetlist(netlist, false);
    let newCard = buildCard(spec, netTitle);

    // A netlist that is entirely one subcircuit yields nothing on the first
    // pass; retry with the subcircuit body treated as the circuit.
    if (!newCard && spec.subckts.length) {
        spec = parseNetlist(netlist, true);
        newCard = buildCard(spec, netTitle);
    }
    // A netlist that is really a .model card becomes a parameter table.
    if (!newCard) {
        const models = parseModelCard(netlist);
        if (models.length) newCard = buildModelCard(models, netTitle);
    }
    if (!newCard) return { file: file, skip: 'not a circuit and not a model card' };

    const cardText = html.slice(card.start, card.end);
    const widgetText = html.slice(w.start, w.end);

    // Exact-match, assert-once, all-or-nothing.
    if (html.split(cardText).length - 1 !== 1) {
        return { file: file, skip: 'the card text is not unique in the file' };
    }
    if (html.split(widgetText).length - 1 !== 1) {
        return { file: file, skip: 'the widget call is not unique in the file' };
    }

    let out = html.replace(cardText, newCard).replace(widgetText, '');
    // tidy the blank line the widget call left behind
    out = out.replace(/\n[ \t]*\n[ \t]*\n(\s*)(\}\)\(\);|\}\);)/g, '\n\n$1$2');

    return {
        file: file, ok: true, id: w.id, parts: spec.parts.length,
        runs: spec.runs.length, card: newCard, text: out
    };
}

// ---------------------------------------------------------------- main

function allLessons(filter) {
    const out = [];
    const dir = path.join(ROOT, 'lessons');
    fs.readdirSync(dir).forEach(m => {
        const md = path.join(dir, m);
        if (!fs.statSync(md).isDirectory()) return;
        fs.readdirSync(md).forEach(f => {
            if (!f.endsWith('.html')) return;
            const p = path.join('lessons', m, f).replace(/\\/g, '/');
            if (!filter || filter(fs.readFileSync(path.join(ROOT, p), 'utf8'))) out.push(p);
        });
    });
    return out;
}

/**
 * --pre: netlists that live in a <pre> inside an EXERCISE string.
 *
 * Several lessons build their simulator labs as JavaScript arrays whose
 * question text is HTML, with the netlist in a styled <pre>. Those are invisible
 * to every other pass here because they are neither a widget nor a
 * spice-netlist div - they are string data. This finds any <pre> whose content
 * looks like a netlist and swaps it for the same build table, which is safe to
 * embed because the generated HTML contains no backtick and no ${.
 */
function convertPreBlocks() {
    let nBlocks = 0, nFiles = 0;
    allLessons(s => /<pre/i.test(s)).forEach(f => {
        const p = path.join(ROOT, f);
        const before = fs.readFileSync(p, 'utf8');
        let s = before, touched = 0;

        s = s.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (whole, body) => {
            if (!/^\s*\*|\.SUBCKT|\.TRAN|\.MODEL|\.ENDS|\.PROBE|\.AC\b|\.DC\b/im.test(body)) {
                return whole;
            }
            const net = body.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
            let spec = parseNetlist(net, false);
            let card = buildCard(spec, null, true);
            if (!card && spec.subckts.length) {
                spec = parseNetlist(net, true);
                card = buildCard(spec, null, true);
            }
            if (!card) {
                const models = parseModelCard(net);
                if (models.length) card = buildModelCard(models, null);
            }
            if (!card) return whole;
            if (/[`]|\$\{/.test(card)) return whole;   // never break a template literal
            touched++;
            return card;
        });

        if (touched) {
            nBlocks += touched; nFiles++;
            if (!DRY) fs.writeFileSync(p, s);
        }
    });
    console.log(nBlocks + ' embedded <pre> netlists converted in ' + nFiles + ' files' +
                (DRY ? ' (--dry, nothing written)' : ''));
}

if (process.argv.includes('--pre')) { convertPreBlocks(); process.exit(0); }

if (TIDY) {
    tidy(allLessons(s => /SpiceNetlistWidget|SPICE/i.test(s)));
    process.exit(0);
}

let files = process.argv.slice(2).filter(a => !a.startsWith('-'));
if (!files.length) {
    files = allLessons(s => /SpiceNetlistWidget|class="spice-netlist"/.test(s));
}

const done = [], skipped = [];
files.forEach(f => {
    const r = convert(f);
    if (r.ok) done.push(r); else skipped.push(r);
});

console.log(files.length + ' lessons carry a SPICE netlist');
console.log(done.length + ' convert cleanly, ' + skipped.length + ' need a look');

if (skipped.length) {
    console.log('\nNOT CONVERTED');
    skipped.forEach(s => console.log('  ' + s.file + '\n      ' + s.skip));
}

if (VERBOSE && done.length) {
    console.log('\n--- example output: ' + done[0].file + '\n');
    console.log(done[0].card);
}

if (DRY) {
    console.log('\nNothing written (--dry).');
    process.exit(skipped.length ? 1 : 0);
}

done.forEach(r => fs.writeFileSync(path.join(ROOT, r.file), r.text));
console.log('\n' + done.length + ' lessons rewritten.');
process.exit(skipped.length ? 1 : 0);
