# Protocol signal evidence

Reviewed 2026-10-31. Student entry points: Module 20 lessons 11–13.

## Source-to-claim map

| Primary source | Claims used / location | Boundary |
| --- | --- | --- |
| [NXP UM10204 Rev 7.0](https://www.nxp.com/docs/en/user-guide/UM10204.pdf), §§3.1.1–3.1.8, 3.1.16 | Open-drain sharing, arbitration/ACK, conditional bus clear | Conventional bidirectional modes; do not generalize to UFm or I3C |
| [TI SLVA689A](https://www.ti.com/lit/an/slva689/slva689.pdf), §2 | Pullup bounds include VOL; 30–70% RC rise time | Course's 400 pF example is a separate calculation |
| [MIPI SPMI overview](https://www.mipi.org/specifications/system-power-management-interface) | Interface purpose and specification access | Full normative specification is member-only; no invented timing limits |
| [TI TPS6594-Q1](https://www.ti.com/lit/ds/symlink/tps6594-q1.pdf), pin table, §8.4.2, Fig 8-49 | Concrete PMIC ownership, release/pulldown, interface selection | Device-specific implementation; not a universal SPMI electrical specification |
| [MIPI I3C public FAQ](https://www.mipi.org/resources/I3C-frequently-asked-questions), pullups/electrical questions | SCL push-pull, SDA drive-mode changes, translation compatibility | Full mode-specific compliance needs its specification and device data |
| [ADI Introduction to SPI Interface](https://www.analog.com/en/resources/analog-dialogue/articles/introduction-to-spi-interface.html) | Selection and shared bus roles | Actual release timing belongs to each target datasheet |
| [ADI AN-960](https://www.analog.com/en/resources/app-notes/an-960.html) | RS-485 shared driver enable and common-mode considerations | Differential interface; not a CMOS single-wire model |
| [TI SDYA018](https://www.ti.com/lit/an/sdya018/sdya018.pdf), transmission-line discussion | Edge time versus flight time | No universal safe trace length from bit rate |
| [TI PCA9515A](https://www.ti.com/lit/ds/symlink/pca9515a.pdf), §8.3 | Buffered LOW offset, recognition thresholds, cascade restriction | No generic claim that all I2C buffers use the same offset |
| [TI SCPA069](https://www.ti.com/lit/an/scpa069/scpa069.pdf), Figs 2-1, 6-1 | False-clock desynchronization and documented recovery waveform | Published vendor evidence; not our measured waveform |
| [TI SCBA004E](https://www.ti.com/lit/an/scba004e/scba004e.pdf) | Slow/floating CMOS input behavior | Input-family dependent; not automatically sequential metastability |
| [TI SN74LVC1G125 Rev U](https://www.ti.com/lit/ds/symlink/sn74lvc1g125.pdf), §§5.1, 5.3 | Negative voltage/current footnote versus recommended operation | Specific example, not permission to expose any pin to −1 V |
| [Tektronix ABCs of Probes](https://www.tek.com/en/documents/whitepaper/abcs-probes-primer), ground-lead discussion | Probe resonance, local reference and loading | Published example distinguished from imposed-reference simulation |

## Reproduce the evidence

Requires Python with NumPy/Matplotlib and installed LTspice. Run from the repository:

```
python -X utf8 tools/run-protocol-ltspice.py --exe PATH_TO_LTSPICE
python -X utf8 tools/build-protocol-native.py --exe PATH_TO_LTSPICE
node tools/test-protocol-evidence.js
```

`docs/examples/protocol-*.cir` contains eight reference decks and eight half-timestep decks. `docs/data/protocol/` retains CSV waveforms, solver logs, manifest and native-schematic comparison. `assets/figures/protocol/` contains five annotated SVG plots drawn from those exports. Raw LTspice files are reproducible local audit artifacts; their hashes are retained. The native `.asc` uses standard LTspice symbols; its `.plt` restores the voltage comparison view.

| Experiment | Deliberate assumptions / change | Retained result |
| --- | --- | --- |
| Push-pull conflict | 3.3 V HIGH, 0 V LOW, 22 Ω/22 Ω or 22 Ω/66 Ω, 100 pF; finite switch on/off resistance | 1.649982 / 2.474772 V; 74.96675 / 37.49334 mA HIGH-driver current |
| Open-drain | 2.2 kΩ pullup, two 22 Ω LOW paths; then add erroneous 22 Ω HIGH path | Legal single/dual LOW 32.688 / 16.425 mV; fault 1.658584 / 1.107643 V |
| Released line | Three independent 100 pF lines; 1 TΩ, 100 kΩ and 10 kΩ pulldowns | Same Hi-Z command, different voltage histories |
| RLC falling edge | 100 nH, 100 pF, 2 ns fall; RS 20 / 63.245553 Ω | Minimum −1.138434 V / approximately zero |
| Reference error | Imposed +1 V reference shift while local pin is zero | Measured difference −1 V; no physical probe extraction claimed |

All saved voltages were compared against runs at half the maximum timestep; worst interpolated difference 1.362 mV. DC contention results were checked against conductance sums. The RLC ideal-step analytical solution provides an independent cross-check; the finite 2 ns edge is explicitly different. The native drawing's result matched the retained CSV to 3.5e-12 V on the exported time grid.

These are controlled synthetic experiments, not measurements, actual SPMI transaction simulations, vendor I/O/IBIS validation, extracted PCB results, thermal predictions or conformance tests. Real devices require nonlinear output/clamp models, power-state behavior, parasitics, temperature and timing corners. No negative-voltage or short-circuit stress test on live hardware is prescribed.
