# Canvas Visualization Troubleshooting Guide

This document outlines the process for diagnosing and fixing canvas visualization issues in the EE Learning Platform.

## Table of Contents
1. [Quick Diagnostic Steps](#quick-diagnostic-steps)
2. [Common Issues and Solutions](#common-issues-and-solutions)
3. [Automated Testing](#automated-testing)
4. [Schematic Validation](#schematic-validation)
5. [Manual Browser Testing](#manual-browser-testing)
6. [Case Study: Module 2 Lesson 4](#case-study-module-2-lesson-4)

---

## Quick Diagnostic Steps

### Step 1: Open Browser Developer Console
1. Launch the app: `Launch_EE_Learning.bat`
2. Navigate to the lesson with issues
3. Open DevTools (F12)
4. Check the Console tab for errors

### Step 2: Look for Common Error Patterns
```
TypeError: X is not a function       → Missing method in API
TypeError: Cannot read properties    → Element not found (wrong ID)
ReferenceError: X is not defined     → Missing function or variable
SCHEMATIC ERROR: X issue(s) found    → Schematic validation failure
```

### Step 3: Run Automated Tests
```bash
# Test a specific lesson
node tools/test-lesson-canvases.js lessons/module-02/lesson-04.html

# Test ALL lessons
node tools/test-all-canvases.js

# Validate schematics
node tools/validate-schematics.js
```

---

## Common Issues and Solutions

### Issue 1: "X is not a function"

**Symptoms:**
- Canvas is blank
- Error in console like `sch.rect is not a function`

**Root Cause:**
The code calls a method that doesn't exist on the object.

**Diagnostic Steps:**
1. Identify the object type (e.g., `Schematic` vs `SchematicSVGBuilder`)
2. Check `assets/schematic-svg.js` for available methods
3. Look for the method in the class definition

**Example Fix (sch.rect not a function):**
```javascript
// The Schematic class (from AD.Schematic.create()) didn't have rect()
// Solution: Add rect() method to the Schematic class

rect(x, y, width, height, options = {}) {
    const {
        fill = 'none',
        stroke = COLORS.component,
        strokeWidth = LINE_WIDTH,
        strokeDasharray = null
    } = options;

    const rectEl = elem('rect', {
        x, y, width, height,
        fill, stroke, strokeWidth
    });

    if (strokeDasharray) {
        rectEl.setAttribute('stroke-dasharray', strokeDasharray);
    }

    this.boundsAccumulator.addRect(x, y, width, height);
    this.componentGroup.appendChild(rectEl);
    return this;
}
```

### Issue 2: "SCHEMATIC ERROR: X issue(s) found"

**Symptoms:**
- Red error message on schematic
- Schematic may render partially

**Root Cause:**
Schematic validation detected wiring or component issues.

**Diagnostic Steps:**
1. Enable debug logging in `schematic-svg.js`:
```javascript
// In finalize() method, add:
console.log('Validation report:', report);
```

2. Check for these error types:
   - `floating_label` - nodeLabel not connected to wire
   - `floating_node` - Wire endpoint not connected
   - `unconnected_pin` - Component pin not wired

**Common Patterns to Fix:**

**A. Floating nodeLabel:**
```javascript
// WRONG - 10px gap between label and wire
sch.nodeLabel(x - 20, y, 'Vin');
sch.wire([[x - 10, y], [x, y]]);

// CORRECT - Wire starts at label position
const vinX = x - 15;
sch.nodeLabel(vinX, y, 'Vin');
sch.wire([[vinX, y], [x, y]]);
```

**B. Ground not connected:**
```javascript
// WRONG - 8px gap
sch.wire([[x, y], [x, y + 25]]);
sch.ground(x, y + 33);

// CORRECT - Wire reaches ground
const gndY = y + 30;
sch.wire([[x, y], [x, gndY]]);
sch.ground(x, gndY);
```

**C. Output not connected:**
```javascript
// WRONG - Wire ends before label
sch.wire([[op.output.x, y], [op.output.x + 35, y]]);
sch.nodeLabel(op.output.x + 45, y, 'Vout');

// CORRECT - Wire reaches label
const voutX = op.output.x + 40;
sch.wire([[op.output.x, y], [voutX, y]]);
sch.nodeLabel(voutX, y, 'Vout');
```

### Issue 3: "SchematicSVG is not a constructor"

**Symptoms:**
- Error when lesson tries to create schematic
- Lesson uses `new SchematicSVG()` syntax

**Root Cause:**
Some lessons use the builder API (`new SchematicSVG()`) while others use the factory API (`AD.Schematic.create()`).

**Solution:**
Ensure `window.SchematicSVG` is set in `schematic-svg.js`:
```javascript
// At end of schematic-svg.js
window.SchematicSVG = SchematicSVGBuilder;
```

### Issue 4: Canvas is Blank (No Errors)

**Possible Causes:**
1. Update function not called initially
2. Wrong element ID
3. Input slider values not read correctly

**Diagnostic Steps:**
1. Check that update function is called:
```javascript
// At end of IIFE
updateMyCanvas();  // <-- This must be called
```

2. Verify element IDs match between HTML and JS:
```html
<canvas id="my-canvas" width="400" height="200"></canvas>
<input type="range" id="my-slider" ...>
```
```javascript
const canvas = document.getElementById('my-canvas');  // Must match
const slider = document.getElementById('my-slider');  // Must match
```

3. Check for silent failures:
```javascript
const canvas = document.getElementById('my-canvas');
if (!canvas) {
    console.error('Canvas not found: my-canvas');
    return;
}
```

---

## Automated Testing

### Test Single Lesson
```bash
node tools/test-lesson-canvases.js lessons/module-02/lesson-04.html
```

Output interpretation:
```
Canvas States:
  int-canvas: OK (1295 operations)      ← PASS: Drawing occurred
  diff-canvas: EMPTY (0 operations)     ← FAIL: No drawing
```

### Test All Lessons
```bash
node tools/test-all-canvases.js
```

This will test all 181 lessons with canvases and report:
- **PASS**: All canvases have drawing operations
- **FAIL**: Some canvases are empty
- **ERROR**: Script execution failed

### Schematic Validation
```bash
node tools/validate-schematics.js
```

This tests all schematic factory functions for wiring errors.

---

## Schematic Validation

### How Validation Works

The `finalize()` method in `schematic-svg.js` performs these checks:

1. **floating_label**: Labels not connected to wires
2. **floating_node**: Wire endpoints with degree=1 (dead ends)
3. **unconnected_pin**: Component pins not wired
4. **node_short**: Different nets shorted together
5. **keepout_violation**: Wires crossing keepout zones

### Terminal-First Methodology

Always get terminal positions BEFORE drawing wires:

```javascript
// 1. Get component terminals
const op = Schematic.opampTerminals(opX, opY);
const r1 = Schematic.resistorTerminals(r1X, r1Y, 'horizontal');

// 2. Draw components
sch.opamp(opX, opY, { label: 'U1' });
sch.resistor(r1X, r1Y, 'horizontal', { label: 'R1' });

// 3. Wire using terminal positions
sch.wire([[r1.end.x, r1.end.y], [op.invInput.x, op.invInput.y]]);
```

### Terminal Position Reference

**Op-amp (opampTerminals):**
```
invInput:    { x: x - 15, y: y - 15 }
nonInvInput: { x: x - 15, y: y + 15 }
output:      { x: x + 65, y: y }
```

**Resistor (horizontal, resistorTerminals):**
```
start: { x: x, y: y }
end:   { x: x + 50, y: y }
```

**Resistor (vertical):**
```
start: { x: x, y: y }
end:   { x: x, y: y + 50 }
```

---

## Manual Browser Testing

### Test Checklist

1. **Launch app:**
   ```
   Launch_EE_Learning.bat
   ```

2. **Open DevTools (F12)**

3. **Navigate to lesson**

4. **Check for:**
   - [ ] No console errors
   - [ ] Canvas displays content
   - [ ] Sliders update canvas
   - [ ] Schematic shows no red error message
   - [ ] Interactive elements work

5. **Common issues to look for:**
   - Blank canvas areas
   - "SCHEMATIC ERROR" messages
   - Red borders on schematics
   - Console TypeErrors

---

## Case Study: Module 2 Lesson 4

### Problem
"Bode plot comparison and Triangle Wave Generator don't display anything"

### Diagnostic Process

1. **Run automated test:**
```bash
node tools/test-lesson-canvases.js lessons/module-02/lesson-04.html
```

**Result:**
```
Script execution error: sch.rect is not a function
Canvas States:
  int-canvas: EMPTY (0 operations)
  bode-canvas: EMPTY (0 operations)
  wavegen-canvas: EMPTY (0 operations)
```

2. **Identify root cause:**
The wave generator schematic calls `sch.rect()`:
```javascript
sch.rect(50, 70, 100, 50, { fill: 'none', stroke: '...' });
```

But `Schematic` class (from `AD.Schematic.create()`) didn't have a `rect()` method.

3. **Fix:**
Added `rect()` method to `Schematic` class in `schematic-svg.js` (lines 567-603).

4. **Verify fix:**
```bash
node tools/test-lesson-canvases.js lessons/module-02/lesson-04.html
```

**Result:**
```
Canvas States:
  int-canvas: OK (1295 operations)
  diff-canvas: OK (1295 operations)
  bode-canvas: OK (1112 operations)
  wavegen-canvas: OK (1287 operations)
```

### Additional Fixes in Same Lesson

Also fixed schematic validation errors:

1. **Vin nodeLabel gap** - Wire started 10px after label
2. **Vout nodeLabel gap** - Wire ended 10px before label
3. **Ground gap** - Wire didn't reach ground symbol
4. **Empty nodeLabel** - Removed unused empty label

---

## File Reference

| File | Purpose |
|------|---------|
| `assets/ad-framework.js` | Core AD functions (drawAxes, plotData, etc.) |
| `assets/schematic-svg.js` | Schematic drawing API and validation |
| `assets/widgets.js` | SpiceNetlistWidget, ChecklistWidget, etc. |
| `tools/validate-schematics.js` | Headless schematic factory validation |
| `tools/test-lesson-canvases.js` | Test single lesson canvases |
| `tools/test-all-canvases.js` | Test all lesson canvases |

---

## Summary Checklist

When a canvas doesn't display:

- [ ] Check browser console for errors
- [ ] Run `node tools/test-lesson-canvases.js <path>`
- [ ] If "X is not a function": Add missing method to appropriate class
- [ ] If "SCHEMATIC ERROR": Fix wiring using terminal-first methodology
- [ ] If blank with no errors: Check update function is called and element IDs match
- [ ] Run `node tools/validate-schematics.js` to check all factories
- [ ] Test in browser with DevTools open
