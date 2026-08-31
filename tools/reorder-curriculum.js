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

// New module sequence, given as OLD module ids.
const MODULE_ORDER = [
    // Abstraction: what an amplifier is, and using it before explaining it.
    2,   // Op-Amp Fundamentals
    3,   // Advanced Applications
    // Mechanism: why the golden rules are true at all.
    25,  // Feedback Theory & Stability
    // Devices: the transistor as the answer, not the prerequisite.
    1,   // Transistor Intuition (BJT)
    5,   // FET/MOSFET Fundamentals
    // Blocks built from them.
    10,  // Output Stages & Complementary Circuits
    14,  // Advanced Analog Blocks
    11,  // Oscillators & Timing Circuits
    // Practice.
    4,   // Practical Skills
    9,   // Design Trade-offs Workshop
    15,  // Practice Problems & Exercises
    // Applications.
    6,   // Power Electronics Applications
    18,  // Power Supply Design
    19,  // Battery Management
    7,   // Audio Applications
    8,   // Data Conversion Applications
    20,  // Sensor Interface
    12,  // Digital Interface Electrical Design
    13,  // Communication Protocols - Electrical Level
    21,  // RF Analog
    22,  // EMI/EMC Design
    // Systems and the real world.
    16,  // Real-World Scenarios
    17,  // Troubleshooting & Debug
    23,  // Real-World System Design
    24,  // Complex Real-World Projects
    26   // Power Systems & the Grid (ERCOT / AEP)
];

// New lesson sequence inside a module, given as OLD lesson ids. Modules absent
// here keep the order they already have.
const LESSON_ORDER = {
    // Op-amps: the ideal amplifier first (it was written last, so it sat at
    // the end), then the rules, then using them, then where they break.
    2: [15, 1, 4, 2, 3, 9, 8, 5, 10, 11, 12, 13, 6, 7, 14],

    // BJT: model, then bias, then topologies. The catalogue had the
    // differential pair and current mirrors before DC biasing, and the
    // small-signal model at 21 - after the frequency response that needs it.
    1: [1, 21, 5, 2, 6, 7, 8, 11, 3, 4, 18, 12, 9, 22, 13, 14, 15, 16, 17,
        19, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 10, 20, 35, 36],

    // FET: the analog half first, then the power-switch material it was
    // buried behind.
    5: [1, 21, 22, 23, 8, 3, 7, 10, 5, 2, 6, 11, 12, 13, 9, 19, 16, 17, 18,
        15, 4, 14, 20]
};

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
