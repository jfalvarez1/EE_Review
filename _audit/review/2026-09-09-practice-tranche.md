# Sourced practice continuation — 2026-09-09

Starting point: local main at `43f2f62`, including five commits after the
pasted transcript's `0ac3ce1`. The working tree was clean. The initial audit
passed 28 of 29 gates; its build stamp was stale. No earlier changes were
discarded. This pass is a bounded continuation, not a certification of all
408 lessons or of the companion simulator.

## Evidence standard

Manufacturer documents support device behavior and design procedures.
The new lab numbers are calculations from the authored circuits and declared
course models. They are **not measured hardware data, manufacturer limits,
or a claim that the simplified model reproduces a named device at all biases**.
Each lesson identifies the omitted behavior and an appropriate bench test.
No independent circuit simulator or physical circuit was run in this pass.

Sources below were opened and inspected through their primary publishers.
The nominal 8.2 V and 5.1 V clamps and generic MOSFET geometries are explicit
educational design choices; the references do not endorse those complete builds.

| Lesson | Primary reference and location | Result and practical check |
| --- | --- | --- |
| M12 L11 | [onsemi 2N2222A/D](https://www.onsemi.com/download/data-sheet/pdf/2n2222a-d.pdf), electrical characteristics and package drawing | A 100 kohm base resistor does not force saturation in the 0–5 V sweep. Added changed-source/base-resistor probes and a junction-polarity/current test. Datasheet saturation limits retain their actual test currents. |
| M14 L08 | [TI TPS54331](https://www.ti.com/lit/ds/symlink/tps54331.pdf), section 7.3.5 | Named the 1N4148 course model, derived its clamp at 10 uA, and corrected the output endpoint to 7.80149 V. The lab is explicitly open-loop and averaged; its slope does not establish fault-current limiting. Corrected energy units previously labeled power. |
| M15 L02 | [TI SLUAA81A](https://www.ti.com/lit/pdf/sluaa81), sections 1, 2.2 and 5 | Declared MOSFET geometry; resistor drop gives 404.37 mA and about 1.64 W dissipation. Added differential cell/gate measurements, thermal derating and scheduling limits. Ideal sources cannot predict balance time or SOC. |
| M20 L04 | [TI SLOA024B](https://www.ti.com/lit/an/sloa024b/sloa024b.pdf), sections 3.4–3.5; [Analog Devices, Filter Basics: Anti-Aliasing](https://www.analog.com/en/resources/technical-articles/guide-to-antialiasing-filter-basics.html) | Reduced nominal gain to 28 for headroom. The equal-component unity-gain filter has Q=0.5, f3dB=6.442 kHz and 1.38617 V peak at 1 kHz. Corrected the general Butterworth calculator/table and stated the amplitude assumptions behind its alias budget. |
| M23 L04 | [TI SLVAF40](https://www.ti.com/lit/pdf/slvaf40), sections 2–3.2 | Replaced the upper zener with an ordinary diode and specified 8.2 V for the lower clamp. Derived the 1.015% ADC loading error and about 1.00/1.38 dB rejection at 50/60 Hz. Added endpoint calibration and compliance checks. The build does not qualify surge survival, ADC protection or isolation. |
| M24 L01 | [TI SLVA139](https://www.ti.com/lit/an/slva139/slva139.pdf), figure 3; [TI SLVAE57B](https://www.ti.com/lit/pdf/slvae57), sections 4.1 and 5 | Corrected the gate pull-down and gate-to-source clamp, and declared geometry. Forward output is 11.80243 V in the model. Explicitly states that the solver lacks the body diode and cannot prove reverse-battery protection. |
| M24 L03 | [TI LM5069](https://www.ti.com/lit/ds/symlink/lm5069.pdf), sections 9.1 and 9.2.1.2 | Supplied the previously floating gate. The RC-gate lab is explicitly missing current-limit feedback. The separate analytical controller calculator now includes its 24 ohm load and requested ramp time, and no longer invents a 100 mJ SOA pass threshold. |
| M05 L11 correction | [ngspice manual](https://ngspice.sourceforge.io/docs/ngspice-manual.pdf), convergence, .TRAN and .IC | A failed Newton iterate rejects that answer; it is not proof of nonexistence. Removed unsupported guarantees of transient recovery and stability. |

## Checking and exports

`dcValues: { VIN: '5 V DC' }` is an optional probe property. It changes only
the named Value cells in the same lesson's single build table. Missing parts,
ambiguous tables and unsolved explicit variants fail; they cannot silently
reuse a default answer. `build-tables.json` labels these as `dc-variant` and
includes the settings. Consumers must apply them or skip the probe.

Default single-table DC probes now use full-precision node values. Previously
the subtraction of rounded 12 V node reports distorted a 4.97764 mV shunt drop
to 5.00000 mV. Regression tests exercise this, wrong expected answers, misspelled
override parts, unsupported waveforms and independent zener parameter values.

The JSON netlist preserves the new 8.2 V zener. The text SPICE-like exporter has
no verified syntax for that per-instance parameter, so `m23l04.cir` marks its
clamp **UNSUPPORTED** and does not substitute a 5.1 V diode. Configure the part
manually from the authored table or consume the JSON; the incomplete text
export is not a validated protection circuit. The exporter also no longer
counts mere parsing as an operating-point solution: 98 of 194 tables settle.

Validation: 86 DC and 27 AC probes agree, with none skipped; all 30 gating
checks pass. The full advisory survey reports 58/173 build sections with
metrics, 85/408 lessons with acceptance checks, and 201 lessons with none of
the practice signals. These counts measure coverage, not hardware validity.
The standalone bundle builds with all 408 lessons.

Browser checks: all seven new SimChecks render without console errors;
matching and deliberately wrong entries produce the expected verdicts. The
hot-swap calculator's 12 V, 1 mF, 24 ohm, 2 A case takes 10 ms with a requested
10 ms ramp, 6.904 ms when a 1 ms ramp is requested, and cannot reach 12 V at
the 0.5 A current limit. Its SOA status remains explicitly undetermined.

## Next six semiconductor candidates

Re-enumerating actual parsed/solved tables found **thirteen**, not the twelve
in the transcript. Seven are handled above. These six still have no SimCheck:

| Lesson | Work required before accepting lesson-level performance claims |
| --- | --- |
| M16 L02, headphone driver | Establish dynamic crossover, stability and loaded output capability; a zero-output ideal-op-amp DC point establishes none of those. |
| M21 L02, LNA | The printed 0.7 V gate bias equals the generic threshold, leaving essentially zero overdrive. Establish a valid bias and an RF model with capacitance/noise before quoting RF performance. |
| M21 L03, PA | The same threshold/bias issue. Review RF bypass topology and model provenance before predicting gain, PAE or compression. |
| M23 L08, vintage amplifier | Q3's base and emitter are both named `bias`; establish the intended bias network before calling it a VBE multiplier or accepting idle-current claims. |
| M23 L10, RF interference | Separate calculable passive pickup from unverified rectification/immunity behavior; source amplitude and high-frequency device model must be explicit. |
| M25 L09, PoE | Derive the incremental detection resistance through the bridge, then verify the applicable specification and test conditions from a primary source. A single 5 V DC reading does not qualify a PD. |

Still open elsewhere: explicit zener voltages in four other protection lessons,
M15 L06's battery-control topology, and 333 ad-hoc circuit figures across 141
lessons. Existing survey and historical notes remain useful leads, not verified
claims about the current quality of every lesson.
