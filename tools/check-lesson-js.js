#!/usr/bin/env node
/**
 * SYNTAX-CHECK EVERY INLINE <script> IN EVERY LESSON
 *
 * Lessons are injected by XHR and their <script> tags are re-created to make
 * them run. A syntax error therefore fails at RUNTIME, in one lesson, silently
 * - the page renders, the canvas stays blank, and nothing reaches the console
 * unless someone happens to have it open on that lesson. This catches it in a
 * second, before a commit.
 *
 * It only parses. It cannot know whether the code is correct, only whether the
 * browser will refuse to run it. The in-browser sweep is still what checks that
 * the readouts are finite and the canvases actually draw.
 *
 *   node tools/check-lesson-js.js
 *   node tools/check-lesson-js.js lessons/module-05/lesson-04.html
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.dirname(__dirname);

let files = process.argv.slice(2).filter(a => !a.startsWith('-'));
if (!files.length) {
    const dir = path.join(ROOT, 'lessons');
    files = [];
    fs.readdirSync(dir).forEach(m => {
        const md = path.join(dir, m);
        if (!fs.statSync(md).isDirectory()) return;
        fs.readdirSync(md).forEach(f => {
            if (f.endsWith('.html')) files.push(path.join('lessons', m, f).replace(/\\/g, '/'));
        });
    });
}

const bad = [];
let blocks = 0;

files.forEach(f => {
    const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
    let m, i = 0;
    while ((m = re.exec(html)) !== null) {
        const code = m[1];
        if (!code.trim()) continue;
        i++; blocks++;
        try {
            // Compile only. Never run lesson code here - it expects a DOM.
            new vm.Script(code, { filename: f + ' #' + i });
        } catch (e) {
            // Report the line within the file, not within the block.
            const before = html.slice(0, m.index).split('\n').length;
            const inBlock = (e.stack.match(/#\d+:(\d+)/) || [])[1];
            bad.push({
                file: f, block: i,
                line: before + (inBlock ? Number(inBlock) : 0),
                msg: e.message
            });
        }
    }
});

console.log(files.length + ' files, ' + blocks + ' inline script blocks');

if (!bad.length) {
    console.log('PASS - every block parses.');
    process.exit(0);
}
console.log('\nSYNTAX ERRORS (' + bad.length + ')');
bad.forEach(b => console.log('  ' + b.file + ':' + b.line + '  (block ' + b.block + ')\n      ' + b.msg));
process.exit(1);
