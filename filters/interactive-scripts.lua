local manifest = {
  ["d3"] = {
    file = "resources/js/d3.min.js"
  },
  ["stat-helpers"] = {
    file = "resources/js/stat-helpers.js"
  },
  ["sampling-core"] = {
    file = "resources/js/sampling-core.js",
    deps = { "stat-helpers" }
  },
  ["sampling-visuals"] = {
    file = "resources/js/sampling-visuals.js",
    deps = { "d3", "sampling-core" }
  },
  ["sampling-pathway"] = {
    file = "resources/js/sampling-pathway.js",
    deps = { "d3", "sampling-core", "sampling-visuals", "interactive-figure-tools" }
  },
  ["interactive-figure-tools"] = {
    file = "resources/js/interactive-figure.js"
  },
  ["bee-swarm-core"] = {
    file = "resources/js/bee-swarm-core.js"
  },
  ["bee-swarm"] = {
    file = "resources/js/bee-swarm.js",
    deps = { "d3", "stat-helpers", "sampling-core", "interactive-figure-tools", "bee-swarm-core" }
  },
  ["graph-generator"] = {
    file = "resources/js/graph-generator.js",
    deps = { "d3", "visibility-helper" }
  },
  ["frequency-table-tutorial"] = {
    file = "resources/js/frequency-table-tutorial.js",
    deps = { "graph-generator", "interactive-figure-tools" }
  },
  ["frequency-distribution-cover"] = {
    file = "resources/js/frequency-distribution-cover.js",
    deps = { "d3", "graph-generator" }
  },
  ["distribution-generator"] = {
    file = "resources/js/distribution-generator.js",
    deps = { "d3", "stat-helpers", "interactive-figure-tools" }
  },
  ["confidence-interval-explorer"] = {
    file = "resources/js/confidence-interval-explorer.js",
    deps = { "d3", "stat-helpers", "interactive-figure-tools" }
  },
  ["ci-nhst-diagram"] = {
    file = "resources/js/ci-nhst-diagram.js",
    deps = { "d3", "stat-helpers", "interactive-figure-tools" }
  },
  ["critical-table-generator"] = {
    file = "resources/js/critical-table-generator.js",
    deps = { "stat-helpers", "interactive-figure-tools" }
  },
  ["statistical-power"] = {
    file = "resources/js/statistical-power.js",
    deps = { "d3", "stat-helpers", "interactive-figure-tools" }
  },
  ["sampling-distribution-builder"] = {
    file = "resources/js/sampling-distribution-builder.js",
    deps = { "d3", "stat-helpers", "interactive-figure-tools" }
  },
  ["sampling-shape-explorer"] = {
    file = "resources/js/sampling-shape-explorer.js",
    deps = { "d3", "sampling-core", "sampling-visuals", "interactive-figure-tools" }
  },
  ["standard-error-curve-demo"] = {
    file = "resources/js/standard-error-curve-demo.js",
    deps = { "d3", "stat-helpers", "interactive-figure-tools", "distribution-generator" }
  },
  ["variability-table-generator"] = {
    file = "resources/js/variability-table-generator.js",
    deps = { "d3", "interactive-figure-tools" }
  },
  ["height-variability-interactive"] = {
    file = "resources/js/height-variability-interactive.js",
    deps = { "d3", "stat-helpers", "interactive-figure-tools" }
  },
  ["mean-balance-beam"] = {
    file = "resources/js/mean-balance-beam.js",
    deps = { "d3", "interactive-figure-tools" }
  },
  ["median-tutorial"] = {
    file = "resources/js/median-tutorial.js",
    deps = { "interactive-figure-tools" }
  },
  ["standardization-ruler"] = {
    file = "resources/js/standardization-ruler.js",
    deps = { "graph-generator", "distribution-generator", "interactive-figure-tools" }
  },
  ["interaction-plot"] = {
    file = "resources/js/interaction-plot.js",
    deps = { "d3", "interactive-figure-tools" }
  },
  ["scatterplot"] = {
    file = "resources/js/scatterplot.js",
    deps = { "d3", "interactive-figure-tools" }
  },
  ["make-inferential-diagram"] = {
    file = "resources/js/make-inferential-diagram.js",
    deps = { "d3" }
  },
  ["variance-partition-diagram"] = {
    file = "resources/js/variance-partition-diagram.js",
    deps = { "d3", "interactive-figure-tools" }
  },
  ["anova-variability-explorer"] = {
    file = "resources/js/anova-variability-explorer.js",
    deps = { "d3", "interactive-figure-tools" }
  },
  ["likert-helper"] = {
    file = "resources/js/likert-helper.js",
    deps = { "d3" }
  },
  ["hidden-message"] = {
    file = "resources/js/hidden-message.js",
    deps = { "d3", "visibility-helper" }
  },
  ["income-distribution"] = {
    file = "resources/js/income-distribution.js",
    deps = { "d3" }
  },
  ["presidential-approval"] = {
    file = "resources/js/presidential-approval.js",
    deps = { "d3" }
  },
  ["dice-cover"] = {
    file = "resources/js/dice.bundle.js",
    deps = { "interactive-figure-tools" }
  },
  ["catan-board"] = {
    file = "resources/js/catan-board.js",
    deps = { "d3", "interactive-figure-tools" }
  },
  ["galton-board"] = {
    file = "resources/js/galton-board.js",
    deps = { "d3", "interactive-figure-tools" }
  },
  ["reaction-time-zscore"] = {
    file = "resources/js/reaction-time-zscore.js",
    deps = { "d3", "standardization-ruler", "interactive-figure-tools" }
  },
  ["visibility-helper"] = {
    file = "resources/js/visibility-helper.js"
  }
}

local function meta_string(value)
  if value == nil then
    return nil
  end
  if type(value) == "string" then
    return value
  end
  if value.t == "MetaString" then
    return value.text
  end
  return pandoc.utils.stringify(value)
end

local function value_type(value)
  if pandoc.utils and pandoc.utils.type then
    return pandoc.utils.type(value)
  end
  return nil
end

local function add_script(scripts, value)
  local script = meta_string(value)
  if script and script ~= "" then
    table.insert(scripts, script)
  end
end

local function collect_scripts_from(value, scripts)
  if not value then
    return
  end

  local kind = value_type(value)
  if value.t == "MetaList" or kind == "List" then
    for _, item in ipairs(value) do
      collect_scripts_from(item, scripts)
    end
    return
  end

  add_script(scripts, value)
end

local function collect_scripts(meta_value)
  local scripts = {}
  collect_scripts_from(meta_value, scripts)
  return scripts
end

local function resolve(name, ordered, visiting, resolved)
  if resolved[name] then
    return
  end
  local entry = manifest[name]
  if not entry then
    quarto.log.warning("Unknown interactive script: " .. name)
    return
  end
  if visiting[name] then
    quarto.log.warning("Circular interactive script dependency: " .. name)
    return
  end

  visiting[name] = true
  for _, dep in ipairs(entry.deps or {}) do
    resolve(dep, ordered, visiting, resolved)
  end
  visiting[name] = false

  resolved[name] = true
  table.insert(ordered, name)
end

function Pandoc(doc)
  local requested = collect_scripts(doc.meta["interactive-scripts"])
  if #requested == 0 then
    return doc
  end

  local ordered = {}
  local resolved = {}
  for _, name in ipairs(requested) do
    resolve(name, ordered, {}, resolved)
  end

  local emitted = {}
  local blocks = {}
  for _, name in ipairs(ordered) do
    local entry = manifest[name]
    if entry and entry.file and not emitted[entry.file] then
      table.insert(blocks, pandoc.RawBlock("html", '<script src="' .. entry.file .. '"></script>'))
      emitted[entry.file] = true
    end
  end

  for index = #blocks, 1, -1 do
    table.insert(doc.blocks, 1, blocks[index])
  end
  return doc
end
