#!/usr/bin/env node
/**
 * fix-toy-refdes - make build-table refdes match Circuit Toy's own.
 *
 * Two tidy-ups after fix-toy-parts.js:
 *
 *  1. Op-amp rows labelled X1, XU1, XAMP. "X" is the SPICE convention for a
 *     subcircuit, which is what an op-amp is in a netlist - another survivor
 *     of the de-SPICE pass. Circuit Toy calls them U, and a reader following
 *     the table should see the same letter the tool shows them.
 *
 *  2. Rows where the old model name carried information the catalogue name
 *     does not. NMOS_SW meant "a switching MOSFET" - the low-Rds(on), high-Qg
 *     end of the range rather than a small-signal device - and plain "NMOS"
 *     loses that. It goes back in the What column, where a reader will read it,
 *     rather than in a name they cannot look up.
 *
 * Run: node tools/fix-toy-refdes.js [--dry]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const DRY = process.argv.includes('--dry');

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

let refdesFixed = 0, hintsAdded = 0, files = 0;

lessonFiles().forEach(file => {
    const src = fs.readFileSync(file, 'utf8');
    const lines = src.split(/\r?\n/);
    let changed = false;

    const out = lines.map((line, idx) => {
        const m = line.match(
            /<td class="mono">([A-Za-z][\w]*)<\/td>\s*<td>([^<]*)<\/td>\s*<td>(.*?)<\/td>/);
        if (!m) return line;

        const [, refdes, what, value] = m;
        let newLine = line;

        // 1. X -> U on op-amp rows only.
        if (/op-?amp/i.test(what) && /^X/.test(refdes)) {
            const replacement = refdes.replace(/^X[Uu]?/, function (pfx) {
                // Keep the case of what followed: XAMP -> UAMP, Xamp -> Uamp.
                return pfx.length > 1 && pfx[1] === 'u' ? 'U' : 'U';
            });
            if (replacement !== refdes) {
                newLine = newLine.replace(
                    '<td class="mono">' + refdes + '</td>',
                    '<td class="mono">' + replacement + '</td>');
                refdesFixed++;
                changed = true;
            }
        }

        // 2. Put back the switching-MOSFET hint that the rename dropped.
        //    Only on rows that now say plain NMOS/PMOS with a bare description,
        //    and only where the surrounding text is about switching.
        //
        //    The context is taken from the PRECEDING LINES BY INDEX, not by
        //    searching the file for this line's text - identical rows appear in
        //    more than one table, and indexOf would silently read the context
        //    of the first one every time.
        const context = lines.slice(Math.max(0, idx - 25), idx).join('\n');
        if (/<span class="mono">[NP]MOS<\/span>/.test(value) &&
            /^Transistor \(MOSFET\)$/.test(what.trim()) &&
            /\b(switch|switching|gate driv|half-?bridge|buck|boost|flyback|PWM)\b/i
                .test(context)) {
            newLine = newLine.replace(
                '<td>' + what + '</td>',
                '<td>Transistor (MOSFET, switching — low Rds(on))</td>');
            hintsAdded++;
            changed = true;
        }

        return newLine;
    });

    if (changed) {
        files++;
        if (!DRY) fs.writeFileSync(file, out.join('\n'));
    }
});

console.log(`op-amp refdes X -> U : ${refdesFixed}`);
console.log(`switching hints added: ${hintsAdded}`);
console.log(`${files} files${DRY ? ' (dry run)' : ''}`);
