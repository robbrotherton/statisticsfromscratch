local function text(value, fallback)
  if value == nil then
    return fallback
  end
  if type(value) == "table" then
    local rendered = pandoc.utils.stringify(value)
    if rendered == "" then
      return fallback
    end
    return rendered
  end
  return tostring(value)
end

local function attr(attributes, classes)
  return pandoc.Attr("", classes or {}, attributes or {})
end

local function unquote_text_context(value)
  value = text(value)
  if not value or #value < 2 then
    return value
  end

  local first = value:sub(1, 1)
  local last = value:sub(-1)
  if (first == "'" and last == "'") or (first == '"' and last == '"') then
    value = value:sub(2, -2)
    value = value:gsub("\\" .. first, first):gsub("\\\\", "\\")
  end
  return value
end

local function html_escape(value, attribute)
  value = tostring(value or "")
    :gsub("&", "&amp;")
    :gsub("<", "&lt;")
    :gsub(">", "&gt;")
  if attribute then
    value = value:gsub('"', "&quot;"):gsub("'", "&#39;")
  end
  return value
end

local function figure_shortcode(args, kwargs, meta, raw_args, context)
  local normalize = context == "text" and unquote_text_context or text
  local id = normalize(args[1])
  local factory = normalize(args[2])
  if not id or not factory then
    error("interactive-figure requires an id and a factory name")
  end

  local options = normalize(kwargs.options) or "{}"
  local fallback = normalize(kwargs.fallback) or "This figure requires JavaScript."

  if context == "text" then
    return '<div class="interactive-figure-mount" data-interactive-figure="'
      .. html_escape(id, true)
      .. '" data-interactive-factory="'
      .. html_escape(factory, true)
      .. '" data-interactive-options="'
      .. html_escape(options, true)
      .. '"><div class="interactive-figure-fallback">'
      .. html_escape(fallback, false)
      .. "</div></div>"
  end

  return pandoc.Div({
    pandoc.Div({ pandoc.Plain({ pandoc.Str(fallback) }) }, attr({}, { "interactive-figure-fallback" }))
  }, attr({
    ["data-interactive-figure"] = id,
    ["data-interactive-factory"] = factory,
    ["data-interactive-options"] = options
  }, { "interactive-figure-mount" }))
end

local function read_asset(path)
  local file = io.open(path, "r")
  if not file and quarto.project and quarto.project.directory then
    file = io.open(quarto.project.directory .. "/" .. path, "r")
  end
  if not file then
    error("inline-svg could not read " .. path)
  end
  local markup = file:read("*a")
  file:close()
  return markup
end

-- Drops an SVG asset into the page rather than sealing it inside an <img>, so
-- the document's stylesheet and scripts can reach the artwork.
local function svg_shortcode(args, kwargs, meta, raw_args, context)
  local normalize = context == "text" and unquote_text_context or text
  local path = normalize(args[1])
  if not path then
    error("inline-svg requires a path to an SVG file")
  end

  local markup = read_asset(path)
  if context == "text" then
    return markup
  end
  return pandoc.RawBlock("html", markup)
end

local function value_shortcode(args, kwargs)
  local path = text(args[1])
  if not path then
    error("interactive-value requires a value path")
  end

  local empty = text(kwargs.empty, "...")
  return pandoc.Span({ pandoc.Str(empty) }, attr({
    ["data-interactive-value"] = path,
    ["data-interactive-format"] = text(kwargs.format, ""),
    ["data-interactive-empty"] = empty
  }, { "interactive-value" }))
end

local function math_shortcode(args, kwargs)
  local prefix = text(args[1], "")
  local path = text(args[2])
  if not path then
    error("interactive-math requires a prefix and a value path")
  end

  local empty = text(kwargs.empty, "...")
  return pandoc.Span({ pandoc.Str(prefix .. " " .. empty) }, attr({
    ["data-interactive-math"] = "true",
    ["data-interactive-value"] = path,
    ["data-interactive-prefix"] = prefix,
    ["data-interactive-format"] = text(kwargs.format, ""),
    ["data-interactive-empty"] = empty
  }, { "math", "inline", "interactive-value", "interactive-math" }))
end

return {
  ["interactive-figure"] = figure_shortcode,
  ["inline-svg"] = svg_shortcode,
  ["interactive-value"] = value_shortcode,
  ["interactive-math"] = math_shortcode
}
