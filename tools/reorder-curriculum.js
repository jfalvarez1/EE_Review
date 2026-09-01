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
// IDENTITY at the moment: the modules are already in teaching order, so this
// list only exists to reorder LESSONS. Leaving a stale non-identity order here
// is the sharpest edge on this tool - it is a valid permutation, so the
// validator accepts it, and it silently shuffles all 27 modules a second time.
// The --dry run is the guard: it prints "M07 <- M06" style mappings, and any
// arrow that should be an identity is the warning.
const MODULE_ORDER = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
    15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27
];

// Entries are validated as permutations of the module they name, so a stale
// plan aborts rather than scrambling the lessons.
const LESSON_ORDER = {
    // Empty. Applied so far: the BJT small-signal model to 5-2 and Miller to
    // 5-4; Bode-by-hand to 3-3, before the stability lesson that reads the plot
    // it teaches; op-amp datasheet reading to 1-7, beside the error terms it
    // locates; transistor selection to 5-36, in front of the selection guide
    // and the worked mirror design.
};

// Lessons that are in the wrong MODULE, given as current coordinates. Each is
// removed from its module and appended to the destination in the order listed;
// both modules are then renumbered 1..n.
//
// This is not a reordering, it is a correction. Both groups below have been
// misfiled since the project's first commit: nine lessons were glued to the
// front of the module that happened to follow the one they belonged to, so
// "RF Analog" opened on five general exercise sets and "EMI/EMC Design" opened
// on four lessons about ADC monotonicity. Neither module's own subject started
// until halfway down its list.
//
// A move and a LESSON_ORDER entry for the same module would be ambiguous - the
// order would be written in ids that the move invalidates - so that is refused.
// STALENESS IS THE HAZARD HERE, exactly as it is for MODULE_ORDER. A move is
// written in coordinates, and after it runs those coordinates name a DIFFERENT
// lesson - 21-1 was "Exercise Set A" before the correction below and is
// "Matching Networks" after it. Re-running a spent plan is therefore valid and
// silently wrong. Empty it once applied, and read --dry before every run.
//
// APPLIED: the exercise sets A-E moved 21 -> 12 (generic practice, not RF), and
// the four monotonicity/DNL lessons moved 22 -> 17 (converter specifications,
// not EMC). Both groups had been misfiled since the first commit, which left
// "RF Analog" and "EMI/EMC Design" each opening on another module's subject.
const MOVES = [];

// ---------------------------------------------------------------- load

global.window = {};
(0, eval)(fs.readFileSync(path.join(ROOT, 'assets/curriculum.js'), 'utf8'));
const C = global.window.CURRICULUM || global.CURRICULUM;

const pad = n => String(n).padStart(2, '0');

// ---------------------------------------------------------------- moves
// Work on a copy in which every lesson remembers where it came from, because
// after a move its id no longer says where its file is.

const work = C.modules.map(m => ({
    id: m.id,
    title: m.title,
    description: m.description,
    lessons: m.lessons.map(l => Object.assign({}, l, { _origM: m.id, _origL: l.id }))
}));

const moveProblems = [];
const takenFrom = new Set();
const touched = new Set();

MOVES.forEach(mv => {
    const key = mv.from.join('/');
    if (takenFrom.has(key)) moveProblems.push(`lesson ${key} is moved twice`);
    takenFrom.add(key);

    const src = work.find(m => m.id === mv.from[0]);
    if (!src) { moveProblems.push(`move source module ${mv.from[0]} does not exist`); return; }
    if (!src.lessons.some(l => l._origL === mv.from[1])) {
        moveProblems.push(`module ${mv.from[0]} has no lesson ${mv.from[1]}`);
        return;
    }
    if (!work.find(m => m.id === mv.to)) {
        moveProblems.push(`move destination module ${mv.to} does not exist`);
        return;
    }
    if (mv.to === mv.from[0]) {
        moveProblems.push(`lesson ${key} is "moved" to its own module`);
    }
    touched.add(mv.from[0]);
    touched.add(mv.to);
});

touched.forEach(id => {
    if (LESSON_ORDER[id]) {
        moveProblems.push(`module ${id} appears in both MOVES and LESSON_ORDER - ` +
                          `the order would be written in ids the move invalidates`);
    }
});

if (moveProblems.length) {
    console.error('ABORTED — the MOVES plan does not describe this curriculum:\n');
    moveProblems.forEach(p => console.error('  ' + p));
    process.exit(1);
}

// Detach first, then append, so a move never sees a half-updated module.
const detached = MOVES.map(mv => {
    const src = work.find(m => m.id === mv.from[0]);
    const i = src.lessons.findIndex(l => l._origL === mv.from[1]);
    return { lesson: src.lessons.splice(i, 1)[0], to: mv.to };
});
detached.forEach(d => work.find(m => m.id === d.to).lessons.push(d.lesson));

// Renumber every module, so ids are contiguous again.
work.forEach(m => m.lessons.forEach((l, i) => { l.id = i + 1; }));

// ---------------------------------------------------------------- validate

const problems = [];

const seen = new Set(MODULE_ORDER);
if (seen.size !== MODULE_ORDER.length) problems.push('MODULE_ORDER has duplicates');
if (MODULE_ORDER.length !== work.length) {
    problems.push(`MODULE_ORDER has ${MODULE_ORDER.length}, curriculum has ${work.length}`);
}
for (const m of work) {
    if (!seen.has(m.id)) problems.push(`module ${m.id} missing from MODULE_ORDER`);
}

for (const [oldMod, order] of Object.entries(LESSON_ORDER)) {
    const mod = work.find(m => m.id === Number(oldMod));
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

// The key is where the FILE currently is, which after a move is no longer the
// lesson's id - hence _origM/_origL rather than the module and id in hand.
// oldKey "m/l" -> { newM, newL, title }
const map = new Map();
const newModules = [];

MODULE_ORDER.forEach((oldModId, mi) => {
    const mod = work.find(m => m.id === oldModId);
    const newModId = mi + 1;
    const order = LESSON_ORDER[oldModId] || mod.lessons.map(l => l.id);

    const lessons = order.map((oldLessonId, li) => {
        const les = mod.lessons.find(l => l.id === oldLessonId);
        map.set(`${les._origM}/${les._origL}`, {
            newM: newModId, newL: li + 1, title: les.title,
            movedFrom: les._origM === newModId ? null : les._origM
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
    if (MOVES.length) {
        console.log('\nCROSS-MODULE MOVES\n');
        for (const [oldKey, h] of map) {
            if (!h.movedFrom) continue;
            const dest = newModules.find(m => m.id === h.newM);
            console.log(`  ${oldKey.replace('/', '-')}  ->  ${h.newM}-${h.newL}   ` +
                        `${h.title}\n        into ${dest.title}`);
        }
        console.log('\n  resulting sizes:');
        [...touched].sort((a, b) => a - b).forEach(id => {
            const nm = newModules.find(m => m.oldId === id);
            const was = C.modules.find(m => m.id === id).lessons.length;
            console.log(`    M${pad(nm.id)}  ${was} -> ${nm.lessons.length}   ${nm.title}`);
        });
    }

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
