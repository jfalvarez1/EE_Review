# Internal notes

Working notes for whoever maintains this repo. **Not customer-facing** — the README is the
front page and deliberately says nothing about smoke tests, DRC counts or which of these tools
has lied to me. That belongs here.

Everything below assumes a server is running: `./launch.bat` or `python tools/serve.py`.

---

## The audit

```bash
node tools/audit.js            # nine gating checks, one exit code
node tools/audit.js --full     # plus the advisory surveys
node tools/audit.js --verbose  # each checker's own output
```

This is what CI runs before the Pages deploy and before a release build.

**Every gating check below exists because something was actually broken and
nothing noticed.** They are not a generic lint suite; the list is a history of
what has gone wrong in this repo.

| Check | The defect it exists for |
|---|---|
| `check-structure` | 36 lessons were complete HTML documents; 14 rendered a stale nav bar naming the wrong module, because `innerHTML` drops `<head>` but not `<header>` |
| `check-titles` | 48 lessons had a title naming a different lesson; three syllabus steps handed the reader the wrong one |
| `check-markup` | three broken tags the browser was hiding by silently reparenting |
| `check-lesson-js` | a syntax error fails at runtime, in one lesson, with a blank canvas and nothing in the console unless you are on that lesson |
| `check-diagram-nets` | a transistor drawn 15 px from the rail it should be on; 212 such faults were found the first time. Also catches a pnp rotated instead of flipped |
| `check-bias` | two amplifier circuits demanded more voltage than their supply had — one wanted 66 V from 12 V |
| `check-canvas-circuits` | circuits drawn on a canvas, where components become boxes and nothing can verify connectivity |
| `check-css` | one line, added later, silently overrode the mobile media query and gave phones a 91-pixel-wide lesson |
| `validate-path` | a syllabus step pointing at a lesson that does not exist |

Advisory, never fails the build: `check-media`, `survey-depth`,
`check-taxonomy`.

`check-taxonomy` is a heuristic and says so — it flags "Feedback Fundamentals"
as belonging in the BJT module. Use it to find candidates to read, never to
move anything.

### The canvas-circuit ratchet

`check-canvas-circuits.js` carries a `BASELINE` of the 15 canvas-drawn circuits
that remain. It fails only when a **new** one appears. Converting one is
expected to remove its line from that list; the count can go down and never up.
A build that is permanently red is a build nobody reads.

---

## Open findings from the media audit

`node tools/check-media.js`, last run against 368 lessons.

**13 lessons have no visual at all.** Eleven are core device lessons where a
circuit is the whole point:

    5-28  Translinear Circuits            6-7   Body Effect & Back Gate
    5-29  BJT Output Stages               6-9   MOSFET Current Mirrors
    5-31  High-Speed BJT Circuits         6-13  Gate Drive Design
    5-32  BJT Bootstrapping Techniques    6-17  Power MOSFET Thermal Design
    5-33  BJT in Feedback Amplifiers      2-14  Industry Selection Guide
    5-34  Precision BJT Matched Pairs     12-5  Problem Set 5
    5-38  BJT Design Case Studies

**22 lessons have a canvas but no control** — a picture that cost a canvas to
draw. Lower priority than the above, but each is a candidate for a slider.

**4 lessons draw labelled boxes and no conductors**, and all four were checked
and are legitimate: solder joint quality (10-4), an ESR-vs-package chart
(11-6), a component grade table (11-12) and a logic threshold band diagram
(19-1). None is a block diagram standing in for a circuit.

**0 lessons have a control that does nothing.** An earlier version of the
checker reported 13; it was only looking for one readout CSS class and missed
`AD.setText` and direct `textContent` assignment. Fixed in the tool rather than
reported as findings.

---

## The browser audit tools

Four checkers live in this folder. They are development tools and the app never loads them.

| Page | Checks | Scope |
|---|---|---|
| `_audit/sweep-all.html` | JS errors, NaN/Infinity readouts, geometry, missing files | every lesson |
| `_audit/audit-all.html` | diagram geometry only, faster | generated schematics |
| `_audit/netlist.html` | **which pin connects to which** | generated schematics |
| `_audit/dup-probe.html` | duplicate wire segments, mapped back to a source line | ad hoc |

`sweep-all.html` is the one to run after any change. It is the only one that hooks
`console.error`/`console.warn`, which is where `schematic-svg.js` reports its own DRC —
unconnected pins, node shorts, keepout violations. An `onerror` listener never sees those.

### Things these tools got wrong, so I do not relearn them

- **`getBBox()` on a transformed `<g>` returns LOCAL coordinates.** Transform through
  `getCTM()`. 132 of 157 findings in the first geometry audit were false positives from this.
- **Take the root CTM inverse ONCE per SVG.** Per-element forces a layout flush each time and
  turns a two-second audit into a two-minute hang.
- **Scope to `svg.circuit-diagram[role="img"]`.** The class alone is not enough — hand-authored
  plots wear it too, and a Bode curve is nothing but diagonals with two loose ends.
- **Identify parts by index, not label.** A one-line carries four breakers all called "52";
  keying on the label merged them and reported a short between devices metres apart.
- **`parseFloat("1k")` is 1.** Ranges are written the way the lessons write values, so bounds
  must go through `AD.parseNumValue`. The sweep once tested a value 1000× below the declared
  minimum and reported a failure the app could not reach.
- **A pin lying ON a wire is connected**, not only one at a vertex. A rail passing through a
  terminal is connected to it.
- **A busbar conducts along its whole length**; modelling only its end pins reports every
  mid-bar drop as floating, which is how one-lines are actually drawn.
- **Base tied to collector is a diode-connected transistor, not a short.** Same for gate-drain.
  It is the left-hand device of every current mirror ever drawn.
- **Open by design:** bus ends, ports, op-amp supply pins, CT secondaries, and a relay's trip
  output (it goes to the breaker's mechanism, not a terminal in the power circuit).

### The harness lies in two known ways

Both are artifacts of loading 358 fragments into one document, and neither happens in the app:
MathJax re-registers itself on every lesson that includes it, and a lesson's animation loop can
fire once in the gap between chunks. The sweep filters the first and clears timers around the
second.

### Verify the net actually catches

A safety net never seen catching anything is indistinguishable from one that is switched off.
Detach a pin — move a wire endpoint 30 px off `q1.base` in module 1-7 — and the sweep should
name it immediately:

```
module-01/lesson-07  console.error: [ERROR] Component pin at (135, 125) has no wire connections
module-01/lesson-07  console.warn:  [WARN] Node at (105, 125) has degree 1 - may be floating
```

Then revert.

---

## Testing

```bash
node tools/validate-schematics.js --all    # schematic DRC over factories and lessons
node tools/find-schematic-issues.js        # heuristic scan for floating labels/grounds
node tools/test-all-canvases.js            # canvas smoke test  (see caveat below)
```

`validate-schematics.js --all` currently reports **0 warnings and 0 errors**.

> **Caveat on `test-all-canvases.js`:** it simulates a browser with Node's `vm` module and
> produces false negatives — it reported 106 lessons with "empty canvases" that paint correctly
> in a real browser. Verify anything it flags by opening the lesson and checking
> `getImageData` on the canvas, rather than trusting the harness.

### Browser smoke test

The most useful check is driving the real app. This walks every lesson, exercises every control
across its full range plus out-of-range values, and reports JavaScript errors, `NaN`/`Infinity`
leaking into the output, and canvases that never painted. Paste into DevTools with the app open:

```js
for (const m of CURRICULUM.modules) {
  for (const l of m.lessons) {
    Router.loadLesson(m.id, l.id);
    await new Promise(r => setTimeout(r, 200));
    const root = document.getElementById('lesson-content');
    for (const c of root.querySelectorAll('input[type=range],input[type=number],select')) {
      const lo = parseFloat(c.min) || 0, hi = parseFloat(c.max) || 100;
      for (const v of [lo, hi, (lo + hi) / 2, lo - hi, hi * 2, '']) {
        c.value = v;
        c.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    if (/(^|[\s>:=(])(NaN|Infinity)\b/.test(root.innerText)) console.warn(m.id + '-' + l.id);
  }
}
```

Latest run: **358 lessons, 2,529 controls, 483 canvases, zero JavaScript errors.**

### Four checks worth running after any change

All four are in `_audit/`, as pages you open against a running server:
`_audit/audit-all.html` (geometry, all 24 generated schematics in one load),
`_audit/netlist.html` (connectivity), `_audit/sweep-all.html` (every lesson,
every control). They are development tools and are not loaded by the app.

**1. Calculator liveness.** Press each Calculate button, perturb every input, press again.
If the output never changes, that calculator ignores its inputs. This found 11 dead
calculators — the whole of module 12 plus one other — where the reader could type anything
and nothing happened. All 90 respond now.

**2. Diagram geometry.** Walk the rendered SVG of every diagram and check the block-diagram
rules: orthogonal segments only, no wire endpoint in empty space, no overlapping text or
collinear wires. All 24 generated schematics pass.

Two traps, both of which cost real time here. `getBBox()` on a transformed `<g>` returns
*local* coordinates — transform through `getCTM()`, and take the root inverse **once per
SVG**, because taking it per element forces a layout flush each time and turns a two-second
audit into a two-minute hang. And scope the audit to `svg.circuit-diagram[role="img"]`: the
class alone is not enough, since hand-authored plots wear it too, and a Bode curve is nothing
but diagonals with two loose ends. Reporting those is how an audit stops being worth reading.

**3. Connectivity.** Geometry proves a wire is orthogonal, on-grid and lands on *something*.
It says nothing about *which pin*, and that gap hid real breakage: a diagram can pass the
geometry audit cleanly while the pass transistor is not in the circuit at all.

`_audit/netlist.html` resolves every wire endpoint to a pin and prints the resulting nets, so
the connections can be read rather than assumed. It reports unconnected pins, one-pin nets,
and devices with both terminals on the same node — a short that is invisible in a rendering
and fatal in a schematic. It found 212 problems on its first run, including six MOSFET gates
with no drive at all, two hot-swap FETs wired 15 px off their own pins, and three series
breakers the line ran straight through.

Rotation is where most of it came from. `rotate: 90` sends an nmos's pins from
`gate(x-25, y) drain(x+15, y-35) source(x+15, y+35)` to
`gate(x, y-25) drain(x+35, y+15) source(x-35, y+15)` — so a rail drawn along the device's
centre line misses both power terminals. Wire to the pins the catalogue reports, never to an
assumed offset.

Some open ends are correct and the checker knows it: a busbar's two ends (a bus is a node,
and it conducts along its whole length), a port, an op-amp's supply pins, a CT secondary, and
a relay's trip output, which goes to the breaker's operating mechanism rather than to a
terminal in the power circuit.

**Coverage.** `netlist.html` only sees diagrams built through `ComponentModels.diagram()` —
24 of them. The hundreds of hand-drawn ones are covered by a different mechanism:
`schematic-svg.js` runs its own connectivity DRC at render time (`unconnected_pin`,
`node_short`, `keepout_violation`, `floating_label`, `floating_node`) and reports through
`console.error` / `console.warn`, which `sweep-all.html` hooks. So both halves of the course
are checked, by different tools, and the sweep is where they meet.

That is worth verifying rather than believing. Detach one pin — move a wire endpoint 30 px
off `q1.base` in module 1-7 — and the sweep names it immediately:

```
module-01/lesson-07  console.error: [ERROR] Component pin at (135, 125) has no wire connections
module-01/lesson-07  console.warn:  [WARN] Node at (105, 125) has degree 1 - may be floating
```

A safety net you have never seen catch anything is indistinguishable from one that is
switched off.

**4. Contrast.** Any SVG stroke below about 3:1 against `#0b0f16` is invisible. 106 lesson
files were authored against a white page and stroke in `#333` (1.52:1). `schematic-normalize.js`
now remaps those at load — 2,706 elements across the course — but new hand-authored diagrams
should use theme colours directly.

### Current state

Full sweep, 358 lessons: **4,512 controls, 483 canvases, 0 JavaScript errors, 0 non-finite
readouts, 0 geometry findings, 0 connection problems.**

Every control that the sweep could drive non-finite now declares an admissible range, so
`AD.num` clamps it. Sixty of them had no `min`/`max` at all, which is why a reader could type
a zero resistance and get `Infinity` in the results panel.

`schematic-svg.js` runs its own DRC and reports through `console.warn` / `console.error`
rather than by throwing, so an `onerror` listener never sees it. The sweep hooks the console
for exactly that reason — those are the most valuable findings the app produces about itself.
All five it was reporting are now fixed:

- **Module 1-7** drew the current source's return out to `emitter.x + 25` and straight back
  along the same 25 px of `y = gndY`. The source's bottom already sits at ground level, so
  the detour was flat: one conductor drawn twice, which reads as a single wire.
- **The 555 astable builder** routed THRESH along the whole of TRIG's run and repeated its
  drop to node B, laying a second conductor exactly on top of the first. Pins 2 and 6 *are*
  tied in an astable — but a junction dot is how a schematic says so, not a doubled wire.
- **The phase-shift oscillator builder** put each stage's resistor 30 px below the capacitor
  above it, so the capacitor's value ran into the resistor's keepout.

### Known remaining

- Op-amp supply pins are drawn unconnected throughout, which is the usual convention on a
  signal schematic but is not literally complete.

Two console messages appear when running `_audit/sweep-all.html` that are artifacts of the
harness, not defects: MathJax re-registers itself on every lesson that includes it, which only
happens because 354 fragments are being loaded into one document, and a lesson's animation
loop can fire once in the gap between chunks. Neither occurs in the app, where each lesson
gets a fresh context.

---

## What the second solver found

Circuit Toy ran `netlists.json` through its own MNA solver. 102 of our 105 parsed circuits
solved there, every part shape mapped, and the disagreements were worth more than the
agreements. Four things came out of it, three of them bugs on our side.

**The zener was never a zener.** `modelFor` sorted its model names longest-first so that
`D1N4148` would not match as `DIODE`. `ZENER` and `DIODE` are both five characters, so the tie
fell to insertion order and every "Zener Diode" in the course resolved to a plain silicon
diode. Eleven tables, and two circuits — m23l04 and m24l01 — that our solvers reported as
*solved*. Generic families now lose every tie.

**And the stamp ignored breakdown anyway.** `ZENER` carries `BV: 5.1` and the diode stamp was a
bare Shockley exponential, so a zener held twenty volts past its knee carried nothing. m24l01
put its 5.1 V reference at −10.99 V and 0 A, which is not a thing that happens. With breakdown
stamped it clamps at −5.09 V and 672 µA. Both branches are linearised about one limited `vd`;
limiting a separate breakdown voltage leaves the two halves evaluated at different points and
the residual never settles.

**m15l06 has no ground node.** Not one net in its build table is a ground. The MNA matrix is
therefore singular, `gmin` regularised it into one arbitrary member of a family of solutions,
and we reported an operating point with a residual of 1.8e-12 A for a four-cell pack floating
symmetrically about zero. Circuit Toy refused it outright and was right to. `netlist.js` now
refuses a table with no ground before any solver sees it. It is the only one of the 194.

Two circuits moved from "solved" to skipped as a result. Both were previously answered wrongly,
so the count going down is the honest direction.

**Where we still disagree, and it is a parameter not a physics.** m06l09's mirror errors differ
between the two solvers by almost exactly 2:1 — because our generic NMOS uses `lambda = 0.04`
and theirs was run at `0.02`. Error proportional to λ is what the lesson teaches, so the two
implementations agree about the mechanism and differ about one number. The netlist line now
carries `LAMBDA`, `VTO` and `KP` explicitly rather than leaving them to a default: the value was
in the export's `params` all along, but a bare `NMOS` on a netlist line let the far side fall
back to an ideal stamp with infinite output resistance, and a cascode of ideal devices has no
operating point at all.

### The second round: a fourth bug, and the pattern behind three of them

**m20l04's feedback loop was open.** U1's inverting input was wired to `vmid` — the 1.65 V
reference itself — while the divider tap `fb` (amp_out −32k→ fb −1k→ vmid) drove nothing. The
amplifier saw a fixed −1.65 V differential. Circuit Toy's finite-gain solve saturated at
−165 kV; ours reported it clean, because an ideal op-amp forces V+ = V− by construction and a
dead summing node is invisible to it. VIN was also ground-referenced, which saturates the stage
on a single supply even once the loop is closed, so both were fixed: VIN now sits on `vmid`, and
the inverting input is `fb`. The chain idles at mid-rail 1.65 V throughout, gain 33× (1.65 V out
for 50 mV in), −3 dB at 6.44 kHz, −40 dB/decade.

**The pattern, which is worth more than any of the four bugs.** m15l06's missing ground, m20l04's
dead summing node and the zener that carried nothing were all invisible to the *more idealised*
model and obvious to the less idealised one. gmin regularises a singular matrix into a plausible
answer; a nullor op-amp forces its inputs equal whatever they are wired to; a diode without
breakdown is simply absent in reverse. In each case the idealisation did not degrade the answer,
it removed the evidence. `check-feedback-polarity` now carries a second rule for this: feedback
that lands on a node an independent voltage source holds is not feedback, and no solver with an
ideal op-amp can see it. 59 op-amps clean; the original m20l04 wiring fails it as a negative
control.

**m06l09 now agrees to every printed digit, across two solvers.** The lesson teaches at
λ = 0.02 — its interactive defaults there and both practice exercises use it — but tabulated a
bare `NMOS`, which is the simulator default 0.04. A reader working the exercise by hand and then
building the table got an error twice what the lesson said, with nothing wrong in either.
`modelFor` now reads a stated λ from the Value cell (and `text()` decodes `&lambda;`), and the
table states it. Both solvers: nout1 1.02137 V, nout2 1.00178 V, Id 198.9 µA and 199.9 µA,
M1C Vgs 0.899, M3C Vds 0.1929, M4C Vds 0.1252.

### The third round: the export was shorting nets

**Polarity was collapsing in `export-spice`.** The sanitiser mapped every character outside
`[A-Za-z0-9_]` to `_`, so `VIN+` and `VIN-` both became `VIN_`. Three files carried two elements
under one refdes, which real SPICE refuses. The nodes went the same way, and that is the damage
that matters: m26l06's `IN+` and `IN-` collapsed to `IN_`, which does not rename a net — it welds
two distinct nets together and puts the two halves of a differential input across one node pair.
Polarity maps to a letter now, and two guards fail the export loudly: a refdes that is not unique
after sanitising, and two authored nodes that sanitise to one.

**The cascode reference was never diode-connected.** M1C's gate went to its own drain, leaving
`nref2` — the top of the reference branch — facing nothing but an ideal current source. No finite
voltage there carries I<sub>REF</sub>, so it ran away to 149 V in both solvers. Circuit Toy swept
`vb` at 10 mV and proved no value works: M4C leaves saturation at 1.705 V where `nref2` is still
at 130 V, and `nref2` only becomes sane at 1.80 V where M4C is 98 mV into triode. The two
requirements move apart and never overlap. The reference is now diode-connected *through* the
cascode — the M1C/M2C gate bus comes from `nref2` — which is the standard wide-swing mirror and
makes the branch self-biasing. At vb = V<sub>GS</sub> + 2V<sub>OV</sub> = 1.30 V all four devices
sit in saturation, `nref2` is pinned at 900 mV, and it converges in 4 iterations. The window runs
1.20–1.50 V, which is the tell that the topology was the fault and not the number.

**The zener has 7 Ω of series resistance now**, matching Circuit Toy's `COMP_ZENER`. There is no
internal node, so the junction voltage comes from a bracketed solve on u = −(v<sub>j</sub>+BV)/nV<sub>T</sub>
and the branch conductance is folded as g/(1+gR<sub>Z</sub>). Iterating v<sub>j</sub> = v<sub>d</sub> − i·R<sub>Z</sub>
directly does *not* work — at 11 V of reverse bias it overshoots to 1e32, returns exactly to
v<sub>d</sub>, and oscillates, reporting a zener 6 V past its knee as carrying nothing. That is
the same symptom as the bug it was fixing, which is why it survived a run.

**Two AC lessons now say the transistor is ideal.** m05l15's C<sub>PI</sub>/C<sub>MU</sub> and
m05l24's C<sub>L</sub> are a 2N3904's own capacitances written as discrete parts — a good
teaching choice, because it makes Miller something you can delete and re-add, but any simulator
with a real device model counts them twice: 276 kHz against our 481, and a peaking improvement of
1.53 against 1.73. Both lessons say so now.

**m05l24's output node had no DC return** — `out` sat between COUT and CL with nothing resistive
on it. It has a 1 MΩ now, which with the 10 pF is a scope probe and moves the measured corner not
at all (27.51 MHz before and after). `check-build-nets` carries the general rule: a node whose
only connections are capacitors has no operating point. Structural, so it needs no solver — which
is the point, since the solvers are what cannot see it.

**m05l11-4 is the one where a saturating device is the answer.** Circuit Toy's Newton rings on it
forever; ours settles at V(out) = −508.22 mV, residual 3.1e-17 A. The reason is that the output
node is a PNP collector facing an NPN collector, so while both stay forward-active it is two
current sources in series and nothing determines the node at all. What ends it is Q2 saturating
at V<sub>CE</sub> = 139 mV. A solver whose BJT has no hard region transition may never find the
corner the solution sits on.

### Still open

- ~~Six lessons name "Zener Diode" with no voltage~~ — all six now state one, and
  `check-build-values` fails any zener row that does not. Four of them were worse than
  unvalued; see "The fourth round" below.
- ~~m15l06's control sources short the pass FETs~~ — rebuilt; see below.
- ~~m06l09's cascode devices land in triode~~ — fixed by diode-connecting the reference through
  the cascode; see above.
- **The zener default disagrees with Circuit Toy's.** `netlist.js` gives the generic ZENER
  RZ = 7 Ω, "matching COMP_ZENER". Circuit Toy's `src/component.c` defaults `rz` to **5 Ω**;
  7 Ω is its 1N4733A preset's Z<sub>ZT</sub>. Changing ours moves m23l04's and m24l01's clamp
  values, so it is a decision, not a fix. Every table written since states its own rz.
- **m22l04's two coordination interactives invent their physics** — the stage-2 clamp is
  `min(v1Clamp / (1 + L/10), 58)`. The build section beneath them now says why that is wrong
  for a clamping primary; the interactives still need rewriting to agree with it.
- **solve-op's per-node step clamp can open a junction between two floating nodes.** MAXSTEP
  clips each node to 2 V per iteration independently, so the midpoint of a back-to-back TVS pair
  lags its neighbour by ~9 V during a negative-going solve, and the forward limiter then walks it
  back a thermal voltage at a time: m22l04 at −300 V needs ~1000 iterations against a 400 cap.
  Positive polarity converges at once. Scaling the step vector instead of clipping it would fix
  this and might slow the 120 MV gmin-node case it was added for; not attempted.
- **A reversed unidirectional TVS is not caught structurally.** m18l02 and m24l02 had the anode
  on the rail. A TVS with its anode on a negative rail is correct, so no wiring rule separates
  the two without knowing the rail's sign; a DC solve does, but both tables had pulse sources.

### The fourth round: protection tables that protected nothing

Stating the six missing voltages meant reading the six tables, and four were wired so the
protection could not work at any voltage.

**Two TVSs were forward-biased across their supply.** m18l02 and m24l02 put the TVS anode on the
rail and the cathode on ground: a diode across 13.5 V and 12 V. Both now sit cathode-to-rail
with a datasheet part behind them — Vishay SM8S24A (load dump, 24 V stand-off so the 24 V/60 s
jump-start test leaves it off) and SMBJ15A (15 V stand-off over a 12 V ±10% rail).

**Two "bidirectional" clamps were two diodes.** m22l04 and m23l05 wired their zener pairs
anti-parallel, one each way round between the same nodes, so each pair clamped at ±0.7 V. A
bidirectional clamp is two zeners in series, anode to anode. `check-build-nets` now fails an
anti-parallel zener pair; the original tables are its negative control.

**m22l04 also had no surge amplitude and a 1 GΩ series resistor** cutting the varistor off from
the source. Fixed, it shows something the lesson's interactive denies: behind a *clamping*
primary, 10 µH does not decouple a 50 µs surge (the branch time constant is under 4.4 µs), and
the TVS takes 61 A at a 300 V plateau and ~381 A at 2 kV against a 10.3 A rating. Inductive
decoupling needs a crowbar primary. The build text and the practice answer say so.

**m23l05 had three faults besides its zeners.** The reverse-polarity PFET's gate went to its own
source (V<sub>GS</sub> = 0, permanently off), the gate had no clamp for a 40 V event, and a
10 Ω resistor sat in series with the ECU supply — about 10 V of drop at the 1 A a 5 V buck draws
at 6 V cranking, in a lesson whose requirement is to run at 6 V. The figure and table now carry
a 10 µH LC-filter inductor.

**rz is now a stated value.** Circuit Toy exposes the zener's `rz` beside `vz`, and `netlist.js`
now reads "rz = 0.31 Ω" from a Value cell. A TVS is a fraction of an ohm; at the generic 7 Ω the
m24l02 clamp reads 34.6 V instead of 18.2 V. The SPICE export marks any non-default BV or RZ
UNSUPPORTED rather than emitting a 5.1 V / 7 Ω part.

**A solver bug the TVS exposed.** solve-op limited the breakdown knee on the *terminal* voltage,
which with rz includes a linear I·rz drop, so a TVS carrying tens of amps moved a few millivolts
per Newton step and a bidirectional pair needed thousands of iterations. It now limits the
junction voltage and maps back exactly. Every existing operating point and SimCheck comparison
is byte-identical before and after. solve-op's device report also evaluated a reverse-conducting
MOSFET from its printed terminals (6.914 A in series with 6.933 A); it swaps as the stamp does.

**m15l06 and m23l08 were rebuilt.** m15l06 is the figure's common-drain low-side NMOS pair with
explicit body diodes, a 5 mΩ shunt and source-referenced 12 V drives (BQ769x0's nominal level);
seven probes cover discharge, each FET off, and charging through the shunt. m23l08's VBE
multiplier had base and emitter on one node and was fed from two emitter followers that put its
collector 1.3 V *below* its emitter, so every transistor sat at cut-off; it is now the figure's
multiplier fed by a current source and a VAS stand-in, idling at 33 mA with the generic models.

---

## Notes for contributors

**Reading inputs.** Use `AD.num('element-id')`, never `parseFloat(el.value)`. `AD.num` falls
back to the field's default when it is blank or unparseable, and clamps to the element's
`min`/`max`. That is what stops a cleared box from rendering `NaN` in the results panel and a
negative resistance from producing infinite gain.

> **It takes an element ID, not a value.** `AD.num(document.getElementById('x').value)`
> evaluates `getElementById("100k")` → `null` → `NaN`. 152 call sites had this; where they
> had a `|| fallback` the bug was invisible and the control was simply dead. If you want to
> parse a raw string, `AD.parseValue('4.7k')` is the one that does that.

`AD.parseValue` understands SI multipliers *and* a trailing unit, so `3.3V`, `50pF`, `1us`,
`4mA` and `10kohm` all parse. `AD.fmtInt(x)` prints a thousands-separated integer — use it for
amps and volts, where `AD.fmt` would collapse 1,339 A to an unhelpful "1k".

**Formatting.** `AD.fmt(x)` renders engineering notation and already returns `—` for anything
non-finite. `AD.fmtUnit(x, 'Ω')` appends a unit.

**Schematics.** Prefer `ComponentModels` for new diagrams. `SCHEMATIC_METHODOLOGY.md` documents
the layout rules the DRC enforces: orthogonal routing only, junction dots at any node of degree
≥ 3, no 4-way junctions, pin escape of at least one grid unit, and no text overlapping wires or
keepouts.

**Adding a lesson.** Drop the fragment in `lessons/module-NN/`, then add a matching entry to
`assets/curriculum.js`. The welcome screen counts and the sidebar are generated from that array,
so a file without an entry exists on disk but is unreachable — which is exactly how 16 lessons
went missing before.

---
