# Capacitor placement: geometry to impedance to load step

This study accompanies the layout views in Module 29/9. Five **dimensioned test
structures** replace the earlier unscaled mockups for numerical comparison.
FastHenry extracts the copper; LTspice simulates the same capacitor and source
attached to each structure. The plotted results are simulations, not board
measurements, PMIC qualification or a universal layout ranking.

## What is actually modeled

All coordinates below are in mm. Both load terminals are on z = 0: power at
(0,0,0), return at (0,1,0). Copper conductivity is 5.8e7 S/m. Horizontal strips
are 0.035 mm thick. There is **no reference plane**, package, die, solder or
pad-spreading model. The marked terminals are ideal connections. This deliberately
isolates the two conductors; it does not simulate the continuous plane in the
earlier conceptual BGA drawing. Coordinates and segment dimensions are also in
the individual geometry JSONs and native FastHenry `.inp` files.

| Case | Power path | Return path | Widths: power / return |
| --- | --- | --- | --- |
| short | (0,0,0) → (2,0,0) | (0,1,0) → (2,1,0) | 0.4 / 0.4 |
| detour | Same as short | (0,1,0) → (0,4,0) → (4,4,0) → (4,1,0) → (2,1,0) | 0.4 / 0.4 |
| underside | (0,0,0) → (0,0,−1) → (0.6,0,−1) | (0,1,0) → (0,1,−1) → (0.6,1,−1) | 0.4 / 0.4 on bottom |
| neck | (0,0,0) → (6,0,0) | (0,1,0) → (6,1,0) | 0.12 / 0.8 |
| wide | Same as neck | Same as neck | 0.8 / 0.8 |

The underside connections are **square hollow copper shells**, not claimed
production vias: 0.25 mm outside, 0.20 mm inside, 1 mm long. Four wall bars form
each shell, joined by ideal end contacts. Two walls are 0.25 × 0.025 mm, the other
two 0.20 × 0.025 mm; their total cross-section is 0.0225 mm². There is no dielectric
or plane in this magnetoquasistatic extraction. Do not interpret its result as a
via-in-pad, microvia or BGA-stackup recommendation.

FastHenry uses one port along each conductor. With equal and opposite conductor
currents, the loop impedance is **Z11 + Z22 − Z12 − Z21**. Thus mutual inductance
between outgoing and return conductors is included. The capacitor joins the far
ends electrically; its internal path is represented by the stated ESR/ESL.

## Identical circuit for all five cases

- Source: fixed 1 V behind 20 mΩ and 20 nH. This is a passive Thevenin assumption,
  not an active buck/LDO model or extracted source distribution.
- Capacitor branch at the load: extracted copper model, then 10 mΩ ESR,
  0.3 nH component ESL and 10 µF **effective**, linear capacitance in series.
  These component values are teaching assumptions, not a vendor 0201/0402 model.
- AC: 1 A injected into the load node, 1 kHz–100 MHz, 200 points/decade. The
  magnitude of the resulting load voltage is the load-port impedance in ohms.
- Transient: capacitor initially charged, no load; 0→2 A at 2 µs, 2→0 A at
  7 µs, each with a 100 ns raised-cosine edge. Run to 12 µs. The 2 A DC limit is
  0.96 V because of the source's 20 mΩ resistance. No control loop corrects it.

The copper model is a positive Foster network:
`Z(s) = Rdc + s Linf + sum(Rk s/(s + pk))`.
Each term is a positive parallel R/L cell in series with the others, with
`Lk = Rk/pk`. This preserves a passive circuit while representing skin/proximity
effects across frequency. It is not a single guessed inductance. A nonnegative
fit uses every other extracted frequency; the interleaved samples check the fit.
Terms smaller than 1 µΩ are dropped to avoid a poorly conditioned SPICE matrix,
then the fit is checked again. Behavior outside the extracted band is not validated;
do not use the model for much faster edges without extending the extraction.

## Numerical checks and provenance

FastHenry 3.0wr, modification 031424, was built with GCC in Ubuntu/WSL, separately
from the course. The archive URL, archive hash and executable hash are in the
manifest. The LTspice log records version 26.1.1. No external solver source or
installation is included in EE_Review.

For each layout, cross-section subdivisions are 7×3, 13×5 and 21×7 with grading
ratio 1.3. Horizontal segment lengths are at most 0.5 mm; the vertical shells
are 1 mm segments. Direct matrix products avoid multipole-approximation error;
GMRES uses segment preconditioning and 1e-8 tolerance. An unconverged solve is
rejected. This is a cross-section refinement check, not an axial/junction mesh
study or hardware validation.

The runner checks low-frequency R against conductivity × length/area, final mesh
change below 3%, complex fit error below 1%, and assembled load-port disagreement
below 1.5%. It compares 2 ns and 1 ns maximum timesteps (Gear integration), with
a 1 mV limit. Independent KCL/KVL state equations integrated by SciPy Radau must
also agree within 1 mV. Actual results, rather than only those acceptance limits,
are stored per case in `docs/data/placement-study/manifest.json`.

Early exploratory runs using unconverged multipole/iteration settings were
rejected by the DC check. They are retained only in the separate local lab, not
mixed into the accepted plots. The published ZIP contains accepted raw matrices,
geometry, SPICE decks, `.raw` waveforms, CSV exports and sanitized solver logs for
all refinements. The course test checks hashes and independently reconstructs
impedance and transient stimulus/metrics from the public data.

## Reproduce

Install the separate [FastHenry source distribution](https://www.wrcad.com/ftp/pub/fasthenry-3.0wr-031424.tar.gz)
under Linux/WSL and build with `make all`. Install LTspice from Analog Devices.
Use Python with NumPy, SciPy and Matplotlib; the tested lab environment had
NumPy 2.4.6, SciPy 1.17.1 and Matplotlib 3.11.2. From the course root on Windows:

```text
python tools/run-placement-study.py --output C:\simulation-results\placement --fasthenry /path/to/fasthenry --ltspice C:\path\to\LTspice.exe
python tools/plot-placement-study.py --input C:\simulation-results\placement
node tools/test-placement-evidence.js
node tools/stamp-build.js
node tools/audit.js
```

Use a new output directory for a new experiment. `--case short --mesh coarse`
runs a pilot extraction; `--reuse-extraction` reuses matching converged geometry
and reruns the circuit/model checks. Changing geometry requires new extraction.
Inspect the plots before publishing. The native decks contain their copper
subcircuit and run independently in LTspice; no custom component library is needed.

## References and interpretation

- [FastHenry user's guide](https://www.fastfieldsolvers.com/Download/FastHenry_User_Guide.pdf), §§1–2: conductor input, impedance matrices and discretization.
- [Fast Field Solvers: FastHenry](https://www.fastfieldsolvers.com/fasthenry2.htm): magnetoquasistatic model and frequency-dependent R/L scope.
- [AMD UG583: capacitor placement](https://docs.amd.com/r/en-US/ug583-ultrascale-pcb-design/Capacitor-Placement-Background): consider supply and return paths and the actual load port.

The references explain the methods. Numerical values come from the archived
local runs. Local paths are removed from downloaded raw-file Title headers and
logs; all numerical samples are preserved. The manifest records both original
and downloadable raw hashes. A real board adds planes, mounting geometry, package/die impedance,
biased component models and regulator dynamics. Minimum voltage over the whole
pulse is not the same metric as droop during the first edge: changing resistance
also changes damping. Compare the whole waveform and the required frequency band.
