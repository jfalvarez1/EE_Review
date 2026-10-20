# Protection and bias tables — 2026-10-20

Starting point: `main` at `63a2f5c`, clean, all 36 gates passing, Pages deploy
green. No unmerged branches, pull requests or other sessions held work for this
repository. This pass takes the open items the 2026-09-09 tranche left: explicit
zener voltages in four protection lessons, M15 L06's battery-control topology,
and M23 L08's bias network. It is a bounded correction pass, not a certification
of the course.

## Evidence standard

As before: manufacturer documents support device numbers; the lab numbers are
calculations from the authored tables and declared course models, not measured
hardware data. Every SimCheck value below is held by `check-sim-values` against
`solve-op`. No independent SPICE run or physical circuit was made.

Each TVS is modelled as a zener with BV = the datasheet's minimum V<sub>BR</sub>
(the solver puts its 1 mA knee there) and rz = (V<sub>C</sub> − V<sub>BR</sub>)/I<sub>PP</sub>,
a single straight-line fit. Circuit Toy's zener exposes both as `vz` and `rz`
(`src/component.c`, `src/input.c` in the companion repository).

| Lesson | Primary reference and location | What was wrong, and the result |
| --- | --- | --- |
| M15 L06 | [TI BQ769x0 datasheet SLUSBK2I](https://www.ti.com/lit/ds/symlink/bq76920.pdf), §8.3.1.3.1; [TI BQ76952 datasheet SLUSE13B](https://www.ti.com/lit/ds/symlink/bq76952.pdf), §11.5.1 | FET pins rotated, control sources across drain and source, no ground. Rebuilt as the lesson figure's common-drain low-side NMOS pair with explicit body diodes, 5 mΩ shunt, 12 V source-referenced drives. 6.938 A, 34.69 mV shunt, P− at 90.45 mV; DSG off blocks 14.8 V; CHG off still discharges at 0.880 V (5.8 W); charging reverses the shunt sign. 7 probes. |
| M18 L02 | [Vishay SM8S datasheet, doc. 88387](https://www.vishay.com/docs/88387/sm8s.pdf), SM8S24A row and Fig. 2; [ADI surge-stopper article](https://www.analog.com/en/resources/technical-articles/low-quiescent-current-surge-stopper-robust-automotive-supply-protection.html) for the ISO 16750-2 jump-start test | TVS anode on the rail (forward-biased across 13.5 V); no generator R<sub>i</sub>. Now an ISO 16750-2 Test A bench: 87 V behind 1 Ω, SM8S24A-class clamp at 30.53 V with 50.7 A (~1.55 kW for 200 ms, about four times the energy of the 5200 W 10/10 000 µs rating pulse). States why Test B exists. 4 probes. |
| M22 L04 | [Bourns MOV-20D datasheet](https://www.bourns.com/docs/Product-Datasheets/mov20d.pdf), MOV-20D431K; [Vishay SMBJ datasheet, doc. 88392](https://www.vishay.com/docs/88392/smbj.pdf), SMBJ36A/CA | No surge amplitude; 1 GΩ in series with the varistor; both "bidirectional" pairs anti-parallel (±0.7 V clamps). Fixed, the build shows that 10 µH does not decouple a clamping primary from the TVS on a 50 µs surge: 61 A in a 10.3 A part at 300 V. Practice answer corrected. 5 probes. |
| M23 L05 | Vishay doc. 88387, SM8S33A row | PFET gate tied to its source (always off), no gate clamp, anti-parallel zeners, and 10 Ω in series with an ECU supply that must run at 6 V. Gate to ground with a 12 V gate-source clamp, one SM8S33A-class TVS, 10 µH LC-filter inductor (figure updated). Table contains regulator blocks, so no SimCheck; front-end numbers were checked on a scratch copy with an equivalent load. |
| M23 L08 | — (lesson's own figure and V<sub>BE</sub>-multiplier formula) | Q3 base and emitter on one node; drivers were emitter followers that could not pass bias current. Now the figure's multiplier, fed by a current source and a VAS stand-in: 1.511 V spread, 10.84 mV across each 0.33 Ω (33 mA). R1 +10% gives 2.4× idle current; the old 470 Ω gives a crossover dead band. 5 probes. |
| M24 L02 | Vishay doc. 88392, SMBJ15A and SMBJ5.0A rows | TVS anode on the rail. Now SMBJ15A-class, cathode to rail: 18.21 V clamp at 4.18 A on the 60 V plateau; the generic 7 Ω would read 34.6 V. 3 probes. |

## Tools

- `netlist.js` reads a stated zener `rz`; `export-spice.js` marks a non-default
  BV or RZ as UNSUPPORTED instead of emitting a default part.
- `solve-op.js` limits the breakdown knee at the junction rather than the
  terminals (Newton crawled a few mV per step on a high-current TVS), and its
  device report swaps drain and source for a reverse-conducting MOSFET as the
  stamp does. Every operating point and SimCheck comparison in the corpus was
  diffed before and after the solver change: identical.
- `check-build-values` fails a zener row with no breakdown voltage;
  `check-build-nets` fails two zeners wired anti-parallel. Both were run against
  the original tables as negative controls and flag all seven rows.
- The exports in `_audit/review` were already stale at `63a2f5c` (m21l01's
  table was removed by that commit, the exports still listed it). Regenerated.

Validation: all 36 gates pass; `check-sim-values` holds 24 new probes with none
skipped; the six lessons load in Chromium with no console errors, every new
SimCheck renders, and correct and deliberately wrong entries get the expected
verdicts. The standalone bundle builds with all 408 lessons.

## Still open

Listed in `_audit/NOTES.md` under "Still open": m22l04's coordination
interactives, the zener-default rz disagreement with Circuit Toy, solve-op's
per-node damping on floating junction pairs, and reversed-TVS detection.
