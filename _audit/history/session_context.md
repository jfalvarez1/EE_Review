# Analog Design Refresher Course - Session Context

## User Background
- B.S. in Electrical Engineering
- 3 years of Systems Engineering experience
- Needs rigorous refresher bridging theory with practical simulation

## Task Overview
Create a structured "Analog Design Refresher Course" as a single, self-contained, interactive HTML5 file.

## Source Materials
1. TI Analog Engineer's Circuit Cookbook (split_pdfs/TI_Circuit_Cookbook/ and TI_Cookbook/)
2. The Art of Electronics 3rd Edition (split_pdfs/Art_of_Electronics/)
3. Analog Pocket Reference (split_pdfs/Analog_Pocket_Reference/)

## Phase 1: Research Requirements
- [ ] Component Selection: 2N3904/2N3906 BJTs, 2N7000 FETs, TL072/OPAx/LM358 op-amps
- [ ] Verify non-ideal characteristics (bandwidth, slew rate, input bias current)
- [ ] Standard E12/E24 resistor and capacitor values
- [ ] Circuit topologies: Virtual Ground, Sallen-Key Filters, Transimpedance Amplifiers

## Phase 2: Curriculum Structure (Scaffolding Pedagogy)

### Module 1: Transistor Intuition
- Biasing fundamentals
- Common Emitter Gain
- Differential Pair
- Focus: Why bias? How diff pair creates op-amp front-end

### Module 2: Op-Amp Fundamentals
- Inverting/Non-Inverting amplifiers
- Buffer
- Integrator
- Focus: Ideal assumptions vs reality (clipping, slew rate)

### Module 3: Advanced Applications
- Active Filters
- Photodiode Transimpedance Amplifier
- Instrumentation Amplifier
- Focus: Noise, stability, Bode plots

## Phase 3: Output Requirements
- Single HTML file with CSS styling (clean, academic look)
- Interactive <details>/<summary> spoilers for solutions
- Each problem includes:
  - Design Goal
  - Component Constraints
  - Simulation Setup (Input Source, Scope Settings, Analysis type)
  - Expected Waveforms (text description)
  - Reality Check (non-ideal behavior notes)

## Research Notes - Art of Electronics 3rd Ed

### Chapter 1: Foundations (RC/LC Circuits, Filters)

#### RC Filter Formulas
- **Highpass**: Vout = Vin × R / √[R² + (1/ωC)²]
- **Lowpass**: Vout = Vin / √[1 + (ωRC)²]
- **-3dB frequency**: f₃dB = 1/(2πRC)
- **Rolloff**: -6dB/octave = -20dB/decade (single pole)
- **Phase at f₃dB**: ±45° (depends on HP or LP)

#### LC Resonant Circuits
- **Resonant frequency**: f₀ = 1/(2π√LC)
- **Q factor**: Q = f₀/Δf₃dB
- **Parallel RLC**: Q = ω₀RC (tank circuit - impedance peaks)
- **Series RLC**: Q = ω₀L/R (trap - impedance dips to zero)

#### Key Concepts
- Phasor diagrams for impedance analysis
- RC differentiator = highpass filter (time vs frequency domain)
- RC integrator = lowpass filter
- Capacitor bypassing for signal suppression
- Energy storage in capacitors: Q = CV

---

### Chapter 2: Bipolar Transistors (BJTs)

#### Transistor Model - 4 Rules (npn)
1. **Polarity**: Collector more positive than emitter
2. **Junctions**: B-E conducts (~0.6V drop), B-C reverse-biased
3. **Max ratings**: IC, IB, VCE, power dissipation limits
4. **Current amplifier**: IC = β × IB (β ≈ 50-250, NOT reliable)

#### Critical Warning
β varies with: temperature, IC, VCE, and unit-to-unit
**Never design circuits that depend on specific β value!**

#### Transistor States
- **Cutoff**: No collector current (IB = 0)
- **Active region**: IC flows, VCE > VE + 0.2V
- **Saturation**: VCE ≈ 0.05-0.2V (switch ON state)

#### Emitter Follower (Voltage Follower)
- **Output**: VE ≈ VB - 0.6V (gain ≈ 1)
- **Input impedance**: Zin = (β+1) × Zload
- **Output impedance**: Zout = Zsource/(β+1)
- **Key limitation**: npn can only SOURCE current
- **Base-emitter breakdown**: Often only 6V reverse!

#### Current Source Design
- IC ≈ (VB - 0.6V)/RE (independent of VC if not saturated)
- **Compliance**: Range where transistor stays in active region
- Biasing: Voltage divider, zener, or diode string
- Current sinks (npn) vs current sources (pnp)

#### Common-Emitter Amplifier (Preview)
- Collector voltage: VC = VCC - IC×RC
- Provides voltage gain (unlike follower)
- Full details in next section

### Practical Design Rules
1. Use stiff voltage dividers for biasing: R1||R2 << βRE
2. Overdrive base for saturation (10× minimum IB)
3. Use suppression diode for inductive loads
4. Provide dc bias path for capacitively coupled inputs
5. Consider worst-case design (min Vin, max Iout)

### Component Specifications (from Table 2.1)
| Part | VCEO | IC(max) | β(typ) | fT | Notes |
|------|------|---------|--------|-----|-------|
| 2N3904/3906 | 40V | 150mA | 200 | 300MHz | Jellybean |
| 2N4401/4403 | 40V | 500mA | 150 | 300MHz | Higher current |
| BC547C/557C | 45V | 100mA | 500 | 150MHz | High beta |
| 2N5551/5401 | 150V | 100mA | 100 | 100MHz | High voltage |
| MPSA42/92 | 300V | 30mA | 75 | 50MHz | Very high voltage |

---

### Common-Emitter Amplifier

#### Circuit Configuration
- Output at collector (180° phase inversion)
- Two types: grounded emitter (RE=0) or emitter-degenerated

#### Voltage Gain
```
With degeneration:  G = -RC/(RE + re)
Grounded emitter:   G = -gm×RC = -RC/re
```
Where **re = 25/IC(mA) ohms** (intrinsic emitter resistance)

#### Input/Output Impedance
- **Zin** ≈ β(RE + re), dominated by bias divider
- **Zout** ≈ RC

#### Design Equations (VC = 0.5VCC)
1. RC = VCC/(2IC)
2. RE = RC/|G| - re
3. VB = ICRE + 0.6V
4. R1||R2 ≈ 0.1βRE

---

### Ebers-Moll Model

#### Core Equations
```
IC = IS × e^(VBE/VT)
VBE = VT × ln(IC/IS)
```
Where **VT = kT/q = 25.3mV** at room temp

#### Transconductance
```
gm = IC/VT = 40×IC(mA) mS
re = 1/gm = 25/IC(mA) Ω
```

#### Temperature Effects
- **VBE drift**: −2.1 mV/°C
- **IC drift**: +9%/°C (at constant VBE)
- IC doubles every 8°C

#### Practical Rules of Thumb
- 60 mV/decade: VBE change per 10× IC change
- 4%/mV: IC change per 1mV VBE change

---

### Current Mirrors
- Matched pair with diode-connected Q1
- Iout ≈ Iin (for matched transistors)
- **Wilson mirror**: adds cascode for better output impedance

### Differential Amplifiers
```
Gdiff = RC/(2(RE + re))
CMRR ≈ R1/(RE + re)
```
With current source tail: CMRR >> 100,000:1

### Push-Pull Outputs
- Class-AB biasing eliminates crossover distortion
- Emitter ballast resistors (0.22-1Ω) for thermal stability

### Cascode Configuration
- Eliminates Miller effect
- Q1 (CE) provides gm, Q2 (CB) provides voltage swing
- High gain + wide bandwidth

---

## Module 2: Op-Amp Fundamentals

### Golden Rules of Op-Amps
**Rule I**: Inputs draw no current (infinite Zin)
**Rule II**: Output adjusts to make V+ = V- (with negative feedback)

**Valid when**: Negative feedback applied, linear region, frequency < bandwidth

### Basic Configurations

| Config | Gain | Zin | Notes |
|--------|------|-----|-------|
| Inverting | G = -Rf/R1 | ≈ R1 | Phase inversion |
| Non-Inverting | G = 1 + Rf/R1 | Very high (1+AB)×Ri | Always ≥1 |
| Buffer | G = 1 | Extremely high | Unity gain, impedance transform |
| Summing | Vout = -Rf(V1/R1 + V2/R2...) | R1, R2... | Audio mixing, DAC |
| Difference | Vout = (Rf/R1)(V2-V1) | Depends on matching | CMRR needs matched Rs |

### Feedback Equations
```
Closed-loop gain:  GCL = A/(1+AB)  →  ≈ 1/B when AB >> 1
Loop gain:         AB = (open-loop gain) × (feedback factor)
Desensitivity:     ΔG/G = (1/(1+AB)) × (ΔA/A)
```

### Impedance Effects of Feedback
- **Series feedback** (non-inv): Zin(CL) = (1+AB) × Zin(OL) ↑
- **Shunt feedback** (inv): Zin(CL) = Zin(OL)/(1+AB) ↓
- **Output**: Zout(CL) = Zout(OL)/(1+AB) (always reduced)

### Integrator
```
Vout = -(1/RC)∫Vin dt
```
- Gain ∝ 1/f (-20dB/decade)
- **Limitation**: DC offset → saturation (add parallel R)

### Differentiator
```
Vout = -RC(dVin/dt)
```
- Gain ∝ f (+20dB/decade)
- **Limitation**: Amplifies HF noise, stability issues
- **Fix**: Add Rs in series with C, Cf across R

---

## TI Cookbook: Practical Circuits

### SAR ADC Direct Interface (No Buffer)
- **Use case**: Slow sensors ≤10ksps, low impedance
- **Key equation**: tACQ ≥ k × RTH × CFLT
  - k = 11 for 14-bit, 10 for 12-bit, 9 for 10-bit
- **Example**: 10kΩ + 680pF @ 10ksps

### Ultra-Low Power Sensor Front-End
- **Topology**: LPV811 (450nA) → RC filter → ADS7042
- **Power**: 2.65µW total @ 1ksps
- **RC filter**: 200kΩ + 510pF → fc = 1.56kHz

### Component Selection Rules
- **Capacitors**: COG/NPO ceramic (low distortion)
- **Resistors**: 0.1%, 20ppm/°C film
- **ADC reference**: Use high-PSRR LDO (TPS7A47)

---

## Transimpedance Amplifiers (TIA)

### Basic Topology
```
Photodiode → [−] Op-Amp → Vout
              ↑___Rf___↓
```
**Gain**: Vout = -Ipd × Rf

### Stability Compensation
- **Problem**: Cpd creates pole → oscillation
- **Solution**: Add Cf across Rf
- **Rule**: Cf ≈ Cpd/5 to Cpd/10

### Design Equations
```
BW (uncompensated) = 1/(2π × Rf × Cpd)
BW (compensated)   = 1/(2π × Rf × Cf)
Noise gain peak    = 1 + Cpd/Cf
```
**Stability check**: Noise_gain_peak × BW < GBW/3

### Noise Sources
1. Op-amp voltage noise (× noise gain)
2. Op-amp current noise (× Rf)
3. Rf thermal noise: √(4kT/Rf × BW)
4. Photodiode shot noise: √(2qIpd × BW)

---

## Instrumentation Amplifiers

### Three Op-Amp Topology
- Two input buffers (high Zin)
- One difference amp (CMRR)
- **Gain**: G = 1 + 2R/Rgain

### Key Specs
- **CMRR**: Critical for bridge sensors
- **Zin**: Very high (don't load sensor)
- **Gain accuracy**: Depends on resistor matching

### Applications
- Bridge sensors (strain gauges, load cells)
- Low-level differential signals
- PIR sensors, gas sensors

---

## Active Filters

### Filter Response Types

| Type | Characteristic | Best For |
|------|----------------|----------|
| **Butterworth** | Maximally flat passband | General purpose |
| **Chebyshev** | Steepest rolloff (equiripple) | Sharp cutoff needed |
| **Bessel** | Linear phase (flat delay) | Waveform preservation |

**Rolloff**: 6n dB/octave (n = filter order/poles)

### Key Formulas
```
Butterworth:  |H| = 1/√[1+(f/fc)^2n]
Chebyshev:    |H| = 1/√[1+ε²Cn²(f/fc)]
Group delay:  Tg = -dφ/dω
```

### Sallen-Key Topology
- 2-pole sections, cascadable
- Unity-gain or non-inverting (gain K)
- **Drawback**: High sensitivity to component tolerances
- 1% components → visible deviation; 5% → significant

### Design Notes
- Each 2-pole section = one quadratic factor
- Non-identical sections when cascaded
- RC = 1/(2πfc) for frequency scaling

### MFB (Multiple Feedback) Topology
- Op-amp as integrator (not follower)
- **Better HF performance** than Sallen-Key
- fc = (1/√2) × 1/(2πRC)
- Example: R=20k, C=5.6nF → fc=1kHz

### State Variable Filters
- 3 op-amps, **simultaneous LP/HP/BP outputs**
- Frequency tunable while maintaining constant Q
- Better stability than Sallen-Key
- ICs: UAF42, MAX274-5

### Higher-Order Cascading
- n-pole filter = n/2 two-pole sections
- Each section has different K (gain) values
- Use normalized cn factors: RC = 1/(2π×cn×fc)

### VCVS Design Table (Butterworth)
| Poles | K values | cn values |
|-------|----------|-----------|
| 2 | 1.586 | 1.272 |
| 4 | 1.152, 2.235 | 1.432, 1.606 |
| 6 | 1.068, 1.586, 2.483 | 1.607, 1.692, 1.908 |

---

## Op-Amp Non-Idealities

### DC Errors

| Parameter | BJT Input | JFET Input | CMOS Input |
|-----------|-----------|------------|------------|
| **VOS** | ~1mV (10μV precision) | 0.8-2mV | ~1mV |
| **IB** | 15-80 nA | 50-200 pA | <1 pA |
| **IOS** | ~1/10 of IB | 25 pA typ | negligible |

**Temperature effect**: JFET IB can increase 100× at 70°C

### AC Limitations

| Parameter | Typical | Fast Op-Amps |
|-----------|---------|--------------|
| **GBW** | 1-10 MHz | up to 2000 MHz |
| **Slew Rate** | 2-15 V/μs | up to 4000 V/μs |

**Key relationship**: BW × Gain = GBW (constant)

### Stability
- Phase shifts 90° above rolloff frequency
- Need >0° phase margin at fT
- Internal compensation cap ensures unity-gain stability
- Capacitive loads reduce phase margin → add series R

### Example Specs (LF411 - JFET)
- VOS: 0.8mV typ, 2mV max
- IB: 50pA typ, 200pA max
- fT: ~4 MHz
- Slew: 15 V/μs

---

## V5 Site Architecture (Reference Implementation)

### File Structure
```
index.html              - Landing/navigation
resources.html          - Links, templates
lessonXX_*.html         - Individual lessons (standalone)
assets/common.css       - Shared theme (dark, cards, canvas)
assets/common.js        - AD framework object
images/*.png            - Reference scope screenshots
```

### AD Framework API (common.js)
```javascript
// Numeric parsing (supports k,M,m,u,n,p suffixes)
AD.num(id)              // Get parsed value from input
AD.parseNumValue(str)   // Parse string directly
AD.fmt(x, digits)       // Format for display

// Plotting
AD.drawGrid(ctx,w,h)
AD.plotWave(ctx,w,h,samples,vPerDiv,vOffset,tPerDiv,label)
AD.plotMultiWave(ctx,w,h,traces,vPerDiv,vOffset,tPerDiv,label)
AD.plotSpectrum(ctx,w,h,f,m,label)

// Signal generation
AD.genSine({N,dt,f,amp,off})
AD.genStep({N,t0,dt,lo,hi})

// Signal processing
AD.rcLowpass(x,dt,tau)
AD.rcHighpass(x,dt,tau)
AD.applySlew(samples,dt,slew_V_per_s)
AD.applyClip(samples,lo,hi)
AD.addNoise(samples,vrms)

// Spectrum
AD.dftMag(samples,dt,nBins)
```

### Widget Pattern (per lesson)
```html
<div class="card">
  <h2>Interactive waveform</h2>
  <div class="canvas-wrap">
    <div class="controls">
      <div class="c3"><label>RF (Ω)</label>
        <input id="T_rf" type="text" value="100k"/></div>
      <!-- more inputs... -->
      <button id="T_btn">Render</button>
      <canvas id="T_cv" width="980" height="320"></canvas>
    </div>
  </div>
</div>
<script>
(function(){
  const cv=document.getElementById('T_cv');
  const ctx=cv.getContext('2d');
  function render(){
    const rf = AD.num('T_rf');
    // compute samples...
    AD.plotWave(ctx, cv.width, cv.height, samples, ...);
  }
  document.getElementById('T_btn').addEventListener('click', render);
  render();
})();
</script>
```

### Key CSS Classes
- `.card` - Main content container
- `.controls` - Grid layout for inputs (c3, c4, c6, c12 spans)
- `.canvas-wrap` - Dark background for canvas
- `.kv`, `.box` - Key-value display
- `.checklist` - Task checkboxes with localStorage persistence
- `.notice`, `.warn` - Info/warning callouts

### Design Principles from V5
1. **Offline-first**: No external dependencies
2. **Engineering suffixes**: All inputs accept k,M,u,n,p
3. **SPICE integration**: Copyable netlists for each lesson
4. **Expected waveforms**: Reference images + interactive prediction
5. **Progressive complexity**: Simple → Medium → Complex tasks
6. **Checklist persistence**: localStorage tracks completion

---

## Online Research: Education Best Practices

### Key Pedagogical Findings

**1. Hybrid Learning (Theory + Simulation + Hands-on)**
- CTU Prague: 8-year study shows synergistic model works best
- "Circuit design is only 50% of the job—layout is the other 50%"
- Simulation complements but doesn't replace physical lab work

**2. Simulation-Based Learning Benefits**
- Risk-free experimentation (no component damage)
- Immediate feedback on design changes
- Bridges gap between theory and practice
- LTspice feedback: "overcomes limitations of traditional labs"

**3. The Industry Skills Gap**
- "Huge gap between college education and industry expectation"
- Universities deemphasize analog while boosting digital
- Analog Devices created Engineering University to address this
- Key demand areas: Power ICs for EVs, precision ADCs, RF for 5G, analog IP for AI

**4. What Industry Wants**
- Device-level transistor knowledge
- Analog topologies (op-amps, references, ADC/DAC front-ends)
- SPICE proficiency
- Layout awareness
- Real silicon/tapeout experience
- Noise, sensitivity, gain, bandwidth analysis

**5. Interactive Learning Principles**
- Constructivism: learners build mental models through interaction
- Today's students struggle with hour-long lectures
- Active/interactive techniques improve engagement
- Progressive complexity (Simple → Medium → Complex)

### Sources
- [CTU Prague Hybrid Learning Study](https://www.sciencedirect.com/science/article/abs/pii/S0263224125025576)
- [Analog Devices Engineering University](https://www.analog.com/en/analog-dialogue/articles/analog-devices-engineering-university.html)
- [Cadence: Analog Design Qualifications](https://resources.pcb.cadence.com/blog/2020-qualifications-of-an-analog-design-engineer)
- [RS Online: Circuit Simulation for Education](https://www.rs-online.com/designspark/circuit-simulation-for-education-and-learning)

### Common Design Mistakes to Teach (PCB/Layout)

**Grounding Errors:**
- Neglecting ground layer → noise/instability
- Long ground traces act as antennas
- Ground loops from gaps/slots in planes
- Overlapping analog/digital grounds → capacitive coupling

**Layout Errors:**
- Noisy digital near sensitive analog → crosstalk
- High-speed signals (SPI, I2C, CAN) adjacent to analog
- Long analog traces → EMI susceptibility
- Analog/digital crossing not at 90°

**Best Practices to Demonstrate:**
- Single-point connection of analog/digital grounds
- Bypass caps close to IC pins with short/wide traces
- 4-layer minimum: dedicated ground plane
- Keep analog traces short and simple

### Oscilloscope Troubleshooting Skills

**Key Test Points:**
- Power rails (ripple, noise)
- Input/output pins
- Sensitive nodes (summing junction, etc.)

**What to Look For:**
- Unexpected oscillation (voltmeter shows weird voltage)
- Signal shape (sine, square, distorted?)
- Noise level and frequency content
- Phase differences between signals

**Probe Techniques:**
- Calibrate probes (compensate R/C)
- Avoid loading effects on high-Z nodes
- Ground lead length matters at HF

### TI Precision Labs Curriculum Structure

**Major Topic Categories:**
1. Input offset voltage (Vos) and bias current (Ib)
2. Input/output swing limitations
3. Power dissipation and thermal
4. Bandwidth (Aol, loop gain, 1/beta Bode plots)
5. Slew rate (large vs small signal)
6. Noise (9 videos + lab)
7. Stability (7 videos + compensation techniques)

**Format per Topic:**
- Short training videos
- Multiple choice quizzes
- Short answer exercises
- Hands-on lab exercises
- TINA-TI SPICE simulations

### Sources (continued)
- [TI Precision Labs Op-Amps](https://www.ti.com/video/series/precision-labs/ti-precision-labs-op-amps.html)
- [Analog Devices: Mixed-Signal Layout](https://www.analog.com/en/resources/analog-dialogue/articles/what-are-the-basic-guidelines-for-layout-design-of-mixed-signal-pcbs.html)
- [SparkFun: How to Use an Oscilloscope](https://learn.sparkfun.com/tutorials/how-to-use-an-oscilloscope/all)
- [Analog Devices: Staying Well Grounded](https://www.analog.com/en/resources/analog-dialogue/articles/staying-well-grounded.html)

---

## Interactive Tools Research

### Existing HTML5 Circuit Simulators

**1. CircuitJS1** (lushprojects.com/circuitjs/)
- Potentiometers/voltage sources adjustable via sliders
- Color coding: green=+V, grey=GND, red=-V, yellow dots=current
- Real-time visualization, no plugins needed
- Cross-compiled from Java to JavaScript

**2. SimcirJS** (github.com/kazuhikoarase/simcirjs)
- Drag-and-drop component placement
- Wire connections via drag operations
- Pure HTML5/JavaScript

**3. ECSP** (ecsp.ch)
- Change element values during execution via sliders
- "Interactive lab type experience"
- Designed for students and teachers

### Canvas Oscilloscope Patterns

**Virtual Oscilloscope Libraries:**
- [Academo Virtual Oscilloscope](https://academo.org/demos/virtual-oscilloscope/) - Live sound visualization
- [Physics Zone](https://physics-zone.com/virtual-oscilloscope/) - Used in published research
- [University of Hawaii](https://www.phys.hawaii.edu/dashboard/simulations/oscilloscope/) - CRT-style simulation

**Implementation Techniques:**
```javascript
// requestAnimationFrame for smooth 60fps
function animate() {
  ctx.clearRect(0, 0, w, h);
  drawGrid(ctx);
  drawWaveform(ctx, samples);
  requestAnimationFrame(animate);
}

// Multiple canvas layers for performance
// - Background grid (static, rarely redrawn)
// - Waveform layer (animated)
// - UI overlay (cursors, measurements)
```

### Expected vs Measured Verification Pattern

**Industry Approach:**
- "Experienced analog designer can tell in a fraction of a second if waveform looks right or wrong"
- Capture this intuition in interactive comparison tools
- Show ideal staircase/transfer function overlaid on actual

**Teaching Implementation:**
1. Calculate expected waveform from theory
2. Display as reference trace (dashed line)
3. User runs SPICE simulation
4. Compare measured vs expected visually
5. Highlight discrepancies (overshoot, ringing, DC offset)

**Key Metrics to Compare:**
- Rise/fall time
- Overshoot percentage
- Settling time
- DC offset
- Noise floor
- Frequency response shape

### Interactive Slider Patterns

**From Open Source Physics (Singapore):**
- Sliders modify variables in real-time
- Immediate visual feedback
- Play/pause/step/reset controls
- Simultaneous mechanical + electrical analogy

**Best Practices:**
- Range sliders with engineering suffix labels (1k, 10k, 100k)
- Logarithmic scales for component values
- Linked parameters (e.g., RC time constant auto-calculated)
- Tooltips showing current value + effect

### Sources (Interactive Tools)
- [CircuitJS1 Interactive Simulator](https://lushprojects.com/circuitjs/)
- [SimcirJS GitHub](https://github.com/kazuhikoarase/simcirjs)
- [Academo Virtual Oscilloscope](https://academo.org/demos/virtual-oscilloscope/)
- [Open Source Physics RLC Simulation](https://sg.iwant2study.org/ospsg/index.php/interactive-resources/physics/05-electricity-and-magnetism/03-ac/694-springrlc)

---

## EXPANDED CURRICULUM (Incorporating All Research)

### Design Philosophy

**Core Principles:**
1. **Hybrid Learning**: Theory → Interactive Simulation → SPICE Verification → (Future: Real Hardware)
2. **Constructivism**: Build mental models through interaction, not passive reading
3. **Progressive Complexity**: Each topic has Simple → Medium → Complex tasks
4. **Expected Waveform Verification**: Always show what "right" looks like
5. **Industry Alignment**: Focus on skills employers actually want

**Per-Topic Structure (TI Precision Labs Model):**
1. Concept explanation (text + diagrams)
2. Interactive calculator/visualizer with sliders
3. Expected waveform display (reference trace)
4. SPICE netlist (copy-paste ready)
5. "Verify in Simulator" task with node probing
6. Common mistakes callout
7. Self-check quiz/checklist

---

### MODULE 1: Transistor Intuition (Device-Level Knowledge)

#### Lesson 1.1: BJT as a Voltage-Controlled Current Source

**Interactive Elements:**
- [ ] Slider: VBE (0.5V to 0.8V, 1mV steps)
- [ ] Slider: Temperature (-40°C to +85°C)
- [ ] Live plot: IC vs VBE (Ebers-Moll curve)
- [ ] Calculated: gm, re at current operating point

**Expected Waveforms:**
- IC vs VBE exponential curve
- gm vs IC linear relationship
- Temperature drift animation (VBE shifts -2.1mV/°C)

**SPICE Task:**
```
Sweep VBE 0.5V to 0.8V
Probe: IC, IB
Calculate: β from plot
Compare: Calculated vs datasheet β
```

**Common Mistakes:**
- Designing circuits that depend on specific β value
- Ignoring temperature effects on VBE
- Forgetting base-emitter breakdown (~6V reverse)

---

#### Lesson 1.2: Common-Emitter Amplifier

**Interactive Elements:**
- [ ] Slider: VCC (5V to 20V)
- [ ] Slider: IC quiescent (0.1mA to 10mA, log scale)
- [ ] Slider: Gain target (1 to 100)
- [ ] Auto-calculate: RC, RE, R1, R2 for bias
- [ ] Live scope: Vin vs Vout waveforms

**Expected Waveforms:**
- Input sine wave
- Output inverted, amplified (check gain)
- Show clipping when gain too high

**SPICE Task:**
```
Build CE amplifier with calculated values
Apply 10mV, 1kHz sine input
Measure: Gain, phase, DC operating point
Sweep: Input amplitude until clipping
```

**Verification Nodes:**
| Node | Expected | What to Check |
|------|----------|---------------|
| VB | IC×RE + 0.6V | Bias point |
| VC | VCC/2 (ideally) | Headroom |
| VE | IC×RE | Stable bias |
| Vout | Gain × Vin, inverted | Small signal |

---

#### Lesson 1.3: Differential Pair

**Interactive Elements:**
- [ ] Slider: Tail current (0.1mA to 5mA)
- [ ] Slider: Differential input (±100mV)
- [ ] Live plot: Transfer characteristic (tanh curve)
- [ ] Show: Linear region vs saturation

**Expected Waveforms:**
- Differential transfer curve (S-shape)
- Output at each collector (complementary)
- Common-mode rejection demonstration

**SPICE Task:**
```
Build diff pair with current source tail
Sweep differential input ±100mV
Measure: Gdiff, CMRR
Add common-mode input, verify rejection
```

---

#### Lesson 1.4: Current Mirrors

**Interactive Elements:**
- [ ] Slider: Reference current (10µA to 1mA)
- [ ] Selector: Mirror type (Simple, Wilson, Cascode)
- [ ] Show: Output impedance comparison
- [ ] Animate: Current flow visualization

**Expected Waveforms:**
- Iout vs Vout (compliance range)
- Early effect slope comparison

---

### MODULE 2: Op-Amp Fundamentals

#### Lesson 2.1: Golden Rules and Basic Configurations

**Interactive Elements:**
- [ ] Selector: Configuration (Inverting, Non-Inv, Buffer, Difference)
- [ ] Sliders: R1, Rf (100Ω to 1MΩ, log scale)
- [ ] Live calculation: Gain, Zin, Zout
- [ ] Scope: Vin vs Vout

**Expected Waveforms:**
- Gain matches 1+Rf/R1 (non-inv) or -Rf/R1 (inv)
- Phase: 0° (non-inv) or 180° (inv)
- Saturation when Vout exceeds rails

**Verification Nodes:**
| Node | Expected | Check |
|------|----------|-------|
| V+ | Vin (non-inv) | Input |
| V- | Virtual ground (inv) | Feedback working |
| Vout | Gain × Vin | Small signal |

---

#### Lesson 2.2: Bandwidth and Slew Rate

**Interactive Elements:**
- [ ] Slider: Closed-loop gain (1 to 100)
- [ ] Slider: GBW product (1MHz to 100MHz)
- [ ] Live plot: Bode magnitude and phase
- [ ] Slider: Input amplitude (for slew demo)
- [ ] Animation: Small signal vs large signal behavior

**Expected Waveforms:**
- Bode plot showing -20dB/decade rolloff
- BW = GBW/Gain relationship
- Slew-limited triangle from square input

**SPICE Task:**
```
AC analysis: 10Hz to 10MHz
Measure: -3dB bandwidth
Compare: GBW/Gain vs measured
Transient: Large square wave → slew limiting
```

---

#### Lesson 2.3: DC Errors (Vos, Ib, Ios)

**Interactive Elements:**
- [ ] Selector: Op-amp type (BJT, JFET, CMOS)
- [ ] Input: Source impedance
- [ ] Calculate: Output error from each source
- [ ] Bar chart: Error budget breakdown

**Expected Values:**
| Type | Vos | Ib | Best For |
|------|-----|-----|----------|
| BJT | 1mV | 80nA | Low noise |
| JFET | 2mV | 50pA | High Zin |
| CMOS | 1mV | <1pA | Lowest Ib |

---

#### Lesson 2.4: Integrator and Differentiator

**Interactive Elements:**
- [ ] Sliders: R, C values
- [ ] Live calculation: Time constant, corner frequency
- [ ] Scope: Square wave → triangle (integrator)
- [ ] Scope: Triangle → square (differentiator)

**Expected Waveforms:**
- Integrator: -20dB/decade gain, -90° phase
- Differentiator: +20dB/decade, +90° phase
- Show DC drift in integrator without parallel R

---

### MODULE 3: Advanced Applications

#### Lesson 3.1: Active Filters (Sallen-Key)

**Interactive Elements:**
- [ ] Selector: Filter type (Butterworth, Chebyshev, Bessel)
- [ ] Selector: Response (LP, HP, BP)
- [ ] Slider: Cutoff frequency (10Hz to 100kHz, log)
- [ ] Slider: Order (2, 4, 6, 8)
- [ ] Auto-calculate: Component values from tables
- [ ] Live Bode plot with passband/stopband shading

**Expected Waveforms:**
- Butterworth: Maximally flat, soft knee
- Chebyshev: Ripple visible, sharp cutoff
- Bessel: Gentle rolloff, no overshoot on step

**SPICE Task:**
```
Build 4th-order Butterworth LP at 1kHz
AC analysis: Verify -3dB at 1kHz
Transient: Square wave → check ringing/overshoot
Compare: Butterworth vs Bessel step response
```

---

#### Lesson 3.2: Transimpedance Amplifier (TIA)

**Interactive Elements:**
- [ ] Slider: RF (10kΩ to 10MΩ, log)
- [ ] Slider: CF (0.1pF to 100pF, log)
- [ ] Slider: Photodiode capacitance Cpd
- [ ] Live calculation: Bandwidth, stability margin
- [ ] Scope: Current pulse → voltage output
- [ ] Stability indicator (phase margin bar)

**Expected Waveforms:**
- Clean step response (CF adequate)
- Ringing/oscillation (CF too small)
- Slow response (CF too large)

**Verification Nodes:**
| Node | Expected | Check |
|------|----------|-------|
| V- | Virtual ground (Vbias) | Feedback working |
| Vout | Iin × RF + Vbias | Transimpedance |

---

#### Lesson 3.3: Instrumentation Amplifier

**Interactive Elements:**
- [ ] Slider: Rgain (100Ω to 100kΩ)
- [ ] Live calculation: G = 1 + 2R/Rgain
- [ ] Slider: Common-mode input
- [ ] Show: Differential output vs CM rejection
- [ ] CMRR visualization (dB scale)

**Expected Waveforms:**
- Differential signal amplified
- Common-mode signal rejected (CMRR > 80dB)

---

#### Lesson 3.4: Noise Analysis

**Interactive Elements:**
- [ ] Input: Op-amp en, in specs
- [ ] Input: Source impedance
- [ ] Slider: Bandwidth
- [ ] Calculate: Total noise (RSS)
- [ ] Spectrum plot: 1/f + white noise
- [ ] Bar chart: Noise budget

**Expected Calculations:**
```
Vn_total = √(en² + (in×Rs)² + 4kTRs) × √BW
```

---

### MODULE 4: Practical Skills (NEW - From Research)

#### Lesson 4.1: Oscilloscope Techniques

**Interactive Elements:**
- [ ] Virtual oscilloscope with controls
- [ ] Time/div, V/div sliders
- [ ] Trigger level/slope
- [ ] Probe compensation simulation

**Skills to Demonstrate:**
- Measuring rise time
- Identifying oscillation vs noise
- Proper probe grounding

---

#### Lesson 4.2: PCB Layout Awareness

**Interactive Elements:**
- [ ] Good vs bad layout comparison (visual)
- [ ] Ground plane visualization
- [ ] Trace length impact calculator
- [ ] Bypass cap placement game

**Common Mistakes Shown:**
- Digital traces crossing analog
- Long ground return paths
- Missing bypass caps

---

#### Lesson 4.3: Troubleshooting Workflow

**Interactive Elements:**
- [ ] Flowchart: Power → Bias → Signal → Load
- [ ] Symptom → Cause database
- [ ] "What would you probe first?" scenarios

**Scenarios:**
1. No output (check power, bias)
2. Oscillation (check compensation, layout)
3. Distortion (check headroom, slew)
4. DC offset (check Vos, Ib)

---

### MODULE 5: FET/MOSFET Fundamentals (NEW)

#### Lesson 5.1: MOSFET as Voltage-Controlled Device

**Interactive Elements:**
- [ ] Slider: VGS (0V to 5V)
- [ ] Slider: VDS (0V to 10V)
- [ ] Live plot: ID vs VGS (transfer characteristic)
- [ ] Live plot: ID vs VDS (output characteristic)
- [ ] Region indicator: Cutoff / Triode / Saturation

**Key Equations:**
```
Triode:    ID = µnCox(W/L)[(VGS-Vth)VDS - VDS²/2]
Saturation: ID = ½µnCox(W/L)(VGS-Vth)²
gm = 2ID/(VGS-Vth) = √(2µnCox(W/L)ID)
```

**SPICE Task:**
```
DC sweep VGS 0 to 5V, VDS = 5V (fixed)
Measure: Vth from transfer curve
Calculate: gm at operating point
```

**Expected Waveforms:**
- Transfer curve: quadratic in saturation
- Output curves: flat in saturation (with λ slope)

---

#### Lesson 5.2: MOSFET Operating Regions

**Interactive Elements:**
- [ ] 2D colormap: VGS vs VDS showing regions
- [ ] Slider: Move operating point
- [ ] Show: gm, ro, gain at each point

**Region Summary:**
| Region | Condition | Use |
|--------|-----------|-----|
| Cutoff | VGS < Vth | Off switch |
| Triode | VDS < VGS-Vth | Analog switch |
| Saturation | VDS > VGS-Vth | Amplifier |
| Weak Inversion | VGS ≈ Vth | Ultra-low power |

**Design Insight:**
- gm/ID methodology for optimal trade-offs
- Weak inversion: highest gm/ID (38 V⁻¹)
- Strong inversion: lower gm/ID, higher speed

---

#### Lesson 5.3: JFET Fundamentals

**Interactive Elements:**
- [ ] Slider: VGS (0V to -Vp)
- [ ] Live plot: ID vs VGS
- [ ] Show: IDSS, Vp, gm

**Comparison to MOSFET:**
- JFET: Depletion mode (normally ON)
- Lower noise, higher Zin
- Used in audio preamps, instrumentation

**SPICE Task:**
```
Sweep VGS from 0 to -4V
Identify: IDSS, Vp
Compare: 2N5457 vs 2N7000
```

---

#### Lesson 5.4: CMOS Analog Switch / Transmission Gate

**Interactive Elements:**
- [ ] Animation: NMOS + PMOS parallel operation
- [ ] Slider: Input voltage sweep
- [ ] Plot: Ron vs Vin (show flatness)
- [ ] Show: Charge injection on switch-off

**Key Concepts:**
- NMOS good for low voltages
- PMOS good for high voltages
- Together: relatively constant Ron

**Charge Injection Demo:**
- Toggle switch, show glitch on output
- Slider: Hold capacitor size
- Show: Smaller glitch with larger C (but slower)

---

### MODULE 6: Power Electronics Applications (NEW)

#### Lesson 6.1: Power MOSFET Selection

**Interactive Elements:**
- [ ] Selector: Application (Buck, Motor, LED)
- [ ] Sliders: Voltage, Current, Frequency
- [ ] Calculate: Conduction loss, Switching loss
- [ ] Show: RDS(on) vs Qg trade-off curves

**Key Trade-off:**
```
Low RDS(on) → More Qg → Slower switching → Higher switching loss
High Qg → More RDS(on) → Higher conduction loss
```

**Optimization:**
- High frequency: Optimize for low Qg
- Low frequency / DC: Optimize for low RDS(on)

---

#### Lesson 6.2: Buck Converter Basics

**Interactive Elements:**
- [ ] Slider: Duty cycle D (0-100%)
- [ ] Slider: Input voltage Vin
- [ ] Slider: Load current
- [ ] Live plot: Inductor current ripple
- [ ] Calculate: Vout = D × Vin

**Expected Waveforms:**
- Switch node: Square wave
- Inductor current: Triangle
- Output: DC with ripple

**SPICE Task:**
```
Build buck converter with ideal switch
Verify: Vout/Vin = D
Measure: Ripple current, ripple voltage
```

---

#### Lesson 6.3: LDO Regulator Design

**Interactive Elements:**
- [ ] Slider: Vin, Vout
- [ ] Slider: Load current
- [ ] Calculate: Dropout, Efficiency, Power dissipation
- [ ] Show: PSRR vs frequency plot

**Key Specs:**
| Parameter | Typical | Good |
|-----------|---------|------|
| Dropout | 200-500mV | <100mV |
| PSRR @1kHz | 60dB | 80dB |
| Noise | 50µVrms | 10µVrms |

**When to Use:**
- Vin ≈ Vout (high efficiency)
- Noise-sensitive loads (RF, audio)
- Space constrained (no inductor)

---

#### Lesson 6.4: PMIC Overview (Smartphones/Portable)

**Block Diagram Interactive:**
- [ ] Click blocks to explore each function
- [ ] Show: Power flow from battery to loads
- [ ] Animate: PowerPath switching

**Typical PMIC Functions:**
1. Buck converters (3-4 rails)
2. LDO regulators (5-12 rails)
3. Battery charger (CC/CV)
4. Power switches
5. Fuel gauge

**Design Trade-off Exercise:**
- Given power budget, allocate to Buck vs LDO
- Consider: Efficiency, noise, complexity

---

### MODULE 7: Audio Applications (NEW)

#### Lesson 7.1: Headphone Amplifier Design

**Interactive Elements:**
- [ ] Selector: Headphone impedance (16Ω to 600Ω)
- [ ] Slider: Target output power
- [ ] Calculate: Required current, voltage swing
- [ ] Op-amp selector with specs comparison

**Design Flow:**
1. Choose headphone → Required power
2. Calculate: Vpeak = √(2×P×Z), Ipeak = √(2×P/Z)
3. Select op-amp with adequate current drive
4. Design gain stage if needed

**SPICE Task:**
```
Build buffer with NJM4556
Drive 32Ω load
Measure: THD at 10mW, 50mW, 100mW
Identify: Clipping threshold
```

---

#### Lesson 7.2: Audio Preamplifier (Mic/Guitar)

**Interactive Elements:**
- [ ] Selector: Source type (electret, dynamic, guitar)
- [ ] Slider: Gain (20dB to 60dB)
- [ ] Calculate: Input Zin, noise floor
- [ ] Show: Frequency response

**Source Requirements:**
| Source | Level | Zin Needed |
|--------|-------|------------|
| Electret mic | 10-100mV | 10kΩ |
| Dynamic mic | 1-10mV | 1-10kΩ |
| Guitar pickup | 100mV | >1MΩ |

---

#### Lesson 7.3: Graphic Equalizer (3-Band)

**Interactive Elements:**
- [ ] 3 sliders: Bass, Mid, Treble (±12dB)
- [ ] Live Bode plot
- [ ] Audio preview (if browser audio API)

**Filter Design:**
- Bass: Shelving LP, fc = 100Hz
- Mid: Bandpass, fc = 1kHz, Q = 1
- Treble: Shelving HP, fc = 10kHz

**Component Selection:**
- Film capacitors only
- 1% resistors, matched
- Low-noise op-amp (NE5532, OPA2134)

---

#### Lesson 7.4: Class D Amplifier Concepts

**Interactive Elements:**
- [ ] Animation: PWM modulation from audio
- [ ] Slider: Carrier frequency
- [ ] Show: Spectrum of PWM output
- [ ] Calculate: Efficiency vs Class AB

**Key Concepts:**
- Transistors fully ON or OFF
- PWM encodes audio amplitude
- LC filter reconstructs audio
- 90%+ efficiency typical

---

### MODULE 8: Data Conversion Applications (NEW)

#### Lesson 8.1: SAR ADC Driver Design

**Interactive Elements:**
- [ ] Selector: ADC resolution (10/12/14/16 bit)
- [ ] Slider: Sample rate
- [ ] Calculate: Required Rext, Cext
- [ ] Show: Settling waveform with kickback

**Design Equations:**
```
tACQ ≥ k × Rext × Cext
k = 9 (10-bit), 10 (12-bit), 11 (14-bit)
```

**SPICE Task:**
```
Model SAR input as switched capacitor
Apply step input
Measure: Settling time to 0.5 LSB
Tune: Rext, Cext for adequate settling
```

---

#### Lesson 8.2: Delta-Sigma ADC Intuition

**Interactive Elements:**
- [ ] Animation: Noise shaping visualized
- [ ] Slider: Oversampling ratio
- [ ] Plot: Noise spectrum before/after shaping
- [ ] Calculate: Effective bits from OSR

**Key Insight:**
```
1st order: +9dB SNR per 2× OSR
2nd order: +15dB per 2× OSR
```

**Applications:**
- Audio (192kHz/24-bit)
- Precision sensors (load cells, strain)
- Temperature measurement

---

#### Lesson 8.3: DAC Reconstruction Filter

**Interactive Elements:**
- [ ] Slider: Sample rate
- [ ] Slider: Signal frequency
- [ ] Plot: Images at fs, 2fs, 3fs
- [ ] Filter design: Calculate cutoff

**Sinc Rolloff:**
- DAC output has sin(x)/x response
- -3.9dB at Nyquist
- Compensation options shown

---

#### Lesson 8.4: Voltage Reference Selection

**Interactive Elements:**
- [ ] Selector: ADC bits (10/12/14/16/18)
- [ ] Input: Temperature range
- [ ] Calculate: Required tempco, accuracy
- [ ] Reference part selector

**Error Budget Calculator:**
```
Total error = Initial + (Tempco × ΔT) + Hysteresis + Long-term
```

---

### MODULE 9: Design Trade-offs Workshop (NEW)

#### Lesson 9.1: The Trade-off Triangle

**Interactive Elements:**
- [ ] Draggable triangle: Performance-Power-Cost
- [ ] Examples of real parts at each extreme
- [ ] Quiz: Given specs, identify trade-offs

**Core Concept:**
> "You can optimize any two, the third suffers."

---

#### Lesson 9.2: Op-Amp Selection Decision Tree

**Interactive Flow:**
1. Primary constraint? (Power/Speed/Noise/Precision)
2. Secondary constraint?
3. Recommendations with specs

**Comparison Table (live):**
| Need | Family | Example | Trade-off |
|------|--------|---------|-----------|
| Low noise | Bipolar | OPA1612 | Higher Ib |
| High Zin | JFET | OPA2134 | More noise |
| Low power | CMOS | LPV811 | Slow |
| Precision | Chopper | OPA2182 | Artifacts |

---

#### Lesson 9.3: Component Selection for Precision

**Interactive Elements:**
- [ ] ADC resolution selector
- [ ] Calculate: Required resistor tolerance, tempco
- [ ] Show: Cost vs precision curve
- [ ] Recommend: Resistor/capacitor types

**Design Rule:**
```
For N-bit accuracy:
Max error = 1/(2^(N+1)) = 1 LSB/2
E.g., 12-bit: <0.012% total error budget
```

---

#### Lesson 9.4: Power Budget Optimization

**Interactive Elements:**
- [ ] Input: Total power budget
- [ ] Allocate: ADC, op-amps, reference
- [ ] Show: Trade-off (faster ADC → less for analog)
- [ ] Optimization suggestions

---

### MODULE 10: Output Stages & Complementary Circuits (NEW)

#### Lesson 10.1: Push-Pull Output Stages

**Interactive Elements:**
- [ ] Animation: NPN/PNP complementary pair operation
- [ ] Slider: Input signal amplitude
- [ ] Show: Crossover distortion (Class B)
- [ ] Slider: Bias current for Class AB

**Class B Problem:**
```
Dead zone: VBE(NPN) + VBE(PNP) ≈ 1.2V
Signal must exceed ±0.6V before output moves
Result: Crossover distortion at zero-crossing
```

**Class AB Solution:**
- Bias both transistors slightly ON at idle
- Small quiescent current (1-10mA typical)
- Diode biasing tracks with temperature

**SPICE Task:**
```
Build complementary pair with no bias (Class B)
Observe crossover distortion on sine output
Add diode bias network
Measure: Quiescent current vs distortion
```

**Expected Waveforms:**
- Class B: Visible flat spots at zero-crossing
- Class AB: Smooth sine, slight Iq shown

---

#### Lesson 10.2: CMOS Complementary Outputs

**Interactive Elements:**
- [ ] Animation: NMOS/PMOS inverter operation
- [ ] Slider: Input voltage sweep
- [ ] Show: Both transistors ON during transition
- [ ] Calculate: Shoot-through current, power dissipation

**Key Concepts:**
- PMOS pulls to VDD (strong HIGH)
- NMOS pulls to GND (strong LOW)
- Never both ON simultaneously (in ideal case)
- Short-circuit during transitions → dynamic power

**CMOS Inverter Transfer Curve:**
```
Vin = 0    → PMOS ON, NMOS OFF → Vout = VDD
Vin = VDD  → PMOS OFF, NMOS ON → Vout = 0
Vin = VDD/2 → Both partially ON → Transition region
```

---

#### Lesson 10.3: Open-Drain / Open-Collector Outputs

**Interactive Elements:**
- [ ] Circuit diagram: NMOS with no pull-up
- [ ] Slider: Pull-up resistor value
- [ ] Calculate: Rise time, fall time, power
- [ ] Show: Wired-AND bus behavior

**Why Open-Drain?**
1. Level shifting (drive different voltage)
2. Wired-AND (multiple outputs on one wire)
3. I2C, SMBus require it
4. Higher voltage/current drive

**Pull-Up Sizing:**
```
Rise time: tr ≈ 2.2 × Rpullup × Cload
Fall time: tf ≈ 2.2 × Ron × Cload
Power: P = Vdd²/(2×Rpullup) × duty_cycle

Trade-off:
- Smaller Rpullup → Faster rise, more power
- Larger Rpullup → Slower rise, less power
```

**SPICE Task:**
```
Build open-drain output with 10kΩ pull-up
Measure rise/fall times with 50pF load
Repeat with 1kΩ, 4.7kΩ, 47kΩ
Plot: Rise time vs Rpullup
```

---

#### Lesson 10.4: Current Sources and Sinks

**Interactive Elements:**
- [ ] Selector: Simple mirror, Cascode, Wilson
- [ ] Slider: Reference current
- [ ] Show: Output impedance comparison
- [ ] Show: Compliance range

**Current Mirror Types:**
| Type | Rout | Accuracy | Complexity |
|------|------|----------|------------|
| Simple | gm×ro | Moderate | 2 transistors |
| Cascode | (gm×ro)² | High | 4 transistors |
| Wilson | (gm×ro)² | High | 3 transistors |
| Wide-Swing | (gm×ro)² | High | 4 transistors |

**MOSFET Current Source:**
```
ID = ½µCox(W/L)(VGS-Vth)²
Rout ≈ ro = VA/ID
For better Rout → Cascode (stack transistors)
```

---

### MODULE 11: Oscillators & Timing Circuits (NEW)

#### Lesson 11.1: LC Oscillators (Colpitts, Hartley)

**Interactive Elements:**
- [ ] Selector: Colpitts vs Hartley
- [ ] Sliders: L, C1, C2 values
- [ ] Calculate: Oscillation frequency
- [ ] Show: Barkhausen criterion check

**Barkhausen Criterion:**
```
For oscillation:
1. Loop gain |Aβ| ≥ 1
2. Phase shift = 0° (or 360°)
```

**Colpitts Oscillator:**
```
Capacitive voltage divider: C1, C2
fosc = 1/(2π√(L×Ceq))
where Ceq = C1×C2/(C1+C2)
```

**Hartley Oscillator:**
```
Inductive voltage divider: L1, L2
fosc = 1/(2π√(Leq×C))
where Leq = L1 + L2 + 2M
```

**SPICE Task:**
```
Build Colpitts with L=100µH, C1=100pF, C2=100pF
Expected: fosc ≈ 2.25 MHz
Measure: Startup time, steady-state amplitude
```

---

#### Lesson 11.2: RC Oscillators (Wien Bridge)

**Interactive Elements:**
- [ ] Slider: R, C for frequency setting
- [ ] Slider: Gain (must be ≈3)
- [ ] Live plot: Waveform buildup
- [ ] Show: AGC stabilization

**Wien Bridge Basics:**
```
fosc = 1/(2πRC)
Required gain: Av = 3 (exactly)
If Av > 3: Amplitude grows → clipping
If Av < 3: Oscillation dies
```

**Amplitude Stabilization:**
- Lamp (positive tempco) in feedback
- Diode limiter
- AGC with rectifier + filter

**Historical Note:**
> HP's first product (Model 200A, 1939) was Bill Hewlett's
> Wien bridge oscillator, used in Disney's Fantasia production.

---

#### Lesson 11.3: Crystal Oscillators

**Interactive Elements:**
- [ ] Animation: Piezoelectric resonance
- [ ] Show: Crystal equivalent circuit (L, C, R, Cp)
- [ ] Plot: Impedance vs frequency (series/parallel resonance)
- [ ] Selector: Pierce, Colpitts crystal circuits

**Crystal Equivalent Circuit:**
```
        ┌───L───R───C───┐
IN ─────┤               ├───── OUT
        └──────Cp───────┘

fs (series) = 1/(2π√LC)
fp (parallel) = fs × √(1 + C/Cp)
```

**Why Crystals?**
- Q > 10,000 (vs ~100 for LC)
- Frequency stability: ±10-100 ppm
- Low phase noise
- Temperature compensation (TCXO): ±1 ppm

---

#### Lesson 11.4: 555 Timer Circuits

**Interactive Elements:**
- [ ] Selector: Astable vs Monostable
- [ ] Sliders: Ra, Rb, C
- [ ] Calculate: Frequency, duty cycle, pulse width
- [ ] Live waveform display

**Astable Mode:**
```
Tcharge = 0.693 × (Ra + Rb) × C
Tdischarge = 0.693 × Rb × C
f = 1.44 / ((Ra + 2Rb) × C)
Duty Cycle = (Ra + Rb) / (Ra + 2Rb) > 50%
```

**Monostable Mode:**
```
Pulse Width = 1.1 × R × C
Triggered by falling edge on pin 2
```

**SPICE Task:**
```
Build astable: Ra=10k, Rb=10k, C=100nF
Expected: f ≈ 480 Hz, duty ≈ 67%
Modify for 50% duty using diode trick
```

---

#### Lesson 11.5: Schmitt Triggers & Hysteresis

**Interactive Elements:**
- [ ] Slider: VUT (upper threshold)
- [ ] Slider: VLT (lower threshold)
- [ ] Input: Noisy signal
- [ ] Show: Clean output despite noise

**Hysteresis Purpose:**
```
Without hysteresis:
Noisy signal near threshold → Multiple transitions

With hysteresis:
Rising: Triggers at VUT
Falling: Triggers at VLT
Noise < (VUT - VLT) → No false triggers
```

**Op-Amp Schmitt Trigger:**
```
VUT = Vref × (1 + R1/R2)
VLT = Vref × (1 - R1/R2)
Hysteresis = VUT - VLT = 2 × Vref × R1/R2
```

**Applications:**
- Debouncing mechanical switches
- Cleaning up slow edges
- Square wave from sine (zero-crossing detector)
- Noise immunity on digital inputs

---

### MODULE 12: Digital Interface Electrical Design (NEW)

#### Lesson 12.1: CMOS Logic Families & Voltage Levels

**Interactive Elements:**
- [ ] Selector: Logic family (HC, HCT, LVC, LV)
- [ ] Input: Supply voltage
- [ ] Show: VIH, VIL, VOH, VOL thresholds
- [ ] Compatibility checker

**Logic Level Summary:**
| Family | VCC | VIL | VIH | VOL | VOH |
|--------|-----|-----|-----|-----|-----|
| 5V CMOS | 5V | 1.5V | 3.5V | 0.1V | 4.9V |
| 3.3V CMOS | 3.3V | 1.0V | 2.3V | 0.1V | 3.2V |
| 5V TTL | 5V | 0.8V | 2.0V | 0.4V | 2.4V |
| LVTTL | 3.3V | 0.8V | 2.0V | 0.4V | 2.4V |

**Key Insight:**
```
CMOS: Thresholds at 30% and 70% of VDD
TTL: Fixed thresholds (0.8V, 2.0V)
TTL-compatible CMOS (HCT): Uses TTL thresholds
```

---

#### Lesson 12.2: Level Shifting Techniques

**Interactive Elements:**
- [ ] Selector: 3.3V→5V, 5V→3.3V, Bidirectional
- [ ] Circuit options: Resistor, MOSFET, dedicated IC
- [ ] Calculate: Component values
- [ ] Show: Rise/fall time impact

**Step-Down (5V → 3.3V):**
1. **Resistor divider**: Simple but slow, wastes power
2. **Diode clamp**: Fast, needs current limiting
3. **Dedicated level shifter**: Clean, bidirectional possible
4. **Series resistor**: If 3.3V device is 5V-tolerant input

**Step-Up (3.3V → 5V):**
1. **MOSFET + pull-up**: Bidirectional, I2C compatible
2. **74HCT gate**: TTL thresholds accept 3.3V as HIGH
3. **Buffer IC**: TXS0108, SN74LVC1T45

**MOSFET Bidirectional Shifter:**
```
LV side (3.3V) ─┬─ 10k to 3.3V
                │
              ─┴─ BSS138 (Vth < 2V)
                │
HV side (5V)  ─┴─ 10k to 5V
```

---

#### Lesson 12.3: Pull-Up/Pull-Down Resistor Sizing

**Interactive Elements:**
- [ ] Input: Supply voltage, load capacitance
- [ ] Input: Required rise time
- [ ] Calculate: Resistor range (min/max)
- [ ] Show: Power consumption

**Design Equations:**
```
Rise time: tr ≈ 2.2 × R × C
Fall time: tf ≈ 2.2 × Ron × C (much faster)

Minimum R: Rmin = (VCC - VOL) / IOL_max
Maximum R: Rmax = VCC / (VIH_min / guaranteed_high)

Power: P = V² / R × duty_cycle
```

**I2C Pull-Up Example:**
```
Standard Mode (100 kHz): 4.7kΩ typical
Fast Mode (400 kHz): 2.2kΩ typical
Fast Mode Plus (1 MHz): 1kΩ with strong drivers

Constraint: I_sink < 3mA (standard) or 20mA (FM+)
Rmin = (VCC - 0.4V) / I_sink
```

---

#### Lesson 12.4: ESD Protection & Input Clamping

**Interactive Elements:**
- [ ] Show: Internal ESD diodes
- [ ] Slider: Overvoltage magnitude
- [ ] Calculate: Series resistor for current limiting
- [ ] Show: Clamping waveform

**Internal Protection Diodes:**
```
Most CMOS inputs have:
- Diode to VDD (ESD protection)
- Diode to GND (ESD protection)

If Vin > VDD + 0.3V → Upper diode conducts
If Vin < -0.3V → Lower diode conducts
```

**Series Resistor Sizing:**
```
Iclamp_max = 10mA typical (check datasheet)
R = (Vovershoot - VDD - Vdiode) / Iclamp_max
Example: (5V - 3.3V - 0.3V) / 10mA = 140Ω → use 220Ω
```

---

### MODULE 13: Communication Protocols - Electrical Level (NEW)

#### Lesson 13.1: I2C Electrical Design

**Interactive Elements:**
- [ ] Slider: Bus capacitance (devices + trace)
- [ ] Slider: Pull-up resistor value
- [ ] Calculate: Rise time, fall time
- [ ] Show: Waveform with margins

**I2C Specifications:**
| Parameter | Standard | Fast | Fast+ |
|-----------|----------|------|-------|
| Speed | 100 kHz | 400 kHz | 1 MHz |
| Max Cbus | 400 pF | 400 pF | 550 pF |
| Rise time | <1000ns | <300ns | <120ns |
| IOL sink | 3 mA | 3 mA | 20 mA |

**Pull-Up Calculation:**
```
Rp_min = (VDD - VOL) / IOL = (3.3V - 0.4V) / 3mA = 967Ω
Rp_max = tr / (0.847 × Cbus)  [for 0.3VDD to 0.7VDD]

Example: tr=300ns, Cbus=200pF
Rp_max = 300ns / (0.847 × 200pF) = 1.77kΩ

Practical choice: 1kΩ to 1.5kΩ for Fast Mode
```

**SPICE Task:**
```
Model I2C with 200pF bus capacitance
Try pull-ups: 1k, 2.2k, 4.7k, 10k
Measure rise times
Identify which meet Fast Mode spec
```

---

#### Lesson 13.2: SPI Electrical Design

**Interactive Elements:**
- [ ] Selector: Mode 0, 1, 2, 3 (CPOL/CPHA)
- [ ] Timing diagram animation
- [ ] Slider: Clock frequency
- [ ] Show: Setup/hold time margins

**SPI Modes:**
| Mode | CPOL | CPHA | Sample Edge | Shift Edge |
|------|------|------|-------------|------------|
| 0 | 0 | 0 | Rising | Falling |
| 1 | 0 | 1 | Falling | Rising |
| 2 | 1 | 0 | Falling | Rising |
| 3 | 1 | 1 | Rising | Falling |

**Electrical Considerations:**
- Push-pull outputs (not open-drain)
- Typical: 3.3V or 5V CMOS levels
- Clock frequency: 1-100+ MHz
- Series termination for long traces (>6 inches at 10MHz+)

**Timing Budget:**
```
tCLK = 1/fCLK
tsetup + thold < tCLK/2 - tprop

Example: 10 MHz SPI
tCLK = 100ns, half-period = 50ns
Trace propagation ~6ns/m
Max trace ≈ 1-2 meters (practical: much less)
```

---

#### Lesson 13.3: UART / RS-232 Electrical Design

**Interactive Elements:**
- [ ] Selector: TTL UART vs RS-232
- [ ] Show: Voltage level comparison
- [ ] Slider: Baud rate
- [ ] Calculate: Bit time, timing tolerance

**Voltage Level Comparison:**
| Signal | TTL/CMOS UART | RS-232 |
|--------|---------------|--------|
| Logic 1 (Mark) | VCC (3.3V/5V) | -3V to -15V |
| Logic 0 (Space) | 0V | +3V to +15V |
| Idle | HIGH | Negative (Mark) |

**Key Insight:**
> RS-232 is **inverted** relative to TTL!
> Use MAX232 or similar for voltage translation + inversion

**Baud Rate Timing:**
```
Bit time = 1 / Baud
9600 baud → 104.2 µs/bit
115200 baud → 8.68 µs/bit

Tolerance: ±3-5% typically
Error accumulates over 10-bit frame (start + 8 data + stop)
```

---

#### Lesson 13.4: USB Electrical Fundamentals

**Interactive Elements:**
- [ ] Show: D+/D- differential signaling
- [ ] Selector: Low/Full/High Speed
- [ ] Show: Pull-up configuration for each speed
- [ ] Impedance matching visualization

**USB Speed Detection:**
```
Low Speed (1.5 Mbps): 1.5kΩ pull-up on D-
Full Speed (12 Mbps): 1.5kΩ pull-up on D+
High Speed (480 Mbps): Starts as Full Speed, chirp sequence

Host has: 15kΩ pull-down on both D+ and D-
```

**Differential Signaling:**
```
Differential '1': D+ > 2.8V, D- < 0.3V
Differential '0': D- > 2.8V, D+ < 0.3V
SE0 (reset): Both D+ and D- < 0.3V
SE1 (invalid): Both D+ and D- > 2.8V
```

**Impedance:**
```
USB cable: 90Ω differential impedance
Trace matching critical above Full Speed
FS/LS: Less critical (slower edges)
HS: Requires careful layout (45Ω to ground each line)
```

---

### MODULE 14: Advanced Analog Blocks (NEW)

#### Lesson 14.1: Phase-Locked Loop (PLL) Basics

**Interactive Elements:**
- [ ] Block diagram: PFD → Charge Pump → LPF → VCO → Divider
- [ ] Slider: Reference frequency
- [ ] Slider: Division ratio (N)
- [ ] Calculate: Output frequency = N × fref
- [ ] Show: Lock acquisition animation

**PLL Components:**
```
fout = N × fref

Phase Detector: Compares fref to fvco/N
Charge Pump: Outputs current pulses (up/down)
Loop Filter: Integrates to clean VCO control voltage
VCO: Voltage-controlled oscillator
Divider: Divide-by-N counter
```

**Key Parameters:**
- Loop bandwidth: Trade-off between lock time and noise
- Phase noise: Jitter in time domain
- Lock time: Settling to target frequency

---

#### Lesson 14.2: Bandgap Voltage References

**Interactive Elements:**
- [ ] Show: PTAT + CTAT current combination
- [ ] Slider: Temperature sweep
- [ ] Plot: VBE (CTAT), ΔVBE (PTAT), sum (flat)
- [ ] Calculate: Resulting tempco

**Bandgap Principle:**
```
VBE: ~0.7V, tempco ≈ -2mV/°C (CTAT)
ΔVBE = VT × ln(N): tempco = +0.085mV/°C per 1× (PTAT)

VREF = VBE + K × ΔVBE
Choose K so tempcos cancel:
VREF ≈ 1.2V (silicon bandgap energy at 0K)
Tempco: <50 ppm/°C (first order)
        <10 ppm/°C (with curvature compensation)
```

**Applications:**
- ADC/DAC reference
- LDO internal reference
- Temperature sensors (using PTAT)
- Bias current generation

---

#### Lesson 14.3: Precision Analog Techniques

**Interactive Elements:**
- [ ] Selector: Chopper stabilization, auto-zero, correlated double sampling
- [ ] Animation: How offset is cancelled
- [ ] Show: Noise spectrum (chopper ripple)
- [ ] Trade-off: Precision vs bandwidth

**Chopper Amplifier:**
```
1. Chop input at fchop (modulate to AC)
2. Amplify (offset becomes DC, signal at fchop)
3. Chop output (demodulate signal to DC)
4. Filter (remove offset at fchop)

Result: Offset < 10µV, but bandwidth limited by fchop
```

**Auto-Zero:**
```
Phase 1: Short input, store offset on capacitor
Phase 2: Subtract stored offset from signal

Pros: Very low offset
Cons: Switching noise, kT/C noise on capacitor
```

---

### MODULE 15: Practice Problems (Increasing Complexity)

#### Problem Set 1: BJT Basics (Simple → Complex)

**Problem 1.1 (Simple):**
Given: 2N3904, VCC=12V, IC=1mA, β=200
Calculate: VBE, gm, re
*Answer: VBE≈0.7V, gm=40mS, re=25Ω*

**Problem 1.2 (Medium):**
Design: Common-emitter amplifier
Specs: Gain=20, IC=2mA, VCC=9V
Find: RC, RE, R1, R2
*Provide blank schematic, student fills in values*

**Problem 1.3 (Complex):**
Given: Differential pair with 1mA tail current
Problem: One transistor runs 10°C hotter
Calculate: Offset voltage and current imbalance
*Requires understanding VBE tempco*

---

#### Problem Set 2: Op-Amp Applications

**Problem 2.1 (Simple):**
Inverting amplifier: Rf=100k, R1=10k, Vin=0.5V
Calculate: Vout, input impedance
*Answer: Vout=-5V, Zin=10kΩ*

**Problem 2.2 (Medium):**
Design: 1kHz Sallen-Key lowpass, Butterworth, G=1
Given: C=10nF
Calculate: R values, verify with Bode plot sketch
*Requires filter tables*

**Problem 2.3 (Complex):**
Given: TIA with RF=1MΩ, photodiode Cpd=10pF, op-amp GBW=10MHz
Calculate: Required CF for stability (45° phase margin)
Verify: Bandwidth, noise gain peaking
*Requires noise gain analysis*

---

#### Problem Set 3: MOSFET Circuits

**Problem 3.1 (Simple):**
2N7000 switch: VGS=5V, ID=100mA
From datasheet: RDS(on) ≈ 5Ω
Calculate: Power dissipation in MOSFET

**Problem 3.2 (Medium):**
Design: CMOS analog switch for ±5V signals
Choose: Appropriate transmission gate
Calculate: Ron variation across signal range

**Problem 3.3 (Complex):**
Buck converter: Vin=12V, Vout=3.3V, Iout=2A, fsw=500kHz
Select: High-side MOSFET
Balance: RDS(on) vs Qg for minimum total loss
*Requires efficiency calculation*

---

#### Problem Set 4: Communication Interfaces

**Problem 4.1 (Simple):**
I2C bus: VDD=3.3V, Cbus=100pF
Calculate: Pull-up range for Fast Mode (400kHz)

**Problem 4.2 (Medium):**
Interface: 5V Arduino to 3.3V sensor (I2C)
Design: Level shifter using BSS138 MOSFETs
Calculate: Pull-up values for each side

**Problem 4.3 (Complex):**
USB Full Speed: Design D+/D- routing
Given: FR4 PCB, 4-layer stackup
Calculate: Trace width/spacing for 90Ω differential
*Requires transmission line concepts*

---

#### Problem Set 5: System Design Challenge

**Problem 5.1 (Integration):**
Design: Complete sensor interface
- Strain gauge bridge (5mV full scale)
- Instrumentation amp (G=200)
- 16-bit ADC interface
- I2C output to MCU

Requirements:
- Specify all component values
- Calculate error budget
- Choose appropriate parts
- Sketch complete schematic

**Problem 5.2 (Debugging):**
Given: Audio preamp schematic with hidden errors
- Op-amp rail not bypassed
- Wrong feedback polarity
- DC blocking cap too small
Find: All errors and explain fixes

**Problem 5.3 (Optimization):**
Given: Working 12-bit ADC front-end, 10mW power
Task: Reduce to 1mW while maintaining performance
Trade-offs: Document what performance is sacrificed

---

### Interactive Simulation Exercises

#### Exercise A: Virtual Lab - Build and Verify

**A.1: Voltage Divider Biasing**
```
Goal: Bias 2N3904 at IC=1mA
- Draw schematic in simulator
- Set VCC=12V
- Calculate R values
- Measure: VB, VE, VC, IC
- Compare to calculated values
```

**A.2: Active Filter Frequency Response**
```
Goal: 2nd order Butterworth LP at 1kHz
- Build Sallen-Key with calculated values
- Run AC analysis 10Hz to 100kHz
- Verify: -3dB at 1kHz
- Verify: -12dB at 2kHz (2× rolloff)
- Verify: -40dB at 10kHz
```

**A.3: Push-Pull Output Stage**
```
Goal: Demonstrate Class AB biasing
- Build complementary pair (no bias)
- Apply 1kHz sine, observe crossover distortion
- Add diode biasing
- Adjust for minimum distortion
- Measure: Quiescent current
```

---

#### Exercise B: Waveform Matching

For each lesson, interactive widget shows:
1. **Expected waveform** (calculated from theory)
2. **Your parameters** (adjustable sliders)
3. **Match indicator** (green when within tolerance)

Example: TIA Response
- Set RF, CF, Cpd
- Widget calculates expected step response
- Student adjusts until overshoot <10%
- Then verify in SPICE simulation

---

### Implementation Features (Technical)

**Interactive Widget Structure:**
```html
<div class="card interactive-lab">
  <h2>Lab: [Topic]</h2>

  <!-- Parameter Controls -->
  <div class="controls">
    <div class="slider-group">
      <label>RF</label>
      <input type="range" id="rf" min="3" max="7" step="0.1">
      <span id="rf-val">100k</span>
    </div>
    <!-- More sliders... -->
  </div>

  <!-- Visualization -->
  <div class="canvas-wrap">
    <canvas id="scope"></canvas>
    <canvas id="expected" class="overlay dashed"></canvas>
  </div>

  <!-- Calculations Display -->
  <div class="calculations">
    <span>Gain = <span id="gain-val">—</span></span>
    <span>BW = <span id="bw-val">—</span></span>
  </div>

  <!-- SPICE Netlist -->
  <details>
    <summary>SPICE Netlist</summary>
    <textarea id="netlist">...</textarea>
    <button onclick="copyNetlist()">Copy</button>
  </details>

  <!-- Verification Checklist -->
  <div class="checklist">
    <label><input type="checkbox" data-save="1">
      Simulated and matched expected gain</label>
    <label><input type="checkbox" data-save="1">
      Verified phase at cutoff frequency</label>
  </div>
</div>
```

**Animation Engine:**
```javascript
// Continuous animation loop
const AD_Animate = {
  running: false,

  start(renderFn) {
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      renderFn();
      requestAnimationFrame(loop);
    };
    loop();
  },

  stop() {
    this.running = false;
  }
};

// Slider with live update
function bindSlider(id, callback) {
  const el = document.getElementById(id);
  el.addEventListener('input', () => {
    const val = AD.parseLogSlider(el.value);
    document.getElementById(id+'-val').textContent = AD.fmt(val);
    callback(val);
  });
}
```

---

## FET/MOSFET Research

### MOSFET Transconductance (gm)

**Definition**: gm = ∂ID/∂VGS (change in drain current per change in gate voltage)

**Key Formulas:**
```
gm = 2·ID/(VGS - Vth)     [Strong inversion]
gm = ID/VT                 [Weak inversion, VT ≈ 26mV]

Overdrive voltage: VOV = VGS - Vth
```

**gm/ID Design Methodology** (Jespers):
- gm/ID is a "quality factor" - how much transconductance per unit bias current
- Higher gm/ID → more efficient use of current
- Strong inversion: gm/ID ≈ 2/VOV (lower)
- Weak inversion: gm/ID ≈ 1/VT ≈ 38 V⁻¹ (maximum)

**Intrinsic Gain**: gm × ro ≈ 5-10 for modern processes

### MOSFET Regions of Operation

| Region | Condition | Behavior | Analog Use |
|--------|-----------|----------|------------|
| **Cutoff** | VGS < Vth | No current | Off switch |
| **Triode/Linear** | VGS > Vth, VDS < VOV | Voltage-controlled resistor | Analog switch |
| **Saturation** | VGS > Vth, VDS > VOV | Current source (ID ≈ f(VGS)) | Amplifiers |
| **Weak Inversion** | VGS ≈ Vth, IC < 0.1 | Exponential (like BJT) | Ultra-low power |

**Inversion Coefficient (IC):**
- IC > 10: Strong inversion
- 0.1 < IC < 10: Moderate inversion
- IC < 0.1: Weak inversion
- IC < 0.01: Subthreshold

### JFET vs MOSFET Comparison

| Feature | JFET | MOSFET |
|---------|------|--------|
| **Noise** | Lower (better for audio) | Higher |
| **Input Z** | Very high | Even higher |
| **Mode** | Depletion only | Depletion or Enhancement |
| **ESD** | More robust | Sensitive (gate oxide) |
| **Power handling** | Limited | Excellent |
| **Switching speed** | Slower | Faster |
| **Availability** | Shrinking | Abundant |

**When to Use JFET:**
- Low-noise audio preamplifiers
- High-impedance buffers
- Voltage-controlled resistors
- Instrumentation front-ends

**When to Use MOSFET:**
- Power electronics (converters, inverters)
- Digital switching (CMOS)
- High-current applications
- Motor/LED drivers
- RF amplifiers

### Key Insight for Intuition
> "Neither MOSFETs nor JFETs are used often in simple amplifier circuits compared to BJTs due to lower transconductance. The exception is when very high input impedance and low current draw are needed."

### Sources (FET Research)
- [MOSFET Transconductance - Olukey](https://www.olukey.com/understanding-mosfet-transconductance-essential-parameters-for-electronic-design/)
- [Small-Signal MOSFET Models - AllAboutCircuits](https://www.allaboutcircuits.com/technical-articles/small-signal-mosfet-models-for-analog-ic-design/)
- [JFET vs MOSFET - InterFET](https://www.interfet.com/jfet-application-notes/jfet-transistor-vs-mosfet/)
- [MOSFET Regions - CircuitBread](https://www.circuitbread.com/tutorials/what-are-the-different-regions-of-operation-for-a-fet)
- [Subthreshold Operation - MIT OCW](https://ocw.mit.edu/courses/6-012-microelectronic-devices-and-circuits-fall-2009/)

---

## Power MOSFET Research (VRM/Computing)

### Gate Drive Fundamentals

**VGS and RDS(on) Relationship:**
- Higher VGS → Lower RDS(on) → Lower conduction loss
- Higher temperature → Higher RDS(on)
- Typical drive: 10V for standard, 4.5V for logic-level MOSFETs

**Logic Level vs Standard Level:**
| Type | VGS Drive | Gate Oxide | Max VGS |
|------|-----------|------------|---------|
| Standard | 10V | Thicker | 20V |
| Logic Level | 4.5-5V | Thinner | 12V |

### Switching Losses vs Conduction Losses

**Trade-off:**
- Lower RDS(on) → More gate charge (Qg) → Slower switching
- High frequency → Switching losses dominate → Optimize for Qg
- Low frequency → Conduction losses dominate → Optimize for RDS(on)

**VRM Optimization:**
- High-side MOSFET: Lower VGS to minimize switching losses
- Low-side (sync rectifier): Higher VGS to minimize conduction losses
- Typical RG external: 0-2.2Ω

**Efficiency Example:**
- At 200kHz, VGS=9V vs 5V: +1.7% efficiency at 20A
- But at <7A: VGS=9V is WORSE than 5V

### Motherboard VRM Architecture
```
12V Input → [High-side FET] → Inductor → [Low-side FET] → CPU
                  ↑                            ↑
            Gate Driver ← PWM Controller
```

### Sources (Power MOSFET)
- [ST AN4192: Power MOSFETs for VRM](https://www.st.com/resource/en/application_note/an4192-power-mosfets-best-choice-guide-for-vrm-application-stmicroelectronics.pdf)
- [TI: Gate Driver Bias Optimization](https://www.ti.com/lit/pdf/slua958)
- [Toshiba: MOSFET Gate Drive Application Note](https://toshiba.semicon-storage.com/info/docget.jsp?did=59460)

---

## CMOS Analog Switch Research

### Transmission Gate (TG) Basics

**Structure:** NMOS + PMOS in parallel
- NMOS: Good for low voltages (VGS high when Vin low)
- PMOS: Good for high voltages (VGS high when Vin high)
- Together: Relatively constant Ron across input range

**Advantages:**
- Lower Ron than single transistor
- Larger dynamic range
- Feedthrough partially canceled

**Disadvantages:**
- Requires complementary clock
- More area

### Charge Injection Problem

**Mechanism:**
1. Gate-drain capacitance (Cgd) stores charge when switch ON
2. When switch turns OFF, charge "injected" onto output
3. Causes voltage glitch on held capacitor

**Key Insight:**
> "Lower on-resistance leads to MORE charge injection (larger transistors = larger Cgd)"

**Impact on S/H Circuits:**
- Voltage error on held sample
- Nonlinearity (signal-dependent)
- Limits ADC accuracy

### Charge Injection Cancellation Techniques

1. **Complementary TG**: NMOS and PMOS inject opposite polarity
2. **Dummy transistor**: Half-size device absorbs charge
3. **Differential signaling**: Common-mode injection cancels
4. **Bootstrapped switch**: Constant VGS regardless of signal
5. **Slow switching**: Reduces di/dt

**Design Trade-off:**
- Small switch → Less charge injection, Higher Ron
- Large switch → More charge injection, Lower Ron

### Sources (Analog Switch)
- [Analog Devices: Switches and Multiplexers](https://www.analog.com/en/analog-dialogue/articles/ask-the-applications-engineer-26.html)
- [Charge Injection in Analog MOS Switches](https://www.researchgate.net/publication/2982027_Charge_Injection_in_Analog_MOS_Switches)

---

## Smartphone PMIC Research

### PMIC Architecture

**Key Blocks:**
1. **Buck converters**: Step down battery (3.7-4.2V) to core voltages (0.8-1.8V)
2. **LDO regulators**: Low noise for sensitive circuits (VCO, RF, audio)
3. **Battery charger**: CC/CV charging, PowerPath control
4. **Boost converter**: LED backlight, flash
5. **Load switches**: On/off control with soft-start
6. **Fuel gauge**: Battery state-of-charge
7. **GPIOs**: System control

### Buck vs LDO Trade-offs

| Parameter | Buck | LDO |
|-----------|------|-----|
| **Efficiency** | 85-95% | Vout/Vin (can be <50%) |
| **Noise** | Switching ripple | Very low |
| **Size** | Needs inductor | No inductor |
| **Complexity** | Higher | Simple |
| **PSRR** | Moderate | Excellent |
| **Cost** | Higher | Lower |

**Rule of Thumb:**
- Buck: When Vout << Vin (efficiency matters)
- LDO: When Vout ≈ Vin, or noise-sensitive load

### Why 5-12 LDOs in a Phone?

1. **Noise isolation**: Each sensitive block gets its own LDO
2. **PSRR**: Prevents noise coupling between circuits
3. **Sequencing**: Independent enable control
4. **Voltage accuracy**: Each optimized for its load

### Example PMIC (MAX20345)
- Linear battery charger
- Smart power selector (USB/wall/battery)
- 3× ultra-low Iq buck regulators
- 1× buck-boost regulator
- 3× LDO regulators
- 2× load switches
- 5× GPIO

### PowerPath Control
- Seamlessly switches between USB, wall adapter, battery
- Prioritizes system load over charging
- Manages power flow for optimal efficiency

### Sources (PMIC)
- [Analog Devices: Selecting Power Management for Cellular](https://www.analog.com/en/resources/technical-articles/selecting-power-management-for-cellular-handsets.html)
- [FPT: Comprehensive Guide to PMIC](https://fpt-semiconductor.com/blogs/a-comprehensive-guide-to-power-management-integrated-circuit-pmic/)

---

## Audio Circuit Applications Research

### Headphone Amplifier Design

**Key Requirements:**
- Low distortion (THD < 0.01%)
- Low output impedance (< 1Ω for damping)
- Adequate current drive (15-50mA peak)
- Low noise floor

**Common Topologies:**
1. **Op-Amp Buffer**: Simple, uses high-current op-amp (NJM4556, OPA2134)
2. **Op-Amp + Transistor Output**: Better current drive, lower distortion
3. **Diamond Buffer**: Class AB output stage, very low distortion

**Load Considerations:**
| Headphone Type | Impedance | Typical Power | Current Needed |
|----------------|-----------|---------------|----------------|
| IEMs | 16-32Ω | 1-5mW | 10-20mA |
| Dynamic (portable) | 32-80Ω | 5-50mW | 20-40mA |
| Dynamic (hi-fi) | 250-600Ω | 10-100mW | 10-15mA |

**Op-Amp Selection for Audio:**
| Op-Amp | Noise (nV/√Hz) | THD | Notes |
|--------|----------------|-----|-------|
| NE5532 | 5 | 0.0005% | Classic, high current |
| TL072 | 18 | 0.003% | JFET input, low Ib |
| OPA2134 | 8 | 0.00008% | Very low distortion |
| LM4562 | 2.7 | 0.00003% | Ultra-low noise |
| OPA627 | 4.5 | 0.00003% | Premium, mellow sound |

### Audio Preamplifier Design

**Microphone Preamp Requirements:**
- High gain (40-60dB typical)
- Low noise (for weak mic signals)
- Phantom power support (48V)
- Wide dynamic range

**Guitar Preamp Requirements:**
- High input impedance (>1MΩ)
- JFET input preferred
- Minimal loading of pickups

**Common Configurations:**
- Non-inverting: G = 1 + Rf/R1 (high Zin)
- Single-supply with Vbias = Vcc/2
- Coupling capacitors for AC signals

### Audio Equalizer Design

**Equalizer Types:**
1. **Graphic EQ**: Fixed frequency bands, ±12-15dB boost/cut
2. **Parametric EQ**: Adjustable frequency, Q, and gain
3. **Shelving EQ**: Bass/treble with shelf response

**State Variable Filter for Parametric EQ:**
- Center frequency tunable
- Q factor adjustable independently
- Simultaneous LP/HP/BP outputs
- Noisier than simpler topologies

**Typical 3-Band Graphic EQ:**
| Band | Center Freq | Type |
|------|-------------|------|
| Bass | 100Hz | Low shelf or LP |
| Mid | 1kHz | Bandpass peak |
| Treble | 10kHz | High shelf or HP |

**Component Selection:**
- **Capacitors**: Film only (no ceramic, no electrolytic in signal path)
- **Resistors**: 1% metal film, matched for symmetry
- **Op-Amps**: NE5532, TL072, LM4562

### Class D Audio Amplifiers

**Operating Principle:**
1. Audio signal compared to triangle/sawtooth wave
2. Generates PWM output
3. Output transistors switch fully ON/OFF
4. LC low-pass filter reconstructs audio

**Key Advantage: Efficiency**
| Amplifier Class | Theoretical Efficiency | Typical Real |
|-----------------|------------------------|--------------|
| Class A | 50% max | 10-25% |
| Class AB | 78% max | 40-60% |
| Class D | 100% theoretical | 85-95% |

**PWM Modulation:**
- Natural sampling preferred over uniform sampling
- Carrier frequency: 200kHz-2MHz (well above audio)
- NOT digital despite switching appearance
- Pulse width is analog representation of signal

**Design Challenges:**
- Dead time: Both transistors OFF briefly during transitions
- EMI: Fast switching creates RF interference
- Output filter: LC required unless filterless topology

**Modern Class D Features:**
- Filterless outputs (for short speaker cables)
- Closed-loop feedback from output
- Excellent PSRR through feedback
- Integrated gate drivers

### Audio Codec ICs

**Typical Integrated Features:**
- Stereo ADC (microphone input)
- Stereo DAC (headphone/speaker output)
- Programmable gain amplifiers (PGA)
- Headphone driver (16-32Ω direct drive)
- Class D speaker driver
- Microphone bias (for electret mics)
- I2S digital interface

**Performance Specs (Typical Modern Codec):**
| Parameter | ADC | DAC |
|-----------|-----|-----|
| Resolution | 24-bit | 24-bit |
| Sample Rate | 8-96kHz | 8-96kHz |
| SNR | 97dB | 100-110dB |
| THD+N | -85dB | -90dB |
| Power | 2-10mW | 2-40mW (headphone) |

**Example Parts:**
- WM8960: Popular for embedded (SparkFun breakout)
- PCM2912: USB audio codec
- DA7217: Ultra-low power for wearables

### Audio Specifications Explained

**SNR (Signal-to-Noise Ratio):**
- Ratio of signal power to noise power (dB)
- Higher is better (95dB excellent, 60dB poor)
- For ADC: Theoretical max = 6.02N + 1.76 dB (N = bits)

**THD (Total Harmonic Distortion):**
- Power in harmonics vs fundamental
- Expressed as % or dB (negative)
- <0.01% considered "hi-fi"

**THD+N (THD plus Noise):**
- Most practical measurement
- Includes all impairments
- Easier to measure than separate THD/SNR

**SINAD (Signal-to-Noise-and-Distortion):**
- RSS sum of THD and noise
- Determines ENOB for ADCs
- ENOB = (SINAD - 1.76) / 6.02

**Dynamic Range:**
- Max signal to noise floor
- Often different from SNR (which uses typical signal)

### Noise Sources in Audio Circuits

1. **Op-amp voltage noise (en)**: Dominant with low Rsource
2. **Op-amp current noise (in)**: Dominant with high Rsource
3. **Resistor thermal noise**: √(4kTR×BW)
4. **1/f noise**: Increases at low frequencies (pink noise)

**Noise Peaking:**
- Many op-amps show noise increase near unity-gain frequency
- Can be 50-200% above baseline
- Limit bandwidth to reduce integrated noise

### Sources (Audio Research)
- [Sound-au: Audio Designs with Op-Amps](https://sound-au.com/dwopa.htm)
- [EDN: HiFi Headphone Amplifier](https://www.edn.com/hifi-headphone-amplifier/)
- [Analog Devices: Class D Fundamentals](https://www.analog.com/en/resources/technical-articles/fundamentals-of-class-d-amplifiers.html)
- [TI: Current-to-Voltage for Audio DACs](https://www.ti.com/lit/an/sbaa333a/sbaa333a.pdf)
- [Sound-au: Active Filters](https://sound-au.com/articles/active-filters.htm)
- [TI: Class D Amplifier Technology Study](https://e2e.ti.com/cfs-file/__key/communityserver-discussions-components-files/6/A-comprehensive-study-of-class-D-amplifier-technology.pdf)

---

## ADC/DAC Real-World Applications Research

### SAR ADC Driver Design

**Front-End Architecture:**
```
Signal → Op-Amp Buffer → Rext → ──┬── ADC Input
                                  │
                                 Cext
                                  │
                                 GND
```

**Key Components:**
1. **Driving amplifier**: Buffer or gain stage
2. **RC filter**: Rext + Cext for stability and kickback

**Settling Time Requirements:**
- Op-amp must settle to < 0.5 LSB within acquisition time
- For 1 MSPS: ~100ns settling to 0.01%
- Higher resolution → tighter settling requirement

**RC Filter Design:**
- Rext: Keeps amplifier stable driving capacitive load
- Cext: Absorbs charge kickback from ADC sampling
- Rule: tACQ ≥ k × Rext × Cext
  - k = 11 for 14-bit
  - k = 10 for 12-bit
  - k = 9 for 10-bit

**Kickback Effect:**
- SAR ADC has internal capacitive DAC
- When sampling starts, charge redistributes
- Creates "kickback" transient on input
- RC filter absorbs this kickback

**Op-Amp Requirements:**
| Parameter | Requirement | Why |
|-----------|-------------|-----|
| Bandwidth | >> sample rate | Fast settling |
| Slew Rate | High | Large signal settling |
| Output Impedance | Low | Drive capacitive load |
| Noise | Low | Don't degrade ADC SNR |
| Offset | Low | DC accuracy |

### Delta-Sigma ADC Fundamentals

**Operating Principle:**
1. Oversample input at fs >> 2×fNyquist
2. Use 1-bit quantizer (simple comparator)
3. Noise shaping via integrator feedback
4. Digital decimation filter averages result

**Key Advantage: Noise Shaping**
- Integrator acts as lowpass for signal
- Integrator acts as highpass for quantization noise
- Most noise pushed above signal band
- Digital filter removes high-frequency noise

**SNR Improvement:**
- Oversampling alone: +3dB per 2× rate
- With noise shaping: +9dB per 2× rate (1st order)
- Higher order modulators → even more improvement

**Typical Specifications:**
| Parameter | SAR ADC | Delta-Sigma ADC |
|-----------|---------|-----------------|
| Resolution | 8-18 bit | 16-24 bit |
| Speed | 10ksps - 10Msps | 10sps - 1Msps |
| Latency | 1 sample | Many samples |
| Applications | General purpose | Precision, audio |

**Applications:**
- Precision measurement (strain, temperature)
- Audio (24-bit/192kHz)
- Industrial sensors (load cells, RTDs)
- Medical instrumentation

### DAC Reconstruction Filters

**Purpose:**
- Remove images at fs, 2fs, 3fs, etc.
- Smooth staircase output
- Reconstruct continuous analog signal

**Zero-Order Hold Effect:**
- DAC holds each sample for 1/fs seconds
- Creates sin(x)/x (sinc) rolloff
- -3.9dB at Nyquist frequency

**Sinc Compensation Options:**
1. Digital pre-emphasis filter
2. Analog post-equalizer (inverse sinc)
3. Oversample DAC (reduces effect)

**Filter Types:**
| Type | Pros | Cons |
|------|------|------|
| RC (1st order) | Simple | Poor rolloff |
| LC (passive) | No power | Component tolerance |
| Active (Sallen-Key) | Tuneable | Op-amp limitations |
| Elliptic | Best rolloff | Complex |

**Oversampling Benefit:**
- 8× oversampling moves images to 8×fs
- Simple RC filter sufficient
- Used in modern audio DACs

### Voltage Reference Design

**Reference Error Sources:**
1. **Initial accuracy**: ±0.1% to ±1%
2. **Temperature drift**: ppm/°C
3. **Long-term drift**: ppm/√kHr
4. **Thermal hysteresis**: ppm
5. **Noise**: µVp-p

**Temperature Drift Classes:**
| Class | Drift | Applications |
|-------|-------|--------------|
| Premium | <5 ppm/°C | Metrology, 18+ bit |
| Good | 5-25 ppm/°C | 14-16 bit systems |
| Standard | 25-100 ppm/°C | 10-12 bit systems |

**Error Budget Example:**
```
Initial accuracy:       1000 ppm (0.1%)
Temp drift (-40 to 85°C): 25 ppm/°C × 125°C = 3125 ppm
Thermal hysteresis:      200 ppm
Long-term (1000 hrs):    50 ppm
Total uncertainty:       ~4400 ppm
```

**High-Performance References:**
| Part | Initial | Drift | Notes |
|------|---------|-------|-------|
| LTZ1000 | 0.05% | 0.05 ppm/°C | Lab-grade |
| ADR45xx | 0.02% | 2 ppm/°C | Production |
| REF5050 | 0.05% | 3 ppm/°C | Industrial |

**Effect on ADC Performance:**
- Offset drift: Shifts entire transfer function
- Gain drift: Rotates transfer function about zero
- Noise: Adds directly to ADC noise floor

### Sample-and-Hold Circuits

**Basic Operation:**
1. **Track mode**: Output follows input
2. **Hold mode**: Output maintains sampled value

**Key Specifications:**
| Parameter | Description |
|-----------|-------------|
| Acquisition time | Time to reach accuracy after track |
| Hold mode settling | Time to stabilize in hold |
| Droop rate | Output decay during hold (pA leakage) |
| Charge injection | Error from switch turn-off |
| Aperture jitter | Uncertainty in sample instant |

**Charge Injection Problem:**
- Switch has parasitic capacitance (Cgd)
- When turning off, charge dumps to hold cap
- Creates voltage error: ΔV = Qch/CH

**Charge Injection Mitigation:**
1. **Larger hold capacitor**: ΔV = Q/C (but slower)
2. **Dummy switch**: Half-size device absorbs charge
3. **Differential design**: Cancel common-mode injection
4. **Bottom-plate sampling**: Inject to less sensitive node
5. **Bootstrapped switch**: Constant VGS reduces variation

**Architectures:**
- **Open-loop**: Fast but less accurate
- **Closed-loop**: Op-amp feedback improves linearity
- **Flip-around**: Share capacitor for input/feedback

**Trade-off Triangle:**
```
      Speed
       /\
      /  \
     /    \
Accuracy──Power
```
Can optimize any two, third suffers.

### ADC Interface Best Practices

**Before the ADC:**
1. Antialiasing filter (fc < fs/2)
2. Buffer amplifier (low Zout)
3. RC filter for kickback
4. ESD protection (leakage matters!)

**Reference Supply:**
1. Low-noise LDO or dedicated reference
2. Bypass caps close to ADC pins
3. Keep ref traces away from digital

**Digital Interface:**
1. Minimize coupling to analog section
2. Use separate ground planes if possible
3. Single-point connection of grounds

### Sources (ADC/DAC Research)
- [Analog Devices: Front-End Amp and RC Filter Design](https://www.analog.com/en/resources/analog-dialogue/articles/front-end-amp-and-rc-filter-design.html)
- [DigiKey: Tackling SAR ADC Input Driving Issues](https://www.digikey.com/en/articles/analog-basics-part-5-tackling-difficult-input-driving-issues-for-the-sar-adc)
- [Analog Devices: Behind the Sigma-Delta ADC Topology](https://www.analog.com/en/resources/technical-articles/behind-the-sigma-delta-adc-topology.html)
- [Analog Devices: How to Choose a Voltage Reference](https://www.analog.com/en/technical-articles/how-to-choose-a-voltage-reference.html)
- [TI: Voltage Reference Selection and Design Tips](https://www.ti.com/lit/pdf/snaa320)
- [TI: LF398 Sample-and-Hold Application Note](https://www.ti.com/lit/SNOA223)

---

## Analog Design Trade-offs Research

### The Fundamental Trade-off Triangle

```
         Performance
            /\
           /  \
          /    \
     Power ───── Cost
```

**Key Insight**: You can optimize any two parameters, but the third will suffer. This applies at every level: transistor, circuit, system.

### Speed vs Power vs Accuracy

**For ADCs:**
| Priority | Trade-off | Example |
|----------|-----------|---------|
| Speed + Power | Accuracy suffers | Flash ADC (fast, power-hungry, 6-8 bit) |
| Speed + Accuracy | Power suffers | Pipelined ADC |
| Accuracy + Power | Speed suffers | Delta-Sigma (slow, low power, 24-bit) |

**For Op-Amps:**
| Priority | Trade-off | Example |
|----------|-----------|---------|
| Speed (high GBW) | Higher power, more noise | OPA657 (1.6GHz, 35mA) |
| Low Power | Lower bandwidth, more noise | LPV811 (450nA, 8kHz) |
| Low Noise | Higher power | OPA1612 (1.1nV/√Hz, 3.6mA) |
| Precision (low Vos) | Slower, chopper artifacts | OPA2182 (5µV, chopper) |

### Bandwidth vs Noise Trade-off

**Integrated Noise**: Vn_total = vn × √BW

- Wider bandwidth → More integrated noise
- To halve noise → Quarter the bandwidth
- Solution: Match bandwidth to signal, no more

**Noise Peaking**:
- Many op-amps show 50-200% noise increase near unity-gain
- Limit closed-loop bandwidth below this peak
- Trade: Reduced speed for lower noise

### Gain vs Bandwidth Trade-off

**Constant GBW Product**:
```
BW_closed-loop = GBW / Gain
```

| Gain | Bandwidth (10MHz GBW) |
|------|----------------------|
| 1 | 10 MHz |
| 10 | 1 MHz |
| 100 | 100 kHz |
| 1000 | 10 kHz |

**Multi-stage Alternative**:
- Instead of 1 stage at G=100 (100kHz BW)
- Use 2 stages at G=10 each (1MHz BW each)
- But: Adds noise, offset, complexity

### Power vs Slew Rate Trade-off

**Slew Rate Limit**: SR = 2π × f × Vpeak

| Output | Frequency | Required SR |
|--------|-----------|-------------|
| 1V pk | 1 MHz | 6.28 V/µs |
| 10V pk | 100 kHz | 6.28 V/µs |
| 10V pk | 1 MHz | 62.8 V/µs |

**Power Connection**:
- Higher SR → Higher bias current → More power
- Low-power op-amps often have SR < 1 V/µs
- High-speed op-amps: SR > 1000 V/µs at 20+ mA

### Precision vs Speed Trade-off

**Chopper/Auto-Zero Amplifiers**:
- Offset: <5µV (vs 1mV typical)
- Trade-off: Chopper artifacts, limited bandwidth
- Typical: 10kHz-1MHz usable bandwidth

**Settling Time for Precision**:
- 12-bit: Settle to 0.024% (1/4096)
- 16-bit: Settle to 0.0015% (1/65536)
- More bits → More settling time needed

### Component Trade-offs

**Resistors:**
| Type | Tolerance | Tempco | Cost | Use Case |
|------|-----------|--------|------|----------|
| Carbon | 5-10% | 5000 ppm/°C | $ | Non-critical |
| Thick Film | 1-5% | 100-200 ppm/°C | $ | General |
| Thin Film | 0.1-1% | 25-50 ppm/°C | $$ | Precision |
| Wirewound | 0.01-0.1% | 5-20 ppm/°C | $$$ | Metrology |

**Capacitors:**
| Type | Tolerance | Tempco | Use Case |
|------|-----------|--------|----------|
| X7R Ceramic | 10-20% | ±15% over temp | Bypass, non-critical |
| C0G/NP0 | 1-5% | ±30 ppm/°C | Precision filters |
| Film (PP, PET) | 1-5% | 100-200 ppm/°C | Audio, timing |
| Electrolytic | -20/+80% | Poor | Bulk only |

**Key Insight**: For 12-bit accuracy, need <120ppm total error. A 100ppm/°C resistor drifts >1 LSB with just 1.2°C change!

### Op-Amp Architecture Trade-offs

**Input Stage:**
| Type | Ib | Vos | Noise | Best For |
|------|-----|-----|-------|----------|
| BJT | 100nA-1µA | 0.1-1mV | Low | Low noise |
| JFET | 10-100pA | 1-5mV | Medium | High Zin |
| CMOS | <1pA | 1-10mV | Higher | Ultra-low Ib |
| Chopper | <1pA | <10µV | Chopper ripple | Precision DC |

**Output Stage:**
| Type | Current | Efficiency | Use Case |
|------|---------|------------|----------|
| Class A | Limited | ~25% | Low distortion |
| Class AB | High | ~60% | General purpose |
| Rail-to-Rail | Moderate | ~50% | Low voltage |

### MOSFET Trade-offs (Power)

**RDS(on) vs Gate Charge:**
```
Lower RDS(on) → More gate charge → Slower switching
```

| Application | Optimize For | Trade-off |
|-------------|--------------|-----------|
| High frequency (>500kHz) | Low Qg | Accept higher RDS(on) |
| Low frequency (<100kHz) | Low RDS(on) | Accept higher Qg |
| High current DC | Lowest RDS(on) | Ignore switching |

**Total Loss**: Ptotal = Pconduction + Pswitching
- Pconduction = I²RDS(on)
- Pswitching = ½ × VDS × ID × (tr + tf) × fsw

### Filter Trade-offs

**Filter Type Selection:**
| Type | Passband | Rolloff | Phase | Step Response |
|------|----------|---------|-------|---------------|
| Butterworth | Maximally flat | Moderate | Nonlinear | Some overshoot |
| Chebyshev | Ripple | Steepest | Worse | More overshoot |
| Bessel | Gentle rolloff | Slowest | Linear | No overshoot |

**Order Trade-off:**
- Higher order → Sharper cutoff
- But: More components, more noise, tighter tolerances needed

### Practical Decision Framework

**Step 1: Identify Primary Constraint**
- Battery: Optimize power first
- Precision sensor: Optimize accuracy first
- Real-time control: Optimize speed first

**Step 2: Determine Acceptable Trade-offs**
| If Primary Is | Sacrifice | Typical Trade |
|---------------|-----------|---------------|
| Low Power | Speed, sometimes noise | 10× power → 10× bandwidth |
| High Speed | Power, sometimes accuracy | 2× speed → 4× power |
| High Precision | Speed, power | Each bit → 4× settling time |

**Step 3: Select Components**
1. Start with ADC/DAC resolution requirement
2. Work backwards to op-amp specs (noise, settling)
3. Select passives (tolerance, tempco)
4. Verify power budget

### Common Design Mistakes (Trade-off Related)

1. **Ignoring noise bandwidth**: Selected high-GBW amp when low-BW would work
2. **Over-specifying everything**: 0.1% resistors when 1% suffices
3. **Mismatched specs**: Fast ADC with slow driver
4. **Tempco neglect**: Precision circuit with cheap passives
5. **Power budget last**: Designed circuit, then discovered it uses 10× budget

### Sources (Trade-offs Research)
- [Analog Devices: Trade-Offs in Analog IC Performance](https://www.analog.com/en/resources/technical-articles/tradeoffs-in-analog-ic-performance.html)
- [Analog Devices: Power Performance Trade-Offs in Op Amps](https://www.analog.com/en/resources/technical-articles/power-performance-trade-offs-in-operational-amplifiers.html)
- [Analog Devices: Selecting Passive Components](https://www.analog.com/en/resources/technical-articles/selecting-the-right-passive-and-discrete-components.html)
- [All About Circuits: Analog Design Trade-Offs](https://www.allaboutcircuits.com/technical-articles/analog-design-trade-offs-in-applying-linearization-techniques-CMOS-circuits/)
- [Springer: Trade-Offs in Analog Circuit Design (Toumazou)](https://link.springer.com/book/10.1007/b117184)

---

## Progress Tracking
- Session started: 2024
- **Research COMPLETE** for all original modules
- **V5 Architecture ANALYZED**
- **Online pedagogy + interactive tools research SAVED**
- **FET/MOSFET fundamentals RESEARCHED**
- **Audio circuit applications RESEARCHED**
- **ADC/DAC real-world applications RESEARCHED**
- **Analog design trade-offs RESEARCHED**
- **Push-pull, oscillators, protocols RESEARCHED**
- **CURRICULUM MASSIVELY EXPANDED** (15 modules, 52+ lessons + practice problems)

### Final Curriculum Summary (v2.0)

| Module | Topic | Lessons |
|--------|-------|---------|
| 1 | Transistor Intuition (BJT) | 4 |
| 2 | Op-Amp Fundamentals | 4 |
| 3 | Advanced Applications | 4 |
| 4 | Practical Skills | 3 |
| 5 | FET/MOSFET Fundamentals | 4 |
| 6 | Power Electronics Applications | 4 |
| 7 | Audio Applications | 4 |
| 8 | Data Conversion Applications | 4 |
| 9 | Design Trade-offs Workshop | 4 |
| 10 | Output Stages & Complementary Circuits | 4 |
| 11 | Oscillators & Timing Circuits | 5 |
| 12 | Digital Interface Electrical Design | 4 |
| 13 | Communication Protocols (Electrical) | 4 |
| 14 | Advanced Analog Blocks (PLL, Bandgap) | 3 |
| 15 | Practice Problems & Exercises | 5 sets |
| **Total** | | **52 lessons + 5 problem sets** |

### Key Topics Now Covered
- Push-pull Class B/AB, crossover distortion
- NMOS/PMOS complementary circuits (CMOS inverter)
- Open-drain/open-collector, pull-up sizing
- Current mirrors (simple, cascode, Wilson)
- LC oscillators (Colpitts, Hartley)
- RC oscillators (Wien bridge, phase shift)
- Crystal oscillators (Pierce circuit)
- 555 timer (astable, monostable)
- Schmitt triggers & hysteresis
- CMOS logic levels & families (HC, HCT, LVC)
- Level shifting (3.3V ↔ 5V)
- I2C electrical (pull-ups, rise time, capacitance)
- SPI modes (CPOL/CPHA timing)
- UART/RS-232 voltage levels & inversion
- USB differential signaling (D+/D- pull-ups)
- PLL basics (VCO, loop filter, divider)
- Bandgap voltage references (PTAT + CTAT)
- Chopper/auto-zero amplifiers
- Practice problems (Simple → Complex progression)

### Next Steps
- Implement HTML5 file with V5 architecture patterns
- Build interactive widgets using AD framework API
- Create SPICE netlists for each lesson
- Generate expected waveform reference images

---

## MODULE 16: Power Domain Management & Sequencing

### Lesson 16.1: Multi-Rail Power Sequencing

**Why Sequencing Matters**
- FPGAs, SoCs, and complex ICs have strict power-up requirements
- Wrong sequence can cause latch-up, ESD damage, or undefined states
- Common requirements: VCCINT → VCCAUX → VCCO (core before I/O)

**Sequencing Methods**

| Method | Pros | Cons | Best For |
|--------|------|------|----------|
| RC delay | Simple, cheap | Imprecise, load-dependent | Low-complexity boards |
| Discrete cascaded regulators | Uses enable pins | Complex with many rails | 2-3 rail systems |
| MCU controlled | Flexible, programmable | Requires firmware | Production systems |
| Dedicated sequencer IC | Precise, reliable | Cost | High-reliability |

**Key Parameters**
- **Monotonic rise**: Voltage must never dip during ramp
- **Ramp rate**: Some ICs specify min/max dV/dt (e.g., 0.2V/ms to 10V/ms)
- **Tracking**: Some rails must track together (e.g., DDR VDDQ and VREF)

**RC Delay Design**
```
Delay ≈ R × C × ln(Vth/Vsupply)
For enable threshold ~1.2V with 3.3V supply:
R = 100kΩ, C = 1µF → ~36ms delay
```

**Sources**
- [TI: Power Sequencing Best Practices for Complex System Design](https://www.ti.com/lit/an/slva833/slva833.pdf)
- [Analog Devices: Proper Power-On Sequencing](https://www.analog.com/en/resources/technical-articles/proper-power-sequencing.html)

### Lesson 16.2: Load Switches & Discharge Control

**Load Switch Fundamentals**
A load switch is an electronic switch that turns power rails on/off under logic control.

**Key Features**
- **Quick Output Discharge (QOD)**: Internal resistor pulls output to GND when OFF
  - Prevents floating outputs during power state transitions
  - Critical for reliable re-sequencing
- **Controlled Slew Rate**: CT pin capacitor controls rise time
  - Larger CT = slower rise = lower inrush current
- **Reverse Current Blocking**: Prevents backfeed from load to input

**Inrush Current Control**
```
Rise time ≈ CT × VOUT / Icharge
Inrush ≈ C_load × dV/dt
```

**When to Use Load Switches vs. LDOs**
| Use Load Switch | Use LDO |
|-----------------|---------|
| Same voltage rail switching | Voltage step-down needed |
| Power saving (zero Iq when off) | Regulated output required |
| Sequencing between rails | Noise filtering |

**Practical Example: Power State Discharge**
For USB power cycling, use QOD to ensure VBUS discharges before reconnection:
- Without QOD: VBUS may stay high from load capacitance
- With QOD: 10-100Ω internal pull-down drains charge

**Sources**
- [TI: Basics of Load Switches (SLVA652A)](https://www.ti.com/lit/pdf/slva652)
- [TI: Integrated Load Switches vs Discrete MOSFETs (SLVA716A)](https://www.ti.com/lit/an/slva716a/slva716a.pdf)

### Lesson 16.3: Supervisory & Reset Circuits

**Power-On Reset (POR) Requirements**
- Processor must not start until supply is stable
- Reset must be held during brownout conditions
- Typical threshold: 90-95% of nominal voltage

**Key Parameters**
- **Threshold voltage (Vth)**: Trip point for reset assertion
- **Hysteresis**: Prevents chatter during slow transitions (typically 2-5%)
- **Reset delay (TD)**: Time after Vth reached before releasing reset
- **Active polarity**: Active-low (RESET#) or active-high (RESET)

**Brownout Detection**
- Monitors supply during operation
- Asserts reset before voltage drops too low for reliable operation
- Prevents data corruption in memory/EEPROM

**Watchdog Timer Integration**
- Monitors processor heartbeat
- Generates reset if MCU hangs
- Typical timeout: 10ms to several seconds

**Supervisor IC Selection**
```
Required specs:
1. Vth = 90% × Vnominal (e.g., 3.0V for 3.3V rail)
2. Hysteresis ≥ 50mV
3. Reset delay matched to MCU spec
4. Low quiescent current for battery apps
```

**Example ICs**
- TPS3839: Ultra-low power (140nA), tiny package
- TPS3847: 380nA, 12V capable
- LM3710: Brownout + manual reset

**Sources**
- [TI: Voltage Supervisors Quick Reference Guide (SLYT361)](https://www.ti.com/lit/slyt361)
- [TI: How to Implement Voltage Monitoring](https://www.ti.com/lit/ta/ssztcf6/ssztcf6.pdf)

---

## MODULE 17: Protection Circuits & System Safety

### Lesson 17.1: Reverse Polarity Protection

**Method Comparison**

| Method | Vdrop | Cost | Complexity |
|--------|-------|------|------------|
| Series diode | ~0.6V (Si), ~0.3V (Schottky) | Low | Simple |
| P-channel FET | ~I×Rds(on) (mV) | Medium | Simple |
| N-channel FET | ~I×Rds(on) (mV) | Medium | More complex |
| Ideal diode controller | <20mV | Higher | IC-based |

**P-FET Protection (Recommended for <20V)**
```
       VIN ──┬── S ┌──┐ D ──── VOUT
             │     │ │ │
             └──G──┘ └─┘
                 │
                 ├── R1 (100kΩ to GND)
                 │
                 └── Zener (optional, if VIN > Vgs_max)
```
- Source connected to VIN (body diode allows power initially)
- As VIN rises, Vgs < 0, FET turns ON
- Reverse polarity: Vgs = 0, FET OFF, body diode blocks

**Ideal Diode Controllers**
- LM74610-Q1: Automotive-grade, <20mV drop
- LM66100: 50µA Iq, 6V max
- Use when efficiency critical or Schottky drop unacceptable

**Design Considerations**
1. Check Vgs(max) - may need gate Zener for high voltages
2. Verify body diode can handle inrush during startup
3. Consider soft-start to limit inrush current

**Sources**
- [TI: LM74610-Q1 Smart Diode Controller](https://www.ti.com/product/LM74610-Q1)
- [TI: Reverse Current/Battery Protection Circuits](https://www.ti.com/lit/an/slva139/slva139.pdf)

### Lesson 17.2: Overvoltage & Crowbar Protection

**TVS Diode Selection**
```
1. VRWM (standoff) > max normal operating voltage
2. VBR (breakdown) ≤ max voltage IC can tolerate
3. Vc (clamping) < absolute max of protected device
4. PPP adequate for expected transient energy
```

**Key Parameters**
- **Unidirectional**: For DC rails (cathode to rail, anode to GND)
- **Bidirectional**: For AC or signals crossing GND

**Crowbar vs. Clamp Comparison**

| Type | Action | Reset | Best For |
|------|--------|-------|----------|
| TVS Clamp | Limits voltage, passes current | Automatic | Transients, ESD |
| SCR Crowbar | Shorts rail, triggers fuse | Manual/fuse | Catastrophic OVP |
| Active clamp | Controls pass FET | Automatic | Precision OVP |

**SCR Crowbar Design**
```
        VIN ───┬─── Fuse ───── VOUT
               │
           ┌───┴───┐
           │  SCR  │
           └───┬───┘
               │
        GND ───┴─── Trigger (Zener sets threshold)
```

**PCB Layout for TVS**
- Place TVS as close to connector as possible
- Minimize trace length to GND
- Use dedicated ground via near TVS
- Lower impedance path = better clamping

**Sources**
- [ROHM: TVS Diode Selection Guide](https://fscdn.rohm.com/en/products/databook/applinote/discrete/diodes/selection_method_and_usage_of_tvs_diodes_an-e.pdf)
- [TI: ESD Protection Layout Guide (SLVA680)](https://www.ti.com/lit/pdf/slva680)
- [Littelfuse: ESD Protection Design Guide](https://www.littelfuse.com/products/tvs-diode-arrays.aspx)

### Lesson 17.3: Hot-Swap & Inrush Limiting

**The Problem**
When plugging a board into a live backplane:
- Load capacitance looks like short circuit initially
- Inrush current = V/R_trace (potentially 10s of amps)
- Can damage connectors, upset other cards, trigger protection

**Hot-Swap Controller Features**
1. **Soft-start**: Ramps gate voltage slowly to limit di/dt
2. **Current limit**: FET operates in linear region
3. **SOA timer**: Ensures FET stays in Safe Operating Area
4. **Power-good output**: Indicates stable output

**Design Equations**
```
Inrush current limit: Ilim = Vsense / Rsense
Soft-start time: t_ss = C_ss × Vgate / I_charge
```

**Example: TI LM5069 (-9V to -80V)**
- For -48V telecom backplanes
- Integrated FET driver
- Adjustable current limit and timing

**Sense Resistor Selection**
```
Rsense = Vilim / Imax
Power = Imax² × Rsense
Choose low-inductance type (4-terminal for accuracy)
```

**Sources**
- [TI: Hot Swap Controller Selection Guide](https://www.ti.com/power-management/power-switches/hot-swap-controllers/overview.html)
- [Analog Devices: Hot Swap Design Calculator](https://www.analog.com/en/design-center/interactive-design-tools/lt3840-hot-swap-controller.html)

---

## MODULE 18: PCB & Signal Integrity Techniques

### Lesson 18.1: Decoupling & Bypass Strategy

**Capacitor Value Selection**
| Frequency Range | Capacitor Value | Type |
|-----------------|-----------------|------|
| DC - 1 kHz | 10µF - 100µF | Electrolytic/Tantalum |
| 1 kHz - 10 MHz | 0.1µF - 1µF | Ceramic (X5R/X7R) |
| 10 MHz - 500 MHz | 10nF - 100nF | Ceramic (C0G/NP0) |
| 500 MHz - GHz | 1nF - 10nF | Ceramic (C0G, small package) |

**Placement Rules**
1. Place capacitor as close to power pin as possible
2. Minimize loop area: cap → power pin → ground pin → cap ground
3. Use via directly at capacitor pad (not trace then via)
4. Smaller package = lower ESL = better high-frequency performance

**Multi-Capacitor Strategy**
```
IC Power Pin
    │
    ├── 10µF (bulk, can be farther)
    ├── 0.1µF (mid-frequency, close)
    └── 10nF (high-frequency, closest)
```

**Self-Resonant Frequency (SRF)**
- Capacitor is capacitive below SRF, inductive above
- 0.1µF 0402: SRF ≈ 50 MHz
- 10nF 0402: SRF ≈ 200 MHz
- Choose capacitor with SRF near target noise frequency

**Common Mistakes**
1. Using only 0.1µF for everything
2. Long traces between cap and power pin
3. Shared via for multiple caps (increases inductance)
4. Ignoring DC bias derating (X5R/X7R lose capacitance at voltage)

**Sources**
- [Analog Devices: Decoupling Techniques (MT-101)](https://www.analog.com/media/en/training-seminars/tutorials/MT-101.pdf)
- [TI: Decoupling Capacitors for ADCs](https://www.ti.com/content/dam/videos/external-videos/de-de/9/3816841626001/6313253251112.mp4/subassets/notes-decoupling_capacitors.pdf)

### Lesson 18.2: Ferrite Beads & EMI Filtering

**When to Use Ferrite Beads**
- Isolating noisy digital power from analog
- Suppressing high-frequency noise on power rails
- EMI filtering at board entry points

**Selection Criteria**
1. **Impedance at target frequency**: Check Z vs. f curve
2. **DC resistance**: Low Rdc to minimize voltage drop
3. **Rated current**: Must exceed max DC current with margin
4. **DC bias effect**: Impedance drops significantly under current!

**DC Bias Warning**
```
At 50% rated current:
- Impedance may drop from 100Ω to 10Ω at 100MHz
- Always check manufacturer's bias curves
```

**Pi-Filter Configuration**
```
VIN ──┬── C1 ──┬── Ferrite ──┬── C2 ──┬── VOUT
      │        │             │        │
      GND      │             │       GND
               └─────────────┘
```
- C1 = 100nF-1µF (low ESL ceramic)
- C2 = 100nF-1µF (low ESL ceramic)
- Creates effective low-pass network

**Placement Guidelines**
- Place ferrite at power input (before distribution)
- Don't use ferrite directly on VRM output (causes resonance)
- Keep ferrite away from sensitive analog paths

**Resonance Damping**
When ferrite resonates with decoupling caps:
- Add damping: Large cap (1-10µF) in series with small resistor (1-2Ω)
- This suppresses the resonance peak

**Sources**
- [Analog Devices: Ferrite Beads Demystified](https://www.analog.com/en/resources/analog-dialogue/articles/ferrite-beads-demystified.html)
- [Murata: Ferrite Bead Selection Guide](https://www.murata.com/en-us/products/emc/emifil/library/knowhow/basic/s2-chapter02-p1)
- [All About Circuits: Choosing and Using Ferrite Beads](https://www.allaboutcircuits.com/technical-articles/choosing-and-using-ferrite-beads/)

### Lesson 18.3: Grounding Strategy for Mixed-Signal

**The Goal**
Prevent digital return currents from flowing through analog ground paths.

**Single Ground Plane (Preferred)**
```
┌─────────────────────────────────────┐
│     GROUND PLANE (unbroken)        │
│                                     │
│  ┌──────────┐      ┌──────────┐    │
│  │  ANALOG  │      │ DIGITAL  │    │
│  │  SECTION │      │ SECTION  │    │
│  └──────────┘      └──────────┘    │
│                                     │
│     ADC/DAC placed at boundary     │
└─────────────────────────────────────┘
```

**Key Rules**
1. Use ONE solid ground plane
2. Partition board into analog and digital REGIONS
3. Route signals only within their region
4. Never route traces over gaps or splits
5. Place ADC/DAC at region boundary

**Star Ground (When Appropriate)**
- Low-frequency precision circuits (<1 MHz)
- Audio equipment
- Separate current paths for different subsystems
- Connect at single point near power supply return

**When to Split Grounds**
Rarely! But consider if:
- Galvanic isolation required (use isolators)
- Very high digital noise (>100mA switching)
- Different voltage domains that must not share current

**Ground Loops**
- Occur when ground has multiple paths
- Creates loop that acts as antenna
- Fix: Single-point connection, or continuous low-impedance plane

**Sources**
- [Analog Devices: Staying Well Grounded](https://www.analog.com/en/resources/analog-dialogue/articles/staying-well-grounded.html)
- [Analog Devices: Successful PCB Grounding with Mixed-Signal Chips](https://www.analog.com/en/resources/technical-articles/successful-pcb-grounding-with-mixedsignal-chips--follow-the-path-of-least-impedance.html)
- [Henry Ott: Grounding of Mixed Signal PCBs](https://hott.shielddigitaldesign.com/techtips/split-gnd-plane.html)

---

## MODULE 19: Hardware Debugging & Quick Fixes

### Lesson 19.1: Oscilloscope Debugging Techniques

**Setup Checklist (Before Every Debug Session)**
1. Press "Default Setup" first (clears previous settings)
2. Verify coupling mode (DC for most, AC only when needed)
3. Check probe compensation (1 kHz square wave test)
4. Match probe attenuation setting to actual probe (1X vs 10X)

**Common Measurement Errors**
| Error | Cause | Fix |
|-------|-------|-----|
| Signal looks noisy | Ground clip too long | Use spring ground, shorter leads |
| Amplitude wrong | Wrong attenuation setting | Match scope to probe setting |
| Rise time too slow | Bandwidth too low | BW ≥ 5× signal frequency |
| Ringing artifacts | Probe loading | Use higher impedance probe |
| DC offset wrong | AC coupling left on | Switch to DC coupling |

**Bandwidth Rule of Thumb**
```
Oscilloscope BW ≥ 5 × signal frequency
For rise time: BW ≥ 0.35 / rise_time
```

**Probing Best Practices**
1. Use shortest possible ground connection
2. 10X probe for general use (higher impedance)
3. 1X probe only for low-frequency, low-impedance sources
4. Differential probe for floating measurements

**Systematic Debug Approach**
1. **Check power rails first** (correct voltage, acceptable ripple)
2. **Verify reference voltages** (Vref, bias points)
3. **Trace signal flow** from input to output
4. **Isolate sections** by breaking feedback loops if needed
5. **Compare to known-good** or simulation

**Sources**
- [EE Times: Oscilloscope Mistakes Part 1](https://www.eetimes.com/oscilloscope-mistakes-part-1/)
- [MIT: The Art of Debugging Circuits](https://web.mit.edu/6.101/www/reference/TheArtofDebuggingCircuits.pdf)
- [EDN: Five Common Debug Tasks](https://www.edn.com/perform-five-common-debug-tasks-with-an-oscilloscope/)

### Lesson 19.2: RC Snubber Design for Ringing

**The Problem**
Switching transitions cause ringing due to parasitic L and C.
This creates:
- EMI radiation
- Overvoltage stress on components
- Potential false triggering

**7-Step Snubber Design (TI Method)**

1. **Measure ringing frequency (f_ring)** with oscilloscope
2. **Add known capacitor (C_test)** across switch, measure new frequency (f_new)
3. **Calculate parasitic capacitance**:
   ```
   C_parasitic = C_test × (f_ring² - f_new²) / f_new²
   ```
4. **Calculate parasitic inductance**:
   ```
   L = 1 / (4π² × f_ring² × C_parasitic)
   ```
5. **Choose snubber capacitor**:
   ```
   C_snub ≥ 2 × C_parasitic (typical: 100pF - 1nF)
   ```
6. **Calculate snubber resistor**:
   ```
   R_snub = √(L / C_snub)
   ```
7. **Verify and iterate** (add snubber, check waveform, adjust)

**Quick Empirical Method**
1. Start with C = 100pF to 1nF across the ringing node
2. Observe if ringing frequency changes
3. Add R in series (start with 10-100Ω)
4. Adjust until critically damped (no overshoot, fast settling)

**Snubber Power Dissipation**
```
P_snub = 0.5 × C_snub × V² × f_switch
```
Ensure resistor power rating adequate!

**Sources**
- [TI: Calculate an R-C Snubber in Seven Steps](https://www.ti.com/lit/pdf/ssztbc7)
- [DigiKey: RC Snubber Design for Power Switches](https://www.digikey.com/en/articles/resistor-capacitor-rc-snubber-design-for-power-switches)
- [CDE: Design of Snubbers for Power Circuits](https://www.cde.com/resources/technical-papers/design.pdf)

### Lesson 19.3: Quick Fix Patterns

**Common Problems & Solutions**

**1. Voltage Rail Oscillation**
```
Symptom: Supply voltage oscillates at 10s-100s kHz
Cause: Feedback instability or insufficient output capacitance
Fix: Add 10-100µF electrolytic + 0.1µF ceramic at regulator output
```

**2. Op-Amp Oscillation (High-Frequency)**
```
Symptom: Output oscillates at MHz range
Cause: Capacitive load without isolation
Fix: Add 10-100Ω series resistor at output before load
```

**3. Digital Noise on Analog**
```
Symptom: Periodic spikes on analog signal at clock frequency
Cause: Shared power/ground, coupling
Fix: LC filter (ferrite + 10µF) on analog supply, separate returns
```

**4. Ground Bounce**
```
Symptom: Logic glitches during heavy switching
Cause: Inductance in ground return
Fix: Add local decoupling, shorter ground paths, parallel vias
```

**5. Ringing on Long Traces**
```
Symptom: Overshoot and ringing at signal transitions
Cause: Unterminated transmission line
Fix: Series termination (source) or parallel termination (load)
   Series R = Zo - Rout_driver (typical 22-33Ω)
```

**6. Slow Rise Time on I2C/Open-Drain**
```
Symptom: Signal doesn't reach logic high in time
Cause: Pull-up too weak for bus capacitance
Fix: Decrease Rpu (check I2C spec: IOL must sink at 0.4V)
   trise = 0.8473 × Rpu × Cbus
```

**7. Power State Sequencing Issues**
```
Symptom: Device doesn't start reliably or latches up
Cause: Wrong power-up sequence
Fix: Add sequencing delays, use supervisor IC, add bulk caps
```

**Emergency Debug Kit**
Keep these on your bench for quick fixes:
- 0.1µF, 1µF, 10µF ceramic capacitors
- 10Ω, 47Ω, 100Ω resistors
- Ferrite beads (various impedances)
- TVS diodes (5V, 12V, 24V)
- Schottky diodes
- 10X passive probes (compensated)

**Sources**
- [TI E2E Community: Debugging Tips](https://e2e.ti.com/)
- [EEVblog Forum: Practical Debug Techniques](https://www.eevblog.com/forum/)
- [All About Circuits: Troubleshooting Guide](https://www.allaboutcircuits.com/)

### Lesson 19.4: Bleeder & Discharge Circuits

**Why Bleeder Resistors?**
- Safety: Discharge capacitors when power removed
- Reliability: Ensure defined state on power-down
- Sequencing: Proper discharge before re-power

**Bleeder Resistor Sizing**
```
Discharge time to safe voltage (<50V):
t = -R × C × ln(Vfinal / Vinitial)

For 400V to 50V with 100µF:
R = t / (C × ln(8)) ≈ t / (C × 2.08)
1 second: R = 1 / (100µ × 2.08) ≈ 4.8kΩ
```

**Power Dissipation**
```
P = V² / R (at initial voltage)
For 400V, 4.8kΩ: P = 33W (use high-power resistor!)
```

**Active Discharge Circuits**
For faster discharge without continuous power loss:
1. Use MOSFET switch controlled by power-good signal
2. When power fails, FET turns on, discharges through low resistance
3. Discharge time dramatically reduced vs. passive bleeder

**Load Switch with QOD**
Many integrated load switches include Quick Output Discharge:
- Turns on internal resistor when switch is disabled
- Typically 10Ω - 1kΩ internal
- Discharges to GND, not just floating

**Application: USB Power Cycling**
```
Problem: VBUS capacitance holds voltage after unplug
Result: Re-enumeration fails
Solution: QOD load switch or active discharge circuit
```

---

## Progress Tracking (Updated)

- **Power sequencing/rails RESEARCHED** (TI, Analog Devices)
- **Protection circuits RESEARCHED** (reverse polarity, crowbar, TVS)
- **Hot-swap/inrush limiting RESEARCHED** (TI application notes)
- **Supervisory/reset circuits RESEARCHED** (TI, voltage monitors)
- **Load switches/discharge RESEARCHED** (TI SLVA652A)
- **EMI filtering/ferrite beads RESEARCHED** (Analog Devices, Murata)
- **Grounding strategies RESEARCHED** (Analog Devices, Henry Ott)
- **Decoupling strategies RESEARCHED** (TI, Analog Devices MT-101)
- **RC snubber design RESEARCHED** (TI 7-step method, DigiKey)
- **Oscilloscope debugging RESEARCHED** (MIT, EE Times)
- **TVS/ESD protection RESEARCHED** (ROHM, TI, Littelfuse)
- **CURRICULUM EXPANDED TO v3.0** (19 modules, 68+ lessons)

### Final Curriculum Summary (v3.0 - Practical Troubleshooting Edition)

| Module | Topic | Lessons |
|--------|-------|---------|
| 1 | Transistor Intuition (BJT) | 4 |
| 2 | Op-Amp Fundamentals | 4 |
| 3 | Advanced Applications | 4 |
| 4 | Practical Skills | 3 |
| 5 | FET/MOSFET Fundamentals | 4 |
| 6 | Power Electronics Applications | 4 |
| 7 | Audio Applications | 4 |
| 8 | Data Conversion Applications | 4 |
| 9 | Design Trade-offs Workshop | 4 |
| 10 | Output Stages & Complementary Circuits | 4 |
| 11 | Oscillators & Timing Circuits | 5 |
| 12 | Digital Interface Electrical Design | 4 |
| 13 | Communication Protocols (Electrical) | 4 |
| 14 | Advanced Analog Blocks | 3 |
| 15 | Practice Problems & Exercises | 5 sets |
| 16 | **Power Domain Management & Sequencing** | 3 |
| 17 | **Protection Circuits & System Safety** | 3 |
| 18 | **PCB & Signal Integrity Techniques** | 3 |
| 19 | **Hardware Debugging & Quick Fixes** | 4 |
| **Total** | | **68 lessons + 5 problem sets** |

### New Practical Topics Covered
- Multi-rail power sequencing (FPGA, SoC requirements)
- Load switches with Quick Output Discharge
- Supervisory ICs (POR, brownout, watchdog)
- Reverse polarity protection (P-FET, ideal diode)
- TVS diode selection and placement
- Crowbar vs. clamp protection
- Hot-swap controller design
- Decoupling capacitor strategy (multi-value, placement)
- Ferrite bead selection (DC bias effects)
- Pi-filter design for power rails
- Mixed-signal grounding (partition, not split)
- Oscilloscope setup and common mistakes
- RC snubber design (7-step TI method)
- Quick fix patterns for common problems
- Bleeder and active discharge circuits

---

## MODULE 20: Real-World Application Scenarios

### Scenario 20.1: IoT Sensor Node (Battery-Powered)

**The Challenge**
Design a wireless sensor node that runs for 2+ years on a single CR2032 coin cell.

**System Requirements**
- Temperature/humidity sensor (I2C)
- LoRa radio (wake every 5 minutes, transmit 100ms)
- 3.3V logic, 3.0V nominal battery (drops to 2.0V end-of-life)
- Target: <10µA average current

**Analog Design Decisions**

1. **Power Topology Selection**
   - Battery: 3.0V nominal → 2.0V end-of-life
   - Load: 3.3V required
   - Need: Boost converter (battery < load voltage)
   - Problem: Boost converter has high quiescent current
   - Solution: Buck-boost with bypass mode OR run at 2.5V with LDO bypass at high battery

2. **Sensor Interface**
   - I2C pull-ups: sized for low power
   - During sleep: pull-ups waste power!
   - Solution: Use GPIO to power sensor OR switch pull-ups off

3. **Radio Power Management**
   - Peak current: 100mA during TX
   - Bulk capacitor required: C = I × t / ΔV = 0.1A × 0.1s / 0.1V = 100mF (too big!)
   - Real solution: Size bulk cap for voltage droop, use DC-DC that handles transient

4. **Sleep Current Budget**
   ```
   MCU deep sleep: 1µA
   DC-DC quiescent: 2µA (low-Iq regulator like TPS62840)
   Supervisor IC: 0.5µA
   Leakage: 1µA
   Total sleep: ~5µA
   Active duty: 100ms every 5min = 0.03%
   Average: 5µA + (100mA × 0.0003) = ~35µA
   ```

**Design Exercises**

| Level | Exercise |
|-------|----------|
| Easy | Calculate battery life with CR2032 (225mAh) at 35µA average |
| Medium | Size the bulk capacitor to limit voltage droop to 200mV during 100mA TX |
| Hard | Design complete power tree: boost, enable sequencing, battery monitoring |

---

### Scenario 20.2: Automotive 12V Sensor (EMC Hardened)

**The Challenge**
Design a temperature sensor interface for engine compartment use.

**Environment**
- 12V nominal, but: load dump to 40V, cold crank to 6V
- Temperature: -40°C to +125°C
- EMC: ISO 7637-2 transients, bulk current injection

**System Block Diagram**
```
+12V ─→ [TVS] ─→ [Input filter] ─→ [Buck] ─→ [5V] ─→ [LDO] ─→ [3.3V MCU]
                      │
                   [Sensor]
```

**Key Analog Challenges**

1. **Transient Protection**
   - Load dump: +40V for 400ms
   - Need: TVS clamp + series resistance OR active clamp
   - TVS selection: 18V VRWM, 24V clamp, high power (400W minimum)

2. **Wide Input Range Buck**
   - Input: 6V to 40V (with protection)
   - Output: 5V
   - Challenge: Wide range requires specialized controller
   - Example ICs: LM5017, TPS54240

3. **Temperature Coefficient Issues**
   - At -40°C: Capacitor ESR increases, inductors may saturate differently
   - At +125°C: MOSFET Rds(on) increases, efficiency drops
   - Solution: Derate components, test at temperature extremes

4. **EMC Filtering**
   - Input: π-filter (Cinput → L → C)
   - Ferrite + bulk cap at each stage
   - Common-mode choke for conducted emissions

**Design Exercises**

| Level | Exercise |
|-------|----------|
| Easy | Select TVS diode for 12V automotive (VRWM, VBR, Vc specs) |
| Medium | Design input filter for ISO 7637-2 transient (given TVS clamp voltage) |
| Hard | Full power supply: 6-40V input, 3.3V/100mA output, -40°C to +125°C |

---

### Scenario 20.3: Precision Temperature Measurement (RTD)

**The Challenge**
Measure temperature 0-200°C with ±0.1°C accuracy using PT100 RTD.

**PT100 Basics**
- 100Ω at 0°C
- ~0.385Ω/°C (α = 0.00385/°C)
- At 200°C: 100 + (200 × 0.385) = 177Ω
- ΔR for ±0.1°C: ~0.04Ω

**Signal Chain**
```
[Current source] ─→ [PT100] ─→ [Instrumentation Amp] ─→ [ADC]
      │
   [4-wire sensing]
```

**Key Design Decisions**

1. **Excitation Current**
   - Higher I = larger signal
   - But: I²R causes self-heating error
   - Rule: <1mA for precision (0.1mW at 100Ω → <0.1°C error)
   - Typical: 100µA to 1mA

2. **Lead Resistance Compensation**
   - 2-wire: Lead R adds directly to RTD (big error)
   - 3-wire: Compensates if leads matched
   - 4-wire: True Kelvin sensing (best accuracy)

3. **Instrumentation Amplifier Selection**
   - Input range: 100Ω × 1mA = 100mV at 0°C
   - Full scale: 177Ω × 1mA = 177mV at 200°C
   - ΔV = 77mV for 200°C span → 0.385mV/°C
   - For ±0.1°C: need to resolve ~40µV
   - ADC: 16-bit minimum, low noise

4. **Error Budget**
   ```
   RTD tolerance: ±0.1°C (Class A)
   Self-heating: 0.05°C (with 500µA)
   Lead resistance: 0 (4-wire)
   Amp offset drift: 1µV/°C × 100°C = 100µV → 0.26°C error!
   ADC error: < 0.05°C
   Total: ~0.4°C (need lower-drift amp!)
   ```

**Design Exercises**

| Level | Exercise |
|-------|----------|
| Easy | Calculate PT100 voltage at 100°C with 500µA excitation |
| Medium | Design gain for INA to map 0-200°C to 0-5V ADC range |
| Hard | Complete error budget including amplifier drift, ADC INL, lead resistance |

---

### Scenario 20.4: Audio DAC Output Stage

**The Challenge**
Design line-level audio output from I2S DAC chip.

**Requirements**
- DAC output: 1Vrms max, differential
- Load: 10kΩ line input
- SNR: >100dB
- THD+N: <0.01%

**Signal Chain**
```
[I2S DAC] ─→ [Differential → SE] ─→ [Output buffer] ─→ [AC coupling] ─→ [Line out]
```

**Key Design Decisions**

1. **Differential to Single-Ended**
   - Most DACs are differential output
   - Use difference amplifier or transformer
   - Op-amp approach: OPA1612, AD8397

2. **Output Coupling Capacitor**
   - Block DC offset
   - High-pass corner: fc = 1 / (2πRC)
   - For fc = 10Hz with 10kΩ load: C = 1.6µF
   - Use film capacitor (not ceramic - piezoelectric distortion)

3. **Op-Amp Selection for Audio**
   - Low noise: <5 nV/√Hz
   - Low distortion: <0.0003% THD
   - Fast slew rate: >10V/µs for high frequencies
   - Rail-to-rail output if single supply

4. **Power Supply Filtering**
   - Digital supply noise couples to analog
   - Use LC filter on analog supply
   - Ferrite bead + 10µF on each rail

**Design Exercises**

| Level | Exercise |
|-------|----------|
| Easy | Calculate output coupling capacitor for 20Hz corner, 47kΩ load |
| Medium | Design difference amp with gain = 2, analyze CMRR with 1% resistors |
| Hard | Full output stage: differential input, SE output, headphone drive capable |

---

### Scenario 20.5: FPGA Power System

**The Challenge**
Power an FPGA with core (1.0V), auxiliary (1.8V), and I/O (3.3V) rails.

**Sequencing Requirements**
1. VCCINT (1.0V) must ramp first
2. VCCAUX (1.8V) after VCCINT stable
3. VCCO (3.3V) after VCCAUX stable
4. All rails must be monotonic

**Power Architecture**
```
+12V ─→ [Buck 5V] ─→ [Buck 1.0V] ─→ VCCINT (Core)
              │
              ├──→ [Buck 1.8V] ─→ VCCAUX (sequenced after VCCINT)
              │
              └──→ [Buck 3.3V] ─→ VCCO (sequenced after VCCAUX)
```

**Key Challenges**

1. **Monotonic Startup**
   - Pre-bias: output cap may have residual charge
   - Regulator must not fight pre-bias (causes dip)
   - Solution: Use pre-bias safe regulators

2. **Sequencing Methods**
   - RC delay on enable pins
   - Power-good daisy chain
   - Dedicated sequencer IC (UCD9081, LTC2937)

3. **Power-Good Monitoring**
   - Each regulator has PG output
   - Use PG to enable next stage
   - Supervisor IC monitors all rails

4. **Current Requirements**
   - VCCINT: 2A @ 1.0V (dynamic, depends on design)
   - VCCAUX: 500mA @ 1.8V
   - VCCO: 300mA @ 3.3V

**Design Exercises**

| Level | Exercise |
|-------|----------|
| Easy | Calculate RC delay for 10ms between rail enables (given 1.2V threshold) |
| Medium | Design PG daisy-chain with hysteresis and debounce |
| Hard | Complete power tree with startup waveforms, inrush limiting, fault protection |

---

## MODULE 21: Comprehensive Exercise Sets (Progressive Difficulty)

### Exercise Set A: Resistor & Voltage Divider Problems

**Level 1 - Fundamentals**
1. A 10kΩ/10kΩ divider with 5V input. What's the output voltage?
2. Design a divider to give 2.5V from 12V (pick standard values)
3. Calculate power dissipated in each resistor of problem 2

**Level 2 - Loading Effects**
4. The divider from problem 1 drives a 10kΩ load. New output voltage?
5. Design a divider for 1.8V from 5V that changes <2% with 100kΩ load
6. Calculate the Thevenin equivalent of a 4.7kΩ/10kΩ divider from 3.3V

**Level 3 - Precision Applications**
7. Design ADC voltage reference divider: 12V → 2.048V, 1% accuracy
8. Calculate temperature drift if R1 has +100ppm/°C and R2 has +50ppm/°C
9. Compare divider tolerance with 1% vs 0.1% resistors at -40°C to +85°C

**Level 4 - System Integration**
10. Design supervisor threshold divider: trip at 4.5V with 1.2V comparator threshold
11. Add hysteresis to problem 10 using positive feedback (target: 100mV hysteresis)
12. Design battery monitor divider: 3.0V-4.2V → 0V-3.3V for ADC input

---

### Exercise Set B: Op-Amp Circuits

**Level 1 - Basic Configurations**
1. Non-inverting amp with gain = 10. Calculate R values (use 10kΩ feedback)
2. Inverting amp with gain = -5. Calculate R values
3. Unity-gain buffer driving 1000pF capacitive load - will it oscillate?

**Level 2 - Frequency Response**
4. Design 1kHz low-pass filter with gain = 2 (Sallen-Key)
5. Calculate the -3dB frequency of non-inverting amp (gain=100, GBW=10MHz)
6. Design active high-pass filter, fc = 100Hz, gain = 10

**Level 3 - Precision Circuits**
7. Design instrumentation amp with gain = 100 using 3 op-amps
8. Calculate output offset if input offset is 100µV and gain is 1000
9. Design difference amp with CMRR > 80dB using 0.1% resistors

**Level 4 - Advanced Applications**
10. Design current source: 100µA from op-amp and resistor
11. Design integrator with 1ms time constant, include reset switch
12. Design transimpedance amplifier: 1µA → 1V output, bandwidth 100kHz

---

### Exercise Set C: Power Supply Design

**Level 1 - LDO Basics**
1. LDO dropout is 200mV, output 3.3V. Minimum input voltage?
2. Calculate power dissipated: Vin=5V, Vout=3.3V, Iload=500mA
3. Select LDO for: Vin=5V, Vout=3.3V, 200mA, <50mV dropout

**Level 2 - Thermal Analysis**
4. LDO in SOT-223 (θJA=110°C/W), PD=1W. Junction temp at 25°C ambient?
5. Design heatsink requirement for 2W LDO, max Tj=125°C, Ta=70°C
6. Calculate derating curve for LDO: rated 1A at 25°C, θJA=50°C/W

**Level 3 - Buck Converter Basics**
7. Buck converter: Vin=12V, Vout=5V, fsw=500kHz. Calculate duty cycle
8. Select inductor for 20% ripple current at 2A load (use L = Vout×(1-D)/(ΔI×fsw))
9. Calculate output capacitor for 50mV ripple with the inductor from problem 8

**Level 4 - Complete Power System**
10. Design 3.3V/1A supply from 5V: LDO vs Buck decision with efficiency analysis
11. Design input filter for buck converter to meet <100mVpp conducted ripple
12. Design sequenced dual-rail: 1.8V and 3.3V from 5V, 1.8V first, 10ms delay

---

### Exercise Set D: Protection Circuits

**Level 1 - Basic Protection**
1. Select TVS for 5V rail: pick VRWM, calculate Vc
2. Series resistor + Zener clamp: design for 12V → 5V protection
3. Calculate power in protection resistor during 24V fault

**Level 2 - Reverse Polarity**
4. Design P-FET reverse polarity protection for 12V/2A system
5. Select P-FET: what Vgs, Rds(on), and package needed?
6. Calculate voltage drop and power loss in the P-FET protection

**Level 3 - Inrush Limiting**
7. Calculate inrush current: 1000µF cap charged from 12V through 0.1Ω trace
8. Design soft-start using NTC thermistor (select starting R and final R)
9. Design active inrush limit: FET + current sense + timer

**Level 4 - Hot-Swap Design**
10. Design hot-swap for +12V/3A system with 10ms soft-start
11. Calculate SOA requirements for pass FET during inrush
12. Design fault detection: overcurrent, overvoltage, UVLO with auto-retry

---

### Exercise Set E: Signal Conditioning

**Level 1 - Basic Amplification**
1. Sensor output: 0-10mV. Design amp for 0-5V ADC input
2. Calculate noise gain and total output noise (10nV/√Hz amp, 100kHz BW)
3. Design single-supply amp for bipolar sensor (-10mV to +10mV)

**Level 2 - Bridge Circuits**
4. Strain gauge bridge: 120Ω, GF=2. Calculate ΔR for 1000µε strain
5. Design excitation and amplification for 0-1000µε → 0-5V output
6. Calculate bridge self-heating at 5V excitation

**Level 3 - Current Measurement**
7. Design high-side current sense: 0-5A, 12V system, 0-2.5V output
8. Select sense resistor for 50mV full-scale, calculate power dissipation
9. Design low-side current sense with ground-referenced output

**Level 4 - Advanced Sensors**
10. Design 4-wire RTD interface: PT100, 0-200°C, 500µA excitation
11. Calculate self-heating error and lead resistance requirements
12. Design thermocouple interface with cold junction compensation

---

### Exercise Set F: Digital Interface Electrical

**Level 1 - Basic I/O**
1. GPIO sinks 4mA at 0.4V. Design pull-up for 5V logic
2. Calculate rise time for 10kΩ pull-up with 50pF load
3. LED driver: 10mA forward current, 2V Vf, from 3.3V GPIO

**Level 2 - I2C Design**
4. I2C bus: 400kHz, 200pF capacitance. Calculate pull-up range
5. Design pull-up for fastest rise time while meeting IOL spec (3mA @ 0.4V)
6. Level shift 3.3V ↔ 5V I2C bus using N-FET bidirectional translator

**Level 3 - SPI and High-Speed**
7. SPI at 10MHz: calculate maximum trace length for reliable operation
8. Design series termination for 50Ω trace, driver Rout = 10Ω
9. Calculate eye diagram degradation with 10pF capacitive load

**Level 4 - Advanced Interface**
10. Design RS-485 termination network with failsafe biasing
11. Calculate USB 2.0 impedance requirements and design matching network
12. Design differential signal routing for 100Ω differential impedance

---

### Exercise Set G: Troubleshooting Scenarios

**Level 1 - Basic Problems**
1. Op-amp output stuck at rail. List 5 possible causes
2. Power supply has 500mVpp ripple. What to check?
3. I2C communication fails intermittently. Debugging steps?

**Level 2 - Measurement & Analysis**
4. Scope shows 10MHz oscillation on op-amp output. Cause and fix?
5. ADC readings have periodic noise at 60Hz. Root cause and solutions?
6. LDO thermal shutdown during normal operation. Analysis approach?

**Level 3 - System-Level Issues**
7. FPGA won't boot reliably. Power sequencing debugging methodology
8. EMC test fails conducted emissions at 50MHz. Investigation steps
9. Battery-powered device only lasts 1 day instead of expected 30. Debug?

**Level 4 - Complex Debugging**
10. Audio amp has distortion only at high volume and high frequency. Analyze
11. Sensor readings drift with temperature but sensor is calibrated. Causes?
12. System works on bench but fails in enclosure. Systematic debugging

---

### Exercise Set H: Complete Design Projects

**Project 1 - USB Power Bank (Easy)**
Design a 5V/2A USB power bank charger:
- Input: 5V USB
- Battery: Single 18650 Li-Ion cell
- Output: 5V/2A USB-A
- Features: Charge indicator LED, over-discharge protection

Deliverables: Block diagram, BOM, schematic sketch

**Project 2 - 4-20mA Sensor Interface (Medium)**
Design industrial 4-20mA loop interface:
- Power: 24V loop supply
- Sensor: Pressure transducer (4-20mA)
- Output: 0-5V to ADC
- Protection: 30V transient, reverse polarity

Deliverables: Schematic, component selection rationale, error analysis

**Project 3 - Audio Preamp + Headphone Amp (Medium)**
Design audio front-end:
- Input: Line level (1Vrms max)
- Features: Volume control, tone control (bass/treble)
- Output: Headphone (32Ω, 100mW)
- Power: ±12V

Deliverables: Full schematic, frequency response analysis, distortion estimate

**Project 4 - Battery Monitor System (Hard)**
Design battery management front-end:
- Battery: 4S Li-Ion pack (12.8V - 16.8V)
- Measure: Cell voltage (4x), pack current, temperature (2x)
- Interface: I2C to MCU
- Protection: Overvoltage, undervoltage, overcurrent, overtemperature

Deliverables: Architecture, detailed schematic, accuracy analysis

**Project 5 - Complete Embedded Power Supply (Hard)**
Design power system for ARM Cortex-M4 board:
- Input: 9-36V DC
- Rails: 5V/1A (USB), 3.3V/500mA (MCU), 1.8V/100mA (analog)
- Features: Sequencing, PG monitoring, reverse protection, EMI filtering
- Efficiency: >85% at typical load

Deliverables: Complete power tree, sequencing timing diagram, thermal analysis

---

## Sources for Applications & Exercises

### Sensor Conditioning
- [Analog Devices: Practical Design Techniques for Sensor Signal Conditioning](https://www.analog.com/en/education/education-library/practical-design-techniques-sensor-signal-conditioning.html)
- [Microchip: Analog Sensor Conditioning Circuits](https://ww1.microchip.com/downloads/en/appnotes/00990a.pdf)
- [TE Connectivity: Signal Conditioning for Pressure Sensors](https://www.cdiweb.com/datasheets/te/signal_conditioning_for_meas_pressure_sensors.pdf)

### Power Management
- [Analog Devices: Supply Topology Selection](https://www.analog.com/en/resources/technical-articles/supply-topology-high-power.html)
- [Analog Devices: Power Efficiency for IoT](https://www.analog.com/en/resources/technical-articles/greatly-improve-battery-power-efficiency-for-iot-devices.html)
- [Microchip: LDO Design Guide](https://ww1.microchip.com/downloads/en/devicedoc/ldobk.pdf)

### Practice Resources
- [MIT OpenCourseWare: Power Electronics Problem Sets](https://ocw.mit.edu/courses/6-622-power-electronics-spring-2023/resources/problem-sets-with-solutions/)
- [All About Circuits: EE Worksheets](https://www.allaboutcircuits.com/worksheets/)

---

## Progress Tracking (Updated v3.1)

- **Real-world application scenarios ADDED** (IoT, Automotive, Precision, Audio, FPGA)
- **Comprehensive exercise sets CREATED** (8 sets, ~100 problems)
- **Progressive difficulty structure IMPLEMENTED** (Level 1-4 per set)
- **Complete design projects ADDED** (5 mini-projects)

### Final Curriculum Summary (v3.1 - Complete Edition)

| Module | Topic | Lessons |
|--------|-------|---------|
| 1-15 | Core Analog Fundamentals | 52 |
| 16-19 | Practical Troubleshooting | 13 |
| 20 | Real-World Application Scenarios | 5 scenarios |
| 21 | Comprehensive Exercise Sets | 8 sets (~100 problems) |
| **Total** | | **65+ lessons, 5 scenarios, ~100 exercises** |

### Ready for Implementation
The curriculum is now comprehensive enough to:
1. Build intuition for encountering real hardware problems
2. Practice with progressive difficulty exercises
3. Apply knowledge to realistic scenarios
4. Develop systematic troubleshooting skills

### Next Step: HTML5 Implementation Planning

- **Context mitigation**: Using subagents for PDF reads
