#!/usr/bin/env node
/**
 * add-sources - put a Sources block at the end of a lesson.
 *
 * The plumbing is the same every time: a card just inside the closing
 * </div> of .lesson-content, before the lesson's own <script> blocks. Doing
 * that by hand across forty lessons is how a stray tag gets into forty files,
 * so the mechanical half lives here and the bibliography stays hand-written.
 *
 * The anchor is the last top-level </div> before the first top-level <script>,
 * which is the close of .lesson-content in every lesson in the course. If that
 * shape is not found, this refuses rather than guessing - inserting a card
 * outside .lesson-content is silent and looks almost right.
 *
 *   node tools/add-sources.js lessons/module-18/lesson-02.html sources.html
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const [rel, fragPath] = process.argv.slice(2);

if (!rel || !fragPath) {
    console.error('usage: add-sources.js <lesson.html> <fragment.html>');
    process.exit(2);
}

const file = path.resolve(ROOT, rel);
let src = fs.readFileSync(file, 'utf8');

if (/class="sources"/.test(src)) {
    console.error('skip  ' + rel + '  (already has a sources block)');
    process.exit(0);
}

const crlf = src.indexOf('\r\n') !== -1;
const nl = crlf ? '\r\n' : '\n';
const flat = src.replace(/\r\n/g, '\n');

/*
 * Blank out script bodies before looking for the anchor.
 *
 * Several lessons build their markup inside a template literal - hundreds of
 * lines of HTML living in JavaScript - and one of them has a </div> in there
 * at exactly the shape this looks for. Inserting into it puts the whole
 * Sources block inside a string, where it never renders, and neither
 * check-markup nor check-lesson-js notices because the result is still
 * balanced HTML and still parses as JS.
 *
 * Replacing the body with spaces of the same length keeps every index below
 * valid against the original text.
 */
const masked = flat.replace(/<script\b[\s\S]*?<\/script>/gi,
    m => m.replace(/[^\n]/g, ' '));

// The close of .lesson-content: a </div> at column 0 with nothing but
// whitespace, comments or <script> after it.
// Most lessons close .lesson-content at column 0, but not all of them do, so
// allow leading whitespace and pick the LAST such line before the scripts.
const closes = [];
const re = /^[ \t]*<\/div>[ \t]*$/gm;
let m;
while ((m = re.exec(masked))) closes.push(m.index);
if (!closes.length) {
    console.error('FAIL  ' + rel + '  no top-level </div> to anchor to');
    process.exit(1);
}

const firstScript = masked.search(/^[ 	]*<script/m);
const anchor = closes.filter(i => firstScript === -1 || i < firstScript).pop();
if (anchor === undefined) {
    console.error('FAIL  ' + rel + '  every top-level </div> is after the scripts');
    process.exit(1);
}

const frag = fs.readFileSync(path.resolve(process.cwd(), fragPath), 'utf8')
    .replace(/\r\n/g, '\n').replace(/\s*$/, '');

const out = flat.slice(0, anchor) + frag + '\n\n' + flat.slice(anchor);
fs.writeFileSync(file, crlf ? out.replace(/\n/g, nl) : out);
console.log('ok    ' + rel);
