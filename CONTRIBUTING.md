# Maintaining EE_Review

The course is a static application. A current browser runs it; Node.js 22+ runs
the repository checks and offline builder. Python 3.10+ runs the local launcher
and its HTTP tests. There is no npm install step and no agent service at runtime.

## Where changes belong

| Responsibility | Source |
| --- | --- |
| Lesson catalogue, routing, navigation lifecycle | `assets/curriculum.js` |
| Authored lesson fragments and their interactive setup | `lessons/module-*/lesson-*.html` |
| Numerical parsing, plotting and common learning API | `assets/ad-framework.js` |
| Browser persistence and failure handling | `assets/course-storage.js` |
| Data download/deletion controls | `assets/learning-data-ui.js` |
| Shared exercises and design/measurement widgets | `assets/widgets.js`, `assets/design-brief.js` |
| Reusable circuit symbols and geometry validation | `assets/schematic-svg.js` |
| Topic-specific numerical models | `assets/*-model.js`, `assets/rf-matching.js`, `assets/protocol-signals.js` |
| Evidence, simulation inputs, exported data | `docs/examples`, `docs/data`, evidence ledgers in `docs` |
| Static checks and independent numerical regressions | `tools/audit.js` and the checks it lists |

Keep new behavior in the module that owns it. Avoid adding another storage
implementation, numerical parser, circuit renderer or copy of a topic model.
Preserve existing interfaces when extracting code from the larger legacy files.
Use descriptive names and comments for assumptions and limitations, rather than
comments narrating each line. Separate behavior changes from mass reformatting.

## Verification before a change ships

```console
node tools/stamp-build.js
node tools/audit.js
python tools/test_serve.py
```

The audit is a gate, not proof that every lesson is correct. Some diagram checks
carry explicit legacy baselines. Inspect any changed diagrams at desktop and
phone widths; examine the actual curves and labels, not just console output.
Add regression checks for meaningful failure modes (wrong physics, lost data,
unsafe paths), using independent expected results wherever possible.

For an offline change, also run `node tools/build-standalone.js` and verify the
result in a browser. Its MathJax asset must be supplied as documented by the
builder. Check online and offline script lists when adding a shared browser file.
The PR workflow runs the audit and HTTP tests without deployment permissions.

## Evidence and numerical models

Use primary references for physical claims. State topology, units, reference
planes, boundary conditions, component assumptions and model validity. A graph
must identify whether it is calculated, simulated or measured, and link to the
inputs, raw data and reproduction method. Never label a synthetic curve as a
measurement. Keep unresolved discrepancies visible; do not tune a model merely
to make a plot agree. Follow the existing PDN and protocol evidence ledgers.

External simulator source, installations and private board projects belong in
their own repositories/workspaces. Only intentionally published examples and
results belong here. Do not commit credentials, browser profiles, private board
files, licensed reference PDFs, solver installations or temporary raw dumps.

## Trust boundaries and learning data

Read [SECURITY.md](SECURITY.md) before changing file serving, persistence or
content loading. Lesson HTML and scripts are executable, repository-reviewed
application code. They are **not** a safe format for importing untrusted lessons.
Use textContent for student-controlled strings; do not interpolate them into
HTML, executable scripts, CSS selectors or shell commands. Changes to a trusted
HTML rendering path need an explicit review of the source of every value.

## Remaining maintenance work

- `curriculum.js` and `schematic-svg.js` remain large legacy modules. Extract
  cohesive parts only with public-interface and rendered regression coverage.
- Storage still uses historical `design:` keys. Moving them to a course-specific
  prefix requires migration and backward compatibility, not a silent reset.
- There is a data export but no restore/import UI. An importer would need size
  limits, a versioned schema, field validation and atomic failure behavior.
- The MathJax dependency and GitHub Actions references need a separate pinned
  dependency/update policy. This change does not claim a supply-chain audit.
- Repository execution and lesson scripts assume trusted maintainers. A hosted
  user-upload service would need a different architecture and security review.

Record the problem, change, tests and remaining uncertainty in each commit or PR.
Another maintainer should be able to reproduce the result without reading a chat.
