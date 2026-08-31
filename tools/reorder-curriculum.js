/**
 * Re-sequence the catalogue so the sidebar order IS the teaching order.
 *
 * Until now the learning path was an overlay: an ordered spine pointing into a
 * catalogue that was still arranged by topic. That works, but it leaves the
 * sidebar - the thing most people actually click - opening on 35 lessons of
 * transistor internals. This makes the two agree.
 *
 * WHAT MOVES
 *
 *   Modules are re-sequenced into: abstraction -> mechanism -> devices ->
 *   blocks -> practice -> applications -> systems. So op-amps come first,
 *   feedback third, and the transistor arrives fourth as the answer to "how
 *   was that built" rather than as a prerequisite.
 *
 *   Lessons are reordered inside the three modules whose internal order was
 *   actively wrong: op-amps (the ideal amplifier was last), BJTs (biasing came
 *   after the differential pair, the small-signal model twelve lessons after
 *   the frequency response it explains), and FETs (the amplifier material was
 *   appended after twenty lessons of power switching).
 *
 * WHAT IS SAFE
 *
 *   No lesson contains a hardcoded #module-N/lesson-N link - checked, zero of
 *   them - so there is no internal link rot. The data-module attributes inside
 *   lesson files are self-identifying only; the app reads the ones it generates
 *   for the sidebar. Saved progress is keyed m{module}l{lesson} and WILL be
 *   invalidated, which is the one real cost.
 *
 * Run with --dry to print the mapping and change nothing.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const DRY = process.argv.includes('--dry');

// ---------------------------------------------------------------- the plan

// New module sequence, given as CURRENT module ids.
//
// The catalogue was already re-sequenced once, so this is no longer a wholesale
// reordering - it inserts the new Semiconductors and Diodes module at the point
// the syllabus puts it, after feedback and before the transistor, and shifts
// everything below it down by one.
const MODULE_ORDER = [
    1,   // Op-Amp Fundamentals
    2,   // Advanced Applications
    3,   // Feedback Theory & Stability
    27,  // Semiconductors and Diodes   <- inserted here
    4,   // Transistor Intuition (BJT)
    5,   // FET/MOSFET Fundamentals
    6,   // Output Stages & Complementary Circuits
    7,   // Advanced Analog Blocks
    8,   // Oscillators & Timing Circuits
    9,   // Practical Skills
    10,  // Design Trade-offs Workshop
    11,  // Practice Problems & Exercises
    12,  // Power Electronics Applications
    13,  // Power Supply Design
    14,  // Battery Management
    15,  // Audio Applications
    16,  // Data Conversion Applications
    17,  // Sensor Interface
    18,  // Digital Interface Electrical Design
    19,  // Communication Protocols - Electrical Level
    20,  // RF Analog
    21,  // EMI/EMC Design
    22,  // Real-World Scenarios
    23,  // Troubleshooting & Debug
    24,  // Real-World System Design
    25,  // Complex Real-World Projects
    26   // Power Systems & the Grid (ERCOT / AEP)
];

// Every module is already in the right internal order, so nothing to permute.
// Entries here are validated as permutations of the module they name, so a
// stale plan aborts rather than scrambling the lessons.
const LESSON_ORDER = {};

// ---------------------------------------------------------------- load

global.window = {};
(0, eval)(fs.readFileSync(path.join(ROOT, 'assets/curriculum.js'), 'utf8'));
const C = global.window.CURRICULUM || global.CURRICULUM;

const pad = n => String(n).padStart(2, '0');

// ---------------------------------------------------------------- validate

const problems = [];

const seen = new Set(MODULE_ORDER);
if (seen.size !== MODULE_ORDER.length) problems.push('MODULE_ORDER has duplicates');
if (MODULE_ORDER.length !== C.modules.length) {
    problems.push(`MODULE_ORDER has ${MODULE_ORDER.length}, curriculum has ${C.modules.length}`);
}
for (const m of C.modules) {
    if (!seen.has(m.id)) problems.push(`module ${m.id} missing from MODULE_ORDER`);
}

for (const [oldMod, order] of Object.entries(LESSON_ORDER)) {
    const mod = C.modules.find(m => m.id === Number(oldMod));
    if (!mod) { problems.push(`LESSON_ORDER references unknown module ${oldMod}`); continue; }
    const have = mod.lessons.map(l => l.id).sort((a, b) => a - b).join(',');
    const want = order.slice().sort((a, b) => a - b).join(',');
    if (have !== want) {
        problems.push(`module ${oldMod}: LESSON_ORDER is not a permutation\n    have ${have}\n    want ${want}`);
    }
}

if (problems.length) {
    console.error('ABORTED — the plan does not describe this curriculum:\n');
    problems.forEach(p => console.error('  ' + p));
    process.exit(1);
}

// ---------------------------------------------------------------- map

// oldKey "m/l" -> { newM, newL, title }
const map = new Map();
const newModules = [];

MODULE_ORDER.forEach((oldModId, mi) => {
    const mod = C.modules.find(m => m.id === oldModId);
    const newModId = mi + 1;
    const order = LESSON_ORDER[oldModId] || mod.lessons.map(l => l.id);

    const lessons = order.map((oldLessonId, li) => {
        const les = mod.lessons.find(l => l.id === oldLessonId);
        map.set(`${oldModId}/${oldLessonId}`, {
            newM: newModId, newL: li + 1, title: les.title
        });
        return Object.assign({}, les, { id: li + 1 });
    });

    newModules.push({
        id: newModId,
        oldId: oldModId,
        title: mod.title,
        description: mod.description,
        lessons
    });
});

if (DRY) {
    console.log('MODULE MAPPING (new <- old)\n');
    newModules.forEach(m => {
        console.log(`  M${pad(m.id)} <- M${pad(m.oldId)}  ${m.title}  (${m.lessons.length})`);
    });
    console.log('\nLESSON MOVES in reordered modules\n');
    Object.keys(LESSON_ORDER).forEach(oldMod => {
        const nm = newModules.find(m => m.oldId === Number(oldMod));
        console.log(`  module ${oldMod} -> ${nm.id}: ${nm.title}`);
        LESSON_ORDER[oldMod].slice(0, 6).forEach((oldL, i) => {
            const t = map.get(`${oldMod}/${oldL}`);
            console.log(`     ${String(i + 1).padStart(2)}. was ${oldMod}-${oldL}   ${t.title}`);
        });
        console.log('     ...');
    });
    console.log(`\n${map.size} lessons mapped. Nothing written (--dry).`);
    process.exit(0);
}

// ---------------------------------------------------------------- files
// Two phases through a staging directory, because new names collide with old
// ones (module-02/lesson-01 exists both before and after).

const LESSONS = path.join(ROOT, 'lessons');
const STAGE = path.join(ROOT, '.lessons-staging');

if (fs.existsSync(STAGE)) fs.rmSync(STAGE, { recursive: true, force: true });
fs.mkdirSync(STAGE);

let moved = 0;
for (const [oldKey, dest] of map) {
    const [om, ol] = oldKey.split('/');
    const from = path.join(LESSONS, `module-${pad(om)}`, `lesson-${pad(ol)}.html`);
    if (!fs.existsSync(from)) {
        console.error(`MISSING: ${from}`);
        process.exit(1);
    }
    let html = fs.readFileSync(from, 'utf8');

    // Keep the file's own self-identification honest.
    html = html.replace(/data-module="\d+"\s+data-lesson="\d+"/,
                        `data-module="${dest.newM}" data-lesson="${dest.newL}"`);
    html = html.replace(/^<!--\s*Module\s+\d+,\s*Lesson\s+\d+:/m,
                        `<!-- Module ${dest.newM}, Lesson ${dest.newL}:`);
    html = html.replace(/<title>Lesson \d+:/, `<title>Lesson ${dest.newL}:`);

    const dir = path.join(STAGE, `module-${pad(dest.newM)}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `lesson-${pad(dest.newL)}.html`), html);
    moved++;
}

// Swap in.
fs.rmSync(LESSONS, { recursive: true, force: true });
fs.renameSync(STAGE, LESSONS);

// ---------------------------------------------------------------- curriculum

const src = fs.readFileSync(path.join(ROOT, 'assets/curriculum.js'), 'utf8');
const startTok = '    modules: [';
const start = src.indexOf(startTok);
const end = src.indexOf('\n    ],\n', start);
if (start === -1 || end === -1) {
    console.error('ABORTED: could not locate the modules array');
    process.exit(1);
}

const esc = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const lines = [startTok];

newModules.forEach((m, mi) => {
    lines.push(`        // ========== MODULE ${m.id}: ${m.title} ==========`);
    lines.push('        {');
    lines.push(`            id: ${m.id},`);
    lines.push(`            title: '${esc(m.title)}',`);
    lines.push(`            description: '${esc(m.description)}',`);
    lines.push('            lessons: [');
    m.lessons.forEach((l, li) => {
        lines.push('                {');
        lines.push(`                    id: ${l.id},`);
        lines.push(`                    title: '${esc(l.title)}',`);
        lines.push(`                    description: '${esc(l.description)}',`);
        const topics = (l.topics || []).map(t => `'${esc(t)}'`).join(', ');
        lines.push(`                    topics: [${topics}]`);
        lines.push('                }' + (li === m.lessons.length - 1 ? '' : ','));
    });
    lines.push('            ]');
    lines.push('        }' + (mi === newModules.length - 1 ? '' : ','));
});

const rebuilt = src.slice(0, start) + lines.join('\n') + src.slice(end);
fs.writeFileSync(path.join(ROOT, 'assets/curriculum.js'), rebuilt);

// ---------------------------------------------------------------- refs

function remapRefs(file, pattern, build) {
    const p = path.join(ROOT, file);
    if (!fs.existsSync(p)) return 0;
    let text = fs.readFileSync(p, 'utf8');
    let n = 0;
    text = text.replace(pattern, (...args) => {
        const om = Number(args[1]), ol = Number(args[2]);
        const hit = map.get(`${om}/${ol}`);
        if (!hit) return args[0];
        n++;
        return build(hit);
    });
    fs.writeFileSync(p, text);
    return n;
}

const nPath = remapRefs('assets/learning-path.js',
    /ref:\s*\[\s*(\d+)\s*,\s*(\d+)\s*\]/g,
    h => `ref: [${h.newM}, ${h.newL}]`);

let nAudit = 0;
for (const f of ['_audit/netlist.html', '_audit/audit-all.html', '_audit/dup-probe.html']) {
    nAudit += remapRefs(f, /'module-(\d+)\/lesson-(\d+)'/g,
        h => `'module-${pad(h.newM)}/lesson-${pad(h.newL)}'`);
}

// The file header still described an older shape.
const head = fs.readFileSync(path.join(ROOT, 'assets/curriculum.js'), 'utf8');
fs.writeFileSync(path.join(ROOT, 'assets/curriculum.js'),
    head.replace(/^ \* \d+ Modules, \d+ Lessons\.$/m,
        ` * ${newModules.length} Modules, ${map.size} Lessons, in teaching order.`));

console.log(`${moved} lesson files renumbered`);
console.log(`${newModules.length} modules re-sequenced`);
console.log(`${nPath} learning-path refs remapped`);
console.log(`${nAudit} audit-tool refs remapped`);
