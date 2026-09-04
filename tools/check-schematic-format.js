#!/usr/bin/env node
/**
 * check-schematic-format - a circuit drawn outside the schematic system.
 *
 * Why this exists
 * ---------------
 * Module 1 lesson 6 (PSRR) carried four circuit figures written as literal
 * <svg> markup: the op-amp a <polygon>, the resistors zig-zag <path>s, the
 * grounds three loose <line>s, every stroke a hard-coded hex colour. The
 * reader saw a figure in a palette the rest of the course does not use, with
 * both op-amp inputs grounded - an open-loop amplifier whose output sits on a
 * rail, drawn as if it measured PSRR - and asked why it did not follow the
 * format.
 *
 * Four checkers already look at SVG, and all four passed it:
 *
 *   check-hand-drawn      reads JS calls (svg.circle(), svg.line()); literal
 *                         markup never reaches it
 *   check-raw-svg         reads literal markup, but proves only that wires
 *                         meet - and these do
 *   check-svg-legibility  proves every class used inside an SVG is defined;
 *                         these use no class, only an inline fill
 *   check-palette         reads TEK.<key> references in JS; an attribute
 *                         stroke="#4fc3f7" is not one
 *
 * A circuit written as literal markup with hard-coded ink falls between all
 * four. And it is not one lesson's slip: 288 such figures in 112 lessons,
 * against 20 lessons on AD.Schematic. It was the de facto format, which is
 * exactly why nothing gated it.
 *
 * What it flags
 * -------------
 * A literal <svg> (or one inside an innerHTML template) that draws a circuit
 * and was not produced by the schematic system.
 *
 *   "draws a circuit"   carries class="circuit-diagram" (the convention the
 *                       ad-hoc figures adopted), OR paints with hard-coded
 *                       colour attributes AND contains a circuit symbol - an
 *                       op-amp triangle, a resistor zig-zag - or two or more
 *                       circuit labels (Vout, V+, GND, R1, Rf, Cf, Q1, U1 ...)
 *   "on the system"     AD.Schematic.create() / SchematicSVG output, which is
 *                       built in JS and carries class="schematic-svg"; it is
 *                       never literal markup, so anything literal is not it
 *
 * Plots and block diagrams with hard-coded ink are a real but different
 * problem; this check is about circuits only, so a figure with no circuit
 * signature is left alone.
 *
 * The existing figures are recorded in schematic-format-baseline.json as
 * debt: per lesson, how many. A lesson exceeding its count, or a lesson not
 * in the file at all, fails. Falling below it is reported so the file can be
 * lowered (--update-baseline rewrites it). The right number for the file is
 * zero, and a lesson that reaches zero is dropped from it.
 *
 * Run: node tools/check-schematic-format.js [--list] [--update-baseline] [--file <path>]
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const LESSONS = path.join(ROOT, 'lessons');
const BASELINE = path.join(ROOT, 'tools', 'schematic-format-baseline.json');

const args = process.argv.slice(2);
const LIST = args.includes('--list');
const UPDATE = args.includes('--update-baseline');
const ONLY = (() => { const i = args.indexOf('--file'); return i >= 0 ? args[i + 1] : null; })();

/* ------------------------------------------------------------------ files */

function lessonFiles() {
    const out = [];
    if (!fs.existsSync(LESSONS)) return out;
    for (const mod of fs.readdirSync(LESSONS).sort()) {
        const dir = path.join(LESSONS, mod);
        if (!fs.statSync(dir).isDirectory()) continue;
        for (const f of fs.readdirSync(dir).sort()) {
            if (f.endsWith('.html')) out.push(path.join(dir, f));
        }
    }
    return out;
}

const rel = f => path.relative(ROOT, f).replace(/\\/g, '/');

/* ------------------------------------------------------------- detection */

/** Every literal <svg>...</svg>, in the markup and inside innerHTML templates. */
function svgBlocks(src) {
    const out = [];
    const re = /<svg\b[^>]*>[\s\S]*?<\/svg>/g;
    let m;
    while ((m = re.exec(src))) out.push({ markup: m[0], index: m.index });
    return out;
}

const openTag = block => /<svg\b[^>]*>/.exec(block)[0];

const hasClass = (tag, name) => {
    const m = /\bclass\s*=\s*"([^"]*)"/.exec(tag);
    return !!m && m[1].split(/\s+/).includes(name);
};

/** Hard-coded ink: a colour literal on a drawing element, not a var() or class. */
function hardCodedInk(block) {
    const drawing = block.match(/<(?:line|path|polygon|polyline|rect|circle|ellipse|text)\b[^>]*>/g) || [];
    let n = 0;
    for (const tag of drawing) {
        if (/\b(?:stroke|fill)\s*=\s*"\s*(?:#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\()/.test(tag)) n++;
        if (/\bstyle\s*=\s*"[^"]*\b(?:stroke|fill)\s*:\s*(?:#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\()/.test(tag)) n++;
    }
    return n;
}

/** An op-amp drawn as a three-vertex polygon or closed three-vertex path. */
function opampTriangle(block) {
    for (const m of block.matchAll(/<polygon\b[^>]*\bpoints\s*=\s*"([^"]*)"/g)) {
        const pts = m[1].trim().split(/\s+/).filter(Boolean);
        if (pts.length === 3) return true;
    }
    for (const m of block.matchAll(/<path\b[^>]*\bd\s*=\s*"([^"]*)"/g)) {
        const d = m[1];
        if (/[CQASTcqast]/.test(d)) continue;
        const verts = (d.match(/[MLml]/g) || []).length;
        if (verts === 3 && /[Zz]\s*$/.test(d.trim())) return true;
    }
    return false;
}

/** A resistor drawn as a zig-zag: a path of five or more short alternating segments. */
function resistorZigzag(block) {
    for (const m of block.matchAll(/<path\b[^>]*\bd\s*=\s*"([^"]*)"/g)) {
        const d = m[1];
        if (/[CQASTcqast]/.test(d)) continue;
        const toks = d.match(/[MLHVmlhv]|-?\d*\.?\d+/g) || [];
        const pts = [];
        let cmd = null;
        for (let i = 0; i < toks.length;) {
            if (/[MLHVmlhv]/.test(toks[i])) { cmd = toks[i++]; continue; }
            if (cmd === 'M' || cmd === 'L') { pts.push([+toks[i], +toks[i + 1]]); i += 2; }
            else if (cmd === 'H') { pts.push([+toks[i], pts.length ? pts[pts.length - 1][1] : 0]); i++; }
            else if (cmd === 'V') { pts.push([pts.length ? pts[pts.length - 1][0] : 0, +toks[i]]); i++; }
            else i++;   // relative commands: rare in these files, not worth modelling
        }
        if (pts.length < 6) continue;
        // Alternating sign of the cross-axis step, four or more times in a row.
        let runs = 0, prev = 0;
        for (let i = 1; i < pts.length; i++) {
            const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1];
            const cross = Math.abs(dx) >= Math.abs(dy) ? dy : dx;
            if (cross !== 0 && prev !== 0 && Math.sign(cross) !== Math.sign(prev)) runs++;
            else if (cross !== 0) runs = 0;
            if (cross !== 0) prev = cross;
            if (runs >= 4) return true;
        }
    }
    return false;
}

/** Text that names circuit nodes or parts. Returns the distinct labels found. */
function circuitLabels(block) {
    const texts = (block.match(/<text\b[^>]*>[\s\S]*?<\/text>/g) || [])
        .map(t => t.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
    const found = new Set();
    const re = /\b(?:V(?:cc|dd|ee|ss|in|out|ref|CC|DD|EE|SS|IN|OUT|REF)|V\s*[+\-−]|GND|Op-?[Aa]mp|[RCLQUD]\s*(?:[0-9]{1,2}|[FGLfgl])|R\s*(?:load|LOAD|in|IN|out|OUT))\b/g;
    for (const t of texts) {
        for (const m of t.matchAll(re)) found.add(m[0].replace(/\s+/g, ''));
    }
    return [...found];
}

/** Classify one literal SVG. Returns null when it is not an ad-hoc circuit. */
function classify(block) {
    const tag = openTag(block);
    if (hasClass(tag, 'schematic-svg')) return null;      // the system's own output
    const ink = hardCodedInk(block);
    const reasons = [];
    if (hasClass(tag, 'circuit-diagram')) reasons.push('class="circuit-diagram"');
    if (ink) {
        if (opampTriangle(block)) reasons.push('op-amp triangle');
        if (resistorZigzag(block)) reasons.push('resistor zig-zag');
        const labels = circuitLabels(block);
        if (labels.length >= 2) reasons.push('labels ' + labels.slice(0, 4).join(', '));
    }
    if (!reasons.length) return null;
    return { ink, reasons };
}

function scan(file) {
    const src = fs.readFileSync(file, 'utf8');
    const hits = [];
    for (const b of svgBlocks(src)) {
        const c = classify(b.markup);
        if (!c) continue;
        const line = src.slice(0, b.index).split('\n').length;
        hits.push({ line, ink: c.ink, reasons: c.reasons });
    }
    return hits;
}

/* ------------------------------------------------------------------ main */

function loadBaseline() {
    if (!fs.existsSync(BASELINE)) return {};
    try { return JSON.parse(fs.readFileSync(BASELINE, 'utf8')); } catch (e) { return {}; }
}

function main() {
    const files = ONLY ? [path.resolve(ROOT, ONLY)] : lessonFiles();
    const base = loadBaseline();
    const counts = {};
    let figures = 0;

    for (const f of files) {
        const hits = scan(f);
        if (!hits.length) continue;
        const r = rel(f);
        counts[r] = hits.length;
        figures += hits.length;
        if (LIST) {
            console.log(r + '  (' + hits.length + ')');
            for (const h of hits) {
                console.log('    line ' + h.line + '  ' + h.ink + ' hard-coded colour' + (h.ink === 1 ? '' : 's') + '  - ' + h.reasons.join('; '));
            }
        }
    }

    if (UPDATE) {
        const sorted = {};
        for (const k of Object.keys(counts).sort()) sorted[k] = counts[k];
        fs.writeFileSync(BASELINE, JSON.stringify(sorted, null, 2) + '\n');
        console.log('check-schematic-format: baseline written - ' + figures + ' figure' + (figures === 1 ? '' : 's') +
            ' in ' + Object.keys(sorted).length + ' lesson' + (Object.keys(sorted).length === 1 ? '' : 's'));
        return 0;
    }

    const regressions = [];
    const improved = [];
    const seen = ONLY ? Object.keys(counts) : Object.keys(Object.assign({}, base, counts));
    for (const k of seen) {
        const now = counts[k] || 0;
        const was = base[k] || 0;
        if (now > was) regressions.push({ file: k, now, was });
        else if (now < was) improved.push({ file: k, now, was });
    }

    const lessons = Object.keys(counts).length;
    const baseFigures = Object.values(base).reduce((a, b) => a + b, 0);

    if (regressions.length) {
        console.log('check-schematic-format: ' + regressions.length + ' lesson' + (regressions.length === 1 ? '' : 's') +
            ' with a circuit drawn as literal <svg> markup, outside the schematic system');
        for (const r of regressions) {
            console.log('  ' + r.file + '  ' + r.now + ' figure' + (r.now === 1 ? '' : 's') +
                (r.was ? '  (baseline ' + r.was + ')' : '  (not in baseline)'));
            for (const h of scan(path.join(ROOT, r.file))) {
                console.log('      line ' + h.line + '  ' + h.reasons.join('; '));
            }
        }
        console.log('  Draw it with AD.Schematic.create() in a <div class="schematic-container">');
        console.log('  (see lessons/module-01/lesson-02.html) so it carries the course palette and the');
        console.log('  connectivity checks apply. Only pre-existing debt belongs in the baseline.');
        return 1;
    }

    console.log('check-schematic-format: ' + figures + ' ad-hoc circuit figure' + (figures === 1 ? '' : 's') +
        ' in ' + lessons + ' lesson' + (lessons === 1 ? '' : 's') +
        ' (baseline ' + baseFigures + ' in ' + Object.keys(base).length + ')');
    if (improved.length) {
        console.log('  below baseline - lower it with --update-baseline:');
        for (const i of improved) console.log('    ' + i.file + '  ' + i.was + ' -> ' + i.now);
    }
    return 0;
}

module.exports = { scan, lessonFiles, rel, svgBlocks, classify };
if (require.main === module) process.exit(main());
