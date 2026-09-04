# Literature-Grounding Review: Data Converters and Signal Chains

**Reviewer role:** strict EE peer review, literature-grounding pass
**Date:** 2026-09-03

## Scope

Six lesson files were read in full:

| File | Subject |
|---|---|
| `lessons/module-17/lesson-01.html` | R-2R ladder DAC, DAC fundamentals |
| `lessons/module-17/lesson-15.html` | Monotonicity in data converters |
| `lessons/module-17/lesson-16.html` | DNL, INL, missing codes (string DAC build) |
| `lessons/module-17/lesson-17.html` | Architecture-specific monotonicity (SAR charge array) |
| `lessons/module-17/lesson-18.html` | Testing/fixing monotonicity, servo loop |
| `lessons/module-26/lesson-06.html` | Precision DAQ signal chain |

## Method

1. Every prose assertion, "Build it in Circuit Toy" table, `SimCheckWidget`
   `label`/`expect`/`why`/`experiments` field, `ChecklistWidget` item and
   `ExerciseWidget` solution was extracted. CSS, SVG path data and canvas
   drawing code were ignored, except where JavaScript **computes a displayed
   engineering quantity** — those formulas are themselves claims and are
   reviewed.
2. Every numeric claim was independently re-derived from the netlist given in
   the same file (nodal analysis, Thévenin reduction, capacitive charge
   division, Bode/phase-margin analysis). A claim is only marked VERIFIED if
   the arithmetic reproduces **and** the underlying principle has a named
   source.
3. Statuses:
   - **VERIFIED** — reproduces from the stated circuit *and* maps onto a named
     theorem, standard or textbook result, which is named in the citation column.
   - **UNVERIFIED** — a rule of thumb, an unsourced generalisation, an absolute
     ("always", "nobody", "impossible"), or a model constant with no derivation.
     Not necessarily wrong; not defensible from standard literature as written.
   - **HALLUCINATION RISK** — the number or behaviour cannot be produced by the
     circuit/definition given, contradicts another statement in the same
     course, or contradicts a directly applicable standard.

Abbreviations used in citations: **S&S** = Sedra & Smith, *Microelectronic
Circuits*; **AoE** = Horowitz & Hill, *The Art of Electronics* 3e; **Kester** =
Analog Devices, *The Data Conversion Handbook* (2005) and MT-series tutorials;
**IEEE 1241** = IEEE Std 1241-2010, *Terminology and Test Methods for ADCs*;
**Razavi** = Razavi, *Principles of Data Conversion System Design*; **FPE** =
Franklin, Powell & Emami-Naeini, *Feedback Control of Dynamic Systems*;
**Ott** = Ott, *Electromagnetic Compatibility Engineering* (2009);
**S&T** = Schreier & Temes, *Understanding Delta-Sigma Data Converters*.

---

## Findings

### module-17 / lesson-01.html — R-2R ladder DAC

| Claim (quoted, with location) | Status | Citation or reason |
|---|---|---|
| "LSB = V<sub>ref</sub> / 2<sup>N</sup>" — Key spec box, top | VERIFIED | Standard quantisation step definition. Kester Ch. 2; S&S §13.1. |
| "DR = 6.02×N + 1.76 dB" labelled **Dynamic Range** — Key spec box | UNVERIFIED (mislabelled) | The quantity 6.02N+1.76 dB is the **ideal SNR for a full-scale sinusoid** (Bennett 1948; IEEE 1241 §4.4; Kester MT-001), not dynamic range. The same file's exercise G1-1-2 correctly calls it SNR — the two labels contradict each other. |
| "A 12-bit DAC has 4096 steps." — Key Insight | UNVERIFIED (imprecise) | 2^12 = 4096 *levels*, 4095 *steps*. Standard usage distinguishes them (IEEE 1241 §3). |
| "With 2.5V reference, each LSB is 610µV" — Key Insight | VERIFIED | 2.5/4096 = 610.35 µV. |
| "But DNL and INL errors often exceed 1 LSB, limiting actual accuracy to 10-11 bits." — Key Insight | UNVERIFIED | Unsourced generalisation about the population of 12-bit DACs. Commodity 12-bit parts are routinely specified ±1 LSB INL / ±0.5 LSB DNL and guaranteed monotonic. No citation given. |
| "Higher resolution means smaller LSB. **16-bit gives ~1 ppm resolution.**" — exercise G1-1-1 explanation | HALLUCINATION RISK | 1 LSB of 16 bits = 1/65536 = **15.3 ppm** of full scale, not ~1 ppm. 1 ppm corresponds to ≈20 bits. Off by a factor of 15. |
| Architecture table: R-2R "Medium / 8-16 bit / needs matched resistors"; Binary Weighted "Fast / glitches at major transitions"; Sigma-Delta "Slow / 16-24 bit / oversampling"; Current Steering "Very Fast / Video/RF, 100MHz+" | VERIFIED | Matches the standard architecture taxonomy in Kester Ch. 3 and Razavi Ch. 1. Major-carry glitch in binary-weighted DACs: Kester MT-013. |
| Interactive computes `vout = (code / maxCode) * vref` with `maxCode = 2^N − 1`, while exercise G1-1-3 hint states "Vout = (Code / 2^N) × Vref" and the SimCheck uses V<sub>REF</sub>×D/2^4 | HALLUCINATION RISK (internal contradiction) | Three different transfer functions for the same converter in one file. For the R-2R topology built here, V<sub>out</sub> = V<sub>REF</sub>·D/2^N is the correct one (S&S §13.6; Kester Ch. 3). The canvas code will not agree with the exercises. |
| Build table: R0a = 20 kΩ "the 2R termination — not 10 k" | VERIFIED | Correct 2R termination for a voltage-mode R-2R ladder. S&S §13.6. |
| SimCheck probe `vout` = 3.125 V; `n3` = 3.125; `n2` = 2.1875; `n1` = 2.34375; `n0` = 1.171875 V for code 1010 | VERIFIED | Re-solved by nodal analysis on the tabulated netlist; all five agree exactly. 5 × 10/16 = 3.125 V. |
| "RTERM carries no current: the op-amp's + input takes none." | VERIFIED | Ideal op-amp input-current assumption. S&S §2.1; AoE §4.1.1. (Idealisation; real bias current ignored — acceptable for an ideal-solver exercise.) |
| Experiment 1: VB0→5 V gives +312.5 mV; "That superposition is the definition of linearity" | VERIFIED (with caveat) | 5/16 = 312.5 mV. Superposition is the defining property of a linear network (Desoer & Kuh, *Basic Circuit Theory* Ch. 2). Caveat: converter "linearity" as specified on a datasheet is INL/DNL deviation from a straight line, a different (if related) notion — IEEE 1241 §4.3. |
| Experiment 2: 10 kΩ from n3 to ground halves V(vout) to 1.5625 V; "the output impedance is R whatever the code is"; load on `out` instead gives 1.04 V | VERIFIED | Re-derived: R<sub>out</sub>(n3) = 2R‖2R = R = 10 kΩ, code-independent — the classic self-similar property of the R-2R ladder (S&S §13.6; Kester Ch. 3). 3.125·10/(10+10+10) = 1.042 V confirms the second figure. |
| "A binary-weighted ladder ... has an output impedance that changes with the code, **which is why nobody builds one**" — Experiment 2 | UNVERIFIED | Two problems. (a) The textbook objection to binary-weighted resistor DACs is the impractical 2^N spread of resistor *values* and the matching it demands, not output-impedance variation (S&S §13.6; Razavi Ch. 5). (b) "Nobody builds one" is contradicted by this file's own architecture table, which lists Binary Weighted as a shipping architecture, and by binary-weighted current-steering arrays in practice. |
| Experiment 3: R0a 20 k→10 k gives 3.07 V, 55 mV low, 1.1% of full scale, "the same relative error on a 12-bit converter is 45 LSBs" | VERIFIED (arithmetic) | Re-solved: V(n3) = 3.0702 V; error 54.8 mV = 1.096% FS; 1.096% × 4096 = 44.9 LSB. All three figures reproduce. |
| "**This is what integral nonlinearity is**" — Experiment 3, of the 55 mV termination error | UNVERIFIED | A wrong termination produces a largely *gain*-shaped deviation. INL is defined only *after* offset and gain error are removed by the endpoint or best-fit line (IEEE 1241 §4.3.2; Kester MT-011). The raw deviation quoted is therefore not what would be reported as INL. |
| Experiment 4: R3 = 21 kΩ gives step 198 mV vs 312.5 mV, DNL = −0.37 LSB; zero step at R3 = 22.9 kΩ (14.3% high) where 5/R3 = 4.375/20k | VERIFIED | Re-derived by Thévenin: lower ladder = 4.375 V behind 20 kΩ at code 7, 0 V behind 20 kΩ at code 8. Step = 5·20/41 − 4.375·21/41 = 198.2 mV; DNL = −0.366 LSB. Zero-step condition gives R3 = 22 857 Ω = 14.29% high. Method is the standard Thévenin reduction (S&S §13.6). |
| "The major-carry transition ... **is always the worst code** on a real part." | UNVERIFIED | The mid-scale major carry is the *typical* worst-case DNL location for binary-weighted and R-2R converters (Kester MT-011), but "always" is an absolute with no support; segmented and calibrated parts do not behave this way. |
| "the DAC is non-monotonic. It can no longer be used inside a feedback loop, because the loop has no consistent direction to move in. That is why datasheets promise monotonicity separately from accuracy, and why the MSB resistors are the ones that get trimmed." | VERIFIED | Non-monotonic DACs in feedback loops: Kester Ch. 5 / MT-015. Separate monotonicity guarantee and MSB laser trimming: Kester Ch. 3; Analog Devices AN-***/MT-013 on trimming thin-film ladders. |

### module-17 / lesson-15.html — Monotonicity

| Claim (quoted, with location) | Status | Citation or reason |
|---|---|---|
| "A converter is monotonic if and only if its Differential Nonlinearity (DNL) never drops below -1 LSB." — Key Insight | VERIFIED **for DACs** | DAC monotonicity ⟺ DNL ≥ −1 LSB at every code is the standard necessary-and-sufficient condition (Kester Ch. 2 / MT-015; Razavi §5.1). |
| The same rule applied to ADCs — "Monotonic ADC: Code always ↑ when input ↑", DNL slider spanning to −1.5 LSB with a DAC/ADC selector, "Missing Codes: Yes (code N)" reported for the DAC case too | HALLUCINATION RISK | Two conflations. (a) An ADC's DNL is bounded below by −1 LSB by construction — a code width cannot be negative — so the widget's −1.5 LSB ADC case is undefined (IEEE 1241 §4.3.1). (b) "Missing code" is an **ADC** term; a DAC with DNL = −1 has a zero-width *step*, not a missing code (Kester MT-010/MT-011). The file uses the terms interchangeably. |
| Threshold table: "> −0.5 Good linearity / −0.5 to −1 Small steps (OK) / **= −1.0 Missing code** / < −1.0 NON-MONOTONIC!" | HALLUCINATION RISK | Same DAC/ADC conflation as above, presented as a definitional table. |
| Risk mapping in code: `dnl < -0.5 → "Medium - Monitor closely"`, else `"Low - Safe for control"` | UNVERIFIED | Arbitrary threshold. No standard defines a −0.5 LSB DNL "control safety" boundary. |
| "MSB resistor has 8× more influence than LSB" — R-2R causes card | UNVERIFIED (unstated resolution) | True only for N = 4. The generic statement is 2^(N−1)×, as this course itself states in lesson-16. As written the card is about R-2R ladders in general. |
| "Need <0.05% tolerance for 12-bit monotonicity" — R-2R causes card | VERIFIED (derivable) | Monotonicity needs DNL ≥ −1 LSB, so MSB relative error ≤ 1/2^(N−1)/2 → 1/2^12 = 0.0244%... using the DNL ≥ −1 limit directly, ε ≤ 2/2^12 = 0.0488% ≈ 0.05%. Consistent with lesson-17's matching table. No source is cited on the page, however. |
| "Sigma-Delta ADC: **Inherently monotonic** by architecture ... Multi-bit modulators need DEM" | VERIFIED | A 2-level DAC is inherently linear and monotonic; multi-bit feedback DACs require DEM. S&T Ch. 2 and Ch. 6; Kester MT-022. |
| "SAR ADC signature: Repetitive 2<sup>k</sup> DNL spikes in histogram" | VERIFIED | Capacitor mismatch in a binary-weighted array produces DNL spikes at binary (major-carry) code boundaries. Kester MT-010/MT-011; Razavi Ch. 5. |
| Application table (motor servo / PID / power supply = CRITICAL, with specific consequences: "Motor jerks, oscillates, or reverses direction", "Output voltage oscillates, potential damage") | UNVERIFIED | Plausible engineering judgement, but the per-application criticality ranking and the specific failure modes are asserted without derivation or citation. |
| Five-step "Control Loop Oscillation Mechanism" narrative, ending "*This effectively converts negative feedback to positive feedback at that operating point!*" | UNVERIFIED | The sign-inversion statement is defensible by local linearisation (the Jacobian of the forward path changes sign), but the specific five-step overcorrect-and-oscillate sequence, including step 4 "Controller overcorrects, pushing past the non-monotonic region", is a narrative with no control-theory derivation offered and no source. |
| "Non-monotonic behavior can cause catastrophic failures in control systems." — opening paragraph | UNVERIFIED | Unsupported severity claim. |
| Build table: 1k/2k R-2R with R3A = 2.02 kΩ; "the step is **0.2892 V** against an ideal LSB of 0.3125 — a differential nonlinearity of **−0.075 LSB**, and still monotonic" | VERIFIED | Re-derived: V(n3)|<sub>7</sub> = 4.375·2020/4020 = 2.19836 V; V(n3)|<sub>8</sub> = 5·2000/4020 = 2.48756 V; step 289.20 mV; DNL = −0.0746 LSB. |
| "The ladder below n3 always looks like 2 kΩ ... The step reaches zero when 5/R3A = 4.375/2000, at **R3A = 2286 Ω** — 14.3% high." | VERIFIED | 5·2000/4.375 = 2285.7 Ω = 14.29% high. Constant ladder impedance: S&S §13.6. |
| "**One resistor out of nine**, 14% wrong, and the converter stops being usable in a feedback loop" | HALLUCINATION RISK | The build table for this lesson contains **eight** resistors (R3A, R3B, R2A, R2B, R1A, R1B, R0A, RT). "Nine" is the count from lesson-01's differently-sized table and appears to have been carried over. Separately: at exactly 14.3% the DNL is exactly −1, which this same lesson defines as *still monotonic* — so "stops being usable" overshoots its own criterion. |
| Exercise M22L1-2: 10-bit, 5 V, DNL = −0.8 at code 512 → 0.98 mV step | VERIFIED | (1+DNL)×LSB, LSB = 5/1024 = 4.883 mV → 0.977 mV. DNL definition per IEEE 1241 §4.3.1. |
| Exercise M22L1-4: 8-bit, ±0.5 LSB DNL → 0.39% matching | VERIFIED (derivable) | 0.5/2^7 = 0.39%. Consistent with lesson-16's 2^(N−1) weighting model. |
| Exercise M22L1-6 explanation: "DNL = −1 gives a 'missing code' but is still monotonic." | HALLUCINATION RISK | Applied to a DAC. A DAC with DNL = −1 has two codes at the same output — a zero-width step. Missing codes are an ADC phenomenon (IEEE 1241 §4.3.1; Kester MT-011). |

### module-17 / lesson-16.html — DNL, INL, missing codes

| Claim (quoted, with location) | Status | Citation or reason |
|---|---|---|
| "DNL measures local accuracy ... while INL measures global accuracy ... INL is the running sum of the DNL" | VERIFIED | Standard definitions and the cumulative-sum relationship. IEEE 1241 §4.3; Kester MT-011. |
| "For control applications, DNL is often more critical than INL." — Key Insight | UNVERIFIED | Widely repeated industry heuristic; no theorem, and no citation is given for the comparative claim. |
| "MSB mismatch of 0.1% → DNL error of 0.1% × 2^(N−1) LSB = **0.5 LSB for 10-bit**"; "For 12-bit ... **2 LSB**"; "For 16-bit, need <0.003% matching for 1 LSB DNL" | VERIFIED (derivable) | 0.001·512 = 0.512; 0.001·2048 = 2.05; 1/2^15 = 0.00305%. The weight×tolerance first-order model for major-carry DNL is standard: Kester MT-011; Razavi Ch. 5. |
| "At 16+ bits ... this is why high-resolution converters often use segmented architectures or sigma-delta topology." | VERIFIED | Segmentation and Σ-Δ as the standard responses to matching limits. Kester Ch. 3; S&T Ch. 1. |
| Error-pattern table (R-2R spikes at major carries; SAR 2^k pattern; segmented errors at segment boundaries; pipeline at stage boundaries; flash random from comparator offsets; mitigations: laser trim, DEM, digital correction, bubble-error correction) | VERIFIED | Matches Kester Ch. 3/MT-010/MT-011 and Razavi Ch. 4–6 (flash bubble-error correction; pipeline MDAC gain error and digital correction). |
| Build table: taps read "**0.5556, 1.3889 and 1.9444 V**", steps 0.5556/0.8333/0.5556/0.5556, "DNL = −0.111, +0.333, −0.111, −0.111 LSB" | VERIFIED | Re-derived: I = 2.5/4.5 kΩ = 555.56 µA; taps 0.5556 / 1.3889 / 1.9444 V; LSB = 0.625 V; DNL sequence reproduces exactly. Kelvin-divider transfer function: Kester Ch. 3. |
| "INL is the running sum of those, and it returns to zero at the top — it has to, because the string ends at V<sub>REF</sub> whatever the resistors do." | VERIFIED | Endpoint-fit INL is zero at both endpoints by construction. IEEE 1241 §4.3.2. |
| "R3 is *fifty percent* wrong, **forty times the error** that lesson 15's R-2R ladder needed before it started to misbehave" — build prose, and repeated verbatim in the SimCheck `intro` | HALLUCINATION RISK | Lesson-15's stated breaking point is **14.3%**. 50% / 14.3% = **3.5×**, not 40×. Off by an order of magnitude, and stated twice in the same file. |
| "the taps are physically ordered along a string carrying one current in one direction, so a later tap is higher than an earlier one no matter what the resistances are. **Monotonicity here is a property of the topology rather than of the components**" | VERIFIED | The inherent monotonicity of the string/Kelvin-divider DAC is a standard result. Kester Ch. 3 / MT-014; Razavi §5.2. |
| "2<sup>n</sup> resistors and 2<sup>n</sup> switches, against the 2n of a ladder" | VERIFIED | Standard element counts. Kester Ch. 3. (Pedantically the ladder needs 2n+1 with its termination, as this course's own lesson-01 table shows with 9 elements for n = 4.) |
| SimCheck probes t1 = 555.56 mV, t2 = 1.38889 V, t3 = 1.94444 V, step ratio 1.333 LSB, INL(t2) = 138.9 mV | VERIFIED | All five re-derived exactly; 0.13889 V = +0.2222 LSB, the maximum of the running sum (−0.111, +0.222, +0.111, 0). |
| "One wrong resistor gives you one wrong step and **a permanent offset in everything above it**." — probe `t3` `why` | HALLUCINATION RISK (self-contradiction) | Contradicted by the `inl` probe three lines later in the same widget: the deviation is +0.222 LSB at t2 but +0.111 at t3 and **0** at the top. The string renormalises because its total is pinned to V<sub>REF</sub>; the offset is not permanent and not constant. |
| "which is why an INL plot is **always** a bow rather than a drift" — probe `inl` `why` | UNVERIFIED | Endpoint-fit INL returns to zero at the endpoints, but the shape between them is not always a bow; S-shaped INL is at least as common in R-2R and pipeline parts (Kester MT-011 shows both). Best-fit INL does not return to zero at the endpoints at all. "Always" is unsupported. |
| Experiment: R3 → 10 kΩ, "still monotonic ... no resistor value that can change that" | VERIFIED | Follows from the string topology (positive resistances, unidirectional current). Kester MT-014. |
| Experiment: all resistors 1 kΩ → taps 625 mV / 1.250 V / 1.875 V; "**Matching is cheap on a die and absolute accuracy is not**" | VERIFIED | Arithmetic exact. The ratio-versus-absolute-accuracy principle is foundational IC design: Gray, Hurst, Lewis & Meyer, *Analysis and Design of Analog Integrated Circuits* §2.9/§4.2; Razavi Ch. 2. |
| Experiment: 10 kΩ load on t2 → "**exactly 1.2500 V**"; "output impedance ... highest in the middle, near zero at the ends" | VERIFIED | Thévenin at t2 = 1.38889 V behind 2 k‖2.5 k = 1111.1 Ω; 1.38889 × 10000/11111.1 = 1.25000 V exactly. Divider source impedance maximal at mid-string: elementary Thévenin (S&S §1.x / Desoer & Kuh Ch. 3). |
| "and it is also why **a string DAC settles slowly: the buffer has to drive whatever comes next through its own bandwidth**" | UNVERIFIED | String-DAC settling is dominated by the RC of the resistor string and the switch network as well as the buffer; attributing the slowness to the buffer alone is asserted, not derived, and no source is offered. |
| Experiment: 8-bit comparison, "**256 resistors and 256 switches**, against 16 resistors and 8 switches" | VERIFIED | 2^8 = 256; 2n = 16; one SPDT per bit = 8. |
| "at 12 it is 4096 resistors and **nobody builds one**" | UNVERIFIED | Absolute claim. Commercial 12-bit and 16-bit string-based DACs exist (typically segmented strings). No citation. |
| "**Real converters are hybrids** — a string for the top few bits where monotonicity matters most, a ladder or a charge array below it." | VERIFIED | The segmented DAC architecture, thermometer/string MSBs over binary LSBs. Kester Ch. 3 / MT-014; Razavi §5.3. |
| Exercise EX22-2: 10-bit, 0.1% MSB mismatch → 0.512 LSB DNL | VERIFIED | 0.001 × 2^9 = 0.512. |

### module-17 / lesson-17.html — Architecture-specific monotonicity (SAR charge array)

| Claim (quoted, with location) | Status | Citation or reason |
|---|---|---|
| Matching table: 8-bit 0.4%, 10-bit 0.1%, 12-bit 0.025%, 14-bit 0.006%, 16-bit 0.0015%, 18-bit <0.0004%, header "Matching for 0.5 LSB DNL" | VERIFIED (derivable) | Each entry equals 1/2^N, which is exactly the 0.5 LSB DNL condition under the 2^(N−1) weighting model used in lesson-16. Internally consistent across three lessons. No external citation given on the page. |
| "At 16+ bits, the matching requirements (0.0015%) are **physically impossible to achieve with passive components**." — warn box; echoed in exercise EX22-3 as "impractical for any binary-weighted architecture" | HALLUCINATION RISK | Directly contradicted by shipping parts: 16-bit and 18-bit laser-trimmed thin-film R-2R DACs, and the 20-bit R-2R AD5791 (1 LSB INL). Likewise 16- to 20-bit SAR ADCs with *guaranteed no missing codes* (e.g. the LTC2378-20 class) are standard. "Physically impossible" is falsified by the datasheet literature. |
| "This is why **all** 24-bit audio converters and precision measurement ADCs use sigma-delta architecture." | UNVERIFIED | "All" is an absolute. 24-bit audio is overwhelmingly Σ-Δ, but precision measurement instruments also use integrating (dual-slope/multi-slope) converters, and high-resolution SARs. No source supports the universal. |
| Build table (SAR charge array): C3 = 8.08 pF, C2 = 4, C1 = 2, C0 = 1, CT = 1 pF (terminating), total 16.08 pF | VERIFIED (as a binary array) | The binary array plus a dummy/terminating unit capacitor summing to 2^N·C<sub>unit</sub> is the classical charge-redistribution array of McCreary & Gray, *IEEE JSSC* SC-10(6), 1975; Allen & Holberg Ch. 10. |
| "**What to run: a DC operating point** for each trial code ... V(vcm) = 2.5 × (selected C)/16.08 pF" | HALLUCINATION RISK | Node `vcm` connects only to capacitors and to an op-amp input. At a DC operating point a solver opens every capacitor, leaving `vcm` with **no DC path to ground** — a singular node. The quoted expression is the *charge*-division result for an initially uncharged network, which a DC analysis does not compute. The stated analysis cannot produce the stated numbers. |
| Described procedure: comparator compares V(vcm) against V(vin) directly, bottom plates switched to V<sub>REF</sub>/ground | HALLUCINATION RISK (architecture mismatch) | This is a *voltage-mode SAR with a separate capacitive DAC*, not charge redistribution. In the charge-redistribution SAR the input is first **sampled onto the array**, the top plate is then floated, and the comparator resolves V<sub>x</sub> = −V<sub>in</sub> + V<sub>REF</sub>·D/2^N against a fixed common mode (McCreary & Gray 1975; Razavi §5.4). The lesson's own prose invokes charge-array reasoning ("in a charge array the MSB capacitor simply adds to the total") for a circuit that does not implement it. |
| "Code 7 gives **1.0883 V** and code 8 gives **1.2562 V**, a step of 0.1679 against an ideal LSB of 0.15625: **DNL = +0.075 LSB**" | VERIFIED (arithmetic, given the divider model) | 2.5·7/16.08 = 1.08831; 2.5·8.08/16.08 = 1.25622; step 167.91 mV; ideal 156.25 mV; DNL = +0.0746. Arithmetic is exact — but see the two rows above regarding whether the stated analysis produces it. |
| "The same 1% error on the same bit, and the sign is *opposite* to the ladder's −0.075 ... **The same component error produces opposite errors in the two architectures**" | VERIFIED (derivable) | Follows from the two transfer functions: a larger series MSB rung *reduces* its divider contribution, a larger MSB capacitor *increases* its charge share. Derivable from the netlists on the two pages; no textbook citation is offered, and none is strictly needed. |
| `archData` model constants: R-2R `matchingSensitivity: 4096`, SAR `2048`, pipeline `512`, segmented `256`; `baseError` 0.3/0.05/0.4/0.2/0.25 LSB | HALLUCINATION RISK | (a) The `baseError` DNL floors are invented constants with no derivation or source. (b) The R-2R sensitivity of **4096** at 12 bits contradicts this course's own 2^(N−1) = **2048** model used in lesson-16 and in the matching table on this very page — a factor-of-two internal inconsistency. |
| `const isMonotonic = dnl < 1.0;` — displays "Guaranteed" / "NOT GUARANTEED" | UNVERIFIED | Monotonicity is DNL ≥ **−1** (Kester MT-015). Testing a positive-signed "expected max DNL" against +1 is not that criterion, and "Guaranteed" is a datasheet term being asserted from a heuristic model. |
| "Sigma-Delta: inherently monotonic through oversampling and noise shaping, which averages out component mismatches" — Key Insight | VERIFIED (mechanism partly imprecise) | Inherent monotonicity comes from the **2-level feedback DAC**, which cannot be non-monotonic (S&T Ch. 2), as this file's own warn box correctly states. Oversampling/noise shaping deliver resolution, not monotonicity — the Key Insight attributes it to the wrong mechanism relative to the warn box on the same page. |

### module-17 / lesson-18.html — Testing and fixing monotonicity

| Claim (quoted, with location) | Status | Citation or reason |
|---|---|---|
| "histogram methods (for ADCs) or servo-loop tests (for DACs)" as the standard validation methods | VERIFIED | Code-density (histogram) testing: IEEE 1241-2010 §4.4.2; Doernberg, Lee & Hodges, *IEEE JSSC* SC-19(6), 1984. Servo-loop code-transition testing: Kester, *Data Conversion Handbook* Ch. 5. |
| Testing-methodology canvas: "DAC: Triangle wave → scope for backward steps"; "ADC: Pure sine → FFT shows harmonics" | VERIFIED | Sine-wave FFT test: IEEE 1241 §4.4.1. |
| "If code N is missing but N−1 and N+1 exist, averaging will produce N ... because noise causes samples to occasionally hit adjacent codes" | VERIFIED | The dither/averaging principle — additive noise of ≳1 LSB rms plus averaging recovers sub-LSB information. Kester MT-004/MT-005; Widrow & Kollár, *Quantization Noise*. |
| "**4x averaging reduces missing code impact by ~6dB**" | UNVERIFIED | 4× averaging gives 6 dB of *noise* reduction (√N averaging — Kester MT-004). A missing code is a **deterministic, fixed-pattern** error; averaging does not reduce it by √N unless dither randomises it, and the page does not establish that condition. Mixing a noise result with a DNL result. |
| "16x averaging can fully eliminate **most** missing code effects" | UNVERIFIED | Vague quantifier, no derivation, no citation. |
| Mitigation table (guaranteed-monotonic part, averaging, dithering, calibration, sigma-delta, software compensation) with "Effectiveness: Best / Good / Moderate" ratings | UNVERIFIED | The techniques are all real and standard; the comparative effectiveness ranking is asserted without source. |
| "**Test Confidence**" computed as `min(99, 100*(1 - 1/sqrt(samplesPerCode)))` | UNVERIFIED | 1/√(samples per code) is the standard-error estimate for a code-density DNL measurement (defensible — Doernberg/Lee/Hodges 1984; IEEE 1241 Annex), but mapping "1 − σ" to a percentage *confidence* is not a statistical construct in any standard. |
| Averaging is modelled by applying a moving average **to the histogram** (`smoothed[i] = mean of neighbouring bin counts`) | UNVERIFIED | Averaging N conversions changes the effective transfer characteristic and noise of the acquisition; it does not smooth the code-density histogram of a ramp test in this way. Modelling shortcut with no basis given. |
| Exercise EX22-4: 100 000 samples, 8-bit → "Uncertainty = 1/√390.6 = 5.1%" | VERIFIED (formula) | σ<sub>DNL</sub> ≈ 1/√N<sub>t</sub> for a ramp code-density test. Doernberg, Lee & Hodges 1984; IEEE 1241 §4.4.2. |
| EX22-4 explanation: "a measured DNL of −0.5 LSB could actually be anywhere from −0.47 to −0.53 LSB" | HALLUCINATION RISK | 1/√N<sub>t</sub> is an **absolute** uncertainty in LSB (±0.051 LSB → −0.45 to −0.55 LSB), not a 5% *relative* uncertainty on the DNL value. The stated interval is wrong by a factor of ten. |
| **Build table**: RINT 100 kΩ from `error` to `integ`, CINT 1 µF from `integ` to ground, EBUF senses `integ` — described throughout as "the integrator" | HALLUCINATION RISK (root cause) | This is a **first-order RC low-pass with unity DC gain**, not an integrator. A Miller integrator requires the capacitor in an amplifier's feedback path. Solving the tabulated loop at DC: `position = setpoint − position` ⟹ **V(position) = 1.25 V**, V(error) = 1.25 V, V(ctrl) = 1.25 V. Every SimCheck probe below inherits this error. |
| SimCheck probe `final`: "V(position) at the end of the run — expect **2.500 V** ... **the integrator forces it there regardless of the DAC's gain**" | HALLUCINATION RISK | Not reproducible from the tabulated netlist (1.25 V, see above). The *principle* — type-1 loop has zero steady-state error to a step — is standard (FPE §4.2 final-value theorem / system type), but the circuit given does not realise it. |
| SimCheck probe `err`: "expect **0.000 V** ... it is why this loop has no steady-state error while a proportional-only loop would have one proportional to 1/(1 + loop gain)" | HALLUCINATION RISK | Actual V(error) = 1.25 V for this netlist — which *is* the proportional-loop result 1/(1+L) with L = 1, i.e. the circuit is exactly the case the text says it is not. Steady-state error of a type-0 loop = 1/(1+K<sub>p</sub>): FPE §4.2 (verified as a principle, misapplied here). |
| SimCheck probe `ctrl`: "expect **2.500 V** ... when you halve the DAC gain later, this is the number that doubles while V(position) stays put" | HALLUCINATION RISK | Actual 1.25 V; and with EDAC = 0.5 the tabulated loop settles at V(position) = 0.833 V, V(ctrl) = 1.667 V — neither "stays put" nor "doubles". |
| SimCheck probe `tau`: "Time for V(position) to reach 63% of 2.5 V (1.575 V) — expect **0.1 s**"; "R<sub>INT</sub>C<sub>INT</sub> = 0.1 s" | HALLUCINATION RISK | 63% of 2.5 V = 1.575 V is correct arithmetic, and 1−1/e = 63.2% is the standard first-order result (S&S §1.x; any linear systems text). But V(position) never reaches 1.575 V in this circuit (it asymptotes to 1.25 V), and the *closed*-loop time constant of the tabulated network is RC/(1+L) = 50 ms, not 100 ms. |
| SimCheck probe `pm`: "Crossover is at 1/(R<sub>INT</sub>C<sub>INT</sub>) = 10 rad/s, where the plant's 10 ms pole contributes arctan(0.1) = 5.7°, so the phase margin is **84°**" | VERIFIED (for an ideal-integrator loop) — NOT for this netlist | The Bode phase-margin arithmetic is correct and standard (FPE §6.4; S&S §10.x): PM = 180° − 90° − arctan(0.1) = 84.3°, overshoot ≈ 0. But the tabulated loop has no integrator, so its loop gain never exceeds unity and there is no crossover to speak of. |
| Experiment: "Halve EDAC's gain ... the loop gets **twice as slow** ... DAC gain is loop gain and crossover moves down with it" | VERIFIED as a principle, not for this netlist | Loop-gain scaling moves the unity-gain crossover proportionally for a 1/s loop: FPE §6.1. Not reproducible from the tabulated RC network. |
| Experiment: "**Make the DAC non-monotonic: give EDAC a gain of −0.2 instead of 1.** The loop **runs away**" | HALLUCINATION RISK (two errors) | (a) A global gain of −0.2 is a **sign inversion**, not non-monotonicity: it is globally monotonic-decreasing. Non-monotonicity is a *local* slope reversal over one or a few codes (Kester MT-015); a scalar negative gain does not model it. (b) In the tabulated network the loop-gain magnitude is 0.2 < 1, so the loop is stable and settles at −0.625 V; it does not run away. |
| "A negative slope anywhere in the forward path turns negative feedback into positive feedback." | VERIFIED (as local linearisation) | Sign of the loop gain determines the feedback sense; a sign change makes the equilibrium unstable for an integrating loop. FPE §4.1/§6; Åström & Murray, *Feedback Systems* Ch. 1. |
| "**Non-monotonicity is not an accuracy specification, it is a stability one** ... This is why converter datasheets guarantee monotonicity separately, and **often to more bits than they guarantee accuracy**." | UNVERIFIED | The separate-guarantee half is standard (Kester Ch. 2). The "more bits than accuracy" half is an unsourced generalisation, and in the common case the opposite is advertised — parts are frequently specified as, e.g., 16-bit resolution with 14-bit guaranteed monotonicity. |
| Experiment: 1 mV sensor offset → "V(position) settles at **2.499 V** — off by exactly the offset ... **Feedback rejects everything inside the loop and nothing in the sensor**" | VERIFIED (principle) | Sensor error enters through the complementary sensitivity T ≈ 1 in-band and is not attenuated, unlike plant disturbances which see S = 1/(1+L). Åström & Murray §12.1; FPE §4.3. (The numeric result again presumes the missing integrator.) |
| "the expensive component in a precision servo is the sensor and its amplifier, **never** the driver" | UNVERIFIED | Design heuristic stated as an absolute. No citation. |
| Experiment: RINT → 10 kΩ, "Crossover moves to 100 rad/s ... arctan(100 × 0.01) = 45°, so the phase margin falls from 84° to **45°**" | HALLUCINATION RISK (approximation error) | The plant pole (100 rad/s) is no longer above crossover, so crossover is not 1/RC. Solving \|L(jω)\| = 1 for L = 100/[ω(1+j0.01ω)] gives ω<sub>c</sub> ≈ 78.6 rad/s and **PM ≈ 52°**, not 45°. |
| "Take RINT to 1 kΩ and crossover lands at **1000 rad/s**, ten times past the plant pole, with **about 6° of margin** left." | HALLUCINATION RISK | Same error, now severe. Past the second pole the slope is −40 dB/decade, so crossover is ω<sub>c</sub> ≈ **309 rad/s**, giving **PM ≈ 18°** — a ringing but stable loop, not the near-instability implied. The quoted 6° comes from assuming ω<sub>c</sub> = 1/RC, which is only valid when the second pole is well above crossover. |
| "**You cannot design a loop faster than the thing it is controlling**" | VERIFIED (as stated qualitatively) | Non-minimum-phase and pole-location limits on achievable bandwidth: FPE §6.6; Åström & Murray Ch. 12 (Bode integral / fundamental limits). |

### module-26 / lesson-06.html — Precision DAQ signal chain

| Claim (quoted, with location) | Status | Citation or reason |
|---|---|---|
| "24-bit (16.7M levels)" | VERIFIED | 2^24 = 16 777 216. |
| Header prose "measuring microvolt-level signals with **sub-ppm accuracy**" vs spec box "Accuracy: **<10 ppm**" | UNVERIFIED (self-contradiction) | The two accuracy claims differ by more than an order of magnitude in adjacent blocks. |
| Error budget combined by RSS: `sqrt(refError² + adcError² + pgaError² + quantError² + noiseError²)` | VERIFIED (with caveat) | Root-sum-square combination of independent uncertainty contributors is standard: JCGM 100:2008 (GUM) §5.1; Kester Ch. 8 error-budget method. Caveat: the terms combined here (reference tempco drift, INL, PGA gain error) are *systematic*, for which worst-case summation is the conservative convention; RSS of systematics is an industry shortcut, not a GUM result. |
| `quantError = 0.06; // 24-bit LSB in ppm` | VERIFIED (arithmetic) / imprecise | 1/2^24 = 0.0596 ppm. But quantisation *error* contribution is conventionally LSB/√12 = 0.017 ppm rms (Bennett 1948; IEEE 1241 §4.4). |
| Default displayed budget: "Reference Error 40 ppm / ADC 5 / Total 42 / **Effective Bits 21.5**" | HALLUCINATION RISK | With the page's own formula, `effBits = 24 − log2(41.58/0.06)` = **14.6 bits**, not 21.5. 42 ppm corresponds to ≈1 part in 23 800 ≈ 14.5 bits. The hardcoded default is wrong by ~7 bits and disagrees with the code that overwrites it. |
| "Effective Bits" defined as `24 − log2(totalError/quantError)` | UNVERIFIED | ENOB has a standard definition, ENOB = (SINAD − 1.76)/6.02, from a dynamic sine-wave test (IEEE 1241 §4.4.3). Deriving an "effective bits" figure from a DC ppm error budget is a nonstandard construction and is not equivalent. |
| Default error budget total (41.6 ppm) exceeds the chart's own drawn "Target: 10 ppm" line and the spec box's "<10 ppm" | UNVERIFIED (self-contradiction) | The stated system specification is not met by the page's default configuration; nothing in the text acknowledges this. |
| `refNoiseRms = vrefNoise / 6.6; // pp to rms` | VERIFIED | The 6.6× peak-to-peak/rms crest factor for Gaussian noise (±3.3σ, 0.1% exceedance) is the standard precision-analog convention. Kester MT-048; ADI MT-003. |
| `inputAmpNoise = 0.02 * Math.sqrt(bw)` for a "20 nV/√Hz input amp" | UNVERIFIED | (a) Uses the −3 dB bandwidth rather than the noise-equivalent bandwidth (1.57 × f<sub>−3dB</sub> for a single pole — Kester MT-048). (b) Ignores 1/f noise entirely, which dominates in the sub-10 Hz band this system operates in — and the page's *own* noise-spectrum canvas draws a `50/f` 1/f term below 10 Hz that the calculation does not use. |
| Reference noise referred to input as `refNoiseRms²/gain²`, i.e. an additive input-referred term | UNVERIFIED | In a ratiometric converter, reference noise **multiplies** the signal (it is a gain noise) and contributes nothing at zero input. Modelling it as a signal-independent additive input-referred term is a simplification presented without justification. Cf. Kester MT-022; TI SBAA***/"Noise Analysis in Precision Delta-Sigma ADCs". |
| `snrDb = 20*log10(fullScaleRti / totalRtiNoise)` with fullScale = 10 V/gain | UNVERIFIED | SNR is conventionally referenced to the rms of a full-scale sine, FS/(2√2) — using the peak full-scale value overstates SNR by ≈9 dB (IEEE 1241 §4.4). |
| `noiseFree = (snrDb − 1.76)/6.02` displayed as "**Noise-Free Bits**" | HALLUCINATION RISK (definitional) | That formula is **ENOB**. Noise-free code resolution is defined with the 6.6× peak-to-peak factor and is ≈2.7 bits *lower* than ENOB (ADI MT-003; TI precision-ADC noise app notes). The page's own exercise 2 uses the correct definition — "Noise-free bits = log2(FS/(noise_rms × 6.6))" — so the widget and the exercise define the same term two incompatible ways. |
| Default noise display: "Input Noise 0.15 µVrms / Total RTI 0.18 / **SNR 134 dB** / Noise-Free Bits 22.3" | HALLUCINATION RISK | Recomputing with the page's own formulas and defaults (gain 64, 1 µVpp ref, 0.5 µVrms ADC, 100 Hz): input amp noise 0.200 µV, total RTI 0.200 µV, SNR = **118 dB**, "noise-free bits" = 19.3. The hardcoded defaults are ~16 dB and ~3 bits optimistic. |
| Butterworth magnitude `h2 = 1/(1 + (f/fc)^(2·order))`; default "Attn @ Nyquist −32 dB" (250 SPS, fc 20 Hz, 2nd order) | VERIFIED | Standard Butterworth magnitude-squared response (S&S §17.3; Van Valkenburg, *Analog Filter Design* Ch. 4). Re-derived: 10·log10(1/(1+6.25⁴)) = −31.8 dB. |
| "Settling Time" = `5 * tau * order`; "Group Delay" = `order * tau` | UNVERIFIED | (a) 5τ = 99.3% settling — nowhere near adequate for the 24-bit/ppm system this page specifies (24-bit settling needs ≈17 τ). (b) Multiplying by filter order is not the settling behaviour of a Butterworth (a 2nd-order Butterworth has ζ = 0.707 and settles per the standard second-order result, FPE §3.4). (c) The DC group delay of a 2nd-order Butterworth is √2/ω<sub>c</sub> = 1.41τ, not 2τ. No source given for either rule. |
| Displayed defaults "Settling Time 50 ms / Group Delay 8 ms" | HALLUCINATION RISK | The page's own formulas give 79.6 ms and 15.9 ms for the default settings. Hardcoded values disagree with the code. |
| Section header "Design the input anti-aliasing filter **for sigma-delta ADC**", with attenuation evaluated at the output-rate Nyquist (125 Hz for 250 SPS); echoed in the SimCheck ("the ADC samples at 250 Hz, so its Nyquist limit is 125 Hz") and in exercise 3 | HALLUCINATION RISK (conceptual) | For a Σ-Δ ADC the modulator samples at OSR × the output rate; the alias-vulnerable bands are the narrow windows around multiples of the **modulator** clock, and the on-chip decimation filter handles everything else. That is precisely the point of oversampling. Kester MT-021/MT-022; S&T Ch. 1. Designing the external AAF against the *output-data* Nyquist is the analysis that oversampling exists to avoid. |
| "With the original 100 nF the 79.6 Hz corner already sits below Nyquist, **which is the correct relationship**" — SimCheck experiment 3 | UNVERIFIED | Even on its own terms, a single pole at 79.6 Hz gives only ≈4 dB at 125 Hz — no meaningful anti-alias rejection for a 24-bit system. The sufficiency claim is asserted, not derived. |
| `gndBounce = digitalCurrent * gndZ * 0.01` (star case) | HALLUCINATION RISK | Ohm's law gives 50 mA × 10 mΩ = 0.5 mV, matching the page's displayed default — but the code's multiplier yields **5 mV**, a factor of ten high. One of the two is wrong; the code is. |
| Ground topology ranking: "Star Ground (**Recommended**)" > "Split Ground Planes (ACCEPTABLE)" > "Single Ground (**Poor**)" | HALLUCINATION RISK (contradicts standard guidance) | The established mixed-signal recommendation is a **single solid, unbroken ground plane** with partitioned component placement; **splitting** planes is specifically warned against because it forces return current into large loops. Ott §3.2/§17; Kester MT-031 ("Grounding Data Converters"); Johnson & Graham, *High-Speed Digital Design* Ch. 5. The page ranks the discouraged option above the recommended one. (Star/single-point grounding is defensible for a low-bandwidth 250 SPS system per Ott §3.1 — but not the split-over-solid ordering.) |
| `coupling` = −80/−60/−40 dB by topology; `resolution = 24 − log2(coupledNoise/lsb)`; default "Coupling −60 dB / Effective Resolution 22 bits" | HALLUCINATION RISK | (a) The coupling figures are invented constants with no model or citation. (b) Recomputing with the page's own formula and the star default (−80 dB) gives 19.9 bits, not 22. (c) A peak-to-peak coupled noise is compared directly against an LSB with no pp-to-rms conversion, inconsistent with the 6.6× factor used elsewhere in the same file. |
| Component table (LTC6655/ADR4525 references, ADS1262/AD7177-2 ADCs, AD8628/OPA2188 amplifiers, AD8253/PGA280 PGAs, Vishay Foil resistors) with the stated parameter targets | VERIFIED | All are real parts whose datasheet specifications meet or exceed the stated targets (<2 ppm/°C reference drift, <5 µV V<sub>OS</sub>, <50 nV/°C drift, <5 nV/√Hz, <5 ppm/°C TCR). |
| Exercise 1: 4 ppm × 10 V = 40 µV = 67 LSB of a 24-bit/10 V converter | VERIFIED | 10/2^24 = 0.596 µV; 40/0.596 = 67.1. |
| Exercise 2: "Noise-free bits = log2(FS/(noise_rms × 6.6))" → 22.5 bits | VERIFIED | The standard noise-free code resolution definition. ADI MT-003; TI precision-ADC noise notes. (Contradicts the widget — see above.) |
| Exercise 3: "attn = −20×n×log10(f/fc)" → 5th order for 60 dB at 5×fc | VERIFIED (asymptotic form) | Asymptotic Butterworth roll-off of 20n dB/decade. S&S §17.3. 20·log10(5) = 14.0 dB/order; 60/14 = 4.3 → 5th order. (The Σ-Δ framing objection above still applies.) |
| Exercise 4: 1.5 ppm/°C × 40 °C = 60 ppm = 600 µV at 10 V; "This is a gain error because the reference scales the ADC full scale" | VERIFIED | Ratiometric reference relationship; reference error appears as full-scale/gain error. Kester Ch. 2/MT-087. |
| SimCheck probes `dcgain`/`vout`/`adc` = 64.0 mV, "which is 36.1 dB" | VERIFIED | 1 mV × 64 = 64 mV; 20·log10(64) = 36.12 dB. At DC C1 is open and the ideal VCVS draws no input current, so both RCs are lossless. |
| SimCheck probe `fin` = **79.6 Hz**; "1/(2πRC) with **R = 20 kΩ, not 10**: the capacitor is differential, so the loop goes out through one 10 k and back through the other" | VERIFIED | 1/(2π·20 kΩ·100 nF) = 79.58 Hz. The series-loop resistance for a differential (bridging) capacitor is the sum of both source resistances — standard differential-filter result; Kester MT-070/MT-068 ("RC filtering in front of an in-amp"); AoE §5.x. |
| SimCheck probe `fpost` = **64.9 Hz**; "the post-gain RC corners at 1/(2π × 1.1 kΩ × 1 µF) = 144.7 Hz ... 79.6 and 144.7 Hz **cascade to a 64.9 Hz corner**, below the lower of the two" | VERIFIED | Re-derived: solving (1+(f/79.577)²)(1+(f/144.686)²) = 2 gives f = **64.90 Hz**. The "two cascaded poles are already 3 dB down before either one is" statement is the standard cascaded-bandwidth result (S&S §9.x bandwidth shrinkage). |
| "note that Rout_IA is in that RC whether you meant it to be or not, a 10% shift from the 1 k alone" | VERIFIED | 144.69/159.15 = 0.909, i.e. 9.1% lower. |
| Experiment 1: gain 64→128, corners unmoved; "put the filter *inside* the feedback loop of a real amplifier and the gain-bandwidth product ties them together, so doubling the gain halves the bandwidth" | VERIFIED (slightly imprecise) | Constant gain-bandwidth product of an internally compensated op-amp: S&S §2.7; AoE §4.4.2. Imprecision: the GBW coupling follows from the *closed-loop gain setting*, not from whether a filter is inside the loop. |
| Experiment 2: "**The first stage sets the noise floor of the entire chain** — **Friis' formula**, the same result that decides why an LNA goes first in a receiver. Everything downstream of a gain of 64 is 36 dB less important than it looks." | VERIFIED | Friis cascade formula for noise factor, F = F₁ + (F₂−1)/G₁ + …: Friis, *Proc. IRE* 32(7), 1944; Pozar, *Microwave Engineering* §10.2; Razavi, *RF Microelectronics* §2.3. 20·log10(64) = 36 dB. (Friis is strictly an available-power-gain result; applying it to a voltage-gain baseband chain is a standard and accepted analogy.) |
| Experiment 3: C1 10 nF → input corner **796 Hz** | VERIFIED | 10× less C = 10× the corner: 795.8 Hz. |
| Experiment 4: "Make Rin+ 10 kΩ and Rin− 1 kΩ ... set both Vin+ and Vin− to the same 1 V AC source ... **the common-mode signal reaches N1 and N2 through different impedances, arrives with different phase above the filter corner**" and appears at the output | HALLUCINATION RISK | Not reproducible from the tabulated netlist. C1 is the **only** element between N1 and N2 and the VCVS draws no input current, so for a purely common-mode drive the loop IN+ → Rin+ → C1 → Rin− → IN− has zero net EMF: **no current flows, V(N1) = V(N2) = V<sub>CM</sub> at every frequency, and the differential output stays at zero regardless of the resistor mismatch.** The classical CM-to-DM conversion this describes requires *common-mode capacitors to ground* on each input (the 10:1 C<sub>DM</sub>/C<sub>CM</sub> rule), which this build table does not contain. |
| "**CMRR is a property of the resistors in front of the amplifier at least as much as of the amplifier**, which is why instrumentation amps are sold with the gain resistors on-die and why input filters are built from matched pairs." | VERIFIED (principle) | Source-impedance imbalance degrading in-amp CMRR, and the matched-CM-capacitor filter rule: Kester MT-061/MT-068/MT-070; S&S §2.4 (difference-amplifier CMRR set by resistor ratio matching); AoE §5.14. The principle is correct — only the demonstration circuit above cannot show it. |

---

## Items requiring follow-up

Only UNVERIFIED and HALLUCINATION RISK items are listed. No justification is
attempted for any of them.

### HALLUCINATION RISK — number, behaviour or definition not reproducible, or contradicts a directly applicable standard

**module-17/lesson-18.html — the servo lesson's circuit is not the circuit it describes**

1. Build table RINT/CINT form a first-order RC low-pass, described throughout as "the integrator". DC solution of the tabulated loop is V(position) = V(error) = V(ctrl) = **1.25 V**.
2. Probe `final` expects 2.500 V.
3. Probe `err` expects 0.000 V.
4. Probe `ctrl` expects 2.500 V, "doubles to 5 V when you halve the DAC gain".
5. Probe `tau` expects 0.1 s to reach 1.575 V — a level the circuit never reaches; closed-loop τ is 50 ms.
6. Experiment "Halve EDAC's gain ... V(position) still settles at exactly 2.500 V ... V(ctrl) changes to 5 V".
7. Experiment "give EDAC a gain of −0.2 ... The loop **runs away**" — (a) a scalar negative gain is a sign inversion, not non-monotonicity; (b) the tabulated loop is stable at −0.625 V.
8. Experiment "RINT 10 kΩ ... phase margin falls to **45°**" — correct value ≈52°.
9. Experiment "RINT to 1 k ... crossover lands at 1000 rad/s ... about **6°** of margin" — correct crossover ≈309 rad/s, PM ≈**18°**.
10. Exercise EX22-4: "−0.47 to −0.53 LSB" — the ±5% is an absolute ±0.051 LSB, giving −0.45 to −0.55 LSB.

**module-17/lesson-17.html**

11. "What to run: a **DC operating point**" for the capacitor array — node `vcm` has no DC path to ground; the quoted V(vcm) = 2.5 × (selected C)/16.08 pF is a charge-division result a DC analysis does not compute.
12. The circuit and procedure are a voltage-mode SAR with a capacitive divider, not the charge-redistribution architecture the prose reasons about.
13. "At 16+ bits, the matching requirements (0.0015%) are **physically impossible to achieve with passive components**" (and EX22-3's "impractical for any binary-weighted architecture").
14. `archData` `baseError` constants (0.3/0.05/0.4/0.2/0.25 LSB) are invented; R-2R `matchingSensitivity: 4096` contradicts the 2^(N−1) = 2048 model used elsewhere in the same course and on the same page.

**module-17/lesson-16.html**

15. "R3 is fifty percent wrong, **forty times** the error that lesson 15's R-2R ladder needed" — the correct ratio against lesson-15's stated 14.3% is 3.5×. Appears twice (build prose and SimCheck `intro`).
16. "One wrong resistor gives you ... **a permanent offset in everything above it**" — contradicted by the `inl` probe in the same widget (deviation falls to zero at the top).

**module-17/lesson-15.html**

17. DNL < −1 LSB applied to the ADC case of the monotonicity widget — an ADC's DNL is bounded below by −1 by construction.
18. "= −1.0 → **Missing code**" threshold table, and exercise M22L1-6's "DNL = −1 gives a 'missing code' but is still monotonic", both applied to DACs.
19. "**One resistor out of nine**" — the build table contains eight resistors.

**module-17/lesson-01.html**

20. "16-bit gives **~1 ppm** resolution" — 1 LSB of 16 bits is 15.3 ppm.
21. Three mutually incompatible DAC transfer functions in one file: `code/(2^N − 1)` in the canvas, `Code/2^N` in exercise G1-1-3, and `D/2^4` in the SimCheck.

**module-26/lesson-06.html**

22. Default error budget "Total 42 ppm / **Effective Bits 21.5**" — the page's own formula gives 14.6 bits.
23. `(snrDb − 1.76)/6.02` labelled "**Noise-Free Bits**" — that is ENOB; exercise 2 in the same file uses the correct (and different) noise-free definition.
24. Default noise panel "SNR **134 dB** / Noise-Free Bits 22.3" — the page's own formulas give 118 dB and 19.3.
25. Default filter panel "Settling Time **50 ms** / Group Delay **8 ms**" — the page's own formulas give 79.6 ms and 15.9 ms.
26. `gndBounce = I × Z × 0.01` — yields 5 mV where Ohm's law and the page's own displayed default both say 0.5 mV.
27. Ground-topology ranking places **split planes above a single solid plane**; Ott §3/§17, Kester MT-031 and Johnson & Graham all warn against splitting.
28. Coupling constants (−80/−60/−40 dB) invented; "Effective Resolution 22 bits" — the page's own formula gives 19.9; peak-to-peak noise compared to an LSB with no rms conversion.
29. Anti-alias filter designed against the **output-data Nyquist** of a Σ-Δ ADC (widget, SimCheck experiment 3, exercise 3).
30. SimCheck experiment 4 (mismatched Rin with a differential-only C1) cannot produce common-mode-to-differential conversion; the circuit lacks the common-mode capacitors the described mechanism requires.

### UNVERIFIED — rule of thumb, unsourced generalisation, or absolute claim

**module-17/lesson-01.html**

31. "DR = 6.02×N + 1.76 dB" labelled *Dynamic Range* (the formula is ideal sine-wave SNR; the same file elsewhere calls it SNR).
32. "A 12-bit DAC has 4096 **steps**."
33. "DNL and INL errors **often exceed 1 LSB**, limiting actual accuracy to 10-11 bits."
34. "A binary-weighted ladder ... **which is why nobody builds one**" (and the mis-stated rationale — the textbook objection is resistor-value spread, not output impedance).
35. "**This is what integral nonlinearity is**" applied to an uncorrected gain-shaped deviation.
36. "The major-carry transition ... is **always** the worst code on a real part."

**module-17/lesson-15.html**

37. "Non-monotonic behavior can cause **catastrophic** failures in control systems."
38. Application criticality table and its specific per-application failure descriptions.
39. The five-step "Control Loop Oscillation Mechanism" narrative and "*converts negative feedback to positive feedback*".
40. "MSB resistor has **8×** more influence than LSB" stated generically for R-2R ladders.
41. Control-risk thresholds in code ("DNL < −0.5 → Medium", else "Safe for control").
42. "<0.05% tolerance for 12-bit monotonicity" — derivable from the course's own model, but no source is cited.

**module-17/lesson-16.html**

43. "For control applications, DNL is often more critical than INL."
44. "an INL plot is **always** a bow rather than a drift."
45. "why a string DAC settles slowly: **the buffer** has to drive whatever comes next through its own bandwidth."
46. "at 12 it is 4096 resistors and **nobody builds one**."

**module-17/lesson-17.html**

47. "This is why **all** 24-bit audio converters and precision measurement ADCs use sigma-delta architecture."
48. `isMonotonic = dnl < 1.0` presented as "Monotonicity: Guaranteed / NOT GUARANTEED".
49. Key Insight attributes Σ-Δ inherent monotonicity to "oversampling and noise shaping, which averages out component mismatches", while the warn box on the same page correctly attributes it to the 2-level DAC.

**module-17/lesson-18.html**

50. "4x averaging reduces **missing code impact** by ~6dB" (a √N noise result applied to a deterministic DNL error).
51. "16x averaging can **fully eliminate most** missing code effects."
52. Mitigation-table effectiveness ratings (Best / Good / Moderate).
53. "Test Confidence" = 100·(1 − 1/√N<sub>t</sub>) as a percentage.
54. Averaging modelled as a moving average over the code-density histogram.
55. "**Non-monotonicity is not an accuracy specification, it is a stability one**", and "often guaranteed to **more bits** than they guarantee accuracy."
56. "the expensive component in a precision servo is the sensor and its amplifier, **never** the driver."

**module-26/lesson-06.html**

57. "sub-ppm accuracy" in the prose vs "<10 ppm" in the spec box.
58. RSS combination applied to systematic (drift, INL, gain) error terms.
59. Quantisation contribution taken as 1 LSB rather than LSB/√12.
60. "Effective Bits" derived from a DC ppm error budget rather than from SINAD.
61. Input-amplifier noise computed as e<sub>n</sub>√BW using the −3 dB bandwidth, with no 1/f term — while the page's own spectrum canvas plots a 50/f contribution.
62. Reference noise modelled as an additive input-referred term rather than a multiplicative (ratiometric) one.
63. SNR referenced to peak full scale rather than to a full-scale sine rms.
64. "Settling Time = 5τ × order" and "Group Delay = order × τ" for a Butterworth — and 5τ settling is inconsistent with the page's own 24-bit accuracy goal.
65. "the 79.6 Hz corner already sits below Nyquist, **which is the correct relationship**" — a single pole gives ≈4 dB at 125 Hz.
66. Default error budget (41.6 ppm) exceeds the page's own drawn "Target: 10 ppm" and stated spec, unremarked.

### Housekeeping (not an engineering claim, noted once)

Widget storage keys and exercise IDs do not match their lessons: `lesson-01`
uses `lessonKey: 'm8l1'` and IDs `G1-1-*`; `lesson-15` through `lesson-18` use
`m22l1`–`m22l4` and `M22L*`/`EX22-*`. Progress state will collide with whatever
modules 8 and 22 use.
