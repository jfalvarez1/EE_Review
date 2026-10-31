# Power-layout evidence and reproduction

The five lessons at Module 29, lessons 8–12 distinguish manufacturer measurements,
published simulations, new LTspice runs, and analytical teaching calculations.
No result here is a field-solver extraction or measurement of the user's PCB.

## Local experiments

Run from the repository root:

```
python -X utf8 tools/run-pdn-ltspice.py --exe PATH_TO_LTSPICE_EXE
node tools/test-pdn-layout.js
```

Python requires NumPy and Matplotlib. The original run used LTspice 26.1.1 on
Windows, installed from Analog Devices' official signed installer. The generator
records the actual version from its solver log on every run.

- `docs/examples/pdn-*.cir`: actual solver input decks, including finer-timestep cases.
- `docs/data/pdn/*.csv`: exported complex AC data and transient waveforms.
- `docs/data/pdn/*-log.txt`: solver logs with local workspace paths removed.
- `docs/data/pdn/manifest.json`: point counts, circuit/raw hashes, agreement and convergence metrics.
- `assets/figures/pdn/`: plots generated from those outputs or separately identified calculations.
- `_audit/ltspice-pdn/`: untracked raw solver outputs and PNG inspection copies.

Five AC cases each use 1,001 points from 1 kHz to 100 MHz. Five transient cases
each run at maximum timesteps of 5 ns and 2.5 ns. The generator rejects AC complex
relative disagreement above 1e-6 and transient differences above 2 mV. The original
run achieved less than 1e-12 AC relative difference and less than 1.2 mV transient
difference, comparing coarse samples with interpolated fine results. This checks
numerical implementation and timestep sensitivity; it is not physical validation.

The AC cases use explicitly specified 10 mΩ ESR and 1 nH mounted inductance per
branch. The mixed case is 10/1/0.1 µF; controls are 3×10 µF and 3×3.7 µF.
The latter is an equal-total-capacitance mathematical control, not a selected part.
Shared inductance is separately varied between 0, 0.2 and 0.5 nH. Inductor Rser=0
is explicit so simulator defaults cannot silently add branch resistance.

The transient experiment has a fixed 1 V source, 5 mΩ source resistance, a
100 µF bulk branch, 5 mΩ distribution resistance and 1/10/30 nH distribution
inductance. The local capacitor is 1/10/100 µF depending on the sweep. Every
capacitor branch has 10 mΩ ESR and 1 nH ESL. Load current has 100 ns raised-cosine
edges, increasing 0→4 A at 2 µs and decreasing at 12 µs. The smooth derivative
avoids artificial inductive voltage jumps from ideal PWL slope discontinuities.
No active regulator control, package model, dielectric loss or nonlinear C(V)
is included. Do not use these traces to select a real regulator's compensation.

The plane capacitance and inrush plots are analytical calculations, not LTspice
runs. The stress bar chart transcribes Murata's reported FEM values; this project
did not rerun that mechanical simulation.

## Primary-source evidence ledger

### Native drawings and annotated plots

The downloadable `pdn-bank-b-native.asc` and `pdn-local-10u-native.asc` use
stock LTspice symbols. Keep the matching `.plt` beside each `.asc`, open the
drawing and click Run to restore the impedance or two-pane voltage/current view.
The AC drawing is bank B; the transient drawing is the 10 uF, 10 nH reference
case. Other sweep cases remain available as individual `.cir` decks.

`python -X utf8 tools/build-pdn-native.py --verify PATH_TO_LTSPICE` rebuilds,
netlists and simulates both drawings. `docs/data/pdn/native-checks.json` records
the schematic hashes and comparisons to retained CSV data: relative complex
impedance error below 1e-9 and interpolated transient difference below 2 mV.
The behavioral load uses an equivalent named function in the native drawing;
adaptive timestep samples can differ from the expanded expression in the deck.

All seven evidence plots include labeled points, callout boxes or shaded regions.
Peak and minimum markers come from the simulated samples, not freehand estimates.
Shading identifies viewing regions or the stated example comparison band; it is
not a pass/fail mask or a device requirement. The plots are rendered from LTspice
CSV exports with Matplotlib; analytical and reported manufacturer results remain
explicitly identified as such. No experimental board measurement is implied.
The expandable native LTspice views contain actual schematic and waveform
window captures. Both drawings were opened and run in the GUI, and their saved
plot configurations were visually checked. Native screenshots remain unchanged;
the larger comparison figures carry the teaching overlays.

| Evidence | Source | What it supports / boundary |
|---|---|---|
| Measured capacitor behavior and separate simulated bank comparisons | [Bogatin, Smith, Sandler, Figures 6–8](https://www.signalintegrityjournal.com/articles/1589-the-myth-of-three-capacitor-values) | Why nominal value staggering alone does not establish a good PDN |
| Manufacturer package/bias comparison | [Murata May 2025 webinar, slide 70](https://www.murata.com/-/media/webrenewal/campaign/events/asean/2025/may25_-mlcc-trouble-shoot/presentation-may-webinar-5may.ashx?cvid=20250508091321000000&la=en-sg) | The selected 4.7 µF/6.3 V parts differ; not a universal package derating factor |
| Measured LDO load steps | [ADI AN-1099, Figures 1–3/Table 1](https://www.analog.com/en/resources/app-notes/an-1099.html) | ADP151-3.3 at 5 V input, 1→200 mA, 500 mA/µs, 1/10/20 µF output |
| Published mechanical FEM | [Murata downsizing study, pages 6–9](https://www.murata.com/-/media/webrenewal/products/capacitor/ceramiccapacitor/faq/mnt/small-mlcc-caution.ashx?cvid=20220425024756000000&la=en) | Stress depends on body and copper geometry; not a field failure-rate prediction |
| PMIC placement guidance | [TI SSZTCC7](https://www.ti.com/document-viewer/lit/html/SSZTCC7/GUID-057A01FF-5A8D-463D-BC73-5B6EFEC047F1) | Practical priority order; the selected device's documentation still controls |
| Expert return-path guidance | [Rick Hartley / Altium](https://resources.altium.com/p/pc-board-stack-up-best-practices-with-rick-hartley) | Stackup/reference continuity; not a substitute for the actual board analysis |
| TLVR equations and comparative example | [TI SLUP413](https://www.ti.com/lit/ml/slup413/slup413.pdf) | Coupled secondary loop and design tradeoffs; reported capacitor savings are example-specific |
| Board noise-rejection evaluation | [Murata three-terminal capacitors](https://www.murata.com/en-us/products/capacitor/ceramiccapacitor/library/solution/3-terminal-capacitor) | Mounting and topology affect rejection; not product EMC certification |

## Free tools for the next level

[LTspice](https://www.analog.com/en/resources/design-tools-and-calculators/ltspice-simulator.html)
is free circuit simulation software; [ngspice](https://ngspice.sourceforge.io/)
is an open-source alternative. Neither derives mounting inductance automatically
from an arbitrary PCB image.

[openEMS](https://www.openems.de/) provides open-source full-wave FDTD analysis.
[FastHenry2 / FastCap2 / FasterCap](https://www.fastfieldsolvers.com/software.htm)
provide resistance/inductance or capacitance extraction. They cover parts of an
SI/PI workflow, not a drop-in replacement for every HyperLynx capability.
An extraction needs explicit geometry, materials, ports, boundary conditions,
mesh convergence and validation. These tools were researched, not installed or
used to generate the present curves. No T/Y/V layout ranking is claimed.
