#!/usr/bin/env node
/**
 * export-netlists - every build table as a machine-readable netlist.
 *
 * Why this exists
 * ---------------
 * export-templates.js gives the build tables with their Connect column as the
 * prose the reader sees ("output amp_out to ground, sensing amp_p to mod_n").
 * Anyone running those circuits in another solver has to translate the prose
 * by hand, and a translation that is subtly wrong gives a confident wrong
 * answer. The course already has the translation: tools/netlist.js parses the
 * same rows for solve-dc, solve-ac and solve-op. This emits what it parses -
 * node names per pin, in pin order - so a second solver runs the identical
 * netlist and any disagreement is about physics, not reading.
 *
 * Output: _audit/review/netlists.json, one record per build table, with the
 * same ids as export-templates (m<M>l<L>, then -2, -3 for later tables):
 *
 *   {
 *     id, source, title,
 *     parts: [ { ref, type, nodes, value, model } ]   pin order as netlist.js:
 *              R/C/L/V/I: [a, b]; E (VCVS): [out+, out-, sense+, sense-];
 *              OA: [+in, -in, out]; SEMI: diode [anode, cathode],
 *              BJT [collector, base, emitter], MOSFET [drain, gate, source]
 *     unparsed: reason netlist.js could not build it (then parts is [])
 *     solver: { dc: 'solved' | 'skip: ...', op: 'solved' | 'skip: ...' }
 *   }
 *
 * Voltage and current source values are the DC value netlist.js uses for an
 * operating point; a sine has v = 0 there and its amplitude is in `value`.
 *
 * Run: node tools/export-netlists.js [--failing]   (only tables no solver settles)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const N = require('./netlist.js');

const ROOT = path.dirname(__dirname);
const LESSONS = path.join(ROOT, 'lessons');
const OUT = path.join(ROOT, '_audit', 'review', 'netlists.json');
const FAILING = process.argv.includes('--failing');

const strip = s => N.text(s);

function titleOf(src) {
    const m = /<h2[^>]*>([\s\S]*?)<\/h2>/i.exec(src);
    return m ? strip(m[1]) : '';
}

/** Per-table verdicts from one solver's full run: { 'rel|idx': 'solved' | 'skip: reason' }. */
function verdicts(tool) {
    const out = {};
    let text = '';
    try {
        text = execFileSync(process.execPath, [path.join(ROOT, 'tools', tool), '--list'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) { text = (e.stdout || '') + (e.stderr || ''); }
    for (const line of text.split(/\r?\n/)) {
        const m = /^(OP|DC|SOLVED|skip)\s+(lessons\/\S+)(?:\s+\[table (\d+)\])?\s*(.*)$/.exec(line);
        if (!m) continue;
        const key = m[2] + '|' + (m[3] || '1');
        out[key] = m[1] === 'skip' ? 'skip: ' + m[4].trim() : 'solved';
    }
    return out;
}

const dcV = verdicts('solve-dc.js');
const opV = verdicts('solve-op.js');

const records = [];
N.walk(LESSONS, []).sort().forEach(file => {
    const src = fs.readFileSync(file, 'utf8');
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    const m = /module-(\d+)[\\/]lesson-(\d+)\.html$/.exec(rel);
    if (!m) return;
    const title = titleOf(src);

    let idx = 0;
    const tRe = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
    let tm;
    while ((tm = tRe.exec(src))) {
        const body = tm[1];
        if (!/<th[^>]*>\s*Part\s*<\/th>/i.test(body)) continue;
        if (!/<th[^>]*>\s*Connect\s*<\/th>/i.test(body)) continue;
        const rows = [];
        [...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].forEach(rm => {
            const c = [...rm[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(x => strip(x[1]));
            if (c.length >= 4) rows.push([c[0], c[1], c[2], c[3]]);
        });
        if (rows.length < 2) continue;
        idx++;

        const parsed = N.parse(rows, 'op');
        const byRef = {};
        rows.forEach(r => { byRef[r[0]] = r; });
        const rec = {
            id: 'm' + m[1] + 'l' + m[2] + (idx > 1 ? '-' + idx : ''),
            source: rel,
            table: idx,
            title,
            parts: [],
            unparsed: parsed.error || null,
            solver: {
                dc: dcV[rel + '|' + idx] || 'not reported',
                op: opV[rel + '|' + idx] || 'not reported'
            }
        };
        // Every row with its pins in netlist.js order, even when the table as a
        // whole cannot be given an operating point (a pulse source, a switch):
        // the wiring is still exact, and that is the part a hand translation
        // gets wrong.
        rec.rows = rows.map(r => {
            const t = N.terminals(r[3]);
            return { ref: r[0], what: r[1], value: r[2], kind: t.kind || null, nodes: t.nodes || null, connect: r[3] };
        });
        if (!parsed.error) {
            rec.parts = parsed.parts.map(p => ({
                ref: p.part,
                type: p.type,
                nodes: p.n,
                value: p.v !== undefined ? p.v : null,
                stated: byRef[p.part] ? byRef[p.part][2] : null,
                model: p.modelName || null
            }));
        }
        const settled = rec.solver.dc === 'solved' || rec.solver.op === 'solved';
        if (FAILING && settled) continue;
        records.push(rec);
    }
});

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(records, null, 2) + '\n');

const settled = records.filter(r => r.solver.dc === 'solved' || r.solver.op === 'solved').length;
const unparsed = records.filter(r => r.unparsed).length;
console.log('export-netlists: ' + records.length + ' tables -> ' + path.relative(ROOT, OUT));
console.log('  settled by solve-dc or solve-op  ' + String(settled).padStart(4));
console.log('  parsed, but no operating point   ' + String(records.length - settled - unparsed).padStart(4));
console.log('  not parsed by netlist.js         ' + String(unparsed).padStart(4));
if (FAILING) {
    for (const r of records) {
        console.log('  ' + r.id.padEnd(10) + (r.unparsed ? 'unparsed: ' + r.unparsed : 'op: ' + r.solver.op));
    }
}
