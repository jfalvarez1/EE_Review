/**
 * THE LEARNING PATH
 *
 * One ordered spine, for someone who has finished a first circuits course and
 * wants to end up designing. Each step says what it earns you, so the order is
 * arguable rather than arbitrary.
 *
 * The catalogue has since been re-sequenced to match this, so the sidebar and
 * this file now agree. That was not always so: the modules used to be grouped
 * purely by topic, which opened the course on 35 lessons of BJT internals and
 * left negative feedback until module 25 - even though the op-amp golden rules
 * in module 2 were only true because of it. This file is where the intended
 * order is stated and reasoned; the catalogue follows it.
 *
 * The arc it follows, deliberately:
 *
 *   abstraction first    You can use an op-amp correctly long before you can
 *                        explain one. Starting inside the transistor means
 *                        months before the learner builds anything.
 *   then the mechanism   Feedback, because it is why the golden rules hold.
 *   then the device      The transistor, arriving as the ANSWER to "how was
 *                        that op-amp built", not as a prerequisite.
 *   then the topologies  CE, CS, cascode - each one a fix for a specific
 *                        limitation of the one before.
 *   then real parts      Datasheets, tolerances, and choosing an actual
 *                        transistor by part number.
 *
 * `ref` points into the catalogue as [module, lesson]. `status: 'new'` marks a
 * step written for this path because the catalogue had no lesson for it.
 */
const LEARNING_PATH = (() => {
    'use strict';

    const STAGES = [
        {
            id: 'what-is-an-amplifier',
            title: 'What an amplifier is',
            blurb: 'Before any device. An amplifier is a specification before it is a circuit, ' +
                   'and four numbers describe it.',
            steps: [
                { ref: [1, 1], status: 'new', slug: 'ideal-amplifier',
                  title: 'The ideal amplifier',
                  earns: 'Gain, input impedance, output impedance, and why there are exactly ' +
                         'four kinds of amplifier rather than one.' },
                { ref: [1, 2],
                  title: 'Golden rules and the basic configurations',
                  earns: 'Inverting, non-inverting, buffer, summing, difference — every one ' +
                         'of them solved with two rules and no algebra about transistors.' }
            ]
        },
        {
            id: 'using-the-ideal-opamp',
            title: 'Using the ideal op-amp',
            blurb: 'Get real work out of the abstraction while it is still simple. Everything ' +
                   'here is solvable with the golden rules alone.',
            steps: [
                { ref: [1, 3], title: 'Integrator and differentiator',
                  earns: 'The golden rules applied to a capacitor: the same two rules now ' +
                         'give you calculus.' },
                { ref: [2, 2], title: 'Transimpedance amplifier',
                  earns: 'Your first amplifier whose input is a current — the reason the four ' +
                         'amplifier types in step 1 were worth naming.' },
                { ref: [2, 3], title: 'Instrumentation amplifier',
                  earns: 'Difference amplification done properly, and the first circuit where ' +
                         'resistor matching, not the op-amp, sets performance.' },
                { ref: [2, 1], title: 'Active filters (Sallen-Key)',
                  earns: 'A complete, useful block built entirely on the ideal model.' }
            ]
        },
        {
            id: 'why-it-works',
            title: 'Why any of that worked: feedback',
            blurb: 'The golden rules are not axioms. They are what a large loop gain looks like ' +
                   'from outside - which is why it comes before the stages that lean on it.',
            steps: [
                { ref: [3, 1], title: 'Feedback fundamentals',
                  earns: 'A/(1+Aβ), loop gain, and the reason "the inputs are equal" is an ' +
                         'approximation with a known error rather than a law.' },
                { ref: [3, 2], title: 'Feedback topologies',
                  earns: 'Why feedback raises one impedance and lowers another, which is how ' +
                         'the four amplifier types get built on purpose.' },
                { ref: [1, 7], title: 'Stability and compensation',
                  earns: 'What you pay for that loop gain: phase margin, and the ringing you ' +
                         'get when you spend it all.' }
            ]
        },
        {
            id: 'not-ideal',
            title: 'The op-amp stops being ideal',
            blurb: 'Every departure from the ideal model, in the order you will meet them on ' +
                   'a bench — and then the datasheet that predicts them.',
            steps: [
                { ref: [1, 4], title: 'Bandwidth and slew rate',
                  earns: 'Gain is not free above DC. GBW, and why slew rate is a different ' +
                         'limit that bandwidth will not warn you about.' },
                { ref: [1, 5], title: 'DC errors: Vos, Ib, Ios',
                  earns: 'Why a circuit that should output zero does not, and which of the ' +
                         'three is to blame at your source impedance.' },
                { ref: [1, 6], title: 'Power supply rejection',
                  earns: 'The supply is an input too.' },
                { ref: [2, 4], title: 'Noise analysis',
                  earns: 'The floor you cannot design below, and where it comes from.' },
                { ref: null, status: 'new', slug: 'reading-a-datasheet',
                  title: 'Reading an op-amp datasheet',
                  earns: 'Every error above, located on a real datasheet — where the number ' +
                         'hides, which test conditions it was taken under, and which ' +
                         'typical-only specs you must not design against.' }
            ]
        },
        {
            id: 'inside-switch',
            title: 'Inside: the transistor as a switch',
            blurb: 'Now open the box. The switch comes first because it needs no small-signal ' +
                   'model — it is on or it is off.',
            steps: [
                { ref: [4, 7], title: 'BJT as a switch',
                  earns: 'Saturation, base drive, and why an overdriven BJT turns off slowly.' },
                { ref: [5, 9], title: 'MOSFET as a switch',
                  earns: 'The same job done by a voltage, and Rds(on) instead of Vce(sat).' },
                { ref: [4, 28], title: 'BJT versus MOSFET',
                  earns: 'When each one wins, on the axes that actually decide it.' }
            ]
        },
        {
            id: 'bjt-amplifier',
            title: 'The transistor as an amplifier: BJT',
            blurb: 'The device that made the op-amp. Model first, then bias, then topologies — ' +
                   'the catalogue does these in nearly the opposite order.',
            steps: [
                { ref: [4, 1], title: 'The BJT as a voltage-controlled current source',
                  earns: 'gm = IC/VT and re = 25/IC(mA), derived — the two numbers every ' +
                         'BJT circuit below is built from.' },
                { ref: [4, 2], title: 'The small-signal model',
                  earns: 'Hybrid-pi: the linear circuit you actually solve. Everything after ' +
                         'this is that model with different resistors around it.' },
                { ref: [4, 3], title: 'DC biasing',
                  earns: 'Putting the device where the model is valid, and keeping it there ' +
                         'over temperature and beta spread.' },
                { ref: [4, 4], title: 'Common-emitter',
                  earns: 'Voltage gain, and its three problems: gain that depends on beta, ' +
                         'distortion, and a low input impedance.' },
                { ref: [4, 5], title: 'Emitter follower',
                  earns: 'Gain of one, and why that is worth a whole transistor.' },
                { ref: [4, 6], title: 'Common-base',
                  earns: 'The current-input stage, and the first hint of why cascode exists.' }
            ]
        },
        {
            id: 'fet-amplifier',
            title: 'The transistor as an amplifier: FET',
            blurb: 'The catalogue teaches the MOSFET almost entirely as a power switch. This ' +
                   'is the analog half, and most of it had to be written.',
            steps: [
                { ref: [5, 1], title: 'MOSFET fundamentals',
                  earns: 'Threshold, inversion, and the three regions.' },
                { ref: [5, 2], status: 'new', slug: 'mosfet-small-signal',
                  title: 'MOSFET small-signal model and gm',
                  earns: 'gm = 2·ID/Vov = sqrt(2·k·ID) derived from the square law — and why ' +
                         'a FET needs far more current than a BJT for the same gm.' },
                { ref: [5, 3], status: 'new', slug: 'common-source',
                  title: 'The common-source amplifier',
                  earns: 'The FET counterpart of common-emitter, worked end to end. The ' +
                         'catalogue has no lesson for this at all.' },
                { ref: [5, 5], title: 'Body effect and the back gate',
                  earns: 'The fourth terminal, and the threshold shift that breaks a source ' +
                         'follower you thought you had designed.' },
                { ref: [5, 4], status: 'new', slug: 'real-fet-behaviour',
                  title: 'What the square law gets wrong',
                  earns: 'Channel-length modulation, velocity saturation, subthreshold ' +
                         'conduction, and the Vth spread across a real reel of parts.' }
            ]
        },
        {
            id: 'building-blocks',
            title: 'The blocks an op-amp is made of',
            blurb: 'Back to where the path started, from the inside. By the end of this stage ' +
                   'you can draw the op-amp you were using in stage 2.',
            steps: [
                { ref: [4, 9], title: 'The differential pair',
                  earns: 'The input stage of essentially every op-amp ever made.' },
                { ref: [4, 10], title: 'Current mirrors',
                  earns: 'Biasing and active loads, from one matched pair.' },
                { ref: [5, 7], title: 'MOSFET current mirrors',
                  earns: 'The same idea where matching is a layout problem, not a purchase.' },
                { ref: [4, 11], title: 'Active loads',
                  earns: 'Where the enormous open-loop gain in stage 3 actually came from.' },
                { ref: [4, 8], title: 'Cascode',
                  earns: 'The fix for the common-emitter\'s Miller problem, and the reason ' +
                         'high-frequency circuits look the way they do.' },
                { ref: [7, 2], title: 'Bandgap references',
                  earns: 'Two temperature coefficients cancelled on purpose — the most ' +
                         'elegant use of everything above.' }
            ]
        },
        {
            id: 'design',
            title: 'Designing with real parts',
            blurb: 'The end of the path: not "how does this work" but "which one do I buy, ' +
                   'and will it still work at 85 °C with the transistor I actually get".',
            steps: [
                { ref: null, status: 'new', slug: 'choosing-a-transistor',
                  title: 'Choosing a transistor from a datasheet',
                  earns: 'Reading a real BJT and MOSFET datasheet: which parameters are ' +
                         'guaranteed, which are typical-only, how much beta really varies, ' +
                         'and how to pick a part rather than recognise one.' },
                { ref: [4, 36], status: 'new', slug: 'current-mirror-design',
                  title: 'Design: a current mirror from a datasheet',
                  earns: 'The capstone. Specify it, choose the part by number, work the ' +
                         'matching and Early-effect errors from real datasheet numbers, and ' +
                         'decide whether it meets spec over temperature.' },
                { ref: [4, 34], title: 'Industry BJT selection guide',
                  earns: 'The catalogue\'s reference list, useful once you know what the ' +
                         'columns mean.' }
            ]
        }
    ];

    /** Every step, flattened, with its stage and 1-based position on the path. */
    function steps() {
        const out = [];
        STAGES.forEach((stage, si) => {
            stage.steps.forEach((step, i) => {
                out.push(Object.assign({}, step, {
                    stageId: stage.id,
                    stageTitle: stage.title,
                    stageIndex: si,
                    indexInStage: i,
                    position: out.length + 1
                }));
            });
        });
        return out;
    }

    function total() {
        return STAGES.reduce((n, s) => n + s.steps.length, 0);
    }

    /** The path position of a catalogue lesson, or null if it is not on the path. */
    function positionOf(moduleId, lessonId) {
        const hit = steps().find(s => s.ref && s.ref[0] === moduleId && s.ref[1] === lessonId);
        return hit ? hit.position : null;
    }

    function stepAt(position) {
        return steps()[position - 1] || null;
    }

    return { STAGES, steps, total, positionOf, stepAt };
})();

if (typeof window !== 'undefined') window.LEARNING_PATH = LEARNING_PATH;
if (typeof module !== 'undefined' && module.exports) module.exports = LEARNING_PATH;
