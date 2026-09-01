-- Ask Quarto to place every table in Bootstrap's responsive wrapper.
-- Narrow screens can then scroll a wide table without widening the page.
function Table(table)
  for _, class in ipairs(table.classes) do
    if class == "responsive" then
      return table
    end
  end

  table.classes:insert("responsive")
  return table
end
