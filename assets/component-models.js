/**
 * Component Models - the single source of truth for schematic symbols
 * =====================================================================
 *
 * Ported from the component model system in `circuit_toy` (the C/SDL2 circuit
 * simulator) and re-targeted at this study guide. The two projects need the
 * same *models* but very different *rendering*, so read this before editing.
 *
 * WHAT CAME FROM circuit_toy
 *   - Its registry (`component_info[]`, src/component.c) defines 125 component
 *     types; its palette groups them with the `PaletteCategoryID` enum
 *     (include/ui.h): TOOLS, SOURCES, WAVEFORMS, PASSIVES, DIODES, BJT, FET,
 *     THYRISTORS, OPAMPS, CONTROLLED, SWITCHES, TRANSFORMERS, LOGIC, DIGITAL,
 *     MIXED, REGULATORS, DISPLAY, WIRELESS, MEASUREMENT, SUBPARTS, CIRCUITS,
 *     SUBCIRCUITS. The `category` field below follows those groups, merged
 *     where a study guide does not need the distinction (OPAMPS + REGULATORS +
 *     MIXED become "Analog ICs"; LOGIC + DIGITAL become "Digital").
 *   - The `toy:` field on a model records the matching COMP_* enum name, so the
 *     two catalogs can be diffed.
 *   - Terminal counts, body proportions and default parameter values.
 *
 * WHAT DELIBERATELY DID NOT COME ACROSS
 *   circuit_toy's solver detail has no place here: the theta-method companion
 *   models (theta = 0.6), GMIN = 1e-12, the 50-iteration Newton loop and the
 *   dense Gaussian solve are simulation machinery, and this project does not
 *   simulate. Several of its models are also acknowledged stubs - SCR and TRIAC
 *   never latch, DAC/ADC/VCO/PLL emit a fixed 2.5 V, the varactor and photodiode
 *   share a plain diode stamp - so the electrical descriptions below were
 *   written from device physics and datasheets, NOT copied from those stamps.
 *
 * RENDERING: THE ACTUAL DIFFERENCE
 *
 *   circuit_toy                          EE_Review (this project)
 *   -----------------------------------  ------------------------------------
 *   Immediate-mode SDL2 renderer, one    Static SVG, emitted once and then
 *   redraw per frame at 60 fps.          scaled by CSS / the browser.
 *   Symbols drawn in device pixels at    Symbols drawn in a local coordinate
 *   the current zoom level.              frame and placed with a transform.
 *   Animated: current arrows move, hot   Nothing animates. Everything the
 *   nodes glow, probes update live.      reader needs must be legible frozen.
 *   Correctness is proven by running     Correctness is proven by the DRC in
 *   the MNA solver.                      schematic-svg.js (keepouts, pin
 *                                        registry, text-collision checks).
 *   Purpose: play with a live circuit.   Purpose: recognise a symbol and
 *                                        recall its equations in seconds.
 *
 * Practical consequences, all of which shaped the geometry below:
 *
 *   1. No animation means the symbol carries all the information. Polarity
 *      marks, arrows and dots are drawn a little larger than circuit_toy draws
 *      them, because they are never disambiguated by watching current flow.
 *   2. Static SVG is zoomed by the reader, so strokes use
 *      vector-effect="non-scaling-stroke" and stay legible at any scale.
 *   3. Every symbol declares an explicit `body` keepout and `pins` with an
 *      escape direction, so the schematic DRC can route around it. circuit_toy
 *      needs neither - it hit-tests against live geometry instead.
 *   4. Each model carries study metadata (`params`, `equations`, `study`) that
 *      has no analogue in circuit_toy, where the solver *is* the explanation.
 *
 * COORDINATE CONVENTION
 *   Local pixels, origin at the centre of the component body, +x right,
 *   +y down (SVG convention). A standard two-terminal part is 50 px long, so
 *   its pins sit at (-25, 0) and (+25, 0). That matches COMP_LENGTH = 50 and
 *   GRID = 5 in schematic-svg.js, so a model placed at a grid point keeps its
 *   pins on grid.
 *
 * DRAWING OPS  (all coordinates local, all lengths in px)
 *   ['line',   x1, y1, x2, y2]
 *   ['rect',   x, y, w, h, {fill, rx}]
 *   ['circle', cx, cy, r, {fill}]
 *   ['poly',   [[x,y], ...], {fill, close}]
 *   ['path',   'M ... L ...', {fill}]
 *   ['arc',    cx, cy, r, startDeg, endDeg, {sweep}]
 *   ['dot',    x, y]                       filled junction/terminal dot
 *   ['text',   x, y, 'str', {size, anchor, italic, weight}]
 *
 * USAGE
 *   ComponentModels.get('nmos')                -> the model object
 *   ComponentModels.draw('nmos', {x, y})       -> {markup, pins, keepout}
 *   ComponentModels.symbolSVG('nmos', {...})   -> a standalone <svg> string
 *   ComponentModels.byCategory()               -> {category: [model, ...]}
 */

const ComponentModels = (() => {
    'use strict';

    // ===== RENDERING CONSTANTS =====
    // Deliberately matched to schematic-svg.js so catalog symbols and the
    // hand-written symbols in that file can share a sheet without clashing.
    const GRID = 5;
    const LEAD = 25;          // half of the 50 px standard component length
    const STROKE = 1.5;

    const COLORS = {
        component: '#6ee7ff',
        wire: '#e6edf3',
        label: '#e6edf3',
        value: '#9fb0c0',
        ground: '#9fb0c0',
        vcc: '#34d399',
        signal: '#fbbf24',
        highlight: '#ff6b6b',
        annotation: '#9fb0c0'
    };

    // ===== SVG EMISSION HELPERS =====
    const esc = (s) => String(s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const n = (v) => {
        // Trim float noise so repeated renders are byte-identical.
        const r = Math.round(v * 1000) / 1000;
        return Object.is(r, -0) ? 0 : r;
    };

    function polyPoints(pts) {
        return pts.map(p => `${n(p[0])},${n(p[1])}`).join(' ');
    }

    function arcPath(cx, cy, r, a0, a1, sweep) {
        const rad = (d) => d * Math.PI / 180;
        const x0 = cx + r * Math.cos(rad(a0));
        const y0 = cy + r * Math.sin(rad(a0));
        const x1 = cx + r * Math.cos(rad(a1));
        const y1 = cy + r * Math.sin(rad(a1));
        const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
        const sw = (sweep === undefined) ? 1 : sweep;
        return `M ${n(x0)} ${n(y0)} A ${n(r)} ${n(r)} 0 ${large} ${sw} ${n(x1)} ${n(y1)}`;
    }

    /**
     * Approximate the local-frame extent of one drawing op.
     * Used to fit a viewBox around a symbol. Text is estimated from its
     * font size and character count - close enough to stop glyphs being
     * clipped, which is all this needs to do.
     */
    function opBounds(op) {
        const pts = [];
        const add = (x, y) => pts.push([x, y]);
        switch (op[0]) {
            case 'line':
                add(op[1], op[2]); add(op[3], op[4]);
                break;
            case 'rect':
                add(op[1], op[2]); add(op[1] + op[3], op[2] + op[4]);
                break;
            case 'circle':
                add(op[1] - op[3], op[2] - op[3]); add(op[1] + op[3], op[2] + op[3]);
                break;
            case 'poly':
                for (const p of op[1]) add(p[0], p[1]);
                break;
            case 'arc':
                // Conservative: the whole circle the arc lies on.
                add(op[1] - op[3], op[2] - op[3]); add(op[1] + op[3], op[2] + op[3]);
                break;
            case 'dot':
                add(op[1] - 3, op[2] - 3); add(op[1] + 3, op[2] + 3);
                break;
            case 'text': {
                const o = op[4] || {};
                const size = o.size || 10;
                const w = String(op[3]).length * size * 0.62;
                const anchor = o.anchor || 'middle';
                const x0 = anchor === 'start' ? op[1]
                        : anchor === 'end' ? op[1] - w
                        : op[1] - w / 2;
                add(x0, op[2] - size);
                add(x0 + w, op[2] + size * 0.3);
                break;
            }
            case 'path': {
                // Pull every number out of the path data and pair them up.
                const nums = String(op[1]).match(/-?\d*\.?\d+/g) || [];
                for (let i = 0; i + 1 < nums.length; i += 2) {
                    add(parseFloat(nums[i]), parseFloat(nums[i + 1]));
                }
                break;
            }
            default:
                break;
        }
        return pts;
    }

    /**
     * Turn one drawing op into SVG markup.
     * `color` is the symbol's stroke colour; ops opt into fill explicitly.
     */
    function opToSVG(op, color) {
        const kind = op[0];
        const solid = 'vector-effect="non-scaling-stroke"';

        switch (kind) {
            case 'line':
                return `<line x1="${n(op[1])}" y1="${n(op[2])}" x2="${n(op[3])}" y2="${n(op[4])}" ${solid}/>`;

            case 'rect': {
                const o = op[5] || {};
                const fill = o.fill === true ? color : (o.fill || 'none');
                const rx = o.rx ? ` rx="${n(o.rx)}"` : '';
                return `<rect x="${n(op[1])}" y="${n(op[2])}" width="${n(op[3])}" height="${n(op[4])}"${rx} fill="${fill}" ${solid}/>`;
            }

            case 'circle': {
                const o = op[4] || {};
                const fill = o.fill === true ? color : (o.fill || 'none');
                return `<circle cx="${n(op[1])}" cy="${n(op[2])}" r="${n(op[3])}" fill="${fill}" ${solid}/>`;
            }

            case 'poly': {
                const o = op[2] || {};
                const fill = o.fill === true ? color : (o.fill || 'none');
                const tag = o.close === false ? 'polyline' : 'polygon';
                return `<${tag} points="${polyPoints(op[1])}" fill="${fill}" ${solid}/>`;
            }

            case 'path': {
                const o = op[2] || {};
                const fill = o.fill === true ? color : (o.fill || 'none');
                return `<path d="${op[1]}" fill="${fill}" ${solid}/>`;
            }

            case 'arc': {
                const o = op[6] || {};
                return `<path d="${arcPath(op[1], op[2], op[3], op[4], op[5], o.sweep)}" fill="none" ${solid}/>`;
            }

            case 'dot':
                return `<circle cx="${n(op[1])}" cy="${n(op[2])}" r="3" fill="${color}" stroke="none"/>`;

            case 'text': {
                const o = op[4] || {};
                const size = o.size || 10;
                const anchor = o.anchor || 'middle';
                const style = o.italic ? ' font-style="italic"' : '';
                const weight = o.weight ? ` font-weight="${o.weight}"` : '';
                const fill = o.color || color;
                return `<text x="${n(op[1])}" y="${n(op[2])}" font-size="${size}" text-anchor="${anchor}"` +
                       `${style}${weight} fill="${fill}" stroke="none" font-family="ui-sans-serif, system-ui, sans-serif">${esc(op[3])}</text>`;
            }

            default:
                return '';
        }
    }

    // ===== CATALOG =====
    // Every entry is data only. Nothing here touches the DOM.
    const MODELS = {};

    function define(model) {
        if (MODELS[model.key]) {
            throw new Error(`ComponentModels: duplicate key "${model.key}"`);
        }
        MODELS[model.key] = Object.assign({
            aliases: [],
            params: [],
            equations: [],
            study: { what: '', remember: [], gotchas: [] },
            spice: null,
            toy: null
        }, model);
        return MODELS[model.key];
    }

    // -------------------------------------------------------------------
    // PASSIVES
    // -------------------------------------------------------------------

    define({
        key: 'resistor',
        name: 'Resistor',
        category: 'Passives',
        refdes: 'R',
        aliases: ['res', 'r'],
        toy: 'COMP_RESISTOR',
        // Zig-zag body, 30 px wide, centred; 10 px lead each side.
        pins: [
            { name: 'a', x: -25, y: 0, dir: 'W' },
            { name: 'b', x: 25, y: 0, dir: 'E' }
        ],
        body: { x: -15, y: -8, w: 30, h: 16 },
        ops: [
            ['line', -25, 0, -15, 0],
            ['poly', [[-15, 0], [-12, -8], [-6, 8], [0, -8], [6, 8], [12, -8], [15, 0]], { close: false }],
            ['line', 15, 0, 25, 0]
        ],
        params: [
            { key: 'R', label: 'Resistance', unit: 'ohm', typ: '1k', note: 'E24/E96 preferred values' },
            { key: 'P', label: 'Power rating', unit: 'W', typ: '0.25', note: 'Derate above 70 degC' },
            { key: 'tol', label: 'Tolerance', unit: '%', typ: '1', note: '1% thin film, 5% carbon' },
            { key: 'tc', label: 'Tempco', unit: 'ppm/degC', typ: '100', note: '25 ppm for precision film' }
        ],
        equations: [
            { name: 'Ohm\'s law', expr: 'V = I x R' },
            { name: 'Power', expr: 'P = I^2 x R = V^2 / R' },
            { name: 'Johnson noise', expr: 'vn = sqrt(4 k T R B)', note: '4 nV/sqrt(Hz) for 1 kohm at 25 degC' },
            { name: 'Series / parallel', expr: 'Rs = R1 + R2   |   Rp = R1 R2 / (R1 + R2)' }
        ],
        study: {
            what: 'Converts voltage to current linearly and dissipates the product as heat.',
            remember: [
                'A 1 kohm resistor generates 4 nV/sqrt(Hz) of thermal noise at room temperature.',
                'Power rating is a thermal spec, not an electrical one - it assumes still air at 25 degC.',
                'Two resistors in parallel are always smaller than the smaller one.'
            ],
            gotchas: [
                'Surface-mount 0402/0603 parts have a maximum working voltage (50 V / 75 V) far below what P = V^2/R would allow.',
                'Thick-film resistors have a voltage coefficient - they are not perfectly linear at high V.'
            ]
        },
        spice: 'R{ref} {a} {b} {R}'
    });

    define({
        key: 'potentiometer',
        name: 'Potentiometer',
        category: 'Passives',
        refdes: 'RV',
        aliases: ['pot', 'variable resistor', 'trimmer'],
        toy: 'COMP_POT',
        pins: [
            { name: 'a', x: -25, y: 0, dir: 'W' },
            { name: 'b', x: 25, y: 0, dir: 'E' },
            { name: 'wiper', x: 0, y: -25, dir: 'N' }
        ],
        body: { x: -15, y: -8, w: 30, h: 16 },
        ops: [
            ['line', -25, 0, -15, 0],
            ['poly', [[-15, 0], [-12, -8], [-6, 8], [0, -8], [6, 8], [12, -8], [15, 0]], { close: false }],
            ['line', 15, 0, 25, 0],
            // Wiper: arrow down onto the body from the top terminal. The tip
            // stops at -10, just clear of the zig-zag peaks at -8, so the
            // arrowhead stays a distinct shape instead of merging with it.
            ['line', 0, -25, 0, -17],
            ['poly', [[0, -10], [-3.5, -17], [3.5, -17]], { fill: true }]
        ],
        params: [
            { key: 'R', label: 'End-to-end resistance', unit: 'ohm', typ: '10k' },
            { key: 'taper', label: 'Taper', unit: '', typ: 'linear', note: 'Log (audio) taper for volume controls' },
            { key: 'turns', label: 'Turns', unit: '', typ: '1', note: '10-25 turns for trimmers' }
        ],
        equations: [
            { name: 'As a divider', expr: 'Vout = Vin x (k R) / R = k Vin', note: 'k = fractional wiper position' },
            { name: 'As a rheostat', expr: 'R_eff = k R', note: 'Tie the wiper to one end' }
        ],
        study: {
            what: 'A resistor with a movable tap - a voltage divider you can turn, or a two-terminal variable resistor.',
            remember: [
                'Wired as a divider the output is loaded by whatever follows it; loading bends the taper.',
                'Tie the wiper to one end when using it as a rheostat, so a dirty wiper fails to full resistance rather than open.'
            ],
            gotchas: [
                'An open wiper in a divider leaves the output floating - always add a series resistor if the node drives something dangerous.',
                'Audio (log) taper is not logarithmic; it is two linear segments approximating a log curve.'
            ]
        },
        spice: null
    });

    define({
        key: 'capacitor',
        name: 'Capacitor',
        category: 'Passives',
        refdes: 'C',
        aliases: ['cap', 'c'],
        toy: 'COMP_CAPACITOR',
        pins: [
            { name: 'a', x: -25, y: 0, dir: 'W' },
            { name: 'b', x: 25, y: 0, dir: 'E' }
        ],
        body: { x: -3, y: -12, w: 6, h: 24 },
        ops: [
            ['line', -25, 0, -3, 0],
            ['line', -3, -12, -3, 12],
            ['line', 3, -12, 3, 12],
            ['line', 3, 0, 25, 0]
        ],
        params: [
            { key: 'C', label: 'Capacitance', unit: 'F', typ: '100n' },
            { key: 'V', label: 'Voltage rating', unit: 'V', typ: '50', note: 'Derate 2x for ceramics' },
            { key: 'ESR', label: 'Series resistance', unit: 'ohm', typ: '10m' },
            { key: 'diel', label: 'Dielectric', unit: '', typ: 'X7R', note: 'C0G/NP0 for precision' }
        ],
        equations: [
            { name: 'Constitutive', expr: 'i = C dv/dt' },
            { name: 'Impedance', expr: 'Zc = 1 / (j w C)' },
            { name: 'Energy', expr: 'E = 1/2 C V^2' },
            { name: 'RC time constant', expr: 'tau = R C', note: '63.2% in one tau, 99.3% in five' }
        ],
        study: {
            what: 'Stores charge; passes current only when the voltage across it is changing.',
            remember: [
                'A capacitor resists a change in voltage the way an inductor resists a change in current.',
                '1 uF at 1 kHz is about 160 ohm; scale inversely with both C and f.',
                'Place the decoupling capacitor so its loop area to the IC power pins is as small as possible.'
            ],
            gotchas: [
                'Class-II ceramics (X7R, X5R) lose most of their capacitance under DC bias - a 10 uF 0805 at 5 V may measure 3 uF.',
                'C0G/NP0 is stable but only available in small values.',
                'Ceramics are piezoelectric: they turn AC voltage into audible squeal and mechanical vibration into noise.'
            ]
        },
        spice: 'C{ref} {a} {b} {C}'
    });

    define({
        key: 'capacitor_pol',
        name: 'Polarised Capacitor',
        category: 'Passives',
        refdes: 'C',
        aliases: ['electrolytic', 'tantalum', 'polarized capacitor'],
        toy: 'COMP_CAPACITOR_POL',
        pins: [
            { name: 'plus', x: -25, y: 0, dir: 'W' },
            { name: 'minus', x: 25, y: 0, dir: 'E' }
        ],
        body: { x: -3, y: -12, w: 8, h: 24 },
        ops: [
            ['line', -25, 0, -3, 0],
            ['line', -3, -12, -3, 12],
            // Curved negative plate - the unambiguous polarity cue.
            ['arc', -13, 0, 18, -42, 42],
            ['line', 5, 0, 25, 0],
            ['text', -12, -16, '+', { size: 12, weight: 'bold' }]
        ],
        params: [
            { key: 'C', label: 'Capacitance', unit: 'F', typ: '100u' },
            { key: 'V', label: 'Voltage rating', unit: 'V', typ: '25', note: 'Derate to 80% for electrolytics' },
            { key: 'ESR', label: 'Series resistance', unit: 'ohm', typ: '0.1' },
            { key: 'ripple', label: 'Ripple current', unit: 'Arms', typ: '0.5', note: 'Self-heating limit' }
        ],
        equations: [
            { name: 'Ripple heating', expr: 'P = Irms^2 x ESR' },
            { name: 'Hold-up time', expr: 't = C (V1 - V2) / I' },
            { name: 'Life doubling', expr: 'L = L0 x 2^((Tmax - Ta)/10)', note: 'Arrhenius, per 10 degC' }
        ],
        study: {
            what: 'A high-capacitance-per-volume capacitor that must be biased in one direction only.',
            remember: [
                'Bulk energy storage and hold-up; too lossy for high-frequency decoupling on its own.',
                'Life doubles for every 10 degC below the rated temperature.'
            ],
            gotchas: [
                'Reverse bias vents an aluminium electrolytic and can short a tantalum into a fire.',
                'Tantalums need voltage derating of 2x or more on a low-impedance supply because of surge failures.',
                'ESR rises sharply at low temperature - a supply stable at 25 degC can oscillate at -20 degC.'
            ]
        },
        spice: 'C{ref} {plus} {minus} {C}'
    });

    define({
        key: 'inductor',
        name: 'Inductor',
        category: 'Passives',
        refdes: 'L',
        aliases: ['coil', 'choke'],
        toy: 'COMP_INDUCTOR',
        pins: [
            { name: 'a', x: -25, y: 0, dir: 'W' },
            { name: 'b', x: 25, y: 0, dir: 'E' }
        ],
        body: { x: -16, y: -8, w: 32, h: 10 },
        ops: [
            ['line', -25, 0, -16, 0],
            // Four half-circle humps: the IEC/IEEE inductor bump form.
            ['arc', -12, 0, 4, 180, 0],
            ['arc', -4, 0, 4, 180, 0],
            ['arc', 4, 0, 4, 180, 0],
            ['arc', 12, 0, 4, 180, 0],
            ['line', 16, 0, 25, 0]
        ],
        params: [
            { key: 'L', label: 'Inductance', unit: 'H', typ: '10u' },
            { key: 'Isat', label: 'Saturation current', unit: 'A', typ: '2', note: 'Usually the -30% L point' },
            { key: 'DCR', label: 'DC resistance', unit: 'ohm', typ: '30m' },
            { key: 'SRF', label: 'Self-resonant freq', unit: 'Hz', typ: '20M' }
        ],
        equations: [
            { name: 'Constitutive', expr: 'v = L di/dt' },
            { name: 'Impedance', expr: 'Zl = j w L' },
            { name: 'Energy', expr: 'E = 1/2 L I^2' },
            { name: 'Ripple current', expr: 'dI = V x t_on / L' }
        ],
        study: {
            what: 'Stores energy in a magnetic field; opposes any change in the current through it.',
            remember: [
                'Interrupting inductor current makes an arbitrarily large voltage - that is why flyback diodes exist.',
                'Above its self-resonant frequency an inductor behaves as a capacitor.'
            ],
            gotchas: [
                'Saturation is a soft, thermal-looking failure: inductance collapses, current spikes, the FET dies.',
                'Datasheet Isat and Irms are different limits - the smaller one governs.'
            ]
        },
        spice: 'L{ref} {a} {b} {L}'
    });

    define({
        key: 'inductor_core',
        name: 'Ferrite-core Inductor',
        category: 'Passives',
        refdes: 'L',
        aliases: ['choke', 'cored inductor'],
        pins: [
            { name: 'a', x: -25, y: 0, dir: 'W' },
            { name: 'b', x: 25, y: 0, dir: 'E' }
        ],
        body: { x: -16, y: -8, w: 32, h: 14 },
        ops: [
            ['line', -25, 0, -16, 0],
            ['arc', -12, 0, 4, 180, 0],
            ['arc', -4, 0, 4, 180, 0],
            ['arc', 4, 0, 4, 180, 0],
            ['arc', 12, 0, 4, 180, 0],
            ['line', 16, 0, 25, 0],
            // Two parallel bars = magnetic core.
            ['line', -16, 5, 16, 5],
            ['line', -16, 8, 16, 8]
        ],
        params: [
            { key: 'L', label: 'Inductance', unit: 'H', typ: '100u' },
            { key: 'material', label: 'Core material', unit: '', typ: 'ferrite', note: 'Powdered iron for soft saturation' },
            { key: 'Isat', label: 'Saturation current', unit: 'A', typ: '3' }
        ],
        equations: [
            { name: 'Core flux', expr: 'B = L I / (N Ae)' },
            { name: 'Core loss', expr: 'Pcore ~ k f^a B^b', note: 'Steinmetz; a ~ 1.3, b ~ 2.5' }
        ],
        study: {
            what: 'An inductor wound on a magnetic core, which multiplies inductance per turn but can saturate.',
            remember: ['Ferrite saturates hard and fast; powdered iron rolls off gently.'],
            gotchas: ['Core loss is a function of flux swing and frequency, not of average current.']
        }
    });

    define({
        key: 'transformer',
        name: 'Transformer',
        category: 'Passives',
        refdes: 'T',
        aliases: ['xfmr', 'isolation transformer'],
        toy: 'COMP_TRANSFORMER',
        pins: [
            { name: 'p1', x: -25, y: -20, dir: 'W' },
            { name: 'p2', x: -25, y: 20, dir: 'W' },
            { name: 's1', x: 25, y: -20, dir: 'E' },
            { name: 's2', x: 25, y: 20, dir: 'E' }
        ],
        body: { x: -12, y: -24, w: 24, h: 48 },
        ops: [
            // Primary winding (left), four humps down the vertical axis.
            ['line', -25, -20, -10, -20],
            ['arc', -10, -15, 5, 270, 90, { sweep: 0 }],
            ['arc', -10, -5, 5, 270, 90, { sweep: 0 }],
            ['arc', -10, 5, 5, 270, 90, { sweep: 0 }],
            ['arc', -10, 15, 5, 270, 90, { sweep: 0 }],
            ['line', -25, 20, -10, 20],
            // Core.
            ['line', -2, -24, -2, 24],
            ['line', 2, -24, 2, 24],
            // Secondary winding (right).
            ['line', 25, -20, 10, -20],
            ['arc', 10, -15, 5, 270, 90],
            ['arc', 10, -5, 5, 270, 90],
            ['arc', 10, 5, 5, 270, 90],
            ['arc', 10, 15, 5, 270, 90],
            ['line', 25, 20, 10, 20],
            // Dot convention - the only thing that fixes relative polarity.
            ['dot', -16, -24],
            ['dot', 16, -24]
        ],
        params: [
            { key: 'N', label: 'Turns ratio Np:Ns', unit: '', typ: '10:1' },
            { key: 'Lm', label: 'Magnetising inductance', unit: 'H', typ: '10m' },
            { key: 'Llk', label: 'Leakage inductance', unit: 'H', typ: '50u' },
            { key: 'Viso', label: 'Isolation voltage', unit: 'V', typ: '3000' }
        ],
        equations: [
            { name: 'Voltage ratio', expr: 'Vs / Vp = Ns / Np' },
            { name: 'Current ratio', expr: 'Is / Ip = Np / Ns' },
            { name: 'Impedance ratio', expr: 'Zp / Zs = (Np / Ns)^2' },
            { name: 'Volt-second balance', expr: 'V x t must sum to zero over a cycle, or the core walks into saturation' }
        ],
        study: {
            what: 'Two magnetically coupled windings: transforms voltage, current and impedance, and provides galvanic isolation.',
            remember: [
                'The dots mark terminals that go positive together. Get them wrong and a flyback becomes a forward converter.',
                'Impedance transforms as the square of the turns ratio - the basis of impedance matching.'
            ],
            gotchas: [
                'Leakage inductance does not couple; it rings with winding capacitance and needs a snubber.',
                'Any DC in the primary walks the core toward saturation.'
            ]
        }
    });

    define({
        key: 'crystal',
        name: 'Crystal',
        category: 'Passives',
        refdes: 'Y',
        aliases: ['xtal', 'quartz'],
        toy: 'COMP_CRYSTAL',
        pins: [
            { name: 'a', x: -25, y: 0, dir: 'W' },
            { name: 'b', x: 25, y: 0, dir: 'E' }
        ],
        body: { x: -8, y: -12, w: 16, h: 24 },
        ops: [
            ['line', -25, 0, -8, 0],
            ['line', -8, -12, -8, 12],
            ['rect', -4, -12, 8, 24],
            ['line', 8, -12, 8, 12],
            ['line', 8, 0, 25, 0]
        ],
        params: [
            { key: 'f', label: 'Frequency', unit: 'Hz', typ: '16M' },
            { key: 'CL', label: 'Load capacitance', unit: 'F', typ: '18p', note: 'Must be matched by the circuit' },
            { key: 'ESR', label: 'Series resistance', unit: 'ohm', typ: '50' },
            { key: 'tol', label: 'Tolerance', unit: 'ppm', typ: '20' }
        ],
        equations: [
            { name: 'Load capacitors', expr: 'CL = (C1 C2) / (C1 + C2) + Cstray', note: 'Cstray ~ 3-5 pF' },
            { name: 'Pullability', expr: 'df/f = C1 / (2 (C0 + CL))' },
            { name: 'Negative resistance margin', expr: '|Rneg| >= 5 x ESR' }
        ],
        study: {
            what: 'A piezoelectric resonator with an extremely high Q - the frequency reference for nearly every digital system.',
            remember: [
                'The crystal does not set the frequency alone; the load capacitors pull it onto the specified value.',
                'Aim for at least 5x negative-resistance margin so it starts reliably at cold temperature.'
            ],
            gotchas: [
                'Overdriving a watch crystal (32.768 kHz) ages it and can crack it - respect the drive-level spec.',
                'Wrong load capacitors do not stop oscillation, they just put the frequency off by tens of ppm.'
            ]
        }
    });

    define({
        key: 'ferrite_bead',
        name: 'Ferrite Bead',
        category: 'Passives',
        refdes: 'FB',
        aliases: ['bead', 'emi filter'],
        pins: [
            { name: 'a', x: -25, y: 0, dir: 'W' },
            { name: 'b', x: 25, y: 0, dir: 'E' }
        ],
        body: { x: -12, y: -7, w: 24, h: 14 },
        ops: [
            ['line', -25, 0, -12, 0],
            ['rect', -12, -7, 24, 14, { rx: 3 }],
            ['line', 12, 0, 25, 0]
        ],
        params: [
            { key: 'Z', label: 'Impedance at 100 MHz', unit: 'ohm', typ: '600' },
            { key: 'Idc', label: 'Rated DC current', unit: 'A', typ: '0.5' },
            { key: 'DCR', label: 'DC resistance', unit: 'ohm', typ: '0.3' }
        ],
        equations: [
            { name: 'Model', expr: 'Below resonance it is inductive; at resonance it is a resistor; above it is capacitive' }
        ],
        study: {
            what: 'A lossy inductor that turns high-frequency noise into heat instead of reflecting it.',
            remember: ['Rated by impedance at 100 MHz, not by inductance.'],
            gotchas: [
                'DC bias collapses the impedance - a 600 ohm bead at rated current may give 200 ohm.',
                'A bead plus a bulk capacitor forms an LC that can peak; damp it or you amplify the noise you meant to kill.'
            ]
        }
    });

    define({
        key: 'fuse',
        name: 'Fuse',
        category: 'Passives',
        refdes: 'F',
        aliases: ['ppt', 'polyfuse'],
        pins: [
            { name: 'a', x: -25, y: 0, dir: 'W' },
            { name: 'b', x: 25, y: 0, dir: 'E' }
        ],
        body: { x: -14, y: -7, w: 28, h: 14 },
        ops: [
            ['line', -25, 0, -14, 0],
            ['rect', -14, -7, 28, 14, { rx: 2 }],
            ['line', -14, 0, 14, 0],
            ['line', 14, 0, 25, 0]
        ],
        params: [
            { key: 'I', label: 'Rated current', unit: 'A', typ: '2' },
            { key: 'type', label: 'Speed', unit: '', typ: 'slow-blow', note: 'Fast for semiconductors' },
            { key: 'I2t', label: 'Melting integral', unit: 'A^2 s', typ: '5' },
            { key: 'V', label: 'Voltage rating', unit: 'V', typ: '250', note: 'Must exceed circuit voltage' }
        ],
        equations: [
            { name: 'Melting energy', expr: 'I^2 t = constant' },
            { name: 'Derating', expr: 'Continuous current <= 0.75 x rating', note: 'Higher derating at high ambient' }
        ],
        study: {
            what: 'A deliberate weak link that opens the circuit before something more expensive does.',
            remember: ['A fuse protects wiring and prevents fire; it rarely saves the semiconductor that failed.'],
            gotchas: [
                'Voltage rating matters: an underrated fuse arcs across the gap instead of clearing.',
                'A resettable polyfuse never returns fully to its original resistance.'
            ]
        }
    });

    define({
        key: 'thermistor',
        name: 'Thermistor (NTC)',
        category: 'Passives',
        refdes: 'RT',
        aliases: ['ntc', 'ptc', 'temperature sensor'],
        pins: [
            { name: 'a', x: -25, y: 0, dir: 'W' },
            { name: 'b', x: 25, y: 0, dir: 'E' }
        ],
        body: { x: -15, y: -10, w: 30, h: 20 },
        ops: [
            ['line', -25, 0, -15, 0],
            ['rect', -15, -7, 30, 14],
            ['line', 15, 0, 25, 0],
            // Diagonal slash with the "t" tail marks a temperature-dependent part.
            ['line', -18, 10, 12, -10],
            ['line', -18, 10, -18, 4]
        ],
        params: [
            { key: 'R25', label: 'Resistance at 25 degC', unit: 'ohm', typ: '10k' },
            { key: 'B', label: 'Beta constant', unit: 'K', typ: '3950' },
            { key: 'tol', label: 'Tolerance', unit: '%', typ: '1' }
        ],
        equations: [
            { name: 'Beta model', expr: 'R(T) = R25 x exp(B (1/T - 1/298.15))', note: 'T in kelvin' },
            { name: 'Steinhart-Hart', expr: '1/T = A + B ln(R) + C (ln R)^3', note: 'Better than 0.1 degC over a wide span' }
        ],
        study: {
            what: 'A resistor whose value changes strongly and predictably with temperature.',
            remember: ['NTC falls with temperature; PTC rises, and a switching PTC rises almost vertically at its trip point.'],
            gotchas: [
                'Self-heating from the measurement current is a real error source - keep dissipation in the microwatts.',
                'The response is very non-linear; linearise in software or with a parallel resistor.'
            ]
        }
    });

    // -------------------------------------------------------------------
    // SOURCES AND POWER
    // -------------------------------------------------------------------

    define({
        key: 'vsource',
        name: 'DC Voltage Source',
        category: 'Sources',
        refdes: 'V',
        aliases: ['voltage source', 'dc source'],
        toy: 'COMP_VSOURCE',
        pins: [
            { name: 'plus', x: 0, y: -25, dir: 'N' },
            { name: 'minus', x: 0, y: 25, dir: 'S' }
        ],
        body: { x: -15, y: -15, w: 30, h: 30 },
        ops: [
            ['line', 0, -25, 0, -15],
            ['circle', 0, 0, 15],
            ['line', 0, 15, 0, 25],
            ['line', -5, -7, 5, -7],
            ['line', 0, -12, 0, -2],
            ['line', -5, 7, 5, 7]
        ],
        params: [
            { key: 'V', label: 'Voltage', unit: 'V', typ: '5' },
            { key: 'Rout', label: 'Source resistance', unit: 'ohm', typ: '0', note: 'Ideal source is 0' }
        ],
        equations: [
            { name: 'Ideal', expr: 'V is fixed regardless of current' },
            { name: 'Thevenin', expr: 'Vout = V - I x Rout' }
        ],
        study: {
            what: 'Holds its terminal voltage fixed and supplies whatever current the circuit demands.',
            remember: ['An ideal voltage source has zero output impedance and infinite current capability - neither is real.'],
            gotchas: ['Never short an ideal voltage source or parallel two of different voltage: the model gives infinite current, the bench gives smoke.']
        },
        spice: 'V{ref} {plus} {minus} DC {V}'
    });

    define({
        key: 'battery',
        name: 'Battery',
        category: 'Sources',
        refdes: 'BT',
        aliases: ['cell', 'batt'],
        toy: 'COMP_BATTERY',
        pins: [
            { name: 'plus', x: 0, y: -25, dir: 'N' },
            { name: 'minus', x: 0, y: 25, dir: 'S' }
        ],
        body: { x: -12, y: -10, w: 24, h: 20 },
        ops: [
            ['line', 0, -25, 0, -10],
            // Two cells: long plate = +, short plate = -
            ['line', -12, -10, 12, -10],
            ['line', -6, -5, 6, -5],
            ['line', -12, 2, 12, 2],
            ['line', -6, 7, 6, 7],
            ['line', 0, 7, 0, 25],
            ['text', 16, -6, '+', { size: 11, anchor: 'start' }]
        ],
        params: [
            { key: 'V', label: 'Nominal voltage', unit: 'V', typ: '3.7', note: 'Li-ion cell' },
            { key: 'Q', label: 'Capacity', unit: 'Ah', typ: '2.5' },
            { key: 'Rint', label: 'Internal resistance', unit: 'ohm', typ: '50m' }
        ],
        equations: [
            { name: 'Runtime', expr: 't = Q / I', note: 'Only true at the rated discharge rate' },
            { name: 'Terminal voltage', expr: 'Vt = Voc - I Rint' },
            { name: 'C-rate', expr: '1C = the current that empties the pack in one hour' }
        ],
        study: {
            what: 'An electrochemical voltage source with real internal resistance and a state-of-charge-dependent voltage.',
            remember: [
                'Li-ion: 4.2 V full, 3.7 V nominal, 3.0 V empty. Below 2.5 V the cell is damaged.',
                'Internal resistance rises as the cell ages and as it gets cold.'
            ],
            gotchas: [
                'Capacity is quoted at a low discharge rate; at high current you get much less (Peukert effect).',
                'Never charge a lithium cell below 0 degC - it plates lithium metal and can short internally.'
            ]
        }
    });

    define({
        key: 'acsource',
        name: 'AC Source',
        category: 'Sources',
        refdes: 'V',
        aliases: ['ac', 'signal generator', 'sine source'],
        toy: 'COMP_AC_SOURCE',
        pins: [
            { name: 'plus', x: 0, y: -25, dir: 'N' },
            { name: 'minus', x: 0, y: 25, dir: 'S' }
        ],
        body: { x: -15, y: -15, w: 30, h: 30 },
        ops: [
            ['line', 0, -25, 0, -15],
            ['circle', 0, 0, 15],
            ['line', 0, 15, 0, 25],
            ['path', 'M -8 0 Q -4 -8 0 0 Q 4 8 8 0']
        ],
        params: [
            { key: 'A', label: 'Amplitude', unit: 'Vpk', typ: '1' },
            { key: 'f', label: 'Frequency', unit: 'Hz', typ: '1k' },
            { key: 'phase', label: 'Phase', unit: 'deg', typ: '0' },
            { key: 'offset', label: 'DC offset', unit: 'V', typ: '0' }
        ],
        equations: [
            { name: 'Waveform', expr: 'v(t) = A sin(2 pi f t + phi) + Voffset' },
            { name: 'RMS of a sine', expr: 'Vrms = Vpk / sqrt(2) = 0.707 Vpk' },
            { name: 'Peak-to-peak', expr: 'Vpp = 2 Vpk = 2.828 Vrms' }
        ],
        study: {
            what: 'A sinusoidal excitation - the basis of every frequency-domain measurement.',
            remember: ['Bench generators are 50 ohm sources: into a high-impedance load you get twice the amplitude the dial says.'],
            gotchas: ['RMS only equals Vpk/sqrt(2) for a pure sine. For anything else you must compute it.']
        },
        spice: 'V{ref} {plus} {minus} SIN(0 {A} {f})'
    });

    define({
        key: 'isource',
        name: 'Current Source',
        category: 'Sources',
        refdes: 'I',
        aliases: ['current source'],
        toy: 'COMP_ISOURCE',
        pins: [
            { name: 'out', x: 0, y: -25, dir: 'N' },
            { name: 'in', x: 0, y: 25, dir: 'S' }
        ],
        body: { x: -15, y: -15, w: 30, h: 30 },
        ops: [
            ['line', 0, -25, 0, -15],
            ['circle', 0, 0, 15],
            ['line', 0, 15, 0, 25],
            ['line', 0, 9, 0, -6],
            ['poly', [[0, -10], [-4, -3], [4, -3]], { fill: true }]
        ],
        params: [
            { key: 'I', label: 'Current', unit: 'A', typ: '1m' },
            { key: 'Rout', label: 'Output resistance', unit: 'ohm', typ: 'inf', note: 'Ideal source is infinite' },
            { key: 'Vcomp', label: 'Compliance', unit: 'V', typ: '10', note: 'Headroom before it drops out' }
        ],
        equations: [
            { name: 'Ideal', expr: 'I is fixed regardless of the voltage across it' },
            { name: 'Norton', expr: 'Iout = I - V / Rout' }
        ],
        study: {
            what: 'Forces a fixed current through whatever is connected, adjusting its voltage to do so.',
            remember: [
                'Every real current source has a compliance range; outside it, it is just a resistor.',
                'The arrow points in the direction of conventional current flow.'
            ],
            gotchas: ['Never open-circuit a current source: the model demands infinite voltage.']
        },
        spice: 'I{ref} {in} {out} DC {I}'
    });

    define({
        key: 'ground',
        name: 'Ground',
        category: 'Power',
        refdes: '',
        aliases: ['gnd', '0v', 'agnd', 'dgnd'],
        toy: 'COMP_GROUND',
        pins: [
            { name: 'gnd', x: 0, y: -10, dir: 'N' }
        ],
        body: { x: -12, y: -10, w: 24, h: 18 },
        ops: [
            ['line', 0, -10, 0, 0],
            ['line', -12, 0, 12, 0],
            ['line', -8, 4, 8, 4],
            ['line', -4, 8, 4, 8]
        ],
        params: [],
        equations: [
            { name: 'Reference', expr: 'V = 0 by definition - every other node voltage is measured against it' }
        ],
        study: {
            what: 'The node all other voltages are referenced to. It is a choice, not a physical property.',
            remember: [
                'Ground is not zero impedance. Return current follows the path of least impedance, which above ~10 kHz is the path of least loop area, directly under the trace.',
                'Separate analog and digital grounds meet at exactly one point, or not at all if you use a solid plane.'
            ],
            gotchas: [
                'A "ground loop" is a loop of ground conductor enclosing a changing magnetic field - it injects a real voltage.',
                'Two grounds connected by a wire are two different nodes at high frequency.'
            ]
        }
    });

    define({
        key: 'vcc',
        name: 'Positive Supply',
        category: 'Power',
        refdes: '',
        aliases: ['vdd', 'v+', 'rail'],
        pins: [
            { name: 'vcc', x: 0, y: 10, dir: 'S' }
        ],
        body: { x: -10, y: -8, w: 20, h: 18 },
        ops: [
            ['line', 0, 10, 0, 0],
            ['line', -9, 0, 9, 0],
            ['poly', [[0, -8], [-6, 0], [6, 0]], { fill: true }]
        ],
        params: [],
        equations: [],
        study: {
            what: 'A power-rail symbol; every instance on a sheet is the same electrical node.',
            remember: ['Label the rail with its voltage. "VCC" alone is ambiguous on a mixed 3.3 V / 5 V board.'],
            gotchas: ['Each IC power pin still needs its own decoupling capacitor - the symbol hides the actual impedance.']
        }
    });

    define({
        key: 'vee',
        name: 'Negative Supply',
        category: 'Power',
        refdes: '',
        aliases: ['vss', 'v-'],
        pins: [
            { name: 'vee', x: 0, y: -10, dir: 'N' }
        ],
        body: { x: -10, y: -10, w: 20, h: 18 },
        ops: [
            ['line', 0, -10, 0, 0],
            ['line', -9, 0, 9, 0],
            ['poly', [[0, 8], [-6, 0], [6, 0]], { fill: true }]
        ],
        params: [],
        equations: [],
        study: {
            what: 'The negative rail of a split supply.',
            remember: ['A split supply lets an amplifier swing symmetrically about ground without coupling capacitors.'],
            gotchas: ['Sequencing matters: bringing up V+ before V- can forward-bias substrate diodes in some op-amps.']
        }
    });

    // -------------------------------------------------------------------
    // DIODES
    // -------------------------------------------------------------------

    // Shared diode geometry: triangle pointing right into a cathode bar.
    const diodeBody = () => ([
        ['line', -25, 0, -8, 0],
        ['poly', [[-8, -10], [-8, 10], [8, 0]], { fill: true }],
        ['line', 8, -10, 8, 10],
        ['line', 8, 0, 25, 0]
    ]);

    define({
        key: 'diode',
        name: 'Diode',
        category: 'Diodes',
        refdes: 'D',
        aliases: ['rectifier', 'pn junction'],
        toy: 'COMP_DIODE',
        pins: [
            { name: 'anode', x: -25, y: 0, dir: 'W' },
            { name: 'cathode', x: 25, y: 0, dir: 'E' }
        ],
        body: { x: -8, y: -10, w: 16, h: 20 },
        ops: diodeBody(),
        params: [
            { key: 'Vf', label: 'Forward voltage', unit: 'V', typ: '0.7', note: '0.3 V Schottky, 1.8-3.4 V LED' },
            { key: 'If', label: 'Forward current', unit: 'A', typ: '1' },
            { key: 'Vr', label: 'Reverse voltage', unit: 'V', typ: '100' },
            { key: 'trr', label: 'Reverse recovery', unit: 's', typ: '2u', note: 'Near zero for Schottky' }
        ],
        equations: [
            { name: 'Shockley', expr: 'I = Is (exp(V / (n VT)) - 1)' },
            { name: 'Slope', expr: '60 mV per decade of current at 25 degC (n = 1)' },
            { name: 'Tempco', expr: 'dVf/dT = -2 mV/degC' },
            { name: 'Dynamic resistance', expr: 'rd = VT / I = 26 / I(mA) ohm' }
        ],
        study: {
            what: 'A one-way valve for current: conducts above roughly 0.6 V forward, blocks in reverse until it breaks down.',
            remember: [
                'Vf is not a constant. It moves about 60 mV per decade of current and -2 mV per degC.',
                'The bar on the symbol is the cathode - current flows toward the bar.'
            ],
            gotchas: [
                'Reverse recovery charge dumps a current spike through the switch in a converter; that spike is a major loss and EMI source.',
                'Reverse leakage roughly doubles every 10 degC.'
            ]
        },
        spice: 'D{ref} {anode} {cathode} {model}'
    });

    define({
        key: 'zener',
        name: 'Zener Diode',
        category: 'Diodes',
        refdes: 'D',
        aliases: ['voltage reference diode'],
        toy: 'COMP_ZENER',
        pins: [
            { name: 'anode', x: -25, y: 0, dir: 'W' },
            { name: 'cathode', x: 25, y: 0, dir: 'E' }
        ],
        body: { x: -8, y: -10, w: 16, h: 20 },
        ops: [
            ['line', -25, 0, -8, 0],
            ['poly', [[-8, -10], [-8, 10], [8, 0]], { fill: true }],
            // Cathode bar with the Z-shaped tails.
            ['poly', [[3, -14], [8, -10], [8, 10], [13, 14]], { close: false }],
            ['line', 8, 0, 25, 0]
        ],
        params: [
            { key: 'Vz', label: 'Zener voltage', unit: 'V', typ: '5.1' },
            { key: 'Iz', label: 'Test current', unit: 'A', typ: '5m' },
            { key: 'Pz', label: 'Power rating', unit: 'W', typ: '0.5' },
            { key: 'Zz', label: 'Dynamic impedance', unit: 'ohm', typ: '10' }
        ],
        equations: [
            { name: 'Regulation', expr: 'dV = Iz x Zz', note: 'Zz is the reason a zener is a mediocre reference' },
            { name: 'Series resistor', expr: 'Rs = (Vin - Vz) / (Iz + Iload)' },
            { name: 'Tempco', expr: 'Negative below 5 V (zener effect), positive above 6 V (avalanche); ~5.6 V is the null' }
        ],
        study: {
            what: 'A diode operated deliberately in reverse breakdown, where it holds a roughly constant voltage.',
            remember: [
                'A 5.6 V zener has close to zero temperature coefficient - that is why 5.6 V and 6.2 V references are so common.',
                'Always size the series resistor for the no-load case, where the zener takes all the current.'
            ],
            gotchas: [
                'Dynamic impedance means the "regulated" voltage moves with load current.',
                'Zeners are noisy - a few uV/sqrt(Hz), far worse than a bandgap reference.'
            ]
        }
    });

    define({
        key: 'schottky',
        name: 'Schottky Diode',
        category: 'Diodes',
        refdes: 'D',
        aliases: ['hot carrier diode'],
        pins: [
            { name: 'anode', x: -25, y: 0, dir: 'W' },
            { name: 'cathode', x: 25, y: 0, dir: 'E' }
        ],
        body: { x: -8, y: -10, w: 16, h: 20 },
        ops: [
            ['line', -25, 0, -8, 0],
            ['poly', [[-8, -10], [-8, 10], [8, 0]], { fill: true }],
            // Cathode bar with S-shaped (square) tails.
            ['poly', [[2, -6], [2, -10], [8, -10], [8, 10], [14, 10], [14, 6]], { close: false }],
            ['line', 8, 0, 25, 0]
        ],
        params: [
            { key: 'Vf', label: 'Forward voltage', unit: 'V', typ: '0.35' },
            { key: 'Vr', label: 'Reverse voltage', unit: 'V', typ: '40' },
            { key: 'Ir', label: 'Reverse leakage', unit: 'A', typ: '100u', note: 'Far worse than a PN diode' }
        ],
        equations: [
            { name: 'Conduction loss', expr: 'P = Vf x Iavg', note: 'Roughly half a silicon diode' }
        ],
        study: {
            what: 'A metal-semiconductor junction diode: low forward drop and essentially no reverse recovery.',
            remember: ['The default choice for rectifiers in switching supplies below about 100 V.'],
            gotchas: [
                'Reverse leakage is large and grows fast with temperature - it can run away thermally in a hot rectifier.',
                'Low reverse voltage ratings compared to silicon PN diodes.'
            ]
        }
    });

    define({
        key: 'led',
        name: 'LED',
        category: 'Diodes',
        refdes: 'D',
        aliases: ['light emitting diode', 'indicator'],
        toy: 'COMP_LED',
        pins: [
            { name: 'anode', x: -25, y: 0, dir: 'W' },
            { name: 'cathode', x: 25, y: 0, dir: 'E' }
        ],
        body: { x: -8, y: -16, w: 16, h: 26 },
        ops: [
            ['line', -25, 0, -8, 0],
            ['poly', [[-8, -10], [-8, 10], [8, 0]], { fill: true }],
            ['line', 8, -10, 8, 10],
            ['line', 8, 0, 25, 0],
            // Two emission arrows, pointing away from the junction.
            ['line', 0, -13, 7, -20],
            ['poly', [[9, -22], [3, -20], [7, -16]], { fill: true }],
            ['line', 6, -13, 13, -20],
            ['poly', [[15, -22], [9, -20], [13, -16]], { fill: true }]
        ],
        params: [
            { key: 'Vf', label: 'Forward voltage', unit: 'V', typ: '2.0', note: 'Red 1.8-2.2, blue/white 3.0-3.4' },
            { key: 'If', label: 'Forward current', unit: 'A', typ: '10m' },
            { key: 'Iv', label: 'Luminous intensity', unit: 'mcd', typ: '200' }
        ],
        equations: [
            { name: 'Series resistor', expr: 'R = (Vsupply - Vf) / If' },
            { name: 'Photon energy', expr: 'Vf ~ hc / (q lambda)', note: 'Shorter wavelength needs more forward voltage' }
        ],
        study: {
            what: 'A diode whose recombination energy leaves as photons instead of heat.',
            remember: [
                'Always current-driven, never voltage-driven: a 0.1 V change in drive can double the current.',
                'Perceived brightness is roughly logarithmic in current, so PWM dimming looks more linear than analog dimming.'
            ],
            gotchas: [
                'Reverse breakdown is only about 5 V for many LEDs - add an anti-parallel diode on AC.',
                'Paralleling LEDs without individual resistors makes the lowest-Vf part hog the current.'
            ]
        }
    });

    define({
        key: 'photodiode',
        name: 'Photodiode',
        category: 'Diodes',
        refdes: 'D',
        aliases: ['light sensor', 'pin diode'],
        pins: [
            { name: 'anode', x: -25, y: 0, dir: 'W' },
            { name: 'cathode', x: 25, y: 0, dir: 'E' }
        ],
        body: { x: -8, y: -22, w: 16, h: 32 },
        ops: [
            ['line', -25, 0, -8, 0],
            ['poly', [[-8, -10], [-8, 10], [8, 0]], { fill: true }],
            ['line', 8, -10, 8, 10],
            ['line', 8, 0, 25, 0],
            // Arrows pointing IN toward the junction - the inverse of the LED.
            ['line', 9, -22, 2, -15],
            ['poly', [[0, -13], [6, -15], [2, -19]], { fill: true }],
            ['line', 15, -22, 8, -15],
            ['poly', [[6, -13], [12, -15], [8, -19]], { fill: true }]
        ],
        params: [
            { key: 'R', label: 'Responsivity', unit: 'A/W', typ: '0.5' },
            { key: 'Id', label: 'Dark current', unit: 'A', typ: '1n' },
            { key: 'Cj', label: 'Junction capacitance', unit: 'F', typ: '20p', note: 'Falls with reverse bias' }
        ],
        equations: [
            { name: 'Photocurrent', expr: 'Iph = R x Popt' },
            { name: 'Transimpedance gain', expr: 'Vout = -Iph x Rf' },
            { name: 'TIA bandwidth', expr: 'f = 1 / (2 pi Rf Cf); set Cf = sqrt(Cj / (2 pi Rf GBW))' }
        ],
        study: {
            what: 'A reverse-biased junction that produces current proportional to incident optical power.',
            remember: [
                'Photovoltaic mode (zero bias) is low-noise and slow; photoconductive mode (reverse bias) is fast and noisier.',
                'Always read it with a transimpedance amplifier, never across a resistor into a voltage amp.'
            ],
            gotchas: [
                'Junction capacitance and the feedback resistor set a noise peak - the feedback capacitor Cf is not optional.',
                'Dark current doubles roughly every 10 degC.'
            ]
        }
    });

    define({
        key: 'tvs',
        name: 'TVS Diode',
        category: 'Diodes',
        refdes: 'D',
        aliases: ['transient suppressor', 'esd diode'],
        pins: [
            { name: 'a', x: -25, y: 0, dir: 'W' },
            { name: 'b', x: 25, y: 0, dir: 'E' }
        ],
        body: { x: -10, y: -12, w: 20, h: 24 },
        ops: [
            // Back-to-back zeners: the bidirectional TVS.
            ['line', -25, 0, -14, 0],
            ['poly', [[-14, -10], [-14, 10], [0, 0]], { fill: true }],
            ['poly', [[-5, -14], [0, -10], [0, 10], [5, 14]], { close: false }],
            ['poly', [[14, -10], [14, 10], [0, 0]], { fill: true }],
            ['line', 14, 0, 25, 0]
        ],
        params: [
            { key: 'Vrwm', label: 'Working voltage', unit: 'V', typ: '5', note: 'Must exceed the signal' },
            { key: 'Vbr', label: 'Breakdown', unit: 'V', typ: '6' },
            { key: 'Vc', label: 'Clamping voltage', unit: 'V', typ: '9.2', note: 'At the peak pulse current' },
            { key: 'Ppp', label: 'Peak pulse power', unit: 'W', typ: '400', note: 'For a 10/1000 us pulse' }
        ],
        equations: [
            { name: 'Clamp current', expr: 'Ipp = (Vsurge - Vc) / Rseries' },
            { name: 'Energy', expr: 'E = Vc x Ipp x t_pulse' }
        ],
        study: {
            what: 'An avalanche diode built to absorb a large, brief surge and clamp the line.',
            remember: [
                'Working voltage must be above the highest normal signal, or the TVS leaks and heats continuously.',
                'A small series resistor or ferrite ahead of the TVS makes it far more effective.'
            ],
            gotchas: [
                'Clamping voltage is much higher than breakdown voltage - size the protected input against Vc, not Vbr.',
                'The capacitance of a power TVS will destroy a high-speed signal; use a low-capacitance ESD part instead.'
            ]
        }
    });

    /**
     * One diode of a bridge, centred at (cx, cy) and conducting toward
     * the unit vector (dx, dy): filled triangle plus its cathode bar.
     */
    function bridgeDiode(cx, cy, dx, dy) {
        const px = -dy, py = dx;                     // perpendicular
        const tx = cx + dx * 5, ty = cy + dy * 5;    // triangle tip
        const bx = cx - dx * 4, by = cy - dy * 4;    // base midpoint
        return [
            ['poly', [[tx, ty],
                      [bx + px * 5, by + py * 5],
                      [bx - px * 5, by - py * 5]], { fill: true }],
            ['line', tx + px * 5, ty + py * 5, tx - px * 5, ty - py * 5]
        ];
    }

    const D = Math.SQRT1_2;   // 0.7071, the 45-degree unit component

    define({
        key: 'bridge',
        name: 'Bridge Rectifier',
        category: 'Diodes',
        refdes: 'BR',
        aliases: ['full wave rectifier', 'diode bridge'],
        pins: [
            { name: 'ac1', x: -35, y: 0, dir: 'W' },
            { name: 'ac2', x: 35, y: 0, dir: 'E' },
            { name: 'plus', x: 0, y: -35, dir: 'N' },
            { name: 'minus', x: 0, y: 35, dir: 'S' }
        ],
        body: { x: -24, y: -24, w: 48, h: 48 },
        ops: [
            ['poly', [[0, -24], [24, 0], [0, 24], [-24, 0]]],
            ['line', -35, 0, -24, 0],
            ['line', 24, 0, 35, 0],
            ['line', 0, -35, 0, -24],
            ['line', 0, 24, 0, 35]
        ].concat(
            // Upper pair: AC legs -> + node.
            bridgeDiode(-12, -12, D, -D),
            bridgeDiode(12, -12, -D, -D),
            // Lower pair: - node -> AC legs.
            bridgeDiode(-12, 12, -D, -D),
            bridgeDiode(12, 12, D, -D),
            [
                ['text', -7, -28, '+', { size: 11 }],
                ['text', -7, 34, '-', { size: 13 }]
            ]
        ),
        params: [
            { key: 'Vrrm', label: 'Repetitive reverse voltage', unit: 'V', typ: '400' },
            { key: 'Iav', label: 'Average output current', unit: 'A', typ: '2' },
            { key: 'Ifsm', label: 'Surge current', unit: 'A', typ: '50', note: 'One cycle, for capacitor inrush' }
        ],
        equations: [
            { name: 'DC output', expr: 'Vdc = Vpk - 2 Vf', note: 'Two diodes conduct at a time' },
            { name: 'Ripple', expr: 'Vripple = Iload / (2 f C)', note: 'Full-wave, so 2f' },
            { name: 'RMS input current', expr: 'Irms ~ 2-3 x Idc into a capacitor load' }
        ],
        study: {
            what: 'Four diodes that turn both halves of an AC cycle into one polarity.',
            remember: ['Full-wave rectification doubles the ripple frequency, so the reservoir capacitor can be half the size.'],
            gotchas: [
                'The inrush into a discharged reservoir capacitor is limited only by wiring resistance - use an NTC or a soft-start.',
                'The bridge input current is a narrow spike, not a sine: it has a terrible power factor and high RMS heating.'
            ]
        }
    });

    // -------------------------------------------------------------------
    // BIPOLAR TRANSISTORS
    // -------------------------------------------------------------------

    // BJT skeleton. `emitterOut` = true draws the NPN arrow (pointing away
    // from the base bar); false draws the PNP arrow (pointing into it).
    function bjtOps(emitterOut) {
        const arrow = emitterOut
            // NPN: arrowhead partway along the emitter diagonal, pointing out.
            ? ['poly', [[16, 17], [6, 12], [6, 22]], { fill: true }]
            // PNP: arrowhead near the base bar, pointing in.
            : ['poly', [[2, 9], [12, 14], [12, 4]], { fill: true }];
        return [
            ['circle', 0, 0, 25],
            ['line', -25, 0, -10, 0],          // base lead
            ['line', -10, -15, -10, 15],       // base bar
            ['line', -10, -8, 15, -20],        // collector diagonal
            ['line', 15, -20, 15, -35],        // collector lead
            ['line', -10, 8, 15, 20],          // emitter diagonal
            ['line', 15, 20, 15, 35],          // emitter lead
            arrow
        ];
    }

    const BJT_PINS = [
        { name: 'base', x: -25, y: 0, dir: 'W' },
        { name: 'collector', x: 15, y: -35, dir: 'N' },
        { name: 'emitter', x: 15, y: 35, dir: 'S' }
    ];

    const BJT_PARAMS = [
        { key: 'hFE', label: 'Current gain (beta)', unit: '', typ: '100', note: 'Varies 3:1 part to part' },
        { key: 'Vce_sat', label: 'Saturation voltage', unit: 'V', typ: '0.2' },
        { key: 'Ic', label: 'Collector current', unit: 'A', typ: '100m' },
        { key: 'Vceo', label: 'Breakdown voltage', unit: 'V', typ: '40' },
        { key: 'fT', label: 'Transition frequency', unit: 'Hz', typ: '300M' }
    ];

    const BJT_EQUATIONS = [
        { name: 'Ebers-Moll', expr: 'IC = Is exp(VBE / VT)' },
        { name: 'Transconductance', expr: 'gm = IC / VT = 40 x IC(A) = IC(mA) / 26 mV' },
        { name: 'Intrinsic emitter resistance', expr: 're = VT / IE = 26 / IE(mA) ohm' },
        { name: 'Common-emitter gain', expr: 'Av = -RC / (RE + re)' },
        { name: 'Input impedance', expr: 'Zin = beta (RE + re)' },
        { name: 'VBE tempco', expr: 'dVBE/dT = -2.1 mV/degC at constant IC' }
    ];

    define({
        key: 'npn',
        name: 'NPN Transistor',
        category: 'Bipolar',
        refdes: 'Q',
        aliases: ['bjt', 'npn bjt', '2n3904'],
        toy: 'COMP_NPN',
        pins: BJT_PINS,
        body: { x: -25, y: -25, w: 50, h: 50 },
        ops: bjtOps(true),
        params: BJT_PARAMS,
        equations: BJT_EQUATIONS,
        study: {
            what: 'A current-amplifying device best understood as a voltage-controlled current source: VBE sets IC exponentially.',
            remember: [
                'The emitter arrow points OUT for NPN. "Not Pointing iN".',
                'gm = IC/VT is the one number that predicts gain; beta mostly just tells you the base current you must supply.',
                'A 60 mV change in VBE changes IC by 10x.'
            ],
            gotchas: [
                'Never design around a specific beta - it varies 3:1 across parts and doubles over temperature.',
                'Emitter degeneration trades gain for predictability, and you almost always want that trade.',
                'VBE drifts -2.1 mV/degC, so a fixed base bias thermally runs away.'
            ]
        },
        spice: 'Q{ref} {collector} {base} {emitter} {model}'
    });

    define({
        key: 'pnp',
        name: 'PNP Transistor',
        category: 'Bipolar',
        refdes: 'Q',
        aliases: ['pnp bjt', '2n3906'],
        toy: 'COMP_PNP',
        pins: BJT_PINS,
        body: { x: -25, y: -25, w: 50, h: 50 },
        ops: bjtOps(false),
        params: BJT_PARAMS,
        equations: BJT_EQUATIONS,
        study: {
            what: 'The complement of the NPN: current flows into the emitter and out of the collector.',
            remember: [
                'The emitter arrow points IN for PNP.',
                'Draw PNPs with the emitter at the top, tied toward the positive rail - the circuit reads far more clearly.'
            ],
            gotchas: [
                'PNP parts historically have lower fT and lower beta than their NPN complements.',
                'High-side switching with a PNP needs the base pulled below the emitter, which usually means a second transistor.'
            ]
        },
        spice: 'Q{ref} {collector} {base} {emitter} {model}'
    });

    define({
        key: 'phototransistor',
        name: 'Phototransistor',
        category: 'Bipolar',
        refdes: 'Q',
        aliases: ['optical sensor'],
        pins: [
            { name: 'collector', x: 15, y: -35, dir: 'N' },
            { name: 'emitter', x: 15, y: 35, dir: 'S' }
        ],
        body: { x: -25, y: -25, w: 50, h: 50 },
        ops: [
            ['circle', 0, 0, 25],
            ['line', -10, -15, -10, 15],
            ['line', -10, -8, 15, -20],
            ['line', 15, -20, 15, -35],
            ['line', -10, 8, 15, 20],
            ['line', 15, 20, 15, 35],
            ['poly', [[16, 17], [6, 12], [6, 22]], { fill: true }],
            // Light arrows in, replacing the base lead.
            ['line', -34, -12, -24, -6],
            ['poly', [[-21, -4], [-27, -3], [-25, -8]], { fill: true }],
            ['line', -34, 0, -24, 6],
            ['poly', [[-21, 8], [-27, 9], [-25, 4]], { fill: true }]
        ],
        params: [
            { key: 'Ic_on', label: 'On-state current', unit: 'A', typ: '1m', note: 'At a stated illuminance' },
            { key: 'Iceo', label: 'Dark current', unit: 'A', typ: '100n' },
            { key: 'tr', label: 'Rise time', unit: 's', typ: '5u' }
        ],
        equations: [
            { name: 'Output', expr: 'Vout = Vcc - Ic Rload', note: 'Rload sets both gain and speed' }
        ],
        study: {
            what: 'A transistor whose base current comes from light rather than from a base pin.',
            remember: ['Bigger load resistor gives more signal but proportionally less bandwidth.'],
            gotchas: ['Much slower than a photodiode plus TIA; the base-collector capacitance is multiplied by beta.']
        }
    });

    // -------------------------------------------------------------------
    // FIELD-EFFECT TRANSISTORS
    // -------------------------------------------------------------------

    /**
     * MOSFET skeleton.
     *   nChannel  - body-diode / bulk arrow direction
     *   enhancement - broken channel bar (enhancement) vs solid (depletion)
     */
    function mosOps(nChannel, enhancement) {
        const ops = [
            ['circle', 0, 0, 25],
            ['line', -25, 0, -14, 0],        // gate lead
            ['line', -14, -14, -14, 14]      // gate plate
        ];
        if (enhancement) {
            // Three separate channel segments = enhancement mode (normally off).
            ops.push(['line', -8, -14, -8, -6]);
            ops.push(['line', -8, -4, -8, 4]);
            ops.push(['line', -8, 6, -8, 14]);
        } else {
            ops.push(['line', -8, -14, -8, 14]);
        }
        ops.push(['line', -8, -10, 15, -10]);   // drain rung
        ops.push(['line', 15, -10, 15, -35]);   // drain lead
        ops.push(['line', -8, 10, 15, 10]);     // source rung
        ops.push(['line', 15, 10, 15, 35]);     // source lead
        ops.push(['line', -8, 0, 15, 0]);       // bulk rung
        ops.push(['line', 15, 0, 15, 10]);      // bulk tied to source
        // Bulk arrow: points toward the gate for N-channel, away for P.
        ops.push(nChannel
            ? ['poly', [[-4, 0], [4, -4], [4, 4]], { fill: true }]
            : ['poly', [[4, 0], [-4, -4], [-4, 4]], { fill: true }]);
        return ops;
    }

    const FET_PINS = [
        { name: 'gate', x: -25, y: 0, dir: 'W' },
        { name: 'drain', x: 15, y: -35, dir: 'N' },
        { name: 'source', x: 15, y: 35, dir: 'S' }
    ];

    const MOS_PARAMS = [
        { key: 'Vth', label: 'Threshold voltage', unit: 'V', typ: '2', note: '1-2 V for logic level' },
        { key: 'Rdson', label: 'On resistance', unit: 'ohm', typ: '20m', note: 'At a stated VGS' },
        { key: 'Qg', label: 'Total gate charge', unit: 'C', typ: '20n' },
        { key: 'Vds', label: 'Drain-source rating', unit: 'V', typ: '60' },
        { key: 'Ciss', label: 'Input capacitance', unit: 'F', typ: '1n' }
    ];

    const MOS_EQUATIONS = [
        { name: 'Saturation current', expr: 'ID = 1/2 k (VGS - Vth)^2 (1 + lambda VDS)' },
        { name: 'Triode region', expr: 'ID = k ((VGS - Vth) VDS - VDS^2 / 2)' },
        { name: 'Transconductance', expr: 'gm = 2 ID / (VGS - Vth) = sqrt(2 k ID)' },
        { name: 'Conduction loss', expr: 'Pcond = Irms^2 x Rdson' },
        { name: 'Switching loss', expr: 'Psw = 1/2 Vds Id (tr + tf) fsw' },
        { name: 'Gate drive power', expr: 'Pgate = Qg Vgs fsw' }
    ];

    define({
        key: 'nmos',
        name: 'N-channel MOSFET',
        category: 'FETs',
        refdes: 'M',
        aliases: ['nfet', 'n-channel', 'mosfet'],
        toy: 'COMP_NMOS',
        pins: FET_PINS,
        body: { x: -25, y: -25, w: 50, h: 50 },
        ops: mosOps(true, true),
        params: MOS_PARAMS,
        equations: MOS_EQUATIONS,
        study: {
            what: 'A voltage-controlled switch and amplifier: the gate draws no DC current but must be charged and discharged.',
            remember: [
                'Enhancement mode is normally off. Gate above threshold turns it on.',
                'As a switch, on-state loss is I^2 Rdson; as an amplifier it is a square-law transconductor.',
                'Low-side switching is easy; high-side needs the gate driven above the rail (bootstrap or charge pump).'
            ],
            gotchas: [
                'Rdson is quoted at VGS = 10 V. At 4.5 V it can be two to three times higher.',
                'The Miller plateau in the gate-charge curve is when all the switching loss happens - drive it hard.',
                'The body diode conducts when VDS goes negative and is slow; it dominates dead-time loss in a synchronous converter.',
                'Never leave a gate floating; static charge will turn the FET partly on.'
            ]
        },
        spice: 'M{ref} {drain} {gate} {source} {source} {model}'
    });

    define({
        key: 'pmos',
        name: 'P-channel MOSFET',
        category: 'FETs',
        refdes: 'M',
        aliases: ['pfet', 'p-channel'],
        toy: 'COMP_PMOS',
        pins: FET_PINS,
        body: { x: -25, y: -25, w: 50, h: 50 },
        ops: mosOps(false, true),
        params: MOS_PARAMS,
        equations: MOS_EQUATIONS,
        study: {
            what: 'The complement of the NMOS: turns on when the gate is pulled below the source.',
            remember: [
                'The natural choice for high-side switching and reverse-polarity protection, because the gate reference is the rail.',
                'For reverse protection, point the body diode toward the load so it conducts on correct polarity.'
            ],
            gotchas: [
                'Hole mobility is about a third of electron mobility, so a PMOS of equal Rdson is roughly 2-3x the die area and cost.',
                'VGS is negative - a gate at the source voltage means OFF, and the rating |VGS| still applies.'
            ]
        }
    });

    define({
        key: 'nmos_dep',
        name: 'Depletion NMOS',
        category: 'FETs',
        refdes: 'M',
        aliases: ['depletion mode fet'],
        pins: FET_PINS,
        body: { x: -25, y: -25, w: 50, h: 50 },
        ops: mosOps(true, false),
        params: [
            { key: 'Vth', label: 'Threshold voltage', unit: 'V', typ: '-2', note: 'Negative: normally on' },
            { key: 'Idss', label: 'Zero-gate current', unit: 'A', typ: '10m' }
        ],
        equations: [
            { name: 'Current', expr: 'ID = Idss (1 - VGS/Vth)^2' }
        ],
        study: {
            what: 'A MOSFET with a built-in channel: it conducts at VGS = 0 and is turned off by reversing the gate.',
            remember: ['Useful as a constant-current source or a start-up element in an off-line supply.'],
            gotchas: ['Normally-on behaviour is a hazard in a power path: it conducts before your control circuit has powered up.']
        }
    });

    function jfetOps(nChannel) {
        return [
            ['circle', 0, 0, 25],
            ['line', -25, 0, -8, 0],
            ['line', -8, -14, -8, 14],       // solid channel bar
            ['line', -8, -10, 15, -10],
            ['line', 15, -10, 15, -35],
            ['line', -8, 10, 15, 10],
            ['line', 15, 10, 15, 35],
            // Gate arrow on the lead: in for N-channel, out for P-channel.
            nChannel
                ? ['poly', [[-8, 0], [-16, -4], [-16, 4]], { fill: true }]
                : ['poly', [[-16, 0], [-8, -4], [-8, 4]], { fill: true }]
        ];
    }

    define({
        key: 'njfet',
        name: 'N-channel JFET',
        category: 'FETs',
        refdes: 'J',
        aliases: ['jfet', 'j201', '2n5457'],
        toy: 'COMP_JFET_N',
        pins: FET_PINS,
        body: { x: -25, y: -25, w: 50, h: 50 },
        ops: jfetOps(true),
        params: [
            { key: 'Idss', label: 'Zero-gate drain current', unit: 'A', typ: '5m' },
            { key: 'Vp', label: 'Pinch-off voltage', unit: 'V', typ: '-2' },
            { key: 'gm', label: 'Transconductance', unit: 'S', typ: '3m' }
        ],
        equations: [
            { name: 'Transfer', expr: 'ID = Idss (1 - VGS/Vp)^2' },
            { name: 'Transconductance', expr: 'gm = (2 Idss / |Vp|) (1 - VGS/Vp)' },
            { name: 'Self bias', expr: 'Rs = |VGS| / ID' }
        ],
        study: {
            what: 'A normally-on FET controlled by reverse-biasing a gate junction - very low noise, very high input impedance.',
            remember: [
                'Self-biasing with a source resistor is the standard configuration; no gate supply is needed.',
                'The classic low-noise front end for high-impedance sensors and electrometers.'
            ],
            gotchas: [
                'Forward-biasing the gate junction turns the JFET into a diode and destroys the high input impedance.',
                'Idss and Vp vary enormously between parts, so JFET circuits must be bias-insensitive.'
            ]
        }
    });

    define({
        key: 'pjfet',
        name: 'P-channel JFET',
        category: 'FETs',
        refdes: 'J',
        aliases: ['p-channel jfet'],
        pins: FET_PINS,
        body: { x: -25, y: -25, w: 50, h: 50 },
        ops: jfetOps(false),
        params: [
            { key: 'Idss', label: 'Zero-gate drain current', unit: 'A', typ: '-3m' },
            { key: 'Vp', label: 'Pinch-off voltage', unit: 'V', typ: '2' }
        ],
        equations: [
            { name: 'Transfer', expr: 'ID = Idss (1 - VGS/Vp)^2' }
        ],
        study: {
            what: 'The complementary JFET; used for the upper half of a complementary low-noise input stage.',
            remember: ['Scarcer and generally noisier than N-channel parts.'],
            gotchas: ['Same rule as N-channel: never forward-bias the gate.']
        }
    });

    define({
        key: 'igbt',
        name: 'IGBT',
        category: 'FETs',
        refdes: 'Q',
        aliases: ['insulated gate bipolar transistor'],
        pins: [
            { name: 'gate', x: -25, y: 0, dir: 'W' },
            { name: 'collector', x: 15, y: -35, dir: 'N' },
            { name: 'emitter', x: 15, y: 35, dir: 'S' }
        ],
        body: { x: -25, y: -25, w: 50, h: 50 },
        ops: [
            ['circle', 0, 0, 25],
            ['line', -25, 0, -14, 0],
            ['line', -14, -14, -14, 14],
            ['line', -8, -14, -8, 14],
            ['line', -8, -10, 15, -10],
            ['line', 15, -10, 15, -35],
            ['line', -8, 10, 15, 10],
            ['line', 15, 10, 15, 35],
            // Bipolar-style arrow on the emitter rung.
            ['poly', [[8, 10], [-2, 6], [-2, 14]], { fill: true }]
        ],
        params: [
            { key: 'Vce_sat', label: 'Saturation voltage', unit: 'V', typ: '1.7' },
            { key: 'Vces', label: 'Voltage rating', unit: 'V', typ: '1200' },
            { key: 'Ic', label: 'Collector current', unit: 'A', typ: '50' },
            { key: 'Eoff', label: 'Turn-off energy', unit: 'J', typ: '2m' }
        ],
        equations: [
            { name: 'Conduction loss', expr: 'P = Vce_sat x Iavg', note: 'A fixed drop, unlike a MOSFET' },
            { name: 'Switching loss', expr: 'P = (Eon + Eoff) x fsw' }
        ],
        study: {
            what: 'A MOSFET gate driving a bipolar output: MOS-easy to drive, bipolar-efficient at high voltage and current.',
            remember: [
                'Wins above roughly 400 V and at switching frequencies below about 20 kHz.',
                'Below that crossover a modern MOSFET or SiC part is better.'
            ],
            gotchas: [
                'The current tail at turn-off is minority-carrier recombination; it sets the frequency limit and cannot be driven away.',
                'The fixed Vce_sat means conduction loss does not fall at light load the way a MOSFET\'s does.'
            ]
        }
    });

    // -------------------------------------------------------------------
    // THYRISTORS
    // -------------------------------------------------------------------

    define({
        key: 'scr',
        name: 'SCR (Thyristor)',
        category: 'Thyristors',
        refdes: 'Q',
        aliases: ['thyristor', 'silicon controlled rectifier'],
        pins: [
            { name: 'anode', x: -25, y: 0, dir: 'W' },
            { name: 'cathode', x: 25, y: 0, dir: 'E' },
            { name: 'gate', x: 15, y: 25, dir: 'S' }
        ],
        body: { x: -8, y: -10, w: 16, h: 20 },
        ops: [
            ['line', -25, 0, -8, 0],
            ['poly', [[-8, -10], [-8, 10], [8, 0]], { fill: true }],
            ['line', 8, -10, 8, 10],
            ['line', 8, 0, 25, 0],
            ['line', 15, 25, 15, 10],
            ['line', 15, 10, 8, 5]
        ],
        params: [
            { key: 'It', label: 'On-state current', unit: 'A', typ: '8' },
            { key: 'Igt', label: 'Gate trigger current', unit: 'A', typ: '10m' },
            { key: 'Ih', label: 'Holding current', unit: 'A', typ: '20m' },
            { key: 'Vdrm', label: 'Blocking voltage', unit: 'V', typ: '600' }
        ],
        equations: [
            { name: 'Latch condition', expr: 'Fires on gate current; stays on until I < Ih' },
            { name: 'Phase control', expr: 'Vout(rms) = Vin sqrt((pi - alpha + sin(2 alpha)/2) / pi)' }
        ],
        study: {
            what: 'A latching switch: a gate pulse turns it on, and only removing the current turns it off.',
            remember: [
                'On AC it turns off naturally every zero crossing - that is what makes phase control practical.',
                'On DC you need a commutation circuit to force it off.'
            ],
            gotchas: [
                'A fast dV/dt on the anode can false-trigger it; a snubber across the device is usually mandatory.',
                'Once latched, the gate has no further control.'
            ]
        }
    });

    define({
        key: 'triac',
        name: 'TRIAC',
        category: 'Thyristors',
        refdes: 'Q',
        aliases: ['bidirectional thyristor', 'dimmer'],
        pins: [
            { name: 'mt1', x: -25, y: 0, dir: 'W' },
            { name: 'mt2', x: 25, y: 0, dir: 'E' },
            { name: 'gate', x: -15, y: 25, dir: 'S' }
        ],
        body: { x: -10, y: -12, w: 20, h: 24 },
        ops: [
            ['line', -25, 0, -10, 0],
            ['poly', [[-10, -12], [-10, 12], [2, 0]], { fill: true }],
            ['poly', [[10, -12], [10, 12], [-2, 0]], { fill: true }],
            ['line', -10, -12, -10, 12],
            ['line', 10, -12, 10, 12],
            ['line', 10, 0, 25, 0],
            ['line', -15, 25, -15, 8],
            ['line', -15, 8, -10, 6]
        ],
        params: [
            { key: 'It', label: 'RMS on-state current', unit: 'A', typ: '8' },
            { key: 'Igt', label: 'Gate trigger current', unit: 'A', typ: '10m' },
            { key: 'dVdt', label: 'Critical dV/dt', unit: 'V/us', typ: '100' }
        ],
        equations: [
            { name: 'Firing angle', expr: 'Power ~ (1/pi)(pi - alpha + sin(2 alpha)/2)' }
        ],
        study: {
            what: 'Two SCRs back to back in one package - a latching AC switch that conducts in both directions.',
            remember: ['The basis of every mains light dimmer; usually triggered through a diac from an RC phase-shift network.'],
            gotchas: [
                'Inductive loads keep current flowing past the voltage zero crossing, so commutating dV/dt can re-trigger it. Use an RC snubber.',
                'Triacs and modern LED lamps interact badly: the lamp draws too little current to hold the triac latched.'
            ]
        }
    });

    // -------------------------------------------------------------------
    // INTEGRATED CIRCUITS
    // -------------------------------------------------------------------

    const OPAMP_OPS = [
        ['poly', [[-25, -25], [-25, 25], [25, 0]]],
        ['line', -35, -10, -25, -10],
        ['line', -35, 10, -25, 10],
        ['line', 25, 0, 35, 0],
        ['text', -18, -8, '-', { size: 14 }],
        ['text', -18, 17, '+', { size: 12 }]
    ];

    define({
        key: 'opamp',
        name: 'Operational Amplifier',
        category: 'Analog ICs',
        refdes: 'U',
        aliases: ['op-amp', 'opa', 'lm358'],
        toy: 'COMP_OPAMP',
        pins: [
            { name: 'in_neg', x: -35, y: -10, dir: 'W' },
            { name: 'in_pos', x: -35, y: 10, dir: 'W' },
            { name: 'out', x: 35, y: 0, dir: 'E' },
            { name: 'vcc', x: -10, y: -25, dir: 'N' },
            { name: 'vee', x: -10, y: 25, dir: 'S' }
        ],
        body: { x: -25, y: -25, w: 50, h: 50 },
        ops: OPAMP_OPS,
        params: [
            { key: 'GBW', label: 'Gain-bandwidth product', unit: 'Hz', typ: '10M' },
            { key: 'Vos', label: 'Input offset voltage', unit: 'V', typ: '1m' },
            { key: 'Ib', label: 'Input bias current', unit: 'A', typ: '10p', note: 'nA for bipolar, pA for FET' },
            { key: 'SR', label: 'Slew rate', unit: 'V/us', typ: '10' },
            { key: 'en', label: 'Voltage noise', unit: 'V/rtHz', typ: '5n' },
            { key: 'Aol', label: 'Open-loop gain', unit: 'dB', typ: '100' }
        ],
        equations: [
            { name: 'Non-inverting gain', expr: 'Av = 1 + Rf/Rg' },
            { name: 'Inverting gain', expr: 'Av = -Rf/Rin' },
            { name: 'Closed-loop bandwidth', expr: 'f = GBW / Av' },
            { name: 'Slew limit', expr: 'fmax = SR / (2 pi Vpk)' },
            { name: 'Offset referred to output', expr: 'Vout_err = Vos (1 + Rf/Rg) + Ib Rf' }
        ],
        study: {
            what: 'A very high gain differential amplifier, made useful by negative feedback.',
            remember: [
                'The two golden rules with feedback: the inputs are at the same voltage, and no current flows into them.',
                'Gain and bandwidth trade one for one: a GBW of 10 MHz at a gain of 100 gives 100 kHz.',
                'Slew rate is a large-signal limit and is completely separate from bandwidth.'
            ],
            gotchas: [
                'Capacitive loading on the output adds a pole inside the loop and causes ringing or oscillation. Use an isolation resistor.',
                'Rail-to-rail is a claim about the output, and only to within tens of millivolts at light load.',
                'Bias current times source resistance is a DC error - balance the impedance seen by both inputs.',
                'The circuit is only stable if the feedback is negative at DC AND at the frequency where the loop gain hits unity.'
            ]
        },
        spice: 'X{ref} {in_pos} {in_neg} {vcc} {vee} {out} {model}'
    });

    define({
        key: 'comparator',
        name: 'Comparator',
        category: 'Analog ICs',
        refdes: 'U',
        aliases: ['lm393', 'voltage comparator'],
        pins: [
            { name: 'in_neg', x: -35, y: -10, dir: 'W' },
            { name: 'in_pos', x: -35, y: 10, dir: 'W' },
            { name: 'out', x: 35, y: 0, dir: 'E' }
        ],
        body: { x: -25, y: -25, w: 50, h: 50 },
        ops: OPAMP_OPS.concat([
            ['text', 2, 4, 'C', { size: 11, anchor: 'middle' }]
        ]),
        params: [
            { key: 'tpd', label: 'Propagation delay', unit: 's', typ: '300n' },
            { key: 'Vos', label: 'Input offset', unit: 'V', typ: '2m' },
            { key: 'out', label: 'Output type', unit: '', typ: 'open-collector', note: 'Needs a pull-up' }
        ],
        equations: [
            { name: 'Hysteresis (non-inverting)', expr: 'Vhyst = Vout_swing x R1 / (R1 + R2)' },
            { name: 'Thresholds', expr: 'VT+ = Vref + Vhyst/2,  VT- = Vref - Vhyst/2' }
        ],
        study: {
            what: 'An op-amp built for speed with no internal compensation: its output slams to a rail.',
            remember: [
                'Always add hysteresis. Without it, any noise near the threshold produces a burst of output edges.',
                'Many comparators have open-collector outputs and need an external pull-up.'
            ],
            gotchas: [
                'Never use an op-amp as a comparator: it is compensated for feedback, so it is slow and may not recover from saturation.',
                'Never close a linear feedback loop around a comparator - it is unstable by design.'
            ]
        }
    });

    define({
        key: 'regulator',
        name: 'Linear Regulator',
        category: 'Analog ICs',
        refdes: 'U',
        aliases: ['ldo', '7805', 'voltage regulator'],
        pins: [
            { name: 'in', x: -40, y: 0, dir: 'W' },
            { name: 'out', x: 40, y: 0, dir: 'E' },
            { name: 'gnd', x: 0, y: 20, dir: 'S' }
        ],
        body: { x: -30, y: -18, w: 60, h: 36 },
        ops: [
            ['rect', -30, -18, 60, 36, { rx: 3 }],
            ['line', -40, 0, -30, 0],
            ['line', 30, 0, 40, 0],
            ['line', 0, 18, 0, 20],
            ['text', -22, 4, 'IN', { size: 8, anchor: 'start' }],
            ['text', 22, 4, 'OUT', { size: 8, anchor: 'end' }],
            ['text', 0, -6, 'REG', { size: 9 }]
        ],
        params: [
            { key: 'Vout', label: 'Output voltage', unit: 'V', typ: '3.3' },
            { key: 'Vdo', label: 'Dropout voltage', unit: 'V', typ: '0.3', note: '2 V for an old 7805' },
            { key: 'Iout', label: 'Output current', unit: 'A', typ: '1' },
            { key: 'PSRR', label: 'Ripple rejection', unit: 'dB', typ: '60', note: 'Falls fast above 10 kHz' },
            { key: 'Iq', label: 'Quiescent current', unit: 'A', typ: '50u' }
        ],
        equations: [
            { name: 'Dissipation', expr: 'P = (Vin - Vout) x Iout + Vin x Iq' },
            { name: 'Junction temperature', expr: 'Tj = Ta + P x RthJA' },
            { name: 'Adjustable output', expr: 'Vout = Vref (1 + R1/R2)' }
        ],
        study: {
            what: 'A series pass element inside a feedback loop that burns the excess voltage as heat.',
            remember: [
                'All the dropped voltage times the load current becomes heat: 12 V to 3.3 V at 1 A is 8.7 W.',
                'Efficiency is roughly Vout/Vin, nothing more.'
            ],
            gotchas: [
                'LDO stability depends on the output capacitor\'s ESR - check the datasheet\'s stable region before substituting a ceramic.',
                'PSRR collapses at high frequency, so an LDO does not clean up switching-converter ripple as well as its DC spec suggests.',
                'Thermal shutdown protects the regulator, not your circuit\'s uptime.'
            ]
        }
    });

    define({
        key: 'optocoupler',
        name: 'Optocoupler',
        category: 'Analog ICs',
        refdes: 'U',
        aliases: ['optoisolator', '4n35', 'pc817'],
        pins: [
            { name: 'anode', x: -40, y: -15, dir: 'W' },
            { name: 'cathode', x: -40, y: 15, dir: 'W' },
            { name: 'collector', x: 40, y: -15, dir: 'E' },
            { name: 'emitter', x: 40, y: 15, dir: 'E' }
        ],
        body: { x: -30, y: -25, w: 60, h: 50 },
        ops: [
            ['rect', -30, -25, 60, 50, { rx: 3 }],
            // Input LED.
            ['line', -40, -15, -20, -15],
            ['line', -20, -15, -20, 15],
            ['line', -40, 15, -20, 15],
            ['poly', [[-24, -6], [-16, -6], [-20, 4]], { fill: true }],
            ['line', -26, 6, -14, 6],
            // Emission arrows - without these the input reads as a plain diode.
            ['line', -13, -4, -8, 1],
            ['poly', [[-6, 3], [-11, 2], [-7, -2]], { fill: true }],
            // Isolation barrier.
            ['line', -6, -22, -6, 22],
            ['line', 0, -22, 0, 22],
            // Output phototransistor.
            ['line', 40, -15, 20, -15],
            ['line', 20, -15, 20, -6],
            ['line', 12, -10, 12, 10],
            ['line', 12, -6, 20, -12],
            ['line', 12, 6, 20, 12],
            ['line', 20, 12, 20, 15],
            ['line', 40, 15, 20, 15],
            // Light arrows across the barrier.
            ['line', -11, -4, 6, -4],
            ['poly', [[9, -4], [4, -7], [4, -1]], { fill: true }]
        ],
        params: [
            { key: 'CTR', label: 'Current transfer ratio', unit: '%', typ: '100', note: 'Ic/If; varies 50-600%' },
            { key: 'Viso', label: 'Isolation voltage', unit: 'V', typ: '5000' },
            { key: 'tpd', label: 'Propagation delay', unit: 's', typ: '5u' },
            { key: 'If', label: 'LED drive current', unit: 'A', typ: '10m' }
        ],
        equations: [
            { name: 'Output current', expr: 'Ic = CTR x If' },
            { name: 'LED resistor', expr: 'R = (Vin - Vf) / If' }
        ],
        study: {
            what: 'An LED and a photodetector in one package with no electrical connection between them.',
            remember: [
                'Design for the WORST-CASE minimum CTR, and remember CTR degrades with age and temperature.',
                'The only component here that provides real galvanic isolation - the barrier is the point.'
            ],
            gotchas: [
                'A phototransistor optocoupler is slow (microseconds). For fast digital links use a logic-output opto or a digital isolator.',
                'CTR falls roughly 20-50% over the life of the part - a design that just barely works when new will fail in the field.'
            ]
        }
    });

    // -------------------------------------------------------------------
    // ELECTROMECHANICAL
    // -------------------------------------------------------------------

    define({
        key: 'switch_spst',
        name: 'Switch (SPST)',
        category: 'Electromechanical',
        refdes: 'SW',
        aliases: ['switch', 'toggle'],
        toy: 'COMP_SWITCH',
        pins: [
            { name: 'a', x: -25, y: 0, dir: 'W' },
            { name: 'b', x: 25, y: 0, dir: 'E' }
        ],
        body: { x: -12, y: -14, w: 24, h: 20 },
        ops: [
            ['line', -25, 0, -12, 0],
            ['dot', -12, 0],
            ['line', -12, 0, 10, -12],
            ['dot', 12, 0],
            ['line', 12, 0, 25, 0]
        ],
        params: [
            { key: 'I', label: 'Contact rating', unit: 'A', typ: '1' },
            { key: 'Rc', label: 'Contact resistance', unit: 'ohm', typ: '50m' },
            { key: 'bounce', label: 'Bounce time', unit: 's', typ: '5m', note: 'Up to 20 ms for large switches' }
        ],
        equations: [
            { name: 'RC debounce', expr: 'tau = R C >> bounce time; then feed a Schmitt input' }
        ],
        study: {
            what: 'A mechanical contact that makes or breaks a circuit.',
            remember: ['Every mechanical switch bounces for milliseconds; debounce in hardware or software, always.'],
            gotchas: [
                'DC contact ratings are far lower than AC ratings, because there is no zero crossing to quench the arc.',
                'Dry-circuit (low current) switching needs gold contacts; silver contacts need some current to stay clean.'
            ]
        }
    });

    define({
        key: 'switch_spdt',
        name: 'Switch (SPDT)',
        category: 'Electromechanical',
        refdes: 'SW',
        aliases: ['changeover', 'selector'],
        pins: [
            { name: 'common', x: -25, y: 0, dir: 'W' },
            { name: 'no', x: 25, y: -10, dir: 'E' },
            { name: 'nc', x: 25, y: 10, dir: 'E' }
        ],
        body: { x: -12, y: -16, w: 24, h: 32 },
        ops: [
            ['line', -25, 0, -12, 0],
            ['dot', -12, 0],
            ['line', -12, 0, 10, -10],
            ['dot', 12, -10],
            ['dot', 12, 10],
            ['line', 12, -10, 25, -10],
            ['line', 12, 10, 25, 10]
        ],
        params: [
            { key: 'I', label: 'Contact rating', unit: 'A', typ: '1' },
            { key: 'type', label: 'Make/break order', unit: '', typ: 'break-before-make' }
        ],
        equations: [],
        study: {
            what: 'A changeover contact: one common terminal routed to either of two outputs.',
            remember: ['Break-before-make is the default; make-before-break exists for circuits that must not open.'],
            gotchas: ['During the transition the common pin is floating - do not rely on it holding a logic level.']
        }
    });

    define({
        key: 'pushbutton',
        name: 'Pushbutton',
        category: 'Electromechanical',
        refdes: 'SW',
        aliases: ['momentary', 'tactile switch'],
        pins: [
            { name: 'a', x: -25, y: 0, dir: 'W' },
            { name: 'b', x: 25, y: 0, dir: 'E' }
        ],
        body: { x: -12, y: -18, w: 24, h: 22 },
        ops: [
            ['line', -25, 0, -12, 0],
            ['dot', -12, 0],
            ['dot', 12, 0],
            ['line', 12, 0, 25, 0],
            ['line', -14, -8, 14, -8],
            ['line', 0, -8, 0, -16],
            ['line', -7, -16, 7, -16]
        ],
        params: [
            { key: 'bounce', label: 'Bounce time', unit: 's', typ: '5m' },
            { key: 'life', label: 'Cycle life', unit: '', typ: '100k' }
        ],
        equations: [
            { name: 'Pull-up sizing', expr: 'R = 10k typical; tr = 2.2 R C must beat the sample rate' }
        ],
        study: {
            what: 'A momentary contact, closed only while it is pressed.',
            remember: ['Pull-up plus switch-to-ground is the standard arrangement: the idle state is defined and noise-immune.'],
            gotchas: ['Without a pull-up (or the MCU internal one enabled) the input floats and reads randomly.']
        }
    });

    define({
        key: 'relay',
        name: 'Relay',
        category: 'Electromechanical',
        refdes: 'K',
        aliases: ['contactor', 'coil'],
        toy: 'COMP_RELAY',
        pins: [
            { name: 'coil1', x: -35, y: -20, dir: 'W' },
            { name: 'coil2', x: -35, y: 20, dir: 'W' },
            { name: 'common', x: 35, y: 20, dir: 'E' },
            { name: 'no', x: 35, y: -20, dir: 'E' }
        ],
        body: { x: -22, y: -24, w: 44, h: 48 },
        ops: [
            // Coil.
            ['line', -35, -20, -22, -20],
            ['rect', -22, -20, 16, 40],
            ['line', -35, 20, -22, 20],
            // Mechanical link (dashed look via two short strokes).
            ['line', -4, 0, 2, 0],
            ['line', 6, 0, 12, 0],
            // Contacts.
            ['dot', 16, 20],
            ['line', 16, 20, 35, 20],
            ['dot', 16, -20],
            ['line', 16, -20, 35, -20],
            ['line', 16, 20, 30, 4]
        ],
        params: [
            { key: 'Vcoil', label: 'Coil voltage', unit: 'V', typ: '12' },
            { key: 'Icoil', label: 'Coil current', unit: 'A', typ: '30m' },
            { key: 'Icontact', label: 'Contact rating', unit: 'A', typ: '10' },
            { key: 'top', label: 'Operate time', unit: 's', typ: '10m' }
        ],
        equations: [
            { name: 'Coil power', expr: 'P = Vcoil^2 / Rcoil' },
            { name: 'Flyback', expr: 'A diode across the coil is mandatory; L di/dt otherwise reaches hundreds of volts' }
        ],
        study: {
            what: 'An electromagnet that mechanically closes a contact - full isolation between control and load.',
            remember: [
                'Always fit a flyback diode across the coil, or the driving transistor dies on the first release.',
                'A series resistor with the flyback diode makes the relay release faster, at the cost of a higher (but bounded) voltage spike.'
            ],
            gotchas: [
                'Contact ratings are wildly different for AC and DC, and for resistive versus inductive loads.',
                'Coil resistance rises with self-heating, so the hold current falls - that is fine, but the drop-out margin shrinks.'
            ]
        }
    });

    define({
        key: 'lamp',
        name: 'Lamp',
        category: 'Electromechanical',
        refdes: 'LP',
        aliases: ['bulb', 'incandescent'],
        pins: [
            { name: 'a', x: -25, y: 0, dir: 'W' },
            { name: 'b', x: 25, y: 0, dir: 'E' }
        ],
        body: { x: -12, y: -12, w: 24, h: 24 },
        ops: [
            ['line', -25, 0, -12, 0],
            ['circle', 0, 0, 12],
            ['line', -8.5, -8.5, 8.5, 8.5],
            ['line', -8.5, 8.5, 8.5, -8.5],
            ['line', 12, 0, 25, 0]
        ],
        params: [
            { key: 'V', label: 'Rated voltage', unit: 'V', typ: '12' },
            { key: 'P', label: 'Power', unit: 'W', typ: '5' }
        ],
        equations: [
            { name: 'Cold resistance', expr: 'Rcold ~ Rhot / 10', note: 'Inrush is roughly 10x the steady current' }
        ],
        study: {
            what: 'A resistive heater that happens to glow; the classic positive-tempco load.',
            remember: ['The 10x cold inrush is why lamps blow at switch-on and why they are used as amplitude limiters in Wien-bridge oscillators.'],
            gotchas: ['Sizing the driver for steady-state current only will destroy it on the first turn-on.']
        }
    });

    define({
        key: 'speaker',
        name: 'Speaker',
        category: 'Electromechanical',
        refdes: 'LS',
        aliases: ['loudspeaker', 'driver'],
        pins: [
            { name: 'a', x: -30, y: -10, dir: 'W' },
            { name: 'b', x: -30, y: 10, dir: 'W' }
        ],
        body: { x: -14, y: -18, w: 30, h: 36 },
        ops: [
            ['line', -30, -10, -14, -10],
            ['line', -30, 10, -14, 10],
            ['rect', -14, -10, 8, 20],
            ['poly', [[-6, -10], [-6, 10], [10, 18], [10, -18]]]
        ],
        params: [
            { key: 'Z', label: 'Nominal impedance', unit: 'ohm', typ: '8' },
            { key: 'P', label: 'Power handling', unit: 'W', typ: '10' },
            { key: 'SPL', label: 'Sensitivity', unit: 'dB/W/m', typ: '88' }
        ],
        equations: [
            { name: 'Output power', expr: 'P = Vrms^2 / Z' },
            { name: 'SPL at distance', expr: 'SPL = sensitivity + 10 log10(P) - 20 log10(d)' }
        ],
        study: {
            what: 'A voice coil in a magnetic gap that converts current into cone motion.',
            remember: ['"8 ohm" is a nominal figure; real impedance swings from 5 ohm to 40 ohm across the audio band.'],
            gotchas: [
                'The voice coil is inductive and will make a bridge amplifier oscillate without a Zobel network.',
                'Doubling acoustic output takes ten times the power; +3 dB is barely audible.'
            ]
        }
    });

    define({
        key: 'motor',
        name: 'DC Motor',
        category: 'Electromechanical',
        refdes: 'M',
        aliases: ['dc motor'],
        pins: [
            { name: 'a', x: 0, y: -25, dir: 'N' },
            { name: 'b', x: 0, y: 25, dir: 'S' }
        ],
        body: { x: -15, y: -15, w: 30, h: 30 },
        ops: [
            ['line', 0, -25, 0, -15],
            ['circle', 0, 0, 15],
            ['line', 0, 15, 0, 25],
            ['text', 0, 5, 'M', { size: 14, weight: 'bold' }]
        ],
        params: [
            { key: 'V', label: 'Rated voltage', unit: 'V', typ: '12' },
            { key: 'Kv', label: 'Speed constant', unit: 'rpm/V', typ: '500' },
            { key: 'Kt', label: 'Torque constant', unit: 'Nm/A', typ: '0.02' },
            { key: 'Istall', label: 'Stall current', unit: 'A', typ: '5' }
        ],
        equations: [
            { name: 'Back EMF', expr: 'Vbemf = omega / Kv' },
            { name: 'Torque', expr: 'T = Kt (V - Vbemf) / R' },
            { name: 'Stall current', expr: 'Istall = V / Rwinding' }
        ],
        study: {
            what: 'An inductive load that generates a back EMF proportional to speed.',
            remember: [
                'At stall there is no back EMF, so current is limited only by winding resistance - often 10x the running current.',
                'A decelerating motor is a generator and will push current back into your supply.'
            ],
            gotchas: [
                'Brush noise couples into everything nearby; fit capacitors right at the motor terminals.',
                'An H-bridge must have dead time, or the two halves shoot through.'
            ]
        }
    });

    // -------------------------------------------------------------------
    // DIGITAL
    // -------------------------------------------------------------------

    function gateBase(kind) {
        // AND-family body: flat back, semicircular nose.
        const andBody = ['path', 'M -20 -18 L 0 -18 A 18 18 0 0 1 0 18 L -20 18 Z'];
        // OR-family body: curved back, pointed nose.
        const orBody = ['path', 'M -22 -18 Q -8 0 -22 18 Q 2 18 18 0 Q 2 -18 -22 -18 Z'];
        return kind === 'and' ? andBody : orBody;
    }

    function defineGate(key, name, aliases, kind, inverted, xorBar, truth) {
        const ops = [gateBase(kind)];
        if (xorBar) ops.unshift(['path', 'M -28 -18 Q -14 0 -28 18']);
        ops.push(['line', -35, -10, kind === 'and' ? -20 : -24, -10]);
        ops.push(['line', -35, 10, kind === 'and' ? -20 : -24, 10]);
        if (inverted) {
            ops.push(['circle', 22, 0, 4]);
            ops.push(['line', 26, 0, 35, 0]);
        } else {
            ops.push(['line', 18, 0, 35, 0]);
        }
        define({
            key, name, category: 'Digital', refdes: 'U', aliases,
            pins: [
                { name: 'a', x: -35, y: -10, dir: 'W' },
                { name: 'b', x: -35, y: 10, dir: 'W' },
                { name: 'y', x: 35, y: 0, dir: 'E' }
            ],
            body: { x: -28, y: -18, w: 54, h: 36 },
            ops,
            params: [
                { key: 'Vih', label: 'Input high threshold', unit: 'V', typ: '0.7 Vcc', note: 'CMOS; 2.0 V for TTL' },
                { key: 'tpd', label: 'Propagation delay', unit: 's', typ: '8n' },
                { key: 'Iout', label: 'Output drive', unit: 'A', typ: '4m' }
            ],
            equations: [{ name: 'Truth table', expr: truth }],
            study: {
                what: `${name}: ${truth}`,
                remember: ['CMOS inputs must never float - tie unused inputs to a rail through a resistor or directly.'],
                gotchas: [
                    'Propagation delay adds up through a chain; count the levels before assuming a combinational path meets timing.',
                    'Each switching output pulls a current spike from the rail - that is what the 100 nF decoupling capacitor supplies.'
                ]
            }
        });
    }

    defineGate('and_gate', 'AND Gate', ['and'], 'and', false, false, 'Y = A AND B (high only when both inputs are high)');
    defineGate('nand_gate', 'NAND Gate', ['nand', '7400'], 'and', true, false, 'Y = NOT(A AND B) - the universal gate');
    defineGate('or_gate', 'OR Gate', ['or'], 'or', false, false, 'Y = A OR B (high when either input is high)');
    defineGate('nor_gate', 'NOR Gate', ['nor'], 'or', true, false, 'Y = NOT(A OR B)');
    defineGate('xor_gate', 'XOR Gate', ['xor', 'exclusive or'], 'or', false, true, 'Y = A XOR B (high when the inputs differ)');

    define({
        key: 'not_gate',
        name: 'Inverter',
        category: 'Digital',
        refdes: 'U',
        aliases: ['not', 'inverter', 'buffer'],
        pins: [
            { name: 'a', x: -35, y: 0, dir: 'W' },
            { name: 'y', x: 35, y: 0, dir: 'E' }
        ],
        body: { x: -18, y: -16, w: 44, h: 32 },
        ops: [
            ['line', -35, 0, -18, 0],
            ['poly', [[-18, -16], [-18, 16], [16, 0]]],
            ['circle', 20, 0, 4],
            ['line', 24, 0, 35, 0]
        ],
        params: [
            { key: 'tpd', label: 'Propagation delay', unit: 's', typ: '6n' },
            { key: 'Vt', label: 'Switching threshold', unit: 'V', typ: '0.5 Vcc' }
        ],
        equations: [{ name: 'Truth table', expr: 'Y = NOT A' }],
        study: {
            what: 'Inverts a logic level. Drop the bubble and it is a non-inverting buffer.',
            remember: ['A CMOS inverter biased at its own threshold is a usable analog amplifier - the basis of the Pierce oscillator.'],
            gotchas: ['A slow input edge makes both CMOS transistors conduct at once; the part heats and the output may oscillate. Use a Schmitt version.']
        }
    });

    define({
        key: 'schmitt',
        name: 'Schmitt Inverter',
        category: 'Digital',
        refdes: 'U',
        aliases: ['schmitt trigger', '74hc14'],
        pins: [
            { name: 'a', x: -35, y: 0, dir: 'W' },
            { name: 'y', x: 35, y: 0, dir: 'E' }
        ],
        body: { x: -18, y: -16, w: 44, h: 32 },
        ops: [
            ['line', -35, 0, -18, 0],
            ['poly', [[-18, -16], [-18, 16], [16, 0]]],
            ['circle', 20, 0, 4],
            ['line', 24, 0, 35, 0],
            // Hysteresis glyph inside the triangle.
            ['poly', [[-13, 3], [-8, 3], [-8, -4], [-3, -4]], { close: false }],
            ['poly', [[-12, 5], [-7, 5], [-7, -2], [-2, -2]], { close: false }]
        ],
        params: [
            { key: 'Vtp', label: 'Positive threshold', unit: 'V', typ: '2.9', note: 'At Vcc = 5 V' },
            { key: 'Vtn', label: 'Negative threshold', unit: 'V', typ: '2.0' },
            { key: 'Vh', label: 'Hysteresis', unit: 'V', typ: '0.9' }
        ],
        equations: [
            { name: 'RC oscillator period', expr: 'T = R C ln((Vcc - Vtn) Vtp / ((Vcc - Vtp) Vtn))' }
        ],
        study: {
            what: 'An inverter with two different switching thresholds, so a noisy or slow edge still produces one clean transition.',
            remember: ['The default cure for slow edges, contact bounce and noisy sensor lines.'],
            gotchas: ['Hysteresis scales with Vcc; at 3.3 V there is much less of it than at 5 V.']
        }
    });

    // -------------------------------------------------------------------
    // MEASUREMENT AND ANNOTATION
    // -------------------------------------------------------------------

    define({
        key: 'meter',
        name: 'Meter',
        category: 'Measurement',
        refdes: 'M',
        aliases: ['ammeter', 'voltmeter', 'multimeter'],
        pins: [
            { name: 'a', x: -25, y: 0, dir: 'W' },
            { name: 'b', x: 25, y: 0, dir: 'E' }
        ],
        body: { x: -14, y: -14, w: 28, h: 28 },
        ops: [
            ['line', -25, 0, -14, 0],
            ['circle', 0, 0, 14],
            ['line', 14, 0, 25, 0],
            ['text', 0, 5, 'A', { size: 13, weight: 'bold' }]
        ],
        params: [
            { key: 'Rin', label: 'Input resistance', unit: 'ohm', typ: '10M', note: 'Voltmeter; ammeters are milliohms' },
            { key: 'burden', label: 'Burden voltage', unit: 'V', typ: '0.2', note: 'Ammeter drop at full scale' }
        ],
        equations: [
            { name: 'Shunt', expr: 'Rshunt = Vfs / Ifs' },
            { name: 'Loading error', expr: 'error = Rsource / (Rsource + Rmeter)' }
        ],
        study: {
            what: 'An instrument in the circuit: a voltmeter in parallel (high Z), an ammeter in series (low Z).',
            remember: ['Change the letter in the circle: A for current, V for voltage, W for power.'],
            gotchas: [
                'An ammeter\'s burden voltage is a real series drop that changes the circuit you are measuring.',
                'A 10 Mohm voltmeter still loads a 1 Mohm source by 10%.'
            ]
        }
    });

    define({
        key: 'port',
        name: 'Off-sheet Port',
        category: 'Measurement',
        refdes: '',
        aliases: ['terminal', 'off-sheet', 'continuation'],
        pins: [
            { name: 'a', x: -15, y: 0, dir: 'W' }
        ],
        body: { x: -15, y: -7, w: 22, h: 14 },
        ops: [
            ['line', -15, 0, -7, 0],
            ['circle', 0, 0, 7]
        ],
        params: [],
        equations: [],
        study: {
            what: 'Marks a conductor that continues off the drawing - to the next sheet, the rest of the feeder, or a load not shown.',
            remember: ['A wire that simply stops in white space is ambiguous: it reads as either an error or an invisible connection. A port says which.'],
            gotchas: ['Ports must be labelled. An unlabelled port is worse than no port, because it implies a connection you have not named.']
        }
    });

    define({
        key: 'testpoint',
        name: 'Test Point',
        category: 'Measurement',
        refdes: 'TP',
        aliases: ['probe point', 'tp'],
        pins: [
            { name: 'tp', x: 0, y: 10, dir: 'S' }
        ],
        body: { x: -6, y: -6, w: 12, h: 16 },
        ops: [
            ['line', 0, 10, 0, 4],
            ['circle', 0, 0, 4]
        ],
        params: [],
        equations: [],
        study: {
            what: 'A deliberate place to put a probe.',
            remember: ['Put a ground test point next to every signal test point, or your scope measurement includes the ground lead loop.'],
            gotchas: ['A long ground clip turns a clean edge into ringing that is not present in the circuit.']
        }
    });

    define({
        key: 'antenna',
        name: 'Antenna',
        category: 'Measurement',
        refdes: 'ANT',
        aliases: ['aerial'],
        pins: [
            { name: 'feed', x: 0, y: 20, dir: 'S' }
        ],
        body: { x: -14, y: -16, w: 28, h: 36 },
        ops: [
            ['line', 0, 20, 0, -4],
            ['line', 0, -4, -14, -16],
            ['line', 0, -4, 14, -16]
        ],
        params: [
            { key: 'Z', label: 'Feed impedance', unit: 'ohm', typ: '50' },
            { key: 'f', label: 'Centre frequency', unit: 'Hz', typ: '2.4G' }
        ],
        equations: [
            { name: 'Quarter-wave length', expr: 'L = 75 / f(MHz) metres', note: 'In free space, before velocity factor' },
            { name: 'Return loss', expr: 'RL = -20 log10(|Gamma|); VSWR 2:1 is about -9.5 dB' }
        ],
        study: {
            what: 'The transition between a guided wave on a transmission line and a radiated wave in space.',
            remember: ['Impedance matching is everything: a mismatched antenna reflects power back into the PA.'],
            gotchas: ['Ground plane size and nearby metal detune a small antenna badly; it must be tuned in situ.']
        }
    });

    // -------------------------------------------------------------------
    // POWER SYSTEMS (grid-scale one-line symbols)
    // These follow IEEE 315 one-line conventions and are used by the power
    // systems / ERCOT / AEP module, where a single symbol stands for a whole
    // three-phase assembly rather than one physical part.
    // -------------------------------------------------------------------

    define({
        key: 'generator',
        name: 'Generator',
        category: 'Power Systems',
        refdes: 'G',
        aliases: ['synchronous generator', 'genset', 'alternator'],
        pins: [
            { name: 'terminal', x: 0, y: 25, dir: 'S' }
        ],
        body: { x: -18, y: -18, w: 36, h: 36 },
        ops: [
            ['circle', 0, 0, 18],
            ['line', 0, 18, 0, 25],
            ['text', 0, 6, 'G', { size: 16, weight: 'bold' }]
        ],
        params: [
            { key: 'S', label: 'Rating', unit: 'MVA', typ: '100' },
            { key: 'V', label: 'Terminal voltage', unit: 'kV', typ: '13.8' },
            { key: 'Xd_pp', label: 'Subtransient reactance', unit: 'pu', typ: '0.15' },
            { key: 'H', label: 'Inertia constant', unit: 's', typ: '4' }
        ],
        equations: [
            { name: 'Swing equation', expr: '(2H / ws) d2(delta)/dt2 = Pm - Pe' },
            { name: 'Power angle', expr: 'P = (E V / Xd) sin(delta)' },
            { name: 'Fault current', expr: 'I_sc = V_pu / Xd_pp, in per unit on the machine base' }
        ],
        study: {
            what: 'A synchronous machine: the source of both power and, critically, rotational inertia.',
            remember: [
                'Inertia constant H is the seconds of rated output the stored rotational energy could supply.',
                'Real power is controlled by the prime mover (torque angle), reactive power by the field excitation.'
            ],
            gotchas: [
                'Subtransient reactance sets the first-cycle fault current; transient and synchronous reactances take over later.',
                'Inverter-based resources supply no inherent inertia - a grid with little synchronous generation has a much faster frequency decline.'
            ]
        }
    });

    define({
        key: 'xfmr_2w',
        name: 'Power Transformer (one-line)',
        category: 'Power Systems',
        refdes: 'T',
        aliases: ['gsu', 'autotransformer', 'power transformer'],
        pins: [
            { name: 'hv', x: 0, y: -35, dir: 'N' },
            { name: 'lv', x: 0, y: 35, dir: 'S' }
        ],
        body: { x: -16, y: -22, w: 32, h: 44 },
        ops: [
            ['line', 0, -35, 0, -22],
            ['circle', 0, -10, 12],
            ['circle', 0, 10, 12],
            ['line', 0, 22, 0, 35]
        ],
        params: [
            { key: 'S', label: 'Rating', unit: 'MVA', typ: '50' },
            { key: 'ratio', label: 'Voltage ratio', unit: 'kV', typ: '138/12.47' },
            { key: 'Z', label: 'Impedance', unit: '%', typ: '10' },
            { key: 'XR', label: 'X/R ratio', unit: '', typ: '20' },
            { key: 'group', label: 'Vector group', unit: '', typ: 'Dyn11', note: '30 degree phase shift' }
        ],
        equations: [
            { name: 'Ohmic impedance', expr: 'Z_ohm = (%Z / 100) x kV^2 / MVA', note: '10%, 138 kV, 50 MVA -> 38 ohm' },
            { name: 'Through-fault current', expr: 'I_fault = I_rated / (%Z / 100)', note: '10% impedance -> 10x rated' },
            { name: 'Base change', expr: 'Z_new = Z_old (S_new/S_old)(V_old/V_new)^2' }
        ],
        study: {
            what: 'On a one-line diagram, two circles stand for the whole three-phase transformer bank.',
            remember: [
                'Percent impedance is what limits through-fault current: a 10% transformer passes about 10x rated current into a bolted secondary fault.',
                'Delta-wye (Dyn11) gives a 30 degree phase shift and blocks zero-sequence current from crossing the transformer.'
            ],
            gotchas: [
                'You cannot parallel transformers of different vector groups or very different impedances - circulating current results.',
                'Inrush on energisation is several times rated current and is rich in second harmonic; that is exactly what the differential relay uses to restrain.'
            ]
        }
    });

    define({
        key: 'breaker',
        name: 'Circuit Breaker',
        category: 'Power Systems',
        refdes: 'CB',
        aliases: ['52', 'power circuit breaker'],
        pins: [
            { name: 'a', x: 0, y: -25, dir: 'N' },
            { name: 'b', x: 0, y: 25, dir: 'S' }
        ],
        body: { x: -12, y: -12, w: 24, h: 24 },
        ops: [
            ['line', 0, -25, 0, -12],
            ['rect', -12, -12, 24, 24],
            ['line', -12, -12, 12, 12],
            ['line', 0, 12, 0, 25]
        ],
        params: [
            { key: 'V', label: 'Rated voltage', unit: 'kV', typ: '145' },
            { key: 'I', label: 'Continuous current', unit: 'A', typ: '2000' },
            { key: 'Isc', label: 'Interrupting rating', unit: 'kA', typ: '40' },
            { key: 't', label: 'Interrupting time', unit: 'cycles', typ: '3' }
        ],
        equations: [
            { name: 'Total clearing time', expr: 't_clear = t_relay + t_breaker', note: 'Typically 1 + 3 = 4-5 cycles on transmission' }
        ],
        study: {
            what: 'A switch that can interrupt fault current, not just load current. ANSI device number 52.',
            remember: [
                'SF6 for transmission, vacuum for medium-voltage distribution. Oil breakers are legacy.',
                'An AC breaker interrupts at a current zero crossing; the hard part is preventing restrike as the recovery voltage rises.'
            ],
            gotchas: [
                'Interrupting rating must exceed the available fault current at that bus, including the DC offset implied by the X/R ratio.',
                'Breaker failure protection (50BF) exists because breakers do sometimes fail to open - never assume clearing.'
            ]
        }
    });

    define({
        key: 'disconnect',
        name: 'Disconnect Switch',
        category: 'Power Systems',
        refdes: 'DS',
        aliases: ['isolator', '89', 'air break switch'],
        pins: [
            { name: 'a', x: 0, y: -25, dir: 'N' },
            { name: 'b', x: 0, y: 25, dir: 'S' }
        ],
        body: { x: -14, y: -14, w: 28, h: 28 },
        ops: [
            ['line', 0, -25, 0, -12],
            ['dot', 0, -12],
            ['line', 0, -12, 14, 8],
            ['dot', 0, 12],
            ['line', 0, 12, 0, 25]
        ],
        params: [
            { key: 'V', label: 'Rated voltage', unit: 'kV', typ: '145' },
            { key: 'I', label: 'Continuous current', unit: 'A', typ: '1200' }
        ],
        equations: [],
        study: {
            what: 'A visible-break isolating switch. It provides the visual proof of isolation that a clearance requires.',
            remember: ['Operated only after the breaker has interrupted the current - it establishes isolation, it does not create it.'],
            gotchas: [
                'A disconnect cannot interrupt load current. Opening one under load draws a sustained arc.',
                'Interlocks that prevent that sequence error are there because people have made it.'
            ]
        }
    });

    define({
        key: 'ct',
        name: 'Current Transformer',
        category: 'Power Systems',
        refdes: 'CT',
        aliases: ['current transformer', 'bushing ct'],
        pins: [
            { name: 'primary_in', x: 0, y: -25, dir: 'N' },
            { name: 'primary_out', x: 0, y: 25, dir: 'S' },
            { name: 'secondary', x: 30, y: 0, dir: 'E' }
        ],
        body: { x: -6, y: -14, w: 36, h: 28 },
        ops: [
            ['line', 0, -25, 0, 25],
            ['arc', 0, 0, 12, -80, 80],
            ['line', 12, 0, 30, 0]
        ],
        params: [
            { key: 'ratio', label: 'Ratio', unit: '', typ: '600:5' },
            { key: 'class', label: 'Accuracy class', unit: '', typ: 'C800', note: 'IEEE C57.13' },
            { key: 'burden', label: 'Rated burden', unit: 'VA', typ: '20' }
        ],
        equations: [
            { name: 'Secondary current', expr: 'Is = Ip / ratio', note: '600:5 means 600 A primary gives 5 A secondary' },
            { name: 'Saturation check', expr: 'Vs = Is (Zburden + Zleads) must stay below the class voltage' }
        ],
        study: {
            what: 'A transformer whose primary is the power conductor itself; it scales fault-level currents down to 5 A for relays.',
            remember: [
                'The 5 A secondary standard means a C800 CT can develop 800 V across a 20x rated fault before saturating.',
                'Lead resistance counts twice (out and back) in the burden calculation.'
            ],
            gotchas: [
                'NEVER open-circuit an energised CT secondary. The core drives the voltage up until something flashes over - it is a lethal hazard.',
                'CT saturation during a heavy fault distorts the waveform and can cause a differential relay to misoperate; that is why restraint slopes exist.'
            ]
        }
    });

    define({
        key: 'pt',
        name: 'Potential Transformer',
        category: 'Power Systems',
        refdes: 'PT',
        aliases: ['vt', 'voltage transformer', 'ccvt'],
        pins: [
            { name: 'primary', x: 0, y: -30, dir: 'N' },
            { name: 'secondary', x: 0, y: 30, dir: 'S' }
        ],
        body: { x: -12, y: -20, w: 24, h: 40 },
        ops: [
            ['line', 0, -30, 0, -20],
            ['circle', 0, -9, 11],
            ['circle', 0, 9, 11],
            ['line', 0, 20, 0, 30],
            ['text', 18, 3, 'PT', { size: 9, anchor: 'start' }]
        ],
        params: [
            { key: 'ratio', label: 'Ratio', unit: '', typ: '1200:1' },
            { key: 'Vsec', label: 'Secondary voltage', unit: 'V', typ: '120', note: '69.3 V line-to-neutral' },
            { key: 'class', label: 'Accuracy class', unit: '', typ: '0.3' }
        ],
        equations: [
            { name: 'Secondary voltage', expr: 'Vs = Vp / ratio', note: '138 kV / 1200 = 115 V' }
        ],
        study: {
            what: 'Scales system voltage down to the 120 V (or 69.3 V line-neutral) standard that relays and meters expect.',
            remember: ['The 120 V secondary base is why every relay setting, regulator bandwidth and voltage schedule is quoted on a 120 V base.'],
            gotchas: [
                'A CCVT (capacitor coupled) has a transient response that lags during a fault; distance relays must account for it.',
                'Unlike a CT, a PT secondary must never be short-circuited.'
            ]
        }
    });

    define({
        key: 'arrester',
        name: 'Surge Arrester',
        category: 'Power Systems',
        refdes: 'LA',
        aliases: ['lightning arrester', 'mov', 'varistor'],
        pins: [
            { name: 'line', x: 0, y: -25, dir: 'N' },
            { name: 'gnd', x: 0, y: 25, dir: 'S' }
        ],
        body: { x: -10, y: -16, w: 20, h: 32 },
        ops: [
            ['line', 0, -25, 0, -16],
            ['rect', -10, -16, 20, 32],
            ['line', 0, -16, 0, 16],
            ['poly', [[-6, -8], [0, -14], [6, -8]], { close: false }],
            ['line', 0, 16, 0, 25]
        ],
        params: [
            { key: 'MCOV', label: 'Max continuous operating voltage', unit: 'kV', typ: '84' },
            { key: 'Vr', label: 'Rated voltage', unit: 'kV', typ: '108' },
            { key: 'Idis', label: 'Discharge current', unit: 'kA', typ: '10' }
        ],
        equations: [
            { name: 'Protective margin', expr: 'margin = (BIL / Vprotective - 1) x 100%', note: 'IEEE 1313 wants at least 20%' }
        ],
        study: {
            what: 'A metal-oxide varistor stack: an open circuit at normal voltage, a low-impedance path during a surge.',
            remember: [
                'Insulation coordination is the whole game: the arrester must clamp below the equipment BIL with margin.',
                'BIL by class: 110 kV at 23 kV, 550 kV at 138 kV, 1300 kV at 345 kV.'
            ],
            gotchas: [
                'MCOV must exceed the highest continuous line-to-ground voltage including the temporary overvoltage during a ground fault, or the arrester cooks itself.',
                'Arresters age with every operation; they do fail, usually short, which is why they have pressure-relief vents.'
            ]
        }
    });

    define({
        key: 'busbar',
        name: 'Bus',
        category: 'Power Systems',
        refdes: 'B',
        aliases: ['busbar', 'bus section'],
        pins: [
            { name: 'a', x: -40, y: 0, dir: 'W' },
            { name: 'b', x: 40, y: 0, dir: 'E' }
        ],
        body: { x: -40, y: -3, w: 80, h: 6 },
        ops: [
            ['rect', -40, -2.5, 80, 5, { fill: true }]
        ],
        params: [
            { key: 'V', label: 'Voltage class', unit: 'kV', typ: '138' },
            { key: 'I', label: 'Continuous rating', unit: 'A', typ: '3000' }
        ],
        equations: [],
        study: {
            what: 'The common node in a substation where circuits are paralleled.',
            remember: [
                'Bus configuration sets reliability: ring bus and breaker-and-a-half let you take a breaker out of service without dropping a line.',
                'Single bus is cheapest and least reliable; a bus fault takes everything.'
            ],
            gotchas: ['A bus fault is the most severe fault in a substation. Bus differential (87B) must be fast and must not misoperate on through faults.']
        }
    });

    define({
        key: 'relay_device',
        name: 'Protective Relay',
        category: 'Power Systems',
        refdes: '',
        aliases: ['ied', '50/51', '21', '87'],
        pins: [
            { name: 'input', x: -30, y: 0, dir: 'W' },
            { name: 'trip', x: 30, y: 0, dir: 'E' }
        ],
        body: { x: -16, y: -16, w: 32, h: 32 },
        ops: [
            ['line', -30, 0, -16, 0],
            ['circle', 0, 0, 16],
            ['line', 16, 0, 30, 0],
            // The number in the circle is the device's ANSI function code, so
            // it has to follow the device: pass device: '21' for a distance
            // element, '87' for a differential, and so on.
            ['text', 0, 5, '$device', { size: 12, weight: 'bold' }]
        ],
        opDefaults: { device: '51' },
        params: [
            { key: 'device', label: 'ANSI device number', unit: '', typ: '51', note: '50 inst OC, 51 time OC, 21 distance, 87 differential, 79 recloser, 27/59 under/overvoltage, 81 frequency' },
            { key: 'pickup', label: 'Pickup current', unit: 'A', typ: '5', note: 'Secondary amps' },
            { key: 'TD', label: 'Time dial', unit: '', typ: '2' }
        ],
        equations: [
            { name: 'IEEE very inverse curve', expr: 't = TD x (19.61 / ((I/Ipu)^2 - 1) + 0.491)' },
            { name: 'Coordination interval', expr: 'CTI = 0.25 to 0.40 s between adjacent devices' },
            { name: 'Distance zone reach', expr: 'Zone 1 = 80-90% of the line (instantaneous); Zone 2 = 120-150%, ~0.3 s; Zone 3 backup, ~1 s' }
        ],
        study: {
            what: 'The device that decides a fault has occurred and orders a breaker to trip. Labelled by ANSI device number.',
            remember: [
                'Zone 1 is set short (80-90%) deliberately, because CT/PT and line-impedance errors must never let it reach past the remote bus.',
                'Coordination means the downstream device always operates first, by at least one coordination time interval.'
            ],
            gotchas: [
                'Transformer differential (87T) must be restrained on inrush - second-harmonic content above roughly 15-20% blocks the trip.',
                'A relay that is set too sensitively trips on load; one set too conservatively lets the fault burn. The margin between them is the whole job.'
            ]
        }
    });

    // ===== PUBLIC API =====

    const KEYS = Object.keys(MODELS);

    function get(key) {
        if (!key) return null;
        const k = String(key).toLowerCase();
        if (MODELS[k]) return MODELS[k];
        // Fall back to an alias or a name match.
        for (const mk of KEYS) {
            const m = MODELS[mk];
            if (m.aliases.indexOf(k) !== -1) return m;
            if (m.name.toLowerCase() === k) return m;
        }
        return null;
    }

    function has(key) {
        return get(key) !== null;
    }

    function count() {
        return KEYS.length;
    }

    function keys() {
        return KEYS.slice();
    }

    function all() {
        return KEYS.map(k => MODELS[k]);
    }

    function categories() {
        const seen = [];
        for (const k of KEYS) {
            const c = MODELS[k].category;
            if (seen.indexOf(c) === -1) seen.push(c);
        }
        return seen;
    }

    function byCategory() {
        const out = {};
        for (const c of categories()) out[c] = [];
        for (const k of KEYS) out[MODELS[k].category].push(MODELS[k]);
        return out;
    }

    function search(query) {
        const q = String(query || '').trim().toLowerCase();
        if (!q) return all();
        return all().filter(m =>
            m.key.indexOf(q) !== -1 ||
            m.name.toLowerCase().indexOf(q) !== -1 ||
            m.category.toLowerCase().indexOf(q) !== -1 ||
            m.aliases.some(a => a.indexOf(q) !== -1)
        );
    }

    /**
     * Transform a local-frame point by the placement options.
     * Rotation is clockwise in degrees; mirror flips about the local Y axis
     * BEFORE rotation, matching how the SVG transform list is emitted.
     */
    function place(px, py, opts) {
        const o = opts || {};
        const rot = ((o.rotate || 0) % 360 + 360) % 360;
        const s = o.scale === undefined ? 1 : o.scale;
        let x = o.mirror ? -px : px;
        let y = py;
        const rad = rot * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const rx = x * cos - y * sin;
        const ry = x * sin + y * cos;
        return { x: (o.x || 0) + rx * s, y: (o.y || 0) + ry * s };
    }

    // Rotate a pin escape direction along with the body. A pin whose stub
    // points east must point south after a 90 degree rotation, or the router
    // will drive the first wire segment straight back through the symbol.
    const DIR_ORDER = ['E', 'S', 'W', 'N'];

    function rotateDir(dir, rotate, mirror) {
        let d = dir;
        if (mirror) {
            if (d === 'E') d = 'W';
            else if (d === 'W') d = 'E';
        }
        const steps = Math.round((((rotate || 0) % 360) + 360) % 360 / 90) % 4;
        const i = DIR_ORDER.indexOf(d);
        if (i === -1) return d;
        return DIR_ORDER[(i + steps) % 4];
    }

    /**
     * Render a model as SVG markup plus the placed pin and keepout geometry.
     *
     * @param {string} key      model key, name or alias
     * @param {object} options  {x, y, rotate, mirror, scale, color, label,
     *                           value, labelPos: 'auto'|'top'|'bottom'|'left'|'right'|'none'}
     * @returns {{markup, pins, keepout, model}|null}
     */
    function draw(key, options) {
        const model = get(key);
        if (!model) return null;
        const o = Object.assign({
            x: 0, y: 0, rotate: 0, mirror: false, scale: 1,
            color: COLORS.component, label: '', value: '', labelPos: 'auto'
        }, options || {});

        const parts = [];
        // A few symbols carry text that belongs to the individual device
        // rather than to the type: a protective relay's circle holds its ANSI
        // device number, and drawing 51 on a distance element states the wrong
        // function. Any text op written as '$name' takes its value from the
        // placement's `name` option, falling back to the model's default.
        for (const op of model.ops) {
            let drawOp = op;
            if (op[0] === 'text' && typeof op[3] === 'string' && op[3].charAt(0) === '$') {
                const field = op[3].slice(1);
                const supplied = o[field];
                const fallback = (model.opDefaults && model.opDefaults[field]) || '';
                drawOp = op.slice();
                drawOp[3] = (supplied === undefined || supplied === null || supplied === '')
                    ? fallback : String(supplied);
            }
            parts.push(opToSVG(drawOp, o.color));
        }

        // Labels are emitted OUTSIDE the rotated group, so text always reads
        // left to right no matter how the body is turned. This is the biggest
        // single difference from circuit_toy, which rotates its text with the
        // part because the user can rotate the view to read it.
        const outer = [];
        const b = model.body;
        const horizontal = (Math.round(o.rotate / 90) % 2) === 0;
        if (o.label || o.value) {
            let lx, ly, vy, anchor;
            const pos = o.labelPos === 'auto' ? (horizontal ? 'top' : 'right') : o.labelPos;
            const halfH = (b.h / 2) * o.scale;
            const halfW = (b.w / 2) * o.scale;
            // 15 px between the label and value baselines, in every position.
            // At 13 the two em-boxes touch: an 11 px face is about 14.5 px tall
            // once the descender space is counted, so the pair reads as one
            // smudged block and a geometry audit flags it as overlapping text.
            if (pos === 'top') {
                // Both stacked ABOVE the body: label on top, value beneath it.
                lx = o.x; ly = o.y - halfH - 24; vy = o.y - halfH - 9; anchor = 'middle';
                if (!o.label) ly = vy;
            } else if (pos === 'bottom') {
                lx = o.x; ly = o.y + halfH + 14; vy = o.y + halfH + 29; anchor = 'middle';
            } else if (pos === 'left') {
                lx = o.x - halfW - 9; ly = o.y - 5; vy = o.y + 10; anchor = 'end';
            } else {
                lx = o.x + halfW + 9; ly = o.y - 5; vy = o.y + 10; anchor = 'start';
            }
            if (pos !== 'none') {
                if (o.label) {
                    outer.push(opToSVG(['text', lx, ly, o.label,
                        { size: 11, anchor, weight: 'bold', color: COLORS.label }], COLORS.label));
                }
                if (o.value) {
                    outer.push(opToSVG(['text', lx, vy, o.value,
                        { size: 10, anchor, color: COLORS.value }], COLORS.value));
                }
            }
        }

        const tf = [`translate(${n(o.x)} ${n(o.y)})`];
        if (o.rotate) tf.push(`rotate(${n(o.rotate)})`);
        if (o.mirror) tf.push('scale(-1 1)');
        if (o.scale !== 1) tf.push(`scale(${n(o.scale)})`);

        const markup =
            `<g class="cm-symbol cm-${model.key}" transform="${tf.join(' ')}" ` +
            `stroke="${o.color}" stroke-width="${STROKE}" stroke-linecap="round" ` +
            `stroke-linejoin="round" fill="none">${parts.join('')}</g>` +
            (outer.length ? `<g class="cm-label">${outer.join('')}</g>` : '');

        // Placed pins, with rotated escape directions.
        const pins = {};
        for (const p of model.pins) {
            const pt = place(p.x, p.y, o);
            pins[p.name] = { x: pt.x, y: pt.y, dir: rotateDir(p.dir, o.rotate, o.mirror) };
        }

        // Placed keepout: transform all four corners and take the bounding box.
        const corners = [
            [b.x, b.y], [b.x + b.w, b.y],
            [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]
        ].map(c => place(c[0], c[1], o));
        const xs = corners.map(c => c.x);
        const ys = corners.map(c => c.y);
        const keepout = {
            type: 'rectangle',
            bounds: {
                xMin: Math.min.apply(null, xs), xMax: Math.max.apply(null, xs),
                yMin: Math.min.apply(null, ys), yMax: Math.max.apply(null, ys)
            },
            meta: { type: model.key, label: o.label }
        };

        return { markup, pins, keepout, model };
    }

    /**
     * A standalone <svg> for one symbol - used by the component reference page
     * and by any lesson that wants to show a symbol on its own.
     */
    function symbolSVG(key, options) {
        const model = get(key);
        if (!model) return '';
        const o = Object.assign({
            width: 120, height: 100, color: COLORS.component,
            label: '', value: '', showPins: false, padding: 14
        }, options || {});

        // Fit the symbol into the requested box. The keepout body is only the
        // wire-routing exclusion zone - polarity glyphs and device labels sit
        // outside it, so every drawing op has to be measured too or they clip.
        let xMin = model.body.x, xMax = model.body.x + model.body.w;
        let yMin = model.body.y, yMax = model.body.y + model.body.h;
        for (const p of model.pins) {
            xMin = Math.min(xMin, p.x); xMax = Math.max(xMax, p.x);
            yMin = Math.min(yMin, p.y); yMax = Math.max(yMax, p.y);
        }
        for (const op of model.ops) {
            for (const pt of opBounds(op)) {
                xMin = Math.min(xMin, pt[0]); xMax = Math.max(xMax, pt[0]);
                yMin = Math.min(yMin, pt[1]); yMax = Math.max(yMax, pt[1]);
            }
        }
        xMin -= o.padding; xMax += o.padding;
        yMin -= o.padding; yMax += o.padding;

        const r = draw(key, { x: 0, y: 0, color: o.color, label: o.label, value: o.value });
        let extra = '';
        if (o.showPins) {
            for (const name of Object.keys(r.pins)) {
                const p = r.pins[name];
                extra += `<circle cx="${n(p.x)}" cy="${n(p.y)}" r="2.5" fill="${COLORS.signal}" stroke="none"/>`;
            }
        }

        return `<svg viewBox="${n(xMin)} ${n(yMin)} ${n(xMax - xMin)} ${n(yMax - yMin)}" ` +
               `width="${o.width}" height="${o.height}" role="img" ` +
               `aria-label="${esc(model.name)} schematic symbol">${r.markup}${extra}</svg>`;
    }

    /**
     * Compose a complete <svg> from placed symbols, wires and free text.
     *
     * Written for the power-systems module, where a one-line diagram is a
     * handful of catalog symbols joined by orthogonal wires. Keeping it here
     * rather than in each lesson means every diagram inherits the same grid,
     * stroke weights and palette.
     *
     *   ComponentModels.diagram({
     *       width: 620, height: 260,
     *       parts: [
     *           { key: 'generator', x: 60,  y: 130, label: 'G1', value: '100 MVA' },
     *           { key: 'xfmr_2w',   x: 200, y: 130, label: 'T1', value: '13.8/138 kV' }
     *       ],
     *       wires: [ [[60,105],[60,60],[200,60],[200,95]] ],
     *       texts: [ { x: 130, y: 50, text: 'GSU', size: 11 } ]
     *   });
     */
    function diagram(spec) {
        const s = spec || {};
        const width = s.width || 600;
        const height = s.height || 240;
        const parts = s.parts || [];
        const wires = s.wires || [];
        const texts = s.texts || [];
        const dots = s.dots || [];
        const wireColor = s.wireColor || COLORS.wire;

        const body = [];

        // Wires first, so symbol bodies paint over any stub that runs under them.
        for (const pts of wires) {
            if (!pts || pts.length < 2) continue;
            const d = pts.map((p, i) => `${i ? 'L' : 'M'} ${n(p[0])} ${n(p[1])}`).join(' ');
            body.push(`<path d="${d}" fill="none" stroke="${wireColor}" ` +
                      `stroke-width="${STROKE}" stroke-linecap="round" ` +
                      `stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`);
        }

        // Blocks: labelled rectangles for things that genuinely have no
        // schematic symbol - an IC, a controller, a functional stage. A
        // rectangle is the correct symbol here; it is only wrong when it
        // stands in for a device that has a symbol of its own (a transistor,
        // a diode), which is what the symbol audit looks for.
        for (const b of (s.blocks || [])) {
            const w = b.w || 80, h = b.h || 60;
            const x = b.x - w / 2, y = b.y - h / 2;
            const col = b.color || COLORS.component;
            body.push(`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" ` +
                      `rx="3" fill="${b.fill || 'none'}" stroke="${col}" ` +
                      `stroke-width="${STROKE}" vector-effect="non-scaling-stroke"/>`);
            const lines = [].concat(b.label || []).concat(b.sub || []);
            const step = 15;   // matches the label/value pitch used by place()
            const y0 = b.y - ((lines.length - 1) * step) / 2 + 4;
            lines.forEach((line, i) => {
                body.push(opToSVG(['text', b.x, y0 + i * step, line, {
                    size: i === 0 ? 11 : 9.5,
                    anchor: 'middle',
                    weight: i === 0 ? 'bold' : null,
                    color: i === 0 ? col : COLORS.value
                }], i === 0 ? col : COLORS.value));
            });
        }

        for (const p of parts) {
            const r = draw(p.key, p);
            if (r) body.push(r.markup);
        }

        for (const d of dots) {
            body.push(`<circle cx="${n(d[0])}" cy="${n(d[1])}" r="3.5" ` +
                      `fill="${wireColor}" stroke="none"/>`);
        }

        for (const t of texts) {
            body.push(opToSVG(['text', t.x, t.y, t.text, {
                size: t.size || 11,
                anchor: t.anchor || 'middle',
                weight: t.weight,
                color: t.color || COLORS.annotation
            }], t.color || COLORS.annotation));
        }

        return `<svg viewBox="0 0 ${n(width)} ${n(height)}" ` +
               `class="circuit-diagram" role="img" ` +
               `aria-label="${esc(s.title || 'circuit diagram')}" ` +
               `style="max-width:${n(width)}px;width:100%;height:auto;` +
               `margin:1rem auto;display:block">${body.join('')}</svg>`;
    }

    /** Validate the whole catalog. Returns an array of problem strings. */
    function validate() {
        const problems = [];
        for (const k of KEYS) {
            const m = MODELS[k];
            if (!m.name) problems.push(`${k}: missing name`);
            if (!m.category) problems.push(`${k}: missing category`);
            if (!Array.isArray(m.ops) || !m.ops.length) problems.push(`${k}: no drawing ops`);
            if (!Array.isArray(m.pins) || !m.pins.length) problems.push(`${k}: no pins`);
            const seen = {};
            for (const p of m.pins) {
                if (seen[p.name]) problems.push(`${k}: duplicate pin "${p.name}"`);
                seen[p.name] = true;
                if (typeof p.x !== 'number' || typeof p.y !== 'number') {
                    problems.push(`${k}: pin "${p.name}" has a non-numeric position`);
                }
                if (['N', 'S', 'E', 'W'].indexOf(p.dir) === -1) {
                    problems.push(`${k}: pin "${p.name}" has an invalid direction "${p.dir}"`);
                }
                // Pins must land on the 5 px grid or wires will not meet them.
                if (p.x % GRID !== 0 || p.y % GRID !== 0) {
                    problems.push(`${k}: pin "${p.name}" at (${p.x},${p.y}) is off the ${GRID}px grid`);
                }
            }
            const b = m.body;
            if (!b || typeof b.w !== 'number' || typeof b.h !== 'number' || b.w <= 0 || b.h <= 0) {
                problems.push(`${k}: invalid body keepout`);
            }
            for (const op of m.ops) {
                if (!Array.isArray(op) || typeof op[0] !== 'string') {
                    problems.push(`${k}: malformed drawing op`);
                }
            }
        }
        return problems;
    }

    return {
        // constants
        GRID, LEAD, STROKE, COLORS,
        // lookup
        get, has, count, keys, all, categories, byCategory, search,
        // rendering
        draw, symbolSVG, diagram, opToSVG, opBounds, place, rotateDir,
        // maintenance
        validate, define,
        // raw table, for tooling
        MODELS
    };
})();

// Expose globally, and hang it off the AD namespace when that exists.
if (typeof window !== 'undefined') {
    window.ComponentModels = ComponentModels;
    if (window.AD) window.AD.ComponentModels = ComponentModels;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ComponentModels;
}
