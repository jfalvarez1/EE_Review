#!/usr/bin/env node
/**
 * check-palette - a lesson may only read colour keys that exist.
 *
 * Why this exists.
 *
 * Nineteen lessons across modules 3, 5 and 12 did this:
 *
 *     const TEK = AD.TEK_COLORS;
 *     ctx.strokeStyle = TEK.cyan;      // there is no `cyan` key
 *
 * TEK_COLORS names its channels ch1..ch4, ref and math. There were no colour
 * names on it at all, so every one of those reads returned undefined - and
 * assigning undefined to ctx.strokeStyle or ctx.fillStyle is a SILENT no-op.
 * Canvas keeps whatever colour was set last. The result is not a wrong colour,
 * which someone would notice; it is every trace on the plot coming out in the
 * SAME colour, so a two-trace comparison renders as one indistinct shape.
 * Nothing throws, nothing logs, and the plot still looks like a plot.
 *
 * That is the whole reason for a checker rather than a fix: this defect class
 * is invisible at runtime. The fix was to add the colour names to TEK_COLORS;
 * this makes sure the next lesson that reaches for TEK.purple finds out.
 *
 * Only reads off an object taken from AD.TEK_COLORS are checked. A lesson that
 * declares its own local `const TEK = { ... }` is checked against its own
 * literal, which catches the same typo class without needing the framework.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FRAMEWORK = path.join(ROOT, 'assets', 'ad-framework.js');

/** Pull the keys out of `const TEK_COLORS = { ... }` in the framework. */
function frameworkKeys() {
    const src = fs.readFileSync(FRAMEWORK, 'utf8');
    const start = src.indexOf('const TEK_COLORS = {');
    if (start === -1) {
        console.error('check-palette: could not find TEK_COLORS in ad-framework.js');
        process.exit(2);
    }
    const end = src.indexOf('};', start);
    return keysOf(src.slice(start, end));
}

/**
 * Key names in an object literal.
 *
 * This started out matching `^\s*key:` line by line, which works for the
 * framework's multi-line literal and silently fails for the far more common
 *     const TEK = { power: '#FF6600', sense: '#00FFFF', bad: '#FF0000' };
 * where every key after the brace is mid-line and none are at a line start.
 * That produced 61 confident findings that were all wrong. Strip comments and
 * strings, then take keys wherever they appear.
 */
function keysOf(block) {
    const code = block
        .replace(/\/\*[\s\S]*?\*\//g, ' ')   // block comments
        .replace(/\/\/[^\n]*/g, ' ')         // line comments
        .replace(/'(?:[^'\\]|\\.)*'/g, "''") // string values, so a URL's
        .replace(/"(?:[^"\\]|\\.)*"/g, '""') // "https:" is not read as a key
        .replace(/`(?:[^`\\]|\\.)*`/g, '``');

    const keys = new Set();
    let m;
    const re = /([A-Za-z_$][\w$]*)\s*:/g;
    while ((m = re.exec(code)) !== null) keys.add(m[1]);
    return keys;
}

function lessonFiles() {
    const out = [];
    const base = path.join(ROOT, 'lessons');
    fs.readdirSync(base).forEach(dir => {
        const d = path.join(base, dir);
        if (!fs.statSync(d).isDirectory()) return;
        fs.readdirSync(d).forEach(f => {
            if (f.endsWith('.html')) out.push(path.join(d, f));
        });
    });
    return out;
}

const FRAMEWORK_KEYS = frameworkKeys();
const findings = [];

lessonFiles().forEach(file => {
    const src = fs.readFileSync(file, 'utf8');
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');

    // Which palette is this file reading, and what does it hold?
    //
    // A file can hold several: one function taking AD.TEK_COLORS and another
    // declaring its own literal is common, and some files declare a different
    // literal per drawing. The allowed set is the UNION of all of them.
    // Deliberately conservative - it can miss a genuine typo when a sibling
    // literal happens to define that key - because the alternative is
    // flagging correct code, and a checker that cries wolf gets ignored on
    // the day it is right.
    let allowed = null;
    const sources = [];

    if (/(?:const|let|var)\s+TEK\s*=\s*AD\.TEK_COLORS/.test(src)) {
        allowed = new Set(FRAMEWORK_KEYS);
        sources.push('AD.TEK_COLORS');
    }

    const decl = /(?:const|let|var)\s+TEK\s*=\s*\{/g;
    let d;
    while ((d = decl.exec(src)) !== null) {
        // Scan to the matching brace rather than the next '};', so a literal
        // holding a nested object is not truncated halfway.
        let depth = 0, end = -1;
        for (let i = src.indexOf('{', d.index); i < src.length; i++) {
            if (src[i] === '{') depth++;
            else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
        }
        if (end === -1) continue;
        if (!allowed) allowed = new Set();
        keysOf(src.slice(d.index, end)).forEach(k => allowed.add(k));
        if (!sources.includes('a local TEK literal')) sources.push('a local TEK literal');
    }
    if (!allowed) return;
    const source = sources.join(' or ');

    // Every `TEK.something` read in the file, with its line number.
    const lines = src.split(/\r?\n/);
    const seen = new Map();
    lines.forEach((line, i) => {
        // Strip line comments so a key named only in prose is not flagged.
        const code = line.replace(/\/\/.*$/, '');
        let m;
        const re = /\bTEK\.([A-Za-z_$][\w$]*)\s*(\|\||\?\?)?/g;
        while ((m = re.exec(code)) !== null) {
            const key = m[1];
            // ch1..ch9 are indexed off TEK_CHANNEL_COLORS in some lessons and
            // are a documented part of the palette either way.
            if (/^ch\d$/.test(key)) continue;
            if (allowed.has(key)) continue;
            // `TEK.esd || '#f87171'` is an author saying they know the key may
            // be absent and choosing what happens then. That is the correct
            // shape, not the silent no-op this checker is here to catch.
            if (m[2]) continue;
            if (!seen.has(key)) seen.set(key, i + 1);
        }
    });

    seen.forEach((line, key) => {
        findings.push({ rel, line, key, source });
    });
});

if (findings.length === 0) {
    console.log('PASS - every colour a lesson reads exists in the palette it reads from.');
    process.exit(0);
}

console.log('MISSING PALETTE KEY - reads that silently return undefined\n');
console.log('  Assigning undefined to strokeStyle/fillStyle does nothing at all:');
console.log('  the canvas keeps the previous colour, so traces that should be');
console.log('  different come out identical. Nothing throws.\n');

findings.forEach(f => {
    console.log(`  ${f.rel}:${f.line}  TEK.${f.key} is not in ${f.source}`);
});

const keys = [...new Set(findings.map(f => f.key))].sort();
console.log(`\n${findings.length} reads across ` +
            `${new Set(findings.map(f => f.rel)).size} files; ` +
            `missing keys: ${keys.join(', ')}`);
console.log('\nFix by adding the key to the palette, not by editing every call site.');
process.exit(1);
