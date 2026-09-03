#!/usr/bin/env node
/**
 * add-sim-check - drop a SimCheckWidget into a lesson's build section.
 *
 * The plumbing is identical every time: a host div at the end of the "Build it
 * in Circuit Toy" card, and a script block at the end of the file that mounts
 * the widget on it. Only the engineering content differs. Doing that by hand
 * 172 times is how a typo gets into 172 files, so the mechanical half is done
 * here and the content half stays hand-written.
 *
 * The anchor is the boilerplate paragraph every build section ends with. If it
 * is missing, or there is more than one, this refuses rather than guessing -
 * inserting a div in the wrong card is silent and looks fine.
 *
 *   node tools/add-sim-check.js lessons/module-05/lesson-01.html m05l01-vbe snippet.js
 *
 * The snippet file is the widget's options object only, starting at `{` - the
 * `new SimCheckWidget('host', ...)` wrapper is generated, so the host id can
 * never drift from the div.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const [rel, hostId, snippetPath] = process.argv.slice(2);

if (!rel || !hostId || !snippetPath) {
    console.error('usage: add-sim-check.js <lesson.html> <host-id> <snippet.js>');
    process.exit(2);
}

const file = path.resolve(ROOT, rel);
let src = fs.readFileSync(file, 'utf8');

if (src.indexOf('id="' + hostId + '"') !== -1) {
    console.error('FAIL - ' + rel + ' already has an element with id ' + hostId);
    process.exit(1);
}

const ANCHOR = /(\n\s*<p>Then change one thing at a time and predict the result before you run\s*\n\s*it\.[\s\S]*?<\/p>)/g;
let hits = src.match(ANCHOR);
let anchor = ANCHOR;

// A handful of lessons - module 25's later ones, which were generated
// differently - have no boilerplate closing paragraph. For those, the last
// paragraph of the "What to run" block is just as unambiguous: it is the end of
// the build section by construction, since a heading follows it. Requiring a
// unique match still applies, so this can only ever pick one place.
if (!hits) {
    const RUN = /(<p><strong>What to run:<\/strong>[\s\S]*?<\/p>)(?=\s*(?:<\/section>|<h2|<h3|<div class="card"))/g;
    hits = src.match(RUN);
    if (hits && hits.length === 1) anchor = RUN;
}

if (!hits) {
    console.error('FAIL - ' + rel + ' has no build-section closing paragraph to anchor to.');
    process.exit(1);
}
if (hits.length > 1) {
    console.error('FAIL - ' + rel + ' has ' + hits.length + ' candidate anchors; ' +
                  'insert this one by hand.');
    process.exit(1);
}

// Replace with a function so $-sequences in the matched text stay literal.
src = src.replace(anchor, m => m + '\n\n        <div id="' + hostId + '"></div>');

const opts = fs.readFileSync(path.resolve(process.cwd(), snippetPath), 'utf8').trim();
if (opts[0] !== '{') {
    console.error('FAIL - the snippet must be the options object, starting with {');
    process.exit(1);
}

const block =
    '\n<script>\n' +
    '/* What a correct build reads, and what to do to it next. Every number\n' +
    '   below is derived from the values in the build table above - if it cannot\n' +
    '   be derived from what is on this page, it does not belong here. */\n' +
    '(function () {\n' +
    "    if (typeof SimCheckWidget === 'undefined') return;\n" +
    "    new SimCheckWidget('" + hostId + "', " + opts.replace(/\n/g, '\n    ') + ');\n' +
    '})();\n' +
    '</script>\n';

fs.writeFileSync(file, src.replace(/\s*$/, '\n') + block);
console.log('ok  ' + rel + '  -> #' + hostId);
