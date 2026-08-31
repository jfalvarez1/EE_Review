# Schematic SVG Layout Engine Methodology v2.2  
Deterministic, registry-validated SVG schematics for HTML delivery

> **Scope:** This document defines a deterministic, graph-driven pipeline for generating publication-quality circuit schematics as **SVG embedded in HTML**.  
> **Goal:** Enforce **electrical correctness** and **visual legality** (no wires through bodies, no ambiguous junctions) through registries, keepouts, and validation.

---

## 0) Summary of v2.2 Improvements (vs v2.0)

v2.0 worked but contained contradictions and missing hard constraints that cause common failures (floating labels, pin misalignment, silent shorts, cosmetic junction dots). v2.2 resolves these and adds strict determinism.

### Critical changes
1. **Grid policy is consistent and supports symbol pins:**  
   - Default `GRID = 5` so common pin offsets (e.g., `+65`) stay on-grid.
2. **Escape directions rotate with component rotation:**  
   - `pin.dir` must be rotated when the component rotates, or stubs point the wrong way.
3. **True node-level short detection:**  
   - Different nets may not claim the same node coordinate (unless explicitly allowed via NetTie).
4. **Full Manhattan intersection model:**  
   - Detects not just perpendicular crossings but also endpoint touches, T-intersections, and collinear overlap.
5. **Segment splitting is mandatory for same-net intersections:**  
   - Same-net crossings/tees create real nodes and require junction dots (not cosmetic).
6. **Keepouts are enforced during routing:**  
   - Routes are rejected before emission if they cross component bodies/keepouts.
7. **Deterministic tie-breaking:**  
   - Same input must yield byte-identical SVG (stable ordering and routing attempts).
8. **Bounds can be exact (optional but recommended):**  
   - After emitting text, measure `getBBox()` to prevent clipping.

---

## 0.05) External Rule Set (v3.0 Precision) - Adopted

This project also adopts the rule set in:
`C:\Users\juanf\Downloads\schematic_design_guidelines_v3_0_precision.md`

When in doubt, follow the stricter rule. Key additions from v3.0:
- **ORTHO_STRICT routing:** no diagonal net segments (all wires axis-aligned).
- **Junction dot required** for any node with degree >= 3; forbid 4-way "+" junctions.
- **Pin escape rule:** first segment must leave a pin in its edge direction for at least 1 grid unit.
- **Text clearance:** labels must not overlap wires, keepouts, or junction dots.
- **Explicit power pins + decoupling requirement** for ICs (or a declared exception).

---

## 0.06) v3.0 Precision Details (Required)

These are the additional hard/soft rules now expected for all schematics. Keep them in mind even when the validator does not yet enforce every rule.

### Rule header (per sheet)
Include a small note on each schematic with the active rules:
```
routing_mode = ORTHO_STRICT
power_pins_mode = EXPLICIT
junction_dot_mode = REQUIRED
keepout_margin = 0.5 GU
include_annotations_in_geometry_checks = false
```

### Canonical data model (for deterministic checking)
Each schematic must be representable as:
- **Components**: `refdes`, `value`, `body_bbox`, and `pins[]` where each pin has `xy` and `edge_dir` in {N,S,E,W}.
- **Wires**: axis-aligned net segments.
- **Junctions**: explicit dot nodes with net association.
- **Net labels / ports**: label + scope (LOCAL / GLOBAL / HIER_PORT).
- **Text**: bounding boxes to enable collision checks.

### Grid contract + angles
- Pins, wire endpoints, and junction dots land on integer grid points.
- Text may sit on 0.5-grid, but must not collide (see Text rules).
- ORTHO_STRICT: any diagonal segment is a hard failure.

### Connectivity semantics
- Junction dots required at any node with degree >= 3.
- 4-way "+" junctions are forbidden; split into two T-junctions separated by >= 1 GU.
- Crossing rules: a dot only on T-junctions; a crossing without a dot must be a 90-degree pass-through.

### Keepouts + pin escape
- Keepout = component body expanded by margin `M` (default 0.5 GU).
- **Body-to-body clearance:** keepout rectangles must be separated by >= 2 GU (minimum). Treat any overlap as an error.
- **Validator enforcement:** component overlap checks expand each keepout by 1 GU per side (2 GU total) and flag any overlap as `component_overlap` (overlap or insufficient clearance).
- **Transistor keepouts must include the optional circle body** (when `circle:true`) so overlap checks catch symbol collisions.
- Wires may only enter keepout at a pin endpoint (no through-body routing).
- Pin escape rule: first segment from a pin must leave in its `edge_dir` and extend >= 1 GU without re-entering keepout.
- **Component overlap check (basic):** component keepout rectangles must not overlap each other. The validator flags this as `component_overlap`.
- **Spacing over compression:** If labels/components feel crowded, increase the schematic height/width and re-space parts instead of squeezing or overlapping.

### Text + label collision rules
- Text must not intersect any wire, junction dot bbox, or component keepout.
- Maintain >= 0.5 GU clearance to wires and junction dots.
- Text must not overlap other text labels (text-text collisions are errors).
- Net labels must touch a wire segment or port coordinate.
- **Validator enforcement:** text bounding boxes are checked against wires, keepouts, pins, and junctions. If collisions occur, increase spacing or the schematic height rather than compressing components.
- **Symbol-internal glyphs:** mark intrinsic symbol marks (e.g., voltage source +/−, op-amp ±) with `internal: true` so they are excluded from DRC text-collision checks.

### Nets + hierarchy
- Nets leaving a functional block must be labeled.
- Cross-sheet connections must use ports/labels (no implied long wires).
- Long-wire warning: > 25 GU end-to-end should be replaced with labels/ports.
- Reference designators must be unique per sheet set.

### Power integrity
- EXPLICIT power pins required on all ICs.
- Each IC power pin pair requires at least one decoupling capacitor.
- If multiple grounds (AGND/DGND), the tie must be explicit (net-tie or 0 ohm).

### Analog readability
- Op-amp outputs must face right; inputs on left.
- Feedback separation (negative above, positive below) is recommended.
- Oscillator loop must be traceable as a closed loop in the net graph.

### Required outputs (generator expectations)
Any generated schematic should include:
- A rule header (above).
- A netlist (net name -> list of pins/labels).
- A DRC report (violations with coordinates and suggested fixes).

### Allowed exceptions (must be declared)
- `allow_bus_notation=true`
- `allow_hidden_power_pins=true` (requires a Power Net Declaration block)
- `include_annotations_in_geometry_checks=true`

---

## 0.1) Public API & Lesson Integration

This repo supports two ways to render schematics in lessons:

1. **Factory circuits (recommended):** call a named circuit factory on `AD.Schematic`:
   ```js
   AD.Schematic.wienBridgeOscillator(containerEl, { r: '10k', c: '10n' });
   ```
2. **Legacy builder API:** create an ad-hoc schematic and render it as SVG:
   ```js
   const svg = new SchematicSVG(420, 260);
   // svg.wire(...); svg.resistor(...); svg.opAmp(...)
   containerEl.innerHTML = svg.render();
   ```

**Compatibility note:** `window.SchematicSVG` is a constructor **and** has the `AD.Schematic.*` factory methods mixed in for older lessons (`SchematicSVG.lcTankWithQ(...)`). Prefer calling factories via `AD.Schematic` in new content to avoid API ambiguity.

**Validation (required):** run `node tools/validate-schematics.js` and keep the output at **0 warnings/errors**. The validator catches:
- Wires that visually "cut through" component bodies (keepout violations)
- Labels placed off-net (`nodeLabel()` dot not actually connected)
- Dangling nodes/pins that tend to look like disconnects
- **Text overlap and component overlap** (labels colliding with wires/keepouts or components placed too tightly).  
  If the layout feels cramped, **increase the schematic width/height** instead of squeezing components.

**Annotation rule:** use `text()` for free-floating notes. `nodeLabel()` implies an electrical node and will warn if it’s not connected.

**Conceptual diagrams:** if you're drawing a block diagram (not a literal circuit), either avoid `wire()` entirely or make sure any block "ports" are treated as `pin`/`label` nodes so they don't trigger floating-node warnings.

## 0.3) nodeLabel() vs text() - Critical Distinction

The `finalize()` method validates that every `nodeLabel()` is placed on an actual wire or junction. Using `nodeLabel()` for floating annotations causes "SCHEMATIC ERROR" overlays.

### When to use nodeLabel()
Use `nodeLabel()` ONLY when the label dot is directly on a wire coordinate:

```js
// CORRECT: nodeLabel on a junction point
sch.wire([[50, 100], [100, 100]]);
sch.junction(100, 100);  // Junction at (100, 100)
sch.nodeLabel(100, 100, 'A');  // Label AT the junction

// CORRECT: nodeLabel at wire endpoint
sch.wire([[50, 100], [100, 100]]);
sch.nodeLabel(100, 100, 'Vout');  // At exact wire endpoint
```

### Offset label text while keeping the dot on-node
If you need the label text shifted (left/right/up/down) but the dot must stay on the node, use `dx`/`dy` options:

```js
// Dot stays at the node, label text is offset
sch.nodeLabel(voutX, voutY, 'Vout', { dx: 16, dy: 4, anchor: 'start' });
```

This avoids the common mistake of placing `nodeLabel()` off-net just to move the text.

### When to use text()
Use `text()` for ALL offset labels, annotations, titles, and explanatory text:

```js
// CORRECT: text() for label offset from node
sch.wire([[50, 100], [100, 100]]);
sch.junction(100, 100);
sch.text(100 + 15, 100 + 5, 'A');  // Label NEAR the junction (offset)

// CORRECT: text() for circuit titles
sch.text(20, 20, 'Low-Side Switch');

// CORRECT: text() for annotations
sch.text(150, 180, 'β = 100');
sch.text(150, 195, 'VCE(sat) ≈ 0.2V');

// CORRECT: text() for signal labels at wire ends
sch.wire([[50, 100], [100, 100]]);
sch.text(105, 105, 'Vout');  // Text after wire end
```

### Common Mistake Patterns (AVOID)

```js
// WRONG: nodeLabel offset from junction
sch.junction(100, 100);
sch.nodeLabel(100 - 15, 100, 'VIN');  // Triggers floating_label error!

// WRONG: nodeLabel for annotations
sch.nodeLabel(30, 40, 'Transimpedance');  // Triggers floating_label error!

// WRONG: nodeLabel at position with no wire
sch.wire([[50, 100], [80, 100]]);
sch.nodeLabel(100, 100, 'Vout');  // Wire ends at 80, label at 100 - floating!
```

### Fix Pattern for Input/Output Labels

When labeling circuit inputs/outputs, extend the wire to the label position OR use text():

```js
// Pattern A: Extend wire, use text for label
sch.wire([[rb.start.x - 20, rb.start.y], [rb.start.x, rb.start.y]]);
sch.junction(rb.start.x, rb.start.y);
sch.text(rb.start.x - 35, rb.start.y + 5, 'VIN');

// Pattern B: Wire ends at convenient point, text label nearby
sch.wire([[component.output.x, component.output.y], [component.output.x + 40, component.output.y]]);
sch.text(component.output.x + 45, component.output.y + 5, 'Vout');
```

### Avoid floating I/O endpoints (preferred)
If an input/output wire terminates at a node, prefer `nodeLabel()` at the wire endpoint so the node is explicitly electrical:

```js
const voutX = outNodeX + 40;
sch.wire([[outNodeX, y], [voutX, y]]);
sch.nodeLabel(voutX, y, 'Vout', { dx: 8, dy: 4, anchor: 'start' });
```

This prevents "floating node" warnings and avoids red error overlays in older validator builds.

## 1) System Concepts and Non-Negotiable Invariants

### 1.1 Coordinate system
- All schematic coordinates live in SVG user space.
- **Coordinates are integers**.
- **Manhattan routing only**: all wire segments are horizontal or vertical.

### 1.2 Grid policy (single source of truth)
Use **one grid quantum** across symbols, pins, nodes, and routing:

```js
const GRID = 5;           // v2.2 default (supports pins like +65)
const EPS = 0.0001;       // mostly unnecessary with integer coordinates
```

---

## 2) Keepout Zone Reference

Keepout zones define regions where wires must NOT pass through (except at terminal endpoints). Violating these triggers "crosses [component] body" errors.

### 2.1 Keepout Dimensions by Component Type

| Component | Orientation | Keepout X Range | Keepout Y Range |
|-----------|-------------|-----------------|-----------------|
| **Opamp** | - | x-5 to x+55 | y-35 to y+35 (triangle shape) |
| **Resistor/Capacitor** | horizontal | x-3 to x+53 | y-11 to y+11 |
| **Resistor/Capacitor** | vertical | x-11 to x+11 | y-3 to y+53 |
| **Diode** | horizontal | x+12 to x+38 | y-13 to y+13 |
| **Diode** | vertical | x-13 to x+13 | y+12 to y+38 |
| **Voltage Source** | vertical | x-18 to x+18 | y+7 to y+43 |
| **NMOS/PMOS** | - | x-8 to x+28 | y-38 to y+38 |

### 2.2 Terminal Position Reference

Always use helper functions instead of estimating terminal positions:

```js
// Correct - use terminal helpers
const pd = Schematic.diodeTerminals(x, y, 'horizontal');
sch.wire([[pd.end.x, pd.end.y], [nextPoint.x, nextPoint.y]]);

// Wrong - manual estimation causes misalignment
const cathode = { x: x + 15, y: y };  // INCORRECT for diode!
```

| Component | Helper Function | Horizontal Terminals | Vertical Terminals |
|-----------|-----------------|---------------------|-------------------|
| Resistor | `resistorTerminals(x,y,orient)` | start:(x,y), end:(x+50,y) | start:(x,y), end:(x,y+50) |
| Capacitor | `capacitorTerminals(x,y,orient)` | start:(x,y), end:(x+50,y) | start:(x,y), end:(x,y+50) |
| Diode | `diodeTerminals(x,y,orient)` | start:(x,y), end:(x+50,y) | start:(x,y), end:(x,y+50) |
| Opamp | `opampTerminals(x,y)` | invInput:(x-15,y-15), nonInvInput:(x-15,y+15), output:(x+65,y) |
| NMOS | `nmosTerminals(x,y)` | gate:(x-20,y), drain:(x+20,y-30), source:(x+20,y+30) |
| Voltage Source | (vertical only) | pin1:(x,y), pin2:(x,y+50) | - |

---

## 3) Troubleshooting Keepout Violations

### 3.1 Diagnosis

Run the test tool on a specific lesson to see exact error coordinates:
```bash
node tools/test-lesson-canvases.js lessons/module-XX/lesson-YY.html
```

Error format: `Wire segment (x1,y1)-(x2,y2) crosses [component] body`

### 3.2 Common Fixes

**Problem: Wire crosses component body**
```
Error: Wire segment (95, 125)-(265, 125) crosses diode PD body
```

**Solutions (in order of preference):**

1. **Align terminals directly** - Position components so terminals connect without intermediate routing:
   ```js
   // Position diode so cathode aligns with op-amp input
   const pdX = op.invInput.x - 50;  // Cathode at pdX+50 = op.invInput.x
   sch.diode(pdX, pdY, 'horizontal', { label: 'PD' });
   ```

2. **Route around the keepout** - Use L-shaped or Z-shaped paths:
   ```js
   // Instead of: wire([[x1, y], [x2, y]]) crossing a component
   // Route below/above:
   const routeY = componentY + 60;  // Below keepout
   sch.wire([[x1, y1], [x1, routeY]]);
   sch.wire([[x1, routeY], [x2, routeY]]);
   sch.wire([[x2, routeY], [x2, y2]]);
   ```

3. **Relocate components** - Redesign layout to eliminate the crossing entirely

### 3.3 Prevention Checklist

- [ ] Use terminal helper functions for ALL component connections
- [ ] Calculate keepout bounds before routing: `keepout_max = component_pos + offset + margin`
- [ ] Test with `node tools/test-lesson-canvases.js` after any schematic changes
- [ ] Verify with `node tools/validate-schematics.js` for full suite validation

---

## 4) Fix Patterns from Real Issues

This section documents actual fixes applied to lesson schematics, providing reusable patterns.

### 4.1 Diode Terminal Alignment (TIA Circuit)

**Problem:** Wire crosses diode body because terminal positions were manually estimated.

**Before (wrong):**
```js
// Manual estimates cause misalignment
sch.diode(95, 125, 'horizontal', { label: 'PD' });
sch.wire([[95, 125], [265, 125]]);  // Crosses diode body!
```

**After (correct):**
```js
// Position diode so cathode aligns with op-amp input
const pdX = op.invInput.x - 50;  // Cathode at pdX+50 = op.invInput.x
const pdY = op.invInput.y;
sch.diode(pdX, pdY, 'horizontal', { label: 'PD' });
const pd = Schematic.diodeTerminals(pdX, pdY, 'horizontal');
// Direct terminal-to-terminal connection
sch.wire([[pd.end.x, pd.end.y], [op.invInput.x, op.invInput.y]]);
```

### 4.2 Op-Amp Feedback Routing (Instrumentation Amp)

**Problem:** Feedback wire crosses op-amp body when routed directly.

**Before (wrong):**
```js
// Direct horizontal wire crosses U2 body
sch.wire([[u2.output.x, u2.output.y], [u2.invInput.x, u2.invInput.y]]);
```

**After (correct):**
```js
// Route feedback BELOW the op-amp body
const feedbackY = u2Y + 50;  // Below opamp keepout (y+35)
sch.wire([[u2.output.x, u2.output.y], [u2.output.x, feedbackY]]);
sch.wire([[u2.output.x, feedbackY], [u2.invInput.x - 20, feedbackY]]);
sch.wire([[u2.invInput.x - 20, feedbackY], [u2.invInput.x - 20, u2.invInput.y]]);
sch.wire([[u2.invInput.x - 20, u2.invInput.y], [u2.invInput.x, u2.invInput.y]]);
```

### 4.3 Capacitor Output Routing (Sallen-Key Filter)

**Problem:** Wire crosses capacitor body when connecting to output.

**Before (wrong):**
```js
// Wire goes through C2 body
sch.wire([[c2.end.x, c2.end.y], [outputX, c2.end.y]]);
```

**After (correct):**
```js
// Route around the capacitor body (to the right)
const c2RouteX = c2.end.x + 30;  // Go right of C2 keepout
sch.wire([[c2.end.x, c2.end.y], [c2RouteX, c2.end.y]]);
sch.wire([[c2RouteX, c2.end.y], [c2RouteX, outputY]]);
sch.wire([[c2RouteX, outputY], [outputX, outputY]]);
```

### 4.4 Resistor Placement to Avoid Crossings (Schmitt Trigger)

**Problem:** Pull-up resistor placed where feedback wire crosses its body.

**Before (wrong):**
```js
// Rpull too close to feedback path
const rpullX = cmp.output.x + 30;
sch.resistor(rpullX, rpullY, 'vertical', { label: 'Rpull' });
// R2 feedback wire crosses Rpull body
```

**After (correct):**
```js
// Move Rpull further right to avoid R2 feedback wire
const rpullX = cmp.output.x + 55;  // Further right
const rpullY = cmp.output.y - 50;  // End aligns with output
sch.resistor(rpullX, rpullY, 'vertical', { label: 'Rpull' });
const rpull = Schematic.resistorTerminals(rpullX, rpullY, 'vertical');
// Wire from output to Rpull end (not crossing its body)
sch.wire([[cmp.output.x, cmp.output.y], [rpull.end.x, rpull.end.y]]);
```

### 4.5 MOSFET Terminal Registration (Amplifier)

**Problem:** Manual SVG MOSFET drawing doesn't register pins, causing "unconnected" errors.

**Before (wrong):**
```js
// Manual SVG - pins not registered
container.innerHTML = `<svg>...custom MOSFET path...</svg>`;
```

**After (correct):**
```js
// Use standard nmos() for proper pin registration
sch.nmos(mosX, mosY, { label: 'M1', showType: true });
const mos = Schematic.nmosTerminals(mosX, mosY);
// Now mos.gate, mos.drain, mos.source are correctly registered
sch.wire([[rd.end.x, rd.end.y], [mos.drain.x, mos.drain.y]]);
```

### 4.6 Voltage Source Positioning (Gate Driver)

**Problem:** Wire from driver output crosses voltage source body.

**Before (wrong):**
```js
// Voltage source at y, wire at gateY crosses body
const drvY = 90;
sch.voltageSource(drvX, drvY, 'vertical', { label: 'DRV' });
// Wire at gateY=150 crosses body (keepout y+7 to y+43)
sch.wire([[drvX, gateY], [rgX, gateY]]);
```

**After (correct):**
```js
// Position voltage source so TOP terminal aligns with gate wire level
const drvY = gateY;  // pin1 at (x, gateY), pin2 at (x, gateY+50)
sch.voltageSource(drvX, drvY, 'vertical', { label: 'DRV' });
// Wire from top terminal (at drvY) directly to gate resistor
sch.wire([[drvX, drvY], [rg.start.x, rg.start.y]]);
// Ground wire from bottom terminal
sch.wire([[drvX, drvY + 50], [drvX, gndY]]);
```

### 4.7 Bridge Circuit Routing (Wheatstone Bridge)

**Problem:** Wires cross resistor bodies in bridge topology.

**Solution:** Route wires BELOW the resistor keepout zones:
```js
// Resistors at y=100 have keepout y-11 to y+61 (vertical)
const routeY = 145;  // Well below resistor keepouts
sch.wire([[leftNodeX, resistorEndY], [leftNodeX, routeY]]);
sch.wire([[leftNodeX, routeY], [rightNodeX, routeY]]);
sch.wire([[rightNodeX, routeY], [rightNodeX, resistorEndY]]);
```

### 4.8 VCC/Ground Symbol Connection (CRITICAL)

**Problem:** VCC symbol placed but wire starts with a gap, leaving VCC node unconnected.

The `vcc()` method registers a node at (x, y) as both 'pin' and 'label'. If the wire doesn't start exactly at (x, y), the VCC is "floating".

**Before (wrong):**
```js
const vccY = 25;
sch.vcc(200, vccY);
// Wire starts 10px below VCC - creates 10px gap!
sch.wire([[200, vccY + 10], [200, vccY + 20]]);
```

**After (correct):**
```js
const vccY = 25;
sch.vcc(200, vccY);
// Wire starts exactly at VCC position
sch.wire([[200, vccY], [200, vccY + 20]]);
```

**Same pattern applies to `ground()` symbols** - ensure wire reaches the ground symbol position.

If placing ground on a rail, split the rail so the ground coordinate is a vertex:
```js
const gndX = Math.round((leftX + rightX) / 2);
sch.wire([[leftX, gndY], [gndX, gndY]]);
sch.wire([[gndX, gndY], [rightX, gndY]]);
sch.ground(gndX, gndY);
```

**Search pattern to find these issues:**
```
vccY + 10
vccY+10
```
If you see `vccY + 10` as a wire start point but VCC is at `vccY`, that's a bug.

---

### 4.9 VEE/VSS Rail Symbol (CRITICAL)

**Requirement:** Negative supply rails must use a **flat-bar VEE/VSS symbol** (same visual style as VCC, but downward). Do **not** use `nodeLabel()` or floating text for rails.

Use the `vee()` helper so the rail is a real electrical node:

```js
const veeY = 300;
sch.vee(200, veeY, { label: '-VEE' });
sch.wire([[200, veeY], [200, emitterY]]);
```

**Key rule:** the wire must start/terminate **exactly at** the VEE node `(x, y)` to avoid floating-rail errors.

For manual SVGs (non-`Schematic` drawings), include a **short horizontal bar** at the end of the negative rail, just like the VCC bar (but below the node).

---

### 4.10 Manual SVG/CANVAS Normalization (GLOBAL)

Manual SVG circuit diagrams are post-processed at runtime by `assets/schematic-normalize.js` to enforce supply-rail symbols. To ensure the normalizer can work:

- **Supply labels must be text nodes** containing `VCC`, `VDD`, `V+`, `VEE`, `VSS`, or `V-` (optional extra text after, e.g. `VCC (12V)`).
- **Supply rails must include a vertical line** near the label (same X coordinate). The normalizer adds a **flat bar** at the line endpoint.
- **Keep coordinates integer** and avoid diagonal power-rail leads (only vertical).

If a manual diagram is purely conceptual (block diagram), it can omit this, but any **electrical schematic** must expose a recognizable rail lead + label so the normalizer can apply.

---

## 5) Interactive Canvas Best Practices

### 5.1 Using AD.drawAxes() Correctly

The `AD.drawAxes()` function returns an object with a `toCanvas()` helper for coordinate mapping:

```js
const axes = AD.drawAxes(ctx, canvas.width, canvas.height, {
    xMin: 0, xMax: vdd,
    yMin: 0, yMax: vdd,
    xLabel: 'Vin', xUnit: 'V',
    yLabel: 'Vout', yUnit: 'V'
});

// CORRECT: Use toCanvas() to map data coordinates to canvas pixels
const point = axes.toCanvas(dataX, dataY);
ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);

// WRONG: axes.map() does not exist
// const point = axes.map(dataX, dataY);  // TypeError!
```

### 5.2 Updating Display Elements

Always update display elements at the end of the draw function:
```js
function draw() {
    // ... calculations and canvas drawing ...

    // Update all display elements
    document.getElementById('m5l10-vout').textContent = vout.toFixed(3) + ' V';
    document.getElementById('m5l10-state').textContent = state;
    document.getElementById('m5l10-vm').textContent = vm.toFixed(3) + ' V';
}

// Attach event listeners and call initial draw
[slider1, slider2, slider3].forEach(el => el.addEventListener('input', draw));
draw();  // Initial render
```

---
## Appendix A: Schematic Design Guidelines v3.0 (Precision Edition)

# Schematic Design Guidelines v3.0 (Precision Edition)
**Purpose:** A strict, machine-checkable rule set for generating and validating schematics (LLM-friendly).  
**Primary goal:** unambiguous connectivity + high readability.  
**Default style:** **Orthogonal-Strict** (no diagonal net wiring).

---

## 0. Scope and rule modes

### 0.1 What this document governs
These rules apply to **electrical connectivity graphics**:
- wires belonging to nets
- junction dots
- net labels / ports
- component symbols (bodies + pins)
- reference designators and value text
- sheet borders and title blocks

### 0.2 What is excluded by default (non-electrical annotation)
The following objects are **ignored** by geometry rules unless explicitly included:
- oscilloscope probes, measurement cursors, arrows/leaders used only for annotation
- background grids
- artwork logos

**Project option:** `include_annotations_in_geometry_checks = false` (default).

### 0.3 Rule modes (choose one)
Set these in a "Schematic Rules Header" note on every sheet.

- `routing_mode = ORTHO_STRICT` (default)
  - net wire segments must be axis-aligned only.
- `power_pins_mode = EXPLICIT` (default)
  - all IC power pins must be drawn and connected on-sheet.
- `junction_dot_mode = REQUIRED` (default)
  - junction dots required for every multi-segment connection.

---

## 1. Canonical data model (required for LLM checking)

The schematic must be representable as the following objects.

### 1.1 Grid and units
- **Grid Unit (GU):** base unit in schematic coordinates.
- Default: `1 GU = 100 mil` (2.54 mm) but any value is allowed if consistent.

### 1.2 Components
Each component must define:
- `refdes` (e.g., R12, C3, U1)
- `value` (e.g., 10k, 100n)
- `body_bbox = [xmin, ymin, xmax, ymax]` (axis-aligned)
- `pins[]` where each pin has:
  - `pin_id` (number or name)
  - `xy = [x, y]` (grid coordinate)
  - `edge_dir ? {N, S, E, W}` (which side of the body the pin exits)
  - `net` (net name or null)

### 1.3 Wires (net segments)
Each wire segment is:
- `net_segment = {net, x1, y1, x2, y2}`
- `routing_mode=ORTHO_STRICT` requires: `x1==x2 OR y1==y2`

### 1.4 Junction dots
- `junction = {net, x, y}`
- A junction dot indicates **electrical connection** among all segments meeting at that coordinate.

### 1.5 Net labels and ports
- `net_label = {net, x, y, scope}`
- `scope ? {LOCAL, GLOBAL, HIER_PORT}`
- HIER_PORTs must match between parent/child sheets.

### 1.6 Text objects
- `text = {kind ? {REFDES, VALUE, NOTE, NETNAME}, bbox}`

---

## 2. Grid contract (hard constraints)

### 2.1 Snap rules
- **Pins:** MUST land on integer coordinates: `x,y ? Z`.
- **Wire endpoints:** MUST land on integer coordinates.
- **Junction dots:** MUST land on integer coordinates.
- **Text placement:** MAY be on 0.5 GU grid, but must not collide (see 6).

### 2.2 Allowed angles (ORTHO_STRICT)
For every net segment:
- Allowed: 0ø or 90ø only.
- Forbidden: any diagonal (including 45ø).

**FAIL if:** `(x1!=x2) AND (y1!=y2)` for any net segment.

---

## 3. Placement rules (readability + routing)

### 3.1 Global flow
- Primary signal flow: **Left  Right**.
- Power entry/regulators: **Top/Left** region.
- Grounds: **Bottom** region.

### 3.2 Functional blocks
- Components must be clustered into blocks: power, analog front-end, digital core, outputs, etc.
- **Minimum block separation:** `ò 4 GU` between block bounding boxes.

### 3.3 Component spacing
- **Body-to-body clearance:** `ò 2 GU` between any two component body bounding boxes.
- **Wire-to-body clearance (keepout):** see 5.

### 3.4 Orientation conventions (defaults)
- Resistors: horizontal preferred.
- Capacitors: vertical preferred.
- Op-amps/comparators: triangle pointing right; inputs left; output right.
- Connectors: pin 1 visually indicated; numbering readable left-to-right or top-to-bottom.

---

## 4. Connectivity semantics (unambiguous rules)

### 4.1 Junction dot requirement
A coordinate where 3 or more net segments meet is a **connection** only if a junction dot exists there.

- **FAIL if:** node degree ò 3 and no junction dot at that coordinate.
- **OK:** degree=2 (a corner or straight pass) without a dot.

### 4.2 Crossing rules
If two net segments intersect geometrically at a point that is not a shared endpoint:

- If a junction dot exists at the intersection:
  - Then it is an electrical connection, but only allowed as a **T-junction** (degree=3).
- If no junction dot:
  - Then it is a non-connection crossing and must be a **90ø cross**.

**FAIL if any of the following:**
- 4-way "+" junction (degree=4) at any single coordinate (dot or no dot).
- A crossing that is not 90ø (ORTHO_STRICT already prevents this).
- A dot at a 2-wire crossing (ambiguous intent). Dots are only for degree ò 3.

### 4.3 Node degree rules
Let `deg(node)` be the number of connected segments/pins at a coordinate.
- Allowed: `deg ? {1,2,3}`
- Forbidden: `deg ò 4`

**Auto-fix:** convert a + node into two T nodes separated by ò 1 GU.

---

## 5. Routing rules (hard geometry + keepouts)

### 5.1 Component keepout definition
Define a keepout bbox for each component:
- `keepout_bbox = body_bbox expanded by M`
- Default `M = 0.5 GU` (project option).

### 5.2 Through-body routing forbidden
A net segment may intersect a component's keepout bbox only if:
- the segment endpoint equals an actual pin coordinate on that component, AND
- the intersection occurs only at the endpoint (no interior overlap).

**FAIL if:** any net segment overlaps the interior of a keepout bbox.

### 5.3 Terminal escape rule (precise)
For any connection to a pin at coordinate `P`:
- The first net segment from `P` must be colinear with the pin's `edge_dir` and extend at least `escape_len`.

Defaults:
- `escape_len = 1.0 GU`
- For pin edge direction:
  - `E`: first segment must go +X
  - `W`: first segment must go -X
  - `N`: first segment must go +Y
  - `S`: first segment must go -Y

**FAIL if:**
- the first segment from a pin is not aligned with `edge_dir`, OR
- the first segment length < `escape_len`, OR
- the first segment enters the component keepout.

**Exceptions (explicitly allowed):**
- pin is already outside keepout by ò escape_len (rare symbol styles)
- connector pins at sheet edge may skip escape if they connect directly to a port at the same coordinate

### 5.4 Wire spacing
- **Parallel wire spacing:** `ò 1 GU` between parallel segments on different nets.
- **Recommended:** `ò 2 GU` in dense areas to reduce visual ambiguity.

### 5.5 Bend minimization
- **Max bends per net run (between labeled nodes):** `ó 4` preferred; warn if > 6.
- This is a readability warning (not a hard fail) unless it causes collisions.

---

## 6. Text and label collision rules (hard)

### 6.1 No-text-on-wire
Text bounding boxes must not intersect:
- any net segment
- any junction dot bbox (treat dot as bbox of radius 0.25 GU)
- any component keepout bbox

**FAIL if:** any text bbox intersects any of the above.

### 6.2 Text clearance
- Minimum clearance from any wire segment: `ò 0.5 GU` (bbox-to-segment distance).
- Minimum clearance from any pin/junction coordinate: `ò 0.5 GU`.

### 6.3 Net label placement
Net labels must be placed:
- on a wire segment (touching) OR
- at a port symbol coordinate  
and must not overlap any other object.

---

## 7. Nets, naming, and hierarchy (machine rules)

### 7.1 Net naming requirements
- Any net that leaves a functional block must be labeled (LOCAL label at minimum).
- Any net that crosses sheets must use `HIER_PORT` or `GLOBAL` scope.

**FAIL if:**
- a cross-sheet connection is implied by long wires instead of ports/labels, OR
- a label's scope is inconsistent with its use (e.g., LOCAL used as if global).

### 7.2 "Long wire" suppression rule
To prevent giant perimeter rectangles:
- If a net segment chain spans more than `L = 25 GU` end-to-end on a sheet AND connects across blocks, prefer labels/ports.
- This is a **warning** by default; set `long_wire_is_error=true` to make it a fail.

### 7.3 Reference designators
- Must be unique per sheet set.
- Must match type prefix: R,C,L,D,Q,U,J,TP,FB, etc.

**FAIL if:** duplicates exist.

---

## 8. Power integrity rules (review safety)

### 8.1 Power pins mode
Default: `power_pins_mode = EXPLICIT`
- Every IC symbol must show power pins and they must be connected to named power nets.

If project chooses `IMPLICIT`:
- A sheet must contain a "Power Net Declaration" block listing each implicit net and every IC that uses it (cross-referenced).
- LLM must still verify power connectivity logically.

### 8.2 Decoupling requirement (hard)
For every IC power pin pair (`VDD` to `GND` or `V+` to `V-/GND`):
- At least one decoupling capacitor must exist:
  - `Cdec` connected between that power net and its return net
  - value recommended `0.1uF` (value is not strictly enforced)

**FAIL if:** any IC has no decoupling shown (or no declared decoupling sheet reference if using a dedicated sheet approach).

### 8.3 Grounds
- If multiple grounds exist (AGND/DGND), the tie must be explicit (net-tie or 0ê) and uniquely labeled.

---

## 9. Analog/op-amp/oscillator readability rules (loop clarity)

### 9.1 Op-amp orientation
- Output must face right.
- Inputs must be on left.
**FAIL if:** output is left of inputs.

### 9.2 Feedback loop separation (recommended, can be enforced)
If both positive and negative feedback exist:
- Route negative feedback above the op-amp symbol region.
- Route positive feedback below the op-amp symbol region.

This is a **warning** unless `enforce_feedback_separation=true`.

### 9.3 Oscillator loop traceability (hard)
An oscillator must have:
- a closed loop from an output node back to a controlling input/threshold network.
- timing components grouped (within a 6 GU bbox recommended).

**FAIL if:** the loop cannot be traced via connected nets (graph cycle missing).

---

## 10. Automated checks (exact pass/fail logic)

### 10.1 Build connectivity graph
- Nodes are coordinates at:
  - pin points
  - wire endpoints
  - junction dot coordinates
  - label/port coordinates
- Edges are wire segments (axis-aligned).

### 10.2 Critical failures (must fail the schematic)
1. Any diagonal net segment (ORTHO_STRICT).
2. Any net segment overlapping any component keepout interior.
3. Any text bbox intersecting a net segment or keepout.
4. Any node with degree ò 4.
5. Any degree ò 3 node without a junction dot (junction_dot_mode=REQUIRED).
6. Any IC missing explicit power connectivity (power_pins_mode=EXPLICIT).
7. Any IC missing decoupling capacitor (or decoupling reference).

### 10.3 Major warnings (should usually be fixed)
- Excessive bends per net run (>6).
- Dense node clustering: two junction dots on same net within < 1 GU.
- Long cross-block nets without labels/ports (end-to-end > 25 GU).

### 10.4 Optional ERC checks (project-dependent)
- Floating digital inputs (inputs without defined pull/drive).
- Outputs shorted together.
- Single-node nets (only one pin connected).

---

## 11. Auto-fix transformations (deterministic)

1. **Diagonal segment**  replace with 2 orthogonal segments using a Manhattan corner at nearest free coordinate that does not violate keepouts.
2. **4-way junction**  split into two T-junctions separated by 1 GU and insert a short segment between them.
3. **Wire-body collision**  detour around keepout bbox with margin M.
4. **Text collision**  move text to nearest quadrant with ò0.5 GU clearance, preserving association.
5. **Long wire**  replace mid-span with matching net labels near endpoints.

---

## 12. Output requirements for an LLM generator
Any generated schematic must also output:
- The rule header (routing_mode, power_pins_mode, junction_dot_mode, keepout margin)
- A netlist (net name  list of pins/labels)
- A DRC report (violations with coordinates and suggested fixes)

---

## Appendix: Allowed exceptions (must be explicitly declared)
If you want to allow any of these, declare them in the rules header:

- `allow_bus_notation=true` (bus lines may be thicker; still orthogonal)
- `allow_hidden_power_pins=true` (requires Power Net Declaration block)
- `include_annotations_in_geometry_checks=true` (probe lines must follow orthogonal rules)

---

**Prepared by:** Senior Electrical Engineer (Schematic Style Rule Set)  
**Revision:** 3.0 Precision Edition  
