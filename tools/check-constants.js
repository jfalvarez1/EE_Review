#!/usr/bin/env node
/**
 * check-constants - the numbers that are not derived, only remembered.
 *
 * Why this exists
 * ---------------
 * check-arithmetic verifies that a worked sum evaluates as written. It cannot
 * tell you that the sum started from the wrong permittivity. Those numbers -
 * epsilon-nought, the charge on an electron, the thermal voltage, the thickness
 * of an ounce of copper - are copied from memory, and a digit that slips in one
 * lesson propagates into every calculation downstream of it while every
 * individual step still checks out.
 *
 * So this reads the constants the lessons state and compares them against the
 * accepted values. Each rule needs a CONTEXT as well as a number, because "8.85"
 * on its own is not a claim about anything; it becomes one only when it appears
 * next to a permittivity.
 *
 * Tolerances are deliberately loose. The point is to catch 8.55 written for
 * 8.85, or 25 nH/inch quoted as 250, not to insist on CODATA precision - a
 * lesson is allowed to round, and most of these have a conventional rounded
 * form the whole industry uses.
 *
 * Run: node tools/check-constants.js [--list]
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const LESSONS = path.join(ROOT, 'lessons');
const LIST = process.argv.includes('--list');

function walk(dir, out) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, out);
        else if (e.name.endsWith('.html')) out.push(p);
    });
    return out;
}

/**
 * Text as a reader sees it: entities resolved, superscripts turned into
 * exponents, subscripts dropped because they are part of a name.
 */
function readable(src) {
    return src
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<sup[^>]*>\s*([^<]{1,12}?)\s*<\/sup>/gi, '^$1')
        .replace(/<sub[^>]*>[^<]*<\/sub>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;|&thinsp;/g, ' ')
        .replace(/&times;|&#215;/g, '\u00d7')
        .replace(/&minus;|&#8722;/g, '-')
        .replace(/&Omega;/g, '\u03a9')
        .replace(/&micro;|&mu;/g, '\u00b5')
        .replace(/&epsilon;|&#949;/g, '\u03b5')
        .replace(/&pi;/g, '\u03c0')
        .replace(/&deg;/g, '\u00b0')
        .replace(/&amp;/g, '&')
        // Unicode superscripts. Lessons write 10⁻¹⁹ as often as 10<sup>-19</sup>,
        // and a rule anchored on "10^-19" sees neither unless they are folded
        // to the same form first - which is why the first run of this checker
        // found no fundamental constants at all in a course full of them.
        .replace(/[⁰¹²³⁴-⁹⁺⁻]+/g, run =>
            '^' + run.replace(/./g, ch =>
                ({ '⁰': '0', '¹': '1', '²': '2', '³': '3',
                   '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7',
                   '⁸': '8', '⁹': '9', '⁺': '+', '⁻': '-' })[ch] || ''))
        .replace(/\s+/g, ' ');
}

/** A number, possibly in scientific notation, starting at a match group. */
function numberFrom(mantissa, times, exponent) {
    let v = parseFloat(String(mantissa).replace(/,/g, ''));
    if (!isFinite(v)) return null;
    if (times && exponent !== undefined && exponent !== null && exponent !== '') {
        v *= Math.pow(10, parseInt(exponent, 10));
    }
    return v;
}

const SCI = '(\\d+(?:\\.\\d+)?)\\s*(?:(\\u00d7|x|\\*)\\s*10\\s*\\^\\s*\\(?(-?\\d+)\\)?)?';

/*
 * Each rule: a regex whose first groups are a number (optionally with an
 * exponent), the accepted value, and a fractional tolerance. `note` is what a
 * reader should see if it fails.
 */
/*
 * Wherever a constant carries a distinctive UNIT, the rule is anchored on that
 * rather than on the symbol. "q = 1.6e-19 C" and "k = 1.38e-23 J/K" are
 * unambiguous; a rule that keys on a bare "q =" also matches "Q = 0.707", which
 * is what the first version of this file did fourteen times.
 */
const MANT = '(\\d+(?:\\.\\d+)?)\\s*(?:\\u00d7|x|\\*)\\s*10\\s*\\^\\s*\\(?';

const RULES = [
    { label: 'permittivity of free space',
      re: new RegExp(MANT + '-?12\\)?\\s*F\\s*/\\s*m', 'gi'),
      expect: 8.854, tol: 0.01,
      note: '8.854 (× 10^-12 F/m)' },

    { label: 'permeability of free space',
      re: new RegExp(MANT + '-?7\\)?\\s*H\\s*/\\s*m', 'gi'),
      expect: 12.566, tol: 0.02, alt: [4],   // 4π × 10^-7 is written both ways
      note: '4π × 10^-7 = 12.566 × 10^-7 H/m' },

    { label: 'electron charge',
      re: new RegExp(MANT + '-?19\\)?\\s*C\\b', 'gi'),
      expect: 1.602, tol: 0.01,
      note: '1.602 (× 10^-19 C)' },

    { label: 'Boltzmann constant',
      re: new RegExp(MANT + '-?23\\)?\\s*J\\s*/\\s*K', 'gi'),
      expect: 1.381, tol: 0.02,
      note: '1.381 (× 10^-23 J/K)' },

    { label: 'speed of light',
      re: new RegExp(MANT + '8\\)?\\s*m\\s*/\\s*s', 'gi'),
      expect: 3.0, tol: 0.02,
      note: '2.998 × 10^8 m/s' },

    { label: 'impedance of free space',
      re: /(?:impedance of free space|free[- ]space impedance)[^.]{0,30}?(\d+(?:\.\d+)?)\s*Ω/gi,
      expect: 377, tol: 0.02,
      note: '376.7 Ω' },

    { label: 'thermal noise floor at 290 K',
      re: /(?:noise floor|kTB|thermal noise)[^.]{0,60}?-(\d{3})\s*dBm\s*\/?\s*Hz/gi,
      expect: 174, tol: 0.012,
      note: '-174 dBm/Hz' },

    { label: 'thermal voltage at room temperature',
      re: /(?:V_?T|thermal voltage|kT\s*\/\s*q)[^.]{0,40}?(?:=|\u2248|is)\s*(\d+(?:\.\d+)?)\s*mV/gi,
      expect: 25.85, tol: 0.06,
      note: '25.7 mV at 25 \u00b0C, 25.85 mV at 300 K - 26 mV is the usual rounding' },

    { label: 'decade of collector current per volt',
      re: /(\d+(?:\.\d+)?)\s*mV[^.]{0,50}?(?:per\s+)?decade of (?:collector )?current/gi,
      expect: 59.5, tol: 0.12,
      note: 'V_T ln 10 = 59.5 mV, usually quoted as 60 mV/decade' },

    { label: 'V_BE temperature coefficient',
      re: /V_?BE[^.]{0,60}?(-?\d+(?:\.\d+)?)\s*mV\s*\/\s*\u00b0?C/gi,
      expect: -2.1, tol: 0.25, signless: true,
      note: 'about -2 mV/\u00b0C' },

    { label: 'copper resistivity',
      re: new RegExp(MANT + '-?8\\)?\\s*\\u03a9\\s*[\\u00b7.\\-]?\\s*m\\b', 'gi'),
      expect: 1.68, tol: 0.05,
      note: '1.68 (\u00d7 10^-8 \u03a9\u00b7m at 20 \u00b0C)' },

    { label: 'one ounce copper thickness',
      re: /1\s*oz[^.]{0,60}?(\d+(?:\.\d+)?)\s*\u00b5m/gi,
      expect: 34.8, tol: 0.06,
      note: '34.8 \u00b5m (1.37 mil)' },

    { label: 'one ounce copper sheet resistance',
      re: /1\s*oz[^.]{0,70}?(\d+(?:\.\d+)?)\s*m\u03a9\s*\/?\s*(?:sq|\u25a1|square)/gi,
      expect: 0.49, tol: 0.08,
      note: '0.49 m\u03a9 per square' },

    { label: 'ground lead inductance per inch',
      re: /(\d+(?:\.\d+)?)\s*nH\s*\/\s*(?:inch|in\b)/gi,
      expect: 22, tol: 0.35,
      // A 50 Ω line is 8.3 nH/inch and that is correct - the rule is about the
      // probe's ground lead, not about every inductance quoted per inch.
      onlyNear: /ground (?:lead|wire|clip|spring)|probe lead/i,
      note: '20-25 nH per inch of thin wire' },

    { label: 'signal delay in FR4',
      re: /(\d+(?:\.\d+)?)\s*ps\s*\/\s*mm/gi,
      expect: 6.1, tol: 0.25,
      // "the error is about 1.1 ps/mm" is a tolerance, not a velocity.
      onlyNear: /propagation|prop delay|velocity|travels|signal delay/i,
      notNear: /error|skew|mismatch|tolerance|variation/i,
      note: 'about 6 ps/mm in FR4 microstrip, 7 ps/mm in stripline' },

    { label: 'FR4 dielectric constant',
      re: /(?:\u03b5_?r|\bEr\b|\bDk\b|dielectric constant|relative permittivity)[^.|]{0,24}?(?:=|\u2248|of|is|:)\s*(\d(?:\.\d+)?)\b/gi,
      expect: 4.4, tol: 0.16, onlyNear: /FR-?4/i,
      note: '4.2-4.6 at 1 GHz, falling with frequency' },

    { label: 'rise-time bandwidth constant',
      re: /(?:t_?r|rise time)\s*(?:=|\u2248)\s*(\d*\.\d+)\s*\/\s*BW/gi,
      expect: 0.35, tol: 0.03,
      note: '0.35 for a Gaussian response below 1 GHz' }
];

const files = walk(LESSONS, []).sort();
const findings = [];
const seen = new Map();
let checked = 0;

files.forEach(file => {
    const text = readable(fs.readFileSync(file, 'utf8'));
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');

    RULES.forEach(rule => {
        rule.re.lastIndex = 0;
        let m;
        while ((m = rule.re.exec(text))) {
            const v = numberFrom(m[1], m[2], m[3]);
            if (v === null) continue;

            // Some rules need a keyword nearby that is awkward to fold into
            // the pattern - "FR4" may sit a clause away from its Dk.
            if (rule.onlyNear) {
                const window = text.slice(Math.max(0, m.index - 120),
                                          m.index + m[0].length + 120);
                if (!rule.onlyNear.test(window)) continue;
            }
            if (rule.notNear) {
                const window = text.slice(Math.max(0, m.index - 60),
                                          m.index + m[0].length + 30);
                if (rule.notNear.test(window)) continue;
            }

            checked++;
            seen.set(rule.label, (seen.get(rule.label) || 0) + 1);

            const a = rule.signless ? Math.abs(v) : v;
            const cands = [rule.expect].concat(rule.alt || []);
            const err = Math.min.apply(null, cands.map(c => {
                const b = rule.signless ? Math.abs(c) : c;
                return Math.abs(a - b) / Math.abs(b);
            }));
            if (err > rule.tol) {
                findings.push({
                    file: rel, label: rule.label, got: v, want: rule.note,
                    errPct: err * 100,
                    context: text.slice(Math.max(0, m.index - 40),
                                        m.index + m[0].length + 20).trim()
                });
            }
        }
    });
});

console.log('PHYSICAL CONSTANTS AND STANDARD VALUES\n');

if (LIST) {
    [...seen.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => {
        console.log('  ' + String(n).padStart(4) + '  ' + k);
    });
    console.log('');
}

if (!findings.length) {
    console.log('  ' + checked + ' stated values checked against ' +
                RULES.length + ' rules.\n');
    console.log('PASS - every constant the lessons state is the right one.');
    process.exit(0);
}

findings.forEach(f => {
    console.log('  ' + f.file);
    console.log('      ' + f.label + ': lesson says ' + f.got +
                ', accepted value is ' + f.want + '   (' + f.errPct.toFixed(0) + '% out)');
    console.log('      ...' + f.context.replace(/\s+/g, ' ') + '...');
});
console.log('');
console.log('FAIL - ' + findings.length + ' of ' + checked +
            ' stated constants disagree with the accepted value.');
process.exit(1);
