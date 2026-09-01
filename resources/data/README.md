# Figure Data

This directory holds source data files used by generated figures in the rendered
book. Files here are copied by Quarto because `_quarto.yml` includes the whole
`resources/` directory as a project resource.

Keep tabular source data as CSV unless a figure needs nested data or a custom
schema. D3 can load and parse CSV directly, and CSV remains easier to audit,
diff, and edit than a large JavaScript or JSON literal.

## Files

- `presidential-job-approval.csv`: presidential job approval data collated from
  the American Presidency Project approval tables. The chapter 2 chart uses
  `president`, `term`, `start_date`, and `approving`.

## Data Notes

- Approval points are plotted by polling-period start date, matching the
  American Presidency Project note for its own approval graphs.
- Two malformed end dates from the source table were corrected so the CSV parses
  cleanly: Biden `2/20/224` to `2/20/2024`, and Johnson `020/5/1964` to
  `02/05/1964`.
- Some non-chart columns are incomplete in the source data, especially partisan
  approval fields for older presidents. Re-audit those columns before using
  them for future figures.
