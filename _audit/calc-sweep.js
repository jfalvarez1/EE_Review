/**
 * Calculator sweep - development tool, not shipped with a lesson.
 *
 * Drives every control in the lesson pane to its extremes and reports any
 * readout that comes back as NaN, Infinity, undefined or null. Those are the
 * failures a screenshot never catches: the graph still draws, the panel still
 * has numbers in it, and one cell quietly says NaN.
 *
 * Usage in the running app:
 *     __sweepPage()          // every control, min/max/mid/empty
 *     __sweepPage({quick:1}) // min and max only
 */
(function () {
    'use strict';

    var BAD = /\b(NaN|Infinity|-Infinity|undefined|null)\b/;

    function fire(el) {
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        recalc();
    }

    /**
     * Some calculators only run on a Calculate button, so changing an input
     * alone proves nothing. Press those after every change - otherwise the
     * sweep reports a clean pass on a panel it never actually recomputed.
     */
    function recalc() {
        var host = document.getElementById('lesson-content');
        if (!host) return;
        var btns = host.querySelectorAll('button[onclick]');
        for (var i = 0; i < btns.length; i++) {
            var on = btns[i].getAttribute('onclick') || '';
            // Only recompute buttons: never "reset", "next", "show answer".
            if (!/calc|update|compute|solve|run/i.test(on)) continue;
            try { btns[i].click(); } catch (e) {}
        }
    }

    function readouts() {
        var host = document.getElementById('lesson-content');
        if (!host) return '';
        // Only the computed output regions, not the prose: a lesson may
        // legitimately discuss NaN, and flagging its own explanation of the
        // problem would make the sweep useless.
        var sel = '.results, .result, .kv, .readout, .output, [id$="-results"],' +
                  '[id$="-result"], [id$="-out"], [id$="-val"], .v, .metric';
        var nodes = host.querySelectorAll(sel);
        var s = '';
        for (var i = 0; i < nodes.length; i++) s += ' ' + (nodes[i].textContent || '');
        return s;
    }

    // Ranges are written the way the lessons write values - "1k", "100p",
    // "10G" - so they must go through the same parser the calculators use.
    // parseFloat("1k") is 1, which made the sweep test a value a thousand
    // times below the declared minimum and report a failure the app cannot
    // actually reach.
    function bound(el, attr) {
        var raw = el.getAttribute(attr);
        if (raw === null) return NaN;
        return (window.AD && AD.parseNumValue) ? AD.parseNumValue(raw) : parseFloat(raw);
    }

    function valuesFor(el, quick) {
        var lo = bound(el, 'min');
        var hi = bound(el, 'max');
        var out = [];
        if (el.tagName === 'SELECT') {
            for (var i = 0; i < el.options.length; i++) out.push(el.options[i].value);
            return out;
        }
        if (isFinite(lo)) out.push(String(lo));
        if (isFinite(hi)) out.push(String(hi));
        if (!quick && isFinite(lo) && isFinite(hi)) out.push(String((lo + hi) / 2));
        if (!quick) out.push('');          // cleared field
        if (!out.length) out = ['0', '1', ''];
        return out;
    }

    window.__sweepPage = function (opts) {
        opts = opts || {};
        var host = document.getElementById('lesson-content');
        if (!host) return { error: 'no lesson-content' };
        var ctrls = host.querySelectorAll('input[type=range], input[type=number], input[type=text], select');
        var problems = [];
        var tested = 0;

        for (var i = 0; i < ctrls.length; i++) {
            var el = ctrls[i];
            if (!el.id) continue;
            var original = el.value;
            var vals = valuesFor(el, opts.quick);
            for (var v = 0; v < vals.length; v++) {
                el.value = vals[v];
                try { fire(el); } catch (e) {
                    problems.push({ id: el.id, value: vals[v], kind: 'THREW', detail: String(e) });
                    continue;
                }
                tested++;
                var text = readouts();
                var m = text.match(BAD);
                if (m) {
                    problems.push({ id: el.id, value: vals[v], kind: m[0],
                                    detail: text.replace(/\s+/g, ' ').trim().slice(0, 180) });
                }
            }
            el.value = original;
            try { fire(el); } catch (e) {}
        }
        return { controls: ctrls.length, combos: tested, problems: problems };
    };
})();
