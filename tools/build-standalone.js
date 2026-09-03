#!/usr/bin/env node
/**
 * BUILD ONE SELF-CONTAINED HTML FILE
 *
 * Output: dist/EE_Review.html - the whole course in a single file. Double-click
 * it. No server, no Python, no Node, no internet, no install. It works from a
 * USB stick, from a network share, from an email attachment, and it will still
 * work in twenty years because it depends on nothing but a browser.
 *
 * That last property is the point. The normal way to run this course is a local
 * web server (launch.bat), because lessons are fetched by XHR and a browser will
 * not let a file:// page read sibling files. This build removes the fetch
 * entirely: every lesson is embedded as a string, and a small shim inside the
 * output answers the loader's XHR from that map. Nothing in assets/ changes -
 * the shim exists only in the generated file, so there is no second code path
 * for the hosted version to drift away from.
 *
 * MathJax is vendored too, as the SVG build rather than the CHTML one. CHTML
 * pulls woff font files at render time, which is fine on a network and useless
 * offline; the SVG build carries its glyph outlines as path data and references
 * no external file at all. Verified: zero matches for "woff" in the bundle.
 *
 *   node tools/build-standalone.js
 *   node tools/build-standalone.js --out somewhere/else.html
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const argOut = (() => {
    const i = process.argv.indexOf('--out');
    return i !== -1 ? process.argv[i + 1] : null;
})();
const OUT = argOut ? path.resolve(argOut) : path.join(ROOT, 'dist', 'EE_Review.html');

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

/**
 * String.replace treats $&, $`, $', $1.. in the REPLACEMENT as substitution
 * patterns. Lesson and asset text contains all of them, and the failure is
 * spectacular: $` inserts the entire document-so-far into the middle of the
 * payload, which truncated the embedded lessons at 4.7 MB of 10 and left
 * literal ${n(p.x)} strings rendering as SVG attributes. Always replace with a
 * FUNCTION, which is passed through verbatim.
 */
const put = (haystack, needle, replacement) => haystack.replace(needle, () => replacement);
const kb = n => (n / 1024).toFixed(0) + ' KB';
const mb = n => (n / 1024 / 1024).toFixed(1) + ' MB';

// ---------------------------------------------------------------- lessons

const lessons = {};
let lessonBytes = 0;
const ldir = path.join(ROOT, 'lessons');
fs.readdirSync(ldir).sort().forEach(m => {
    const md = path.join(ldir, m);
    if (!fs.statSync(md).isDirectory()) return;
    fs.readdirSync(md).sort().forEach(f => {
        if (!f.endsWith('.html')) return;
        const body = fs.readFileSync(path.join(md, f), 'utf8');
        lessons[m + '/' + f.replace(/\.html$/, '')] = body;
        lessonBytes += Buffer.byteLength(body);
    });
});
const lessonCount = Object.keys(lessons).length;
if (!lessonCount) {
    console.error('No lessons found. Run this from the repo, not from dist/.');
    process.exit(1);
}

// ---------------------------------------------------------------- assets

let html = read('index.html');

function inlineStylesheet(href) {
    const css = read(href);
    const tag = new RegExp('<link[^>]*href="' + href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^>]*>');
    if (!tag.test(html)) throw new Error('could not find the stylesheet link for ' + href);
    html = put(html, tag, '<style>\n' + css + '\n</style>');
    return Buffer.byteLength(css);
}

function inlineScript(src) {
    const js = read(src);
    const tag = new RegExp('<script[^>]*src="' + src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^>]*>\\s*</script>');
    if (!tag.test(html)) throw new Error('could not find the script tag for ' + src);
    // A literal </script> inside embedded JS would close the tag early. None of
    // the assets contain one today, but check rather than hope.
    if (/<\/script/i.test(js)) throw new Error(src + ' contains a literal </script> and cannot be inlined as-is');

    // Leave an INERT marker tag beside the inlined code.
    //
    // Lessons were originally authored as standalone pages and many still carry
    // their own <script src="../../assets/exercises.js"> tags. The router only
    // re-executes such a tag if the page has not already loaded that file, and
    // it decides that by querying `head script[src]`. Inlining removes every
    // src attribute, so the guard found nothing, every lesson re-ran the shared
    // assets, and the console filled with "Identifier 'EXERCISES' has already
    // been declared".
    //
    // A script with an unrecognised `type` is neither fetched nor executed, but
    // it is still in the DOM and still matches that selector. So the marker
    // costs nothing and needs no change to the router.
    const marker = '<script type="application/x-inlined-by-build" src="' + src + '"></scr' + 'ipt>';
    html = put(html, tag, marker + '\n<script>\n' + js + '\n</script>');
    return Buffer.byteLength(js);
}

let assetBytes = 0;
assetBytes += inlineStylesheet('assets/styles.css');
[
    'assets/ad-framework.js',
    'assets/widgets.js',
    'assets/component-models.js',
    'assets/schematic-svg.js',
    'assets/schematic-normalize.js',
    'assets/checkpoints.js',
    'assets/board-viewer.js',
    'assets/learning-path.js',
    'assets/curriculum.js',
    'assets/exercises.js'
].forEach(s => { assetBytes += inlineScript(s); });

// ---------------------------------------------------------------- MathJax

const MJ = 'assets/vendor/mathjax-tex-mml-svg.js';
let mathBytes = 0;
if (fs.existsSync(path.join(ROOT, MJ))) {
    const mj = read(MJ);
    if (/woff|\.otf/.test(mj)) {
        console.error('WARNING: the vendored MathJax references font files. ' +
                      'Use the tex-mml-svg build, not tex-mml-chtml.');
    }
    const cdn = /<script id="MathJax-script"[^>]*>\s*<\/script>/;
    if (!cdn.test(html)) throw new Error('could not find the MathJax CDN script tag');
    html = put(html, cdn, '<script id="MathJax-script">\n' + mj + '\n</script>');
    mathBytes = Buffer.byteLength(mj);
} else {
    console.error('NOTE: ' + MJ + ' is missing, so the standalone file will still');
    console.error('      reach out to the CDN for MathJax and equations will not');
    console.error('      render offline. Fetch it with:');
    console.error('      curl -o ' + MJ + ' https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-svg.js');
}

// ---------------------------------------------------------------- the shim
//
// Injected immediately before curriculum.js, so the loader it patches has not
// run yet. It subclasses XMLHttpRequest rather than replacing it: a request for
// a lesson is answered from the embedded map, anything else falls through to
// the real thing untouched.

const shim = `<script>
/* Standalone build: every lesson is embedded, so there is nothing to fetch.
   The app's loader still speaks XHR, so answer it from the map rather than
   forking the loader - that keeps one code path for both builds. */
(function () {
    'use strict';
    var LESSONS = window.EMBEDDED_LESSONS;
    if (!LESSONS) return;
    var BOARDS = window.EMBEDDED_BOARDS || {};
    var Real = window.XMLHttpRequest;

    // Two kinds of thing are fetched by XHR: lesson fragments, and the board
    // data the interactive layout figures draw from. Both are embedded, so
    // both are answered here. Anything else falls through to the real
    // XMLHttpRequest untouched.
    function keyFor(url) {
        if (!url) return null;
        var s = String(url);
        var m = /lessons\\/(module-\\d+\\/lesson-\\d+)(?:\\.html)?/.exec(s);
        if (m) return m[1];
        var b = /docs\\/data\\/boards\\/([A-Za-z0-9_.-]+)\\.json/.exec(s);
        if (b) return 'board:' + b[1];
        return null;
    }

    function bodyFor(key) {
        if (key.indexOf('board:') === 0) return BOARDS[key.slice(6)];
        return LESSONS[key];
    }

    window.XMLHttpRequest = function () {
        var xhr = new Real();
        var open = xhr.open, send = xhr.send;
        var served = null;

        xhr.open = function (method, url) {
            served = keyFor(url);
            if (served && bodyFor(served) !== undefined) return;
            return open.apply(xhr, arguments);
        };

        xhr.send = function () {
            var body = served && bodyFor(served);
            if (body === undefined || body === null) return send.apply(xhr, arguments);
            // Shadow the prototype getters with own properties.
            try {
                Object.defineProperty(xhr, 'readyState', { value: 4, configurable: true });
                Object.defineProperty(xhr, 'status', { value: 200, configurable: true });
                Object.defineProperty(xhr, 'responseText', { value: body, configurable: true });
            } catch (e) { /* older engines: fall back to plain assignment */
                xhr.readyState = 4; xhr.status = 200; xhr.responseText = body;
            }
            // Asynchronous, like the real thing, so callers that assign
            // onreadystatechange after send() still see the event.
            setTimeout(function () {
                if (typeof xhr.onreadystatechange === 'function') xhr.onreadystatechange();
                if (typeof xhr.onload === 'function') xhr.onload();
            }, 0);
        };

        return xhr;
    };
    window.XMLHttpRequest.prototype = Real.prototype;
}());
</script>
`;

// ---------------------------------------------------------------- embedding

// JSON.stringify handles every escape correctly; the only thing it does not
// know about is HTML parsing, so neutralise the two sequences that would end
// the script element early.
const payload = JSON.stringify(lessons)
    .replace(/<\/script/gi, '<\\/script')
    .replace(/<!--/g, '<\\u0021--');

// The interactive layout figures fetch their board data the same way lessons
// are fetched, so it has to travel with the file or those figures come up
// blank offline. These are small - a few hundred kB in total - and there is no
// point shipping a "whole course" that is missing its board viewer.
const boards = {};
const BOARD_DIR = path.join(ROOT, 'docs', 'data', 'boards');
let boardBytes = 0;
if (fs.existsSync(BOARD_DIR)) {
    fs.readdirSync(BOARD_DIR).filter(f => f.endsWith('.json')).forEach(f => {
        const text = fs.readFileSync(path.join(BOARD_DIR, f), 'utf8');
        boards[f.replace(/\.json$/, '')] = text;
        boardBytes += Buffer.byteLength(text);
    });
}
const boardPayload = JSON.stringify(boards)
    .replace(/<\/script/gi, '<\\/script')
    .replace(/<!--/g, '<\\u0021--');

const embed = '<script>window.EMBEDDED_LESSONS = ' + payload + ';</script>\n' +
              '<script>window.EMBEDDED_BOARDS = ' + boardPayload + ';</script>\n';

const anchor = '<script>\n' + read('assets/curriculum.js');
if (html.indexOf(anchor) === -1) {
    throw new Error('could not locate the inlined curriculum.js to inject the shim before');
}
html = put(html, anchor, embed + shim + anchor);

// The loader's failure path tells the reader to start a web server, which is
// correct for the folder edition and actively misleading here - there is no
// folder, and no lesson to serve from it. Replace the whole notice.
{
    const before = html;
    html = html
        .replace(/<h3>Browser Security Notice<\/h3>/g,
                 '<h3>This lesson is not in this build</h3>')
        .replace(/<strong>Local File Access Blocked:<\/strong>[\s\S]*?<\/ol>/g, () =>
            '<strong>Missing lesson.</strong> This single-file edition embeds every ' +
            'lesson at build time, and this one is not in the map — which means ' +
            'the file was built from an incomplete checkout.\n' +
            '<br><br>\n' +
            '<strong>Fix:</strong> rebuild from a full clone with ' +
            '<code>node tools/build-standalone.js</code>, or download the current ' +
            'offline edition from the project’s Releases page.');
    // The loader has a SECOND such notice, in its catch branch for strict CORS.
    html = html.replace(
        /<strong>Note:<\/strong> Your browser blocks local file loading\.[\s\S]*?<code>python -m http\.server 8000<\/code>/g,
        () => '<strong>Note:</strong> This lesson is not embedded in this build. ' +
              'Rebuild from a full clone, or download the current offline edition ' +
              'from the project’s Releases page.');

    if (html === before) {
        console.error('NOTE: the loader\'s "run a web server" notices were not found. ' +
                      'If their wording changed, update tools/build-standalone.js.');
    }
    const leftovers = (html.match(/python -m http\.server|localhost:8000/g) || []).length;
    if (leftovers) {
        console.error('WARNING: ' + leftovers + ' reference(s) to running a web server ' +
                      'survived into the standalone file.');
    }
}

// Mark the build so a reader can tell which file they have.
const stamp = new Date().toISOString().slice(0, 10);
html = html.replace(/<title>([^<]*)<\/title>/,
    '<title>$1</title>\n    <meta name="generator" content="EE_Review standalone build ' +
    stamp + ', ' + lessonCount + ' lessons">');

// ---------------------------------------------------------------- write

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
const total = Buffer.byteLength(html);

console.log('wrote ' + path.relative(ROOT, OUT));
console.log('  lessons   ' + String(lessonCount).padStart(5) + '   ' + mb(lessonBytes));
console.log('  assets              ' + kb(assetBytes));
console.log('  mathjax             ' + (mathBytes ? kb(mathBytes) : 'not embedded'));
console.log('  ------------------------------');
console.log('  total               ' + mb(total));
console.log('\nOpen it by double-clicking. No server needed.');
