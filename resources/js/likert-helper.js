// Use `prompt` for one item or `prompts` for several items sharing response labels.
// Set `numberQuestions` to false when the item headings should remain unnumbered.
// Set `questionLines` to reserve equal heading space in a wide multi-item layout.
makeLikert = (opts = {}) => {
  const inputName = opts.name || "likert-happiness";
  const defaultPrompt = "What is your current level of happiness?";
  const prompts = Array.isArray(opts.prompts) && opts.prompts.length > 0
    ? opts.prompts.map(String)
    : [opts.prompt || defaultPrompt];
  const defaultLabels = [
    "1. A lot less than usual",
    "2. A little less than usual",
    "3. About average",
    "4. A little more than usual",
    "5. A lot more than usual"
  ];
  const labels = Array.isArray(opts.labels) && opts.labels.length > 0
    ? opts.labels.map(String)
    : defaultLabels;
  const selectedIndex = Math.floor(labels.length / 2);
  const isMultiple = prompts.length > 1;
  const numberQuestions = isMultiple && opts.numberQuestions !== false;
  const questionLines = isMultiple
    ? Math.max(0, Math.round(Number(opts.questionLines) || 0))
    : 0;

  const container = d3.create("div")
    .attr("class", `bc-figure likert-card${isMultiple ? " likert-multiple" : ""}${questionLines > 1 ? " likert-align-responses" : ""}`)
    .attr("data-likert-count", prompts.length);

  if (questionLines > 1) {
    container.style("--likert-question-min-height", `${questionLines * 1.35}em`);
  }

  const groups = container
    .append("div")
    .attr("class", "likert-groups");

  const questions = groups.selectAll("fieldset")
    .data(prompts)
    .enter()
    .append("fieldset")
    .attr("class", "likert-group");

  questions
    .append("legend")
    .text((prompt, index) => numberQuestions ? `${index + 1}. ${prompt}` : prompt);

  questions.each(function(_, questionIndex) {
    const group = d3.select(this);
    const options = group
      .append("div")
      .attr("class", "likert-options");

    const itemLabels = options.selectAll("label")
      .data(labels)
      .enter()
      .append("label")
      .attr("class", "likert-label");

    itemLabels
      .append("input")
      .attr("class", "likert-button")
      .attr("type", "radio")
      .attr("name", isMultiple ? `${inputName}-${questionIndex + 1}` : inputName)
      .attr("value", (_, index) => index + 1)
      .property("checked", (_, index) => index === selectedIndex);

    itemLabels
      .append("span")
      .text((label) => label);
  });

  return container.node();
}
