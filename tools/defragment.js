#!/usr/bin/env node
/**
 * TURN STANDALONE LESSON PAGES BACK INTO FRAGMENTS
 *
 * 36 lesson files are complete HTML documents - doctype, head, body, and in 14
 * cases their own <header> carrying "Previous / Module 23 / Next" links written
 * before the catalogue was ever reordered.
 *
 * A lesson is injected with innerHTML into #lesson-content. The parser quietly
 * discards the doctype, <html> and <head>, so these mostly appear to work -
 * which is why nobody noticed. What it does NOT discard is the <header>, so
 * those lessons render a second, stale navigation bar inside the page, pointing
 * at sibling files by name and naming the wrong module. Nor the <footer>, so
 * they also render a copyright notice halfway down the course.
 *
 * They also title themselves with <h1> where every other lesson uses <h2>,
 * which is why check-titles.js could not find a heading in six of them and
 * fix-titles.js reached for a numbered section instead.
 *
 * This converts them:
 *
 *   - everything before <body> and after </body> is dropped
 *   - <header> and <footer> blocks are removed
 *   - <main> is unwrapped, its children kept
 *   - the lesson's <h1> becomes an <h2>, matching every other lesson
 *   - the result is wrapped in .lesson-content with the right data attributes,
 *     unless it already has one
 *
 * Scripts and styles inside the body are kept exactly as they are: they are the
 * lesson's interactives and are not this tool's business.
 *
 *   node tools/defragment.js --dry     report what would change
 *   node tools/defragment.js           convert
 *   node tools/defragment.js lessons/module-25/lesson-17.html
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const DRY = process.argv.includes('--dry');

let files = process.argv.slice(2).filter(a => !a.startsWith('-'));
if (!files.length) {
    files = [];
    const dir = path.join(ROOT, 'lessons');
    fs.readdirSync(dir).forEach(m => {
        const md = path.join(dir, m);
        if (!fs.statSync(md).isDirectory()) return;
        fs.readdirSync(md).forEach(f => {
            if (!f.endsWith('.html')) return;
            const rel = path.join('lessons', m, f).replace(/\\/g, '/');
            if (/<!DOCTYPE html>/i.test(fs.readFileSync(path.join(ROOT, rel), 'utf8'))) {
                files.push(rel);
            }
        });
    });
}

/** Remove a whole <tag>...</tag> block, tolerating nesting. */
function dropBlock(html, tag) {
    const open = new RegExp('<' + tag + '\\b[^>]*>', 'i');
    let out = html, guard = 0;
    while (open.test(out) && guard++ < 20) {
        const m = open.exec(out);
        const start = m.index;
        const re = new RegExp('<' + tag + '\\b[^>]*>|</' + tag + '>', 'gi');
        re.lastIndex = start;
        let depth = 0, end = -1, x;
        while ((x = re.exec(out)) !== null) {
            if (x[0][1] === '/') { depth--; if (depth === 0) { end = x.index + x[0].length; break; } }
            else depth++;
        }
        if (end === -1) break;
        out = out.slice(0, start) + out.slice(end);
    }
    return out;
}

/** Unwrap <tag>...</tag>, keeping the contents. */
function unwrap(html, tag) {
    return html
        .replace(new RegExp('<' + tag + '\\b[^>]*>', 'gi'), '')
        .replace(new RegExp('</' + tag + '>', 'gi'), '');
}

const results = [];

files.forEach(rel => {
    const p = path.join(ROOT, rel);
    const before = fs.readFileSync(p, 'utf8');
    const mm = /module-(\d+)[\\/]lesson-(\d+)\.html$/.exec(rel.replace(/\\/g, '/'));
    if (!mm) { results.push({ rel, skip: 'cannot read module/lesson from the path' }); return; }
    const mod = Number(mm[1]), les = Number(mm[2]);

    const bodyOpen = /<body[^>]*>/i.exec(before);
    if (!bodyOpen) { results.push({ rel, skip: 'no <body>' }); return; }
    const bodyStart = bodyOpen.index + bodyOpen[0].length;
    const bodyEnd = before.search(/<\/body>/i);
    if (bodyEnd === -1) { results.push({ rel, skip: 'no </body>' }); return; }

    let s = before.slice(bodyStart, bodyEnd);

    const hadHeader = /<header\b/i.test(s);
    const hadFooter = /<footer\b/i.test(s);
    const hadMain = /<main\b/i.test(s);

    s = dropBlock(s, 'header');
    s = dropBlock(s, 'footer');
    if (hadMain) s = unwrap(s, 'main');

    // Promote the lesson title. Only the FIRST h1 is the lesson's own; a later
    // one would be a section, and there are none, but be explicit about it.
    let promoted = null;
    const h1 = /<h1([^>]*)>([\s\S]*?)<\/h1>/i.exec(s);
    if (h1) {
        promoted = h1[2].replace(/<[^>]*>/g, '').trim();
        s = s.replace(h1[0], '<h2' + h1[1] + '>' + h1[2] + '</h2>');
    }

    // Wrap, unless the file already declares its own lesson-content root.
    const hasRoot = /class="lesson-content"/.test(s);
    if (!hasRoot) {
        s = '<div class="lesson-content" data-module="' + mod + '" data-lesson="' + les + '">\n' +
            s.replace(/^\n+/, '').replace(/\n+$/, '') +
            '\n</div>\n';
    } else {
        // Keep the declared coordinates honest while we are here.
        s = s.replace(/(class="lesson-content"[^>]*data-module=")\d+(")/,
                      (w, a, b) => a + mod + b)
             .replace(/(class="lesson-content"[^>]*data-lesson=")\d+(")/,
                      (w, a, b) => a + les + b);
    }

    s = '<!-- Module ' + mod + ', Lesson ' + les + ' -->\n' + s.replace(/^\s*\n/, '');

    results.push({
        rel, mod, les, hadHeader, hadFooter, hadMain, promoted, hasRoot,
        saved: before.length - s.length, text: s
    });
});

const ok = results.filter(r => r.text);
const skipped = results.filter(r => r.skip);

console.log(files.length + ' standalone lesson documents found');
console.log('  ' + ok.length + ' convertible, ' + skipped.length + ' skipped\n');

console.log('  file                            header footer main  h1 promoted to h2');
ok.forEach(r => console.log('  ' + r.rel.replace('lessons/', '').padEnd(30) +
    (r.hadHeader ? ' yes  ' : '  -   ') +
    (r.hadFooter ? ' yes  ' : '  -   ') +
    (r.hadMain ? ' yes ' : '  -  ') +
    (r.promoted ? ' ' + r.promoted.slice(0, 38) : ' -')));

if (skipped.length) {
    console.log('\nSKIPPED');
    skipped.forEach(r => console.log('  ' + r.rel + '  ' + r.skip));
}

if (DRY) {
    console.log('\nNothing written (--dry).');
    process.exit(0);
}

ok.forEach(r => fs.writeFileSync(path.join(ROOT, r.rel), r.text));
console.log('\n' + ok.length + ' lessons converted to fragments.');
