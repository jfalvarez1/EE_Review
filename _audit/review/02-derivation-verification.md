# Derivation Verification — Sensors and Instrumentation

**Scope reviewed** (read-only; no lesson file was modified):

| File | Topic |
|---|---|
| `lessons/module-18/lesson-03.html` | RTD signal conditioning, ratiometric measurement |
| `lessons/module-18/lesson-06.html` | RTD + thermocouple interfaces, 4-wire Kelvin |
| `lessons/module-18/lesson-07.html` | Strain gauge Wheatstone bridges |
| `lessons/module-23/lesson-06.html` | ECG front end, right-leg drive |
| `lessons/module-20/lesson-03.html` | RS-232 / RS-485 transceivers |

For each lesson I took the **"Build it in Circuit Toy" component table as the sole authority on the
netlist** — every claim in the `SimCheckWidget` `expect` and `why` fields must follow from that table
and nothing else. Where a claim requires a component, a parasitic or a device non-ideality that the
table does not contain, I have recorded it as a mismatch rather than as an approximation, because the
widget presents these as values the reader will read off a solver.

CSS, SVG and canvas drawing code were ignored, as instructed. Static HTML placeholder values inside
the interactive read-out panels *were* checked against the JavaScript that overwrites them, because
several of them are stale and disagree with the model on the same page.

Convention: `≐` means "equals to the digits shown".

---

## 1. Module 18, Lesson 07 — Quarter and full strain-gauge bridge

### 1.1 First principles required

1. **Ohm's law**, `V = IR`, for a linear two-terminal resistor.
2. **KCL / KVL**, sufficient to reduce two independent series branches across one ideal source to
   two voltage dividers. No current couples the two halves because the only element between the
   mid-nodes is the amplifier's sense input.
3. **The ideal voltage source axiom**: `V_ex` holds 5.000 V independent of the 14.3 mA the bridge
   draws, i.e. zero source impedance and zero lead resistance from source to `bridge_top`.
4. **The ideal VCVS axiom**: `E_inamp` draws zero input current, so the bridge is unloaded, and
   delivers `A·(V+ − V−)` with no offset, no finite CMRR, no bandwidth limit and no output rails.
5. **The strain-gauge constitutive law** (the one piece of non-circuit physics):
   `ΔR/R₀ = GF · ε`, with GF a constant of the alloy, ε the axial strain, and no transverse
   sensitivity and no temperature term.
6. **Superposition is *not* available** — the divider is a ratio, and the result is nonlinear in ΔR.
   That nonlinearity is exactly the phenomenon the lesson is teaching, so it must be derived, not
   linearised.

### 1.2 Netlist under test (from the component table, lines ~243–250)

```
V_ex   5 V DC          bridge_top → gnd
R1     350 Ω           bridge_top — vplus
R2     350 Ω           bridge_top — vminus
R3     353.5 Ω         vplus      — gnd      (active gauge)
R4     350 Ω           vminus     — gnd
E_inamp  VCVS gain 100  out → gnd, sensing (vplus − vminus)
```

### 1.3 Re-derivation, every step

**Step 0 — the gauge value.** GF = 2, ε = 5 mε = 5.000×10⁻³.

```
ΔR/R₀ = GF · ε = 2 × 5.000×10⁻³ = 1.000×10⁻²      (1.000 %)
ΔR    = 350 Ω × 1.000×10⁻² = 3.500 Ω
R3    = 350 + 3.5 = 353.500 Ω                       ✔ matches the table
```

**Step 1 — the reference half.** R2 and R4 form an unloaded divider (E_inamp takes no current):

```
V(vminus) = V_ex · R4/(R2 + R4)
          = 5 · 350/(350 + 350)
          = 5 · 350/700
          = 5 · 0.500000
          = 2.500000 V
```

**Step 2 — the active half.**

```
V(vplus) = V_ex · R3/(R1 + R3)
         = 5 · 353.5/(350 + 353.5)
         = 5 · 353.5/703.5
```
Long division: `703.5 × 2.5 = 1758.75`; `5 × 353.5 = 1767.5`; remainder `1767.5 − 1758.75 = 8.75`;
`8.75/703.5 = 0.01243781`. Hence
```
V(vplus) = 2.50000000 + 0.01243781 = 2.51243781 V   ≐ 2.51244 V
```

**Step 3 — the bridge output, exact closed form.** Let R = 350, ΔR = 3.5.

```
V_d = V_ex [ (R+ΔR)/(2R+ΔR) − R/(2R) ]
    = V_ex [ (R+ΔR)/(2R+ΔR) − 1/2 ]
    = V_ex [ (2(R+ΔR) − (2R+ΔR)) / (2(2R+ΔR)) ]
    = V_ex [ (2R + 2ΔR − 2R − ΔR) / (2(2R+ΔR)) ]
    = V_ex · ΔR / (2(2R+ΔR))                              … (Eq. 1, exact)
```
Substituting:
```
V_d = 5 × 3.5 / (2 × 703.5) = 17.5 / 1407 = 0.012437811 V = 12.4378 mV
```

**Step 4 — the textbook (linearised) form.** Drop ΔR from the denominator of Eq. 1:

```
V_d,lin = V_ex · ΔR / (4R) = V_ex · (GF·ε) / 4
        = 5 × 2 × 0.005 / 4 = 0.050/4 = 0.012500 V = 12.500 mV
```

**Step 5 — the size of the error, in closed form.**

```
V_d / V_d,lin = [ΔR/(2(2R+ΔR))] / [ΔR/(4R)] = 4R / (2(2R+ΔR)) = 2R/(2R+ΔR)
              = 700/703.5 = 0.9950249
shortfall = 1 − 0.9950249 = 0.4975 %  ≐ 0.5 %
```
Note the general result this exposes: the fractional shortfall is `ΔR/(2R+ΔR) ≈ GF·ε/2`, i.e. it is
**half the fractional resistance change** and grows linearly with strain — which is precisely the
lesson's claim that "it grows with strain".

**Step 6 — amplifier output.** `V(out) = 100 × 0.012437811 = 1.2437811 V ≐ 1.2438 V`.

**Step 7 — common-mode voltage.**
```
V_cm = (2.51243781 + 2.50000000)/2 = 5.01243781/2 = 2.50621891 V ≐ 2.506 V
```

**Step 8 — CMRR required for 0.1 % of signal.** Referred-to-input common-mode error is
`V_cm / CMRR_lin`. Requiring it ≤ 10⁻³ × V_d:
```
CMRR_lin ≥ V_cm / (10⁻³ · V_d) = 2.50621891 / (1.2437811×10⁻⁵) = 201 500
CMRR_dB  = 20 log₁₀(201 500) = 20 × 5.30449 = 106.09 dB          ≐ 106 dB
```

**Step 9 — full bridge (Experiment 2).** R1 = R4 = 346.5, R2 = R3 = 353.5:
```
V(vplus)  = 5 × 353.5/(346.5 + 353.5) = 5 × 353.5/700 = 5 × 0.505 = 2.525000 V
V(vminus) = 5 × 346.5/(353.5 + 346.5) = 5 × 346.5/700 = 5 × 0.495 = 2.475000 V
V_d       = 2.525000 − 2.475000 = 0.050000 V = 50.000 mV          exactly
```
And symbolically, which is the claim actually being made:
```
V_d = V_ex [ (R+ΔR)/((R−ΔR)+(R+ΔR)) − (R−ΔR)/((R+ΔR)+(R−ΔR)) ]
    = V_ex [ (R+ΔR)/(2R) − (R−ΔR)/(2R) ]                (denominators identical: 2R)
    = V_ex · (2ΔR)/(2R) = V_ex · ΔR/R = V_ex · GF · ε
    = 5 × 2 × 0.005 = 0.050 V
```
The ΔR terms cancel out of both denominators, so there is **no ΔR-dependent denominator left and
hence no nonlinearity** — the documentation's algebraic claim is exactly right.

**Step 10 — 10 V excitation (Experiment 3).**
```
V_d = 10 × 3.5/(2 × 703.5) = 35/1407 = 0.0248756 V = 24.876 mV     ≐ 24.9 mV ✔
P   = V²/R_bridge, R_bridge = (R1+R3) ∥ (R2+R4) = 703.5 ∥ 700 = 350.874 Ω
P   = 100/350.874 = 0.28500 W = 285.0 mW                            (doc: 286 mW)
```
The doc computes `10²/700 × 2 = 285.7 mW`, i.e. it uses two nominal 700 Ω legs. Both land on
286 ± 1 mW; the difference is the strained arm, and it is immaterial. `25/350 = 71.4 mW` at 5 V ✔,
and the ratio is exactly 4 because P ∝ V². ✔

**Step 11 — 1 Ω lead in R3's ground return (Experiment 4).** The lead is in series with R3, so the
lower arm of the active half becomes 354.5 Ω while `vplus` remains the R1/R3 junction:
```
V(vplus) = 5 × 354.5/(350 + 354.5) = 5 × 354.5/704.5 = 1772.5/704.5
704.5 × 2.5 = 1761.25;  1772.5 − 1761.25 = 11.25;  11.25/704.5 = 0.01596877
V(vplus) = 2.51596877 V
V_d      = 15.96877 mV                                              ≐ 15.969 mV ✔
Δ        = 15.96877 − 12.43781 = 3.53096 mV                         ≐ 3.5 mV ✔
```
Converting the false reading back to strain through the *exact* Eq. 1 (not the linear one):
```
5 ΔR' = 0.03193754 (700 + ΔR')
5 ΔR' − 0.03193754 ΔR' = 22.35628
4.96806 ΔR' = 22.35628  →  ΔR' = 4.49998 Ω
ε' = (ΔR'/R)/GF = (4.49998/350)/2 = 6.4285 mε
false strain = 6.4285 − 5.000 = 1.4285 mε                           ≐ 1.4 mε ✔
```

### 1.4 Dimensional analysis

- Eq. 1: `[V]·[Ω]/[Ω] = [V]` ✔. The divider ratio is dimensionless, as it must be.
- `V_ex·GF·ε`: `[V] × [1] × [1] = [V]` ✔ (GF is Ω/Ω per m/m — dimensionless; ε is m/m —
  dimensionless). Microstrain is a scaled dimensionless number, not a unit.
- `P = V²/R`: `[V²]/[Ω] = [V·A] = [W]` ✔.
- CMRR: `[V]/[V] = [1]`, then `20 log₁₀(·)` → dB ✔. The factor 20 (not 10) is correct because the
  argument is an amplitude ratio.
- Strain from ΔR: `([Ω]/[Ω])/[1] = [1]` ✔.

### 1.5 VERDICT — Module 18 Lesson 07

**MATCHES for every probe and for Experiments 1–4** (`2.5000 V`, `2.51244 V`, `12.438 mV`,
`1.2438 V`, `2.506 V`, `0 V`, `50.000 mV`, `24.9 mV`, `286 mW`, `71 mW`, `15.969 mV`, `3.5 mV`,
`1.4 mε` all reproduce). This is the cleanest of the five derivations.

**DERIVATION MISMATCH — one, in the CMRR aside of the `cmr` probe.** The text states the CMRR of a
four-resistor difference amplifier is "about `20 log(1/2×tolerance)`" and "lands near **48 dB** with
0.1 % parts". Evaluate the stated formula:

```
20 log₁₀(1/(2 × 0.001)) = 20 log₁₀(500) = 20 × 2.69897 = 53.98 dB
```

The formula gives **54 dB, not 48 dB**. Deriving it properly: for a difference amplifier with
`V_out = V₊·(R4/(R3+R4))(1+R2/R1) − V₋·(R2/R1)` and nominal gain `G = R2/R1`, the worst-case
common-mode gain under independent ±t tolerances is `A_cm ≈ 4t/(1+G)`, so
`CMRR = (1+G)/(4t)`. At G = 1 and t = 0.001: `2/0.004 = 500 → 53.98 dB`. The stated 48 dB is
`20 log₁₀(1/(4t)) = 20 log₁₀(250) = 47.96 dB`, i.e. the `(1+G)` numerator has been dropped. **The
quoted formula and the quoted number are 6 dB apart and cannot both be right; the number is the
wrong one.** The pedagogical conclusion (a discrete difference amp is ~58 dB short of the 106 dB
needed) survives either way.

### 1.6 Secondary discrepancies in Lesson 07 (outside the SimCheck block)

- **Stale static read-outs.** The markup ships `Bridge Output 2.50 mV` and `Power Dissipation
  35.7 mW`. The page's own `calculateBridge()` returns `−2.498 mV` (note the **sign**: in the
  interactive the active gauge is R1, the *upper* arm, so the output is negative, whereas in the
  Circuit Toy netlist it is R3, the lower arm, giving positive — the two models on one page use
  opposite polarity conventions) and `71.4 mW` (the static 35.7 mW is one 700 Ω leg only, i.e. half
  the bridge). Both statics are overwritten on `DOMContentLoaded`, so they are cosmetic, but a
  reader comparing the page to the SimCheck will see three different bridge outputs.
- **R_G inconsistency.** The interactive labels the field "R_G (for INA128)" and ships `252 Ω`
  statically, while the JS computes `50000/(gain−1) = 50000/199 = 251.26 → "251 Ω"`. The Circuit Toy
  table instead uses `1 + 49.4k/499`, which is the **AD620** gain equation, not the INA128's
  (50 kΩ). `1 + 49400/499 = 1 + 99.0 = 99.998`, quoted as "= 100.0"; the 0.002 % is harmless but the
  49.4 k / 50 k mixture inside one lesson is not.

---

## 2. Module 18, Lesson 06 — 4-wire RTD, Kelvin connection, Callendar–Van Dusen

### 2.1 First principles required

1. **Ohm's law** and **KVL around a single series loop**.
2. **The ideal current source axiom**: `I_ex` delivers exactly 1.000 mA into whatever the loop
   presents, with unlimited compliance voltage and zero temperature drift.
3. **The Kelvin (four-terminal) principle**, which is a corollary of KCL plus the ideal-VCVS
   axiom: if a sense branch carries `I = 0`, then any resistance in it drops `IR = 0` regardless of
   R. This is *exact*, not approximate — it is the whole content of the lesson.
4. **Callendar–Van Dusen** as the constitutive law of platinum:
   - `T ≥ 0`: `R(T) = R₀(1 + A·T + B·T²)`
   - `T < 0`: `R(T) = R₀(1 + A·T + B·T² + C·(T − 100)·T³)`
   with `A = 3.9083×10⁻³ °C⁻¹`, `B = −5.775×10⁻⁷ °C⁻²`, `C = −4.183×10⁻¹² °C⁻⁴`, `R₀ = 100 Ω`.
5. **Reference-junction / grounding**: the excitation must have a DC return path — supplied here by
   `R_ref` — otherwise the node equations are singular.

### 2.2 Independent evaluation of Callendar–Van Dusen

**At T = 0 °C** — trivially `R = R₀(1 + 0 + 0) = 100.00 Ω`. ✔

**At T = 100 °C:**
```
A·T   = 3.9083×10⁻³ × 100        = 0.390830
B·T²  = −5.775×10⁻⁷ × 10 000     = −0.0057750
sum   = 1 + 0.390830 − 0.005775  = 1.385055
R     = 100 × 1.385055           = 138.5055 Ω        ≐ 138.51 Ω ✔
```

**At T = 500 °C:**
```
A·T   = 3.9083×10⁻³ × 500        = 1.9541500
B·T²  = −5.775×10⁻⁷ × 250 000    = −0.1443750
sum   = 1 + 1.9541500 − 0.1443750 = 2.8097750
R     = 280.9775 Ω                                    ≐ 280.98 Ω ✔
```

**At T = −50 °C** (the cubic branch applies):
```
A·T           = 3.9083×10⁻³ × (−50)                    = −0.1954150
B·T²          = −5.775×10⁻⁷ × 2 500                    = −0.00144375
T³            = (−50)³ = −125 000
(T − 100)     = −150
C(T−100)T³    = −4.183×10⁻¹² × (−150) × (−125 000)
              = −4.183×10⁻¹² × 1.875×10⁷              = −7.84313×10⁻⁵
sum           = 1 − 0.1954150 − 0.00144375 − 0.0000784 = 0.8030628
R             = 80.30628 Ω                             ≐ 80.31 Ω ✔
```

**And the check value at −200 °C in the characteristics table:**
```
A·T = −0.781660 ; B·T² = −5.775×10⁻⁷ × 40 000 = −0.023100
C(T−100)T³ = −4.183×10⁻¹² × (−300) × (−8×10⁶) = −4.183×10⁻¹² × 2.4×10⁹ = −0.01003920
sum = 1 − 0.781660 − 0.023100 − 0.010039 = 0.185201  →  R = 18.5201 Ω   ≐ 18.52 Ω ✔
```

All four headline Pt100 values and the −200 °C table entry reproduce exactly. **MATCHES.**

### 2.3 Netlist and node voltages

```
I_ex     1 mA DC        gnd → rtd_force_p
R_lead1  2 Ω            rtd_force_p — rtd_p
R_rtd    138.51 Ω       rtd_p       — rtd_n
R_lead2  2 Ω            rtd_n       — rtd_force_n
R_ref    100 Ω          rtd_force_n — gnd
R_lead3  2 Ω            rtd_p       — sense_p
R_lead4  2 Ω            rtd_n       — sense_n
E_inamp  VCVS gain 10   out → gnd, sensing (sense_p − sense_n)
```

**Step 1 — the loop current.** The only closed path for `I_ex` is
`gnd → rtd_force_p → R_lead1 → R_rtd → R_lead2 → R_ref → gnd`. The sense branches terminate on
E_inamp's control terminals, which by axiom (3) draw zero current, so `I(R_lead3) = I(R_lead4) = 0`
and the loop current is exactly 1.000 mA everywhere in the force path.

**Step 2 — node voltages, walking the loop from ground up.**
```
V(rtd_force_n) = I·R_ref   = 1.000×10⁻³ × 100    = 0.100000 V = 100.00 mV ✔
V(rtd_n)       = 100.00 + 1×10⁻³ × 2 ×10³ mV     = 100.00 + 2.00 = 102.00 mV
V(rtd_p)       = 102.00 + 1×10⁻³ × 138.51 ×10³   = 102.00 + 138.51 = 240.51 mV
V(rtd_force_p) = 240.51 + 2.00                    = 242.51 mV ✔
```

**Step 3 — the Kelvin result.** Zero current in R_lead3 ⇒ `V(sense_p) = V(rtd_p) = 240.51 mV` ✔,
identically, to all digits. Likewise `V(sense_n) = V(rtd_n) = 102.00 mV`.
```
V(sense_p) − V(sense_n) = 240.51 − 102.00 = 138.51 mV = I·R_rtd ✔
V(out) = 10 × 138.51 mV = 1385.10 mV = 1.38510 V ✔
```

**Step 4 — the two-wire error (Experiment 2).**
```
V(rtd_force_p) − V(rtd_force_n) = 242.51 − 100.00 = 142.51 mV
error = 142.51 − 138.51 = 4.00 mV = I × (2 + 2) Ω    ✔ "both 2 Ω leads"
relative = 4.00/138.51 = 2.8879 %                     ≐ 2.9 % ✔
```
Temperature error, as the doc computes it (constant 0.385 Ω/°C):
`4.00 Ω / 0.385 Ω·°C⁻¹ = 10.390 °C` ≐ 10.4 °C ✔ **against its own stated method.**

But the *correct* answer requires inverting CVD, since 0.385 is the 0–100 °C secant, not the local
slope. Local slope at 100 °C:
```
dR/dT = R₀(A + 2BT) = 100(3.9083×10⁻³ + 2(−5.775×10⁻⁷)(100))
      = 100(3.9083×10⁻³ − 1.1550×10⁻⁴) = 100 × 3.79280×10⁻³ = 0.37928 Ω/°C
→ 4.00/0.37928 = 10.546 °C
```
Exact inversion of `100(1 + AT + BT²) = 142.51`:
```
3.9083×10⁻³ T − 5.775×10⁻⁷ T² = 0.42510
T = 110: 0.4299130 − 0.0069878 = 0.4229252   (low)
T = 110.6: 0.4322580 − 0.0070641 = 0.4251939 (high by 0.0000939)
T ≈ 110.58 °C  →  error = 10.58 °C
```
So the true figure is **10.58 °C**, not 10.4 °C — a 1.7 % understatement, comfortably inside the
lesson's own "over ten degrees" language. Recorded as an unstated idealization (linear-slope
inversion), not a mismatch.

**Step 5 — 20 Ω leads (Experiment 1).**
```
V(rtd_force_p) = 100 + 20 + 138.51 + 20 = 278.51 mV                ≐ 278.5 mV ✔
V(sense_p) − V(sense_n) = 138.51 mV, unchanged, because 20 Ω × 0 A = 0 ✔
```

**Step 6 — R_ref → 1 kΩ (Experiment 4).**
```
ΔV = I·ΔR = 1×10⁻³ × (1000 − 100) = 0.900 V, added to every force-loop node ✔
V(out) unchanged, because the amplifier senses a difference that does not include R_ref ✔
```

**Step 7 — the gain choice.** Span at 1 mA: 80.31 mV → 280.98 mV.
`×10 → 0.8031 V to 2.8098 V`, inside 3.3 V ✔. `×100 → 8.031 V to 28.098 V` ✔ "would ask for 28 V".

### 2.4 Dimensional analysis

- CVD: `A·T` = `[°C⁻¹][°C] = [1]`; `B·T²` = `[°C⁻²][°C²] = [1]`; `C(T−100)T³` =
  `[°C⁻⁴][°C][°C³] = [1]`. Summed with the dimensionless 1 and multiplied by `R₀ [Ω]` → `[Ω]` ✔.
  The coefficient exponents (−3, −7, −12) and the powers of T are mutually consistent.
- `I·R`: `[A][Ω] = [V]` ✔. 1 mA × 100 Ω = 100 mV — the mA/kΩ→V shortcut is used correctly
  throughout.
- `ΔR/(dR/dT)`: `[Ω]/[Ω·°C⁻¹] = [°C]` ✔.
- Gain: dimensionless ✔.

### 2.5 VERDICT — Module 18 Lesson 06

**MATCHES for all five probes and for Experiments 1, 2 and 4.**

**DERIVATION MISMATCH — Experiment 3, "Break one sense lead: make R_lead3 1 GΩ."**
Claimed result: *"The output goes to a rail, or to something meaningless."*

Derive it from the stated netlist. After the change, node `sense_p` connects to exactly two things:
`R_lead3` (1 GΩ, to `rtd_p`) and E_inamp's non-inverting control terminal (infinite impedance by
axiom 3). KCL at `sense_p`:
```
(V(rtd_p) − V(sense_p))/10⁹ + 0 = 0   →   V(sense_p) = V(rtd_p) = 240.51 mV
```
A resistor carrying zero current drops zero volts **whether it is 2 Ω or 1 GΩ** — which is the very
theorem the rest of the lesson relies on. Therefore `V(out)` is **unchanged at 1.38510 V**. The
prediction is wrong for the circuit as tabulated. The `why` field itself names the missing physics
("the amplifier input is now floating at whatever its bias current drives it to"), but **input bias
current is not a property of a VCVS and is nowhere in the component table**, so the reader running
the stated netlist will see nothing happen and conclude the lesson is wrong. Either the table needs
a bias-current source at `sense_p`, or the expected result needs to say "in this ideal model, nothing
changes — and that is itself the warning."

**DERIVATION MISMATCH — self-heating coefficient, internal contradiction.**
- Practice Exercise 1's answer uses **50 °C/W**: `2.74 mW × 50 °C/W = 0.137 °C`.
- The same file's `drawRTDCircuit()` uses `selfHeat = power_mW × 0.5`, i.e. **0.5 °C/mW = 500 °C/W**.
- Module 18 Lesson 03 also uses **0.5 °C/mW** ("11 mW → five degrees").

Check exercise 1 arithmetic on its own terms: `R₂₅ = 100(1 + 0.00385 × 25) = 109.625 Ω` ✔;
`P = (5×10⁻³)² × 109.625 = 2.5×10⁻⁵ × 109.625 = 2.7406×10⁻³ W = 2.74 mW` ✔;
`P_max = 0.1 °C / 50 °C·W⁻¹ = 2.0 mW` ✔; `I = √(2×10⁻³/110) = √1.818×10⁻⁵ = 4.264 mA` ✔. The
arithmetic is internally sound — but the coefficient is **10× smaller than the one this page's own
interactive and its sibling lesson use for the same sensor in the same still-air condition.** One of
the two is wrong; they cannot both describe a Pt100.

### 2.6 Secondary discrepancies in Lesson 06

- **Sensitivity column, 500 °C row: `0.35 Ω/°C`.** Local slope `R₀(A + 2B·500) = 100(3.9083×10⁻³ −
  5.775×10⁻⁴) = 0.33308 Ω/°C`; the 400→500 secant is `(280.9775 − 247.0920)/100 = 0.33886 Ω/°C`.
  Neither is 0.35 — the entry is ~4 % high. (The −200 row's 0.42 *is* the −200→−100 secant, 0.4174,
  and the 0/100 rows' 0.385 is the 0–100 secant, so the column is otherwise consistently "secant".)
- **Stale static read-outs**, all four disagreeing with the JS that overwrites them: self-heating
  shows `0.01 °C` (JS: 0.055 °C at the defaults); lead error shows `5.2 °C` (JS at the default
  3-wire setting: `2 Ω × 0.1 / 0.385 = 0.52 °C` — off by exactly 10×, and 5.2 is the *one-lead*
  2-wire figure); ADC bits shows `12` (JS: `ceil(log₂(500/0.0385)) = ceil(13.66) = 14`); thermocouple
  total error shows `±1.5 °C` (JS: `√(1² + 2.2²) = ±2.4 °C`); CJC contribution shows `1.00 mV`
  (`25 × 41 µV = 1.025 mV`).
- **Thermocouple total-error RSS hardcodes 2.2 °C** for every TC type, though the same page's table
  gives ±1 °C for Type T and ±1.7 °C for Type E.
- **Thermocouple exercise 2 is arithmetically correct**: `(800−30) × 41 µV = 31.57 mV` ✔;
  `30 × 41 µV = 1.23 mV` ✔; `50 mV/4096 = 12.207 µV` ✔; `12.207/41 = 0.298 °C/LSB` ✔ — but it uses a
  constant Seebeck coefficient over 0–800 °C, where Type K actually runs ~39–41 µV/°C. Unstated.
- **Exercise 3 is arithmetically correct**: `10 × 0.084 × 2 = 1.68 Ω` ✔; `1.68 × 0.00393 × 30 =
  0.19807 Ω` ✔; `1.68/0.385 = 4.364 °C` ✔; `0.198/0.385 = 0.514 °C` ✔; `1.68 × 0.01 = 16.8 mΩ →
  0.0436 °C` ✔.

---

## 3. Module 18, Lesson 03 — Ratiometric RTD, and the linear-α error at 500 °C

### 3.1 First principles required

1. Ohm's law, KVL around the excitation loop.
2. Ideal current source (unlimited compliance) and ideal VCVS (zero input current) — same axioms as §2.
3. **The ratiometric principle**: if a converter's result is `V_signal/V_reference` and both are
   produced by the same current, the current divides out. This requires the *same* current in both
   — guaranteed here only because `R_ref` is in series with the RTD in a single loop.
4. **Single-pole RC response** for the anti-alias filter: `f₋₃dB = 1/(2πRC)`, and the fact that a
   capacitor is an open circuit at DC.
5. Callendar–Van Dusen (for the comparison), and the **linear approximation**
   `R(T) = R₀(1 + α T)` with `α = 0.00385 °C⁻¹` — where α is defined as the *0–100 °C mean*
   fractional slope, `(R₁₀₀ − R₀)/(100 R₀)`, not the derivative at any single point.

### 3.2 Netlist

```
IEX     1 mA DC     gnd → rtd_hi
RRTD    109.63 Ω    rtd_hi — rtd_lo
RLEAD1  1 Ω         rtd_hi — sense_hi        (sense lead)
RLEAD2  1 Ω         rtd_lo — sense_lo        (sense lead)
RREF    1 kΩ        rtd_lo — gnd
EAMP    gain 10     amp_out → gnd, sensing (sense_hi − sense_lo)
RFILT   1 kΩ        amp_out — adc_in
CFILT   100 nF      adc_in — gnd
```

### 3.3 Re-derivation

**Step 1 — RRTD's value.** `100(1 + 0.00385 × 25) = 100 × 1.096250 = 109.625 Ω ≐ 109.63 Ω` ✔
(linear form, as the `why` states).

**Step 2 — the loop.** Only path: `gnd → rtd_hi → RRTD → rtd_lo → RREF → gnd`. Sense leads carry
zero current (EAMP input); CFILT is open at DC. So `I = 1.000 mA` throughout.
```
V(rtd_lo)   = 1×10⁻³ × 1000    = 1.000000 V                          ✔ expect 1.000 V
V(rtd_hi)   = 1.000 + 1×10⁻³ × 109.63 = 1.000 + 0.109630 = 1.109630 V
V(sense_hi) = V(rtd_hi)   (0 A × 1 Ω = 0)   = 1.109630 V
V(sense_lo) = V(rtd_lo)                     = 1.000000 V
V(sense_hi) − V(sense_lo) = 0.109630 V = 109.630 mV                  ✔ expect 109.63 mV
V(amp_out)  = 10 × 0.109630 = 1.096300 V                             ✔ expect 1.0963 V
V(adc_in)   = V(amp_out) = 1.0963 V  (no DC current through RFILT)   ✔
```

**Step 3 — the filter corner.**
```
f = 1/(2π R C) = 1/(2π × 1×10³ × 100×10⁻⁹) = 1/(2π × 1×10⁻⁴)
  = 1/(6.28319×10⁻⁴) = 1591.55 Hz                                    ≐ 1.59 kHz ✔
```

**Step 4 — the ratio, symbolically.** This is the claim that matters:
```
V(amp_out)/V(rtd_lo) = (A · I · R_RTD)/(I · R_REF) = A · R_RTD/R_REF
                     = 10 × 109.63/1000 = 1.09630                    ✔ expect 1.0963
```
`I` cancels identically — not approximately. ✔

**Step 5 — IEX = 1.5 mA (Experiment 1).**
```
V(rtd_lo)  = 1.5×10⁻³ × 1000  = 1.500000 V ✔
V(amp_out) = 10 × 1.5×10⁻³ × 109.63 = 10 × 0.1644450 = 1.644450 V    ≐ 1.644 V ✔
ratio      = 1.644450/1.500000 = 1.09630                             ✔ unchanged
```

**Step 6 — RLEAD → 100 Ω (Experiment 2).** Zero current ⇒ zero drop ⇒ `V(amp_out)` unchanged ✔.
The aside: a 2-wire connection adds 2 Ω ⇒ `2/0.385 = 5.195 °C` ≐ "five degrees" ✔.

**Step 7 — IEX = 10 mA (Experiment 3).**
```
P = I²R = (10×10⁻³)² × 109.63 = 1×10⁻⁴ × 109.63 = 1.0963×10⁻² W = 10.963 mW  ≐ 11 mW ✔
ΔT = 10.963 mW × 0.5 °C/mW = 5.48 °C                                          ≐ "five degrees" ✔
```

**Step 8 — RREF = 1.001 kΩ (Experiment 4).**
```
ratio' = 10 × 109.63/1001 = 1096.3/1001 = 1.0952048
shift  = (1.0952048 − 1.0963000)/1.0963000 = −0.0009990 = −0.0999 %   ✔ "0.1 %"
```
Converted to temperature: the instrument infers `R̂ = ratio' × R_REF,nominal/A = 1.0952048 × 100 =
109.52048 Ω`, so `ΔR = 109.52048 − 109.63 = −0.10952 Ω`, and
```
ΔT = −0.10952/0.385 = −0.2845 °C                                      ≐ 0.28 °C ✔
```

**Step 9 — the headline claim: a real 500 °C sensor read through the linear model.**
The physical sensor obeys CVD, so at 500 °C its resistance is `280.9775 Ω` (derived in §2.2). An
instrument that inverts the *linear* law reports
```
T̂ = (R − R₀)/(R₀ α) = (280.9775 − 100)/(100 × 0.00385)
   = 180.9775/0.385
```
Long division: `0.385 × 470 = 180.950`; remainder `180.9775 − 180.950 = 0.0275`;
`0.0275/0.385 = 0.0714`. So
```
T̂ = 470.071 °C                                                       ≐ 470 °C ✔
error = 470.071 − 500 = −29.93 °C                                     ≐ "30 degrees out" ✔
```

**Step 10 — the 25 °C comparison.** CVD at 25 °C:
`100(1 + 0.0977075 − 5.775×10⁻⁷ × 625) = 100(1 + 0.0977075 − 0.000360938) = 109.73466 Ω`.
Linear: 109.62500 Ω. Difference `0.10966 Ω`, and `0.10966/0.385 = 0.2848 °C` — the doc says
"0.1 Ω, a quarter of a degree" ✔ (0.28 rounds to "a quarter" generously but not wrongly).

### 3.4 Dimensional analysis

- `T̂ = (R − R₀)/(R₀ α)`: `[Ω]/([Ω][°C⁻¹]) = [°C]` ✔.
- `f = 1/(2πRC)`: `1/([Ω][F]) = 1/([V·A⁻¹][A·s·V⁻¹]) = 1/[s] = [Hz]` ✔.
- Ratio `A·R_RTD/R_REF`: `[1][Ω]/[Ω] = [1]` ✔ — correctly declared with `unit: ''`.
- `P = I²R`: `[A²][Ω] = [W]` ✔; `[W]·[°C/W] = [°C]` ✔.

### 3.5 VERDICT — Module 18 Lesson 03

**MATCHES on every probe and every experiment, including the headline 470 °C / 30 °C claim, which
reproduces to 470.07 °C.** The ratiometric cancellation is exact in this netlist, as claimed.

Two structural observations that are not arithmetic errors but are unstated:

- **The lesson is framed as 3-wire; the netlist is 4-wire with zero force-lead resistance.** The
  wiring dropdown defaults to `3-wire`, the callout warns about the 3-wire `Rlead1 = Rlead2`
  assumption, and the scope description calls this the 3-wire lesson — but the Circuit Toy table
  contains **no third wire and no force-lead resistors at all**: `IEX` connects directly to `rtd_hi`
  and `RREF` directly to `rtd_lo`. The prose in the table's footnote correctly calls it "a Kelvin
  connection", so the *derivation* is sound; it just is not the topology the rest of the page is
  about. A reader who builds the table cannot reproduce any 3-wire behaviour.
- **The 3-wire residual `0.1 × R_lead` ("~10 % mismatch assumed") is an arbitrary constant**, not a
  derived result. Real 3-wire residual is `|R_lead1 − R_lead3|` and depends entirely on cable
  matching; the 10 % figure is unjustified on the page.
- Minor, non-mathematical: `ChecklistWidget` in `module-18/lesson-03.html` uses
  `lessonKey: 'm20l3'`, which will collide with Module 20 Lesson 3's saved progress.

---

## 4. Module 23, Lesson 06 — ECG amplifier and right-leg drive

### 4.1 First principles required

1. **KCL at the body node**, which is the only non-trivial node equation on the page.
2. **Ideal VCVS**: zero input current at the sensing terminals (this is what makes `Rp`/`Rn`
   inert — see below), zero output impedance, exact gain, no rails, infinite bandwidth.
3. **Superposition / linearity**, valid here because every element is LTI.
4. **The definition of common and differential mode**: `V_cm = (V₊+V₋)/2`, `V_d = V₊ − V₋`, and the
   structural fact that a drive derived from `V_cm` is orthogonal to `V_d`.
5. **Single-pole RC high-pass and low-pass**: `f = 1/(2πRC)`.
6. **Negative-feedback loop analysis**: closed-loop response `1/(1+T)` where `T` is loop gain; and
   for a stability claim, **at least one energy-storage element inside the loop** — which is the
   step that fails here.

### 4.2 Netlist reduction

```
Vcm       sine 1 V @60 Hz    cm_src → gnd
Rcouple   1 MΩ               cm_src — cm
E_add_p   gain 1             (inp_cm − inp) = V(cm)
E_add_n   gain 1             (inn_cm − inn) = V(cm)
Rp, Rn    10 kΩ each         inp_cm—inap , inn_cm—inan
X1        ideal INA          pins inap, inan, gnd, out1
Erld1     gain −0.5          V(rld_a)            = −0.5 V(inap)
Erld2     gain −0.5          V(rld) − V(rld_a)   = −0.5 V(inan)
Rrld_out  10 kΩ              rld — rl_electrode
Rbody     50 kΩ              rl_electrode — cm
Vecg±     ±500 µV @1 Hz      inp, inn → gnd
```

**Step 1 — `Rp` and `Rn` carry zero current.** Node `inap` connects only to `Rp`, to X1's input
pin, and to `Erld1`'s sense terminal. Both of the latter are infinite-impedance by axiom (2).
Therefore `I(Rp) = 0` and
```
V(inap) = V(inp_cm) = V(inp) + V(cm)
V(inan) = V(inn_cm) = V(inn) + V(cm)
```
**regardless of the values of Rp and Rn.** Hold this result — it is decisive for Experiment 2.

**Step 2 — the drive voltage.** `V(inp) = +500 µV·sin(2π·1·t)`, `V(inn) = −500 µV·sin(...)`, so
`V(inp) + V(inn) = 0` identically. Then
```
V(rld) = V(rld_a) + (−0.5 V(inan)) = −0.5 V(inap) − 0.5 V(inan)
       = −0.5 [ (V(inp) + V(cm)) + (V(inn) + V(cm)) ]
       = −0.5 [ 0 + 2 V(cm) ] = −V(cm)
```
So the stacked pair realises a gain of exactly **−1 on the common mode and 0 on the differential
mode** ✔ — the documentation's claim that the RLD "is blind to their difference by construction" is
exactly right and follows from `V(inp) + V(inn) = 0`.

**Step 3 — KCL at node `cm`.** The drive reaches `cm` through `Rrld = Rrld_out + Rbody = 10 k +
50 k = 60 kΩ` ✔ (matches the doc's "through 60 kΩ"). Let `Vs = V(cm_src)`, `Vc = V(cm)`,
`Rc = 1 MΩ`. E_add_p/E_add_n sense `cm` and draw no current, so those are the only two branches:
```
(Vs − Vc)/Rc + (V(rld) − Vc)/Rrld = 0
(Vs − Vc)/Rc + (−Vc − Vc)/Rrld    = 0
(Vs − Vc)/Rc = 2Vc/Rrld
Vs/Rc = Vc/Rc + 2Vc/Rrld = Vc (1/Rc + 2/Rrld)
──────────────────────────────────────────────
Vc/Vs = (1/Rc) / (1/Rc + 2/Rrld)                                   … (Eq. 2)
```
This is **algebraically identical to the documentation's `(1/1M)/(1/1M + 2/60k)`.** ✔

The general form is worth stating, because the "2" is not obvious: with RLD common-mode gain `−G`,
```
(Vs − Vc)/Rc = (Vc − (−G Vc))/Rrld = Vc(1 + G)/Rrld
Vc/Vs = (1/Rc)/(1/Rc + (1+G)/Rrld)
```
so the `2` is `(1 + G)` with `G = 1` — **not** two resistors and not two electrodes. The
documentation never says this, and a reader will very likely misread it.

**Step 4 — numbers.**
```
1/Rc   = 1/1×10⁶       = 1.000000×10⁻⁶  S
2/Rrld = 2/6.0×10⁴     = 3.333333×10⁻⁵  S
sum                     = 3.433333×10⁻⁵  S
Vc/Vs  = 1.000000×10⁻⁶ / 3.433333×10⁻⁵ = 0.02912621
Vc     = 29.126 mV peak                                            ≐ 29 mV ✔
reduction = 20 log₁₀(1/0.02912621) = 20 log₁₀(34.33333)
          = 20 × 1.5357272 = 30.715 dB                             ≐ 30.7 dB ✔
```

**Step 5 — the differential signal.**
```
V(inap) − V(inan) = (V(inp) + V(cm)) − (V(inn) + V(cm)) = V(inp) − V(inn)
                  = 500 µV − (−500 µV) = 1.000 mV peak             ✔
```
Untouched by the RLD, exactly ✔.

**Step 6 — filter corners.**
```
high-pass: 1/(2π × 1×10⁶ × 3.20×10⁻⁶) = 1/(2π × 3.20) = 1/20.106 = 0.049736 Hz  ≐ 0.05 Hz ✔
low-pass : 1/(2π × 1×10⁴ × 106×10⁻⁹)  = 1/(2π × 1.06×10⁻³) = 150.15 Hz          ✔ (0.05–150 Hz band)
```
At the 1 Hz signal frequency the high-pass magnitude is `1/√(1+(0.0497/1)²) = 0.99877` and the
low-pass is `1/√(1+(1/150.15)²) = 0.99998` — both negligible, so a DC-style amplitude analysis of
`V(out)` is legitimate ✔.

**Step 7 — the finite-CMRR aside.** `90 dB → 10^(90/20) = 31 623`. `1 V/31 623 = 31.62 µV`;
`31.62 µV / 1 mV = 3.16 %` ✔ arithmetic. See Mismatch M-2 below for why the 1 V input to this
calculation is not what the circuit produces.

### 4.3 Dimensional analysis

- Eq. 2: numerator and denominator are both conductances `[S] = [Ω⁻¹]`; the ratio is dimensionless
  ✔, which is required since it multiplies a voltage.
- `20 log₁₀(dimensionless)` → dB ✔.
- `1/(2πRC)`: `[Hz]` ✔ as in §3.4.
- `V(rld) = −G·V_cm`: `[1][V] = [V]` ✔ — both Erld gains are dimensionless voltage gains, correct
  for a VCVS.
- Body modelled as pure `[Ω]` — dimensionally fine, physically an idealization (see §4.5).

### 4.4 VERDICT — Module 23 Lesson 06

**MATCHES** for probes `cm_raw` (1.000 V), `cm_driven` (29.1 mV, 30.71 dB — the divider expression
is exactly reproducible from KCL), `sig` (1.000 mV), and `hp` (0.0497 Hz).
**MATCHES** for Experiment 4's node list (1 V, 29 mV, 1 mV).

**DERIVATION MISMATCH — three, all in the experiments, plus one missing variable.**

---

**M-1. Experiment 1: "Disable the right-leg drive: set both Erld gains to 0 → V(cm) returns to the
full 1 V."**

Set `G = 0`. A VCVS with gain 0 is a 0 V source, i.e. node `rld` is tied to ground. The 60 kΩ path
from `cm` to ground **does not disappear**; it merely stops being actively driven. Eq. 2 with
`(1+G) = 1`:
```
Vc/Vs = (1/10⁶) / (1/10⁶ + 1/6×10⁴)
      = 1.000000×10⁻⁶ / (1.000000×10⁻⁶ + 1.666667×10⁻⁵)
      = 1.000000×10⁻⁶ / 1.766667×10⁻⁵
      = 0.0566038
V(cm) = 56.60 mV peak,  not 1 V.
```
The claim is wrong by a factor of **17.7**. Worse, it undermines the lesson's own headline: of the
30.71 dB of "reduction" attributed to the right-leg drive,
```
passive contribution   = 20 log₁₀(1/0.0566038) = 20 × 1.246948 = 24.94 dB
active contribution    = 20 log₁₀(56.60/29.13) = 20 log₁₀(1.9430) = 5.77 dB
```
i.e. **24.9 dB of the 30.7 dB comes from the resistive loading of the 60 kΩ electrode path, and only
5.8 dB from turning the amplifier on.** The two statements — "the RLD gives you 30.7 dB" and
"switching it off returns you to 1 V" — are mutually inconsistent, and Eq. 2 shows which one is
false. The follow-on figures (32 µV of leakage, 3 % distortion) inherit the error: at the true
56.60 mV, a 90 dB INA leaks `56.60 mV/31 623 = 1.79 µV`, i.e. **0.18 %, not 3 %**.

*Fix that preserves the intent*: model the coupling path as it physically is — the interference
reaches the body through the mains-coupling capacitance and the body's only other tie to the
amplifier's reference is a high impedance, not a 60 kΩ resistor that exists solely because the RLD
does. With the RLD off, the drive electrode should be **open**, not grounded.

---

**M-2. Experiment 2: "Mismatch the electrodes: make Rp 10 kΩ and Rn 60 kΩ → 60 Hz appears in the
output, and the RLD does not remove it."**

From Step 1: `I(Rp) = I(Rn) = 0` for **all** values of Rp and Rn, because the only things downstream
of them are an ideal INA input pin and an ideal VCVS sense terminal. Therefore
```
V(inap) = V(inp) + V(cm)      and      V(inan) = V(inn) + V(cm)
V(inap) − V(inan) = V(inp) − V(inn) = 1.000 mV,   unchanged
```
**Changing Rn from 10 kΩ to 60 kΩ changes not one node voltage in this netlist.** No 60 Hz appears.
The physics being taught (electrode-impedance imbalance converts common mode into differential mode)
is entirely correct and is arguably the single most important idea on the page — but it **cannot be
demonstrated by the circuit as tabulated**, because the mechanism requires a finite current into the
amplifier input, and the table specifies an ideal one. To make the experiment work the table needs
either finite INA input impedance (e.g. explicit 100 MΩ resistors from `inap`/`inan` to a common-mode
reference), or an input bias current source, or the coupling capacitance from the mains modelled to
each electrode separately.

---

**M-3. Experiment 3: "Turn the RLD up: make both Erld gains −2 → better rejection at first, and then
it oscillates."**

The first half is right. With both gains at −2, `V(rld) = −2(V(inap)+V(inan)) = −4 V(cm)`, so
`G = 4` and Eq. 2 gives
```
Vc/Vs = 10⁻⁶ / (10⁻⁶ + 5/6×10⁴) = 10⁻⁶ / (10⁻⁶ + 8.333333×10⁻⁵)
      = 10⁻⁶ / 8.433333×10⁻⁵ = 0.011858   →  11.86 mV,  38.5 dB
```
✔ "better rejection".

The second half **cannot happen**. Enumerate every element in the RLD loop:
`Erld1` (VCVS), `Erld2` (VCVS), `Rrld_out` (R), `Rbody` (R), `Rcouple` (R), `E_add_p`/`E_add_n`
(VCVS). Every one is memoryless. The loop gain `T(s) = (1+G)·Rc/(Rc+Rrld)`-type expression is a
**real, frequency-independent, positive number**; the loop has **zero poles and zero phase shift at
any frequency**. A linear feedback loop with no reactance and negative feedback is unconditionally
stable — it cannot oscillate for any finite gain. The `why` field correctly names the real
mechanism ("the body and the electrodes have capacitance, the amplifier has bandwidth"), which is an
admission that the required elements are absent from the table. As written, a reader running the
stated netlist will see clean 11.9 mV and conclude the warning is fabricated.

---

**M-4 (missing variable). X1's gain is never specified.** The table lists
`X1 | Block (instrumentation amplifier) | Sub-Circuit | pins inap, inan, ground, out1` — with **no
gain value**. The `out` probe expects **100 mV** and justifies it as "1 mV through the
instrumentation amplifier and then ×100 in the second stage", which requires `A(X1) = 1` exactly. But
the lesson's own scenario panel specifies "**Gain: 1000× total (instrumentation amp + programmable)**",
and `Egain` alone supplies ×100 — so X1 would have to be ×10, giving `V(out) = 1 V`, not 100 mV. The
expected value is unreproducible without a number the table does not contain, and the two numbers the
page does contain disagree by 10×.

---

**Minor: inconsistent signal normalisation.** The `cm_raw` probe says "the signal you want is
500 µV, so the interference is 2000 times bigger — 66 dB" (`20 log₁₀(2000) = 66.02 dB` ✔), but the
`sig` probe correctly identifies the differential signal as **1 mV**, against which 1 V is 1000× and
**60 dB**. Both are defensible in isolation; using both on the same page without saying which
normalisation is in force is a leap.

---

## 5. Module 20, Lesson 03 — RS-485 differential signalling

### 5.1 First principles required

1. **KVL around a single series loop** (the differential loop) and **KCL** to establish that no
   common-mode current flows at DC.
2. **Ideal VCVS** for the driver halves, the noise injectors and the receiver: exact gain, zero
   output impedance, infinite input impedance, no rails, no slew limit.
3. **Superposition**, valid throughout: the DC common mode (VCM), the differential data (VDATA) and
   the 60 Hz noise (VN_CM) are independent sources in an LTI network, so each may be solved
   separately and summed.
4. **The definition of differential and common mode**, and the fact that an ideal subtractor's
   output depends only on the former.
5. **Capacitor = open circuit at DC / steady state**, to justify treating `CLINE_A`/`CLINE_B` as
   absent within a bit.
6. Explicitly **NOT** used and explicitly **not available** from this netlist: transmission-line
   theory, characteristic impedance, propagation delay, reflection coefficients. The lesson says so
   itself for Experiment 2, which is to its credit.

### 5.2 Netlist

```
VCM       2.50 V DC          cm → gnd
E_A       gain +1            (a_drv − cm) = +V(data)
E_B       gain −1            (b_drv − cm) = −V(data)
RDA,RDB   50 Ω each          a_drv—a_line , b_drv—b_line
RLINE_A/B 10 Ω each          a_line—a_rcv , b_line—b_rcv
CLINE_A/B 100 pF each        a_rcv—gnd , b_rcv—gnd
RTERM     120 Ω              a_rcv — b_rcv
VN_CM     sine 1 V @60 Hz    noise → gnd
E_NOISE_A/B gain 1           (a_rcv_noisy − a_rcv) = V(noise) ; likewise B
E_DIFF    gain 1             diff → gnd, sensing (a_rcv_noisy − b_rcv_noisy)
VDATA     pulse −1 → +1 V, period 4.34 µs    data → gnd
```

### 5.3 Re-derivation, with `V(data) = +1 V`

**Step 1 — driver node voltages.**
```
V(a_drv) = V(cm) + 1·V(data) = 2.50 + 1.00 = 3.500 V
V(b_drv) = V(cm) − 1·V(data) = 2.50 − 1.00 = 1.500 V
V(a_drv) − V(b_drv) = 2.000 V differential      ✔ "±1 V about the common-mode point, so 2 V"
```

**Step 2 — the only DC current path.** At DC the 100 pF capacitors are open, and E_DIFF /
E_NOISE_* take no input current. So the sole loop is
```
a_drv → RDA(50) → a_line → RLINE_A(10) → a_rcv → RTERM(120) → b_rcv → RLINE_B(10) → b_line → RDB(50) → b_drv
```
**Step 3 — KVL around that loop.**
```
ΣR = 50 + 10 + 120 + 10 + 50 = 240 Ω
I  = (V(a_drv) − V(b_drv))/ΣR = 2.000/240 = 8.33333×10⁻³ A = 8.3333 mA   ✔ expect 8.33 mA
```
**Step 4 — the received differential voltage.**
```
V(a_rcv) − V(b_rcv) = I × RTERM = 8.33333×10⁻³ × 120 = 1.000000 V        ✔ exactly 1.000 V
```
or equivalently, as a divider: `2 V × 120/(60 + 120 + 60) = 2 × 120/240 = 2 × 0.500 = 1.000 V`,
where 60 Ω = 50 + 10 per side ✔ — the documentation's "60 Ω on each line into a 120 Ω termination,
a two-to-one divider" is exactly right.

**Step 5 — absolute node voltages.**
```
drop per side = I × (50 + 10) = 8.33333×10⁻³ × 60 = 0.500000 V
V(a_rcv) = 3.500 − 0.500 = 3.000 V
V(b_rcv) = 1.500 + 0.500 = 2.000 V
```
**Step 6 — with noise injected, at the 60 Hz peak (`V(noise) = +1.000 V`).**
```
V(a_rcv_noisy) = 3.000 + 1.000 = 4.000 V         ✔ expect 4.00 V
V(b_rcv_noisy) = 2.000 + 1.000 = 3.000 V         ✔ expect 3.00 V
```
and the doc's decomposition `2.5 (cm) + 0.5 (signal) + 1.0 (noise) = 4.0` is correct — the 0.5 V is
the half-amplitude *at the receiver*, after the two-to-one divider ✔.

**Step 7 — the receiver output.**
```
V(diff) = V(a_rcv_noisy) − V(b_rcv_noisy)
        = [V(a_rcv) + V(noise)] − [V(b_rcv) + V(noise)]
        = V(a_rcv) − V(b_rcv) + [V(noise) − V(noise)]
        = 1.000 V + 0                                                    ✔ exactly, identically
```
The cancellation is structural (the noise term subtracts symbolically before any number is
substituted), which is why the doc is right to say "not one millivolt of the 60 Hz."

**Step 8 — common mode at the receiver.**
```
(V(a_rcv) + V(b_rcv))/2 = (3.000 + 2.000)/2 = 2.500 V                    ✔ expect 2.50 V
```
Justified because RTERM carries only the loop (differential) current and no common-mode current can
flow at DC (the capacitors are open, and there is no other path to ground from `a_rcv`/`b_rcv`) ✔.

**Step 9 — Experiment 1, `E_NOISE_B` gain → 0.98.**
```
V(diff) = [V(a_rcv) + 1.00·n] − [V(b_rcv) + 0.98·n] = 1.000 + 0.02·n
peak    = 1.000 + 0.02 × 1.000 = 1.000 V + 20.0 mV of 60 Hz              ✔
CMRR    = 20 log₁₀(1/0.02) = 20 log₁₀(50) = 20 × 1.69897 = 33.98 dB      ≐ 34 dB ✔
```

**Step 10 — Experiment 2, RTERM removed.** With RTERM gone and the capacitors open, no DC current
flows anywhere, so no resistor drops anything:
```
V(a_rcv) = V(a_drv) = 3.500 V ; V(b_rcv) = V(b_drv) = 1.500 V
V(diff) = 2.000 V                                                        ✔ "doubles to 2 V"
```

**Step 11 — Experiment 3, noise → 10 V.** By Step 7 the noise cancels for any amplitude, so
`V(diff) = 1.000 V` exactly ✔. And `V(a_rcv_noisy) = 3.000 + 10.000 = 13.000 V` ✔, outside the
−7/+12 V RS-485 receiver window ✔.

**Step 12 — Experiment 4, `RLINE_A` → 60 Ω.**
```
ΣR = 50 + 60 + 120 + 10 + 50 = 290 Ω                                     ✔ "290 Ω total"
I  = 2.000/290 = 6.89655×10⁻³ A
V(diff) = 6.89655×10⁻³ × 120 = 0.827586 V                                ≐ 0.83 V ✔
```
Noise rejection is untouched ✔, because Step 7's cancellation never referenced any line resistance —
the noise is injected downstream of it by construction, which the doc states honestly.

*Additional consequence the doc does not mention*: the asymmetry shifts the **common mode**:
`V(a_rcv) = 3.5 − 6.89655m×110 = 2.74138 V`, `V(b_rcv) = 1.5 + 6.89655m×60 = 1.91379 V`, so
`V_cm = 2.32759 V`, not 2.50 V. Harmless here, but it is a real effect of the fault being simulated.

### 5.4 Dimensional analysis

- `I = ΔV/ΣR`: `[V]/[Ω] = [A]` ✔. `2/240 A` → mA scale ✔.
- `V = I·R`: `[A][Ω] = [V]` ✔.
- Divider `R_term/(R_series + R_term)`: dimensionless ✔.
- `20 log₁₀(V/V)` → dB ✔.
- Baud × length ≤ 10⁸: `[bit·s⁻¹][m] = [bit·m·s⁻¹]` — **this is a dimensioned empirical constant**,
  and the page states it as a bare "10⁸" with no units. `10⁸ bit·m/s` is the correct reading;
  `1×10⁸/1×10⁶ = 100 m` ✔ and `1×10⁸/115200 = 868 m` ✔ (page says ≈870 m ✔).

### 5.5 VERDICT — Module 20 Lesson 03

**MATCHES on every probe and every experiment.** The `1.000 V` claim is exact, not rounded:
`2 × 120/240` is a ratio of integers. `8.33 mA`, `4.00 V`, `3.00 V`, `2.50 V`, `20 mV`, `34 dB`,
`2 V`, `13 V` and `0.83 V` all reproduce.

Unstated items (none are arithmetic errors):

- **The netlist has one termination; the lesson's own design table demands two** ("120 Ω at each end
  of bus"). With both fitted, the receiver sees `120 ∥ 120 = 60 Ω` and
  `V(diff) = 2 × 60/(120 + 60) = 0.6667 V` — the SimCheck's exact 1.000 V is a property of a
  half-terminated bus, contradicting the design guidance three sections earlier.
- **The 50 Ω per side is a modelling choice, not a driver specification.** RS-485 drivers are
  specified by minimum differential output into 54 Ω, not by a linear 50 Ω source impedance; the
  clean two-to-one divider is an artefact of the model.
- **The `cm` probe's `why` names the wrong node**: "ten [volts] would put `a_rcv` outside the range".
  `V(a_rcv)` is 3.000 V regardless of the noise, because the noise is injected *after* it; the node
  that reaches 13 V is `a_rcv_noisy`. Experiment 3 gets this right, so the two disagree.
- **`VDATA` "period 4.34 µs" is ambiguous.** 4.34 µs is `1/230400 s`. If one period is one bit, the
  rate is 230.4 kbps and matches the "230 kbaud" mentioned in Experiment 2; if a pulse period is one
  high plus one low (the usual meaning), the alternating pattern is 460.8 kbps. Nothing on the page
  disambiguates.
- **The interactive's noise-margin formula contains an unjustified fudge**:
  `margin = vdiff/2 − 0.2 − noise × 0.1`, commented `// Simplified`. The `0.1` coefficient converts
  common-mode noise into differential margin with no stated basis — it is not derivable from
  anything on the page.

---

## 6. Summary table

| Equation or claim (quoted, with file) | My independent result | Verdict | Unstated idealization |
|---|---|---|---|
| `V(vminus)` = "2.5000 V" — m18/l07 | 2.500000 V | MATCHES | Ideal 5 V source, zero lead R; amp draws no bridge current |
| `V(vplus)` = "2.51244 V", "5 × 353.5/703.5" — m18/l07 | 2.5124378 V | MATCHES | GF constant, no transverse sensitivity, no tempco |
| `V(vplus,vminus)` = "12.438 mV" vs textbook "12.50 mV" — m18/l07 | 12.4378 mV exact; 12.500 mV linearised; shortfall 700/703.5 = 0.4975 % | MATCHES | Nonlinearity is `≈GF·ε/2`; doc says "the changing arm stays 350 Ω in the denominator" when the denominator is really `2R+ΔR` |
| "1 + 49.4k/499 = 100.0" — m18/l07 | 99.998 | MATCHES (to quoted precision) | 49.4 kΩ is AD620, not the INA128 the same page's interactive assumes (50 kΩ) |
| `cmr` = "2.506 V" and "roughly 106 dB of CMRR" — m18/l07 | 2.5062189 V; 20 log₁₀(2.50622/12.4378 µV) = 106.09 dB | MATCHES | Assumes error budget of 0.1 % of signal; ignores amp offset/drift |
| "20 log(1/2×tolerance) … lands near **48 dB** with 0.1 % parts" — m18/l07 | Stated formula gives **53.98 dB**; correct worst case `(1+G)/(4t)` = 500 → **53.98 dB** | **DERIVATION MISMATCH** | Resistor tolerances assumed independent and at worst case simultaneously |
| Full bridge = "**50.000 mV exactly**", nonlinearity "cancels algebraically" — m18/l07 | 2.525 − 2.475 = 0.050000 V; `V_ex·ΔR/R` with both denominators = 2R | MATCHES | Assumes perfectly symmetric ±ΔR in all four arms; real Poisson arms give ν·ΔR, and compression ≠ −tension |
| "output doubles to 24.9 mV"; "10²/700 × 2 = 286 mW" — m18/l07 | 24.876 mV; 285.0 mW exact (285.7 by the doc's own method) | MATCHES | Ignores the strained arm in the power sum; no thermal model |
| 1 Ω lead → "15.969 mV", "3.5 mV", "1.4 mε" — m18/l07 | 15.96877 mV; 3.53096 mV; 1.4285 mε | MATCHES | Lead assumed noise-free and constant with temperature |
| Pt100 CVD at −50/0/100/500 °C = "80.31 / 100.00 / 138.51 / 280.98 Ω" — m18/l06 | 80.30628 / 100.00000 / 138.5055 / 280.9775 Ω | MATCHES | IEC 60751 coefficients assumed exact; no sensor tolerance class stated |
| Sensitivity column "0.35 Ω/°C at 500 °C" — m18/l06 | local slope 0.33308; 400→500 secant 0.33886 | Off by ~4 % | Column silently mixes secants; 0.385 at 100 °C is the 0–100 secant, local slope is 0.37928 |
| `V(sense_p)` = "240.51 mV" = `V(rtd_p)` "identically, to every digit" — m18/l06 | 240.51 mV both, exactly | MATCHES | Amplifier input current is exactly zero; no thermal EMF at the junctions |
| `V(sense_p)−V(sense_n)` = "138.51 mV"; `V(out)` = "1.38510 V" — m18/l06 | 138.51 mV; 1.38510 V | MATCHES | Ideal 1 mA source with unlimited compliance and zero tempco |
| 2-wire error "142.51 mV … **10.4 °C**" — m18/l06 | 142.51 mV ✔; exact CVD inversion gives **10.58 °C** (local slope: 10.55 °C) | MATCHES within tolerance | Inverted with the 0–100 °C secant 0.385 Ω/°C instead of the local slope |
| "Break one sense lead: R_lead3 = 1 GΩ → output goes to a rail" — m18/l06 | Zero current ⇒ zero drop ⇒ `V(out)` **unchanged at 1.38510 V** | **DERIVATION MISMATCH** | Requires amplifier input bias current, which no VCVS has and the table never lists |
| Self-heating: "2.74 mW × **50 °C/W** = 0.137 °C" (exercise) vs `power × 0.5` per mW (JS, and m18/l03) — m18/l06 | 50 °C/W and 500 °C/W differ by 10× for the same sensor | **DERIVATION MISMATCH** (internal) | Thermal resistance never attributed to still air vs immersion |
| `V(rtd_lo)` = "1.000 V"; ratio = "1.0963" = `10·R_RTD/R_REF` — m18/l03 | 1.000000 V; 1.09630, `I` cancels identically | MATCHES | R_REF assumed exact and tempco-free; ADC assumed to use `V(rtd_lo)` literally as its reference |
| Filter corner "1/(2π×1k×100nF) = 1.59 kHz" — m18/l03 | 1591.55 Hz | MATCHES | Single pole; ignores amp output impedance and ADC input current |
| "a real 500 °C sensor reads **470 °C** through [the linear model] — 30 degrees out" — m18/l03 | (280.9775 − 100)/0.385 = **470.071 °C**, error −29.93 °C | MATCHES | α = 0.00385 is the 0–100 °C mean, which is what makes the error one-sided |
| IEX → 1.5 mA: "V(amp_out) rises to 1.644 V … ratio still 1.0963" — m18/l03 | 1.644450 V; ratio 1.09630 | MATCHES | Current source has unlimited compliance; at the 10 mA experiment `amp_out` would need 11 V |
| RREF → 1.001 kΩ: "ratio shifts by 0.1 %, about **0.28 °C**" — m18/l03 | −0.0999 %; −0.2845 °C | MATCHES | Uses the 0.385 Ω/°C secant again |
| RLD: `V(cm)/V(cm_src) = (1/1M)/(1/1M + 2/60k) = 0.0291`, "**30.7 dB**" — m23/l06 | KCL gives exactly that expression; 0.0291262 → 29.126 mV → **30.715 dB** | MATCHES | The "2" is `(1 + G)` with RLD gain G = 1 — never explained; body is one 50 kΩ resistor with no capacitance and no half-cell potentials |
| "Disable the RLD … V(cm) returns to the **full 1 V**" — m23/l06 | **56.60 mV** (the 60 kΩ path is still there, now tied to ground); only 5.77 dB of the 30.7 dB is actually the drive | **DERIVATION MISMATCH** | Disabling should open the drive electrode, not ground it |
| "a volt of common mode leaks 32 µV … 3 % distortion" — m23/l06 | 31.62 µV / 3.16 % **from a 1 V input**, but the circuit delivers 56.60 mV → 1.79 µV, **0.18 %** | Consequential mismatch (inherits the above) | INA CMRR assumed frequency-independent at 60 Hz |
| "Mismatch the electrodes: Rp 10 k, Rn 60 k → 60 Hz appears in the output" — m23/l06 | `I(Rp) = I(Rn) = 0` for all values ⇒ **nothing changes at any node** | **DERIVATION MISMATCH** | Requires finite INA input impedance or bias current; the table specifies an ideal block |
| "Erld gains −2 … better rejection at first, and then it **oscillates**" — m23/l06 | Rejection improves to 11.86 mV / 38.5 dB ✔; loop is **purely resistive, zero poles, unconditionally stable — cannot oscillate** | **DERIVATION MISMATCH** (second half) | Electrode/body capacitance and amplifier bandwidth are absent from the table |
| `V(out)` = "100 mV" = "1 mV through the INA and then ×100" — m23/l06 | Requires `A(X1) = 1`, which the table never states; the scenario demands 1000× total ⇒ `A(X1) = 10` ⇒ 1 V | **DERIVATION MISMATCH** (missing variable) | X1's gain is undefined in the component table |
| HP corner "1/(2π×1M×3.2 µF) = 0.05 Hz"; LP 10 k/106 nF — m23/l06 | 0.049736 Hz; 150.15 Hz | MATCHES | Single-pole; no op-amp GBW, no dielectric absorption in a 3.2 µF coupling cap |
| "interference is 2000 times bigger — 66 dB" vs `sig` probe's 1 mV — m23/l06 | 66.02 dB vs 500 µV; 60.0 dB vs the 1 mV differential | Ambiguous normalisation | Page uses per-electrode and differential amplitudes interchangeably |
| `V(diff)` = "**1.000 V**", "60 Ω each line into 120 Ω, a two-to-one divider" — m20/l03 | `2 × 120/240 = 1.000000 V` exactly | MATCHES | Only **one** termination modelled; the page's own design table says two, which would give 0.667 V |
| `I(RTERM)` = "8.33 mA", "2 V across 240 Ω" — m20/l03 | 2/240 = 8.3333 mA | MATCHES | Driver modelled as ideal VCVS + 50 Ω; real transceivers are current-limited and nonlinear |
| `V(a_rcv_noisy)` = "4.00 V" = "2.5 + 0.5 + 1.0" — m20/l03 | 3.000 + 1.000 = 4.000 V | MATCHES | Caps open at DC; 100 pF ≈ 26.5 MΩ at 60 Hz, so this holds |
| `V(b_rcv_noisy)` = "3.00 V" — m20/l03 | 2.000 + 1.000 = 3.000 V | MATCHES | Noise assumed perfectly identical on both conductors |
| common mode "2.50 V", "RTERM carries only differential current" — m20/l03 | 2.500 V exactly | MATCHES | `why` then says "ten would put `a_rcv` outside the range" — that node is `a_rcv_noisy` |
| `E_NOISE_B` → 0.98: "**20 mV**", "20 log(1/0.02) = **34 dB**" — m20/l03 | 20.0 mV; 33.98 dB | MATCHES | Mismatch modelled as pure gain error; real imbalance is frequency-dependent |
| Delete RTERM: "V(diff) doubles to **2 V**" — m20/l03 | 2.000 V (no DC current anywhere) | MATCHES | Doc correctly flags that reflections are outside the model |
| `RLINE_A` → 60 Ω: "V(diff) drops to about **0.83 V**", "2 V across 290 Ω" — m20/l03 | 2/290 × 120 = 0.827586 V | MATCHES | Doc does not mention that the common mode also shifts to 2.328 V |
| "baud × length ≤ 10⁸; 1 Mbps → 100 m; 115200 → 870 m" — m20/l03 | 100 m; 868 m | MATCHES | The constant is dimensioned (bit·m/s) and stated without units |

---

## 7. Closing — every mismatch and every unstated idealization

### 7.1 DERIVATION MISMATCHes

| # | File | Claim | Correct result |
|---|---|---|---|
| 1 | `module-18/lesson-07.html` (`cmr` probe) | Discrete difference-amp CMRR "lands near **48 dB** with 0.1 % parts", via "20 log(1/2×tolerance)" | The stated formula evaluates to **53.98 dB**, and the correct worst-case `(1+G)/(4t)` at G = 1 also gives **53.98 dB**. 48 dB is `20 log(1/4t)` — the `(1+G)` numerator has been dropped. Formula and number contradict each other. |
| 2 | `module-18/lesson-06.html` (Experiment 3) | "Break one sense lead: make R_lead3 1 GΩ → the output goes to a rail, or to something meaningless" | The sense branch carries **zero current by construction**, so 1 GΩ drops 0 V and `V(out)` stays at **1.38510 V, unchanged**. The failure needs input bias current, which no element in the table has. |
| 3 | `module-18/lesson-06.html` (Exercise 1 vs the page's own JS and Lesson 03) | Self-heating thermal resistance | **50 °C/W** in the exercise vs **500 °C/W** (0.5 °C/mW) in `drawRTDCircuit()` and in Lesson 03. A **10× internal contradiction** for the same Pt100 in the same condition. |
| 4 | `module-23/lesson-06.html` (Experiment 1) | "Disable the right-leg drive … V(cm) returns to the **full 1 V**" | **56.60 mV.** The 60 kΩ electrode path remains and is now tied to ground, giving 24.94 dB of purely passive attenuation. Only **5.77 dB** of the headline 30.7 dB is attributable to the active drive. The dependent "32 µV / 3 % distortion" figure becomes 1.79 µV / 0.18 %. |
| 5 | `module-23/lesson-06.html` (Experiment 2) | "Mismatch the electrodes: Rp 10 kΩ, Rn 60 kΩ → **60 Hz appears in the output**" | `I(Rp) = I(Rn) = 0` for every value of Rp and Rn, because both feed only an ideal INA pin and an ideal VCVS sense terminal. **No node voltage changes at all.** The physics is right; the netlist cannot show it. |
| 6 | `module-23/lesson-06.html` (Experiment 3) | "Erld gains −2 … better rejection at first, and then it **oscillates**" | Rejection does improve (11.86 mV, 38.5 dB ✔), but the RLD loop contains **only resistors and memoryless VCVSs** — zero poles, zero phase shift, unconditionally stable at any finite gain. It cannot oscillate. |
| 7 | `module-23/lesson-06.html` (`out` probe) | `V(out)` = 100 mV, "1 mV through the instrumentation amplifier and then ×100" | **X1's gain is never given in the component table.** The expected value silently requires `A(X1) = 1`, while the lesson's scenario panel specifies 1000× total, which forces `A(X1) = 10` and `V(out) = 1 V`. |

### 7.2 Unstated idealizations (grouped)

**Universal to all five Circuit Toy tables — never stated anywhere:**
1. Every VCVS is ideal: **infinite input impedance, zero input bias current, zero output impedance,
   exact and frequency-independent gain, infinite bandwidth, zero offset, zero noise, infinite
   CMRR, and no supply rails**. Four of the seven mismatches above exist only because a lesson
   asserts a behaviour that requires one of these to be finite.
2. **Zero interconnect resistance and inductance** outside the explicitly named resistors; no trace,
   connector, solder or contact resistance; no thermoelectric EMF at dissimilar-metal junctions
   (material at the µV level for the RTD and ECG chains).
3. **Ideal, drift-free, tolerance-free components.** No resistor tolerance, no tempco, no ageing —
   yet several conclusions (bridge balance, ratiometric accuracy, difference-amp CMRR) are
   *entirely* determined by tolerance in hardware.
4. **No noise floor of any kind** — thermal, 1/f, shot, or quantisation — in circuits whose signals
   are 12 mV, 138 mV, 1 mV and 500 µV.
5. Sources are ideal: **zero output impedance on every voltage source, infinite compliance on every
   current source**, no start-up transient, no rails.

**Module 18 Lesson 07 (strain gauge):**
6. Gauge factor treated as a strain-independent, temperature-independent constant; transverse
   sensitivity ignored entirely.
7. The full bridge's "exactly 50.000 mV" additionally assumes the four arms are *perfectly*
   antisymmetric (`R ± ΔR` with identical magnitude). A real bending bridge has Poisson arms at
   `ν·ΔR ≈ 0.3 ΔR`, and a real gauge's compressive response is not the exact negative of its
   tensile response — the algebraic cancellation is exact only for the idealised arm values given.
8. Excitation lead resistance from the source to `bridge_top` is zero; a real 5 V rail feeding
   14 mA through cable is not.
9. Self-heating is *discussed* but not *modelled* — the power figures never feed back into the
   resistances.
10. The interactive and the Circuit Toy netlist put the active gauge in **opposite arms** (R1 vs R3),
    giving opposite output polarity, with no note.

**Module 18 Lesson 06 (4-wire RTD):**
11. `0.385 Ω/°C` is used as if it were the local sensitivity everywhere; it is the **0–100 °C
    secant**. Every temperature-error conversion on the page inherits this (the 10.4 °C figure is
    really 10.58 °C).
12. The current source is assumed to hold 1.000 mA exactly at any compliance voltage; the 20 Ω-lead
    experiment silently requires more headroom, and the R_ref = 1 kΩ experiment adds 0.9 V more.
13. IEC 60751 coefficients treated as exact; no sensor tolerance class (Class A is ±0.15 °C at 0 °C,
    which is roughly 0.06 Ω — comparable to several effects the page treats as significant).
14. Thermocouple Seebeck coefficients treated as constants over the full range (Type K actually
    varies ~39–41 µV/°C over 0–800 °C).
15. The thermocouple total-error RSS hardcodes ±2.2 °C sensor tolerance for **every** TC type.
16. Four static read-outs in the markup disagree with the JavaScript that replaces them
    (self-heating, lead error, ADC bits, TC total error).

**Module 18 Lesson 03 (ratiometric RTD):**
17. **The lesson is presented as 3-wire but the netlist is 4-wire with zero force-lead resistance.**
    There is no third wire and no force-lead resistor in the table.
18. The 3-wire residual error `0.1 × R_lead` ("~10 % mismatch assumed") is an arbitrary constant, not
    a derived or cited figure.
19. The ratiometric argument assumes the ADC's reference input is literally `V(rtd_lo)` and that the
    reference and signal paths have identical gain error — true of a delta-sigma front end,
    but never stated.
20. `R_REF` assumed exact and tempco-free; Experiment 4 shows the sensitivity but the nominal case
    assumes perfection.
21. At the 10 mA experiment `V(amp_out)` would be 10.96 V, which no 3.3 V-referenced front end can
    produce — the model has no rails, and the text does not mention this alongside the self-heating
    warning it does give.

**Module 23 Lesson 06 (ECG / RLD):**
22. The patient is a **single 50 kΩ resistor**: no electrode half-cell potentials (hundreds of mV of
    DC offset, the actual reason the 0.05 Hz high-pass exists), no skin-electrode RC, no body
    capacitance, no motion artefact.
23. **The RLD loop contains no reactance at all**, so no stability margin, phase margin or loop
    bandwidth can be computed from the table — despite the lesson making a stability claim.
24. The `(1 + G)` origin of the "2" in `2/60k` is never explained.
25. Mains coupling is a single 1 MΩ resistor to one body node, so the interference is common mode
    *by construction*; the real mechanism (distributed displacement current to each electrode)
    is what produces the differential residue the lesson wants to demonstrate.
26. Despite the IEC 60601 framing (4 kV isolation, <10 µA leakage), **no isolation barrier, leakage
    path, or defibrillator-protection element appears in the netlist** — none of the safety claims
    is verifiable from the circuit.
27. Signal amplitude is quoted per-electrode (500 µV) in one probe and differentially (1 mV) in
    another, changing the stated interference ratio by 6 dB.

**Module 20 Lesson 03 (RS-485):**
28. **Only one 120 Ω termination is modelled**, while the lesson's own design table specifies one at
    each end. A correctly double-terminated bus gives `V(diff) = 0.667 V`, not the exact 1.000 V the
    SimCheck reports.
29. Lumped model throughout: **no characteristic impedance, no propagation delay, no reflections, no
    skin effect, no cable attenuation** — the page states this honestly for Experiment 2, which is
    the best-handled idealization in the set.
30. Driver output impedance modelled as a linear 50 Ω per side; real RS-485 drivers are specified by
    minimum differential output into 54 Ω and are nonlinear and current-limited.
31. No failsafe bias resistors, no idle-state definition, no receiver hysteresis or ±200 mV
    threshold in the netlist (the threshold appears only in the interactive's JS).
32. Noise is injected **downstream of the line impedance**, which guarantees perfect cancellation;
    the doc says so plainly in Experiment 4, which is again to its credit.
33. The interactive's noise-margin expression contains an undocumented `noise × 0.1` coefficient.
34. `VDATA`'s "period 4.34 µs" does not disambiguate 230.4 kbps from 460.8 kbps.

**Non-mathematical, but worth fixing:** `module-18/lesson-03.html` registers its checklist under
`lessonKey: 'm20l3'`, which will collide with Module 20 Lesson 3's stored progress.
