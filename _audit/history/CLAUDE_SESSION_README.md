# EE Learning Platform - Development Session Context

## Last Updated: December 21, 2025

---

## Project Overview

An interactive Electrical Engineering learning platform with 24 modules covering analog electronics, power systems, RF design, and real-world projects. Each lesson features:
- Interactive Canvas-based visualizations (Tektronix oscilloscope color scheme)
- SchematicSVG circuit diagrams
- SPICE netlists
- Verification checklists
- Practice exercises

---

## Current Status: COMPLETE (All 66 lessons added)

### Module Completion Status

| Module | Lessons | Topic | Status |
|--------|---------|-------|--------|
| 01-12 | 10-20 each | Foundation topics | Complete (pre-existing) |
| 13 | 10 | Communication Protocols | Complete |
| 14 | 10 | Advanced Analog Blocks | Complete |
| 15 | 10 | Practice Problems | Complete |
| 16 | 10 | Real-World Scenarios | Complete |
| 17 | 10 | Troubleshooting & Debug | Complete |
| 18 | 10 | Power Supply Design | Complete |
| 19 | 10 | Battery Management | Complete |
| 20 | 10 | Sensor Interface | Complete |
| 21 | 10 | RF Analog | Complete |
| 22 | 10 | EMI/EMC Design | Complete |
| 23 | 25 | (Pre-existing) | Complete |
| 24 | 10 | Complex Real-World Projects | Complete |

---

## Latest Session Work (Dec 21, 2025) - Terminal Access & Graph Background Fixes

### Fix 1: Schematic Terminal Position Methods Not Accessible

**Problem**: Lesson files used `Schematic.npnTerminals()` but this method was not in the public API. The terminal methods were static methods on the inner `Schematic` class, requiring `AD.Schematic.Schematic.npnTerminals()`.

**Root Cause**: In schematic-svg.js, the public API returned the inner `Schematic` class but not its static methods directly:
```javascript
return {
    create,
    Schematic,  // Inner class, not the static methods!
    ...
};
```

**Solution**: Added terminal position methods to the public API in `assets/schematic-svg.js`:
```javascript
npnTerminals: Schematic.npnTerminals,
pnpTerminals: Schematic.pnpTerminals,
opampTerminals: Schematic.opampTerminals,
nmosTerminals: Schematic.nmosTerminals,
pmosTerminals: Schematic.pmosTerminals
```

**Files Fixed**: 9 lesson files that use terminal position methods now work correctly.

### Fix 2: AD.drawGrid Now Includes Background Fill

**Problem**: 40+ lesson files with graphs showed transparent/white backgrounds because `AD.drawGrid()` only cleared the canvas but didn't fill with the dark background color.

**Root Cause**: The `drawGrid` function only did `ctx.clearRect()`, not `ctx.fillRect()`.

**Solution**: Modified `AD.drawGrid()` in `assets/ad-framework.js` to automatically fill background:
```javascript
function drawGrid(ctx, w, h, divX = 10, divY = 8, bgColor = '#0d1117') {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);  // Now fills background automatically!
    ...
}
```

**Files Fixed**: All 40+ lesson files with graphs now display with proper dark backgrounds.

---

## Previous Session Work (Dec 21, 2025) - Major Schematic System Fix

### CRITICAL: Created SchematicSVGBuilder Class

**Problem**: 50 lesson files used `new SchematicSVG(width, height)` but this constructor didn't exist!

The files expected a simple SVG string builder API:
```javascript
const svg = new SchematicSVG(500, 280);
svg.wire([[x1, y1], [x2, y2]]);
svg.opAmp(x, y, {mirror: false});
container.innerHTML = svg.render();
```

But `window.SchematicSVG` was an object (the module export), not a class constructor.

**Solution**: Created `SchematicSVGBuilder` class in `assets/schematic-svg.js` that provides:
- Constructor: `new SchematicSVG(width, height)`
- Node registry: `svg.nr.define(name, x, y)`
- Component methods: `wire()`, `opAmp()`, `resistor()`, `capacitor()`, `diode()`, `inductor()`, `ground()`, `vcc()`, `nmos()`, `pmos()`, `npn()`, `pnp()`
- Drawing methods: `text()`, `line()`, `rect()`, `circle()`, `dot()`
- Render method: `svg.render()` returns SVG HTML string

**Files Fixed** (50 total across modules 14-24):
- All lessons in modules 14, 16, 17, 18, 19, 20, 21, 22, 24 that use `new SchematicSVG()`

---

## Previous Bug Fixes (Dec 21, 2025)

### Critical Bug Fixes Completed

#### 1. Canvas Graph Display Bug (fillRect/drawGrid ordering)
**Problem**: Graphs showed blank canvas because `AD.drawGrid()` calls `ctx.clearRect()` which erases any background fill drawn before it.

**Root Cause**: Code pattern of:
```javascript
ctx.fillStyle = '#0d1117';
ctx.fillRect(0, 0, w, h);  // This gets erased!
AD.drawGrid(ctx, w, h, ...);  // clearRect() wipes the background
```

**Fix**: Use `destination-over` compositing to draw background BEHIND the grid:
```javascript
AD.drawGrid(ctx, w, h, ...);
ctx.save();
ctx.globalCompositeOperation = 'destination-over';
ctx.fillStyle = '#0d1117';
ctx.fillRect(0, 0, w, h);
ctx.restore();
```

**Files Fixed**:
- `lessons/module-02/lesson-03.html` - Temperature Sweep graph
- `lessons/module-01/lesson-05.html` - Beta Sensitivity graph
- `lessons/module-04/lesson-01.html` - 7 occurrences (coupling, compensation, rise time, etc.)
- `lessons/module-04/lesson-02.html` - 3 occurrences (component derating graphs)
- `lessons/module-05/lesson-01.html` - MOSFET I-V curves
- `lessons/module-05/lesson-02.html` - Gate charge curves

#### 2. SchematicSVG Flip Alignment Bug
**Problem**: When BJT transistors use `flip: true`, collector terminal position changes direction but connected components weren't updated.

**Root Cause**: `SchematicSVG.npnTerminals(x, y, flip)` returns:
- `flip=false`: collector.x = x + 20
- `flip=true`: collector.x = x - 20 (40px difference!)

**Fix**: Always get terminal positions FIRST using `Schematic.npnTerminals()`, then use those positions for wires and component placement.

**Files Fixed**:
- `lessons/module-01/lesson-03.html` - Long-Tail Pair schematic
- `lessons/module-01/lesson-04.html` - Current Mirrors schematics (also increased container size from 180x200 to 200x220)

---

### Previous Session Work (Dec 21, 2025) - Content Addition

### Lessons Added in Module 24 (Complex Real-World Projects):
- **Lesson 6**: High-Precision DAQ System
- **Lesson 7**: Battery-Powered IoT Sensor
- **Lesson 8**: Motor Control System (BLDC with FOC)
- **Lesson 9**: Audio Amplifier Design (Class AB)
- **Lesson 10**: Power Supply with PFC (Boost PFC + LLC converter)

### ASCII Art Fixes Completed:
Converted all ASCII block diagrams to Canvas visualizations:
- `lessons/module-24/lesson-06.html` - DAQ system architecture
- `lessons/module-24/lesson-07.html` - IoT sensor architecture
- `lessons/module-24/lesson-08.html` - Motor control system architecture
- `lessons/module-24/lesson-09.html` - Audio amplifier architecture

### Files Updated:
- `assets/curriculum.js` - Added all new lessons for modules 13-22 and 24
- Created `Launch_EE_Learning.bat` - Quick launcher for the site

---

## Key Files & Structure

```
C:\Users\juanf\Desktop\Claude\EE_learning\
├── index.html                    # Main entry point
├── Launch_EE_Learning.bat        # Double-click to launch site
├── CLAUDE_SESSION_README.md      # This file
├── SCHEMATIC_METHODOLOGY.md      # SVG schematic guidelines
│
├── assets/
│   ├── main.css                  # Global styles
│   ├── lesson-layout.css         # Lesson-specific styles
│   ├── ad-framework.js           # Core framework
│   ├── curriculum.js             # Module/lesson definitions
│   ├── widgets.js                # Checklist, Exercise, SPICE widgets
│   └── schematic-svg.js          # SchematicSVG library
│
├── lessons/
│   ├── module-01/ through module-24/
│   │   └── lesson-XX.html        # Individual lessons
│
└── C:\Users\juanf\.claude\plans\
    └── elegant-hopping-perlis.md # Original expansion plan
```

---

## Design Guidelines

### Canvas Visualizations
- Background: `#181818` or `#0d1117`
- Colors (Tektronix scheme):
  - Yellow: `#FFFF00`
  - Cyan: `#00FFFF`
  - Magenta: `#FF66FF`
  - Green: `#00FF00`
  - Orange: `#FF6600`
- Font: `monospace`
- Standard canvas size: `980 x 320-400px`

**CRITICAL**: When using `AD.drawGrid()`, DO NOT fill background first!
```javascript
// WRONG - background gets erased by drawGrid's clearRect()
ctx.fillStyle = '#0d1117';
ctx.fillRect(0, 0, w, h);
AD.drawGrid(ctx, w, h, ...);

// CORRECT - use destination-over to draw behind grid
AD.drawGrid(ctx, w, h, ...);
ctx.save();
ctx.globalCompositeOperation = 'destination-over';
ctx.fillStyle = '#0d1117';
ctx.fillRect(0, 0, w, h);
ctx.restore();
```

### SchematicSVG Components
Follow `SCHEMATIC_METHODOLOGY.md`:
- Use NodeRegistry for coordinates
- Use SegmentRegistry for wires
- Use BoundsAccumulator for viewBox
- Component symbols: resistor, capacitor, inductor, BJT, MOSFET, op-amp

**CRITICAL**: When using flipped transistors (`flip: true`), get terminal positions FIRST:
```javascript
// WRONG - assumes fixed offsets that change with flip
sch.npn(x, y, 'Q1', { flip: true });
sch.resistor(x + 20, y - 30, ...);  // Wrong! flip changes collector.x

// CORRECT - use terminal positions
const t = Schematic.npnTerminals(x, y, true);  // flip = true
sch.npn(x, y, 'Q1', { flip: true });
sch.resistor(t.collector.x, t.collector.y - 30, ...);  // Correct!
```

### Lesson Structure
```html
<div class="lesson-content" data-module="X" data-lesson="Y">
  <div class="card"><!-- Intro --></div>
  <div class="card"><!-- Interactive Canvas --></div>
  <div class="card"><!-- Schematic --></div>
  <div class="card"><!-- SPICE Netlist --></div>
  <div class="card"><!-- Checklist --></div>
  <div class="card"><!-- Exercises --></div>
</div>
<script>
  // Canvas drawing functions
  // SchematicSVG creation
  // Widget initialization
</script>
```

---

## Widgets Available

### SpiceNetlistWidget
```javascript
new SpiceNetlistWidget('container-id', {
    title: 'Circuit Name',
    description: 'Description',
    netlist: `* SPICE netlist here`
});
```

### ChecklistWidget
```javascript
new ChecklistWidget('container-id', {
    title: 'Checklist Title',
    items: [
        { text: 'Item text', critical: true/false },
        // ...
    ]
});
```

### ExerciseWidget
```javascript
new ExerciseWidget('container-id', {
    exercises: [
        {
            question: 'Question text',
            hint: 'Hint text',
            answer: 'Answer text'
        },
        // ...
    ]
});
```

---

## Potential Future Work

1. **More Modules**: Could add modules 25+ for specialized topics
2. **Quiz System**: Interactive assessment with scoring
3. **Progress Tracking**: LocalStorage-based progress persistence
4. **Print Styles**: CSS for printable lesson summaries
5. **Mobile Optimization**: Touch-friendly Canvas interactions
6. **Dark/Light Theme Toggle**: User preference for theme
7. **Search Functionality**: Full-text search across lessons

---

## How to Launch

### Option 1: Batch File (Recommended)
Double-click `Launch_EE_Learning.bat`
- Starts Python HTTP server on port 8080
- Opens browser automatically

### Option 2: Manual
```bash
cd C:\Users\juanf\Desktop\Claude\EE_learning
python -m http.server 8080
# Then open http://localhost:8080
```

### Option 3: Direct (Limited)
Open `index.html` directly in browser
- Some features may not work due to CORS

---

## Notes for Next Session

- All 66 planned lessons have been added
- All ASCII art converted to Canvas visualizations
- curriculum.js is fully updated
- The platform is fully functional

If continuing development:
1. Read this file first
2. Check `assets/curriculum.js` for current lesson structure
3. Follow `SCHEMATIC_METHODOLOGY.md` for new schematics
4. Use existing lessons as templates for new content

---

## Color Reference (Quick Copy)

```javascript
const colors = {
    yellow: '#FFFF00',
    cyan: '#00FFFF',
    magenta: '#FF66FF',
    green: '#00FF00',
    orange: '#FF6600',
    red: '#FF0000',
    blue: '#0066FF',
    background: '#181818',
    cardBg: '#222',
    gridLine: '#333',
    text: '#CCC',
    textMuted: '#888'
};
```
