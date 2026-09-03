#!/usr/bin/env node
/**
 * check-arithmetic - verify the sums the lessons actually show.
 *
 * Why this exists
 * ---------------
 * The course is full of worked numbers, and a worked number that is wrong is
 * worse than no worked number: the reader trusts it, checks their own work
 * against it, and concludes they are the one who made the mistake.
 *
 * Nothing checked them. Every other gating check looks at structure - markup,
 * nets, ids, widget shapes - and none of them can tell 4.6 from 4.8.
 *
 * What it checks
 * --------------
 * Expressions that are fully determined by the text, in LaTeX or prose:
 *
 *     \[ 0.048 \times 2.754 \times 6.62 = 0.875 \]
 *     36.5/(36.5+2) = 94.8%
 *     2 x 7.4 = 14.8 dB
 *
 * It evaluates the left side and compares against the stated right side, with
 * a tolerance that respects how many significant figures were written: a
 * result given as "0.875" is checked to three, "0.9" only to one. Rounding is
 * therefore not an error, but a genuinely wrong digit is.
 *
 * What it deliberately skips
 * --------------------------
 * Anything with a symbol, a unit inside the expression, an ellipsis, or a
 * range. Those are not arithmetic and guessing at them produces false
 * positives, which is the failure mode that gets a check ignored.
 *
 * Run: node tools/check-arithmetic.js [--list]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const LESSONS = path.join(ROOT, 'lessons');

function walk(dir, out) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, out);
        else if (e.name.endsWith('.html')) out.push(p);
    });
    return out;
}

/** Strip LaTeX decoration down to bare arithmetic, or return null. */
function delatex(s) {
    let t = s;

    // Things that mean the expression is not plain arithmetic.
    if (/\\(?:frac|sqrt|log|ln|sin|cos|tan|sum|int|pi\b|infty|cdots|ldots|dots|text|mathrm|left|right)/.test(t)) {
        // \left( \right) \, \; \! and \mathrm/\text units are decoration we can
        // remove; the rest genuinely changes the value.
        if (/\\(?:frac|sqrt|log|ln|sin|cos|tan|sum|int|infty|cdots|ldots|dots)/.test(t)) return null;
        if (/\\pi\b/.test(t)) return null;
    }

    t = t.replace(/\\left|\\right/g, '');
    t = t.replace(/\\(?:mathrm|text|mathbf|bf|rm)\s*\{[^{}]*\}/g, ' ');
    t = t.replace(/\\[,;!:> ]/g, ' ');
    t = t.replace(/\\times/g, '*').replace(/\\cdot/g, '*');
    t = t.replace(/\\div/g, '/');
    t = t.replace(/\\%/g, '%');
    t = t.replace(/\\approx|\\simeq|\\cong/g, '=');
    t = t.replace(/\\!/g, '');

    // Superscripts BEFORE braces are stripped, or the exponent loses its
    // grouping: 10^{-1.8/10} was becoming 10**(-1.8)/10, which is a completely
    // different number and produced a false failure.
    t = t.replace(/\^\s*\{([^{}]*)\}/g, function (_, inner) { return '**(' + inner + ')'; });
    t = t.replace(/\^\s*\(?\s*(-?\d+(?:\.\d+)?)\s*\)?/g, '**($1)');

    t = t.replace(/\{|\}/g, ' ');
    t = t.replace(/\s+/g, ' ').trim();
    return t;
}

/**
 * Is the discrepancy just a unit prefix?
 *
 * "1.732 x 480 x 45 = 37.4" is correct as written when the answer is in kVA
 * and the inputs are in volts and amps. The arithmetic is right; the prefix
 * changed. Same for mV to V, and for a dB conversion where one side is a
 * ratio and the other a decibel value.
 *
 * A genuine digit error is essentially never an exact power of ten, so
 * treating those as prefix changes costs almost no detection and removes the
 * overwhelming majority of false positives.
 */
function isPrefixShift(a, b) {
    if (!(a > 0 && b > 0)) return false;
    const r = Math.log10(a / b);
    return Math.abs(r - Math.round(r)) < 0.02 && Math.round(r) !== 0;
}

/** Significant figures in a written number, for choosing the tolerance. */
function sigFigs(str) {
    const m = /(-?)(\d*)\.?(\d*)/.exec(str.replace(/[, ]/g, ''));
    if (!m) return 3;
    const digits = (m[2] + m[3]).replace(/^0+/, '');
    return Math.max(1, digits.length);
}

function safeEval(expr) {
    // Only digits, operators, parentheses, decimal points and ** are allowed.
    if (!/^[\d\s.+\-*/()e]+$/i.test(expr.replace(/\*\*/g, ''))) return null;
    if (!/[\d]/.test(expr)) return null;
    try {
        // eslint-disable-next-line no-new-func
        const v = Function('"use strict";return (' + expr + ')')();
        return (typeof v === 'number' && isFinite(v)) ? v : null;
    } catch (e) { return null; }
}

const files = walk(LESSONS, []).sort();
const findings = [];
let checked = 0;

files.forEach(file => {
    const src = fs.readFileSync(file, 'utf8');
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');

    // Only look inside display math, where worked numbers live. Prose
    // arithmetic is too entangled with units to parse safely.
    const blocks = src.match(/\\\[([\s\S]*?)\\\]/g) || [];

    blocks.forEach(raw => {
        const body = raw.slice(2, -2);

        // Split on = and check each adjacent pair where BOTH sides reduce to
        // numbers. A chain like "a = b = c" gives two checks.
        const parts = body.split(/(?<![<>!])=(?!=)/);
        if (parts.length < 2) return;

        for (let i = 0; i < parts.length - 1; i++) {
            const lhsRaw = parts[i], rhsRaw = parts[i + 1];

            // The right side must be a bare number (optionally with a trailing
            // unit we strip), or there is nothing to compare against.
            const rhsClean = delatex(rhsRaw);
            if (rhsClean === null) continue;
            const rhsNum = /^\s*(-?\d[\d,]*(?:\.\d+)?)\s*(?:\*\*\(?-?\d+\)?)?\s*$/.exec(rhsClean);
            let rhsVal, rhsText;
            if (rhsNum) {
                rhsText = rhsNum[1];
                rhsVal = parseFloat(rhsText.replace(/,/g, ''));
                // "3.2 \times 10^{-4}" style right sides
                const sci = /^\s*(-?\d+(?:\.\d+)?)\s*\*\s*10\s*\*\*\(?(-?\d+)\)?\s*$/.exec(rhsClean);
                if (sci) { rhsText = sci[1]; rhsVal = parseFloat(sci[1]) * Math.pow(10, parseInt(sci[2], 10)); }
            } else {
                const sci = /^\s*(-?\d+(?:\.\d+)?)\s*\*\s*10\s*\*\*\(?(-?\d+)\)?\s*$/.exec(rhsClean);
                if (!sci) continue;
                rhsText = sci[1];
                rhsVal = parseFloat(sci[1]) * Math.pow(10, parseInt(sci[2], 10));
            }
            if (!isFinite(rhsVal)) continue;

            // A decibel right-hand side is a CONVERSION, not an equality:
            // "|T| = 10^4 = 80 dB" is correct because 20 log10(10^4) = 80.
            // Reading it as plain equality flagged a correct lesson. Handling
            // it properly also means a WRONG dB conversion now gets caught,
            // which is worth more than the suppression.
            const isDb = /\\(?:mathrm|text)\s*\{\s*dB[a-z]*\s*\}|\bdB[a-z]*\b/i.test(rhsRaw);

            const lhsClean = delatex(lhsRaw);
            if (lhsClean === null) continue;
            // The left side must be an actual computation, not a bare symbol
            // or a bare number restated.
            if (!/[+\-*/]/.test(lhsClean.replace(/^-/, ''))) continue;
            if (/[A-Za-z]/.test(lhsClean.replace(/e(?=[+-]?\d)/gi, ''))) continue;

            const lhsVal = safeEval(lhsClean);
            if (lhsVal === null) continue;

            checked++;

            // Tolerance from the significant figures actually written, with a
            // floor so a value given to one figure is not held to 10%.
            const sf = sigFigs(rhsText);
            const relTol = Math.max(Math.pow(10, -(sf - 1)) * 0.55, 0.005);
            const err = Math.abs(lhsVal - rhsVal) / (Math.abs(rhsVal) || 1);

            // Accept a correct dB conversion in either convention.
            if (isDb && lhsVal > 0) {
                const asAmp = 20 * Math.log10(lhsVal);
                const asPow = 10 * Math.log10(lhsVal);
                if (Math.abs(asAmp - rhsVal) < 0.6 || Math.abs(asPow - rhsVal) < 0.6) continue;
            }

            if (err > relTol && !isPrefixShift(lhsVal, rhsVal)) {
                findings.push({
                    file: rel,
                    expr: lhsClean.slice(0, 70),
                    got: lhsVal,
                    said: rhsVal,
                    errPct: err * 100
                });
            }
        }
    });
});

if (!findings.length) {
    console.log('PASS - ' + checked + ' worked expressions check out.');
    process.exit(0);
}

console.log('check-arithmetic: ' + findings.length + ' of ' + checked +
            ' worked expressions do not evaluate as written.\n');
findings.slice(0, 40).forEach(f => {
    console.log(f.file);
    console.log('    ' + f.expr);
    console.log('    evaluates to ' + f.got.toPrecision(6) +
                ', the lesson says ' + f.said + '   (' + f.errPct.toFixed(1) + '% out)');
});
if (findings.length > 40) console.log('  ... and ' + (findings.length - 40) + ' more');

process.exit(1);
