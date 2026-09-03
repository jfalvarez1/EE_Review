#!/usr/bin/env node
/**
 * stamp-build - write a content-derived BUILD_ID into index.html.
 *
 * Why this exists
 * ---------------
 * Lessons are fetched by XHR at runtime, and a static host - GitHub Pages
 * included - serves them with ordinary caching headers. After an update a
 * returning reader keeps getting the OLD lesson out of cache while the assets
 * around it are new. The symptom is a lesson that refers to figures which no
 * longer exist, and it looks exactly like the update never happened.
 *
 * So every lesson fetch carries ?v=BUILD_ID. The browser refetches once per
 * release and caches normally in between.
 *
 * The ID is a hash of the content it protects, not a timestamp, so:
 *   - it is identical for everyone who checks out the same commit
 *   - it changes if and only if something actually changed
 *   - check-build-id can recompute it and fail when it is stale, which means
 *     nobody has to remember to run this
 *
 * Run: node tools/stamp-build.js        (writes)
 *      node tools/stamp-build.js --check (exit 1 if stale; used by the audit)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.dirname(__dirname);
const INDEX = path.join(ROOT, 'index.html');

// Everything a cached lesson could disagree with.
const WATCH = [
    { dir: path.join(ROOT, 'lessons'), ext: '.html' },
    { dir: path.join(ROOT, 'assets'), ext: '.js' },
    { dir: path.join(ROOT, 'assets'), ext: '.css' },
    { dir: path.join(ROOT, 'docs', 'data', 'boards'), ext: '.json' }
];

function walk(dir, ext, out) {
    if (!fs.existsSync(dir)) return out;
    fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
        const p = path.join(dir, e.name);
        // vendor/ is a third-party blob that never changes with the course.
        if (e.isDirectory()) { if (e.name !== 'vendor') walk(p, ext, out); }
        else if (e.name.endsWith(ext)) out.push(p);
    });
    return out;
}

function computeId() {
    const files = [];
    WATCH.forEach(w => walk(w.dir, w.ext, files));
    files.sort();

    const h = crypto.createHash('sha1');
    files.forEach(f => {
        // Normalise line endings, so a CRLF checkout and an LF one agree.
        const body = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
        h.update(path.relative(ROOT, f).replace(/\\/g, '/'));
        h.update('\0');
        h.update(body);
        h.update('\0');
    });
    return h.digest('hex').slice(0, 10);
}

const TAG = /(<script>\s*window\.BUILD_ID\s*=\s*')([0-9a-f]*)('\s*;\s*<\/script>)/;

/**
 * The lessons were only half the problem.
 *
 * index.html itself is revalidated often, but the assets it points at are
 * fetched once and kept. So a reader could hold a months-old widgets.js while
 * receiving today's lesson, and the failure is the worst kind: the lesson calls
 * a widget option the cached code has never heard of, the widget renders
 * something almost right, and nothing anywhere reports an error.
 *
 * Stamping the same content hash onto every local asset URL fixes it with the
 * cache still doing its job - one refetch per release, normal caching in
 * between. Third-party files under assets/vendor/ are left alone: they are
 * pinned blobs that do not change with the course.
 */
function stampAssets(html, id) {
    return html.replace(
        /((?:src|href)="assets\/(?!vendor\/)[A-Za-z0-9._\/-]+\.(?:js|css))(?:\?v=[0-9a-f]+)?(")/g,
        (_, head, tail) => head + '?v=' + id + tail);
}

const want = computeId();
let html = fs.readFileSync(INDEX, 'utf8');
const m = TAG.exec(html);
const have = m ? m[2] : null;
const assetsStale = stampAssets(html, want) !== html;

if (process.argv.includes('--check')) {
    if (!m) {
        console.log('FAIL - index.html has no BUILD_ID stamp. Run: node tools/stamp-build.js');
        process.exit(1);
    }
    if (have !== want) {
        console.log('FAIL - BUILD_ID is stale (' + have + ' on disk, content hashes to ' +
                    want + ').');
        console.log('       Lessons are fetched by XHR and cached, so readers would get');
        console.log('       the old lesson against the new assets. Run:');
        console.log('           node tools/stamp-build.js');
        process.exit(1);
    }
    if (assetsStale) {
        console.log('FAIL - some assets/ URLs are not stamped with ' + want + '.');
        console.log('       A cached widgets.js against a new lesson fails silently.');
        console.log('       Run: node tools/stamp-build.js');
        process.exit(1);
    }
    console.log('PASS - BUILD_ID ' + have + ' matches the content it protects.');
    process.exit(0);
}

if (!m) {
    console.error('index.html has no BUILD_ID stamp to update. Expected a line like:');
    console.error("    <script>window.BUILD_ID = '0000000000';</script>");
    process.exit(1);
}

if (have === want && !assetsStale) {
    console.log('BUILD_ID already current: ' + want);
    process.exit(0);
}

html = stampAssets(html.replace(TAG, '$1' + want + '$3'), want);
fs.writeFileSync(INDEX, html);
console.log('BUILD_ID ' + (have || '(none)') + ' -> ' + want +
            (assetsStale ? '  (asset URLs restamped)' : ''));
