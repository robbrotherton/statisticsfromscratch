import { readFileSync } from "node:fs";

// site-theme.css was split into these files, loaded in this order by
// _quarto.yml. Tests that assert on the book's styling read them as one sheet,
// so an assertion still holds when a rule moves between files.
export const STYLE_PARTS = ["base", "home", "figures", "tables", "tutorials", "navbar"];

export const siteStyles = STYLE_PARTS
  .map((name) => readFileSync(new URL(`../resources/css/sfs-${name}.css`, import.meta.url), "utf8"))
  .join("\n");
