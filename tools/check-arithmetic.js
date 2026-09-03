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
 * Nothing else checks them. Every other gating check looks at structure -
 * markup, nets, ids, widget shapes - and none of them can tell 4.6 from 4.8.
 *
 * What it checks
 * --------------
 * Any expression that is fully determined by the text, wherever it appears:
 *
 *     \[ 0.048 \times 2.754 \times 6.62 = 0.875 \]        display math
 *     \( 1/(2\pi \times 10^4 \times 10^{-8}) = 1592 \)     inline math
 *     12 &times; 10/57 = 2.11 V                            prose and tables
 *
 * The first version could only handle four operators, which meant it skipped
 * every expression containing \frac, \sqrt, \pi or a logarithm - that is to
 * say, most of the interesting ones, and it checked 42 expressions in a course
 * with several hundred. This one parses the expression properly, so
 * \frac{1}{2\pi\sqrt{LC}} is evaluated rather than ignored.
 *
 * It compares against the stated result with a tolerance taken from how many
 * significant figures were written: a result given as "0.875" is checked to
 * three, "0.9" only to one. Rounding is therefore not an error and a genuinely
 * wrong digit is.
 *
 * What it deliberately lets through
 * ---------------------------------
 * A pure unit-prefix shift (1.732 x 480 x 45 = 37.4 kVA), a decibel conversion
 * in either convention, and anything containing a free symbol, a range or an
 * ellipsis. Guessing at those produces false positives, which is the failure
 * mode that gets a check ignored.
 *
 * Run: node tools/check-arithmetic.js [--list] [--verbose]
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const LESSONS = path.join(ROOT, 'lessons');
const VERBOSE = process.argv.includes('--verbose');

function walk(dir, out) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, out);
        else if (e.name.endsWith('.html')) out.push(p);
    });
    return out;
}

/* ==================================================================
 * A small expression parser
 * ==================================================================
 * Recursive descent over a token stream. It exists instead of Function()
 * because the interesting expressions need sqrt, log and pi, and because an
 * evaluator that refuses to guess is worth more here than one that is clever:
 * anything it does not recognise returns null and the expression is skipped.
 */

const CONSTS = { pi: Math.PI, e: Math.E };
const FUNCS = {
    sqrt: Math.sqrt, abs: Math.abs, exp: Math.exp,
    ln: Math.log, log: x => Math.log10(x), log10: x => Math.log10(x),
    log2: x => Math.log2(x),
    sin: Math.sin, cos: Math.cos, tan: Math.tan,
    asin: Math.asin, acos: Math.acos, atan: Math.atan,
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh
};

function tokenize(src) {
    const out = [];
    let i = 0;
    while (i < src.length) {
        const c = src[i];
        if (/\s/.test(c)) { i++; continue; }
        if (/[0-9.]/.test(c)) {
            const m = /^\d*\.?\d+(?:[eE][+-]?\d+)?/.exec(src.slice(i));
            if (!m) return null;
            out.push({ t: 'num', v: parseFloat(m[0]) });
            i += m[0].length;
            continue;
        }
        if (/[a-zA-Z_]/.test(c)) {
            const m = /^[a-zA-Z_][a-zA-Z_0-9]*/.exec(src.slice(i));
            out.push({ t: 'name', v: m[0] });
            i += m[0].length;
            continue;
        }
        if ('+-*/^()'.indexOf(c) !== -1) { out.push({ t: c }); i++; continue; }
        return null;                       // an operator we do not model
    }
    return out;
}

function parse(tokens) {
    let p = 0;
    const peek = () => tokens[p];
    const eat = t => (tokens[p] && tokens[p].t === t) ? (p++, true) : false;

    function primary() {
        const tk = peek();
        if (!tk) return null;
        if (tk.t === '-') { p++; const v = primary(); return v === null ? null : -v; }
        if (tk.t === '+') { p++; return primary(); }
        if (tk.t === 'num') { p++; return tk.v; }
        if (tk.t === '(') {
            p++;
            const v = expr();
            if (v === null || !eat(')')) return null;
            return v;
        }
        if (tk.t === 'name') {
            const name = tk.v.toLowerCase();
            p++;
            if (Object.prototype.hasOwnProperty.call(FUNCS, name)) {
                if (!eat('(')) return null;
                const a = expr();
                if (a === null || !eat(')')) return null;
                return FUNCS[name](a);
            }
            if (Object.prototype.hasOwnProperty.call(CONSTS, name)) return CONSTS[name];
            return null;                   // a free symbol: not arithmetic
        }
        return null;
    }

    // Right-associative, and binds tighter than unary minus on its left, which
    // is the usual convention: -2^2 is -4.
    function power() {
        const base = primary();
        if (base === null) return null;
        if (peek() && peek().t === '^') {
            p++;
            const ex = power();
            if (ex === null) return null;
            return Math.pow(base, ex);
        }
        return base;
    }

    function term() {
        let v = power();
        if (v === null) return null;
        for (;;) {
            const tk = peek();
            if (!tk) return v;
            if (tk.t === '*' || tk.t === '/') {
                p++;
                const r = power();
                if (r === null) return null;
                v = tk.t === '*' ? v * r : v / r;
                continue;
            }
            // Implicit multiplication: 2\pi f, 3(x+1), (a)(b).
            if (tk.t === 'num' || tk.t === 'name' || tk.t === '(') {
                const r = power();
                if (r === null) return null;
                v = v * r;
                continue;
            }
            return v;
        }
    }

    function expr() {
        let v = term();
        if (v === null) return null;
        for (;;) {
            const tk = peek();
            if (!tk) return v;
            if (tk.t === '+' || tk.t === '-') {
                p++;
                const r = term();
                if (r === null) return null;
                v = tk.t === '+' ? v + r : v - r;
                continue;
            }
            return v;
        }
    }

    const v = expr();
    if (v === null || p !== tokens.length) return null;
    return (typeof v === 'number' && isFinite(v)) ? v : null;
}

function evaluate(src) {
    const toks = tokenize(src);
    if (!toks || !toks.length) return null;
    if (!toks.some(t => t.t === 'num')) return null;
    return parse(toks);
}

/* ==================================================================
 * LaTeX -> parseable source
 * ================================================================== */

/** Take the {...} group at position i, returning [inner, nextIndex]. */
function group(s, i) {
    if (s[i] !== '{') {
        // A single token argument: \sqrt2, \frac12
        const m = /^\\?[A-Za-z0-9.]+/.exec(s.slice(i));
        return m ? [m[0], i + m[0].length] : null;
    }
    let depth = 0;
    for (let j = i; j < s.length; j++) {
        if (s[j] === '{') depth++;
        else if (s[j] === '}') {
            depth--;
            if (!depth) return [s.slice(i + 1, j), j + 1];
        }
    }
    return null;
}

/**
 * Remove a macro and its brace group, counting nested braces.
 *
 * \boxed and \underbrace keep their contents (they wrap a value); the label
 * macros drop theirs (they wrap a unit). The difference is which side of the
 * `keep` flag they are on.
 */
function stripBalanced(s, macroRe, keep) {
    for (let guard = 0; guard < 60; guard++) {
        macroRe.lastIndex = 0;
        const m = macroRe.exec(s);
        if (!m) return s;
        const start = m.index;
        let i = m.index + m[0].length;
        while (s[i] === ' ') i++;
        if (s[i] !== '{') { s = s.slice(0, start) + ' ' + s.slice(i); continue; }
        let depth = 0, j = i;
        for (; j < s.length; j++) {
            if (s[j] === '{') depth++;
            else if (s[j] === '}') { depth--; if (!depth) break; }
        }
        if (j >= s.length) return s.slice(0, start) + ' ';
        const inner = s.slice(i + 1, j);
        const wrapsValue = /\\(?:boxed|underbrace)/.test(m[0]);
        s = s.slice(0, start) + (wrapsValue ? ' (' + inner + ') ' : ' ') + s.slice(j + 1);
    }
    return s;
}

/** Rewrite \frac and \sqrt into ordinary parenthesised arithmetic. */
function expandMacros(s) {
    for (let guard = 0; guard < 40; guard++) {
        let changed = false;

        let i = s.indexOf('\\frac');
        if (i !== -1) {
            let j = i + 5;
            while (s[j] === ' ') j++;
            const a = group(s, j);
            if (!a) return null;
            let k = a[1];
            while (s[k] === ' ') k++;
            const b = group(s, k);
            if (!b) return null;
            s = s.slice(0, i) + '((' + a[0] + ')/(' + b[0] + '))' + s.slice(b[1]);
            changed = true;
        }

        i = s.indexOf('\\sqrt');
        if (i !== -1) {
            let j = i + 5;
            if (s[j] === '[') return null;          // an nth root: not modelled
            while (s[j] === ' ') j++;
            const a = group(s, j);
            if (!a) return null;
            s = s.slice(0, i) + 'sqrt((' + a[0] + '))' + s.slice(a[1]);
            changed = true;
        }

        if (!changed) return s;
    }
    return null;
}

/** Strip LaTeX decoration down to bare arithmetic, or return null. */
function delatex(raw) {
    let t = raw;

    // Constructs that are not a single determined value.
    if (/\\(?:sum|int|prod|lim|infty|cdots|ldots|dots|pm|mp|approxeq|sim\b)/.test(t)) return null;
    if (/\\(?:begin|end)\b/.test(t)) return null;

    t = t.replace(/\\left|\\right/g, '');
    // A unit label may itself contain braces - \mathrm{nV/\sqrt{Hz}} - and a
    // non-nesting strip leaves the \mathrm behind, which then trips the
    // "unhandled macro" guard and silently skips the expression. That is how a
    // wrong step in the noise lesson survived: 4 x 0.387 = 1.58 was never
    // looked at.
    t = stripBalanced(t, /\\(?:mathrm|text|textrm|mathbf|bf|rm|mathit|operatorname|boxed|underbrace)\s*/g);
    t = t.replace(/\\[,;!:>| ]/g, ' ');
    t = t.replace(/\\!/g, '');

    t = expandMacros(t);
    if (t === null) return null;

    t = t.replace(/\\times|\\cdot|\\ast/g, '*');
    t = t.replace(/\\div/g, '/');
    t = t.replace(/\\pi\b/g, 'pi');
    t = t.replace(/\\log_\{?10\}?/g, 'log');
    t = t.replace(/\\log_\{?2\}?/g, 'log2');
    t = t.replace(/\\(log|ln|exp|sin|cos|tan|sinh|cosh|tanh|sqrt|abs|max|min)\b/g, '$1');
    t = t.replace(/\\%/g, '%');
    t = t.replace(/\\approx|\\simeq|\\cong/g, '=');

    // Superscripts BEFORE braces are stripped, or the exponent loses its
    // grouping: 10^{-1.8/10} became 10^(-1.8)/10, a different number entirely.
    t = t.replace(/\^\s*\{([^{}]*)\}/g, (_, inner) => '^(' + inner + ')');
    t = t.replace(/_\s*\{[^{}]*\}/g, '');
    t = t.replace(/_[A-Za-z0-9]/g, '');

    t = t.replace(/\{|\}/g, ' ');
    t = t.replace(/\s+/g, ' ').trim();
    // LaTeX writes a thousands separator as a thin space: \sqrt{20\,000}. Once
    // the macro is stripped that is two numbers sitting side by side.
    t = t.replace(/(\d) (\d{3})\b/g, '$1$2');
    if (/\\/.test(t)) return null;                  // an unhandled macro remains
    return t;
}

/** HTML entities and typographic operators used in prose arithmetic. */
function deentity(s) {
    return s
        .replace(/&nbsp;|&thinsp;|&ensp;|&emsp;|&#x?0*(?:160|A0);/gi, ' ')
        .replace(/&times;|&#215;|×|·|&middot;/g, '*')
        .replace(/&divide;|&#247;|÷/g, '/')
        .replace(/&minus;|&#8722;|−|–|—/g, '-')
        .replace(/&plus;|＋/g, '+')
        // Units, so the unit-aware pass below can see them. Lessons write
        // "4.7&nbsp;k&Omega;", and a scanner that does not decode &Omega;
        // simply never sees a resistance.
        .replace(/&Omega;|&#937;/g, 'Ω')
        .replace(/&micro;|&mu;|&#181;/g, 'µ')
        .replace(/&deg;/g, '°')
        .replace(/&pi;|π/g, 'pi')
        .replace(/&radic;|√/g, 'sqrt')
        .replace(/&sup2;|²/g, '^2')
        .replace(/&sup3;|³/g, '^3')
        .replace(/&frac12;|½/g, '(1/2)')
        .replace(/&lowast;|∗/g, '*')
        .replace(/&equals;/g, '=')
        .replace(/&amp;/g, '&')
        // A space used as a thousands separator - "20 000" - otherwise
        // tokenises as two numbers and multiplies out to nonsense.
        .replace(/(\d)[  ](\d{3})\b/g, '$1$2');
}

/* ==================================================================
 * Comparison
 * ================================================================== */

/**
 * Is the discrepancy just a unit prefix?
 *
 * "1.732 x 480 x 45 = 37.4" is correct as written when the answer is in kVA
 * and the inputs are volts and amps. A genuine digit error is essentially
 * never an exact power of ten, so treating those as prefix changes costs
 * almost no detection and removes most false positives.
 */
function isPrefixShift(a, b) {
    if (!(Math.abs(a) > 0 && Math.abs(b) > 0)) return false;
    const r = Math.log10(Math.abs(a) / Math.abs(b));
    return Math.abs(r - Math.round(r)) < 0.02 && Math.round(r) !== 0;
}

/** Significant figures in a written number, for choosing the tolerance. */
function sigFigs(str) {
    const s = String(str).replace(/[, ]/g, '');
    const m = /(-?)(\d*)\.?(\d*)/.exec(s);
    if (!m) return 3;
    const digits = (m[2] + m[3]).replace(/^0+/, '');
    return Math.max(1, digits.length);
}

/* ==================================================================
 * Extraction
 * ================================================================== */

const RHS_NUM = /^\s*(-?\d[\d,]*(?:\.\d+)?)\s*$/;
const RHS_SCI = /^\s*(-?\d+(?:\.\d+)?)\s*\*\s*10\s*\^\s*\(?(-?\d+)\)?\s*$/;

function rhsValue(clean) {
    let m = RHS_SCI.exec(clean);
    if (m) return { text: m[1], value: parseFloat(m[1]) * Math.pow(10, parseInt(m[2], 10)) };
    m = RHS_NUM.exec(clean);
    if (m) return { text: m[1], value: parseFloat(m[1].replace(/,/g, '')) };
    // A bare power of ten on its own: "= 10^6"
    m = /^\s*10\s*\^\s*\(?(-?\d+)\)?\s*$/.exec(clean);
    if (m) return { text: '1', value: Math.pow(10, parseInt(m[1], 10)) };
    return null;
}

/**
 * Check one "... = ..." chain. Every adjacent pair where the right side is a
 * bare number and the left side is a computation gets compared.
 */
function checkChain(body, rawForDb, sink, where) {
    const parts = body.split(/(?<![<>!=])=(?![=>])/);
    if (parts.length < 2) return;

    for (let i = 0; i < parts.length - 1; i++) {
        const lhsRaw = parts[i], rhsRaw = parts[i + 1];

        const rhsClean = delatex(rhsRaw);
        if (rhsClean === null) continue;
        const rhs = rhsValue(rhsClean);
        if (!rhs || !isFinite(rhs.value)) continue;

        const lhsClean = delatex(lhsRaw);
        if (lhsClean === null) continue;

        // The left side must be an actual computation, not a bare symbol or a
        // number restated.
        if (!/[+\-*/^]/.test(lhsClean.replace(/^-/, ''))) continue;

        const lhsVal = evaluate(lhsClean);
        if (lhsVal === null) continue;

        // A decibel right-hand side is a CONVERSION, not an equality:
        // "|T| = 10^4 = 80 dB" is correct because 20 log10(10^4) = 80.
        const isDb = /\\(?:mathrm|text)\s*\{\s*dB[a-z]*\s*\}|\bdB[a-zΩ]*\b/i.test(rawForDb);
        if (isDb && lhsVal > 0) {
            const asAmp = 20 * Math.log10(lhsVal);
            const asPow = 10 * Math.log10(lhsVal);
            if (Math.abs(asAmp - rhs.value) < 0.6 || Math.abs(asPow - rhs.value) < 0.6) continue;
        }

        sink.checked++;

        const sf = sigFigs(rhs.text);
        const relTol = Math.max(Math.pow(10, -(sf - 1)) * 0.55, 0.005);
        const err = Math.abs(lhsVal - rhs.value) / (Math.abs(rhs.value) || 1);

        if (err > relTol && !isPrefixShift(lhsVal, rhs.value)) {
            sink.findings.push({
                where,
                expr: lhsClean.slice(0, 80),
                got: lhsVal,
                said: rhs.value,
                errPct: err * 100
            });
        } else if (err > relTol * 0.45 && err > 0.002 &&
                   !isPrefixShift(lhsVal, rhs.value)) {
            // Inside tolerance but only just. Worth listing on request: a
            // number that is 1.5% out when it should round to 0.2% is usually
            // a constant taken at the wrong temperature, not a rounding.
            sink.near.push({
                where, expr: lhsClean.slice(0, 80),
                got: lhsVal, said: rhs.value, errPct: err * 100
            });
        }
    }
}

/**
 * Prose arithmetic, from the rendered text of a single element.
 *
 * Deliberately narrow. The left side may contain only digits, operators and
 * brackets - one identifier and the whole thing is skipped - because prose is
 * full of expressions whose symbols are defined three paragraphs earlier, and
 * a checker that guesses at those is a checker nobody runs.
 */
const FN_NAMES = 'sqrt|arctan|arcsin|arccos|atan|asin|acos|log10|log2|log|ln|exp|sinh|cosh|tanh|sin|cos|tan|abs';
const FN_TAIL = new RegExp('(?:^|[^A-Za-z])(' + FN_NAMES + ')$', 'i');

/**
 * Walk LEFT from an "=" collecting a balanced arithmetic expression.
 *
 * A regex that simply starts at the first digit reads "arctan(20/18.5) = 47"
 * as "20/18.5 = 47" and reports a correct lesson as wrong - which is how the
 * first version of this produced five false alarms out of twenty-one findings.
 * Walking back lets the function name come with its argument, and lets the
 * scan stop cleanly at a letter that is NOT part of a function name.
 */
function grabExpression(text, eqIndex) {
    let i = eqIndex - 1;
    let depth = 0;
    let end = -1;

    while (i >= 0) {
        const c = text[i];
        if (/\s/.test(c)) { if (end === -1) { i--; continue; } i--; continue; }
        if (c === ')') { depth++; if (end === -1) end = i; i--; continue; }
        if (c === '(') {
            if (depth === 0) break;                 // an unbalanced open: stop
            depth--;
            if (end === -1) end = i;
            i--;
            // A function name immediately to the left belongs with it.
            const fn = FN_TAIL.exec(text.slice(0, i + 1));
            if (fn && depth === 0) { i -= fn[1].length; }
            continue;
        }
        if (/[0-9.,]/.test(c)) { if (end === -1) end = i; i--; continue; }
        if ('+-*/^'.indexOf(c) !== -1) { if (end === -1) break; i--; continue; }
        if (/[A-Za-z]/.test(c)) {
            // Only acceptable as the tail of a function name we just consumed.
            const fn = FN_TAIL.exec(text.slice(0, i + 1));
            if (fn) { i -= fn[1].length; if (end === -1) end = i + fn[1].length; continue; }
            break;
        }
        break;
    }

    if (end === -1 || depth !== 0) return null;
    const start = i + 1;
    if (start > end) return null;
    let expr = text.slice(start, end + 1).trim();

    // Refuse to start mid-token: a digit or letter immediately before means we
    // sliced something larger in half.
    const before = text[start - 1];
    if (before && /[0-9A-Za-z]/.test(before)) return null;
    return expr;
}

/**
 * Walk RIGHT from an "=" collecting a balanced arithmetic expression.
 *
 * The mirror of grabExpression, and it is what lets a CHAIN be checked all the
 * way through rather than only at its last step. "345^2/365 = 119,025/365 =
 * 326 MW" has two claims in it, and the middle one is exactly where a
 * transcription slip hides.
 */
function grabExpressionForward(text, from) {
    let i = from;
    while (i < text.length && /\s/.test(text[i])) i++;
    const start = i;
    let depth = 0;
    let end = -1;

    while (i < text.length) {
        const c = text[i];
        if (/\s/.test(c)) { i++; continue; }
        if (c === '(') { depth++; i++; continue; }
        if (c === ')') {
            if (depth === 0) break;
            depth--; end = i; i++; continue;
        }
        if (/[0-9.,]/.test(c)) { end = i; i++; continue; }
        if ('+-*/^'.indexOf(c) !== -1) { i++; continue; }
        if (/[A-Za-z]/.test(c)) {
            const m = new RegExp('^(' + FN_NAMES + ')\\s*\\(', 'i').exec(text.slice(i));
            if (m) { i += m[0].length - 1; depth++; i++; continue; }
            break;
        }
        break;
    }

    if (end === -1 || depth !== 0) return null;
    const expr = text.slice(start, end + 1).trim();
    // Must be a computation, not a restated number. A leading sign is not an
    // operation: reading "-19" as one kept a correct dB conversion out of the
    // number path and compared it as an equality.
    if (!/[-+*/^]/.test(expr.replace(/^[a-z]+\(/i, '').replace(/^[-+]/, ''))) return null;
    return expr;
}

function checkProse(text, sink, where) {
    for (let k = 0; k < text.length; k++) {
        if (text[k] !== '=') continue;
        if (text[k - 1] === '<' || text[k - 1] === '>' || text[k - 1] === '!' ||
            text[k - 1] === '=' || text[k + 1] === '=') continue;

        // Chain step: both sides are expressions. Compared first, because it
        // reaches the middle terms that the "= <number>" form cannot.
        const lhsChain = grabExpression(text, k);
        const rhsChain = grabExpressionForward(text, k + 1);
        if (lhsChain && rhsChain) {
            const a = evaluate(lhsChain.replace(/,/g, ''));
            const b = evaluate(rhsChain.replace(/,/g, ''));
            if (a !== null && b !== null && isFinite(a) && isFinite(b)) {
                sink.checked++;
                // "1/9.1 = 0.11 = -19 dB" is a conversion, not an equality.
                const dbHere = /^[^.;]{0,24}\bdB[a-zΩ]*\b/i
                    .test(text.slice(k + 1 + rhsChain.length));
                if (dbHere && a > 0 &&
                    (Math.abs(20 * Math.log10(a) - b) < 0.6 ||
                     Math.abs(10 * Math.log10(a) - b) < 0.6)) continue;
                const err = Math.abs(a - b) / (Math.abs(b) || 1);
                if (err > 0.012 && !isPrefixShift(a, b)) {
                    sink.findings.push({
                        where, expr: lhsChain.slice(0, 40) + '  =  ' + rhsChain.slice(0, 40),
                        got: a, said: b, errPct: err * 100
                    });
                } else if (err > 0.005) {
                    sink.near.push({
                        where, expr: lhsChain.slice(0, 40) + '  =  ' + rhsChain.slice(0, 40),
                        got: a, said: b, errPct: err * 100
                    });
                }
                continue;
            }
        }

        const tail = text.slice(k + 1);
        const after = /^\s*(-?\d[\d,]*(?:\.\d+)?)\s*(°|deg\b|degrees\b)?/.exec(tail);
        if (!after) continue;
        const rhsText = after[1].replace(/,/g, '');
        const rhsVal = parseFloat(rhsText);
        if (!isFinite(rhsVal)) continue;
        const wantsDegrees = !!after[2];

        // The right side has to be the WHOLE answer, not the first number of
        // one. Lessons write chains - "= 345^2/365 = 119,025/365 = 326 MW" -
        // and reading the middle term as a result compares an expression with
        // the numerator of the next one. Every false alarm in this checker's
        // first run over prose was that.
        const rest = tail.slice(after[0].length);
        if (/^\s*(?:[-+*/^]|\d|\()/.test(rest)) continue;
        if (/^\s*[A-Za-z][A-Za-z0-9]*\s*\(/.test(rest)) continue;   // "= 0.2794 log10(...)"
        // "= 6.0M + 3.6M + 6.0M = 15.6M": a magnitude suffix, then more sum.
        if (/^\s*[A-Za-zµΩ%]{1,4}\s*[-+*/^]\s*\d/.test(rest)) continue;

        let lhs = grabExpression(text, k);
        if (!lhs) continue;
        lhs = lhs.replace(/,/g, '');
        if (!/[-+*/^]/.test(lhs.replace(/^[a-z]+\(/i, ''))) continue;
        if (!/\d/.test(lhs)) continue;
        // "2 - 3" on its own is a range, a pin list or a part number, not a sum
        // anybody wrote down as a result.
        if (!/[*/^()]/.test(lhs) && /^-?\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?$/.test(lhs)) continue;

        let lhsVal = evaluate(lhs);
        if (lhsVal === null) continue;

        // An inverse trig result quoted with a degree sign is in degrees, and
        // the parser works in radians.
        if (wantsDegrees && /^(?:arctan|arcsin|arccos|atan|asin|acos)\s*\(/i.test(lhs)) {
            lhsVal = lhsVal * 180 / Math.PI;
        }

        sink.checked++;
        const sf = sigFigs(rhsText);
        const relTol = Math.max(Math.pow(10, -(sf - 1)) * 0.55, 0.005);
        const err = Math.abs(lhsVal - rhsVal) / (Math.abs(rhsVal) || 1);
        if (err > relTol && !isPrefixShift(lhsVal, rhsVal)) {
            sink.findings.push({
                where, expr: lhs.slice(0, 80), got: lhsVal, said: rhsVal,
                errPct: err * 100
            });
        }
    }
}

/* ==================================================================
 * Arithmetic written with units
 * ==================================================================
 * Most of the course's sums are not written as bare numbers. They are written
 * the way an engineer writes them - "12 V / 4.7 kOhm = 2.55 mA" - and the
 * scanner above skips every one of those, because its operands have to be
 * plain digits. That is a large blind spot: unit-bearing arithmetic is where
 * the prefix errors live, and a prefix error is a factor of a thousand.
 *
 * So this pass evaluates operands in BASE units and compares the result in
 * base units too. It is deliberately narrow: every operand must carry a
 * recognised unit or be dimensionless, the whole expression must sit in one
 * text node, and a mixed-dimension result is skipped rather than guessed at.
 */

const PREFIX = { p: 1e-12, n: 1e-9, u: 1e-6, 'µ': 1e-6, 'μ': 1e-6, m: 1e-3,
                 k: 1e3, K: 1e3, M: 1e6, G: 1e9, T: 1e12 };

// Units whose prefixes are unambiguous here. Deliberately excludes dB, %, and
// bare "F"/"C" as Fahrenheit/Celsius, which would need context to read.
const UNIT = '(?:V|A|W|Hz|F|H|s|J|Ω|ohms?)';

const OPERAND = new RegExp(
    '(-?\\d+(?:\\.\\d+)?)\\s*([pnuµμmkKMGT]?)\\s*(' + UNIT + ')\\b', 'g');

function toBase(numStr, prefix, unit) {
    let v = parseFloat(numStr);
    if (!isFinite(v)) return null;
    if (prefix) {
        // "m" before "s" is milli; "M" before anything is mega. The table is
        // case-sensitive on purpose.
        const f = PREFIX[prefix];
        if (f === undefined) return null;
        v *= f;
    }
    return { v: v, unit: /^ohm/i.test(unit) ? 'Ω' : unit };
}

/**
 * One "a op b [op c] = r" statement in which every operand carries a unit.
 * Anchored on the equals sign, same as the other scanners.
 */
const UNIT_EXPR = new RegExp(
    '(-?\\d+(?:\\.\\d+)?\\s*[pnuµμmkKMGT]?\\s*' + UNIT + '\\b' +
    '(?:\\s*[-+*/×÷]\\s*-?\\d+(?:\\.\\d+)?\\s*[pnuµμmkKMGT]?\\s*(?:' + UNIT + '\\b)?){1,4})' +
    '\\s*=\\s*' +
    '(-?\\d+(?:\\.\\d+)?)\\s*([pnuµμmkKMGT]?)\\s*(' + UNIT + ')\\b', 'g');

function checkUnitArithmetic(text, sink, where) {
    let m;
    UNIT_EXPR.lastIndex = 0;
    while ((m = UNIT_EXPR.exec(text))) {
        const lhsRaw = m[1];

        // The match must start at the START of the expression. "I = 2 x 2pi x
        // 50 x 2.2nF x 230" has dimensionless leading factors, so a regex
        // anchored on the first unit-bearing operand grabs only the tail and
        // compares two thirds of a correct calculation against its own answer.
        const before = text.slice(0, m.index).replace(/\s+$/, '');
        if (/[-+*/×÷0-9.]$|[A-Za-zΩ]$/.test(before)) continue;

        const rhs = toBase(m[2], m[3], m[4]);
        if (!rhs) continue;

        // A COMPOUND unit on the result - "0.67 V/µs" - is a different
        // dimension from the one this pass computes, and comparing the two
        // reported a correct slew-rate calculation as a million percent out.
        // Dimensional analysis is out of scope; skipping is the honest answer.
        const afterRhs = text.slice(m.index + m[0].length);
        if (/^\s*[/·⋅]/.test(afterRhs)) continue;
        if (/[/·⋅]\s*[pnuµμmkKMGT]?\s*(?:V|A|W|Hz|F|H|s|J|Ω)\b/.test(lhsRaw)) continue;

        // Rebuild the left side in base units, keeping the operators.
        let expr = lhsRaw.replace(/×/g, '*').replace(/÷/g, '/');
        let ok = true;
        expr = expr.replace(
            new RegExp('(-?\\d+(?:\\.\\d+)?)\\s*([pnuµμmkKMGT]?)\\s*(' + UNIT + ')\\b', 'g'),
            (all, n, p, u) => {
                const b = toBase(n, p, u);
                if (!b) { ok = false; return all; }
                return '(' + b.v.toExponential(12) + ')';
            });
        if (!ok) continue;
        // Any dimensionless operand left over is fine; a stray letter is not.
        if (/[A-Za-zΩ]/.test(expr.replace(/e[+-]\d+/gi, ''))) continue;

        const lhsVal = evaluate(expr);
        if (lhsVal === null) continue;

        sink.checked++;
        const sf = sigFigs(m[2]);
        const relTol = Math.max(Math.pow(10, -(sf - 1)) * 0.55, 0.005);
        const err = Math.abs(lhsVal - rhs.v) / (Math.abs(rhs.v) || 1);
        if (err > relTol) {
            sink.findings.push({
                where, expr: lhsRaw.slice(0, 80) + '  (in base units)',
                got: lhsVal, said: rhs.v, errPct: err * 100
            });
        }
    }
}

/* ==================================================================
 * Run
 * ================================================================== */

const sink = { checked: 0, findings: [], near: [] };
const files = walk(LESSONS, []).sort();

files.forEach(file => {
    const src = fs.readFileSync(file, 'utf8');
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');

    // Display math.
    (src.match(/\\\[([\s\S]*?)\\\]/g) || []).forEach(raw => {
        checkChain(raw.slice(2, -2), raw, sink, rel);
    });

    // Inline math. \(...\) only - a bare $...$ is too easily a dollar sign.
    (src.match(/\\\(([\s\S]{1,400}?)\\\)/g) || []).forEach(raw => {
        checkChain(raw.slice(2, -2), raw, sink, rel);
    });

    // Prose and tables. Work element by element so an expression can never be
    // stitched together across two unrelated cells, and drop <script> blocks,
    // whose numbers are code rather than claims.
    // <sup> carries the exponent, so it has to survive tag-stripping or
    // "6 x 10<sup>6</sup>" reads as 6. <sub> is part of a NAME - V<sub>out</sub>
    // - and must never become an operand.
    const withSup = src
        .replace(/<sup[^>]*>\s*([^<]{1,12}?)\s*<\/sup>/gi, '^($1)')
        .replace(/<sub[^>]*>[^<]*<\/sub>/gi, '');
    const noScript = withSup.replace(/<script[\s\S]*?<\/script>/gi, ' ')
                        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
                        .replace(/\\\[[\s\S]*?\\\]/g, ' ')
                        .replace(/\\\([\s\S]*?\\\)/g, ' ');
    // Inline formatting splits an expression into pieces. Lessons write
    // "<span class="mono">12 V</span> / <span class="mono">4.7 kΩ</span> =
    // 2.55 mA", and a scanner that treats every tag as a boundary sees three
    // fragments and no arithmetic. Drop the inline tags, keep the block ones
    // as boundaries so an expression can still never span two cells.
    const inlined = noScript.replace(
        /<\/?(?:span|strong|b|em|i|code|small|abbr|a|u|mark|var|samp|kbd|tt|font)\b[^>]*>/gi, '');

    inlined.split(/<[^>]+>/).forEach(chunk => {
        if (!/\d/.test(chunk)) return;
        const clean = deentity(chunk);
        checkProse(clean, sink, rel);
        checkUnitArithmetic(clean, sink, rel);
    });
});

if (process.argv.includes('--near')) {
    console.log('INSIDE TOLERANCE, BUT ONLY JUST (' + sink.near.length + ')\n');
    sink.near.forEach(function (f) {
        console.log('  ' + f.where);
        console.log('      ' + f.expr);
        console.log('      ' + f.got.toPrecision(6) + ' vs ' + f.said +
                    '   (' + f.errPct.toFixed(1) + '% out)');
    });
    console.log('');
}

if (!sink.findings.length) {
    console.log('PASS - ' + sink.checked + ' worked expressions check out.');
    process.exit(0);
}

console.log('check-arithmetic: ' + sink.findings.length + ' of ' + sink.checked +
            ' worked expressions do not evaluate as written.\n');

const show = VERBOSE ? sink.findings : sink.findings.slice(0, 60);
show.forEach(f => {
    console.log(f.where);
    console.log('    ' + f.expr);
    console.log('    evaluates to ' + f.got.toPrecision(6) +
                ', the lesson says ' + f.said + '   (' + f.errPct.toFixed(1) + '% out)');
});
if (show.length < sink.findings.length) {
    console.log('  ... and ' + (sink.findings.length - show.length) + ' more (--verbose)');
}

process.exit(1);
