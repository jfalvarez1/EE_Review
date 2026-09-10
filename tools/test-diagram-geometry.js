#!/usr/bin/env node
'use strict';

// Exercise the real SVG renderer. A figure with validate:false must still be
// checked here; a missing figure cannot silently count as a passing diagram.
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const { createLessonContext, extractScripts } = require('./validate-schematics');

const targets = {
    'lessons/module-01/lesson-01.html': ['sch-input-lab'],
    'lessons/module-01/lesson-02.html': ['sch-build-inv', 'sch-build-non'],
    'lessons/module-01/lesson-03.html': ['wavegen-schematic'],
    'lessons/module-01/lesson-04.html': ['sch-build-bandwidth'],
    'lessons/module-01/lesson-05.html': ['error-source-schematic', 'sch-build-dc-errors'],
    'lessons/module-01/lesson-07.html': ['sch-offset-bench'],
    'lessons/module-01/lesson-08.html': ['sch-stability-loop', 'sch-stability-load', 'sch-stability-cin', 'sch-stability-isolation', 'sch-stability-cf', 'sch-stability-noise'],
    'lessons/module-25/lesson-01.html': ['audio-system-diag', 'pdm-diag', 'tablet-design-diag', 'sch-mic-preamp']
};
const geometryTypes = new Set(['text_overlap', 'text_overlap_wire', 'text_overlap_keepout']);

function render(file, mutate = s => s) {
    const html = mutate(fs.readFileSync(file, 'utf8'));
    const { context, document } = createLessonContext(html);
    const figures = new Map();
    const create = context.AD.Schematic.create;
    context.AD.Schematic.create = (host, options) => {
        const s = create(host, options);
        figures.set(host.id, s);
        return s;
    };
    // Supply the real input defaults that the lightweight harness does not parse.
    for (const tag of html.match(/<(?:input|select)\b[^>]*>/gi) || []) {
        const id = /\bid="([^"]+)"/.exec(tag);
        if (!id) continue;
        const el = document.getElementById(id[1]);
        for (const attr of ['value', 'min', 'max']) {
            const m = new RegExp('\\b' + attr + '="([^"]+)"').exec(tag);
            if (m) { el.setAttribute(attr, m[1]); if (attr === 'value') el.value = el.defaultValue = m[1]; }
        }
    }
    for (const select of html.matchAll(/<select\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/select>/gi)) {
        const options = [...select[2].matchAll(/<option\b([^>]*)>/gi)];
        const option = options.find(o => /\bselected\b/.test(o[1])) || options[0];
        const value = option && /\bvalue="([^"]*)"/.exec(option[1]);
        if (value) document.getElementById(select[1]).value = value[1];
    }
    for (const script of extractScripts(html)) new vm.Script(script, { filename: file }).runInContext(context);
    return { context, document, figures };
}

function issues(s) {
    const report = s.finalize({ validate: true });
    const found = [...report.errors, ...report.warnings].filter(f => geometryTypes.has(f.type));
    for (const seg of s.segmentRegistry.segments.values()) {
        if (seg.x1 !== seg.x2 && seg.y1 !== seg.y2) found.push({ type: 'diagonal_wire', message: 'Connector must be orthogonal' });
    }
    // Markers' XML attributes are case-sensitive. Invalid ref-x/marker-width
    // leave arrows misplaced or invisible even when every wire is connected.
    const visit = node => {
        if (String(node.tagName).toLowerCase() === 'marker') {
            for (const attr of ['viewBox', 'refX', 'refY', 'markerWidth', 'markerHeight']) {
                if (node.getAttribute(attr) === null) found.push({ type: 'marker', message: 'Missing SVG marker ' + attr });
            }
        }
        for (const child of node.children || []) visit(child);
    };
    visit(s.svg);
    return found;
}

function checkFigure(figures, id, file) {
    assert(figures.has(id), `${file}: missing rendered figure ${id}`);
    const errors = issues(figures.get(id));
    assert.equal(errors.length, 0, `${file} #${id}:\n${errors.map(e => e.type + ': ' + e.message).join('\n')}`);
}

function main() {
    let count = 0;
    for (const [file, ids] of Object.entries(targets)) {
        const { figures } = render(file);
        for (const id of ids) {
            checkFigure(figures, id, file);
            count++;
        }
    }

    // Reintroduce the original codec-heading collision: this gate must detect it.
    const audioFile = 'lessons/module-25/lesson-01.html';
    const collided = render(audioFile, s => s.replace(
        "const labelY = heading ? y - h/2 + 25 : y - (sublabel ? 8 : 0);",
        "const labelY = y - (sublabel ? 8 : 0);"));
    assert(issues(collided.figures.get('audio-system-diag')).some(e => e.type === 'text_overlap'), 'The codec-heading regression was not detected');
    const valid = render(audioFile).figures.get('audio-system-diag');
    valid.wire([[260, 75], [590, 75]]); // A connector through the codec title.
    assert(issues(valid).some(e => e.type === 'text_overlap_wire'), 'A wire through a title was not detected');
    valid.wire([[20, 20], [40, 40]]);
    assert(issues(valid).some(e => e.type === 'diagonal_wire'), 'A slanted connector was not detected');
    const marker = valid.defs.children.find(n => String(n.tagName).toLowerCase() === 'marker');
    marker.attributes.delete('refX'); marker.setAttribute('ref-x', 0);
    assert(issues(valid).some(e => e.type === 'marker'), 'Invalid marker casing was not detected');
    const missing = render(audioFile, s => s.replace("const container = document.getElementById('audio-system-diag');", 'const container = null;'));
    assert(!missing.figures.has('audio-system-diag'), 'The missing-figure mutation did not remove its figure');
    assert.throws(() => checkFigure(missing.figures, 'audio-system-diag', audioFile), /missing rendered figure/);

    console.log(`PASS - ${count} rendered diagrams: label geometry, wire clearance, marker attributes; original-defect mutations rejected.`);
}
if (require.main === module) main();
module.exports = { render, issues };
