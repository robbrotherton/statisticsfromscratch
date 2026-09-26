import { readFileSync } from "node:fs";

export function readChapter(name) {
  return readFileSync(new URL(`../../${name}`, import.meta.url), "utf8");
}

// The fenced div that carries a Quarto ID, such as `#fig-easy-test-histogram`
// or `#act-standardizing-distributions`, from its opening fence to the
// matching closing fence. IDs are cross-reference targets, so they outlive
// heading and prose rewrites; tests slice by them rather than by heading text.
// Throws when the ID is missing so a renamed div fails loudly instead of
// leaving a test to search an empty or wrong slice.
export function divById(qmd, id) {
  const open = new RegExp(`^(:{3,}) ?\\{#${id}\\b[^\\n]*$`, "m").exec(qmd);
  if (!open) throw new Error(`No fenced div with id #${id}`);
  return closeDiv(qmd, open, `#${id}`);
}

// The fenced div that opens on the line just before a heading, for callouts
// that have no ID. Throws when the heading is missing or is not the first line
// of a fenced div.
export function divByHeading(qmd, heading) {
  const headingIndex = qmd.indexOf(`\n${heading}\n`);
  if (headingIndex < 0) throw new Error(`Heading not found: ${heading}`);
  const lineStart = qmd.lastIndexOf("\n", headingIndex - 1) + 1;
  const open = /^(:{3,}) ?\{[^\n]*$/.exec(qmd.slice(lineStart, headingIndex));
  if (!open) throw new Error(`Heading does not open a fenced div: ${heading}`);
  open.index = lineStart;
  return closeDiv(qmd, open, heading);
}

function closeDiv(qmd, open, label) {
  const fence = open[1];
  const close = new RegExp(`^${fence}\\s*$`, "m");
  const rest = qmd.slice(open.index + open[0].length);
  const end = close.exec(rest);
  if (!end) throw new Error(`Fenced div ${label} is not closed`);
  return qmd.slice(open.index, open.index + open[0].length + end.index + end[0].length);
}

// The text between two markers, for sections that have no ID. Throws when
// either marker is missing.
export function between(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  if (start < 0) throw new Error(`Marker not found: ${startMarker}`);
  const end = endMarker === undefined ? text.length : text.indexOf(endMarker, start);
  if (end < 0) throw new Error(`Marker not found: ${endMarker}`);
  return text.slice(start, end);
}

// Every `.tutorial-step` in a slice, with its title, major and parsed action.
export function tutorialSteps(qmd) {
  return Array.from(
    qmd.matchAll(/^:::+ \{\.tutorial-step\b([^\n]*)\}\s*$/gm),
    (match) => {
      const attrs = match[1];
      const title = /data-title="([^"]+)"/.exec(attrs);
      const major = /data-major="([^"]+)"/.exec(attrs);
      const action = /data-action='([^']+)'/.exec(attrs);
      return {
        title: title && title[1],
        major: major && major[1],
        action: action ? JSON.parse(action[1]) : {}
      };
    }
  );
}
