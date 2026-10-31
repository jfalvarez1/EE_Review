# Capacitor placement illustrations

Lessons 29/9 and 29/10 embed seven original SVG layout mockups. They show physical
pads, component bodies, copper paths and vias rather than electrical symbols.
They complement the existing schematic and field-solver views; they are **not**
the geometry behind the KiPI or LTspice results. No dimensions, inductances,
impedances, capacitor values or validated pin assignments are implied.

## Edit and regenerate

Edit `tools/build-capacitor-layouts.js`, then run from the repository root:

```text
node tools/build-capacitor-layouts.js
node tools/build-capacitor-layouts.js --check
node tools/stamp-build.js
node tools/audit.js
```

The generator uses Node's standard library only. Each named function owns one
view; `Layout` provides pads, vias, component bodies and orthogonal traces.
The audit checks that committed SVGs still match the generator. Do not edit
generated SVGs directly. Changing figures also requires a rendered review;
deterministic output does not establish electrical or visual correctness.

## Review each view

| View | Teaching purpose | Explicit boundary |
| --- | --- | --- |
| local-pair | Follow supply and return through a local capacitor | Package/die paths are omitted |
| return-detour | Body-to-pin distance misses a long return | No hidden shorter plane connection is assumed |
| bga-underside | Reach selected power/ground balls through paired vias | Transparent top projection, generic dogbones, not a bottom fabrication view |
| bga-section | Check connections and antipads across layers | Illustrative through-vias; not scaled or extracted |
| shared-neck | Identify common series copper despite a large bank | Ground vias share a continuous plane; no shape ranking or assigned inductance |
| buck-floorplan | Distinguish Cin, Cout, Clocal and quiet feedback | Generic pinout; required support/thermal components omitted |
| ldo-floorplan | Preserve local input/output and ground connections | Generic pinout; device-specific sense/NR/thermal details omitted |

Render the SVGs and their lesson embeds at desktop and phone widths. Inspect
text bounds, label overlaps, pad-to-copper continuity, current-arrow direction,
plane clearances and component terminals. The wide buck view scrolls within a
keyboard-focusable region on phones; every figure has a full-size link and an
independent text explanation. Test page overflow as well as the image itself.

## Source grounding

- [AMD UG583: Capacitor Placement Background](https://docs.amd.com/r/en-US/ug583-ultrascale-pcb-design/Capacitor-Placement-Background), revision 1.29: supply/return path and placement reasoning.
- [TI: passive placement around a PMIC](https://www.ti.com/document-viewer/lit/html/SSZTCC7/GUID-057A01FF-5A8D-463D-BC73-5B6EFEC047F1), Figure 1: device-oriented placement sequence and underside alternative.
- [TI LM6x4xx-Q1 datasheet](https://www.ti.com/lit/ds/symlink/lm61480-q1.pdf), revision E, §8.4, Figures 8-58–8-59: buck input loop and feedback layout.
- [TI TPS7A94 datasheet](https://www.ti.com/lit/ds/symlink/tps7a94.pdf), revision C, §8.4, Figure 8-34: local capacitors and component-side ground connections.

Sources were inspected for this addition. These are original explanatory
arrangements, not copies of evaluation-board artwork. Device-specific layout
instructions take precedence when making an actual board. Simulation provenance
remains in `PDN_EVIDENCE.md` and `FIELD_SOLVER_EVIDENCE.md`.
