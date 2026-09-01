# Prompt for the Circuit Toy agent

Paste everything below the line into an agent working in the `circuit_toy` repo.

The numbers in it are not estimates. They were measured across the 196 circuits
that the EE_Review course now asks a reader to build, by parsing the SPICE
netlists those circuits came from before they were converted into build tables
(`tools/despice.js`, commit `ca75395`). Regenerate them any time with
`node tools/analyze-netlists.js` against the pre-conversion revision.

---

## Context

You are working on **Circuit Toy** (`github.com/jfalvarez1/circuit_toy`), a
browser circuit simulator.

Its sibling project **EE_Review** (`github.com/jfalvarez1/EE_Review`) is a
368-lesson electronics course covering four semesters. That course used to embed
SPICE netlists. It no longer does — a wall of netlist syntax teaches a file
format rather than electronics, and teaches it to a reader who has no simulator
open. Every netlist has instead been translated into a **build table**: a list of
parts with values and connections, plus what to run and what to watch, pointing
at Circuit Toy.

There are **193 such tables across 163 lessons**. Circuit Toy is the recommended
pairing for all of them. This document is the measured list of what those
circuits actually require in order to be buildable and runnable.

**Your job is to close the gaps between what Circuit Toy supports today and what
that list requires — in priority order, smallest first.**

## Step 0 — inventory before you build anything

Do not assume any of this is missing. Before writing code:

1. Read the repo and list what element types, source waveforms, analysis types
   and device models Circuit Toy supports **today**.
2. Produce a table of *required* vs *present* vs *gap*, using the tiers below.
3. Only then propose an order of work, and say what you would do first and why.

Report that inventory before making changes.

## The scale, which is the most important fact here

| Measure | Value |
|---|---|
| Circuits | 196 |
| Elements, total | 1,754 |
| Elements per circuit, median | **8** |
| Elements per circuit, 90th percentile | 15 |
| Elements, largest single circuit | **27** |
| Nodes, largest single circuit | **32** |

These are small circuits. Consequences you should take seriously, because they
remove a great deal of work:

- **A dense MNA solve is entirely adequate.** A 32×32 matrix is nothing. Do not
  build a sparse matrix package, do not implement Markowitz ordering, do not
  write a KLU binding.
- **Newton–Raphson with a simple damping scheme is enough.** No continuation or
  gmin-stepping homotopy is needed for circuits this size, though a gmin ramp is
  a cheap insurance policy against a few of the switching ones.
- **Do not optimise for speed before correctness.** Nothing here is large enough
  to be slow if the algorithm is right.

## Tier 1 — required. Most of the 193 circuits cannot be built without these

Counts are total uses across all 196 circuits.

### Elements

| Element | Uses | Note |
|---|---|---|
| `R` resistor | 533 | |
| `V` voltage source | 411 | |
| `C` capacitor | 225 | |
| **`E` voltage-controlled voltage source** | **96** | see below — this is the one people miss |
| `X` subcircuit instance | 91 | |
| `M` MOSFET | 68 | |
| `L` inductor | 68 | |
| `Q` BJT | 59 | |
| `D` diode | 46 | |
| `I` current source | 42 | |

**The VCVS is not optional and it is not niche.** It is the fourth most-used
element in the whole corpus, ahead of MOSFETs and BJTs, because *every ideal
op-amp in the course is one*:

```
E1 OUT 0 IN+ IN- 100k
```

48 op-amp instances are built this way. If Circuit Toy has a native op-amp
block, that covers most of the need — but a general VCVS is more useful, because
the course also uses it for error amplifiers, sense amplifiers and gain blocks.

### Source waveforms

| Function | Uses |
|---|---|
| DC | 291 |
| `PULSE(v1 v2 td tr tf pw per)` | 74 |
| `SIN(offset amplitude freq)` | 55 |
| AC magnitude (for sweeps) | 19 |
| `PWL(t1 v1 t2 v2 ...)` | 11 |

### Analyses

| Analysis | Uses | Note |
|---|---|---|
| Transient | 130 | typical: 10 ns–100 µs steps, 5 µs–50 ms spans |
| AC sweep | 38 | **all of them logarithmic** — 20–100 points/decade, 1 Hz to 1 GHz |
| DC sweep | 33 | one source swept; e.g. `VBE 0.5 0.8 0.001`, `VGS 0 10 0.1` |
| Operating point | 24 | |

Note that **one DC sweep sweeps temperature rather than a source**
(`-40 125 5`). If that is awkward, it is fine to skip — it is a single circuit.

### Device models

| Model type | Uses |
|---|---|
| NMOS | 36 |
| Diode | 29 |
| NPN | 19 |
| PMOS | 12 |
| PNP | 3 |

**Model sophistication required is low.** The course teaches with the square-law
MOSFET and an Early-effect BJT, and says so explicitly. A Level-1 MOSFET
(`VTO`, `KP`, `LAMBDA`, `W`, `L`) and a Gummel–Poon-lite BJT (`IS`, `BF`, `VAF`,
plus `CJE`/`CJC`/`TF` for the frequency lessons) will reproduce every result the
lessons predict. Do not implement BSIM.

The specific BJT parameters the course names and expects to matter are:
`IS`, `BF`, `BR`, `VAF`, `VAR`, `NF`, `NR`, `TF`, `TR`, `CJE`, `CJC`, `VJE`.
Lesson `module-05/lesson-27` is a whole lesson about reading these, so matching
those names exactly is worth doing.

## Tier 2 — the power-electronics module needs these (74 uses)

| Element | Uses | Detail |
|---|---|---|
| `S` voltage-controlled switch | 41 | Two model forms appear: `SW(RON=10 ROFF=1MEG VT=1.5)` and `VSWITCH(RON=1 ROFF=1MEG VON=2.5 VOFF=0.5)` |
| `B` behavioural source | 33 | arbitrary expression sources |
| `.param` | 67 | parameterised values: `{VIN}`, `{DUTY/600k}`, `{1/600k}` |

The behavioural sources are used for averaged converter models. These are real
expressions from the corpus, and they define the function set you would need:

```
BRECT  VIN_RECT GND  V = ABS(V(VIN_AC_NODE))
BDUTY  DUTY GND      V = 1 - V(VIN_RECT)/V(VBUS)
BPWM   DUTY GND      V = LIMIT(V(CEA_OUT)/5, 0.05, 0.95)
BLIM   out_int out_lim  I = LIMIT(V(out_int)/0.01, -0.1, 0.1)
BMULT  IREF GND      V = V(VEA_INT)*ABS(V(VIN))/(120*120)
B1     Q 0           V = V(vcc)/2 * (1 + tanh(100*(V(thr)-V(vcc)*2/3)) - ...)
BDELAY DOUT 0        V = DELAY(V(DIN), 800n)
```

So: `V(node)`, arithmetic, `ABS`, `LIMIT`, `tanh`, and `DELAY`. Everything except
`DELAY` is trivial; `DELAY` needs a history buffer, and appears **once**, so it
is reasonable to defer it and say so.

## Tier 3 — genuinely optional (33 uses between them)

`G` VCCS 10 · `T` transmission line 9 · `F` CCCS 7 · `K` magnetic coupling 6 ·
`H` CCVS 1 · `.noise` 3 · `.ic` 3 · `.four` 2 · `.measure` 14 · `.step` 1 ·
`.temp` 1

`K` (6 uses) is what makes transformers and flyback converters work, so it is
the most valuable of these if the power module matters to you.

## The feature that matters more than any element

The course does not hand the reader a netlist. It hands them a **table**:

| Part | What | Value | Connect |
|---|---|---|---|
| `R1` | Resistor | 10 kΩ | between `in` and `vm1` |
| `Q1` | Transistor (BJT) | 2N3904 | collector `col`, base `base`, emitter `emit` |
| `VIN` | Voltage source | sine 10 mV at 1 kHz | from `in` to ground |

Node names are the linking mechanism — **anything sharing a name is one wire**,
and `ground` is the reference node.

So the single highest-value feature is a fast path from that table to a working
circuit. In descending order of value:

1. **Paste a table (or a simple text list) and get a circuit.** Even a rough
   parser that accepts `R1 in vm1 10k` one per line would do it, as long as it
   is documented in Circuit Toy's own UI. This makes all 193 tables one
   copy-paste away from running.
2. **Name nodes explicitly.** If a user can label a wire `vm1` and have another
   part attach to `vm1` by name, the tables transfer directly without any
   import feature at all.
3. Auto-placement/auto-routing so a pasted circuit is legible rather than a
   pile. Nice, not necessary.

If you build only one thing from this document, build (1) or (2).

## Acceptance tests

Three real circuits from the course, in increasing difficulty. Each should be
buildable and produce the stated result.

### 1. Non-inverting amplifier — tests VCVS/op-amp, DC, `.op`

From `lessons/module-01/lesson-02.html`.

```
VCC  vcc 0  DC 15
VEE  vee 0  DC -15
VIN  in  0  DC 1.0
XU1  in vminus out  OPAMP_IDEAL     (E1 OUT 0 IN+ IN- 100k)
R1   vminus 0   1k
RF   vminus out 3k
```

Operating point. **Expected: `V(out) = 4.00 V`** (gain = 1 + 3k/1k).

### 2. Common-emitter amplifier — tests BJT, coupling caps, AC sweep

From `lessons/module-05/lesson-06.html`.

```
VCC   vcc 0     DC 12
VIN   in 0      SIN(0 10m 1k)
R1    vcc base  47k
R2    base 0    5.6k
Q1    col base emit   2N3904        ; IS=1e-14 BF=150 VAF=100
RC    vcc col   6k
RE    emit 0    600
CIN   in base   10u
COUT  col out   10u
RLOAD out 0     10k
```

**Check the operating point first — it is half the test.** Expected:
`V(base) = 1.28 V`, `V(emit) = 0.58 V`, `I(C) ≈ 0.96 mA`, and
**`V(col) ≈ 6.2 V`**, near mid-supply.

Then the AC sweep, 10 Hz to 1 MHz: a **midband gain near −9.6**
(`−RC/(RE + re)` with `re = 26 Ω`), rolling off at low frequency where the
10 µF coupling capacitors work against the input and load impedances.

> Note `R2 = 5.6k`. It was `10k` until this document was written, which put
> 2.34 mA through a 6 kΩ collector resistor — 14 V of drop from a 12 V supply,
> so the transistor saturated and the stage had no gain at all. It was found by
> `tools/check-bias.js` in EE_Review and fixed there. If your solver reports
> saturation for this circuit, check you used 5.6k.

### 3. Synchronous buck converter — tests MOSFETs, inductor, pulse sources, transient

From `lessons/module-13/lesson-02.html`.

```
VIN      vin 0        DC 12
VGATE_H  gate_h 0     PULSE(0 12 ... period 833n)
VGATE_L  gate_l 0     PULSE(12 0 ... period 833n)
M1       vin gate_h sw     NMOS_SW
M2       sw  gate_l 0      NMOS_SW
L1       sw vout      10u
COUT     vout 0       100u
RLOAD    vout 0       5
```

Transient, 100 µs in 10 ns steps. **Expected: `V(vout)` settles near 12 V × duty
cycle**, with visible inductor ripple. This is the one that will find your
solver's weak spots — switching discontinuities, timestep control, and initial
transient.

## What NOT to build

Explicitly out of scope; do not spend time here:

- **Sparse matrix solvers, matrix ordering, iterative linear solvers.** 32 nodes.
- **SPICE netlist file import/export as a compatibility goal.** The course
  deliberately contains no netlists. A simple line-based paste format is useful;
  bit-compatibility with LTspice is not.
- **BSIM or any modern compact model.** Square-law and Gummel–Poon are what the
  lessons teach and what their predictions assume.
- **Monte Carlo, corner analysis, optimisation, parameter stepping.** `.step`
  appears once.
- **Noise analysis** unless it is cheap — 3 uses.
- **S-parameters, harmonic balance, RF-specific analyses.** Not used.

## One caveat worth knowing

The translation from netlists to tables made pre-existing errors in the original
netlists visible for the first time. For example `module-26/lesson-02`'s boost
driver contains `Msw sw 0 pwm_gate NMOS_SW` — drain, gate, source — which puts
the switching MOSFET's gate on ground. Buried in SPICE nobody noticed; as a
table row reading "gate ground" it is obvious.

These were translated faithfully rather than silently corrected. If a course
circuit does not behave, **check the table against the physics before assuming
Circuit Toy is wrong** — and report it, because it is a bug in EE_Review that
should be fixed there.

Two have already been found and fixed this way, both by working out the DC
operating point by hand before trusting an AC or transient result:

- `module-05/lesson-06` — a common-emitter stage asking 2.34 mA through 6 kΩ
  from a 12 V supply. Saturated. `R2` corrected 10k → 5.6k.
- `module-05/lesson-16` — a distortion demo asking 14 mA through 100 Ω, wanting
  66 V of drop from 12 V. Saturated. The emitter was split into an unbypassed
  100 Ω for the AC degeneration the lesson is about, plus a bypassed 820 Ω for
  DC stability, and `R2` corrected to 7.5k.

EE_Review now carries `tools/check-bias.js`, which sweeps every four-resistor
BJT stage in every build table and computes its operating point. **This is the
single most useful class of check for a course that hands out circuits to
build**, and an equivalent inside Circuit Toy — a warning when a transistor's
computed operating point is saturated or cut off — would be worth more to a
learner than any number of analysis features. A simulator that says "this
transistor is saturated, so the small-signal result below is meaningless" is
teaching; one that silently linearises about a broken bias is not.
