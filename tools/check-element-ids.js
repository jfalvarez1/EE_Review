#!/usr/bin/env node
/**
 * check-element-ids - a lesson's script may only address elements it has.
 *
 * Why this exists.
 *
 * A runtime pass over all 369 lessons found M25-11 throwing
 *     Uncaught TypeError: Cannot set properties of null (setting 'textContent')
 * because its script does document.getElementById('x').textContent = ... for
 * an id that is not in the markup. The throw aborts the rest of that handler,
 * so every readout after the failing line silently stops updating - the widget
 * half-works, which is worse than not working, and nothing on the page says so.
 *
 * It survived because the failing branch only runs for one option value of one
 * dropdown. A first audit pass that tried a single alternative never reached
 * it. Static checking does not have that problem: every id in the file is
 * visible whether its branch runs or not.
 *
 * Only ids that are looked up and IMMEDIATELY dereferenced are reported -
 * `getElementById(x).foo` or `getElementById(x)[...]`. A bare lookup that is
 * null-checked afterwards is exactly the defensive shape wanted here and is
 * left alone.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);

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

const findings = [];

lessonFiles().forEach(file => {
    const src = fs.readFileSync(file, 'utf8');
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');

    // Every id the markup defines. Ids built at runtime by innerHTML are also
    // collected, since a widget legitimately writes its own readouts.
    const defined = new Set();
    let m;
    const idRe = /\bid\s*=\s*["']([^"']+)["']/g;
    while ((m = idRe.exec(src)) !== null) defined.add(m[1]);
    // Template-literal markup: id="${...}" cannot be resolved statically, so
    // any file that builds ids dynamically opts out of this check entirely
    // rather than producing guesses.
    if (/\bid\s*=\s*["']?\$\{/.test(src) || /\bid\s*=\s*["']\s*\+/.test(src)) return;

    const lines = src.split(/\r?\n/);
    lines.forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, '');
        // Only a lookup that is dereferenced on the spot can throw.
        const re = /getElementById\(\s*['"]([^'"]+)['"]\s*\)\s*(\.|\[)/g;
        let mm;
        while ((mm = re.exec(code)) !== null) {
            const id = mm[1];
            if (defined.has(id)) continue;
            findings.push({ rel, line: i + 1, id });
        }
    });
});

if (findings.length === 0) {
    console.log('PASS - every element a lesson script dereferences exists in its markup.');
    process.exit(0);
}

console.log('MISSING ELEMENT - getElementById(...) returns null and is dereferenced\n');
console.log('  The TypeError aborts the rest of that handler, so every readout');
console.log('  after the failing line silently stops updating.\n');
findings.forEach(f => console.log(`  ${f.rel}:${f.line}  #${f.id}`));
console.log(`\n${findings.length} in ${new Set(findings.map(f => f.rel)).size} files`);
process.exit(1);
