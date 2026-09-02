#!/usr/bin/env node
/**
 * LAYOUT INVARIANTS THAT A LATER RULE CAN SILENTLY UNDO
 *
 * The phone layout was broken for a long time by one line:
 *
 *     #sidebar, #main, .main-content { position: relative; z-index: 1; }
 *
 * It was added with the theme, and it sits AFTER the `max-width: 980px` block
 * that gives the sidebar `position: fixed` so it can slide off-canvas. At equal
 * specificity a later rule wins, so on every phone the sidebar went back into
 * the flex flow and kept its full 300px while being translated out of sight.
 * The lesson got 91 pixels of a 390px screen - one word per line - and nothing
 * anywhere reported a problem.
 *
 * That class of bug is invisible to every other check here: the CSS is valid,
 * the markup is valid, and the page renders. It is only wrong.
 *
 * So this asserts a few things about the stylesheet that must remain true, and
 * says why each one matters. It is deliberately small - a general CSS cascade
 * simulator would be a different project - and every rule below is a defect
 * that actually happened or a guard that actually prevents one.
 *
 *   node tools/check-css.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);

// Comments are stripped before anything is matched. The first version of this
// tool reported its OWN explanatory comment - which names #sidebar and quotes
// `position: relative` while describing the bug - as an instance of the bug.
// Replaced with blanks rather than removed so byte offsets stay meaningful.
const RAW = fs.readFileSync(path.join(ROOT, 'assets/styles.css'), 'utf8');
const CSS = RAW.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const findings = [];
const ok = [];

/** Where does the mobile block start and end? */
function mediaBlock(query) {
    const at = CSS.indexOf('@media ' + query);
    if (at === -1) return null;
    let depth = 0, i = CSS.indexOf('{', at);
    if (i === -1) return null;
    for (let j = i; j < CSS.length; j++) {
        if (CSS[j] === '{') depth++;
        else if (CSS[j] === '}') { depth--; if (depth === 0) return { start: at, end: j }; }
    }
    return null;
}

// ---------------------------------------------------------------------------
// 1. Nothing after the mobile block may re-position the sidebar.
// ---------------------------------------------------------------------------
const mobile = mediaBlock('(max-width: 980px)');
if (!mobile) {
    findings.push({
        id: 'NO MOBILE BLOCK',
        detail: 'The `@media (max-width: 980px)` block is gone. That block is what ' +
                'takes the 300px sidebar out of the flow on a phone.'
    });
} else {
    const after = CSS.slice(mobile.end);
    // A rule that names #sidebar outside a media query and sets `position`.
    const re = /(^|\})([^{}]*#sidebar[^{}]*)\{([^}]*)\}/g;
    let m, offenders = [];
    while ((m = re.exec(after)) !== null) {
        const selector = m[2].trim();
        const body = m[3];
        // A pseudo-element is a separate box. `#sidebar::after { position: ... }`
        // positions the decoration, not the sidebar, and is not this bug.
        if (/#sidebar\s*::?[a-z-]+/.test(selector)) continue;
        if (/(^|;|\s)position\s*:/.test(body)) {
            // Inside a later @media of its own is fine; only bare rules win
            // unconditionally. Approximate by checking for an unclosed @media
            // before this point.
            const before = after.slice(0, m.index);
            const opens = (before.match(/@media[^{]*\{/g) || []).length;
            const closes = (before.match(/\}/g) || []).length;
            if (opens <= closes) offenders.push(selector.replace(/\s+/g, ' '));
        }
    }
    if (offenders.length) {
        findings.push({
            id: 'SIDEBAR RE-POSITIONED AFTER THE MOBILE BLOCK',
            detail: 'These rules set `position` on #sidebar after the media query that ' +
                    'makes it fixed, and win at equal specificity:\n        ' +
                    offenders.join('\n        ') +
                    '\n      This is exactly the line that gave phones a 91px lesson. ' +
                    'Scope it to #content, or put it inside the media query.'
        });
    } else {
        ok.push('nothing re-positions #sidebar after the mobile block');
    }

    if (!/#sidebar\s*\{[^}]*position\s*:\s*fixed/.test(CSS.slice(mobile.start, mobile.end))) {
        findings.push({
            id: 'SIDEBAR NOT FIXED ON MOBILE',
            detail: 'The mobile block no longer gives #sidebar `position: fixed`, so it ' +
                    'will take its full width out of the content area on a phone.'
        });
    } else {
        ok.push('#sidebar is position:fixed inside the mobile block');
    }
}

// ---------------------------------------------------------------------------
// 2. The phone block's overflow guards must survive.
//    691 of 957 tables are not inside a .table-wrap and 196 of 502 canvases are
//    not inside a .canvas-wrap, so these element-level rules are the only thing
//    stopping wide content being clipped off the side of a phone.
// ---------------------------------------------------------------------------
const phone = mediaBlock('(max-width: 760px)');
if (!phone) {
    findings.push({
        id: 'NO PHONE BLOCK',
        detail: 'The `@media (max-width: 760px)` block is gone. It carries the rules that ' +
                'let wide tables scroll and scale oversized canvases and SVGs.'
    });
} else {
    const body = CSS.slice(phone.start, phone.end);
    const need = [
        [/#lesson-content\s+table\s*\{[^}]*overflow-x\s*:\s*auto/,
         'tables scroll instead of losing their right-hand columns'],
        [/#lesson-content[^{]*canvas[^{]*\{[^}]*max-width\s*:\s*100%/,
         'oversized canvases scale down'],
        [/font-size\s*:\s*16px/,
         'inputs are 16px, below which iOS Safari zooms the page and stays zoomed']
    ];
    need.forEach(([re, why]) => {
        if (re.test(body)) ok.push(why);
        else findings.push({ id: 'PHONE GUARD MISSING', detail: why });
    });
}

// ---------------------------------------------------------------------------
// 3. The viewport meta must not disable pinch-zoom.
//    A dense schematic on a phone is unreadable without it.
// ---------------------------------------------------------------------------
const vp = /<meta[^>]*name="viewport"[^>]*>/i.exec(INDEX);
if (!vp) {
    findings.push({ id: 'NO VIEWPORT META', detail: 'index.html has no viewport meta tag.' });
} else if (/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/.test(vp[0])) {
    findings.push({
        id: 'PINCH-ZOOM DISABLED',
        detail: 'The viewport meta blocks zooming. Reading a dense schematic on a phone ' +
                'depends on it.'
    });
} else {
    ok.push('pinch-zoom is not disabled');
}

// ---------------------------------------------------------------------------
// 4. The drawer must still be dismissible.
// ---------------------------------------------------------------------------
if (/sidebar-backdrop/.test(CSS) && /sidebar-backdrop/.test(INDEX)) {
    ok.push('the mobile drawer has a backdrop to tap');
} else {
    findings.push({
        id: 'NO DRAWER BACKDROP',
        detail: 'Without it the drawer can only be closed with the button that opened it.'
    });
}

// ---------------------------------------------------------------------------

console.log(ok.length + ' layout invariants hold');
ok.forEach(o => console.log('    ' + o));

if (!findings.length) {
    console.log('\nPASS - the layout rules that were hard to find are still in place.');
    process.exit(0);
}

console.log('\n' + findings.length + ' FINDINGS\n');
findings.forEach(f => console.log('  ' + f.id + '\n      ' + f.detail + '\n'));
process.exit(1);
