#!/usr/bin/env node
'use strict';

// Protect the published data and recompute scientific diagnostics independently
// of the Python plotting scripts. This does not validate the physical models.
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const directory = path.join(root, 'docs/data/field-solvers');
const json = name => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
const manifest = json('manifest.json');

for (const [relative, expected] of Object.entries(manifest.files)) {
    assert(relative.startsWith('docs/data/field-solvers/') || relative.startsWith('assets/figures/field-solvers/'));
    assert(!relative.split('/').includes('..'));
    const bytes = fs.readFileSync(path.join(root, relative));
    assert.strictEqual(bytes.length, expected.bytes, relative + ': byte count');
    assert.strictEqual(crypto.createHash('sha256').update(bytes).digest('hex'), expected.sha256, relative + ': changed evidence');
}

function csv(name, columns) {
    const lines = fs.readFileSync(path.join(directory, name), 'utf8').trim().split(/\r?\n/);
    assert.strictEqual(lines.shift().split(',').length, columns);
    const rows = lines.map(line => line.split(',').map(Number));
    rows.forEach((row, i) => {
        assert.strictEqual(row.length, columns);
        assert(row.every(Number.isFinite), name + ': nonfinite sample');
        if (i) assert(row[0] > rows[i - 1][0], name + ': unordered frequencies');
    });
    return rows;
}

function close(actual, expected, tolerance, label) {
    assert(Math.abs(actual - expected) <= tolerance, label + ': ' + actual + ' vs ' + expected);
}

const pi = json('pi-metrics.json');
const banks = {};
for (const name of ['near_same', 'far_same', 'near_mixed', 'near_mixed_damped']) {
    const rows = banks[name] = csv('pi-' + name + '.csv', 4);
    assert.strictEqual(rows.length, 301);
    assert.strictEqual(rows[0][0], 1e5);
    assert.strictEqual(rows[rows.length - 1][0], 1e8);
    rows.forEach(row => {
        close(Math.hypot(row[1], row[2]), row[3], 1e-12, 'complex magnitude');
        assert(row[1] >= 0, 'negative resistance');
    });
    const effectiveC = -1 / (2 * Math.PI * rows[0][0] * rows[0][2]);
    close(effectiveC, 3e-6, 6e-9, 'low-frequency total C');
    close(rows[rows.length - 1][3], pi.cases[name].z_at_100mhz_ohm, 1e-12, 'quoted endpoint');
}
close(banks.far_same[300][3] / banks.near_same[300][3], pi.far_to_near_at_100mhz, 1e-12, 'placement ratio');
const ratios = banks.near_mixed.map((row, i) => row[0] >= 1e6 && row[0] <= 80e6 ? row[3] / banks.near_same[i][3] : 0);
close(Math.max(...ratios), pi.mixed_to_same_worst_ratio, 1e-12, 'mixed ratio');

const si = json('si-review.json');
const network = csv('two-port.csv', 9);
assert.strictEqual(network.length, 1001);
let maximumSingular = 0;
let maximumReciprocity = 0;
for (const r of network) {
    // Column order is S11, S21, S12, S22. Eigenvalues of S* S give singular values squared.
    const a = r[1] ** 2 + r[2] ** 2 + r[3] ** 2 + r[4] ** 2;
    const d = r[5] ** 2 + r[6] ** 2 + r[7] ** 2 + r[8] ** 2;
    const crossReal = r[1] * r[5] + r[2] * r[6] + r[3] * r[7] + r[4] * r[8];
    const crossImag = r[1] * r[6] - r[2] * r[5] + r[3] * r[8] - r[4] * r[7];
    const largestEigenvalue = (a + d + Math.hypot(a - d, 2 * crossReal, 2 * crossImag)) / 2;
    maximumSingular = Math.max(maximumSingular, Math.sqrt(largestEigenvalue));
    maximumReciprocity = Math.max(maximumReciprocity, Math.hypot(r[3] - r[5], r[4] - r[6]));
}
close(maximumSingular, si.two_port.maximum_singular_value_matrix, 2e-12, 'full matrix singular value');
close(maximumReciprocity, si.two_port.maximum_reciprocity_error, 2e-12, 'reciprocity');
const sensitivity = csv('boundary-change.csv', 3);
close(Math.max(...sensitivity.map(r => r[1])), si.boundary_max_complex_S11_change, 1e-12, 'boundary S11');
close(Math.max(...sensitivity.map(r => r[2])), si.boundary_max_complex_S21_change, 1e-12, 'boundary S21');

// The last two published columns are impedance, not another measured S-parameter.
const vna = csv('published-vna.csv', 5);
let errorSquared = 0;
let points = 0;
let bracket = 0;
for (const row of vna) {
    const frequency = row[0] * 1e6;
    if (frequency < network[0][0] || frequency > network[network.length - 1][0]) continue;
    while (bracket + 1 < network.length - 1 && network[bracket + 1][0] < frequency) bracket++;
    const low = network[bracket];
    const high = network[bracket + 1];
    const fraction = (frequency - low[0]) / (high[0] - low[0]);
    const realError = low[1] + fraction * (high[1] - low[1]) - row[1];
    const imagError = low[2] + fraction * (high[2] - low[2]) - row[2];
    errorSquared += realError ** 2 + imagError ** 2;
    points++;
}
assert.strictEqual(points, si.comparison_points);
close(Math.sqrt(errorSquared / points), si.full_matrix_S11_complex_rmse_to_published_VNA, 1e-12, 'measured-reference RMSE');
console.log('PASS - field evidence hashes, PI capacitance/ratios, two-port passivity/reciprocity and VNA error');
