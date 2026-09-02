local stringify = pandoc.utils.stringify

local QUESTION_TYPES = {
  ["free-response"] = true,
  ["free"] = true,
  ["multiple-choice"] = true,
  ["true-false"] = true,
  ["numeric"] = true,
}

local function has_class(el, class_name)
  for _, class in ipairs(el.classes) do
    if class == class_name then
      return true
    end
  end
  return false
end

local function trim(value)
  return tostring(value or ""):gsub("^%s+", ""):gsub("%s+$", "")
end

local function is_blank(value)
  return value == nil or trim(value) == ""
end

local HTML_WRITER_OPTIONS = {
  html_math_method = "mathjax",
}

local function write_html(document)
  return trim(pandoc.write(document, "html", HTML_WRITER_OPTIONS))
end

local function markdown_to_html(value)
  local markdown = trim(value)
  if markdown == "" then
    return ""
  end
  return write_html(pandoc.read(markdown, "markdown"))
end

local function inlines_to_html(value)
  return write_html(pandoc.Pandoc({ pandoc.Para(value) }))
end

local function blocks_to_html(value)
  return write_html(pandoc.Pandoc(value))
end

local function rich_value(value, html)
  return {
    __pandoc_text = stringify(value),
    __pandoc_html = html,
  }
end

local function field_text(value)
  if type(value) == "table" and value.__pandoc_text then
    return value.__pandoc_text
  end
  return value
end

local function field_html(value)
  if type(value) == "table" and value.__pandoc_html then
    return value.__pandoc_html
  end
  return markdown_to_html(value)
end

local function meta_to_lua(value)
  local value_type = pandoc.utils.type(value)

  if value_type == "MetaBool" then
    return value
  end

  if value_type == "MetaString" then
    return tostring(value)
  end

  if value_type == "Inlines" or value_type == "MetaInlines" then
    return rich_value(value, inlines_to_html(value))
  end

  if value_type == "Blocks" or value_type == "MetaBlocks" then
    return rich_value(value, blocks_to_html(value))
  end

  if value_type == "List" or value_type == "MetaList" then
    local result = {}
    for _, item in ipairs(value) do
      table.insert(result, meta_to_lua(item))
    end
    return result
  end

  if value_type == "table" or value_type == "Meta" or value_type == "MetaMap" or value_type == "Map" then
    local result = {}
    for key, item in pairs(value) do
      result[key] = meta_to_lua(item)
    end
    return result
  end

  if type(value) == "number" or type(value) == "boolean" then
    return value
  end

  return stringify(value)
end

local function is_array(value)
  if type(value) ~= "table" then
    return false
  end

  local count = 0
  for key, _ in pairs(value) do
    if type(key) ~= "number" then
      return false
    end
    if key > count then
      count = key
    end
  end

  for index = 1, count do
    if value[index] == nil then
      return false
    end
  end

  return true
end

local function json_escape(value)
  local replacements = {
    ['"'] = '\\"',
    ["\\"] = "\\\\",
    ["\b"] = "\\b",
    ["\f"] = "\\f",
    ["\n"] = "\\n",
    ["\r"] = "\\r",
    ["\t"] = "\\t",
    ["<"] = "\\u003c",
    [">"] = "\\u003e",
    ["&"] = "\\u0026",
  }

  return tostring(value):gsub('[\\"%z\1-\31<>&]', replacements)
end

local function html_escape(value, attribute)
  if value == nil then
    value = ""
  else
    value = tostring(value)
  end
  value = value
    :gsub("&", "&amp;")
    :gsub("<", "&lt;")
    :gsub(">", "&gt;")
  if attribute then
    value = value:gsub('"', "&quot;"):gsub("'", "&#39;")
  end
  return value
end

local function json_encode(value)
  local value_type = type(value)

  if value == nil then
    return "null"
  end

  if value_type == "string" then
    return '"' .. json_escape(value) .. '"'
  end

  if value_type == "number" then
    return tostring(value)
  end

  if value_type == "boolean" then
    return value and "true" or "false"
  end

  if value_type == "table" then
    local parts = {}
    if is_array(value) then
      for _, item in ipairs(value) do
        table.insert(parts, json_encode(item))
      end
      return "[" .. table.concat(parts, ",") .. "]"
    end

    for key, item in pairs(value) do
      table.insert(parts, json_encode(tostring(key)) .. ":" .. json_encode(item))
    end
    return "{" .. table.concat(parts, ",") .. "}"
  end

  return "null"
end

local function validation_error(path, message)
  error("Invalid quiz YAML at " .. path .. ": " .. message, 0)
end

local function valid_id(value)
  return type(value) == "string" and value:match("^[A-Za-z0-9_-]+$") ~= nil
end

local function is_numeric(value)
  return value ~= nil and tonumber(tostring(value)) ~= nil
end

local function is_booleanish(value)
  return value == true or value == false or value == "true" or value == "false"
end

local function validate_tolerance(question, path)
  if question.tolerance == nil or question.tolerance == "" then
    return
  end

  if not is_numeric(question.tolerance) then
    validation_error(path .. ".tolerance", "must be a number")
  end

  if tonumber(tostring(question.tolerance)) < 0 then
    validation_error(path .. ".tolerance", "must be zero or greater")
  end
end

local function validate_range(question, path)
  for _, key in ipairs({ "min", "max" }) do
    local bound = question[key]
    if bound ~= nil and trim(bound) ~= "" and not is_numeric(bound) then
      validation_error(path .. "." .. key, "must be a number")
    end
  end

  if is_numeric(question.min) and is_numeric(question.max) and
      tonumber(tostring(question.min)) > tonumber(tostring(question.max)) then
    validation_error(path .. ".min", "must be less than or equal to max")
  end
end

local function validate_hints(question, path)
  if question.hints == nil then
    return
  end

  if not is_array(question.hints) or #question.hints == 0 then
    validation_error(path .. ".hints", "must be a nonempty list")
  end

  for index, hint in ipairs(question.hints) do
    local hint_path = path .. ".hints[" .. index .. "]"
    if type(hint) ~= "table" then
      validation_error(hint_path, "must be a hint object")
    end
    if is_blank(hint.text) then
      validation_error(hint_path .. ".text", "is required")
    end
  end
end

local function validate_question(question, path, seen_ids)
  if type(question) ~= "table" then
    validation_error(path, "must be a question object")
  end

  if is_blank(question.id) then
    validation_error(path .. ".id", "is required")
  end

  if not valid_id(question.id) then
    validation_error(path .. ".id", "may contain only letters, numbers, underscores, and hyphens")
  end

  if seen_ids[question.id] then
    validation_error(path .. ".id", "duplicates question id '" .. question.id .. "'")
  end
  seen_ids[question.id] = true

  if is_blank(question.type) then
    validation_error(path .. ".type", "is required")
  end

  if question.type == "free" then
    question.type = "free-response"
  end

  if not QUESTION_TYPES[question.type] then
    validation_error(path .. ".type", "must be free-response, multiple-choice, true-false, or numeric")
  end

  if question.checkLabel ~= nil and is_blank(question.checkLabel) then
    validation_error(path .. ".checkLabel", "must not be blank")
  end

  if question.answerFrom ~= nil then
    if is_blank(question.answerFrom) then
      validation_error(path .. ".answerFrom", "must not be blank")
    end
    if question.type ~= "numeric" then
      validation_error(path .. ".answerFrom", "is only available on numeric questions")
    end
    if question.answer ~= nil and trim(question.answer) ~= "" then
      validation_error(path .. ".answerFrom", "cannot be combined with answer")
    end
  end

  validate_hints(question, path)

  if question.type == "multiple-choice" then
    if not is_array(question.options) or #question.options < 2 then
      validation_error(path .. ".options", "must contain at least two options")
    end

    local correct_count = 0
    for index, option in ipairs(question.options) do
      local option_path = path .. ".options[" .. index .. "]"
      if type(option) ~= "table" then
        validation_error(option_path, "must be an option object")
      end
      if is_blank(option.text) then
        validation_error(option_path .. ".text", "is required")
      end
      if option.correct == true then
        correct_count = correct_count + 1
      end
    end

    if correct_count ~= 1 then
      validation_error(path .. ".options", "must mark exactly one option with correct: true")
    end
  end

  if question.type == "true-false" and not is_booleanish(question.answer) then
    validation_error(path .. ".answer", "must be true or false")
  end

  if question.type == "numeric" then
    if question.answer ~= nil and trim(question.answer) ~= "" and
        not is_numeric(question.answer) then
      validation_error(path .. ".answer", "must be numeric")
    end
    validate_tolerance(question, path)
    validate_range(question, path)
  end

  if question.diagnostics ~= nil then
    if not is_array(question.diagnostics) then
      validation_error(path .. ".diagnostics", "must be a list of diagnostic questions")
    end
    for index, diagnostic in ipairs(question.diagnostics) do
      validate_question(diagnostic, path .. ".diagnostics[" .. index .. "]", seen_ids)
    end
  end
end

local function validate_quiz(quiz)
  if type(quiz) ~= "table" then
    validation_error("quiz", "must be a mapping")
  end

  if is_blank(quiz.id) then
    validation_error("quiz.id", "is required")
  end

  if not valid_id(quiz.id) then
    validation_error("quiz.id", "may contain only letters, numbers, underscores, and hyphens")
  end

  if not is_array(quiz.questions) or #quiz.questions == 0 then
    validation_error("quiz.questions", "must contain at least one question")
  end

  local seen_ids = {}
  for index, question in ipairs(quiz.questions) do
    validate_question(question, "quiz.questions[" .. index .. "]", seen_ids)
  end
end

local function hint_to_object(hint)
  if type(hint) == "table" and hint.__pandoc_text then
    return {
      text = field_text(hint),
      textHtml = field_html(hint),
    }
  end

  if type(hint) == "table" then
    hint.textHtml = field_html(hint.text)
    hint.text = field_text(hint.text)
    return hint
  end

  return {
    text = field_text(hint),
    textHtml = field_html(hint),
  }
end

local function add_hints_html(question)
  if question.hints == nil and question.hint ~= nil then
    question.hints = { question.hint }
  end

  question.hint = nil

  if type(question.hints) ~= "table" then
    return
  end

  if not is_array(question.hints) then
    question.hints = { question.hints }
  end

  for index, hint in ipairs(question.hints) do
    question.hints[index] = hint_to_object(hint)
  end
end

local function add_question_html(question)
  question.id = field_text(question.id)
  question.type = field_text(question.type)
  question.checkLabel = field_text(question.checkLabel)
  question.answerFrom = field_text(question.answerFrom)
  question.tolerance = field_text(question.tolerance)
  question.min = field_text(question.min)
  question.max = field_text(question.max)
  question.promptHtml = field_html(question.prompt)
  question.prompt = field_text(question.prompt)
  question.answerHtml = field_html(question.answer)
  question.answer = field_text(question.answer)
  question.explanationHtml = field_html(question.explanation)
  question.explanation = field_text(question.explanation)
  add_hints_html(question)

  if type(question.options) == "table" then
    for _, option in ipairs(question.options) do
      option.textHtml = field_html(option.text)
      option.text = field_text(option.text)
    end
  end

  if type(question.diagnostics) == "table" then
    for _, diagnostic in ipairs(question.diagnostics) do
      add_question_html(diagnostic)
    end
  end
end

local function quiz_from_yaml(yaml)
  local doc = pandoc.read("---\n" .. yaml .. "\n---\n", "markdown")
  local quiz = meta_to_lua(doc.meta)

  if quiz.quiz then
    quiz = quiz.quiz
  end

  quiz.id = field_text(quiz.id)
  quiz.titleHtml = field_html(quiz.title)
  quiz.title = field_text(quiz.title)

  if type(quiz.questions) == "table" then
    for _, question in ipairs(quiz.questions) do
      add_question_html(question)
    end
  end

  validate_quiz(quiz)

  return quiz
end

local function answer_html(question)
  if question.type == "multiple-choice" and type(question.options) == "table" then
    for _, option in ipairs(question.options) do
      if option.correct == true then
        return option.textHtml or ""
      end
    end
    return ""
  end

  if question.type == "true-false" then
    return tostring(question.answer) == "true" and "<p>True</p>" or "<p>False</p>"
  end

  return question.answerHtml or ""
end

local function render_choices(quiz, question, options)
  local name = quiz.id .. "-" .. question.id
  local parts = {
    '<fieldset class="quiz-options">',
    '<legend class="visually-hidden">Response options</legend>',
  }

  for index, option in ipairs(options) do
    local option_id = name .. "-option-" .. index
    local text_id = option_id .. "-text"
    local value = option.value
    if value == nil then
      value = index - 1
    end
    table.insert(parts,
      '<div class="quiz-choice">'
      .. '<input type="radio" name="' .. html_escape(name, true)
      .. '" id="' .. html_escape(option_id, true)
      .. '" value="' .. html_escape(value, true)
      .. '" aria-labelledby="' .. html_escape(text_id, true) .. '">'
      .. '<div class="quiz-choice-text" id="' .. html_escape(text_id, true)
      .. '">' .. (option.textHtml or "") .. "</div></div>")
  end

  table.insert(parts, "</fieldset>")
  return table.concat(parts)
end

local function render_control(quiz, question)
  if question.type == "multiple-choice" then
    return render_choices(quiz, question, question.options or {})
  end

  if question.type == "true-false" then
    return render_choices(quiz, question, {
      { value = true, textHtml = "<p>True</p>" },
      { value = false, textHtml = "<p>False</p>" },
    })
  end

  if question.type == "numeric" then
    return '<div class="quiz-input-shell quiz-input-shell-numeric">'
      .. '<input type="text" inputmode="decimal" autocomplete="off" '
      .. 'placeholder="Enter a number" aria-label="Numeric response">'
      .. '<span class="quiz-input-status" aria-hidden="true"></span></div>'
  end

  return '<textarea placeholder="Write your response" aria-label="Written response"></textarea>'
end

local function render_question(quiz, question, diagnostic, number)
  local classes = diagnostic
    and "quiz-question quiz-question-diagnostic"
    or "quiz-question"
  local parts = {
    '<article class="' .. classes .. '" data-question-id="'
      .. html_escape(question.id, true) .. '"'
      .. (diagnostic and ' data-quiz-diagnostic="true"' or "") .. ">",
  }

  local prompt = question.promptHtml or ""
  if number ~= nil and not diagnostic then
    table.insert(parts, '<div class="quiz-question-header">')
    table.insert(parts,
      '<span class="quiz-qbadge" aria-hidden="true">'
      .. '<span class="quiz-qbadge-number">' .. tostring(number) .. "</span>"
      .. '<i class="bi bi-check"></i></span>')
    if prompt ~= "" then
      table.insert(parts, '<div class="quiz-prompt">' .. prompt .. "</div>")
    end
    table.insert(parts, "</div>")
  elseif prompt ~= "" then
    table.insert(parts, '<div class="quiz-prompt">' .. prompt .. "</div>")
  end

  table.insert(parts, '<div class="quiz-control">' .. render_control(quiz, question) .. "</div>")
  table.insert(parts,
    '<div class="quiz-actions" hidden>'
    .. '<button type="button" data-quiz-action="check"></button>'
    .. '<button type="button" class="quiz-secondary" data-quiz-action="hint" hidden>Show hint</button>'
    .. '<button type="button" class="quiz-secondary" data-quiz-action="reveal" hidden>Show answer</button>'
    .. (diagnostic and "" or
      '<button type="button" class="quiz-secondary" data-quiz-action="diagnostics" hidden>Check your work</button>')
    .. '<button type="button" class="quiz-clear" data-quiz-action="clear" '
    .. 'aria-label="Clear saved response" hidden>Clear</button></div>')
  table.insert(parts,
    '<div class="quiz-feedback" aria-live="polite" hidden>'
    .. '<strong data-quiz-feedback-label></strong></div>')

  table.insert(parts, '<div class="quiz-hints-panel" hidden>')
  for index, hint in ipairs(question.hints or {}) do
    local label = #question.hints > 1 and ("Hint " .. index) or "Hint"
    table.insert(parts,
      '<div class="quiz-hint" data-quiz-hint-index="' .. index .. '" hidden>'
      .. "<strong>" .. label .. "</strong>" .. (hint.textHtml or "") .. "</div>")
  end
  table.insert(parts, "</div>")

  table.insert(parts, '<div class="quiz-explanation-panel" hidden>')
  local model_answer = answer_html(question)
  if model_answer ~= "" then
    table.insert(parts,
      '<div class="quiz-model-answer"><strong>Answer</strong>' .. model_answer .. "</div>")
  end
  if question.explanationHtml and question.explanationHtml ~= "" then
    table.insert(parts,
      '<div class="quiz-explanation-rendered"><strong>Explanation</strong>'
      .. question.explanationHtml .. "</div>")
  end
  table.insert(parts, "</div>")

  table.insert(parts, '<div class="quiz-diagnostics" hidden>')
  if type(question.diagnostics) == "table" and #question.diagnostics > 0 then
    table.insert(parts, '<div class="quiz-diagnostics-heading">Check your work</div>')
    for _, diagnostic_question in ipairs(question.diagnostics) do
      table.insert(parts, render_question(quiz, diagnostic_question, true, nil))
    end
  end
  table.insert(parts, "</div></article>")

  return table.concat(parts)
end

local function render_quiz_shell(quiz)
  local questions = quiz.questions or {}
  local multi_question = #questions > 1
  local parts = {
    '<section class="quiz callout callout-style-default callout-note callout-titled"'
      .. ' data-quiz-id="' .. html_escape(quiz.id, true) .. '"'
      .. ' aria-label="' .. html_escape(quiz.title or "Learning Check", true) .. '">',
    '<div class="callout-header d-flex align-content-center">',
    '<div class="callout-icon-container"><i class="callout-icon"></i></div>',
    '<div class="callout-caption-container flex-fill">'
      .. (quiz.titleHtml or "<p>Learning Check</p>") .. "</div>",
  }

  if multi_question then
    table.insert(parts,
      '<span class="quiz-progress" aria-label="0 of ' .. #questions
      .. ' questions answered" hidden><i class="bi bi-check-circle-fill" '
      .. 'aria-hidden="true" hidden></i><span data-quiz-progress-label>0 of '
      .. #questions .. "</span></span>")
  end

  table.insert(parts, '</div><div class="callout-body-container callout-body">')
  for index, question in ipairs(questions) do
    table.insert(parts,
      render_question(quiz, question, false, multi_question and index or nil))
  end
  table.insert(parts, "</div>")
  table.insert(parts,
    '<script type="application/json" class="quiz-data" data-quiz-id="'
      .. html_escape(quiz.id, true) .. '">' .. json_encode(quiz) .. "</script>")
  table.insert(parts, "</section>")
  return table.concat(parts)
end

function CodeBlock(el)
  if not has_class(el, "quiz-yaml") then
    return nil
  end

  local quiz = quiz_from_yaml(el.text)
  return pandoc.RawBlock("html", render_quiz_shell(quiz))
end
