/**
 * THE SYLLABUS
 *
 * Four semesters. Two of them cover Electronics I and Electronics II as those
 * courses are actually taught; the other two go past them, into the design
 * judgement, real parts and bench work a first pass never has room for.
 *
 *   S1  Electronics I - core          the abstraction, then the physics
 *   S2  Electronics I - beyond        those devices as amplifiers, properly
 *   S3  Electronics II - core         multi-device circuits and feedback
 *   S4  Electronics II - beyond       real design: noise, matching, systems
 *
 * ORDER. The sequence is deliberately not the traditional one. A standard
 * Electronics I opens on semiconductor physics and spends weeks inside the
 * device before the student builds anything. Here the ideal op-amp comes
 * first, because you can use one correctly long before you can explain one,
 * and the transistor arrives as the answer to "how was that built". The
 * physics is not skipped - it is stage 5, where it explains something the
 * reader has already used rather than something they have not.
 *
 * The catalogue has been re-sequenced to match this, so the sidebar and this
 * file agree. Modules used to be grouped purely by topic, which opened the
 * course on 35 lessons of BJT internals and left negative feedback until
 * module 25 - even though the golden rules were only true because of it.
 *
 * SOURCES. The shape of the syllabus is drawn from the courses that teach this
 * material best rather than invented: Agarwal's 6.002 for the abstraction-first
 * arc and the discipline of stating a model's validity; Shankar for deriving
 * rather than asserting; Razavi for the device-level treatment and for the
 * habit of asking what each topology fixes about the last one; Horowitz and
 * Hill (and the X Chapters) for judgement, part numbers and the things that
 * only appear on a bench; and TI's and NI's application notes for the design
 * procedures engineers actually follow.
 *
 * SCOPE, and what is deliberately skipped. The filter is practical use, not
 * tradition. A classical Electronics I spends a fortnight designing half-wave
 * and full-wave rectifiers; a working analog engineer buys a module or an IC
 * and needs the ripple and peak-current intuition, not the design procedure.
 * So that material is one survey lesson, and the space goes to things that are
 * used daily and usually taught thinly: datasheet reading, matching, noise,
 * frequency compensation, and choosing parts. Where a topic is glossed the
 * step says so, so the omission is a decision on the record rather than a hole.
 *
 * `ref` points at [module, lesson]. `status: 'todo'` marks a topic the
 * syllabus needs that has not been written yet: that is how the gaps stay
 * visible instead of being quietly dropped. LEARNING_PATH.todo() lists them.
 */
const LEARNING_PATH = (() => {
    'use strict';

    const SEMESTERS = [
        { id: 1, title: 'Electronics I — core',
          blurb: 'The abstraction first, then the physics underneath it. By the end you can ' +
                 'design working op-amp circuits and explain what a transistor is.' },
        { id: 2, title: 'Electronics I — beyond',
          blurb: 'The devices as amplifiers: model, bias, topology, and what the models get ' +
                 'wrong. Where a first course stops and design work starts.' },
        { id: 3, title: 'Electronics II — core',
          blurb: 'Circuits made of several devices — differential pairs, mirrors, multistage ' +
                 'amplifiers — and the feedback theory holding them together.' },
        { id: 4, title: 'Electronics II — beyond',
          blurb: 'Real design. Noise, matching, precision, power, and the judgement that ' +
                 'decides which of several correct circuits you actually build.' }
    ];

    const STAGES = [
        // ============================ SEMESTER 1 ============================
        {
            id: 'what-is-an-amplifier', semester: 1,
            title: 'What an amplifier is',
            blurb: 'Before any device. An amplifier is a specification before it is a circuit, ' +
                   'and four numbers describe it.',
            steps: [
                { ref: [1, 1], title: 'The ideal amplifier',
                  earns: 'Gain, input impedance, output impedance, and why there are exactly ' +
                         'four kinds of amplifier. The loading theorem, derived.' },
                { ref: [1, 2], title: 'Golden rules and the basic configurations',
                  earns: 'Inverting, non-inverting, buffer, summing, difference — every one ' +
                         'solved with two rules and no algebra about transistors.' }
            ]
        },
        {
            id: 'using-the-ideal-opamp', semester: 1,
            title: 'Using the ideal op-amp',
            blurb: 'Get real work out of the abstraction while it is still simple. Everything ' +
                   'here is solvable with the golden rules alone.',
            steps: [
                { ref: [1, 3], title: 'Integrator and differentiator',
                  earns: 'The golden rules applied to a capacitor: the same two rules now give ' +
                         'you calculus.' },
                { ref: [2, 2], title: 'Transimpedance amplifier',
                  earns: 'Your first amplifier whose input is a current — the reason the four ' +
                         'amplifier types were worth naming.' },
                { ref: [2, 3], title: 'Instrumentation amplifier',
                  earns: 'Difference amplification done properly, and the first circuit where ' +
                         'resistor matching, not the op-amp, sets performance.' },
                { ref: [2, 1], title: 'Active filters (Sallen-Key)',
                  earns: 'A complete, useful block built entirely on the ideal model.' }
            ]
        },
        {
            id: 'why-it-works', semester: 1,
            title: 'Why any of that worked: feedback',
            blurb: 'The golden rules are not axioms. They are what a large loop gain looks ' +
                   'like from outside.',
            steps: [
                { ref: [3, 1], title: 'Feedback fundamentals',
                  earns: 'A/(1+Aβ), loop gain, and why "the inputs are equal" is an ' +
                         'approximation with a known error rather than a law.' },
                { ref: [3, 2], title: 'Feedback topologies',
                  earns: 'Why feedback raises one impedance and lowers another — how the four ' +
                         'amplifier types get built on purpose.' },
                { ref: [1, 7], title: 'Stability and compensation',
                  earns: 'What you pay for loop gain: phase margin, and the ringing you get ' +
                         'when you spend it all.' }
            ]
        },
        {
            id: 'not-ideal', semester: 1,
            title: 'The op-amp stops being ideal',
            blurb: 'Every departure from the ideal model, in the order you meet them on a ' +
                   'bench — then the datasheet that predicts them.',
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
                { ref: null, status: 'todo', title: 'Reading an op-amp datasheet',
                  earns: 'Every error above, located on a real datasheet: where the number ' +
                         'hides, its test conditions, and which typical-only specs must never ' +
                         'be designed against.' }
            ]
        },
        {
            id: 'semiconductors', semester: 1,
            title: 'What a semiconductor actually does',
            blurb: 'The physics, arriving where it explains something you have already used ' +
                   'rather than as a barrier before you have used anything. Two lessons, not ' +
                   'the usual four — see the note on scope below.',
            steps: [
                { ref: [4, 1], title: 'The pn junction and the exponential',
                  earns: 'Where 0.7 V comes from, why it drifts at −2 mV/°C, why VT = kT/q is ' +
                         '26 mV, and why every device in this course is exponential underneath. ' +
                         'The diode equation and the three models — ideal, constant-drop, and ' +
                         'small-signal rd = VT/ID — with the error each one costs you.' },
                { ref: [4, 2], title: 'Diodes in practice: an overview',
                  earns: 'Rectification, clamping and protection at the level you actually use ' +
                         'them: ripple as ΔV = I·t/C, why the capacitor and not the diode sets ' +
                         'peak current, Schottky versus silicon, and what a TVS is for. ' +
                         'Deliberately a survey — nobody designs a linear supply front end from ' +
                         'scratch any more, but everybody sizes an input capacitor.' }
            ]
        },
        {
            id: 'inside-switch', semester: 1,
            title: 'The transistor as a switch',
            blurb: 'Open the box. The switch comes first because it needs no small-signal ' +
                   'model — it is on or it is off.',
            steps: [
                { ref: [5, 8], title: 'BJT as a switch',
                  earns: 'Saturation, base drive, and why an overdriven BJT turns off slowly.' },
                { ref: [6, 11], title: 'MOSFET as a switch',
                  earns: 'The same job done by a voltage, and Rds(on) instead of Vce(sat).' },
                { ref: [5, 29], title: 'BJT versus MOSFET',
                  earns: 'When each wins, on the axes that actually decide it.' }
            ]
        },

        // ============================ SEMESTER 2 ============================
        {
            id: 'bjt-amplifier', semester: 2,
            title: 'The BJT as an amplifier',
            blurb: 'The device that made the op-amp. Model first, then bias, then topologies.',
            steps: [
                { ref: [5, 1], title: 'The BJT as a voltage-controlled current source',
                  earns: 'gm = IC/VT and re = 25/IC(mA), derived — the two numbers every BJT ' +
                         'circuit is built from.' },
                { ref: [5, 2], title: 'The small-signal model',
                  earns: 'Hybrid-pi derived from the exponential: gm, r-pi, ro, the intrinsic ' +
                         'gain VA/VT, and exactly how small a small signal must be. Everything ' +
                         'after this is that model with different resistors around it.' },
                { ref: [5, 4], title: 'DC biasing',
                  earns: 'Putting the device where the model is valid, and keeping it there ' +
                         'over temperature and beta spread.' },
                { ref: [5, 5], title: 'Common-emitter',
                  earns: 'Voltage gain, and its three problems: gain that depends on beta, ' +
                         'distortion, and a low input impedance.' },
                { ref: [5, 6], title: 'Emitter follower',
                  earns: 'Gain of one, and why that is worth a whole transistor.' },
                { ref: [5, 7], title: 'Common-base',
                  earns: 'The current-input stage, and the first hint of why cascode exists.' }
            ]
        },
        {
            id: 'fet-amplifier', semester: 2,
            title: 'The FET as an amplifier',
            blurb: 'The analog half of the MOSFET, which a power-electronics treatment of the ' +
                   'device never reaches.',
            steps: [
                { ref: [6, 1], title: 'MOSFET fundamentals',
                  earns: 'Threshold, inversion, and the three regions.' },
                { ref: [6, 2], title: 'Small-signal model and gm',
                  earns: 'gm = √(2k·ID) = 2ID/Vov derived — and why a FET needs far more ' +
                         'current than a BJT for the same gm.' },
                { ref: [6, 3], title: 'The common-source amplifier',
                  earns: 'The FET counterpart of common-emitter, worked end to end, and why ' +
                         'fixed-VGS biasing fails on threshold spread.' },
                { ref: [6, 4], title: 'The source follower (common-drain)',
                  earns: 'The FET buffer, and the body effect that stops its gain reaching one.' },
                { ref: [6, 5], title: 'The common-gate amplifier',
                  earns: 'Low input impedance by design, no Miller effect, and the other ' +
                         'half of the cascode.' },
                { ref: [6, 7], title: 'Body effect and the back gate',
                  earns: 'The fourth terminal, and the threshold shift that breaks a source ' +
                         'follower you thought you had designed.' },
                { ref: [6, 6], title: 'What the square law gets wrong',
                  earns: 'Subthreshold, velocity saturation, Pelgrom matching, and the ' +
                         'zero-tempco point.' }
            ]
        },
        {
            id: 'frequency', semester: 2,
            title: 'Frequency response',
            blurb: 'Every amplifier so far has been treated as if it worked at all frequencies. ' +
                   'None of them do.',
            steps: [
                { ref: [5, 14], title: 'BJT frequency response',
                  earns: 'fT, beta roll-off, and where the useful band actually ends.' },
                { ref: null, status: 'todo', title: 'The Miller effect, derived',
                  earns: 'Why a 5 pF feedback capacitance behaves like 58 pF at the input, and ' +
                         'why that is the dominant pole in most single-stage amplifiers.' },
                { ref: [5, 9], title: 'Cascode',
                  earns: 'The fix for Miller, and why high-frequency circuits look the way ' +
                         'they do.' },
                { ref: null, status: 'todo', title: 'Poles, zeros and Bode plots by hand',
                  earns: 'Sketching a response from the circuit without a simulator — the ' +
                         'skill that makes stability analysis intuitive rather than numerical.' }
            ]
        },

        // ============================ SEMESTER 3 ============================
        {
            id: 'building-blocks', semester: 3,
            title: 'The blocks an op-amp is made of',
            blurb: 'Back to where the course started, from the inside. By the end of this ' +
                   'stage you can draw the op-amp you were using in semester 1.',
            steps: [
                { ref: [5, 10], title: 'The differential pair',
                  earns: 'The input stage of essentially every op-amp ever made.' },
                { ref: [5, 11], title: 'Current mirrors',
                  earns: 'Biasing and active loads from one matched pair — and the error ' +
                         'budget that decides whether yours works.' },
                { ref: [6, 9], title: 'MOSFET current mirrors',
                  earns: 'The same idea where matching is a layout problem, not a purchase.' },
                { ref: [5, 12], title: 'Active loads',
                  earns: 'Where the enormous open-loop gain in semester 1 came from.' },
                { ref: [5, 18], title: 'Multistage amplifier design',
                  earns: 'Putting stages together without the interfaces eating the gain.' },
                { ref: [8, 2], title: 'Bandgap references',
                  earns: 'Two temperature coefficients cancelled on purpose — the most elegant ' +
                         'use of everything above.' }
            ]
        },
        {
            id: 'feedback-deep', semester: 3,
            title: 'Feedback, properly',
            blurb: 'Semester 1 used feedback. This is the analysis: how much you have, what it ' +
                   'buys, and when it turns into an oscillator.',
            steps: [
                { ref: [3, 3], title: 'Stability analysis',
                  earns: 'Loop gain, phase margin, and the relation between margin and ' +
                         'overshoot — derived, not asserted.' },
                { ref: [3, 4], title: 'Compensation techniques',
                  earns: 'Dominant pole, lead, lag: moving poles on purpose.' },
                { ref: [3, 5], title: 'Two-stage amplifier compensation',
                  earns: 'Miller compensation and pole splitting — the technique behind almost ' +
                         'every integrated op-amp.' },
                { ref: [3, 6], title: 'Stability with reactive loads',
                  earns: 'Why a capacitive load turns a stable amplifier into an oscillator.' },
                { ref: [3, 8], title: 'The Nyquist criterion',
                  earns: 'The general statement, for cases where phase margin cannot answer ' +
                         'the question.' }
            ]
        },
        {
            id: 'output-and-signal', semester: 3,
            title: 'Output stages, oscillators and filters',
            blurb: 'The circuits that deliver power, generate signals, and shape spectra.',
            steps: [
                { ref: [7, 1], title: 'Push-pull output stages',
                  earns: 'Class A, B and AB, and where crossover distortion comes from.' },
                { ref: [7, 5], title: 'Class AB biasing',
                  earns: 'The VBE multiplier, and thermal runaway in an output stage.' },
                { ref: [9, 2], title: 'RC oscillators (Wien bridge)',
                  earns: 'Barkhausen, and the amplitude control problem every oscillator has.' },
                { ref: [9, 1], title: 'LC oscillators',
                  earns: 'Colpitts and Hartley, and why Q matters.' },
                { ref: [9, 3], title: 'Crystal oscillators',
                  earns: 'What a 10,000× improvement in Q buys, and what it costs.' }
            ]
        },

        // ============================ SEMESTER 4 ============================
        {
            id: 'real-design', semester: 4,
            title: 'Designing with real parts',
            blurb: 'Not "how does this work" but "which one do I buy, and will it still meet ' +
                   'spec at 70 °C with the part I actually receive".',
            steps: [
                { ref: null, status: 'todo', title: 'Choosing a transistor from a datasheet',
                  earns: 'Which parameters are guaranteed, which are typical-only, how much ' +
                         'beta really varies, and how to pick a part rather than recognise one.' },
                { ref: [5, 37], title: 'Design: a current mirror from a datasheet',
                  earns: 'An error budget against a real spec, and choosing between a $0.15 ' +
                         'dual and an $8 matched pair.' },
                { ref: [5, 35], title: 'Industry BJT selection guide',
                  earns: 'The reference list, useful once you know what the columns mean.' }
            ]
        },
        {
            id: 'systems', semester: 4,
            title: 'Systems and the real world',
            blurb: 'Where analog design meets everything else: converters, power, interference, ' +
                   'and the grid.',
            steps: [
                { ref: [17, 1], title: 'Data conversion',
                  earns: 'What happens at the boundary between this course and the digital one.' },
                { ref: [14, 1], title: 'Power supply design',
                  earns: 'The circuit every other circuit depends on.' },
                { ref: [22, 1], title: 'EMI and EMC',
                  earns: 'Why a circuit that works on a bench fails in a product.' },
                { ref: [27, 1], title: 'Power systems and the grid',
                  earns: 'The same physics, six orders of magnitude larger.' }
            ]
        }
    ];

    function steps() {
        const out = [];
        STAGES.forEach((stage, si) => {
            stage.steps.forEach((step, i) => {
                out.push(Object.assign({}, step, {
                    stageId: stage.id,
                    stageTitle: stage.title,
                    semester: stage.semester,
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

    /** Topics the syllabus calls for that have not been written yet. */
    function todo() {
        return steps().filter(s => !s.ref);
    }

    function stagesFor(semester) {
        return STAGES.filter(s => s.semester === semester);
    }

    function positionOf(moduleId, lessonId) {
        const hit = steps().find(s => s.ref && s.ref[0] === moduleId && s.ref[1] === lessonId);
        return hit ? hit.position : null;
    }

    return { SEMESTERS, STAGES, steps, total, todo, stagesFor, positionOf };
})();

if (typeof window !== 'undefined') window.LEARNING_PATH = LEARNING_PATH;
if (typeof module !== 'undefined' && module.exports) module.exports = LEARNING_PATH;
