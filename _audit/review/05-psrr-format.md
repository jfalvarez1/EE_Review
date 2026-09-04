# Module 1 lesson 6 (PSRR): figures outside the format, and a table nobody sourced

The user pasted the lesson back with its circuit labels spilling as loose text
and asked why the figures did not follow the format, then asked why the audit
had not caught it. Both questions have one answer.

## What was wrong

Four circuit figures written as literal `<svg class="circuit-diagram">` markup:
op-amp as a `<polygon>`, resistors as zig-zag `<path>`s, grounds as three loose
`<line>`s, every stroke a hard-coded hex (`#4fc3f7`, `#ff6b6b`, `#ff9800`,
`#444`). None of it went through `AD.Schematic`, so none of it carried the
course palette, the component symbols, or the connectivity validation.

The first figure was also the wrong circuit. It showed an op-amp with **both
inputs grounded** and ripple on V+, labelled as the PSRR measurement. An
open-loop amplifier with grounded inputs has no defined output; it sits against
a rail on its own offset. The measurement is a unity-gain follower with the
input grounded, whose output ripple is the input-referred supply-induced
offset directly. The definition above the figure had the same confusion:
`PSRR = 20 log(ΔVsupply / ΔVoutput)`, which is only true at unity noise gain,
while the closed-loop section two cards later correctly subtracts
`20 log(noise gain)` - which only makes sense if PSRR is input-referred.

## Why four checkers passed it

| Checker | What it proves | Why this escaped |
| --- | --- | --- |
| `check-hand-drawn` | a SchematicSVG drawing uses the library's component methods | reads JS calls (`svg.circle()`); literal markup never reaches it |
| `check-raw-svg` | wires in literal `<svg>` markup meet a symbol | proves connectivity only; these wires do meet |
| `check-svg-legibility` | every class used inside an SVG is defined | no class used, only inline `fill="#..."` |
| `check-palette` | every `TEK.<key>` a lesson reads exists | an attribute `stroke="#4fc3f7"` is not a palette read |

Each checker is right about its own question. The gap between them is *a
circuit drawn as literal markup with hard-coded ink*, and it is not one
lesson's slip: **333 such figures in 141 lessons** (288 carry the
`circuit-diagram` class; 45 more are found by an op-amp triangle or circuit
labels under hard-coded colour), against 20 lessons on `AD.Schematic`. The
ad-hoc style was the de facto format, which is exactly why nothing gated it.

`tools/check-schematic-format.js` now closes the gap. It flags a literal
`<svg>` that carries `class="circuit-diagram"`, or paints with hard-coded
colour attributes *and* contains an op-amp triangle, a resistor zig-zag, or two
or more circuit labels. Existing figures are recorded per lesson in
`tools/schematic-format-baseline.json`; a lesson exceeding its count, or a
lesson not in the file, fails the audit. M01 L06 is not in the file. The
right number for the file is zero.

## The PSRR table

| Documented claim | Flaw / assumption | Required verification | Result |
| --- | --- | --- | --- |
| LM741: PSRR+ 90 dB, PSRR− 90 dB, 80 dB @ 1 kHz, 40 dB @ 100 kHz | one datasheet figure covers both rails; no frequency curve exists for this part | TI SNOSC25D §6.5–6.7 | 96 dB typ, 86 dB min (77 dB min, C grade); **no PSRR-vs-frequency plot in the datasheet** - the 1 kHz and 100 kHz cells were invented |
| OPA2277: 110 dB both rails, 100 dB @ 1 kHz, 70 dB @ 100 kHz | specified in µV/V, not dB; the rails are *not* equal above DC | TI SBOS079C §6.7, Fig. 6-2 | 0.3 µV/V typ = **130 dB**, 0.5 µV/V max = 126 dB min. Fig. 6-2: +PSR ≈ 110 / −PSR ≈ 90 dB at 1 kHz; ≈ 70 / ≈ 50 dB at 100 kHz. The rails differ by 20 dB and the lesson showed them identical |
| OPA211: 120 dB both rails, 110 dB @ 1 kHz, 75 dB @ 100 kHz | same | TI SBOS377L §6.6–6.7, Fig. 6 | 0.1 µV/V typ = **140 dB**; 0.5 µV/V max (high grade) = 126 dB min. Fig. 6: ≈ 95 (+) / 100 (−) dB at 1 kHz, ≈ 55 / 60 dB at 100 kHz |
| AD8676: 130 dB both rails, 120 dB @ 1 kHz, 80 dB @ 100 kHz | overstated | ADI AD8676 Rev. A, Table 2 | **120 dB typ, 106 dB min** (±5 to ±15 V, and over temperature). The frequency plot was not readable from the copy fetched; those cells now say so rather than carry a number |
| "20 mVpp ripple can inject 2–200 µV" | 20 mV / 10^(60/20) is 20 µV, not 2 | arithmetic | 20–200 µV |
| "R-C filter 10 Ω + 100 µF ceramic ... 70 dB at 500 kHz" | ideal capacitor; a 100 µF ceramic has ~2 nH of ESL and self-resonates at 356 kHz | the build table below | at 500 kHz the net reactance is still small and 70 dB holds; at 5 MHz the ideal model says 90 dB and the real part gives 44 dB. Stated in the lesson, and left as an experiment with the predicted number |

Every dB figure above is `20 log10(1 / (µV/V × 1e-6))`; the curve readings
are to about ±5 dB, and the lesson says so.

## What the lesson gained

The lesson had no build table and no metric. PSRR itself is not something an
ideal op-amp model has, but the RC supply filter the lesson prescribes is a
two-component circuit that `solve-ac` settles exactly: corner 159.2 Hz,
−20.0 dB at 1.59 kHz, −69.9 dB at 500 kHz. Those are now a `SimCheckWidget`
with four probes, all held by `check-sim-values` (19 AC values course-wide,
0 disagreeing), and three perturbations with predicted outcomes: the ESL
experiment above, RF 1 Ω (−50 dB at 500 kHz, and why headroom is the exchange
rate), CF 10 µF (20 dB worse everywhere above the corner).
