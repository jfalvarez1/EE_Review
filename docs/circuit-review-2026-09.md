# Circuit review — September 2026

The reported RF figures exposed a coverage gap: the old canvas checker stopped at the next element lookup and excluded drawing code containing plotting calls. It missed schematics embedded alongside graphs. Earlier native-SVG checks also did not inspect literal SVG, legacy SchematicSVG or generated SVG markup.

## Changes

- Rebuilt the RF matching lesson with actual source/return connections, both impedance directions, a calculated return-loss sweep, rounded-part comparison and source-linked bench work.
- Converted mixed canvas circuits into reusable SVG templates across power conversion, motor drives, battery protection, sensor interfaces, audio biasing, RF, compensation and EMI lessons. Explanations, equations and implementation limits are outside the drawings.
- Corrected electrical connections found during that work: boost/SEPIC/flyback paths, bootstrap capacitor return, opposing battery FET body diodes, Type III input and feedback branches, Sallen–Key capacitors, four-wire RTD leads, differential ADC feedback, three-phase shunt placement and EMI Y-capacitor terminals.
- Fixed explicit SVG label positions and wire endpoints in other lessons. Shared source polarity symbols and legacy op-amp input signs now use vector strokes. Diagrams have contained horizontal scrolling on narrow screens.
- Expanded M13L15 with a signed inductance-matrix model, two-phase ripple/current-slew exploration, coupled-inductor and TLVR distinctions, component-selection and layout workflow, measurement plan and an LTspice magnetic-network fixture.

## Evidence and limits

The inventory executes all **408 lessons** and captures **609 SVG figures**: 176 native AD.Schematic, 53 dynamic SVG, 331 literal SVG and 49 legacy SchematicSVG. No lesson execution exceptions remained. Browser checks of the rendered SVGs found **zero flagged text overlaps or text crossing painted strokes**. The geometry gate covers all 176 native figures and tests mutations representing the original defects.

All **491 remaining canvases** loaded successfully through the actual browser lesson loader. Circuit candidates were reviewed as contact sheets, including mixed plots and apparatus/layout illustrations. `reviewed-canvases.json` accounts for every canvas; new canvases fail the gate regardless of name or plotting calls. Successful loading is not a proof of every plot's physical model or every possible slider state.

The full audit passes **36 gates**. Additional numerical checks include 189 independent SciPy analog-filter reference cases, continuous phase/group-delay consistency, RF matching, coupled-inductor cases and wire-graph tests for rebuilt power-stage topologies. The offline build includes all 408 lessons. Mobile review used real 390 px iframe viewports; wide circuits scroll inside their own panels without widening the page.

This is a rendering and targeted engineering correction pass, not a claim that all course content has been independently rederived or bench-certified. Native floating-node warnings include intentionally abstract ports and diagram blocks; label geometry and unconnected component pins are checked separately. The LTspice fixture was provided for reproduction; LTspice and hardware measurements were not run here.

## Sources used for the new or corrected content

Primary references are linked beside the relevant lesson material, including:

- TI SLVA662, op-amp versus OTA Type II/III compensation.
- TI SLUA887A, bootstrap component selection; SNVA721A, switching-loop layout.
- TI DRV8301 datasheet and TIDUB03, inverter implementation and staged FOC bring-up.
- TI SLOA034, Wheatstone bridge sensor conditioning; SBAA336B, four-wire PT100 implementation.
- TI INA181, INA128, REF50, THS4551, BQ2970 and BQ51013B datasheets.
- ADI RF matching tutorials and MT-224; SciPy analog-prototype documentation and independently generated response fixtures.
- ADI coupled-choke and multiphase material, TI SLUP413A and Coilcraft coupled-inductor documentation, linked in M13L15.

## Repeatable visual review

1. Run `node --expose-gc tools/audit-circuit-gallery.js` to inventory every SVG renderer and canvas.
2. Run `python tools/serve-audit.py` and open `http://127.0.0.1:8091/_audit/circuit-gallery.html`. Use **Audit all SVG layouts**, then inspect any flagged figures. Suggested label positions are review-only; they do not modify production drawings.
3. Run `node tools/build-canvas-gallery.js --all`, open the generated canvas gallery and load the real lesson drawings. Review new and changed circuit or mixed-plot canvases before updating the canvas inventory.
4. Run `node tools/stamp-build.js`, `node tools/audit.js` and `node tools/build-standalone.js` before publishing.

Fixtures are regression evidence, not permission to skip visual review of a changed diagram.
