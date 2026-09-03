#!/usr/bin/env node
/**
 * solve-dc - actually solve the build tables, instead of asserting their answers.
 *
 * Why this exists
 * ---------------
 * Every time a lesson gained expected values, the same thing happened: writing
 * down what a node should read meant solving the circuit by hand, and solving it
 * by hand is where the broken netlists were found. That worked, and it is slow,
 * and hand arithmetic is exactly the thing this repository already has three
 * checkers for because it goes wrong.
 *
 * So: modified nodal analysis over the netlist that check-build-nets already
 * parses. Where a table is linear at DC, this prints the operating point, and
 * those numbers can go into a SimCheck knowing they were computed rather than
 * remembered. check-sim-values then holds them to it.
 *
 * What it handles
 * ---------------
 *   Resistor            conductance stamp
 *   Voltage source      DC value, one extra unknown for its branch current
 *   Current source      DC value, injected at the node it points AT
 *   VCVS                V(out+) - V(out-) = gain x (V(sense+) - V(sense-))
 *   Capacitor           open circuit  (DC)
 *   Inductor            short circuit (DC)
 *   Op-Amp              ideal, as a nullor: forces V(+) = V(-), output current free
 *
 * Anything nonlinear or switched is reported as a skip with the reason, never
 * guessed at. An ideal op-amp with no feedback path produces a singular matrix,
 * which is the correct answer to "where does an open-loop amplifier settle" and
 * is reported as such rather than as a number.
 *
 * Parsing lives in netlist.js, shared with solve-ac, so the two cannot drift.
 *
 *   node tools/solve-dc.js                        summary across every lesson
 *   node tools/solve-dc.js --list                 one line per table
 *   node tools/solve-dc.js lessons/module-17/lesson-01.html    solve one file
 *   node tools/solve-dc.js <file> --verbose       show the parsed netlist too
 */

'use strict';

const fs = require('fs');
const path = require('path');
const N = require('./netlist');

const ROOT = path.dirname(__dirname);
const LESSONS = path.join(ROOT, 'lessons');
const args = process.argv.slice(2);
const LIST = args.includes('--list');
const VERBOSE = args.includes('--verbose');
const TARGET = args.find(a => !a.startsWith('--'));

/**
 * Solve Ax = b by Gauss-Jordan with partial pivoting.
 * Returns null when the matrix is singular, which for these circuits means the
 * question had no single answer rather than that something went wrong.
 */
function solve(A, b) {
    const n = b.length;
    const M = A.map((row, i) => row.concat([b[i]]));
    for (let col = 0; col < n; col++) {
        let piv = col;
        for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
        if (Math.abs(M[piv][col]) < 1e-12) return null;
        [M[col], M[piv]] = [M[piv], M[col]];
        for (let r = 0; r < n; r++) {
            if (r === col) continue;
            const f = M[r][col] / M[col][col];
            if (f === 0) continue;
            for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
        }
    }
    return M.map((row, i) => row[n] / row[i]);
}

/** Build and solve one table. */
function analyse(rows) {
    const p = N.parse(rows, 'dc');
    if (p.error) return { ok: false, why: p.error };
    const parts = p.parts;

    const idx = N.nodeIndex(parts);
    const nn = idx.size;
    const branches = parts.filter(x => x.type === 'V' || x.type === 'E' || x.type === 'OA' || x.type === 'short');
    const size = nn + branches.length;
    if (size === 0 || size > 200) return { ok: false, why: 'no unknowns' };

    const A = Array.from({ length: size }, () => new Array(size).fill(0));
    const rhs = new Array(size).fill(0);
    const at = n => (N.isGround(n) ? -1 : idx.get(n));
    const G = (r, c, v) => { if (r >= 0 && c >= 0) A[r][c] += v; };
    const col = (r, c, v) => { if (r >= 0) A[r][c] += v; };
    const rowS = (r, c, v) => { if (c >= 0) A[r][c] += v; };

    let bi = 0;
    for (const q of parts) {
        const a = at(q.n[0]), b = at(q.n[1]);
        if (q.type === 'R') {
            const g = 1 / q.v;
            G(a, a, g); G(b, b, g); G(a, b, -g); G(b, a, -g);
        } else if (q.type === 'I') {
            // "from A to B": the source pushes current out at B and takes it at A.
            if (b >= 0) rhs[b] += q.v;
            if (a >= 0) rhs[a] -= q.v;
        } else if (q.type === 'V' || q.type === 'short') {
            const k = nn + bi++;
            col(a, k, 1); col(b, k, -1);
            rowS(k, a, 1); rowS(k, b, -1);
            rhs[k] = q.type === 'V' ? q.v : 0;
        } else if (q.type === 'E') {
            const k = nn + bi++;
            col(a, k, 1); col(b, k, -1);
            rowS(k, a, 1); rowS(k, b, -1);
            rowS(k, at(q.n[2]), -q.v); rowS(k, at(q.n[3]), q.v);
        } else if (q.type === 'OA') {
            // Nullor: output carries a free current, inputs are forced equal.
            const k = nn + bi++;
            col(at(q.n[2]), k, 1);
            rowS(k, at(q.n[0]), 1); rowS(k, at(q.n[1]), -1);
        }
    }

    const x = solve(A, rhs);
    if (!x) return { ok: false, why: 'singular - no unique operating point (an amplifier with no feedback, or a floating section)' };
    if (x.some(v => !isFinite(v))) return { ok: false, why: 'no finite solution' };

    const voltages = {};
    idx.forEach((i, n) => { voltages[n] = x[i]; });
    return { ok: true, voltages, parts };
}

const fmt = v => {
    const a = Math.abs(v);
    if (a < 1e-9) return '0 V';
    if (a < 1e-3) return (v * 1e6).toPrecision(5) + ' uV';
    if (a < 1) return (v * 1e3).toPrecision(5) + ' mV';
    return v.toPrecision(6) + ' V';
};

const files = TARGET ? [path.resolve(ROOT, TARGET)] : N.walk(LESSONS, []).sort();
let tables = 0, solved = 0;
const skips = new Map();

files.forEach(file => {
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    N.tablesIn(fs.readFileSync(file, 'utf8')).forEach((rows, i) => {
        tables++;
        const r = analyse(rows);
        const tag = rel + (i > 0 ? ' [table ' + (i + 1) + ']' : '');
        if (r.ok) {
            solved++;
            console.log('SOLVED  ' + tag);
            Object.keys(r.voltages).sort().forEach(n =>
                console.log('           V(' + n + ') = ' + fmt(r.voltages[n])));
            if (VERBOSE) r.parts.forEach(p =>
                console.log('           . ' + p.type + ' ' + p.part + ' ' + p.n.join(',') +
                            (p.v !== undefined ? ' = ' + p.v : '')));
        } else {
            const key = r.why.replace(/:.*$/, '');
            skips.set(key, (skips.get(key) || 0) + 1);
            if (LIST || TARGET) console.log('skip    ' + tag + '   ' + r.why);
        }
    });
});

if (!TARGET) {
    console.log('');
    console.log('DC OPERATING POINTS\n');
    console.log('  build tables        ' + String(tables).padStart(4));
    console.log('  solved              ' + String(solved).padStart(4) +
                '   (' + Math.round(100 * solved / tables) + '%)');
    console.log('  not attempted       ' + String(tables - solved).padStart(4));
    console.log('');
    [...skips.entries()].sort((a, b) => b[1] - a[1]).forEach(([why, n]) => {
        console.log('     ' + String(n).padStart(4) + '  ' + why);
    });
    console.log('');
    console.log('This is a tool for deriving expected values, not a gate. A table it');
    console.log('cannot solve is usually just a table with a transistor in it.');
}
