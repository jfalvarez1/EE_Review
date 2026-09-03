/**
 * DesignBriefWidget - the reader designs it, and the design gets checked.
 *
 * Why this exists
 * ---------------
 * A survey of the course found 58% of lessons asked the reader to do nothing
 * at all, and only 7% gave any way to tell whether an answer was right. That
 * makes a knowledge base, not an engineer. The claim this course wants to make
 * is that by the end you will HAVE DESIGNED things - so there has to be
 * something that takes your numbers and tells you, with reasons, whether they
 * work.
 *
 * The shape is deliberately "a team of engineers next to you": it answers when
 * asked, guides in steps rather than all at once, and makes you commit to an
 * answer before it tells you anything.
 *
 *   - You get a BRIEF with real targets and the constraints you must respect.
 *   - You enter YOUR values. Nothing is revealed until you check them.
 *   - Every criterion is judged separately, and a failure says what physically
 *     goes wrong - not "incorrect".
 *   - Hints come one at a time, on request, and asking is recorded but not
 *     punished.
 *   - The worked approach unlocks after an attempt, so it is a comparison
 *     rather than a substitute.
 *
 * Usage:
 *
 *   new DesignBriefWidget('host-id', {
 *       id: 'led-driver',
 *       title: 'Design the LED driver',
 *       brief: 'Drive one LED at 20 mA from a 12 V rail...',
 *       given: [ {label: 'Supply', value: '12 V'}, ... ],
 *       inputs: [ {id:'R', label:'Series resistor', unit:'Ω', hint:'nearest E24'} ],
 *       hints: [ 'What voltage is across the resistor?', ... ],
 *       // Return one entry per criterion. `pass` decides; `why` is shown when
 *       // it fails, `note` when it passes.
 *       check: function (v) {
 *           return [ {name:'LED current', pass: ..., got: ..., want: ..., why: ...} ];
 *       },
 *       approach: [ {step:'...', detail:'...'}, ... ],
 *       solution: 'A 470 Ohm 1/4 W resistor...'
 *   });
 */
(function () {
    'use strict';

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // Accept 4k7, 4.7k, 4700, 1M, 100n, 2u2 - the way engineers actually type.
    var SUFFIX = { p: 1e-12, n: 1e-9, u: 1e-6, µ: 1e-6, m: 1e-3,
                   k: 1e3, K: 1e3, M: 1e6, G: 1e9, R: 1 };

    function parseValue(raw) {
        if (raw == null) return NaN;
        var s = String(raw).trim().replace(/\s+/g, '').replace(/,/g, '');
        if (!s) return NaN;
        // Strip a trailing unit letter that is not a multiplier.
        s = s.replace(/(ohms?|Ω|F|H|Hz|A|V|W|s)$/i, '');
        if (!s) return NaN;

        // 4k7 / 2u2 / 1R5 - the multiplier stands in for the decimal point.
        var infix = /^(-?\d*)([pnuµmkKMGR])(\d*)$/.exec(s);
        if (infix) {
            var whole = infix[1] || '0';
            var frac = infix[3] || '';
            var num = parseFloat(whole + (frac ? '.' + frac : ''));
            return num * SUFFIX[infix[2]];
        }

        var suffixed = /^(-?\d+(?:\.\d+)?)([pnuµmkKMGR])$/.exec(s);
        if (suffixed) return parseFloat(suffixed[1]) * SUFFIX[suffixed[2]];

        var plain = parseFloat(s);
        return isFinite(plain) ? plain : NaN;
    }

    function storageKey(id) { return 'design:' + id; }

    function loadState(id) {
        try {
            var raw = localStorage.getItem(storageKey(id));
            return raw ? JSON.parse(raw) : {};
        } catch (e) { return {}; }
    }

    function saveState(id, state) {
        try { localStorage.setItem(storageKey(id), JSON.stringify(state)); }
        catch (e) { /* private mode: the widget still works, it just forgets */ }
    }

    /** Every completed design, for the portfolio view. */
    function completedDesigns() {
        var out = [];
        try {
            for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i);
                if (k && k.indexOf('design:') === 0) {
                    var s = JSON.parse(localStorage.getItem(k) || '{}');
                    if (s.passed) out.push({ id: k.slice(7), at: s.passedAt || null,
                                             attempts: s.attempts || 0,
                                             hintsUsed: s.hintsUsed || 0 });
                }
            }
        } catch (e) { /* ignore */ }
        return out;
    }

    function DesignBriefWidget(host, opts) {
        this.host = typeof host === 'string' ? document.getElementById(host) : host;
        if (!this.host) return;
        this.o = opts || {};
        this.id = this.o.id || (this.host.id || 'design');
        this.state = loadState(this.id);
        this.hintsShown = 0;
        this.attempted = !!this.state.attempts;
        this.render();
    }

    DesignBriefWidget.prototype.render = function () {
        var o = this.o, self = this;
        var st = this.state;

        var givenHtml = (o.given || []).map(function (g) {
            return '<div class="db-given"><span class="db-given-k">' + esc(g.label) +
                   '</span><span class="db-given-v">' + esc(g.value) + '</span></div>';
        }).join('');

        var inputsHtml = (o.inputs || []).map(function (f) {
            var saved = (st.values && st.values[f.id] != null) ? st.values[f.id] : '';
            return '<label class="db-field">' +
                   '<span class="db-field-label">' + esc(f.label) +
                   (f.unit ? ' <span class="db-unit">(' + esc(f.unit) + ')</span>' : '') +
                   '</span>' +
                   '<input type="text" class="db-input" data-field="' + esc(f.id) + '" ' +
                   'value="' + esc(saved) + '" ' +
                   'placeholder="' + esc(f.placeholder || '') + '" ' +
                   'autocomplete="off" spellcheck="false">' +
                   (f.hint ? '<span class="db-field-hint">' + esc(f.hint) + '</span>' : '') +
                   '</label>';
        }).join('');

        var nHints = (o.hints || []).length;

        this.host.className = 'design-brief' + (st.passed ? ' db-solved' : '');
        this.host.innerHTML =
            '<div class="db-head">' +
                '<span class="db-tag">Design task</span>' +
                '<h4 class="db-title">' + esc(o.title || 'Design brief') + '</h4>' +
                (st.passed ? '<span class="db-badge">Completed</span>' : '') +
            '</div>' +
            '<div class="db-brief">' + (o.brief || '') + '</div>' +
            (givenHtml ? '<div class="db-givens">' + givenHtml + '</div>' : '') +
            '<div class="db-fields">' + inputsHtml + '</div>' +
            '<div class="db-actions">' +
                '<button type="button" class="db-check primary">Check my design</button>' +
                (nHints ? '<button type="button" class="db-hint">Ask for a hint' +
                          ' <span class="db-hint-count">(' + nHints + ')</span></button>' : '') +
                '<button type="button" class="db-approach"' +
                    (this.attempted ? '' : ' disabled title="Have a go first"') +
                    '>How an engineer would approach it</button>' +
            '</div>' +
            '<div class="db-hints"></div>' +
            '<div class="db-results"></div>' +
            '<div class="db-approach-body" hidden></div>';

        this.host.querySelector('.db-check')
            .addEventListener('click', function () { self.check(); });

        var hintBtn = this.host.querySelector('.db-hint');
        if (hintBtn) hintBtn.addEventListener('click', function () { self.nextHint(); });

        this.host.querySelector('.db-approach')
            .addEventListener('click', function () { self.showApproach(); });

        // Enter in any field checks, the way a calculator would.
        this.host.querySelectorAll('.db-input').forEach(function (el) {
            el.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') { e.preventDefault(); self.check(); }
            });
        });

        if (st.passed) this.check(true);
    };

    DesignBriefWidget.prototype.values = function () {
        var v = {}, raw = {};
        this.host.querySelectorAll('.db-input').forEach(function (el) {
            var k = el.getAttribute('data-field');
            raw[k] = el.value;
            v[k] = parseValue(el.value);
        });
        this._raw = raw;
        return v;
    };

    DesignBriefWidget.prototype.nextHint = function () {
        var hints = this.o.hints || [];
        if (this.hintsShown >= hints.length) return;
        var box = this.host.querySelector('.db-hints');
        var i = this.hintsShown++;
        var d = document.createElement('div');
        d.className = 'db-hint-item';
        d.innerHTML = '<span class="db-hint-n">' + (i + 1) + '</span><span>' + hints[i] + '</span>';
        box.appendChild(d);

        this.state.hintsUsed = Math.max(this.state.hintsUsed || 0, this.hintsShown);
        saveState(this.id, this.state);

        var btn = this.host.querySelector('.db-hint');
        var left = hints.length - this.hintsShown;
        if (left <= 0) { btn.disabled = true; btn.textContent = 'No more hints'; }
        else btn.querySelector('.db-hint-count').textContent = '(' + left + ')';
    };

    DesignBriefWidget.prototype.check = function (silent) {
        var o = this.o;
        var v = this.values();
        var box = this.host.querySelector('.db-results');

        var missing = (o.inputs || []).filter(function (f) {
            return !isFinite(v[f.id]);
        });
        if (missing.length) {
            box.innerHTML = '<div class="db-verdict db-incomplete">Fill in ' +
                missing.map(function (f) { return '<strong>' + esc(f.label) + '</strong>'; })
                       .join(', ') +
                ' and check again. Values like <span class="mono">4k7</span>, ' +
                '<span class="mono">4.7k</span> or <span class="mono">4700</span> all work.</div>';
            return;
        }

        var results;
        try {
            results = o.check ? o.check(v, this._raw) : [];
        } catch (e) {
            box.innerHTML = '<div class="db-verdict db-incomplete">Could not evaluate ' +
                            'those values.</div>';
            if (window.console) console.error('DesignBrief check threw:', e);
            return;
        }
        if (!results || !results.length) return;

        var passed = results.every(function (r) { return r.pass; });

        if (!silent) {
            this.state.attempts = (this.state.attempts || 0) + 1;
            this.state.values = this._raw;
            this.attempted = true;
            var ab = this.host.querySelector('.db-approach');
            if (ab) { ab.disabled = false; ab.removeAttribute('title'); }
            if (passed && !this.state.passed) {
                this.state.passed = true;
                this.state.passedAt = new Date().toISOString().slice(0, 10);
            }
            saveState(this.id, this.state);
        }

        var rows = results.map(function (r) {
            var cls = r.pass ? 'db-ok' : 'db-bad';
            return '<div class="db-crit ' + cls + '">' +
                   '<span class="db-crit-mark">' + (r.pass ? '&#10003;' : '&#10007;') + '</span>' +
                   '<div class="db-crit-body">' +
                     '<div class="db-crit-name">' + esc(r.name) + '</div>' +
                     (r.got != null || r.want != null
                        ? '<div class="db-crit-nums">' +
                          (r.got != null ? 'yours: <strong>' + esc(r.got) + '</strong>' : '') +
                          (r.want != null ? '<span class="db-crit-sep">·</span>needs: <strong>' +
                                            esc(r.want) + '</strong>' : '') +
                          '</div>'
                        : '') +
                     ((!r.pass && r.why) ? '<div class="db-crit-why">' + r.why + '</div>' : '') +
                     ((r.pass && r.note) ? '<div class="db-crit-note">' + r.note + '</div>' : '') +
                   '</div></div>';
        }).join('');

        var nFail = results.filter(function (r) { return !r.pass; }).length;
        var verdict = passed
            ? '<div class="db-verdict db-pass"><strong>This design works.</strong> ' +
              'All ' + results.length + ' criteria met' +
              (this.state.attempts > 1 ? ' after ' + this.state.attempts + ' attempts' : '') +
              '. Open the approach below and compare it with how you got there.</div>'
            : '<div class="db-verdict db-fail"><strong>' + nFail + ' of ' + results.length +
              ' criteria not met.</strong> Each one below says what physically goes wrong. ' +
              'Change what needs changing and check again.</div>';

        box.innerHTML = verdict + '<div class="db-crits">' + rows + '</div>';
        this.host.classList.toggle('db-solved', passed);
    };

    DesignBriefWidget.prototype.showApproach = function () {
        var o = this.o;
        var box = this.host.querySelector('.db-approach-body');
        if (!box.hidden) { box.hidden = true; return; }

        var steps = (o.approach || []).map(function (s, i) {
            return '<li><strong>' + esc(s.step) + '</strong>' +
                   (s.detail ? '<div class="db-step-detail">' + s.detail + '</div>' : '') +
                   '</li>';
        }).join('');

        box.innerHTML =
            (steps ? '<ol class="db-steps">' + steps + '</ol>' : '') +
            (o.solution ? '<div class="db-solution"><strong>One good answer:</strong> ' +
                          o.solution + '</div>' : '');
        box.hidden = false;
    };

    DesignBriefWidget.parseValue = parseValue;
    DesignBriefWidget.completed = completedDesigns;

    window.DesignBriefWidget = DesignBriefWidget;

    /* ====================================================================
     * SimCheckWidget - "you simulated it; here is how to know it is right"
     * ====================================================================
     * 168 lessons tell the reader what to build in Circuit Toy and what to
     * watch. Three of them said what they should SEE. That is the same gap
     * most textbooks leave: run the simulation, and it is entirely on you to
     * decide whether the result means anything.
     *
     * So this gives the numbers a correct build produces, with tolerances, and
     * checks what the reader actually measured against them. Then it goes
     * further and asks them to PERTURB it - attach a load here, inject a
     * source there - and states what should happen, because a circuit you have
     * only seen at one operating point is a circuit you do not yet understand.
     *
     *   new SimCheckWidget('host', {
     *       id: 'buck-sim',
     *       intro: 'Run a transient of 2 ms in 1 us steps.',
     *       probes: [
     *           { id:'vout', label:'V(out), settled', expect:1.8, unit:'V',
     *             tol:0.05, why:'Set by the divider: 0.6 x (1 + R2/R3).' }
     *       ],
     *       experiments: [
     *           { action:'Attach a 3.6 ohm load at OUT',
     *             expect:'V(out) sags by under 20 mV and recovers in ~50 us',
     *             why:'That is the loop bandwidth doing its job...' }
     *       ]
     *   });
     */
    function SimCheckWidget(host, opts) {
        this.host = typeof host === 'string' ? document.getElementById(host) : host;
        if (!this.host) return;
        this.o = opts || {};
        this.id = this.o.id || (this.host.id || 'simcheck');
        this.state = loadState('sim:' + this.id);
        this.render();
    }

    SimCheckWidget.prototype.render = function () {
        var o = this.o, self = this, st = this.state;

        var probeRows = (o.probes || []).map(function (p) {
            var saved = (st.values && st.values[p.id] != null) ? st.values[p.id] : '';
            var tolTxt = p.tol != null
                ? (p.tolPct ? '&plusmn;' + (p.tol * 100) + '%' : '&plusmn;' + p.tol + ' ' + (p.unit || ''))
                : '';
            return '<tr>' +
                '<td class="sc-what">' + esc(p.label) +
                    (p.node ? ' <span class="mono sc-node">' + esc(p.node) + '</span>' : '') +
                '</td>' +
                '<td class="sc-expect"><strong>' + esc(p.expect) + '</strong> ' +
                    esc(p.unit || '') + (tolTxt ? ' <span class="sc-tol">' + tolTxt + '</span>' : '') +
                '</td>' +
                '<td class="sc-yours">' +
                    '<input type="text" class="sc-input" data-probe="' + esc(p.id) + '" ' +
                    'value="' + esc(saved) + '" placeholder="what you measured" ' +
                    'autocomplete="off" spellcheck="false">' +
                '</td>' +
                '<td class="sc-mark" data-mark="' + esc(p.id) + '"></td>' +
                '</tr>';
        }).join('');

        var expHtml = (o.experiments || []).map(function (e, i) {
            return '<li class="sc-exp">' +
                '<div class="sc-exp-do"><span class="sc-exp-n">' + (i + 1) + '</span>' +
                    esc(e.action) + '</div>' +
                '<div class="sc-exp-expect"><strong>Expect:</strong> ' + e.expect + '</div>' +
                (e.why ? '<details class="sc-exp-why"><summary>Why</summary>' +
                         '<div>' + e.why + '</div></details>' : '') +
                '</li>';
        }).join('');

        this.host.className = 'sim-check' + (st.passed ? ' sc-solved' : '');
        this.host.innerHTML =
            '<div class="sc-head">' +
                '<span class="sc-tag">Verify it</span>' +
                '<h4 class="sc-title">' + esc(o.title || 'Check your simulation') + '</h4>' +
                (st.passed ? '<span class="sc-badge">Verified</span>' : '') +
            '</div>' +
            (o.intro ? '<div class="sc-intro">' + o.intro + '</div>' : '') +
            (probeRows
                ? '<div class="table-wrap"><table class="data-table sc-table">' +
                  '<thead><tr><th>Measure</th><th>A correct build gives</th>' +
                  '<th>Yours</th><th></th></tr></thead>' +
                  '<tbody>' + probeRows + '</tbody></table></div>' +
                  '<div class="sc-actions">' +
                    '<button type="button" class="sc-check primary">Compare</button>' +
                    '<button type="button" class="sc-why">Why these numbers</button>' +
                  '</div>' +
                  '<div class="sc-verdict"></div>' +
                  '<div class="sc-whys" hidden></div>'
                : '') +
            (expHtml
                ? '<h5 class="sc-exp-head">Then perturb it</h5>' +
                  '<p class="sc-exp-lead">A circuit you have only seen at one ' +
                  'operating point is a circuit you do not yet understand. Each of ' +
                  'these changes one thing and tells you what should happen.</p>' +
                  '<ol class="sc-exps">' + expHtml + '</ol>'
                : '');

        var cb = this.host.querySelector('.sc-check');
        if (cb) cb.addEventListener('click', function () { self.compare(); });
        var wb = this.host.querySelector('.sc-why');
        if (wb) wb.addEventListener('click', function () { self.toggleWhy(); });

        this.host.querySelectorAll('.sc-input').forEach(function (el) {
            el.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') { e.preventDefault(); self.compare(); }
            });
        });
    };

    SimCheckWidget.prototype.toggleWhy = function () {
        var box = this.host.querySelector('.sc-whys');
        if (!box) return;
        if (!box.hidden) { box.hidden = true; return; }
        box.innerHTML = (this.o.probes || []).map(function (p) {
            return '<div class="sc-why-item"><strong>' + esc(p.label) + '</strong> — ' +
                   (p.why || 'No derivation given.') + '</div>';
        }).join('');
        box.hidden = false;
    };

    SimCheckWidget.prototype.compare = function () {
        var o = this.o, self = this;
        var raw = {}, results = [];

        (o.probes || []).forEach(function (p) {
            var el = self.host.querySelector('.sc-input[data-probe="' + p.id + '"]');
            var text = el ? el.value : '';
            raw[p.id] = text;
            var got = parseValue(text);
            var mark = self.host.querySelector('[data-mark="' + p.id + '"]');

            if (!isFinite(got)) {
                if (mark) { mark.textContent = ''; mark.className = 'sc-mark'; }
                results.push({ id: p.id, state: 'blank' });
                return;
            }
            var want = parseValue(p.expect);
            var tol = p.tol != null ? p.tol : Math.abs(want) * 0.05;
            var limit = p.tolPct ? Math.abs(want) * p.tol : tol;
            var ok = Math.abs(got - want) <= limit;

            if (mark) {
                mark.textContent = ok ? '✓' : '✗';
                mark.className = 'sc-mark ' + (ok ? 'sc-ok' : 'sc-bad');
            }
            results.push({ id: p.id, state: ok ? 'ok' : 'bad', got: got, want: want,
                           label: p.label, unit: p.unit || '', why: p.why });
        });

        var filled = results.filter(function (r) { return r.state !== 'blank'; });
        var bad = filled.filter(function (r) { return r.state === 'bad'; });
        var box = this.host.querySelector('.sc-verdict');

        if (!filled.length) {
            box.innerHTML = '<div class="sc-msg sc-none">Enter at least one measurement ' +
                            'from your run and compare again.</div>';
            return;
        }

        this.state.values = raw;
        this.state.passed = filled.length === (o.probes || []).length && !bad.length;
        if (this.state.passed) this.state.passedAt = new Date().toISOString().slice(0, 10);
        saveState('sim:' + this.id, this.state);
        this.host.classList.toggle('sc-solved', !!this.state.passed);

        if (!bad.length) {
            box.innerHTML = '<div class="sc-msg sc-pass"><strong>Your build matches.</strong> ' +
                filled.length + ' of ' + (o.probes || []).length +
                ' measurements are within tolerance, so the circuit on your screen is ' +
                'the circuit this lesson describes. Now go and perturb it.</div>';
            return;
        }

        box.innerHTML = '<div class="sc-msg sc-fail"><strong>' + bad.length +
            ' measurement' + (bad.length === 1 ? ' does' : 's do') + ' not match.</strong> ' +
            'That means the build differs from the one described — a value, a ' +
            'connection, or the run settings. Each one below says what it should be ' +
            'and why.</div>' +
            '<ul class="sc-diffs">' + bad.map(function (r) {
                var off = r.want !== 0 ? ((r.got - r.want) / Math.abs(r.want) * 100) : 0;
                return '<li><strong>' + esc(r.label) + '</strong>: you have ' +
                       r.got + ' ' + esc(r.unit) + ', it should be ' + r.want + ' ' +
                       esc(r.unit) + ' (' + (off > 0 ? '+' : '') + off.toFixed(0) + '%)' +
                       (r.why ? '<div class="sc-diff-why">' + r.why + '</div>' : '') +
                       '</li>';
            }).join('') + '</ul>';
    };

    SimCheckWidget.completed = function () {
        var out = [];
        try {
            for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i);
                if (k && k.indexOf('design:sim:') === 0) {
                    var s = JSON.parse(localStorage.getItem(k) || '{}');
                    if (s.passed) out.push({ id: k.slice(11), at: s.passedAt || null });
                }
            }
        } catch (e) { /* ignore */ }
        return out;
    };

    window.SimCheckWidget = SimCheckWidget;
})();
