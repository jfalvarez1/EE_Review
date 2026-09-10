'use strict';

// A deliberately changed build is a different circuit. Keep its overrides
// with the authored probe so checking/exporting it never uses the default build.
const vm = require('vm');
const N = require('./netlist');
const OP = require('./solve-op');

function overrides(chunk) {
    if (!/\bdcValues\s*:/.test(chunk)) return null;
    const match = /\bdcValues\s*:\s*(\{[^{}]*\})/.exec(chunk);
    if (!match) throw new Error('dcValues must be a flat object of part names and Value cells');
    const values = vm.runInNewContext('(' + match[1] + ')', Object.create(null), { timeout: 100 });
    if (!values || !Object.keys(values).length || Object.values(values).some(v => typeof v !== 'string')) {
        throw new Error('dcValues must contain at least one string Value cell');
    }
    return values;
}

function solveCase(src, values) {
    const tables = N.tablesIn(src);
    if (tables.length !== 1) throw new Error('a DC variant requires exactly one build table');
    const rows = tables[0].map(row => row.slice());
    for (const [ref, value] of Object.entries(values)) {
        const matches = rows.filter(row => row[0] === ref);
        if (matches.length !== 1) throw new Error('DC variant names missing or ambiguous part ' + ref);
        matches[0][2] = N.text(value);
    }
    const parsed = N.parse(rows, 'op');
    if (parsed.error) throw new Error(parsed.error);
    const op = OP.operatingPoint(parsed.parts, N.nodeIndex(parsed.parts));
    if (!op) throw new Error('DC variant has no verified operating point');
    const absurd = OP.absurdity(parsed.parts, op.v);
    if (absurd) throw new Error(absurd);
    return op.v;
}

module.exports = { overrides, solveCase };
