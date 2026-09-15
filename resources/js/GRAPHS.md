# Graph generator

Use `makeGraph(options)` and list `graph-generator` in chapter
`interactive-scripts`. The Quarto manifest loads its dependencies in order.
Existing chapter calls and global `sfsGraph*` helpers remain supported: the
frequency-distribution cover and standardization ruler use those helpers.
Do not load `graph-generator.js` alone.

Modules:

- `graph-core.js`: options, SVG/axes, styling, animation and responsive sizing.
- `graph-data.js`: frequency normalization, binning, derived proportions and curves.
- `graph-frequency.js`: bars, histograms/blocks, polygons and curves.
- `graph-interval.js`: categorical estimates with explicit uncertainty limits.
- `graph-table-export.js`: frequency tables and SVG/raster export.
- `graph-examples.js`: chapter-specific data, presets and cover compositions.
- `graph-generator.js`: public dispatch, responsive wrapper and `sfsGraphs` API.

These remain classic scripts for compatibility with the interactive runtime.
They deliberately retain existing global names; this is not an ES-module migration.
Helpers may reference later modules inside functions, but must not call those
functions during script initialization. The facade loads last. New shared
helpers belong in the relevant module, with their dependencies declared in
`filters/interactive-scripts.lua`.

## Point-and-interval plots

```js
makeGraph({
  type: 'interval',
  data: [
    { label: 'Candidate A', estimate: 47, lower: 45.7, upper: 48.3 },
    { label: 'Candidate B', estimate: 47, lower: 45.7, upper: 48.3 }
  ],
  scale: 'percent', // values are percentage points, not fractions
  xDomain: [42, 52],
  width: 640,
  height: 230,
  labels: { x: 'Support among likely voters' }
});
```

Labels must be unique and nonempty. Estimates/limits must be finite numbers,
with `lower <= estimate <= upper`. An explicit domain must contain all limits;
an omitted domain is derived with padding and need not include zero. Asymmetric
and zero-width intervals are supported. No percentages are renormalized, and
no confidence level or statistical formula is assumed. In this renderer,
`lower`/`upper` are uncertainty limits, not histogram-bin boundaries.

Optional `color` on each row overrides the shared first-series color.
`showValues: false` hides numeric labels. `valueFormat` and `xTickFormat` accept
formatting functions in JavaScript calls. The renderer is static, including
when `animate` is supplied; resizing preserves readable row spacing. Supply
`ariaLabel` when readers need the interval's meaning, not just its endpoints.

## Verification

`npm test` includes module-aware existing graph tests and interval input tests.
`tests/helpers/graph-source.mjs` loads the graph family for VM-based tests.
After changes, render with `quarto render` and inspect actual chapters at
wide/narrow widths, including dark theme, reduced motion, and animated replays.
Keep a before/after capture when moving existing renderers or shared geometry.

Set `orientation: 'vertical'` for categories on x and estimates on y. Use
`yDomain`, `yTickValues`, `yTickFormat`, and `labels.y` for the numeric axis
in that orientation. Horizontal remains the default and uses `xDomain`.
Vertical plots keep a minimum height of 280px on narrow screens. Per-row
colors can use the book tokens, e.g. `var(--graph-series-1, #0072b2)` and
`var(--graph-series-4, #d55e00)`.
