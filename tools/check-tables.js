#!/usr/bin/env node
/**
 * check-tables - the hundreds of numbers nothing has ever looked at.
 *
 * Why this exists
 * ---------------
 * check-arithmetic verifies expressions the lesson writes out with an equals
 * sign. check-constants verifies remembered values. Neither can see a TABLE,
 * and the course is full of them: bits against SNR, VSWR against return loss,
 * frequency against wavelength, AWG against resistance. Those are dozens of
 * rows of arithmetic nobody wrote down as a sum, and a transcription slip in
 * one row is invisible - the row above and below it are right, so the column
 * looks plausible.
 *
 * An aperture-jitter table in module 11 was found by hand this way: every
 * number in it was correct and the formula printed underneath had lost a
 * factor of 2pi. The table was the evidence.
 *
 * So this reads each table, works out which pairs of columns stand in a
 * relation it knows, and checks every row.
 *
 * Adding a relation
 * -----------------
 * Give it two header matchers and a function. It fires only when BOTH columns
 * are present in the same table, so a header matcher can be generous without
 * costing false positives.
 *
 * Run: node tools/check-tables.js [--list]
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const LESSONS = path.join(ROOT, 'lessons');
const LIST = process.argv.includes('--list');

const C = 2.99792458e8;

function walk(dir, out) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, out);
        else if (e.name.endsWith('.html')) out.push(p);
    });
    return out;
}

/** Cell text as a reader sees it. */
function cellText(html) {
    return html
        .replace(/<sup[^>]*>\s*([^<]{1,12}?)\s*<\/sup>/gi, '^$1')
        .replace(/<sub[^>]*>[^<]*<\/sub>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;|&thinsp;/g, ' ')
        .replace(/&times;/g, 'x')
        .replace(/&minus;|&#8722;|−/g, '-')
        .replace(/&Omega;/g, 'ohm')
        .replace(/&micro;|&mu;/g, 'u')
        .replace(/&plusmn;/g, '+-')
        .replace(/&amp;/g, '&')
        .replace(/[⁰¹²³⁴-⁹⁺⁻]+/g, run => '^' + run.replace(/./g, ch =>
            ({ '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5',
               '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁺': '+', '⁻': '-' })[ch] || ''))
        .replace(/\s+/g, ' ')
        .trim();
}

const SI = { p: 1e-12, n: 1e-9, u: 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, G: 1e9, T: 1e12 };

/**
 * A single number out of a cell, in base units where a prefix is present.
 *
 * Returns null for anything that is not one determined number: a range
 * ("0.5-5"), a list, a word. "1.10:1" is a VSWR and yields 1.10; "-26.4 dB"
 * yields -26.4; "150 pF" yields 1.5e-10.
 */
function cellValue(text) {
    let t = text.replace(/^[~≈about ]+/i, '').trim();
    if (!t || /^(?:n\/?a|-|—|–)$/i.test(t)) return null;

    // A VSWR written as a ratio.
    const vswr = /^(\d+(?:\.\d+)?)\s*:\s*1$/.exec(t);
    if (vswr) return parseFloat(vswr[1]);

    // A range or a list is not a value.
    if (/\d\s*(?:-|to|–|—|…|\.\.\.)\s*\d/.test(t) && !/^-/.test(t)) return null;
    if (/,\s*\d/.test(t.replace(/(\d),(\d{3})\b/g, '$1$2'))) return null;

    t = t.replace(/(\d),(\d{3})\b/g, '$1$2');

    const m = /^([+-]?\d+(?:\.\d+)?)\s*(?:x\s*10\s*\^\s*\(?([+-]?\d+)\)?)?\s*([pnumkKMGT])?\s*([A-Za-zΩ%°/·]*)/.exec(t);
    if (!m) return null;
    let v = parseFloat(m[1]);
    if (!isFinite(v)) return null;
    if (m[2] !== undefined && m[2] !== null) v *= Math.pow(10, parseInt(m[2], 10));
    // Only treat a letter as a prefix when a unit follows it, so "5 M" alone
    // stays 5 and "150 pF" becomes 1.5e-10.
    if (m[3] && m[4]) v *= SI[m[3]];
    return v;
}

/* ==================================================================
 * Relations
 * ==================================================================
 * `a` and `b` match column headers. `fn` maps the value in column a to the
 * value expected in column b. `tol` is fractional unless `abs` is set, in
 * which case it is an absolute difference in b's units - which is what you
 * want for decibels.
 */
const REL = [
    { label: 'bits -> levels',
      a: /\b(?:bits|resolution|n\b)\b/i, b: /\b(?:levels|steps|codes|counts)\b/i,
      fn: n => Math.pow(2, n), tol: 0.001 },

    { label: 'bits -> ideal SNR',
      // Only an ADC quantisation table. Modulation tables also pair bits with
      // an SNR, and the relation there is Shannon, not 6.02N + 1.76.
      a: /^\s*(?:bits|resolution|n)\s*\(?[^)]*\)?\s*$/i,
      b: /(?:ideal|theoretical|quantiz)[^|]{0,24}(?:snr|sqnr)|^\s*s(?:q)?nr\s*\(?d?b?\)?\s*$/i,
      bNot: /octave|required|per symbol|Eb|budget/i,
      fn: n => 6.02 * n + 1.76, tol: 0.6, abs: true },

    { label: 'bits -> dynamic range',
      a: /^\s*(?:bits|resolution|n)\s*\(?[^)]*\)?\s*$/i, b: /dynamic range/i,
      fn: n => 6.02 * n, tol: 1.0, abs: true },

    { label: 'VSWR -> reflection coefficient',
      a: /vswr|swr/i, b: /(?:reflection coeff|\|?gamma\|?|\|?Γ\|?|rho)/i,
      fn: s => (s - 1) / (s + 1), tol: 0.02 },

    { label: 'VSWR -> return loss',
      a: /vswr|swr/i, b: /return loss/i,
      fn: s => -20 * Math.log10((s - 1) / (s + 1)), tol: 0.4, abs: true, signless: true },

    { label: 'VSWR -> reflected power',
      a: /vswr|swr/i, b: /reflected (?:power|%)|power reflected/i,
      fn: s => Math.pow((s - 1) / (s + 1), 2) * 100, tol: 0.05 },

    { label: 'VSWR -> mismatch loss',
      a: /vswr|swr/i, b: /mismatch loss|insertion loss/i,
      fn: s => -10 * Math.log10(1 - Math.pow((s - 1) / (s + 1), 2)),
      tol: 0.05, abs: true, signless: true },

    { label: 'frequency -> free-space wavelength',
      a: /\b(?:frequency|freq|f)\b/i, b: /wavelength|\blambda\b|\bλ\b/i,
      // A wavelength quoted ON a medium is shorter by sqrt(eps_eff), and the
      // column that says so is right: module 21 lesson 6 labels its column
      // "lambda on FR4 microstrip" and every row checks out at eps_eff = 3.0.
      bNot: /fr-?4|microstrip|stripline|dielectric|medium|guided|coax|in copper|\/\s*10/i,
      fn: f => C / f, tol: 0.03 },

    { label: 'bandwidth -> rise time',
      a: /\bbandwidth\b/i, b: /rise time|\bt_?r\b/i,
      fn: bw => 0.35 / bw, tol: 0.06 },

    { label: 'AWG -> conductor diameter',
      a: /\bawg\b|wire gauge/i, b: /diameter/i,
      fn: n => 0.127e-3 * Math.pow(92, (36 - n) / 39), tol: 0.04 },

    // ---- two-source relations -------------------------------------------
    // These are where most of the course's tables actually live: a component
    // table with R and C columns and a corner frequency, an impedance table
    // with a frequency and a capacitance and a reactance.

    { label: 'R and C -> corner frequency',
      a: /^\s*R\b|resist/i, a2: /^\s*C\b|capacit/i,
      b: /(?:corner|cutoff|cut[- ]off|f_?c|f_?0|-?3\s*dB)\s*(?:freq\w*)?/i,
      bNot: /gain|phase|ripple|Q\b/i,
      fn: (R, Cc) => 1 / (2 * Math.PI * R * Cc), tol: 0.06 },

    { label: 'L and C -> resonant frequency',
      a: /^\s*L\b|induct/i, a2: /^\s*C\b|capacit/i,
      b: /(?:resonan\w*|f_?0|f_?res)\s*(?:freq\w*)?/i,
      fn: (L, Cc) => 1 / (2 * Math.PI * Math.sqrt(L * Cc)), tol: 0.06 },

    { label: 'frequency and C -> reactance',
      a: /\b(?:frequency|freq)\b/i, a2: /^\s*C\b|capacit/i,
      b: /(?:X_?C|reactance|impedance)/i,
      fn: (f, Cc) => 1 / (2 * Math.PI * f * Cc), tol: 0.08 },

    { label: 'frequency and L -> reactance',
      a: /\b(?:frequency|freq)\b/i, a2: /^\s*L\b|induct/i,
      b: /(?:X_?L|reactance|impedance)/i,
      fn: (f, L) => 2 * Math.PI * f * L, tol: 0.08 },

    { label: 'voltage and resistance -> current',
      a: /^\s*V\b|voltage/i, a2: /^\s*R\b|resist/i,
      b: /^\s*(?:I|current)\b/i,
      fn: (V, R) => V / R, tol: 0.06 },

    { label: 'voltage and current -> power',
      a: /^\s*V\b|voltage/i, a2: /^\s*(?:I|current)\b/i,
      b: /^\s*(?:P|power|dissipation)\b/i,
      fn: (V, I) => V * I, tol: 0.06 },

    { label: 'AWG -> resistance per metre',
      a: /\bawg\b|wire gauge/i, b: /(?:resistance|ohms?)\s*\/?\s*(?:m\b|metre|meter)/i,
      fn: n => {
          const d = 0.127e-3 * Math.pow(92, (36 - n) / 39);
          return 1.724e-8 / (Math.PI * d * d / 4);
      }, tol: 0.06 }
];

/* ==================================================================
 * Parse and check
 * ================================================================== */

function tablesIn(src) {
    const out = [];
    const re = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
    let m;
    while ((m = re.exec(src))) out.push(m[1]);
    return out;
}

function rowsOf(tableHtml) {
    const rows = [];
    const re = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    let m;
    while ((m = re.exec(tableHtml))) {
        const cells = [];
        const ce = /<(t[hd])\b[^>]*>([\s\S]*?)<\/\1>/gi;
        let c;
        while ((c = ce.exec(m[1]))) cells.push(cellText(c[2]));
        if (cells.length) rows.push(cells);
    }
    return rows;
}

const files = walk(LESSONS, []).sort();
const findings = [];
const fired = new Map();
let checked = 0;

files.forEach(file => {
    const src = fs.readFileSync(file, 'utf8');
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');

    tablesIn(src).forEach(t => {
        const rows = rowsOf(t);
        if (rows.length < 3) return;
        const head = rows[0];
        if (head.length < 2) return;

        REL.forEach(r => {
            const ai = head.findIndex(h => r.a.test(h));
            const bi = head.findIndex(h => r.b.test(h));
            if (ai === -1 || bi === -1 || ai === bi) return;
            if (r.bNot && r.bNot.test(head[bi])) return;
            if (r.aNot && r.aNot.test(head[ai])) return;

            // A relation may take two source columns - R and C for a corner
            // frequency - which is the shape most of these tables have.
            let a2i = -1;
            if (r.a2) {
                a2i = head.findIndex((h, k) => k !== ai && k !== bi && r.a2.test(h));
                if (a2i === -1) return;
            }

            rows.slice(1).forEach(row => {
                if (row.length <= Math.max(ai, bi, a2i)) return;
                const av = cellValue(row[ai]);
                const bv = cellValue(row[bi]);
                if (av === null || bv === null) return;
                let a2v = null;
                if (a2i !== -1) {
                    a2v = cellValue(row[a2i]);
                    if (a2v === null) return;
                }

                let want;
                try { want = a2i === -1 ? r.fn(av) : r.fn(av, a2v); } catch (e) { return; }
                if (want === null || !isFinite(want)) return;

                checked++;
                fired.set(r.label, (fired.get(r.label) || 0) + 1);

                const got = r.signless ? Math.abs(bv) : bv;
                const exp = r.signless ? Math.abs(want) : want;
                const off = r.abs ? Math.abs(got - exp)
                                  : Math.abs(got - exp) / (Math.abs(exp) || 1);
                if (off > r.tol) {
                    findings.push({
                        file: rel, label: r.label,
                        head: head[ai] + ' -> ' + head[bi],
                        row: row.slice(0, 6).join(' | ').slice(0, 90),
                        got: bv, want: want, off: off, abs: !!r.abs
                    });
                }
            });
        });
    });
});

console.log('TABLES OF COMPUTED VALUES\n');

if (LIST) {
    [...fired.entries()].sort((a, b) => b[1] - a[1])
        .forEach(([k, n]) => console.log('  ' + String(n).padStart(4) + '  ' + k));
    console.log('');
}

if (!findings.length) {
    console.log('  ' + checked + ' table cells checked against ' + REL.length +
                ' relations.\n');
    console.log('PASS - every computed table cell agrees with its own column.');
    process.exit(0);
}

findings.slice(0, 40).forEach(f => {
    console.log('  ' + f.file + '   [' + f.label + ']');
    console.log('      row: ' + f.row);
    console.log('      says ' + f.got + ', the relation gives ' +
                (Math.abs(f.want) < 1e-3 || Math.abs(f.want) > 1e5
                    ? f.want.toExponential(3) : f.want.toPrecision(5)) +
                '   (' + (f.abs ? f.off.toFixed(2) + ' out' :
                                  (f.off * 100).toFixed(0) + '% out') + ')');
});
if (findings.length > 40) console.log('  ... and ' + (findings.length - 40) + ' more');
console.log('');
console.log('FAIL - ' + findings.length + ' of ' + checked +
            ' computed table cells do not match.');
process.exit(1);
