# The design-experience programme

## The claim we are trying to earn

Most courses end with a disclaimer shaped like this:

> By the end of this course the student will have the tools to learn and
> troubleshoot electrical circuits.

That is a promise about *potential*. The promise this course wants to make is
about *record*:

> By the end of this course you will have designed things, debugged things,
> and been wrong in ways you can now recognise on sight.

Those are different products. The first needs coverage. The second needs the
reader to have done work that was judged. This file tracks the gap between the
two and what closes it.

The tone to aim for, in the user's words: *a team of engineers next to you who
answer all the questions and guide you little by little, but also make you
think from time to time.* Not a lecture, and not a puzzle book either.

---

## Progress

| | baseline | now |
| --- | --- | --- |
| build sections stating what a correct build shows | 3 / 173 | **22 / 173** |
| expected values stated | ~8 | **72** |
| perturbations with a predicted outcome | 0 | **88** |
| lessons with an acceptance check | 7% | **12%** |
| lessons asking the reader to do nothing | 237 | **221** |

Done so far: M1 L2–L5, M2 L1–L4, M5 L1/L3/L5/L6/L7, M6 L1/L7/L8/L9,
M7 L1–L3, M9 L1–L2. One `DesignBriefWidget` (M5 L5, bias design) and one
`FaultFindWidget` (M5 L6, the stage with no gain).

**Nine netlists were unbuildable as written and were found only because
stating an expected value forces you to solve the circuit.** M2 L3's
Sallen-Key had C2 across a single node and a design table demanding an
impossible Q; M2 L4's Schmitt had ideal sources on both comparator inputs
and therefore no hysteresis; M2 L2's in-amp had its difference stage
inverted; M7 L2's class AB had a VCVS wired to double its own input; M7 L3
had a PMOS upside down; M1 L5 swept a source that did not exist; M1 L3
specified a pulse of period zero. M5 L6 promised an unloaded gain for a
loaded stage. That is the strongest argument for finishing the remaining
151.

## Where we actually stand

`node tools/survey-design-practice.js` scores every lesson on four properties.
The numbers below are the baseline taken before any of this work started, so
re-running it is a progress measure, not just a report.

```
408 lessons scored on design practice

  gives a BRIEF with numbers to hit      87   21%
  gives an acceptance CHECK              27    7%
  shows ABUSE / what breaks it           87   21%
  asks the reader to DIAGNOSE            55   13%

  none of them                          237   58%
```

And the sharper one. There are **168 lessons with a Circuit Toy build table**.
Every one of them says what to build and what to watch. **Three** say what the
reader should *see*.

That is the single biggest hole in the course, and it is the same hole most
textbooks have: run the simulation, and then it is entirely on you to decide
whether the result means anything. A reader who miswires the feedback resistor
gets a plausible-looking trace and no reason to doubt it.

Per-module, the weakest are M8 and M16 (0%), then M3, M11, M17 and M20 (under
7%). M29 (89%), M21 (52%) and M28 (46%) are the shape the rest should reach.

---

## The instruments

Two widgets exist in `assets/design-brief.js`. They are the mechanism; the
work is applying them.

### `SimCheckWidget` — "you simulated it; here is how to know it is right"

Renders a table of the node voltages, currents and timings a **correct** build
produces, with tolerances. The reader types what they measured and gets a
per-row pass/fail with the percentage error and the reason the number is what
it is. Then a **Then perturb it** section: *attach a load at X*, *inject a
source at Y*, and what should happen when they do.

Proven in `lessons/module-01/lesson-02.html`.

### `DesignBriefWidget` — the reader designs it, and the design gets checked

A specification with real targets, input fields, and a `check(v)` that judges
each criterion separately. Failures say what physically goes wrong, not
"incorrect". Hints come one at a time. The worked approach unlocks only after
an attempt, so it is a comparison rather than a substitute. Completed designs
persist under `design:<id>`, which is what a portfolio view would read.

### Still to build: a fault-diagnosis widget

Symptom → choose a probe → see what that probe reads → commit to a hypothesis.
The point is that the reader pays for information with an action, the way they
would on a bench, rather than being handed the cause. Nothing in the course
currently does this, and "troubleshooting experience" is a third of the claim.

---

## Work items

### 1. Retrofit expected values into the build sections — **165 remaining**

For each lesson with a Circuit Toy table, add a `SimCheckWidget` carrying:

- **3–5 probes.** Node voltages first, because they are unambiguous and they
  are what a reader can actually read off a cursor. Prefer DC operating points
  and settled amplitudes over anything requiring an FFT.
- **A `why` per probe**, derived from the values in the build table above it.
  If the number cannot be derived from what is on the page, it does not belong
  in the table — a magic constant teaches nothing.
- **A tolerance that means something.** Tight where the model is ideal, loose
  where a device model is doing the work.
- **2–4 perturbations.** At least one load-attach and one source-inject, both
  stated with the expected outcome, because the user asked for exactly those
  and because they are what separates "it simulated" from "I understand it".

Priority order: M5/M6 (device behaviour, where wrong intuition is cheapest to
fix), M1/M2 (op-amps, most-read), M9/M10 (power), then the rest.

### 2. Close the brief/check gap in the 237 lessons that ask for nothing

Not every lesson needs a full design brief. The bar is that a reader finishes
it having *committed to something*. Prefer, in this order:

1. A `DesignBriefWidget` with numeric targets, where the lesson teaches a
   procedure that produces values.
2. A perturbation-only `SimCheckWidget`, where the lesson teaches behaviour.
3. A worked exercise with an acceptance criterion, where neither fits.

### 3. Bridge to PCB — leverage KiCad and the local tooling

**This is the explicitly requested item.** The course currently teaches
schematic design and simulation, then jumps to finished boards in M29. The
reader never crosses the gap themselves.

What exists to build on:

| Asset | What it gives us |
| --- | --- |
| `tools/board-to-json.js` | reduces a `.kicad_pcb` to nets, tracks, vias, pads, zones, parts |
| `assets/board-viewer.js` | layer-by-layer interactive viewer, clickable nets, annotation boxes |
| `tools/measure-clearance.js` | real measured clearances checked against IPC-2221B |
| `tools/analyse-kicad-pcb.js` | board fact extraction |
| the autorouter | themed palettes, and an autorouted/human-corrected pair of the same board |
| the routed-board suite | attinyheart, IEEE_WS2, PCB_Badge, Workshop, esp32_s3_devkit, olimexino_2560, pic_programmer_v10, stickhub |

The sequence to build:

- **Schematic → netlist → footprints.** Take a circuit the reader already
  simulated in Circuit Toy and walk it into KiCad. The continuity is the
  teaching: it is *their* circuit, not a new one.
- **A layout brief with measurable acceptance.** "Place these five parts so
  that the feedback node is under 8 mm of trace and the input cap's return
  path does not cross the output". Then a checker — the tooling already
  measures trace length, clearance and net topology, so the acceptance can be
  computed from the reader's own `.kicad_pcb` rather than eyeballed.
- **Autorouted vs corrected, on their own board.** The ignition controller
  pair already proves the lesson (same 49 parts, both 21/21 nets, both 0 DRC,
  and the routed one is still wrong because it poured GND onto the layer
  carrying 89 tracks). The reader should reach that conclusion by measuring,
  not by being told.
- **A DRC that is not the whole story.** DRC-clean ≠ correctly referenced.
  This is the single most valuable thing the board suite can teach.

Open question to resolve before starting: whether the reader's board comes back
to the course for checking (a paste-the-file flow, since `board-to-json.js`
runs offline and the viewer already reads its output), or whether the
acceptance criteria are stated precisely enough to self-check. The first is
better and is probably a `kicad_pcb`-drop onto the page.

### 4. Remaining smaller gaps

- RF passives lesson: baluns, couplers, switches.
- 16 lessons with no visual at all (interview prep and problem sets).
- The rest of the routed-board suite, beyond the four already analysed.
- Advisory findings not acted on: 184 skeletal + 171 thin lessons by depth,
  22 canvases with no control, the M3 taxonomy flag.

---

## How to know this is working

Re-run both surveys. The target is not 100% — some lessons are reference
material and should stay that way — but:

- **check** should climb from 7% to above 60%, because that is the property
  that turns reading into doing.
- **the 165** should go to zero. Every build table gets numbers.
- **diagnose** should climb from 13% once the fault-diagnosis widget exists.

```
node tools/survey-design-practice.js
node tools/survey-design-practice.js --gaps
node tools/audit.js --full
```
