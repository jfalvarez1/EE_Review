// Pull every netlist out of the pre-conversion commit and characterise what a
// solver would actually have to support to run them. Ground truth for the
// Circuit Toy feature list.
const { execSync } = require('child_process');
const REV = process.argv[2] || '1325c9f';

const files = execSync('git ls-tree -r --name-only ' + REV + ' lessons/', { encoding: 'utf8' })
    .split('\n').filter(f => f.endsWith('.html'));

const netlists = [];
files.forEach(f => {
    let s;
    try { s = execSync('git show ' + REV + ':' + f, { encoding: 'utf8', maxBuffer: 1 << 28 }); }
    catch (e) { return; }

    // widget form: netlist: `...`
    const re = /netlist\s*:\s*`([\s\S]*?)`/g;
    let m;
    while ((m = re.exec(s)) !== null) netlists.push({ f, t: m[1] });
    // setNetlist(`...`)
    const re2 = /setNetlist\(\s*`([\s\S]*?)`/g;
    while ((m = re2.exec(s)) !== null) netlists.push({ f, t: m[1] });
    // raw <pre>
    const re3 = /<pre[^>]*>([\s\S]*?)<\/pre>/gi;
    while ((m = re3.exec(s)) !== null) {
        const b = m[1];
        if (/^\s*\*|\.SUBCKT|\.TRAN|\.MODEL|\.ENDS|\.PROBE|\.AC\b|\.DC\b/im.test(b)) {
            netlists.push({ f, t: b.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') });
        }
    }
});

const elem = {}, srcFn = {}, dirs = {}, models = {}, subs = {};
const acSpec = [], tranSpec = [], dcSpec = [];
let maxNodes = 0, maxElems = 0, totalElems = 0;
const sizes = [];

netlists.forEach(n => {
    const nodes = new Set();
    let count = 0;
    n.t.split('\n').forEach(raw => {
        const line = raw.trim();
        if (!line || line.startsWith('*')) return;

        if (line.startsWith('.')) {
            const tok = line.split(/\s+/);
            const d = tok[0].toLowerCase();
            dirs[d] = (dirs[d] || 0) + 1;
            if (d === '.model') {
                const ty = (tok[2] || '?').replace(/\(.*/, '').toUpperCase();
                models[ty] = (models[ty] || 0) + 1;
            }
            if (d === '.subckt') subs[tok[1]] = (subs[tok[1]] || 0) + 1;
            if (d === '.ac') acSpec.push(tok.slice(1).join(' '));
            if (d === '.tran') tranSpec.push(tok.slice(1).join(' '));
            if (d === '.dc') dcSpec.push(tok.slice(1).join(' '));
            return;
        }
        if (line.startsWith('+')) return;

        const tok = line.split(/\s+/);
        const t = tok[0][0].toUpperCase();
        if (!/[A-Z]/.test(t)) return;
        elem[t] = (elem[t] || 0) + 1;
        count++;

        const npins = { R: 2, C: 2, L: 2, V: 2, I: 2, D: 2, Q: 3, J: 3, M: 4, X: 0,
                        E: 4, G: 4, F: 2, H: 2, K: 0, S: 4, W: 2, B: 2, T: 4, U: 0 }[t];
        if (npins) tok.slice(1, 1 + npins).forEach(x => nodes.add(x));

        if (t === 'V' || t === 'I') {
            const rest = tok.slice(3).join(' ');
            const fn = /(SIN|PULSE|PWL|EXP|SFFM|AM|NOISE)\s*\(/i.exec(rest);
            if (fn) srcFn[fn[1].toUpperCase()] = (srcFn[fn[1].toUpperCase()] || 0) + 1;
            else if (/\bAC\b/i.test(rest)) srcFn.AC = (srcFn.AC || 0) + 1;
            else srcFn.DC = (srcFn.DC || 0) + 1;
        }
    });
    if (count) { sizes.push(count); totalElems += count; }
    maxNodes = Math.max(maxNodes, nodes.size);
    maxElems = Math.max(maxElems, count);
});

const sortD = o => Object.entries(o).sort((a, b) => b[1] - a[1]);
sizes.sort((a, b) => a - b);
const pct = p => sizes[Math.floor(sizes.length * p)] || 0;

console.log('NETLISTS: ' + netlists.length + ' across ' +
            new Set(netlists.map(n => n.f)).size + ' lessons');
console.log('elements total ' + totalElems + ', median ' + pct(0.5) +
            ', 90th pct ' + pct(0.9) + ', largest ' + maxElems +
            '; largest node count ' + maxNodes);
console.log('\nELEMENT LETTERS');
sortD(elem).forEach(([k, v]) => console.log('  ' + k + '  ' + v));
console.log('\nSOURCE FUNCTIONS');
sortD(srcFn).forEach(([k, v]) => console.log('  ' + k + '  ' + v));
console.log('\nDIRECTIVES');
sortD(dirs).forEach(([k, v]) => console.log('  ' + k + '  ' + v));
console.log('\n.MODEL DEVICE TYPES');
sortD(models).forEach(([k, v]) => console.log('  ' + k + '  ' + v));
console.log('\nSUBCKT NAMES (top 25)');
sortD(subs).slice(0, 25).forEach(([k, v]) => console.log('  ' + k + '  ' + v));
console.log('\nAC SPECS (sample)');
[...new Set(acSpec)].slice(0, 8).forEach(s => console.log('  .ac ' + s));
console.log('\nTRAN SPECS (sample)');
[...new Set(tranSpec)].slice(0, 8).forEach(s => console.log('  .tran ' + s));
console.log('\nDC SPECS (sample)');
[...new Set(dcSpec)].slice(0, 8).forEach(s => console.log('  .dc ' + s));
