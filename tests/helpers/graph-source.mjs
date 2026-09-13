import { readFileSync } from 'node:fs';
// Same dependency order as the Quarto graph-generator manifest entry.
export const graphModules = ['graph-core', 'graph-data', 'graph-frequency',
  'graph-interval', 'graph-table-export', 'graph-examples', 'graph-generator'];
export const graphSource = graphModules.map(name =>
  readFileSync(new URL(`../../resources/js/${name}.js`, import.meta.url), 'utf8')
).join('\n');
