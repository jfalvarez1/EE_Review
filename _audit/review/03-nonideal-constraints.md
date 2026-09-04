# Non-Ideal Component & Hardware-Constraint Audit

**Review 03 — power electronics and PCB-effects lessons**

## What was reviewed

Five lesson files, read in full (prose, "Build it in Circuit Toy" netlist tables,
JS calculator code, and the `new SimCheckWidget` blocks at the end of each file).
CSS, SVG and canvas drawing code were ignored.

| File | Circuit under review |
|---|---|
| `C:\Users\zerav\OneDrive\Desktop\EE_Review\lessons\module-24\lesson-12.html` | Buck output stage: load-step response, ESR step vs capacitive sag (`m24l12-loadstep`) |
| `C:\Users\zerav\OneDrive\Desktop\EE_Review\lessons\module-25\lesson-18.html` | Hot-swap controller: gate ramp, inrush, MOSFET SOA (`m25l18-hotswap`) |
| `C:\Users\zerav\OneDrive\Desktop\EE_Review\lessons\module-25\lesson-16.html` | Type III compensator, AC sweep (`m25l16-typeiii`) |
| `C:\Users\zerav\OneDrive\Desktop\EE_Review\lessons\module-26\lesson-01.html` | BLDC half bridge: duty, dead time, bootstrap (`m26l01-halfbridge`) |
| `C:\Users\zerav\OneDrive\Desktop\EE_Review\lessons\module-14\lesson-03.html` | Ground-plane impedance: solid vs split (`m14l03-ground`) |

### Scope note and what is already good

Every one of these lessons opens its build table with "The interactives above are
models with the physics written into them" — a real disclosure, and it is
consistently present. Several places go further and are explicitly correct about
their own idealisation:

* **`module-14/lesson-03.html`** is the best-behaved file in the set. Its third
  experiment states outright that a lumped network "can show you that a split
  raises impedance and cannot show you that it makes an antenna", and its fourth
  experiment ("Sweep further, to 10 GHz") explains that a lumped model becomes
  "confidently wrong" once board dimensions approach a quarter wavelength. That
  is exactly the disclosure this audit exists to ask for. **Credited; no further
  action on those two points.**
* **`module-25/lesson-18.html`** writes "For an *ideal* capacitor connected
  through trace/connector resistance" before the `Ipeak = Vbus/(Rtrace+Rconn)`
  formula. **Credited** (though the loop *inductance* omission survives — see
  HS-1 below).
* **`module-26/lesson-01.html`** labels `EHS`/`ELS` as `VCVS` in the build table
  and explains that the high-side one is "referred to vs, which is the entire
  reason the high side needs a floating supply". The shoot-through experiment
  also hedges with "hundreds of amps *depending on the model*". **Credited.**
* **`module-24/lesson-12.html`** models ESR as an explicit series resistor per
  capacitor rather than hiding it — "in series with its ESR, which is what an ESR
  is". **Credited.**

Everything below is where a *definitive* outcome is stated without that hedge.

---

## Findings table

Verdict key: **ED** = REQUIRES EMPIRICAL DATA · **AD** = ALREADY DISCLOSED

| Documented outcome (quoted, with file) | Ideal assumption relied on | Real-world parameter that would change it | Verdict |
|---|---|---|---|
| **LS-1.** "3.33 mV in zero time — a **vertical step**, because a resistance has no time constant … Zoom in as far as you like and the edge stays sharp." (`module-24/lesson-12.html`, probe `step` + prose) | Capacitors and their interconnect have zero ESL; `ILOAD` is an ideal current source with infinite di/dt | Capacitor **ESL** + mounting/via/trace loop inductance (0.5–2 nH realistic for an 0805 MLCC with its vias; 5–20 nH for a through-hole electrolytic). At 1 nH and a 100 ns load-step edge, L·di/dt = **20 mV — six times the 3.33 mV ESR step**. At a 10 ns edge, ~200 mV. On a real scope the leading edge is an inductive spike that then *decays* to the ESR level; it is not sharp and it is not 3.33 mV. | **ED** |
| **LS-2.** "I(R_ESR_BULK) at the instant of the step … expect 0.333 A … the 100 µF bulk part takes only a sixth of the step." (`module-24/lesson-12.html`, probes `ibulk`/`imlcc`) | 10 mΩ ESR is achievable on a 100 µF bulk part, and both ESRs are constant | ESR of a **100 µF aluminium electrolytic is 100–500 mΩ**, not 10 mΩ (only a polymer/hybrid part reaches 10–25 mΩ, and the table never says which). At 150 mΩ the split is 2 A × 2/152 = **26 mA, not 333 mA — off by 13×**. Electrolytic ESR also rises 3–10× at −40 °C and falls with temperature, so the split is a strong function of ambient. | **ED** |
| **LS-3.** "Adding capacitance fixes the sag and does nothing for the step; lowering ESR fixes the step and does nothing for the sag" and "the step drops to **1.82 mV**" when R_ESR_MLCC is halved. (`module-24/lesson-12.html`, prose + experiment 2) | ESR and C are independent, orthogonal knobs | Below roughly 3–5 mΩ the leading edge is **ESL-dominated**, so halving ESR from 2 to 1 mΩ produces no measurable improvement on hardware. Conversely adding MLCCs adds C *and* lowers ESR *and* lowers ESL together — they are not orthogonal in any physical bank. | **ED** |
| **LS-4.** "the output sags at I/C = 2 A/122 µF" and droop = "**164 mV**". (`module-24/lesson-12.html`, probes `sag`/`slope`) | 22 µF MLCC delivers 22 µF at the applied DC bias | **MLCC DC-bias derating**: a 22 µF X5R in 0805 at 6.3 V rating typically delivers 10–14 µF at 3.3 V bias and less at higher bias. Effective bank ≈ 110 µF, not 122 µF → droop ≈ **179 mV (+9%)**. Add X5R temperature coefficient (±15% over −55…85 °C) and ageing (~2%/decade-hour) and the ±20 mV tolerance on the probe is consumed entirely by capacitor derating. | **ED** |
| **LS-5.** "four 22 µF parts have a quarter the ESR of one". (`module-24/lesson-12.html`, experiment 2) | Four parts have four independent, identical current paths | True for ESR only if each part has its own via pair and its own path to the load. Shared vias / a shared fanout give far less than 4× improvement in the *mounted* impedance, which is what the load actually sees. | **ED** |
| **HS-1.** "With typical Rtrace ≈ 10 mΩ and Rconn ≈ 50 mΩ at 12 V: **Ipeak ≈ 200 A!**" (`module-25/lesson-18.html`, §1) | Purely resistive inrush path (the *capacitor* is disclosed as ideal; the *path* is not) | Connector + cable + trace **loop inductance** (50–500 nH) turns this into an underdamped L-C-R ring. Peak is set by ζ and by the bulk cap's own ESR, not by R alone; it also *rings below zero* and stresses the connector differently. 200 A is an upper bound never reached. | **ED** |
| **HS-2.** "the output follows it a threshold behind, so V(out) ramps at the same rate" — probe `outslew` expects **1000 V/s ±100**. (`module-25/lesson-18.html`) | Gate ramp rate = Igate/C_gate exactly; MOSFET adds no capacitance; V_GS(th) constant | The FET's **Ciss** loads the same node. A 60 A / 30 V part (the page's own Si7157DP class) has Ciss ≈ 3–6 nF against a 10 nF C_gate, so the real ramp is Igate/(C_gate + C_eff) — **as much as 40% slower**, and every downstream number (inrush, ramp time, dissipation) scales with it. Also **Crss/Miller** and **V_GS(th) tempco (−2 to −6 mV/°C)**, which shifts the source-follower offset over temperature. | **ED** |
| **HS-3.** "I(Rsense) during the ramp … expect **1.0 A** … **Flat, for the whole 12 ms**". (`module-25/lesson-18.html`, probe `inrush`) | The 10 Ω `Rload` in the same build table draws nothing during the ramp | **This is wrong in the ideal model too, from the page's own values.** `Rload` = 10 Ω sees V(out) ramping 0→12 V, so I(Rsense) ramps **1.0 A → 2.2 A**. The page's own experiment 1 says so ("1 A of charging current plus 0.6 A of load" at midpoint) and contradicts the probe. Probe `sensev` (10.0 V ±1.5) inherits the same error — real reading sweeps 10 → 22 V. | **ED** (and an internal inconsistency) |
| **HS-4.** "the **ENERGY** the FET absorbs is unchanged — it is ½CV², and it depends only on the load capacitance and the bus voltage." (`module-25/lesson-18.html`, experiment 2) and "This is independent of soft-start time!" (§3) | Load is purely capacitive during soft-start | With this netlist's own 10 Ω load, resistive-load energy is ∫V_DS·I_load dt = **0.0288 J at t_ss = 12 ms and 0.288 J at t_ss = 120 ms** (vs ½CV² = 0.072 J). So slowing the ramp 10× raises total FET energy from 0.101 J to **0.360 J — 3.6×, not "unchanged"**. The claim is only true for a zero-current load. | **ED** (falsifiable from the page's own numbers) |
| **HS-5.** "t_ss = (2000 µF × 13.2 V)/15 A = **1.76 ms**" and "P_peak = **99 W**", for a design specified with "Load: **10 A continuous**". (`module-25/lesson-18.html`, §4) | The 10 A downstream load draws nothing until soft-start completes | If the load is live during the ramp, only 15 − 10 = **5 A** charges the bulk cap → t_ss = **5.28 ms, 3× longer**, and FET energy roughly triples. The page then advises "Set circuit breaker timeout slightly longer than soft-start time" with **t_CB = 5 ms** (§5) — which would **latch off during every normal insertion**. Whether downstream converters hold off via their own UVLO is a datasheet/measurement question, not an assumption. | **ED** |
| **HS-6.** "Suggested MOSFET: **Si7157DP** (30 V, 60 A, RDS = 3.1 mΩ, robust SOA)" for "99 W for 1.76 ms". (`module-25/lesson-18.html`, §4) | SOA is the P = V·I hyperbola, and the datasheet curve applies as printed | Modern trench FETs suffer **thermal instability (Spirito effect)** in the linear region: the real 1 ms SOA boundary at 13 V V_DS is far below the constant-power line, often by 3–10×. SOA curves are also printed at **T_C = 25 °C** and must be derated by (T_Jmax − T_C)/(T_Jmax − 25). A single 30 V FET at 99 W / 1.76 ms is exactly the case that usually needs paralleling. | **ED** |
| **HS-7.** "R_sense = 50 mV/15 A = 3.3 mΩ … Select: **3 mΩ, 1 W, 1%**". (`module-25/lesson-18.html`, §4) | 50 mV threshold is exact; 3 mΩ is 3 mΩ at temperature; sense path is the resistor only | Controller **sense-threshold tolerance is typically ±10–20%** and drifts with temperature. Low-value shunts carry **+75 to +275 ppm/°C** and self-heat (0.3–0.9 W in a 2512 = 30–90 °C rise ⇒ up to +2.5% R). Kelvin routing error adds PCB copper (+3930 ppm/°C) in series. Actual limit spread is roughly **13–20 A**, not 15 A. (The page also computes P with 3.3 mΩ but specifies 3 mΩ — 0.33 W vs 0.30 W.) | **ED** |
| **HS-8.** "For 5 ms circuit breaker time: **C_timer = 20 pF**". (`module-25/lesson-18.html`, §5) | The external cap is the only capacitance on the timer pin | **20 pF is at or below board stray**: a short trace plus a pad plus pin capacitance is 3–8 pF, so the realised timeout could be 40% long or the cap could be omitted entirely and still "work". Also, `k ≈ 250 ms/nF` is quoted for the LTC4215 and must be verified against the actual datasheet and its own tolerance. | **ED** |
| **HS-9.** "gate oxide breaks down somewhere around 20 V on a typical part". (`module-25/lesson-18.html`, experiment 4) | One number covers all parts; the 10 V clamp is a hard 10 V | Directionally right and usefully stated, but **logic-level FETs are frequently ±12 V or ±8 V V_GS(max)**, and the D_gate/V_gate_max clamp actually sits at 10 V + V_f ≈ 10.7 V at 25 °C, rising ~2 mV/°C colder. Worth a range rather than a single figure. | **ED** (low severity) |
| **T3-1.** "Gain at 1 Hz … expect **76.8 dB ±1**" and "the feedback impedance is infinite … **infinite DC gain** drives the converter's output error to **exactly zero**". (`module-25/lesson-16.html`, probe `g1`) | Op-amp has infinite open-loop gain and infinite GBW | A real error amp has **A_OL = 90–120 dB with a dominant pole near 10 Hz**. To hit 76.8 dB within the stated ±1 dB you need A_OL ≥ ~96 dB *at 1 Hz*; a 1 MHz-GBW / 100 dB part gives only 23 dB of loop gain there — a **0.6 dB error, over half the stated tolerance**. DC error is finite, not "exactly zero". | **ED** |
| **T3-2.** "Gain at 1 MHz … expect **4.9 dB ±1.5**". (`module-25/lesson-16.html`, probe `ghf`) | Infinite GBW | Noise gain at 1 MHz is 1 + Z_f/Z_i ≈ 2.7 (8.7 dB); for <1 dB error the amp needs **A_OL ≈ 28 dB at 1 MHz ⇒ GBW ≥ ~25 MHz**. Internal error amps in PWM controllers are typically **1–10 MHz**. This probe is **not reproducible on most real hardware**. | **ED** |
| **T3-3.** "the maximum boost is 2[arctan(f/z) − arctan(f/p)] = **123.7°**, at … **4.08 kHz**". (`module-25/lesson-16.html`, experiment 1) | Ideal op-amp contributes zero phase; components are exact | (a) **Op-amp phase lag**: reproducing 123.7° within a couple of degrees needs A_OL ≥ ~62 dB at 4.08 kHz ⇒ **GBW ≥ ~5 MHz**; a 1 MHz amp costs roughly **5–10°** of the claimed boost. (b) **Tolerance stack-up**: with R ±1%, C1 C0G ±5%, C2/C3 X7R ±10%, the pole/zero ratio k = 15.9 spreads to 14.8–17.2 ⇒ boost **121.7°–125.8°** (mild), but the boost *centre frequency* moves ±8% at 25 °C and, with X7R tempco (±15%) and DC bias, **±25–30% over the operating range**. | **ED** |
| **T3-4.** Zeros "at 1/(2πR2C2) = **723 Hz** and 1/(2π(R1+R3)C3) = **1447 Hz**"; poles at "**15.9 kHz**" and "**16.6 kHz**". (`module-25/lesson-16.html`, probes `gdip`/`gpeak`) | Capacitors are their marked value | Three-significant-figure frequencies from **±10% X7R capacitors**. `C3 = 10 nF` and `C2 = 2.2 nF` should be specified **C0G/NP0** or these numbers are decoration. Worst-case corners: fz2 = 1288–1606 Hz, fp1 = 14.2–17.7 kHz at 25 °C before tempco. | **ED** |
| **T3-5.** Build table sets `Vfb = 500 mV DC` against `Vref = 600 mV DC`, and the widget states measurable gains at that operating point. (`module-25/lesson-16.html`) | Op-amp is a linear element with no output rails | At DC there is **no feedback path at all** (both C1 and C2 block), so a real amp sees a 100 mV differential and **slams to a rail**. None of the five gain probes can be measured on hardware at this bias. To reproduce them on a bench the fb source must sit **at V_ref (600 mV)**. Undisclosed. | **ED** |
| **T3-6.** "Q Factor: √(L/C)/(ESR + DCR) … Typical Value **2–20 (underdamped)**", implemented in the calculator as `q = √(L/C)/(2·ESR)`. (`module-25/lesson-16.html`, §1) | Damping comes only from ESR/DCR; the load does not exist | Load resistance is the **dominant** damping term in a buck. For the page's own defaults (L = 10 µH, C = 100 µF, ESR = 10 mΩ) the calculator prints **Q ≈ 15.8**; with a 3.3 V/3 A load (1.1 Ω) the actual Q is ≈ **2.6**. This is precisely the "conditional stability at light load" effect the page's own quiz (M23-16-L3) asks about — yet the calculator has no load input, and the code substitutes `2·ESR` for the documented `ESR + DCR`. | **ED** |
| **T3-7.** Exercise M23-16-L1: "L = 10 µH and C = 100 µF … f_LC = **5.03 kHz**", tolerance ±0.2. (`module-25/lesson-16.html`) | 100 µF of ceramic is 100 µF; 10 µH is 10 µH at load current | A 100 µF ceramic bank at 3.3 V bias commonly delivers **50–65 µF**, and a small power inductor loses **20–30% of L** near rated current (soft saturation). f_LC then lands at **6.5–8.9 kHz**, i.e. **30–75% high** against a ±4% tolerance. The compensator zeros are fixed while the plant pole moves — this is the single most consequential tolerance interaction in the lesson. | **ED** |
| **BL-1.** "V(vs) during the dead time … expect **−0.7 V ±0.2**" and "**0.46 W** thrown away in a body diode". (`module-26/lesson-01.html`, probe `deadv`) | Constant 0.7 V diode drop, no reverse recovery | A power-MOSFET **body diode at 8 A drops 0.9–1.3 V**, with **−2 mV/°C tempco** (so ~1.0 V hot, ~1.3 V cold). Body-diode **reverse recovery (Qrr)** adds a current spike and switching loss at the opposite turn-on that the model has no term for. Realistic dissipation is **0.7–0.9 W plus Qrr loss**, roughly double the stated figure. | **ED** |
| **BL-2.** "V(vb,vs) — across the bootstrap capacitor … expect **11.3 V ±0.4**" and "The capacitor refills every time the low side pulls vs to ground". (`module-26/lesson-01.html`, probe `boot`) | `EHS` is an ideal VCVS, so the bootstrap capacitor **is never discharged by gate charge** | The netlist's gate driver is a VCVS that sources unlimited current from nowhere — **C_boot supplies no Q_g in this model**, so the droop this whole section is about cannot appear. Real droop = Q_g/C_boot plus I_QBS·t_on plus diode reverse leakage (which rises ~2× per 10 °C). Also, because V(vs) goes to −0.7 V in the dead time, the capacitor charges to **~12.0 V**, not 11.3 V — outside the stated ±0.4 tolerance. The bootstrap diode's V_f and t_rr are also fixed and untyped. | **ED** |
| **BL-3.** "Average of V(vs) … expect **21.9 V**" and "Average of I(Lmotor) … **7.9 A**", with the page adding "a 1 V error … moves the current by 2 A, **25%**". (`module-26/lesson-01.html`, probes `vsavg`/`iavg`) | MOSFETs have zero R_DS(on); `Rmotor` = 500 mΩ is constant | **Winding copper has +3930 ppm/°C**: a 500 mΩ winding at a 100 °C rise is **≈ 0.65 Ω**, which alone moves average current from 7.9 A to **6.0 A (−24%)** — the largest single non-ideality in this circuit and entirely undisclosed. Add R_DS(on) drops (which roughly **double from 25 °C to 125 °C**) subtracting ~0.1 V from the switch-node average. The page correctly warns the result is a small difference of large numbers, then states it to three significant figures anyway. | **ED** |
| **BL-4.** "Peak-to-peak ripple on I(Lmotor) … expect **2.87 A ±0.3**". (`module-26/lesson-01.html`, probe `ripple`) | `Lmotor` = 100 µH constant | Motor phase inductance is **current-dependent (magnetic saturation)** and **rotor-position dependent (L_d vs L_q, often 1.5–2:1 on an IPM)**. Ripple is inversely proportional to L, so it varies across the electrical cycle in real hardware even at fixed duty. `VBEMF` as an 18 V **DC** source also erases the trapezoidal/commutating nature of real back-EMF. | **ED** |
| **BL-5.** "Raise the switching frequency: make the period **4 µs**, keeping the same 45.8% duty and 1 µs dead time … 21.65 V instead of 21.9". (`module-26/lesson-01.html`, experiment 4) | The bridge can be commanded with an arbitrarily short low-side on-time | The arithmetic is right and the outcome is **physically unrealisable on the very circuit described**: 4 µs − 1.833 µs (HS on) − 2 µs (dead time) leaves **167 ns of low-side conduction**. That is (a) far too short to refresh C_boot — the page's own "Bootstrap Limitations" box says the low side must turn on periodically — and (b) comparable to the R_g·C_iss gate time constant (10 Ω × ~3 nF ≈ 30 ns per τ, so ~150 ns to actually turn on and off). The FET barely conducts. | **ED** |
| **BL-6.** Checklist: "Verify MOSFET voltage rating **> 1.5× bus voltage**" — on a page whose worked example uses a **48 V bus** and whose parts table offers only **55 V and 60 V** devices. (`module-26/lesson-01.html`) | Switch-node voltage never exceeds V_bus | 1.5 × 48 = **72 V**; every MOSFET in the table fails the page's own rule. In reality the switch node **overshoots V_bus** by L_loop·di/dt at turn-off (commonly 20–60% on a hard-switched 48 V bridge with an unoptimised layout), which is exactly why the 1.5× rule exists. The table and the rule contradict each other and neither is qualified. | **ED** |
| **BL-7.** Dead-time calculator: `dtMin = td(off) + tf + margin`, `dtRec = dtMin + 0.2·tprop`. (`module-26/lesson-01.html`) | Datasheet t_d(off)/t_f apply at the operating point; driver channel mismatch is 20% of prop delay | Datasheet t_d(off)/t_f are specified at **25 °C, a stated R_g, and a stated V_DS** — all three shift them, and the page's own experiment (R_g 10 Ω → 100 Ω) makes the switching **10× slower** while the calculator has **no R_g term at all**. Driver **propagation-delay matching is a specified datasheet parameter** (e.g. ±10–50 ns) that should be read, not estimated as 20% of prop delay. V_GS(th) tempco and Miller-plateau length at high V_DS also stretch turn-off. | **ED** |
| **BL-8.** "Remove the dead time … A current spike … **hundreds of amps** … putting 48 V across two R_DS(on) in series. **Nothing limits that current but the devices.**" (`module-26/lesson-01.html`, experiment 1) | Bus is a stiff ideal source with zero loop inductance | Partially hedged ("depending on the model") — credited. But "nothing limits that current" is wrong on hardware: **DC-bus loop inductance** (10–100 nH) limits di/dt, and the FETs **leave the ohmic region and current-saturate** at V_GS well below the 48 V/2R_DS(on) figure. The real shoot-through peak is set by saturation current and pulse width, not R_DS(on). | **ED** |
| **BL-9.** Current-sense calculator: `gain = Vref·0.9/(Imax·Rshunt)`, `resolution = Imax/4096`. (`module-26/lesson-01.html`) | CSA is ideal; shunt is a pure resistance | Missing: CSA **input offset voltage and drift** (a 5 mΩ shunt with a 100 µV offset is 20 mA of error before gain), **shunt tempco** (+75 to +275 ppm/°C plus self-heating — 3.1 W at 25 A), **shunt ESL** (1–2 nH, which at a 20 kHz PWM edge injects a large L·di/dt artefact into a millivolt measurement), CSA **bandwidth and common-mode step recovery** at the switching node, and ADC INL/offset. Effective resolution is set by all of these, not by V_ref/4096. | **ED** |
| **BL-10.** Bootstrap sizing calculator: `Qtotal = Qg + (Iqbs + Ilk)·ton`, `C = Q/Vdroop`, "Safety Factor 2×". (`module-26/lesson-01.html`) | The bootstrap capacitor is its marked value and the only charge sink | **MLCC DC-bias derating** on a 12 V-biased X5R/X7R bootstrap cap can remove 40–60% of the capacitance — which is most of the 2× safety factor before anything else is counted. Also missing: **diode reverse leakage at temperature** (roughly doubles per 10 °C), the driver's own level-shift pulse charge, and Q_g being specified at a datasheet V_GS/V_DS that may not match the application. | **ED** |
| **GP-1.** "VDB(gnd_a) at 1 GHz … expect **9.9 dB**" and "VDB(split_a) at 1 GHz … **36.0 dB**". (`module-14/lesson-03.html`, probes `solid_hf`/`split_hf`) | A plane is a lumped 500 pH inductor at 1 GHz | The page discloses the lumped-model limit but pins it at **10 GHz / 3.6 mm**. Applying the page's own quarter-wave arithmetic to a realistic **100 mm board** puts the first cavity resonance at **~360–715 MHz — below both 1 GHz probe points**. A real plane pair shows anti-resonance peaks and nulls there, not a clean +20 dB/decade line. **The disclosure is present but placed an order of magnitude too high in frequency.** | **ED** (disclosure exists but is mis-sited) |
| **GP-2.** "L_SOLID = 500 pH", "L_SPLIT_A/B = 5 nH each", "R_SOLID = 1 mΩ", "R_SPLIT = 10 mΩ" — used to derive every stated dBΩ value. (`module-14/lesson-03.html`, build table) | These four numbers are representative | **No geometry is given anywhere** — no plane spacing, dielectric thickness, slot length, bridge width, or copper weight. The 20:1 inductance ratio that carries the lesson's entire argument is asserted, not derived. Nothing on the page lets a reader check whether 500 pH vs 10 nH is right for their stack-up. | **ED** |
| **GP-3.** "The resistance has become irrelevant — **a thousandth of the impedance**" at 1 GHz. (`module-14/lesson-03.html`, probe `solid_hf`) | Copper resistance is frequency-independent | **Skin effect**: δ_Cu = 2.06 µm at 1 GHz vs 35 µm for 1 oz copper, so R_ac ≈ **17× R_dc ≈ 17 mΩ**. The ratio is therefore ~1/185, not 1/1000. The *conclusion* (inductance dominates) survives intact; the *stated ratio* does not. The AC-resistance rise begins around 10 MHz. | **ED** (low severity — conclusion unaffected) |
| **GP-4.** "Frequency where VDB(gnd_a) starts rising (ωL = R) … expect **318 kHz ±30**". (`module-14/lesson-03.html`, probe `corner`) | R is constant through the corner | Here the assumption **holds** — at 318 kHz, δ_Cu = 116 µm > 35 µm, so R_dc is still valid and the corner is genuinely where the model says. Worth stating explicitly so a reader knows *why* this probe is trustworthy and GP-3 is not. | **AD** (in effect correct; recommend making the reasoning explicit) |
| **GP-5.** "the two networks share only gnd_ref … A lumped network can show you that a split raises impedance and cannot show you that it makes an antenna." (`module-14/lesson-03.html`, experiment 3) | — | Explicitly and correctly disclosed, including the recommendation to use a near-field probe instead. | **AD** |
| **GP-6.** "Both curves keep rising at 20 dB per decade, forever … Which is a warning about the model rather than a result." (`module-14/lesson-03.html`, experiment 4) | — | Explicitly disclosed. See GP-1 for the frequency at which the warning should actually start. | **AD** |

---

## Tests required, per circuit

### 1. Buck load-step / ESR vs capacitance (`module-24/lesson-12.html`)

**Bench**

1. **Resolve the ESL/ESR crossover (LS-1, LS-3).** Build the two-capacitor bank on a real board. Drive a 2 A load step with a MOSFET load whose gate drive gives selectable edge rates — target **10 ns, 100 ns, 1 µs**. Probe V(out) with a **coaxial/solder-in tip and spring ground** (a ground lead's own loop inductance will otherwise dominate the measurement), 1 GHz bandwidth, no 20 MHz limit. Record: peak inductive spike, its decay time constant, and the flat ESR shelf that follows. Report the edge rate at which the spike exceeds the 3.33 mV ESR step. Expected: the spike wins at every edge faster than ~1 µs.
2. **Measure real capacitor ESR/ESL (LS-2).** Impedance analyser (or VNA + fixture) sweep 100 Hz – 100 MHz on each capacitor **as mounted**, extracting C, ESR at the impedance minimum, and ESL from the inductive slope above self-resonance. Do the 100 µF part in **both** electrolytic and polymer variants and record the difference in the current-split ratio.
3. **Temperature sweep (LS-2).** Repeat the ESR extraction at **−40 °C, +25 °C, +85 °C**. Report ESR ratio cold/hot for the bulk part and re-derive the `ibulk`/`imlcc` split at each corner.
4. **DC-bias derating (LS-4).** Measure the MLCC's effective capacitance vs applied DC bias from 0 V to its rated voltage (impedance analyser with DC bias, or a large-signal charge/discharge method). Report effective bank capacitance at the operating point and the corrected droop.
5. **Via-count sensitivity (LS-5).** Build two variants of a 4 × 22 µF bank — independent via pairs vs a shared fanout — and compare the mounted impedance minima. Report the actual ESR/ESL improvement factor against the claimed 4×.

**SPICE**

6. Rerun the netlist with **ESL added in series with each capacitor** (1 nH MLCC, 10 nH bulk) and with `ILOAD` given a finite rise time (PWL, 10 ns / 100 ns / 1 µs). Confirm whether any of the five probe values survive.
7. Rerun with **bulk ESR = 150 mΩ** (aluminium electrolytic) and re-report `ibulk`/`imlcc`.
8. Note for the authors: the netlist has **no control loop** (VSW is a fixed-duty open-loop pulse source), yet the `slope` probe's `why` field discusses "the number the control loop is racing". Either add a feedback path or say the loop is absent.

### 2. Hot-swap controller (`module-25/lesson-18.html`)

**SPICE (do these first — several are analytic and cost nothing)**

1. **Fix HS-3 before any bench work.** Re-run the netlist as written and plot I(Rsense); it will ramp 1.0 → 2.2 A. Correct the probe, or delete `Rload` and say the model has no load during the ramp.
2. **HS-4.** Integrate V_DS·I_D over the ramp for C_gate = 10 nF and 100 nF and report both totals. Confirm the 3.6× energy increase and correct the "energy is unchanged" claim.
3. **HS-2.** Replace the ideal switch with a **vendor SPICE model** for the suggested Si7157DP (or equivalent). Compare gate slew and V(out) slew against the 1000 V/s prediction. Report the Ciss-induced slowdown.
4. **HS-5.** Add a 10 A constant-current load active from t = 0 and re-derive t_ss; check it against the 5 ms circuit-breaker timeout.

**Bench**

5. **SOA validation (HS-6).** Pulse the candidate FET at **13.2 V V_DS, 15 A, 1.76 ms** into a curve tracer or a purpose-built single-shot SOA rig, with T_C set to the worst-case ambient. Monitor T_J via V_SD-as-thermometer or an IR camera on a decapped/exposed part. Repeat 100 shots and check for parameter drift. This is the test that decides whether one FET or two is correct.
6. **Gate-clamp verification (HS-9).** Measure the actual clamp voltage across temperature (−40/+25/+125 °C) and compare with the chosen FET's V_GS(max), including its own tolerance.
7. **Current-limit accuracy (HS-7).** Sweep the load into current limit and record the actual trip current at −40/+25/+85 °C with the shunt at its steady-state self-heated temperature. Report the spread against the nominal 15 A.
8. **Timer capacitance (HS-8).** Measure the realised circuit-breaker time with the 20 pF cap fitted and with it **removed** (stray only). If the two differ by less than 2×, redesign around a larger cap and a different `k`.
9. **Inrush without the controller (HS-1).** Insert the board with the hot-swap FET permanently on, and capture the inrush with a **current transformer or coaxial shunt** (a clamp meter will not do 200 A at microsecond rates). Record the peak, the ringing frequency, and back out the loop inductance. Compare against the 200 A resistive prediction.

### 3. Type III compensator (`module-25/lesson-16.html`)

**Bench**

1. **Reproduce the AC sweep at a valid bias (T3-5).** Set the fb source DC to **600 mV = V_ref** (not 500 mV) with a small AC injection, and confirm the op-amp output sits mid-rail before sweeping. Document that this is required; the build table as written rails a real amplifier.
2. **Op-amp sufficiency (T3-1, T3-2, T3-3).** Measure the network's gain at **1 Hz, 10 Hz, 1 kHz, 16 kHz and 1 MHz** with (a) a precision amp with ≥100 dB A_OL and ≥25 MHz GBW, and (b) a representative PWM-controller error amp (1–3 MHz GBW). Report where the two diverge. Expected: the 1 Hz and 1 MHz probes fail on (b).
3. **Phase boost (T3-3).** Measure phase at 1 Hz and at 4.08 kHz on both amps and report the delivered boost against 123.7°.
4. **Capacitor dielectric (T3-4).** Build the network twice — **C0G/NP0** and **X7R** — and sweep both at **−40 °C, +25 °C, +85 °C**. Report the movement of the 723 Hz / 1447 Hz zeros and the 15.9 kHz / 16.6 kHz poles, and the boost delivered at a *fixed* 4.08 kHz in each case.
5. **Monte Carlo / worst-case corners.** Either 1000-run Monte Carlo in SPICE (R ±1%, C1 ±5%, C2/C3 ±10%) or a physical build of the four extreme corners. Report the 3σ spread of boost magnitude and boost centre frequency.

**SPICE**

6. **Plant tolerance (T3-7).** Sweep f_LC with C_out from **50 µF to 100 µF** (MLCC DC bias) and L from **7 µH to 10 µH** (saturation), and overlay the fixed compensator. Report the worst-case phase margin at the intended crossover. This is the run that matters most.
7. **Load-dependent Q (T3-6).** Build the buck power stage with a parallel load resistor and sweep load from **no load to full load**. Report Q at each and compare with the page's `√(L/C)/(2·ESR)` figure. Add a load input to the calculator or state the assumption.
8. **Closed loop.** Run a full closed-loop AC sweep (or a SIMPLIS/PSIM average model) with the amp's real A_OL/GBW and the derated plant, and confirm ≥45° phase margin at every corner. The page recommends a network analyser measurement in §4 — that recommendation is correct and should be pointed at these corner cases specifically.

### 4. BLDC half bridge (`module-26/lesson-01.html`)

**Bench**

1. **Body-diode drop (BL-1).** Curve-trace the chosen FET's body diode at **8 A** at **−40/+25/+125 °C** and use the measured V_f to recompute the dead-time notch depth and the 0.46 W figure. Separately, capture the reverse-recovery current spike at the opposite turn-on with a coaxial shunt and integrate it for Q_rr loss.
2. **Winding resistance vs temperature (BL-3).** Measure phase-to-phase resistance cold and after a thermal soak at the motor's rated temperature rise (four-wire, or by the resistance-rise method). Report the current the model predicts at each and the resulting error against the 7.9 A claim.
3. **Switch-node overshoot (BL-6).** Capture V(vs) at turn-off at full current with a **low-inductance probe ground**, and record the peak. Compare with the FET's V_DS rating and with the page's own 1.5× rule. If the 55/60 V parts listed are used on a 48 V bus, this is the test that decides whether the parts table is safe.
4. **Bootstrap droop (BL-2).** Instrument V(vb,vs) with a differential probe at maximum high-side on-time and at maximum switching frequency, at the highest operating temperature (for diode leakage). Compare measured droop against Q_g/C_boot. Also measure the bootstrap cap's **effective capacitance at 12 V bias**.
5. **Minimum low-side on-time (BL-5).** Sweep switching frequency upward at fixed duty and dead time and find the frequency at which the bootstrap fails to refresh (high-side UVLO trips or V(vs) collapses). Report it and use it to bound experiment 4's claim.
6. **Dead-time adequacy vs R_g and temperature (BL-7).** Measure t_d(off) and t_f at R_g = 10 Ω and 100 Ω, at 25 °C and at rated T_J, at full V_DS. Add the gate driver's specified propagation-delay matching from its datasheet. Recompute the minimum dead time from measured values.
7. **Current-sense chain (BL-9).** Inject a known DC current and measure the CSA output offset and gain error at −40/+25/+85 °C; then inject a PWM current and capture the CSA output during a switching edge to quantify the shunt-ESL and common-mode-recovery artefacts. Report usable resolution against the calculator's `Imax/4096`.

**SPICE**

8. Rerun the netlist with **vendor MOSFET models** (including body diode and C_iss/C_rss) in place of the VCVS drivers, with the bootstrap capacitor actually supplying gate charge, and with 10–50 nH of DC-bus loop inductance. Re-check all five probe values.
9. Rerun the shoot-through experiment (BL-8) with a saturating FET model and bus inductance and report the actual peak, so "hundreds of amps" can be replaced with a defended number.
10. Add winding-resistance and inductance-vs-current tables to `Rmotor`/`Lmotor` and report the spread on average current and ripple.

### 5. Mixed-signal grounding (`module-14/lesson-03.html`)

**Bench**

1. **Extract real L and R (GP-2).** Build two test coupons at a **stated stack-up** (e.g. 1 oz copper, 0.2 mm dielectric): one solid plane, one with a slot and a defined bridge width. Measure the two-port impedance between the same pair of points with a **VNA and a 2-port shunt-through fixture** from 1 kHz to 6 GHz. Extract R_dc, R_ac(f), and L for each. Report the actual inductance ratio against the modelled 20:1.
2. **Find the real lumped-model ceiling (GP-1).** From the same sweep, identify the first anti-resonance/cavity peak and report its frequency. Use that number — not 10 GHz — in the lesson's disclosure. Predicted ~360–715 MHz for a 100 mm coupon in FR4.
3. **Skin-effect corner (GP-3).** From the extracted R_ac(f), report the frequency at which R has risen 2× over R_dc, and the actual R_ac at 1 GHz. Replace "a thousandth" with the measured ratio.
4. **The measurement the page already recommends (GP-5).** Near-field H-probe scan over both coupons with a digital aggressor driving a trace across the split, comparing radiated field and coupled noise. This is the mechanism the lumped model cannot show, as the page correctly says — the test just needs to exist alongside the impedance data.

**SPICE / field solver**

5. Extract L and R for both geometries with a **2D/3D field solver** (or a planar EM solver for the cavity behaviour) at the stated stack-up, and cross-check against the VNA data from test 1. Publish the geometry alongside the 500 pH / 5 nH values so a reader can scale them.
6. Add a **frequency-dependent resistance** (or a Foster ladder) to the model and confirm the 318 kHz corner is unaffected while the 1 GHz resistance ratio changes — this converts GP-3 and GP-4 from assertions into a demonstrated result.

---

## Closing summary — the most consequential gaps

Ranked by how badly the documented outcome would mislead someone working on real
hardware:

1. **The ESL blind spot in the load-step lesson (LS-1) is the single most
   consequential item in the review.** The lesson's central diagnostic — "zoom in
   and the ESR step is a sharp vertical edge you can measure" — is exactly what a
   real scope does **not** show. With 1 nH of realistic bank + mounting
   inductance and a 100 ns load edge, the L·di/dt spike is 20 mV against a 3.33 mV
   ESR step: **the parasitic the lesson omits is six times larger than the effect
   it teaches**. A student who follows this to the bench will see the spike,
   conclude the model is broken, and lose the (correct and valuable) ESR/sag
   distinction along with it. The lesson explicitly models ESR and explicitly does
   not model ESL, and it is the ESL that arrives first.

2. **The 100 µF bulk capacitor's 10 mΩ ESR is out of range for the part class the
   lesson implies (LS-2).** The `ibulk`/`imlcc` current split — 1/6 vs 5/6 — is the
   page's headline insight. With a realistic aluminium electrolytic (150 mΩ) the
   split is 1.3% / 98.7%, a **13× error** against a ±15% tolerance. The
   qualitative lesson survives (and gets stronger); the numbers do not. Naming the
   part class (polymer/hybrid) would fix this in one line.

3. **Two hot-swap claims are falsifiable from the page's own values (HS-3, HS-4).**
   The `inrush` probe says I(Rsense) is "flat at 1.0 A for the whole 12 ms" while
   the same netlist's 10 Ω load ramps it to 2.2 A — and the page's own
   experiment 1 contradicts the probe. Separately, "the energy the FET absorbs is
   unchanged — it is ½CV²" is false for any load that draws current during the
   ramp: with this netlist, a 10× slower ramp raises total FET energy **3.6×**.
   Since the whole point of that experiment is that slowing the ramp is "not a
   free improvement", the correction actually strengthens the lesson.

4. **The Type III lesson's five gain probes cannot be measured on the circuit as
   tabulated (T3-5, T3-2).** With V_fb = 500 mV against V_ref = 600 mV and no DC
   feedback path, a real amplifier rails and every probe reads garbage. And even
   at a valid bias, the 1 MHz probe needs a **≥25 MHz GBW** amplifier — well
   outside the 1–10 MHz error amps this compensator would actually live inside.
   The lesson also asserts "infinite DC gain … error exactly zero" as the reason
   the topology exists, which is a property no real amplifier has.

5. **The buck plant tolerance dwarfs the compensator tolerance, and only the
   compensator's is discussed (T3-7, T3-6).** MLCC DC-bias derating and inductor
   saturation move f_LC by **30–75%** while the compensator's zeros stay put — and
   the Q formula ignores load resistance entirely, printing Q ≈ 15.8 where the
   real loaded value is ≈ 2.6. The page's own quiz asks about light-load
   conditional stability; its calculator has no load input with which to explore it.

6. **Winding copper tempco is the largest unstated error in the BLDC model
   (BL-3).** A 500 mΩ winding at a 100 °C rise becomes 0.65 Ω and drags the
   average current from 7.9 A to 6.0 A — a **24% error**, on a page that
   correctly warns the reader that this circuit "subtracts two large numbers and
   cares about the small difference", then quotes the difference to three
   significant figures.

7. **Two BLDC statements contradict the page's own rules (BL-5, BL-6).** The
   high-frequency experiment leaves **167 ns of low-side on-time**, which cannot
   refresh the bootstrap capacitor the same page says must be refreshed every
   cycle; and the checklist's "V_DS > 1.5× bus" rule is failed by every MOSFET in
   the page's own parts table at the page's own 48 V bus.

8. **The grounding lesson's disclosure is right in kind but an order of magnitude
   off in frequency (GP-1).** It correctly and admirably warns that the lumped
   model dies at the quarter-wave point — then sites that at 10 GHz. The same
   arithmetic applied to a 100 mm board puts it at **~360–715 MHz**, below both
   1 GHz probes the widget states to 0.1 dB. Moving the warning down is a
   one-sentence fix and would make this file fully clean, since its other two
   idealisation disclosures are the best in the set.

### Adjacent observations (outside the non-ideality brief, noted in passing)

* `module-24/lesson-12.html`, `plotPowerSupply`: the code comments "Triangle
  approximation" but computes `rippleRms = ripple/(2*sqrt(2))`, which is the
  sine RMS. Triangle RMS is V_pp/(2√3) — the displayed RMS is ~22% high.
* `module-25/lesson-18.html` build table: the `M1` row carries an inline
  parenthetical, "(gate and source were swapped, which ties the gate to the
  output it is meant to control)", that reads as an unresolved errata note
  rather than build instructions.
* `module-25/lesson-16.html`: the power-stage calculator recommends
  f_c = f_sw/8 = 62.5 kHz, while the compensator built in the table places its
  poles at ~16 kHz. The two halves of the lesson are not dimensioned for each
  other.
* `module-25/lesson-16.html`: the §1 table documents Q = √(L/C)/(ESR + DCR) but
  the implementing code uses `√(L/C)/(2·ESR)` — DCR never enters.
