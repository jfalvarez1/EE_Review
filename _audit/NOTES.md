# Internal notes

Working notes for whoever maintains this repo. **Not customer-facing** — the README is the
front page and deliberately says nothing about smoke tests, DRC counts or which of these tools
has lied to me. That belongs here.

Everything below assumes a server is running: `./launch.bat` or `python tools/serve.py`.

---

## The audit tools

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
