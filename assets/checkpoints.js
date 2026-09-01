/**
 * CHECKPOINTS — inline active recall inside a lesson
 *
 * A problem set at the end of a lesson is read, not answered. A checkpoint sits
 * in the middle of the argument and will not tell you the answer until you have
 * committed to one. That difference — retrieval before exposure — is most of
 * what makes a textbook interactive rather than illustrated.
 *
 * WHAT THESE ARE FOR, AND WHAT THEY ARE NOT
 *
 * They are not arithmetic drills. Working the diode equation for the ninth time
 * teaches arithmetic, not electronics. A checkpoint asks the questions a bench
 * asks: which way does this move, why has this stopped working, which of these
 * four would you build, what breaks first if you change that. Numbers appear
 * when a number is the evidence — "is 300 mV of headroom enough here" — not as
 * the exercise itself.
 *
 * Four kinds, in rising order of what they demand:
 *
 *   predict    Commit to a direction before an interactive shows you. Up or
 *              down, bigger or smaller, sooner or later. The cheapest and most
 *              valuable question there is, because being wrong is the moment
 *              you learn something.
 *   choose     Multiple choice where EVERY option carries its own explanation,
 *              including the right one. A wrong answer that just says "wrong"
 *              teaches nothing; a wrong answer that says why you might have
 *              thought that, and what is actually true, teaches more than
 *              getting it right.
 *   diagnose   Here is a circuit and a symptom. What is wrong with it?
 *   design     Here is a specification. Which of these meets it, and what does
 *              the choice cost?
 *
 * MARKUP DRIVEN, BY DESIGN
 *
 * A lesson writes HTML and nothing else — no per-lesson JavaScript, no widget
 * construction, no ids to keep unique. With 368 lessons authored years apart,
 * anything that needs wiring up in each file does not get used. This scans for
 * .checkpoint and enhances whatever it finds:
 *
 *   <div class="checkpoint" data-kind="predict" data-answer="b">
 *     <p class="cp-q">Question text.</p>
 *     <ol class="cp-options">
 *       <li data-k="a">Option text
 *         <div class="cp-why">Why this is tempting, and why it is wrong.</div></li>
 *       <li data-k="b">Option text
 *         <div class="cp-why">Why this is right, and what it means.</div></li>
 *     </ol>
 *     <div class="cp-then">Optional: shown only after answering.</div>
 *   </div>
 *
 * Numeric variants take data-answer plus data-tol (fractional, default 0.05):
 *
 *   <div class="checkpoint" data-kind="value" data-answer="6.2" data-unit="V"
 *        data-tol="0.1" data-why="...">
 *
 * Progress is stored through AD's existing exercise store, so a checkpoint the
 * reader has answered stays answered when they come back.
 *
 * DEGRADING GRACEFULLY: if this file fails to load, every checkpoint is still a
 * readable question with its options and their explanations visible as plain
 * markup. Nothing is hidden by HTML; hiding is applied by this script.
 */

(function () {
    'use strict';

    const KINDS = {
        predict:  { label: 'Predict first', hint: 'Commit before you look.' },
        choose:   { label: 'Check yourself', hint: '' },
        diagnose: { label: 'Diagnose it',    hint: 'Something here does not work.' },
        design:   { label: 'Design choice',  hint: 'More than one could work. One is best.' },
        value:    { label: 'Sanity check',   hint: 'A number, roughly. Order of magnitude counts.' }
    };

    /** Stable id so an answered checkpoint stays answered across visits. */
    function idFor(el, index) {
        const lesson = el.closest('[data-module][data-lesson]');
        const m = lesson ? lesson.getAttribute('data-module') : '?';
        const l = lesson ? lesson.getAttribute('data-lesson') : '?';
        return 'cp-' + m + '-' + l + '-' + index;
    }

    const store = {
        get(id) {
            try { return (window.AD && AD.getExerciseState) ? AD.getExerciseState(id) : null; }
            catch (e) { return null; }
        },
        solved(id) {
            try { if (window.AD && AD.setExerciseSolved) AD.setExerciseSolved(id); }
            catch (e) { /* private browsing, or storage disabled */ }
        },
        tried(id) {
            try { if (window.AD && AD.incrementExerciseAttempts) AD.incrementExerciseAttempts(id); }
            catch (e) { }
        }
    };

    function parseNum(s) {
        if (window.AD && AD.parseNumValue) {
            const v = AD.parseNumValue(s);
            if (isFinite(v)) return v;
        }
        const v = parseFloat(String(s).replace(/[^\d.eE+-]/g, ''));
        return isFinite(v) ? v : NaN;
    }

    function build(el, index) {
        if (el.dataset.cpReady) return;
        el.dataset.cpReady = '1';

        const kind = el.dataset.kind || 'choose';
        const meta = KINDS[kind] || KINDS.choose;
        const id = idFor(el, index);

        // --- header
        const head = document.createElement('div');
        head.className = 'cp-head';
        head.innerHTML = '<span class="cp-kind">' + meta.label + '</span>' +
                         (meta.hint ? '<span class="cp-hint">' + meta.hint + '</span>' : '');
        el.insertBefore(head, el.firstChild);

        const then = el.querySelector('.cp-then');
        if (then) then.hidden = true;

        const feedback = document.createElement('div');
        feedback.className = 'cp-feedback';
        feedback.hidden = true;

        function settle(correct, why) {
            feedback.hidden = false;
            feedback.className = 'cp-feedback ' + (correct ? 'is-right' : 'is-wrong');
            feedback.innerHTML =
                '<strong>' + (correct ? 'Yes.' : 'Not quite.') + '</strong> ' + (why || '');
            if (then) then.hidden = false;
            el.classList.add(correct ? 'cp-correct' : 'cp-incorrect');
            if (correct) store.solved(id); else store.tried(id);
        }

        // ---------------------------------------------------------- numeric
        if (kind === 'value') {
            const target = parseNum(el.dataset.answer);
            const tol = el.dataset.tol ? parseFloat(el.dataset.tol) : 0.05;
            const unit = el.dataset.unit || '';

            const row = document.createElement('div');
            row.className = 'cp-answer-row';
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'cp-input';
            input.setAttribute('inputmode', 'decimal');
            input.setAttribute('aria-label', 'Your answer');
            input.placeholder = 'your answer';
            const unitEl = document.createElement('span');
            unitEl.className = 'cp-unit';
            unitEl.textContent = unit;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'cp-check';
            btn.textContent = 'Check';

            row.appendChild(input);
            if (unit) row.appendChild(unitEl);
            row.appendChild(btn);
            el.appendChild(row);
            el.appendChild(feedback);

            const check = () => {
                const v = parseNum(input.value);
                if (!isFinite(v)) {
                    feedback.hidden = false;
                    feedback.className = 'cp-feedback';
                    feedback.textContent = 'Enter a number — 4k7, 4700 and 4.7e3 all work.';
                    return;
                }
                const err = Math.abs(v - target) / (Math.abs(target) || 1);
                const ok = err <= tol;
                settle(ok, (el.dataset.why || '') +
                    (ok ? '' : ' The value is about <strong>' + el.dataset.answer +
                          (unit ? ' ' + unit : '') + '</strong>.'));
                input.disabled = ok;
                btn.disabled = ok;
            };
            btn.addEventListener('click', check);
            input.addEventListener('keydown', e => { if (e.key === 'Enter') check(); });

            if (store.get(id) && store.get(id).solved) {
                input.value = el.dataset.answer;
                check();
            }
            return;
        }

        // ---------------------------------------------------------- options
        const list = el.querySelector('.cp-options');
        if (!list) return;
        const answer = String(el.dataset.answer || '').trim();
        const options = Array.prototype.slice.call(list.children);

        options.forEach(li => {
            li.setAttribute('role', 'button');
            li.setAttribute('tabindex', '0');

            // The explanation is authored as a CHILD ELEMENT, not an attribute.
            // Attributes cannot hold markup, and these explanations want
            // subscripts and emphasis - V<sub>BE</sub> is unreadable written any
            // other way. Authoring it inline also means it is still on the page
            // if this script never runs. data-why is kept as a plain-text
            // fallback for the simplest cases.
            let whyEl = li.querySelector('.cp-why');
            if (!whyEl && li.dataset.why) {
                whyEl = document.createElement('div');
                whyEl.className = 'cp-why';
                whyEl.textContent = li.dataset.why;
                li.appendChild(whyEl);
            }
            if (whyEl) whyEl.hidden = true;

            const pick = () => {
                if (el.classList.contains('cp-done')) return;
                const k = String(li.dataset.k || '').trim();
                const correct = k === answer;

                options.forEach(o => {
                    const ok = String(o.dataset.k || '').trim() === answer;
                    o.classList.toggle('is-answer', ok);
                    const w = o.querySelector('.cp-why');
                    // Reveal the chosen option's reasoning, and the right one's.
                    if (w) w.hidden = !(o === li || ok);
                });
                li.classList.add('is-picked');
                el.classList.add('cp-done');
                settle(correct, correct ? '' :
                    'Read the explanation under your choice, then under the right one — the ' +
                    'gap between them is the thing worth keeping.');
            };

            li.addEventListener('click', pick);
            li.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); }
            });
        });

        el.appendChild(feedback);

        const st = store.get(id);
        if (st && st.solved) {
            const win = options.find(o => String(o.dataset.k || '').trim() === answer);
            if (win) win.click();
        }
    }

    function scan(root) {
        const scope = root || document;
        const all = scope.querySelectorAll ? scope.querySelectorAll('.checkpoint') : [];
        Array.prototype.forEach.call(all, (el, i) => {
            try { build(el, i + 1); }
            catch (e) { console.error('Checkpoint failed to build:', e); }
        });
        return all.length;
    }

    window.Checkpoints = { scan: scan };

    // Lessons are injected after load, so the router calls scan() itself; this
    // covers the standalone pages and any direct use.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => scan());
    } else {
        scan();
    }
}());
