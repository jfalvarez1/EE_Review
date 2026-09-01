#!/usr/bin/env node
/**
 * CHECK THAT EVERY LESSON'S MARKUP IS BALANCED
 *
 * Lessons are injected into #lesson-content as an HTML fragment. A missing or
 * extra </div> does not throw and does not log - the browser silently reparents
 * everything after it, so a card ends up nested inside the one above and the
 * page merely looks a bit wrong. Nothing else in this repo would catch that.
 *
 * Two real defects were found the first time it ran, both predating any of the
 * tooling here: a </note> typo where a </div> belonged, and one surplus </div>
 * that swallowed a card.
 *
 * Content inside <script> and inside HTML comments is skipped, because both
 * legitimately contain angle brackets that are not markup.
 *
 *   node tools/check-markup.js
 *   node tools/check-markup.js lessons/module-14/lesson-10.html
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);

// Tags that never need closing, so an unmatched one is not an error.
const VOID = /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i;
// Tags whose close tag is optional in HTML and routinely omitted here.
const OPTIONAL = /^(li|p|td|th|tr|thead|tbody|tfoot|option|dt|dd)$/i;

function strip(html) {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, m => m.replace(/[^\n]/g, ' '))
        .replace(/<style[\s\S]*?<\/style>/gi, m => m.replace(/[^\n]/g, ' '))
        .replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ' '));
}

function check(file) {
    const html = strip(fs.readFileSync(path.join(ROOT, file), 'utf8'));
    const stack = [];
    const problems = [];
    const re = /<(\/?)([a-zA-Z][\w-]*)\b[^>]*?(\/?)>/g;
    let m;
    const lineAt = i => html.slice(0, i).split('\n').length;

    while ((m = re.exec(html)) !== null) {
        const closing = m[1] === '/';
        const tag = m[2].toLowerCase();
        const selfClosed = m[3] === '/';
        if (VOID.test(tag) || selfClosed) continue;
        if (OPTIONAL.test(tag)) continue;

        if (!closing) {
            stack.push({ tag: tag, line: lineAt(m.index) });
        } else {
            if (!stack.length) {
                problems.push({ line: lineAt(m.index), msg: '</' + tag + '> with nothing open' });
                continue;
            }
            const top = stack[stack.length - 1];
            if (top.tag === tag) { stack.pop(); continue; }
            // tolerate a close that matches something further down the stack
            const at = (() => { for (let i = stack.length - 1; i >= 0; i--) if (stack[i].tag === tag) return i; return -1; })();
            if (at === -1) {
                problems.push({ line: lineAt(m.index),
                                msg: '</' + tag + '> but <' + top.tag + '> from line ' + top.line + ' is open' });
            } else {
                problems.push({ line: lineAt(m.index),
                                msg: '</' + tag + '> closes line ' + stack[at].line +
                                     ', leaving <' + stack[at + 1].tag + '> from line ' +
                                     stack[at + 1].line + ' unclosed' });
                stack.length = at;
            }
        }
    }
    stack.forEach(s => problems.push({ line: s.line, msg: '<' + s.tag + '> is never closed' }));
    return problems;
}

let files = process.argv.slice(2).filter(a => !a.startsWith('-'));
if (!files.length) {
    files = [];
    const dir = path.join(ROOT, 'lessons');
    fs.readdirSync(dir).forEach(m => {
        const md = path.join(dir, m);
        if (!fs.statSync(md).isDirectory()) return;
        fs.readdirSync(md).forEach(f => {
            if (f.endsWith('.html')) files.push(path.join('lessons', m, f).replace(/\\/g, '/'));
        });
    });
}

let total = 0;
const bad = [];
files.forEach(f => {
    const p = check(f);
    if (p.length) { bad.push({ file: f, problems: p }); total += p.length; }
});

console.log(files.length + ' lessons checked');
if (!bad.length) {
    console.log('PASS - markup is balanced.');
    process.exit(0);
}
console.log('\nUNBALANCED MARKUP (' + total + ' in ' + bad.length + ' files)');
bad.forEach(b => {
    console.log('  ' + b.file);
    b.problems.slice(0, 6).forEach(p => console.log('      line ' + p.line + ': ' + p.msg));
    if (b.problems.length > 6) console.log('      ... ' + (b.problems.length - 6) + ' more');
});
process.exit(1);
