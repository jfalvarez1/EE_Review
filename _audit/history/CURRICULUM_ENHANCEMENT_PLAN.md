# Curriculum Enhancement Plan
## Based on Razavi, Art of Electronics, and Agarwal Teachings

### Overview
This plan identifies gaps in the current curriculum and proposes enhancements based on the teaching methodologies and content from:
- **Behzad Razavi** - "Design of Analog CMOS Integrated Circuits" and "Fundamentals of Microelectronics"
- **Horowitz & Hill** - "The Art of Electronics" (3rd Edition)
- **Anant Agarwal** - MIT 6.002 Circuits and Electronics (OCW)

---

## Priority 1: New Modules to Add

### Module 25: Feedback Theory & Stability (Razavi/Agarwal)
**Rationale:** Current curriculum has scattered feedback content but no systematic treatment.

Proposed Lessons:
1. **Feedback Fundamentals** - Open/closed loop, loop gain, desensitivity
2. **Feedback Topologies** - Series-shunt, shunt-series, series-series, shunt-shunt
3. **Loading Effects in Feedback** - Input/output impedance with feedback
4. **Stability Analysis** - Bode plots, phase margin, gain margin
5. **Nyquist Criterion** - Encirclements, conditional stability
6. **Compensation Techniques** - Dominant pole, Miller, lead-lag
7. **Two-Stage Amplifier Compensation** - Miller capacitor sizing
8. **Nested Miller Compensation** - Three-stage and beyond
9. **Feedforward Compensation** - Improving bandwidth
10. **Stability with Capacitive Loads** - Output buffers, isolation resistors

### Module 26: Small-Signal Analysis Mastery (Razavi/Agarwal)
**Rationale:** Students need systematic approach to AC analysis.

Proposed Lessons:
1. **Small-Signal Models Review** - BJT π-model, MOSFET models
2. **Systematic Node Analysis** - KCL with controlled sources
3. **Transfer Function Derivation** - From circuit to H(s)
4. **Pole and Zero Identification** - Time constants method
5. **Miller's Theorem** - Capacitance multiplication and reduction
6. **Common-Mode Half-Circuit** - Analyzing differential circuits
7. **Differential-Mode Half-Circuit** - Simplifying analysis
8. **Open-Circuit Time Constants** - Bandwidth estimation
9. **Short-Circuit Time Constants** - Zero location
10. **Worked Examples** - Complete analysis walkthroughs

### Module 27: Analog IC Design Principles (Razavi)
**Rationale:** Missing IC-level perspective that explains integrated circuit behavior.

Proposed Lessons:
1. **Device Matching and Mismatch** - Random offset, gradient errors
2. **Layout for Matching** - Common-centroid, interdigitation
3. **Current Reference Generation** - Beta-multiplier, self-biased
4. **Bias Circuit Design** - PTAT, CTAT, supply-independent
5. **Bandgap Reference Deep Dive** - First-order and curvature correction
6. **Startup Circuits** - Ensuring proper initialization
7. **Process Corners** - Fast/slow, temperature, voltage variations
8. **Monte Carlo Analysis** - Statistical design verification
9. **ESD Protection Structures** - Diodes, SCRs, snapback
10. **Analog Layout Techniques** - Guard rings, substrate contacts

---

## Priority 2: Enhance Existing Modules

### Module 1 Enhancements (BJT)
Add to existing lessons:
- **Lesson 3 (Diff Pair):** Add Razavi-style large-signal analysis, input range calculation
- **Lesson 11 (Cascode):** Add telescopic vs folded cascode trade-offs
- **Lesson 13 (Noise):** Add noise optimization, Fmin derivation
- **New Lesson:** BJT Amplifier Design Procedure (step-by-step Razavi approach)

### Module 2 Enhancements (Op-Amp)
Add to existing lessons:
- **Lesson 8 (Stability):** Expand with Bode plot construction, compensation design procedure
- **New Lesson:** Op-Amp Internal Architecture (what's inside the triangle)
- **New Lesson:** Two-Stage Op-Amp Design (741-style analysis)

### Module 5 Enhancements (MOSFET)
Add to existing lessons:
- **Lesson 1:** Add square-law derivation, short-channel effects, velocity saturation
- **Lesson 3:** Add source degeneration analysis, common-source with active load
- **New Lesson:** MOSFET Small-Signal Model Derivation
- **New Lesson:** Cascode Current Sources (high-swing vs regular)
- **New Lesson:** Differential Pair with MOSFET (input range, gm, Av)

### Module 6 Enhancements (Power Electronics)
Add to existing lessons:
- **Lesson 7 (Control Loops):** Add Type I/II/III compensator design procedure
- **Lesson 7:** Add voltage-mode vs current-mode comparison
- **New Lesson:** State-Space Averaging (Razavi approach to converters)

---

## Priority 3: Art of Electronics Style Content

### Practical Design Wisdom to Add Throughout
Based on AoE "Bad Ideas" and design rules:

1. **Don't put capacitors on high-impedance nodes** (stability issues)
2. **Always consider what happens at DC** (blocking caps, bias)
3. **Check worst-case component tolerances** (1% vs 5%)
4. **Consider startup and transient conditions** (not just steady-state)
5. **Watch out for ground loops** (single-point grounding)
6. **Decouple every IC** (not just power supply pins)
7. **Parasitic elements kill bandwidth** (trace inductance, PCB capacitance)

### "Art of Electronics" Style Boxes to Add
Add info boxes throughout lessons with practical wisdom:
- "Don't Do This" boxes (common mistakes)
- "Real-World Consideration" boxes (what datasheets don't tell you)
- "Design Rule" boxes (rules of thumb with derivation)
- "Why It Fails" boxes (failure mode analysis)

---

## Priority 4: SPICE Simulation Integration

### Add SPICE Examples to Key Lessons
Create embedded SPICE netlists with expected results:

1. **BJT Biasing** - Verify Q-point with component tolerances
2. **Diff Pair** - Measure CMRR, offset, input range
3. **Op-Amp Stability** - Bode plot, phase margin measurement
4. **Buck Converter** - Transient response, loop gain
5. **Bandgap Reference** - Temperature sweep
6. **Noise Analysis** - .noise simulation examples

### SPICE Best Practices Lesson
- Model selection (Level 1 vs BSIM4)
- Convergence issues and solutions
- Parametric sweeps
- Monte Carlo analysis
- Operating point analysis (.op)

---

## Priority 5: Razavi-Style Worked Examples

### Add Detailed Design Walkthroughs
Each walkthrough should include:
1. Specifications → Requirements analysis
2. Topology selection → Trade-off discussion
3. Hand calculations → Approximate sizing
4. SPICE verification → Fine-tuning
5. Layout considerations → Matching, parasitics

### Proposed Walkthroughs
1. **Two-Stage Op-Amp** - From specs to working circuit
2. **Bandgap Reference** - 1.2V with low TC
3. **Current Mirror with High Ro** - Cascode design
4. **Differential Amplifier** - Complete analysis
5. **Buck Converter Compensator** - Type II/III design

---

## Implementation Order

### Phase 1 (Immediate - This Session)
1. Create Module 25 Lesson 1-3 (Feedback Fundamentals)
2. Enhance Module 2 Lesson 8 with detailed Bode analysis
3. Add Razavi-style worked example to Module 1 Lesson 3 (Diff Pair)

### Phase 2 (Next Session)
1. Complete Module 25 (Feedback & Stability)
2. Create Module 26 Lesson 1-5 (Small-Signal Analysis)
3. Add SPICE examples to Module 1

### Phase 3 (Future)
1. Complete Module 26
2. Create Module 27 (Analog IC Design)
3. Add "Art of Electronics" style boxes throughout

---

## Success Metrics

- All new content includes interactive calculators or visualizations
- Each major topic has at least one worked example with calculations
- SPICE netlists are provided for simulation practice
- Exercises test both conceptual understanding and calculation ability
- Content is self-contained (doesn't require external textbooks)
