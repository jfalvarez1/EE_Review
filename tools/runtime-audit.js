/**
 * RUNTIME CONTROL AUDIT - paste into the browser console on the course page.
 *
 * The static checkers in this directory read source. This one drives the real
 * thing: it loads all 369 lessons through the app's own router, moves every
 * slider, select and checkbox, and asks whether ANYTHING on the page changed.
 * That is the only way to catch the defect this course kept producing - a
 * control that is wired up, fires its handler, and changes nothing observable.
 *
 *   Open the course, open the console, paste this file, then:
 *       RuntimeAudit.run().then(RuntimeAudit.report)
 *
 * It takes about ten minutes. Progress is on RuntimeAudit.state.
 *
 * ---------------------------------------------------------------------------
 * THREE THINGS THIS HARNESS GOT WRONG FIRST, ALL OF WHICH PRODUCED CONFIDENT
 * FALSE POSITIVES. They are fixed below and written down because each one is
 * easy to reintroduce:
 *
 * 1. It slept with the page's setTimeout. The router deliberately cancels any
 *    timer created in a previous navigation generation, so lesson animations
 *    cannot outlive their lesson - which meant this harness's own pending
 *    sleep was cancelled by the first navigation and it awaited a promise
 *    that could never resolve. It borrows a timer from a blank iframe now.
 *
 * 2. It set checkbox.checked and then dispatched a click. A click on a
 *    checkbox toggles it, so the harness undid its own change before
 *    measuring, and reported 73 working checkboxes as dead. Click alone.
 *
 * 3. It switched a select to only ONE alternative option. A widget whose
 *    output happens to coincide for two adjacent options looked dead. Every
 *    option gets tried.
 *
 * And one thing that is NOT a defect, which the first run wrongly flagged:
 * a control with no change-listener sitting next to a Calculate button is
 * button-driven by design. Check for the button before calling it broken.
 * ------------------------------------------------------------------------ */

window.RuntimeAudit = (function () {
    'use strict';

    const state = { results: [], errors: [], current: null, done: [] };

    // A timer the router's generation-scoped cleanup cannot cancel.
    let sleep;
    (function () {
        let f = document.getElementById('__runtime_audit_timer');
        if (!f) {
            f = document.createElement('iframe');
            f.id = '__runtime_audit_timer';
            f.style.display = 'none';
            document.body.appendChild(f);
        }
        const t = f.contentWindow.setTimeout.bind(f.contentWindow);
        sleep = ms => new Promise(r => t(r, ms));
    })();

    window.addEventListener('error', e => state.errors.push({
        lesson: state.current, msg: String(e.message),
        src: (e.filename || '').split('/').pop(), line: e.lineno
    }));

    /**
     * Fingerprint of everything a control could plausibly change: canvas
     * pixels, all rendered text, SVG node count, class names (so a widget
     * that only toggles a CSS class still counts), checkbox state, and
     * localStorage (so a checklist that only persists still counts).
     */
    function snap() {
        const root = document.getElementById('lesson-content');
        const parts = [];
        root.querySelectorAll('canvas').forEach(cv => {
            let h = 2166136261;
            try {
                const d = cv.getContext('2d', { willReadFrequently: true })
                            .getImageData(0, 0, cv.width, cv.height).data;
                for (let i = 0; i < d.length; i += 401) { h ^= d[i]; h = Math.imul(h, 16777619); }
            } catch (e) { h = -1; }
            parts.push(cv.id + ':' + h);
        });
        const text = root.textContent.replace(/\s+/g, '');
        parts.push('T:' + text.length + ':' +
            text.slice(0, 40000).split('')
                .reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) | 0, 7));
        parts.push('S:' + root.querySelectorAll('svg *').length);
        parts.push('C:' + Array.from(root.querySelectorAll('[class]'))
            .map(e => e.className).join('').length);
        root.querySelectorAll('input[type=checkbox]')
            .forEach((c, i) => parts.push(i + (c.checked ? '1' : '0')));
        let ls = '';
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                ls += k + '=' + (localStorage.getItem(k) || '').length + ';';
            }
        } catch (e) {}
        return parts.join('|') + '|LS:' + ls;
    }

    async function loadLesson(m, l) {
        state.current = 'M' + m + '-' + l;
        const want = CURRICULUM.getLesson(m, l);
        if (!want) return false;
        const target = '#module-' + m + '/lesson-' + l;
        if (location.hash === target) Router.loadLesson(m, l); else location.hash = target;
        for (let i = 0; i < 80; i++) {
            await sleep(25);
            const bc = document.querySelector('#breadcrumb .breadcrumb-lesson');
            const body = document.querySelector('#lesson-content .card, #lesson-content .lesson-content');
            if (bc && bc.textContent === want.title && body) { await sleep(160); return true; }
        }
        return false;
    }

    // Exercise inputs belong to the answer machinery, not to a widget.
    const controls = () => Array.from(document.querySelectorAll(
            '#lesson-content input[type=range], #lesson-content select, ' +
            '#lesson-content input[type=checkbox]'))
        .filter(el => !el.closest('.problem, .pset, .lab, .checkpoint, details'));

    const fire = el => {
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    };

    /** True if moving this control changed anything at all. */
    async function movesAnything(el) {
        const base = snap();
        const orig = { v: el.value, c: el.checked };
        let moved = false;

        if (el.type === 'checkbox') {
            el.click();                       // click alone: it toggles AND fires
            await sleep(200);
            moved = snap() !== base;
            if (el.checked !== orig.c) el.click();
            return moved;
        }

        const values = el.tagName === 'SELECT'
            ? Array.from(el.options).map(o => o.value).filter(v => v !== orig.v)
            : (function () {
                  const lo = parseFloat(el.min), hi = parseFloat(el.max);
                  if (!isFinite(lo) || !isFinite(hi) || lo === hi) return [];
                  return [lo, hi, (lo + hi) / 2].filter(v => v !== parseFloat(orig.v));
              })();

        for (const v of values) {
            el.value = v;
            fire(el);
            await sleep(120);
            if (snap() !== base) { moved = true; break; }
        }
        el.value = orig.v; el.checked = orig.c;
        fire(el);
        return moved;
    }

    /**
     * A control with no listener is fine if a button applies it. Look for one
     * in the lesson before calling anything dead.
     */
    const hasApplyButton = () =>
        !!document.querySelector('#lesson-content button[onclick], #lesson-content button[id]');

    async function auditLesson(m, l) {
        if (!(await loadLesson(m, l))) {
            state.results.push({ id: 'M' + m + '-' + l, load: 'FAILED' });
            return;
        }
        const els = controls();
        const dead = [];
        for (const el of els) {
            try {
                if (!(await movesAnything(el))) {
                    dead.push((el.id || el.name || el.tagName.toLowerCase()) +
                              '[' + (el.type || 'select') + ']');
                }
            } catch (e) {
                dead.push((el.id || '?') + '[THREW: ' + e.message + ']');
            }
        }
        state.results.push({
            id: 'M' + m + '-' + l, controls: els.length, dead,
            buttonDriven: dead.length ? hasApplyButton() : false
        });
    }

    async function run(moduleIds) {
        state.results.length = 0; state.errors.length = 0; state.done.length = 0;
        const ids = moduleIds || CURRICULUM.modules.map(m => m.id);
        for (const id of ids) {
            const mod = CURRICULUM.getModule(id);
            if (!mod) continue;
            for (const les of mod.lessons) await auditLesson(id, les.id);
            state.done.push(id);
        }
        return state;
    }

    function report() {
        const withDead = state.results.filter(r => r.dead && r.dead.length);
        const certain = withDead.filter(r => !r.buttonDriven);
        const maybe = withDead.filter(r => r.buttonDriven);

        console.log('lessons audited      : ' + state.results.length);
        console.log('controls exercised   : ' +
                    state.results.reduce((n, r) => n + (r.controls || 0), 0));
        console.log('failed to load       : ' +
                    state.results.filter(r => r.load === 'FAILED').length);
        console.log('page errors          : ' + state.errors.length);
        console.log('\nCONTROLS THAT CHANGE NOTHING, with no button to apply them:');
        certain.forEach(r => console.log('  ' + r.id + '  ' + r.dead.join(', ')));
        console.log('\nSame, but the lesson has a button - probably by design, check:');
        maybe.forEach(r => console.log('  ' + r.id + '  ' + r.dead.join(', ')));
        return { certain, maybe, errors: state.errors };
    }

    return { run, report, state, snap, loadLesson, movesAnything };
})();
