# EE Learning Curriculum Expansion - Progress Checkpoint

**Last Updated:** December 20, 2025

## Overall Goal
Add lessons to ensure each module has 10 lessons minimum, with proper SVG graphics.

---

## COMPLETED MODULES

### Module 13: Communication Protocols ✓
- Lessons 5-10 added (6 lessons total)
- All complete

### Module 14: Advanced Analog Blocks ✓
- Lessons 4-10 added (7 lessons total)
- All complete

### Module 15: Practice Problems ✓
- Lessons 6-10 added (5 lessons total)
- All complete

### Module 16: Real-World Scenarios ✓
- Lessons 4-10 added (7 lessons total)
- All complete

---

## IN PROGRESS

### Module 17: Troubleshooting & Debug (5 of 7 done)
**Completed:**
- lesson-04.html: Power Supply Debugging
- lesson-05.html: Oscillation Problems
- lesson-06.html: Ground Loop Issues
- lesson-07.html: Thermal Problems
- lesson-08.html: EMI/RFI Debugging

**Still needed:**
- lesson-09.html: Signal Integrity Issues
- lesson-10.html: Systematic Debug Methodology

---

## PENDING MODULES

### Module 18: Power Supply Design (add 7 lessons)
- Lesson 4: Boost Converter Design
- Lesson 5: Buck-Boost Converters
- Lesson 6: Flyback Converters
- Lesson 7: Power Supply Filtering
- Lesson 8: Soft Start Circuits
- Lesson 9: Current Limiting
- Lesson 10: Power Sequencing

### Module 19: Battery Management (add 6 lessons)
- Lesson 5: Fuel Gauge Algorithms
- Lesson 6: Cell Balancing Circuits
- Lesson 7: Protection Circuits
- Lesson 8: Charging Profiles
- Lesson 9: Battery Chemistry Selection
- Lesson 10: BMS Integration

### Module 20: Sensor Interface (add 5 lessons)
- Lesson 6: RTD/Thermocouple Interfaces
- Lesson 7: Strain Gauge Bridges
- Lesson 8: Capacitive Sensing
- Lesson 9: Hall Effect Sensors
- Lesson 10: MEMS Sensor Interfaces

### Module 21: RF Analog (add 5 lessons + audit existing for ASCII→SVG)
- Lesson 6: Matching Networks
- Lesson 7: Low Noise Amplifiers
- Lesson 8: Power Amplifiers
- Lesson 9: Mixers and Frequency Conversion
- Lesson 10: RF Filter Design

### Module 22: EMI/EMC Design (add 6 lessons + audit existing for ASCII→SVG)
- Lesson 5: Shielding Effectiveness
- Lesson 6: PCB Layout for EMC
- Lesson 7: Common-Mode Chokes
- Lesson 8: Surge Protection
- Lesson 9: Conducted Emissions
- Lesson 10: Radiated Emissions

### Module 24: Complex Real-World Projects (add 5 lessons)
- Lesson 6: High-Precision DAQ System
- Lesson 7: Battery-Powered IoT Sensor
- Lesson 8: Motor Control System
- Lesson 9: Audio Amplifier Design
- Lesson 10: Power Supply with PFC

---

## FINAL TASK
- Update `assets/curriculum.js` with all new lesson entries

---

## Lesson Template Reference

Each lesson follows this structure:
```html
<div class="lesson-content" data-module="X" data-lesson="Y">
    <div class="card"><h2>Title</h2>...</div>
    <div class="card"><h3>Interactive: [Topic]</h3>
        <div class="controls">...</div>
        <div class="canvas-wrap"><canvas>...</canvas></div>
        <div class="kv">...</div>
    </div>
    <div class="card"><h3>Schematic</h3><div id="X-schematic"></div></div>
    <div class="card"><h3>SPICE Netlist</h3><div id="X-spice"></div></div>
    <div class="card"><h3>Checklist</h3><div id="X-checklist"></div></div>
    <div class="card"><h3>Practice Exercises</h3><div id="X-exercises"></div></div>
</div>
<script>/* Interactive canvas, SchematicSVG, widgets */</script>
```

Key patterns:
- TEK color scheme: ch1:'#FFFF00', ch2:'#00FFFF', ch3:'#FF66FF', ch4:'#00FF00'
- AD.parseValue() for input parsing
- AD.formatValue() for display formatting
- SchematicSVG for inline circuit diagrams
- SpiceNetlistWidget, ChecklistWidget, ExerciseWidget

---

## Files Reference
- Plan file: `C:\Users\juanf\.claude\plans\elegant-hopping-perlis.md`
- Lessons: `lessons/module-XX/lesson-YY.html`
- Curriculum: `assets/curriculum.js`
- SVG Library: `assets/schematic-svg.js`

---

## Resume Instructions
1. Start with Module 17 lesson-09 (Signal Integrity Issues)
2. Then lesson-10 (Systematic Debug Methodology)
3. Continue with Module 18-22, 24 in order
4. Finally update curriculum.js
