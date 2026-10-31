# PI and SI field-solver evidence — 31 October 2026

The plots are embedded in Module 29, lesson 8 (PI) and lesson 3 (SI), with links
from lessons 9 and 10. External tools remain in their own forks. This repository
contains only intentionally published inputs, results and figures.

`docs/data/field-solvers/manifest.json` records versions, source links and SHA-256
hashes for every published figure, CSV and archive. The figures are plots of
actual local solver output, with teaching annotations added afterward. Neither
study is a measurement of the user's board or a HyperLynx result.

## PI: controlled placement, mixed values and damping

Reproduction source and commands:
[KiPI study at c85c33d](https://github.com/jfalvarez1/KiPI/tree/c85c33d/examples/studies).
The numerical solver was at `8cd8f4970920f7536ecb303af2efd790ac9e2603`, Windows,
Python 3.11. The recorded generator predates formatting and automatic environment
capture in the published reproduction version; archived summaries identify its
actual SHA-256. The original generator is retained in the separate lab workspace.

The ZIP includes all 18 runs: four cases at four meshes, one finer mixed case,
and one doubled-field-density mixed case. Each has a native board snapshot,
setup YAML, 301 complex samples, NPZ and summary (including warnings/settings).
Open the snapshot/setup in the separate KiPI installation or rerun the study
commands from the fork. Do not install the solver in this course repository.

The 30 × 20 mm plane pair has a 0.2 mm dielectric, εr 4.2, tanδ 0.02 and 35 µm
copper. A load probe at (3,10) mm sees three capacitors at x = 6 mm or 24 mm,
y = 6/10/14 mm. All cases have 3 µF effective C; each assumed component has
0.3 nH ESL and either 10 mΩ or 100 mΩ ESR. Generic pads/vias and plane clearances
are specified in the fork's table. These are not vendor packages or biased models.

Results: near/far |Z| at 100 MHz is 0.210683/0.369631 Ω; mixed/identical is
3.583× at the 5.370 MHz sample in the 1–80 MHz comparison band. Increasing ESR
smooths peaks while raising the impedance floor. No ranking of route shapes or
physical value permutations was run. Regulator, package and die models are absent.

Final mesh changes are 1.489%, 1.030%, 1.623%, 0.618%, using
`100*abs(Zcoarse-Zfine)/abs(Zfine)` over all samples. The mixed case needed
0.14 mm; the others ended at 0.2 mm. Doubling field sampling changed the mixed
case by at most 0.185% at the 0.35 mm mesh. The chosen 2% check is not a hardware
tolerance or proof of asymptotic convergence. Plane C = 110.492 pF agrees with
ε₀εrA/h; this checks the geometry and plane limit, not every part of the solver.

## SI: diagnose absorbing-boundary placement before claiming accuracy

Reproduction:
[gerber2ems validation at fad9247](https://github.com/jfalvarez1/gerber2ems/tree/fad9247/validation).
The tested fork solver was `4556c3a560da1278e853ed2a1e5266ef92efc7c0` plus the
archived diagnostic runner. Ubuntu 24.04 / Python 3.12; native openEMS 0.37.0
and CSXCAD 0.7.0. Exact native source commits are in the manifest.

The public input and VNA S11 come from Antmicro's `stub_short` example at
`1d4dc55cc47590a29444af96a87d3cdd26a871fa`. Attribution and the source license
are included in the ZIP. No local VNA measurement was performed.

The ZIP contains original and padded geometry, simulation configuration,
fabrication inputs, raw port waves, native solver logs, complex field samples,
derived CSVs and review metrics. Local account/workspace paths are removed from
public logs; full originals remain in the separate lab. Missing excitations are
NaN, never fabricated zeroes. To use the fork's runner with an extracted run,
place `geometry.xml` under `ems/geometry/` and `fab/` at its root. Copy the same
`simulation.json` to `input-original.json` and `input-used.json` for the runner's
provenance-only input copies; these files are not new simulation settings.

The PML region originally overlapped board material. Adding 10 outer cells per
face preserved the board/local mesh and changed the forward run from a
200,960-step cap to the −60 dB criterion at 37,694 steps. The reverse run completed
too. A 14-cell forward run reached the criterion at 32,882 steps. Outer-domain
sensitivity was at most |ΔS11| = 0.00003277 and |ΔS21| = 0.00011631.

Full power-wave normalization solves B = S A. Its maximum singular value is
1.0000344 (the small excess above one is retained), maximum reciprocity difference
0.0001369 and maximum incident-matrix condition number 1.0682. No passivity repair,
fitting, smoothing or phase shift was applied. Complex S11 RMSE versus published
VNA is 0.11634 over 655 overlapping 0.2–4 GHz samples. These results establish
limited numerical checks, **not physical validation**.

Unresolved: no local-mesh sweep, no conductor/dielectric loss model, uncertain
connector/reference planes, and R4 population. R4 is listed as a zero-ohm part
but has no bridge in the model. The measured population state was not established.
“Short stub” describes the shorter physical trace, not a proven short termination.

The electric-field figure is a native 3 GHz dump at z = −0.075 mm. It displays
20 log10(|E| / plane peak), clipped below −50 dB. HDF5 coordinates are already
metres. Raw complex components are in `field-data.npz`. This is not calibrated
absolute field strength, a radiated-emissions result or a compliance assessment.

## Primary background

- [AMD capacitor placement](https://docs.amd.com/r/en-US/ug583-ultrascale-pcb-design/Capacitor-Placement-Background)
- [Altera PDN topology](https://docs.altera.com/r/docs/683293/current/device-specific-power-delivery-network-pdn-tool-2.0-user-guide/pdn-circuit-topology)
- [openEMS boundary conditions](https://docs.openems.de/en/stable/concepts/bc.html)
- [Antmicro SI/VNA study](https://antmicro.com/blog/2025/07/recent-improvements-to-antmicros-signal-integrity-simulation-flow/)
- [Antmicro test-board source](https://github.com/antmicro/signal-integrity-test-board)

These references explain the methods and provide the public fixture. New numeric
results above come from the archived local runs. They do not establish performance
of arbitrary PMIC, aerospace, server, RF or high-speed-interface designs.
