-- Ask Quarto to place every table in Bootstrap's responsive wrapper.
-- Narrow screens can then scroll a wide table without widening the page.
--
-- Also mark summary rows: a body row whose filled cells each hold a single
-- labelled value in math, such as `$M_X = 1$` or `$SS_{X \cdot Z} = 1.67$`.
-- When they end the table they get the same class as the step tables'
-- summary rows, and the first gets a rule above it (see sfs-tables.css).

-- A cell that holds nothing but a number, such as 90, -0.33, 2,465, .50 or
-- 81%, becomes inline math, so every number in a table is set in the same
-- math font whether or not the source wrapped it in dollar signs. A bold
-- number (**1**) becomes \mathbf{1}, and a number inside a span keeps its
-- span, as with Chapter 3's [5]{.sfs-mode-marker}.
local function number_tex(inline)
  if not inline or inline.t ~= "Str" then return nil end
  local text = inline.text
  if text:match("^[%-+]?%d[%d,]*%.?%d*%%?$") or text:match("^[%-+]?%.%d+%%?$")
    or text:match("^\u{2212}%d[%d,]*%.?%d*%%?$") or text:match("^\u{2212}%.%d+%%?$") then
    return (text:gsub("\u{2212}", "-"):gsub(",", "{,}"):gsub("%%", "\\%%"))
  end
end

-- The one inline a cell holds, or nil.
local function only_inline(contents)
  local inlines = {}
  for _, block in ipairs(contents) do
    if block.t ~= "Plain" and block.t ~= "Para" then return nil end
    for _, inline in ipairs(block.content) do table.insert(inlines, inline) end
  end
  if #inlines == 1 then return inlines[1] end
end

local function as_math(inline)
  local tex = number_tex(inline)
  if tex then return pandoc.Math("InlineMath", tex) end
  if inline.t == "Strong" and #inline.content == 1 then
    tex = number_tex(inline.content[1])
    if tex then return pandoc.Math("InlineMath", "\\mathbf{" .. tex .. "}") end
  end
  if inline.t == "Span" and #inline.content == 1 then
    local inner = as_math(inline.content[1])
    if inner then return pandoc.Span({ inner }, inline.attr) end
  end
end

local function mathify_numbers(rows)
  for _, row in ipairs(rows) do
    for _, cell in ipairs(row.cells) do
      local inline = only_inline(cell.contents)
      local math = inline and as_math(inline)
      if math then cell.contents = { pandoc.Plain({ math }) } end
    end
  end
end

local function is_summary_cell(cell)
  local inlines = {}
  for _, block in ipairs(cell.contents) do
    if block.t ~= "Plain" and block.t ~= "Para" then return false end
    for _, inline in ipairs(block.content) do
      if inline.t ~= "Space" then table.insert(inlines, inline) end
    end
  end
  if #inlines == 0 then return nil end -- empty cell: neutral
  return #inlines == 1 and inlines[1].t == "Math"
    and inlines[1].text:match("^[^=]+=%s*[-−]?[%d.,/]+%s*$") ~= nil
end

local function is_summary_row(row)
  local filled = 0
  for _, cell in ipairs(row.cells) do
    local summary = is_summary_cell(cell)
    if summary == false then return false end
    if summary then filled = filled + 1 end
  end
  return filled > 0
end

function Table(table)
  mathify_numbers(table.head.rows)
  for _, body in ipairs(table.bodies) do mathify_numbers(body.body) end
  mathify_numbers(table.foot.rows)

  -- Only the run of summary rows that ends the table. Grouped tables with a
  -- mean row after each group (Ch 14, Ch 15) are left alone.
  for _, body in ipairs(table.bodies) do
    local rows = body.body
    local first = #rows + 1
    while first > 1 and is_summary_row(rows[first - 1]) do first = first - 1 end
    if first > 1 then
      for i = first, #rows do
        rows[i].attr.classes:insert("sfs-table-summary-row")
      end
      if first <= #rows then rows[first].attr.classes:insert("sfs-table-summary-first") end
    end
  end

  for _, class in ipairs(table.classes) do
    if class == "responsive" then
      return table
    end
  end

  table.classes:insert("responsive")
  return table
end

-- Tables inside a `.sfs-explain-table` div get each cell's source text as
-- `data-src`, which resources/js/explain-table.js reads to build its popups.
function Div(div)
  if not div.classes:includes("sfs-explain-table") then return nil end
  return div:walk({
    Table = function(tbl)
      for _, body in ipairs(tbl.bodies) do
        for _, row in ipairs(body.body) do
          for _, cell in ipairs(row.cells) do
            cell.attr.attributes["data-src"] = pandoc.utils.stringify(cell.contents)
          end
        end
      end
      return tbl
    end
  })
end
