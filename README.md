# EE Review — Analog Design & Power Systems Study Guide

A browser-based study guide for electrical engineering. **26 modules, 359 lessons**, each one
short enough to read in a sitting: the concept, the equations that matter, a worked example
with real numbers, an interactive calculator, and the gotchas that only show up on a bench or
in the field.

It reads two ways, and they are genuinely different documents:

- **[The learning path](#the-learning-path)** (`#path`) — one ordered route for someone who has
  finished a first circuits course and wants to end up designing. Foundation first: what an
  amplifier *is*, then the ideal op-amp, then why feedback makes it true, then the transistor
  arriving as the answer to "how was that built" rather than as a prerequisite. Every step says
  what it earns you.
- **The sidebar** — the same lessons, browsable by topic. It now runs in the same order as the
  path, so you can follow it top to bottom or jump straight to what you need.

![The welcome screen, showing 26 modules and 359 lessons](docs/images/welcome.png)

### Suggested pairing: run the simulations in Circuit Toy

This guide **teaches and calculates**; it does not simulate. Where a lesson would benefit from
seeing a circuit actually solved — a mirror's output resistance against collector voltage, a
loop's phase margin, a converter's ripple — build it in the companion project:

> ### 🔌 [**Circuit Toy**](https://github.com/jfalvarez1/circuit_toy)
> A fully featured circuit simulator with a synthwave bench: MNA analog + digital solver,
> live probes, and a schematic editor.

The two are designed to sit side by side. This repo's symbol catalogue is ported from Circuit
Toy's component registry, so a schematic here and a schematic there use the same conventions
and the same pin geometry — which means a circuit you read about in a lesson is a circuit you
can rebuild in the simulator without translating anything.

---

## Running it

**Windows:** double-click `launch.bat`.
**macOS / Linux:** `./launch.sh`.

Both find Python, start a server, open your browser, and print a second URL you can open on
your phone:

```
  Analog Design Refresher Course
  --------------------------------------------
  On this computer:  http://localhost:8080/index.html
  On your phone:     http://192.168.0.108:8080/index.html
                     (same WiFi network)

  Start here:        http://localhost:8080/index.html#path
  Symbol reference:  http://localhost:8080/components.html
```

If 8080 is busy it takes the next free port rather than failing, and it serves with caching
off so an edited lesson appears on reload instead of three reloads later. `--local-only`
binds to loopback if you would rather nothing on the network could reach it; `--no-browser`
and `--port N` do what they say.

**Why a server at all**, when there is no build step? Because lessons are fetched with
`XMLHttpRequest`, and every browser blocks that on `file://`. Opening `index.html` directly
gives you a sidebar full of lessons that will not load — which is why the launcher has no
"just open the file" fallback. It would produce exactly the broken page it was meant to
avoid.

Any static server works if you prefer:

```bash
python -m http.server 8080      # then http://localhost:8080/index.html
npx --yes http-server -p 8080 -c-1
```

No build step, no dependencies, no `node_modules`. It is plain HTML, CSS and ES5-compatible
JavaScript. Python is needed only to serve the files, not by the course itself.

---

## The learning path

Open `#path`, or the **Start here** link above the sidebar search.

The modules are now sequenced in teaching order, and the path is the explicit route through
them. That was not always true, and the reasons are worth recording, because they are what the
order is designed to avoid:

- **It used to be inverted.** The course opened with 35 lessons of BJT internals, before the
  learner had met an op-amp. You can use an op-amp correctly long before you can explain one,
  so op-amps are now module 1 and the transistor arrives at module 4 as the answer to *how was
  that built*.
- **Feedback used to be module 25 of 26.** The golden rules in module 1 are only true because
  of it, so the learner applied feedback for 23 modules before being told why it worked. It is
  now module 3, immediately after the circuits that depend on it.
- **Modules did not build internally either.** The differential pair and current mirrors came
  before DC biasing; the high-frequency AC model sat twelve lessons after the frequency
  response it exists to explain; and the FET module taught the device as a power switch for
  twenty lessons before mentioning gain. All three are reordered.

The path runs through those modules in nine stages:

| | Stage | What it earns you |
|---|---|---|
| 1 | What an amplifier is | Gain, Zin, Zout, and why there are exactly four kinds |
| 2 | Using the ideal op-amp | Real circuits, solvable with two rules and no transistors |
| 3 | Why any of that worked | Feedback, before the circuits that depend on it |
| 4 | It stops being ideal | Bandwidth, slew, Vos, noise, and the datasheet that predicts them |
| 5 | Inside: the switch | The transistor with no small-signal model needed |
| 6 | The BJT as an amplifier | Model, then bias, then topologies — the catalogue's reverse |
| 7 | The FET as an amplifier | gm, common-source, and where the square law fails |
| 8 | The blocks an op-amp is made of | Diff pair, mirrors, active loads, cascode |
| 9 | Designing with real parts | Datasheets, tolerances, and choosing a part by number |

37 steps. Thirty point at existing lessons; seven were written because the catalogue had no
lesson for them at all — including, surprisingly, **the common-source amplifier**: module 5 is
20 lessons of MOSFET material that teaches the device almost entirely as a power switch.

The catalogue was renumbered to match, so the sidebar and the path now agree rather than
telling two different stories. Saved progress is keyed by module and lesson number and was
reset by that change; nothing else was affected, since no lesson links to another by number.

**Depth, per topic.** Every lesson written for the path carries the same four things: a
derivation from first principles, worked numbers escalating from clean to realistic, real part
numbers with real datasheet figures, and the failure modes that bite you on a bench. The path
ends where the numbers do — designing a current mirror to a ±5% spec, working the error budget,
and choosing between a $0.15 dual and an $8 matched pair.

---

## What is in it

| Modules | Subject |
| --- | --- |
| 1–5 | BJT and MOSFET device intuition, op-amp fundamentals, practical skills |
| 6–10 | Power electronics, audio, data conversion, design trade-offs, output stages |
| 11–15 | Oscillators and timing, digital interfacing, comms protocols, analog blocks, practice problems |
| 16–20 | Real-world scenarios, troubleshooting, power supply design, battery management, sensor interfacing |
| 21–25 | RF analog, EMI/EMC, system design, complex projects, feedback theory and stability |
| **26** | **Power systems and the grid (ERCOT / AEP)**, including four lessons on transmission line design and speccing |

Module 26 is the newest and the odd one out: undergraduate power-systems theory (per unit,
symmetrical components, the swing equation, power flow) paired with how the Texas grid and a
large US utility actually operate — EEA escalation thresholds, the Winter Storm Uri timeline,
765 kV transmission economics, relay coordination practice, and field safety.

![Module 26's EEA escalation calculator, driven into an EEA3 state](docs/images/ercot.png)

There is also a standalone **[component reference](components.html)** — every schematic symbol
the course draws, with its parameters, governing equations and failure modes, searchable and
filterable by category.

![The component reference, with detail panels open](docs/images/components.png)

---

## Layout

```
launch.bat / launch.sh   Start the local server and open a browser
index.html               The application shell and welcome screen
components.html          Searchable symbol + parameter reference
assets/
  ad-framework.js        AD namespace: parsing, waveform generation, DSP, canvas plotting
  component-models.js    Component model catalog — 67 symbols, ported from circuit_toy
  schematic-svg.js       Schematic engine: symbol drawing, DRC, pre-built circuit generators
  schematic-normalize.js Post-render normalisation of hand-written lesson SVGs
  curriculum.js          Curriculum data + AppState, Navigation and Router
  learning-path.js       The ordered spine behind #path
  exercises.js           108 exercises across 8 sets and 4 difficulty levels
  widgets.js             Oscilloscope, calculator and exercise widgets
  styles.css             The whole stylesheet
lessons/module-NN/       359 lesson fragments, one HTML file each
tools/                   serve.py — the local web server the launchers use
docs/                    Troubleshooting notes and README images
split_pdfs/              Reference PDFs (see Licensing note below)
```

### How a lesson loads

`Router.loadLesson()` fetches `lessons/module-NN/lesson-NN.html`, injects it into
`#lesson-content`, and re-creates its `<script>` tags so they execute. Four things happen
around that injection, all of them there because lessons were originally authored as
standalone pages:

1. **External scripts load at most once.** A lesson that carries its own
   `<script src="../../assets/ad-framework.js">` would otherwise redeclare `const AD` and throw
   `SyntaxError: Identifier 'AD' has already been declared`, killing the rest of that tag.
2. **Each lesson's inline script is wrapped in a function scope,** with its top-level functions
   re-published on `window` so inline `onclick=` handlers still resolve. Without this, two
   lessons that both declare `const canvas` collide the moment you navigate between them.
3. **`DOMContentLoaded` and `load` handlers are redirected to run on the next tick.** Both
   events fired long before the fragment existed, so lessons that defer their setup to them
   would never initialise at all.
4. **Timers are scoped to the lesson.** Every `setInterval`, `setTimeout` and
   `requestAnimationFrame` is tagged with a navigation generation and cancelled when you move
   on, so animation loops do not keep firing against a DOM that no longer contains their canvas.

If you add a lesson, you do not need to think about any of this — write it as a fragment and
it works.

---

## The component model catalog

`assets/component-models.js` is the single source of truth for schematic symbols. It holds
**67 components across 12 categories**, each carrying geometry, electrical parameters,
governing equations, and study notes.

The models are ported from the component system in **circuit_toy**, a C/SDL2 circuit simulator
in a sibling project. Its registry defines 125 component types grouped by a `PaletteCategoryID`
enum; the `toy:` field on each model here records the matching `COMP_*` name so the two
catalogs can be diffed.

**The two projects render very differently, and the geometry reflects that:**

| circuit_toy | EE Review |
| --- | --- |
| Immediate-mode SDL2, redrawn every frame at 60 fps | Static SVG, emitted once and scaled by the browser |
| Symbols in device pixels at the current zoom | Symbols in a local frame, placed by transform |
| Animated — current arrows move, hot nodes glow, probes update live | Nothing animates; the frozen symbol carries all the information |
| Correctness proven by running the MNA solver | Correctness proven by the DRC: keepouts, pin registry, text collision |
| Purpose: play with a live circuit | Purpose: recognise a symbol and recall its equations in seconds |

Practical consequences: polarity marks and arrows are drawn slightly larger here because they
are never disambiguated by watching current flow; strokes use
`vector-effect="non-scaling-stroke"` so they stay legible at any zoom; and every symbol declares
an explicit keepout and pin escape direction so the router can work around it.

circuit_toy's solver detail was deliberately **not** ported — the theta-method companion models,
`GMIN`, the Newton loop — because this project does not simulate. Several of its models are also
acknowledged stubs (SCR and TRIAC never latch; DAC/ADC/VCO/PLL emit a fixed 2.5 V; the varactor
and photodiode share a plain diode stamp), so the electrical descriptions here were written from
device physics and datasheets rather than copied from those stamps.

### Using it

```js
ComponentModels.get('nmos')                    // the model object
ComponentModels.symbolSVG('nmos', {width: 150}) // a standalone <svg> string
ComponentModels.draw('nmos', {x, y, rotate})    // {markup, pins, keepout}
ComponentModels.diagram({parts, wires, texts})  // a complete one-line diagram
ComponentModels.byCategory()                    // {category: [model, ...]}
ComponentModels.validate()                      // catalog self-check
```

Coordinates are local pixels with the origin at the body centre. A standard two-terminal part is
50 px long with pins at (−25, 0) and (+25, 0), matching `COMP_LENGTH = 50` and `GRID = 5` in
`schematic-svg.js` — so a model placed on a grid point keeps its pins on grid.
`ComponentModels.validate()` enforces that, along with pin uniqueness and direction validity.

---

## A note on `split_pdfs/`

The reference PDFs (*The Art of Electronics*, the *Analog Pocket Reference*, TI's *Analog
Engineer's Circuit Cookbook*) are third-party copyrighted works and are **not** licensed for
redistribution.

They were **removed from git history on 2026-08-31** with `git filter-repo`, and `split_pdfs/`
is now in `.gitignore`. Keep your own copies locally if you want them — nothing in the
application reads them at runtime, so the app works without the directory present.

The `split_pdfs.py`, `resplit_pdfs.py` and `split_analog_ref.py` scripts remain, so you can
regenerate the split files from your own copies of the source documents.

---

## Acknowledgements

Component models adapted from the [circuit_toy](https://github.com/jfalvarez1/circuit_toy)
simulator. Power-systems content draws on ERCOT Nodal Operating Guides and Planning Guide,
the FERC/NERC staff report on the February 2021 cold weather outages, NERC reliability
standards, the AEP 2024 Factbook, and IEEE standards C37.112, C57.13, 80, 1366 and 1584.
Figures quoted in Module 26 are cited in the lessons themselves; treat them as a study aid, not
as a design authority.
